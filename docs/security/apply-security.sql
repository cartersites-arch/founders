-- Unapplied review draft, not a migration. Test against an isolated database first.
-- No hosted database is changed by preparing this file.
BEGIN;

-- RLS restricts rows, not writable columns. Billing and domain ownership are
-- server-managed. Even administrators use authenticated server operations.
REVOKE INSERT, UPDATE, DELETE ON public.workspaces FROM PUBLIC, anon, authenticated;
REVOKE UPDATE (id, slug, marketplace_domain, domain_verified_at, owner_user_id,
  plan, subscription_status, trial_ends_at, current_period_end,
  stripe_customer_id, stripe_subscription_id, is_internal, created_at, updated_at)
  ON public.workspaces FROM PUBLIC, anon, authenticated;
GRANT UPDATE (name) ON public.workspaces TO authenticated;

-- Restore the RLS helper permission revoked by an earlier migration, but
-- prevent callers from probing another user's role or membership.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id
  );
$$;
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _user_id AND role = 'owner'
  );
$$;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid, uuid), public.is_workspace_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid), public.is_workspace_owner(uuid, uuid) TO authenticated, service_role;

-- Public form inserts must pass the server's abuse guard. A publishable key
-- alone must not bypass it by writing directly to PostgREST.
REVOKE INSERT ON public.pool_waitlist, public.feature_requests,
  public.provider_leads, public.provider_claims, public.provider_plan_requests,
  public.city_link_clicks FROM PUBLIC, anon, authenticated;



