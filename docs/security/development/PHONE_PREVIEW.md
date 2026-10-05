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

## Prepared preview build

The fork now includes `wrangler.preview.jsonc` and `npm run build:preview`. The expected exact origin is `https://founders-dev-preview.cartersites.workers.dev`; confirm the actual Cloudflare URL matches before deployment. The normal local build/configuration is unchanged. Preview builds require an explicit `VITE_DEVELOPMENT_PREVIEW=1` flag and the checked-out `security-hardening` branch; detached/main checkouts are intentionally refused.

Cloudflare build settings after branch verification:

- Build command: `npm run build:preview`
- Deploy command: `npx wrangler deploy --config dist/server/wrangler.json`
- Preview builds: disabled; alternate preview URLs are also disabled in configuration.
- Access: All traffic, Cloudflare account policy, path `/`.
- Build variables: `VITE_DEVELOPMENT_PREVIEW=1`, `SUPABASE_URL` and `VITE_SUPABASE_URL` set to the founders-dev HTTPS URL, and `VITE_SUPABASE_PUBLISHABLE_KEY` set to that project's publishable key.

The preview build copies its development `VITE_SUPABASE_PUBLISHABLE_KEY` into the generated `dist/server/wrangler.json` as the runtime `SUPABASE_PUBLISHABLE_KEY` binding. This publishable key is already public in the client build. Server authentication reads the runtime binding through `process.env`, populated by Cloudflare's `nodejs_compat` support. Build variables alone do not populate Worker runtime variables. The post-build step checks the exact preview Worker, development project and publishable-key prefix before writing the binding, and never prints its value. `keep_vars` preserves other dashboard runtime variables across deployments.

Never place the service-role key in a VITE variable, screenshot or chat. The server runtime separately needs development-only `SUPABASE_SERVICE_ROLE_KEY` as a Secret in **Workers & Pages → founders-dev-preview → Settings → Variables and Secrets** (called Runtime variables and secrets in some dashboard versions). First verify Access denies an unauthenticated session on the primary URL and all alternate URLs before adding that secret. It is never copied into the generated configuration or client build. No original account ID, routes, cron triggers or external integration secrets are included.

If an older deployment reports missing `SUPABASE_PUBLISHABLE_KEY`, deploy the latest `security-hardening` preview build using the commands above. For a dashboard-only repair, open the same Worker's Settings → Variables and Secrets, add `SUPABASE_PUBLISHABLE_KEY` as **Text** with the founders-dev publishable key, and Deploy. The generated binding makes that manual repair unnecessary on subsequent builds. Do not change any production Worker.

After Cloudflare shows the exact origin, set development-only Auth redirect/site URLs in Supabase as reviewed. This preparation has not deployed anything; Git branch selection and the effective Access policy still need dashboard verification.

### Cloudflare detached checkout correction

Cloudflare's selected Git branch is checked out as a detached commit. The preflight now accepts that checkout only when `WORKERS_CI=1`, `WORKERS_CI_BRANCH=security-hardening`, and `WORKERS_CI_COMMIT_SHA` exactly matches detached HEAD. Other detached builds, main and mismatched metadata remain denied. Local builds still require the named security-hardening branch. Regression checks cover accepted and rejected cases. This supersedes the blanket detached-checkout rejection described above.


### Worker redirect compatibility

Cloudflare Workers rejects Fetch redirect mode `error`. The isolated fetch wrapper now uses `manual` and rejects redirect responses (including browser opaque redirects) before following any destination. This resolves the signing-key fetch failure that surfaced as invalid-token responses on authenticated server functions. Verified with the Workers runtime, isolation regression tests, and TypeScript checking; hosted sign-in verification remains pending after deployment.


### Recovery code fallback

Hosted Auth logs showed recovery emails sent and verification succeeded, while earlier reused/invalid links reported expiration. Successful verification alone does not prove the browser retained the recovery session across the Cloudflare Access handoff. The reset page now listens for verified recovery sessions, displays invalid-link errors, and supports explicit `verifyOtp` with email/code and type `recovery`. New passwords require 12 characters, matching the owner-confirmed development Auth setting. No URL parameter alone authorizes a password change.

In founders-dev Authentication > Emails > Reset password, replace the body with `recovery-email.html` from this directory. The template displays `{{ .Token }}` and links only to the reset page, so a GET does not consume the code. This template is prepared but has not been applied through the connector; dashboard configuration is required. Do not put recovery codes in chat or logs. Existing link recovery remains supported.

TypeScript and six isolation checks pass. A 390x844 browser test with hosted calls mocked covered URL error display, invalid code rejection, verified-session transition and the 12-character minimum. Actual email code delivery and password change remain pending.
