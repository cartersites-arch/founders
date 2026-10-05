-- Restrict direct RPC access; trusted server uses service_role.
-- Self-scoped has_role and membership helpers remain available for RLS.
REVOKE ALL ON FUNCTION public.workspace_for_host(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_for_host(text) TO service_role;
REVOKE ALL ON FUNCTION public.count_providers_by_category() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_providers_by_category() TO service_role;
