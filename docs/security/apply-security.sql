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

COMMIT;
