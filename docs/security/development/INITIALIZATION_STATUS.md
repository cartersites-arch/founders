# Development initialization status

The reviewed schema was applied only to `founders-dev` (`vpewpybdvtnhwxhzyubc`) after confirming an empty public schema and no Auth users. Initialization ran in a transaction and rechecked emptiness before changing anything. This is a manual development initialization, not a CLI migration history entry; do not subsequently replay historical migrations into this initialized project.

Read-only verification found 59 public tables, all with RLS enabled; authenticated users may rename a workspace but cannot change its plan, and anonymous users cannot insert directly into the waitlist. No Auth users were created. No cron or networking extension was installed. The platform-provided `supabase_vault` extension is present; the bootstrap did not configure vault secrets or email queues.

Supabase's security advisor reports callable SECURITY DEFINER functions: public provider-category counts and workspace host lookup, plus authenticated self-scoped role/membership helpers. The self-scoped helpers support RLS and require contextual review; do not revoke them indiscriminately. Review the public host lookup and aggregate function's intended exposure before hosted testing. Guidance: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

Real sign-in, password-reset delivery and saved submissions remain untested. Available connector tools do not expose Auth hook/email configuration, and no management access token is configured. Check that project's Auth hooks and email delivery before creating a dedicated ordinary test user. No original-owner infrastructure or credentials were changed. The application PR remains draft and undeployed.

## Privileged function follow-up

After caller review and full-schema in-memory permission tests, direct anonymous/authenticated execution of `workspace_for_host(text)` and `count_providers_by_category()` was revoked in founders-dev only. Service-role execution is preserved and verified. The app's count lookup is server-side; the host lookup has no current application caller. The generated bootstrap includes the same restrictions. Self-scoped RLS helpers remain callable by authenticated users intentionally. This does not claim removal of every contextual SECURITY DEFINER advisor warning.
