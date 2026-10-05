# Founders staging acceptance

Use a staging copy of Derek's existing Founders infrastructure. This checklist does not authorize production changes. Keep draft PR #2 unmerged until the owner has reviewed the code and release requirements. Apply the reviewed `apply-security.sql` transaction after a backup and before the updated Worker. Use `OWNER_SETUP.md` for exact secret names and caller changes; keep all values private.

Record a pass/fail result, release commit, date and sanitized evidence for every row. An untested row stays open. Preview evidence cannot establish the original project's configuration.

| Area | Required staging check | Acceptance |
| --- | --- | --- |
| Auth runtime | Sign in and open My Learning from desktop and mobile with original-project staging bindings. | No missing-variable or undefined-result error; each user sees only their own data. |
| Account boundaries | Use two ordinary accounts and an admin; test direct API reads/writes as well as UI routes. | Cross-user data and admin actions denied; self-service and admin operations work. |
| Password recovery | Request a fresh email, reset, sign out and sign in again; test old password, reused/expired code, short and leaked password. | New password works; invalid credentials/codes rejected; callback stays on staging. |
| Forum | Post and reply; edit/delete; try oversized content and per-user bursts; review global-cap metrics. | Normal writes work; direct API and service writes enforce limits; deletion cannot refund quota; unconfirmed/anonymous/banned authors cannot post. |
| Storage | Inventory every bucket and its `storage.objects` policies. With two accounts, test list/read/upload/overwrite/delete and signed links, including expired links and guessed paths. | Only intended public assets are public; private objects cannot be read or changed by another user. No broad anonymous write policy. File size/type and upload quotas match product requirements. |
| Stripe | Use Stripe test mode, test products and test webhook secret. Exercise checkout, upgrades, cancellation, duplicate/out-of-order events, replaced subscriptions and database retry. | Billing and workspace match authoritative Stripe state; failures retry without stale restoration. No live charge. |
| Email and unsubscribe | Use owner-controlled test addresses and staging SMTP/Emailit. Exercise queue secret rotation, invalid signatures, replay, unsubscribe and suppression retry. | Actual delivery works; unauthorized sends/jobs denied; unsubscribe persists even after retry. Never log recovery or unsubscribe tokens. |
| Jobs and Edge Functions | Deploy the changed functions to staging. Exercise the existing content driver, queue, backfill and maintenance callers with their dedicated secrets and POST methods. | All authorized jobs work; missing/wrong secrets, GET mutations and oversized inputs denied. Secrets are independent of database credentials. |
| AI and provider tools | Use a constrained staging provider budget; exercise normal generation, concurrent final-quota claims and provider/save failures. | Quota and burst limits persist across failures and page deletion; no unsupported model or unbounded output. |
| Customer domains and proxy | Use a staging customer domain and the existing proxy, including its shared secret and forwarded-host behavior. | Only verified workspace hosts resolve; forged headers cannot switch tenants. CSP and Intercom work on real domains. |
| Outbound networking | Review the actual Worker/Edge runtime's network capabilities. Test controlled redirects and DNS answers pointing to loopback, link-local, private and metadata destinations. | Requests cannot reach private infrastructure, including after DNS changes or redirect resolution. URL string validation alone is insufficient evidence. |
| Cleanup and rollback | Remove temporary records/accounts/sessions and fixture limiter keys; verify counts. Rehearse coordinated code, SQL-grant and scheduler rollback. | No test artifacts remain; rollback does not restore exposed credentials or accidentally disable legitimate callers. |

## Signup and platform settings

In the intended **staging Supabase project**, check:

1. **Authentication → Sign In / Providers**: Confirm email on; anonymous sign-ins off unless separately reviewed; manual linking off unless the product needs it. These settings must be verified on the owner project, not inferred from founders-dev.
2. **Authentication → Sign In / Providers → Email**: leaked-password protection on; minimum password length 12; review secure password change and current-password requirements against the recovery flow.
3. **Authentication → URL Configuration**: Site URL is the staging HTTPS origin; allow only the callback paths used by signup and recovery. Avoid broad production/preview wildcards and localhost fallbacks for hosted flows.
4. **Authentication → Rate Limits**: review signup, recovery, OTP and refresh limits together with SMTP capacity. Test on staging with owner-controlled addresses; never send flood tests to real customers.
5. **Authentication → Attack Protection**: CAPTCHA is an additional signup/recovery defense. Configure a supported provider and ensure the app supplies `captchaToken` before enabling enforcement. The current app does not supply a CAPTCHA token, so toggling this alone would break those Auth requests. Provider credentials, frontend integration and staged verification are prerequisites; they were not configured in this pass.
6. Review MFA for Supabase/Cloudflare/GitHub owners and administrative access. Decide whether application admin actions require MFA and whether immediate access-token revocation after sign-out is a release requirement. Current JWT validation retains standard expiry semantics.

The forum guard also checks the authoritative Auth user record, so unconfirmed, anonymous, banned or missing accounts cannot post even if a service write or an older token is used. Confirmed accounts still need the shared and per-account posting budgets. The initial global caps are 60 accepted content writes/minute and 600/hour; tune only after reviewing normal traffic. An attacker could exhaust that shared allowance and temporarily deny legitimate posting. It bounds persisted spam; it does not prevent signup floods, distributed requests or all availability attacks. Edge-level protection and moderation remain necessary.

## Current evidence and boundaries

Founders-dev email Auth is enabled, public signup is allowed, and email auto-confirm is disabled, verified through its public Auth settings endpoint. CAPTCHA configuration is not exposed there. The app calls Supabase Auth directly, so Worker-only signup limits would be bypassable; protection must also exist at Auth. No production Auth settings were read or changed.

There are no founders-dev Storage buckets to exercise. The supplied tools do not expose the original project's Auth management settings or hosting egress controls. Do not mark those areas passed until they are tested in the owner's staging environment. Review provider-specific outbound restrictions or a controlled fetching proxy if the hosting platform cannot enforce the required destination boundary.
