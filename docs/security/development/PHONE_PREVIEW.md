# Protected phone preview plan

Target application: a new `founders-dev-preview` Worker in the fork owner's Cloudflare account. Target database: `vpewpybdvtnhwxhzyubc` only. This plan is not a deployment configuration; nothing has been deployed.

## Required before enabling a hosted URL

1. Confirm the independently owned Cloudflare account, a new preview-only hostname, and authenticated access protection. Do not reuse an existing unidentified Worker. No production route, domain or account may be selected.
2. Configure Cloudflare Access to allow only the tester. Verify workers.dev and every alternate Worker URL cannot bypass that protection before installing privileged database credentials. Document the access policy and verify it in an unauthenticated browser.
3. Prepare a separate Worker configuration with no cron triggers, production routes, email, billing, AI or copied driver credentials. Keep existing local configuration unchanged. Use only founders-dev URL/key bindings; publishable keys may enter the client build, service-role keys must remain server secrets.
4. Update the fetch guard to allow exactly the selected HTTPS preview origin for app RPC traffic, in addition to the existing development Supabase paths. Do not allow arbitrary workers.dev hosts. The current guard will reject hosted app-origin requests. Keep external services, Edge Functions and unrestricted database RPCs blocked.
5. Set development Auth site/redirect URLs to the exact preview URL and only required callback paths. Do not configure original domains. No OAuth provider configuration is required for email/password testing.
6. Build and test the same-origin allowance, denial of other hosts, access protection, startup configuration and server-only secret isolation. Then perform the authorized deployment, recording the actual account, Worker, origin and commit.
7. Test email/password sign-in, sign-out, reset flow and persisted submissions with the ordinary development test user. Do not share test credentials in chat or commit them. Check that disabled integrations remain inaccessible.

## Current blocker

There is no Cloudflare connector or Cloudflare credential binding in this task, and no verified preview hostname or Access policy. Cloudflare network access is not in the environment's current allowlist. The built app therefore cannot be safely published from this session yet. Configure any deployment credential through the environment's secret settings, never chat; scope it only to the confirmed development account/Worker. Alternatively use the owner's dashboard to configure and deploy the reviewed preview after the above code changes and verification.

The existing PR remains draft. Neither main nor Derek's services are changed by this plan.