-- Restrict direct RPC access; trusted server uses service_role.
-- Self-scoped has_role and membership helpers remain available for RLS.
REVOKE ALL ON FUNCTION public.workspace_for_host(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_for_host(text) TO service_role;
REVOKE ALL ON FUNCTION public.count_providers_by_category() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_providers_by_category() TO service_role;

-- Apply inside the main security transaction. Only service_role may invoke these RPCs.
CREATE TABLE IF NOT EXISTS public.submission_rate_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts > 0),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS submission_rate_limits_expiry ON public.submission_rate_limits(expires_at);
ALTER TABLE public.submission_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.submission_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.submission_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_submission_limits(
  _scope text, _client_hash text, _recipient_hash text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  request_time timestamptz := clock_timestamp();
  item record;
  accepted integer;
BEGIN
  IF _scope NOT IN ('waitlist','provider-lead','provider-listing','provider-claim','provider-plan','feature-request','content-404','city-click')
    OR _client_hash IS NULL OR _client_hash !~ '^[a-f0-9]{64}$'
    OR (_recipient_hash IS NOT NULL AND _recipient_hash !~ '^[a-f0-9]{64}$') THEN
    RAISE EXCEPTION 'Invalid submission limit parameters';
  END IF;
  -- Bounded indexed cleanup; no visitor addresses or emails are stored.
  FOR item IN SELECT key FROM public.submission_rate_limits WHERE expires_at <= request_time
    ORDER BY key LIMIT 100 FOR UPDATE SKIP LOCKED
  LOOP
    DELETE FROM public.submission_rate_limits WHERE key=item.key;
  END LOOP;
  -- Stable lock order prevents deadlocks between overlapping scopes.
  FOR item IN SELECT * FROM (VALUES
    ('all-submissions'::text, 60, 60),
    (_scope || ':client:' || _client_hash, 5, 60),
    (_scope || ':recipient:' || coalesce(_recipient_hash,''), 3, 3600)
  ) AS limits(key, maximum, seconds)
    WHERE _recipient_hash IS NOT NULL OR key NOT LIKE '%:recipient:%'
    ORDER BY key
  LOOP
    INSERT INTO public.submission_rate_limits AS counters(key, attempts, expires_at)
    VALUES (item.key, 1, request_time + make_interval(secs => item.seconds))
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN counters.expires_at <= request_time THEN 1 ELSE counters.attempts + 1 END,
      expires_at = CASE WHEN counters.expires_at <= request_time
        THEN request_time + make_interval(secs => item.seconds) ELSE counters.expires_at END
    WHERE counters.expires_at <= request_time OR counters.attempts < item.maximum
    RETURNING attempts INTO accepted;
    IF NOT FOUND THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_submission_limits(text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_submission_limits(text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_stripe_subscription_event(
  _workspace_id uuid, _event_id text, _event_at timestamptz,
  _expected_event_id text, _subscription jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  workspace public.workspaces%ROWTYPE;
  previous public.customer_subscriptions%ROWTYPE;
  customer text := _subscription->>'stripe_customer_id';
BEGIN
  IF _event_id IS NULL OR _event_at IS NULL OR _subscription->>'stripe_subscription_id' IS NULL OR customer IS NULL THEN
    RAISE EXCEPTION 'Invalid billing event';
  END IF;
  -- Lock a stable existing row even when the subscription has not been inserted yet.
  SELECT * INTO workspace FROM public.workspaces WHERE id = _workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown billing workspace'; END IF;
  IF workspace.stripe_customer_id IS NOT NULL AND workspace.stripe_customer_id <> customer THEN
    RAISE EXCEPTION 'Billing customer mismatch';
  END IF;
  SELECT * INTO previous FROM public.customer_subscriptions WHERE workspace_id = _workspace_id;
  IF previous.last_event_id = _event_id OR previous.last_event_at > _event_at THEN RETURN false; END IF;
  -- Late events for a superseded subscription must not replace its successor.
  IF previous.stripe_subscription_id IS NOT NULL
    AND previous.stripe_subscription_id <> _subscription->>'stripe_subscription_id' THEN
    IF NOT coalesce((_subscription->>'allow_subscription_replacement')::boolean,false) THEN RETURN false; END IF;
    IF previous.status NOT IN ('canceled','incomplete_expired') THEN
      RAISE EXCEPTION 'Previous subscription still live; retry reconciliation';
    END IF;
  END IF;
  -- A Stripe snapshot fetched before a concurrent commit must be fetched again on retry.
  -- This also protects different events with the same second-level Stripe timestamp.
  IF previous.last_event_id IS DISTINCT FROM _expected_event_id THEN
    RAISE EXCEPTION 'Concurrent billing update; retry snapshot';
  END IF;
  INSERT INTO public.customer_subscriptions (
    workspace_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan,status,
    cancel_at_period_end,current_period_start,current_period_end,trial_ends_at,canceled_at,
    last_event_id,last_event_at,raw
  ) VALUES (
    _workspace_id,customer,_subscription->>'stripe_subscription_id',_subscription->>'stripe_price_id',
    (_subscription->>'plan')::public.app_plan,(_subscription->>'status')::public.subscription_status,
    coalesce((_subscription->>'cancel_at_period_end')::boolean,false),
    (_subscription->>'current_period_start')::timestamptz,(_subscription->>'current_period_end')::timestamptz,
    (_subscription->>'trial_ends_at')::timestamptz,(_subscription->>'canceled_at')::timestamptz,
    _event_id,_event_at,_subscription->'raw'
  ) ON CONFLICT (workspace_id) DO UPDATE SET
    stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,
    stripe_price_id=excluded.stripe_price_id,plan=excluded.plan,status=excluded.status,
    cancel_at_period_end=excluded.cancel_at_period_end,current_period_start=excluded.current_period_start,
    current_period_end=excluded.current_period_end,trial_ends_at=excluded.trial_ends_at,canceled_at=excluded.canceled_at,
    last_event_id=excluded.last_event_id,last_event_at=excluded.last_event_at,raw=excluded.raw;
  UPDATE public.workspaces SET stripe_customer_id=customer,
    subscription_status=(_subscription->>'status')::public.subscription_status,
    plan=(_subscription->>'plan')::public.app_plan,
    trial_ends_at=(_subscription->>'trial_ends_at')::timestamptz,
    current_period_end=(_subscription->>'current_period_end')::timestamptz,
    stripe_subscription_id=_subscription->>'stripe_subscription_id'
    WHERE id=_workspace_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_stripe_subscription_event(uuid,text,timestamptz,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_subscription_event(uuid,text,timestamptz,text,jsonb) TO service_role;

-- Profiles are account data; public forum names remain on the public forum records.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.profiles;
CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT
  TO authenticated USING ((SELECT auth.uid()) = user_id);

-- Authors may edit their content, not pinning, counts, identities or timestamps.
REVOKE INSERT, UPDATE ON public.mb_threads, public.mb_replies FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id,user_id,author_name,title,body,category,is_pinned,reply_count,like_count,last_activity_at,created_at,updated_at),
  UPDATE (id,user_id,author_name,title,body,category,is_pinned,reply_count,like_count,last_activity_at,created_at,updated_at)
  ON public.mb_threads FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id,thread_id,user_id,author_name,body,like_count,created_at,updated_at),
  UPDATE (id,thread_id,user_id,author_name,body,like_count,created_at,updated_at)
  ON public.mb_replies FROM PUBLIC, anon, authenticated;
GRANT INSERT(user_id,title,body,category), UPDATE(title,body,category) ON public.mb_threads TO authenticated;
GRANT INSERT(user_id,thread_id,body), UPDATE(body) ON public.mb_replies TO authenticated;

-- Trigger-only privileged maintenance: required to update counts on another author's row.
-- Direct callers cannot execute these functions; no caller-selected tables or SQL are used.
CREATE OR REPLACE FUNCTION public.mb_update_thread_reply_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    UPDATE public.mb_threads SET reply_count=reply_count+1,last_activity_at=now() WHERE id=NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    UPDATE public.mb_threads SET reply_count=greatest(reply_count-1,0) WHERE id=OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.mb_update_like_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.thread_id IS NOT NULL THEN
      UPDATE public.mb_threads SET like_count=like_count+1 WHERE id=NEW.thread_id;
    ELSIF NEW.reply_id IS NOT NULL THEN
      UPDATE public.mb_replies SET like_count=like_count+1 WHERE id=NEW.reply_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    IF OLD.thread_id IS NOT NULL THEN
      UPDATE public.mb_threads SET like_count=greatest(like_count-1,0) WHERE id=OLD.thread_id;
    ELSIF OLD.reply_id IS NOT NULL THEN
      UPDATE public.mb_replies SET like_count=greatest(like_count-1,0) WHERE id=OLD.reply_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.mb_update_thread_reply_count(),public.mb_update_like_counts() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.apply_email_unsubscribe(_token text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE entry public.email_unsubscribe_tokens%ROWTYPE;
BEGIN
  IF _token IS NULL OR length(_token)<16 OR length(_token)>256 THEN RETURN 'invalid'; END IF;
  SELECT * INTO entry FROM public.email_unsubscribe_tokens WHERE token=_token FOR UPDATE;
  IF NOT FOUND THEN RETURN 'invalid'; END IF;
  INSERT INTO public.suppressed_emails(email,reason) VALUES(lower(entry.email),'unsubscribe')
    ON CONFLICT(email) DO UPDATE SET reason=excluded.reason;
  -- This also repairs legacy used tokens whose earlier suppression write failed.
  IF entry.used_at IS NOT NULL THEN RETURN 'already'; END IF;
  UPDATE public.email_unsubscribe_tokens SET used_at=now() WHERE token=_token;
  RETURN 'success';
END;
$$;
REVOKE ALL ON FUNCTION public.apply_email_unsubscribe(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_email_unsubscribe(text) TO service_role;

COMMIT;
