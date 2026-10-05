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
