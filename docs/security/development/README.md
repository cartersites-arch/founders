# Isolated development schema review

This is an unapplied review bundle for the independently owned `founders-dev` project (`vpewpybdvtnhwxhzyubc`). It is not a migration and must not be run against Derek's project or another existing database. No deployment, hosted SQL or user creation was performed to prepare it.

Generate and check locally:

```sh
node scripts/prepare-development-schema.mjs
node scripts/check-development-schema.mjs
```

The provenance manifest records all historical source hashes and exclusions. Original migrations are unchanged. The review SQL preserves ordinary schema, policies and local seed data, removes cron/network extensions and jobs, removes competitor sitemap endpoint seeds, and retains email tables while omitting queue RPCs, queue creation and vault instructions. The unapplied workspace privilege draft is appended.

Validation loads the complete draft in an in-memory PostgreSQL instance with minimal Auth stubs, and checks that cron, net, vault and queue infrastructure functions are absent. This verifies SQL ordering and basic PostgreSQL compatibility; it does not test Supabase Auth, platform grants, hosted extension versions or actual sign-in.

Before any application, independently verify the target project and empty public schema, inspect Auth hooks and email-provider configuration, and confirm test-only email delivery. Review the generated SQL and platform-specific grants. Use a CLI-generated migration or another explicitly reviewed initialization procedure. Do not run the historical migration directory directly. Do not configure original secrets, production webhooks or outbound schedulers.

After separately authorized development-only initialization, create an ordinary test account without admin privileges and test sign-in, sign-out, password reset, persisted forms, RLS and cross-user denial. Use a test inbox/mail sink to avoid unintended email. Never send test credentials in chat or store them in tracked files. Real test account creation and schema application remain outstanding.
