# Security recheck — 2026-10-05

Scope: `security-review-ready`, using only founders-dev for hosted database checks and the built Worker locally with injected development bindings. Original infrastructure configuration and client files are preserved. Production was not contacted or deployed.

## Findings fixed

- Public profiles exposed account information. Profile reads now require ownership or the existing admin policy.
- Forum authors could set pinning, counts and other protected columns. Column grants now restrict content edits; trigger-only functions maintain cross-author counts without browser execution privileges.
- City-click and 404 logging bypassed shared submission limits. Both now use the existing database guard. City tracking bounds JSON input, handles malformed cookies, and returns an empty 204 response.
- Unsubscribe consumed its token before suppression could fail, preventing a reliable retry. A service-only locked RPC now writes suppression and token state atomically, repairs legacy missing suppression, and keeps tokens out of error logs. Unsubscribe bodies are bounded.
- Auth webhook failures exposed internal exception details. Responses now return a generic error.

## Evidence

- 159 hosted authorization, privacy, forum, unsubscribe, telemetry and email/webhook checks passed. This includes existing cross-user and forged-role/context tests and new permission and recovery cases.
- 23 hosted billing/shared-limit checks passed, including concurrency, database retry, successor protection and fail-closed behavior.
- 38 additional hosted generation, certificate-revocation, Emailit and input-boundary checks passed. Provider calls were mocked; database permission/concurrency checks used founders-dev.
- 44 local security/database tests passed, including nine URL-fetching/Edge follow-up tests. TypeScript and build passed.
- Source inventory reviewed 162 server-function exports and 11 raw HTML insertion sites; these are review counts, not hosted test counts.
- Database verification found zero public tables without RLS and zero remaining test users, workspaces, forum records, unsubscribe/suppression records or telemetry fixtures.
- Security advisors retain three intentional self-scoped permission-helper warnings and two expected no-browser-policy notices for the service-only limiter and generation-usage tables.

Tests sent no real email, Stripe payment or AI requests. The built mobile My Learning check uses isolated Auth/database fixtures; it is not a live production login check. Earlier founders-dev password checks passed, but do not verify the original project's settings.

## Final pass

- Preserved certificate revocation: browser roles cannot erase or rewrite completions, and the completion endpoint refuses revoked records. Normal issuance and idempotent repeat completion are tested.
- Limited all server-function request bodies to 1 MiB before framework parsing. The bounded clone leaves request metadata and original binary bytes intact; both stream branches are canceled on rejection.
- Limited Emailit webhook bodies before hashing, with explicit signature/timestamp validation and built-Worker tampering, stale-event and oversize checks.
- Confirmed all three exposed views use security-invoker semantics and deny browser access; broad-looking form INSERT policies cannot bypass revoked grants.
- Dependency audit reported zero known vulnerabilities at check time. No development service-role key was embedded in the 102 scanned client JavaScript files.

## Remaining limits

Original-project storage permissions and real Stripe, email, queue, content-generation, proxy, Intercom and scheduler flows need owner staging checks. Founders-dev has no Storage buckets, so it cannot establish production Storage safety.

The AI quota race was fixed in the final pass: service-only usage claims serialize under a workspace lock before provider calls. Existing pages seed the initial monthly allowance; submitted attempts remain counted after failures and page deletion. Model choices, brand text, provider output and execution time are bounded. The form explains that failed submitted attempts still count. Unlimited workspaces retain shared burst limits. Hosted tests exercise parallel claims, failure/retry, provider/save errors, unauthorized access and normal generation with a mocked provider. No real AI charges were incurred.

Access JWTs can remain valid until expiry after sign-out under normal Supabase behavior. Immediate revocation, if required, needs a separately specified policy and tests. This review does not certify that every endpoint or integration is free of vulnerabilities.

## URL fetching and Edge Function follow-up

- Replaced the three sitemap scanners' unbounded, automatically redirected recursive fetches with one shared guard. Only HTTPS DNS destinations without credentials or nonstandard ports are accepted; literal IPs and common private host suffixes are rejected. Redirects, nested sitemaps and discovered page URLs must stay on the configured origin. Each scan allows at most 25 requests, three redirects per download, 1 MiB per document, 8 MiB total, 10,000 unique page URLs and a 30-second deadline. Invalid children are skipped; valid same-origin scans continue.
- Four privileged Edge Functions now count actual streamed request bytes before JSON parsing (1 MiB maximum), preserving 400/413 responses. Help-article generation now rejects GET before authentication or side effects.
- Nine additional local tests exercise valid nested scans, redirect handling, private/foreign destinations, download and recursion budgets, streamed input limits and the help-generation method guard. The four Edge handlers also preserve 400/413 after their admin checks. These use mocked fetches; they do not contact competitor sites or deployed Edge Functions.
- This is not a complete DNS-rebinding defense: outbound network controls must also prevent a permitted DNS name resolving to private infrastructure. Cross-origin sitemap arrangements and the updated Edge Functions require owner staging verification. No production configuration, Supabase project settings or deployed functions were changed.

Follow-up verification: TypeScript and the final build passed; the built-Worker mobile My Learning check passed again with isolated fixtures and the runtime publishable-key binding. The 102 built client JavaScript files did not contain the authorized development service-role key. Original infrastructure/client configuration files still match the original baseline. No database fixtures or deployed settings were changed in this follow-up.

## Provider privacy and host AI follow-up

The additional review found public provider-status history exposing intake emails, payment references and staff notes, plus public Data API reads of private provider intake/workflow columns. Provider status now requires verified Auth email ownership, escapes email pattern wildcards, minimizes returned fields and fails closed on database errors. Published business listings retain an explicit public field set, while browser grants exclude private intake and internal metadata. Service-role admin access remains available.

A separate host AI source function had no shared cost guard. It now claims five-per-minute and twenty-per-24-hour account limits before provider calls, counts failed attempts, limits output and applies a timeout. This function is absent from the current Worker manifest; source-harness tests do not claim a deployed host AI endpoint. Provider-status tests use the actual built Worker; Data API and counter checks use founders-dev. All AI responses are mocked.

Follow-up evidence: 40 provider-privacy/host-AI checks passed using founders-dev, the built Worker for provider status, and a source harness for the unused host AI function. The additional public-column permission test and daily/minute limiter test passed, bringing local tests to 40. The broader hosted authorization regression suite passed again. Final TypeScript/build and isolated mobile My Learning passed; the 102 client JavaScript files contained no authorized development service-role key. Cleanup verification counted zero follow-up users, sessions, workspaces, providers, claims, plans and host AI counters. All public tables retained RLS; advisor findings were unchanged. Only founders-dev database permissions/limiter logic changed; production and original infrastructure configuration remain untouched.

## Admin role concurrency and password/recovery follow-up

A read-count-then-delete role-removal sequence allowed reciprocal admin removals to race. A service-only, security-invoker RPC now serializes role changes, rechecks the caller under the lock and rejects self-removal. Source/local database tests and founders-dev parallel calls cover retained access, revoked callers, idempotency and browser-role denial. Existing admin roles are compared before and after temporary fixtures.

Direct founders-dev Auth admin API tests rejected short and leaked passwords for both account creation and replacement; no password-policy bypass was found. Admin validators and new-password UIs now consistently require 12–256 characters without changing existing sign-in passwords. The admin recovery action also generated a link while claiming email delivery; it now invokes recovery delivery with a reset-page callback and reports failure generically. Email-delivery tests are mocked; real delivery still requires staging verification.

The complete setup transaction is now tested with the missing provider-schema fixture included. This corrects the local fixture rather than changing the production schema. Supabase JWTs can still be valid until expiry after sign-out; immediate token revocation remains an explicit release-policy decision and is not claimed fixed here.

Verification for this pass: all 44 local tests passed, including the complete setup transaction and four admin security cases. All 22 hosted admin/concurrency/recovery-boundary checks passed; recovery delivery was intercepted and mocked. The 159 hosted authorization regression checks passed again. Final TypeScript/build and isolated mobile My Learning passed. The 103 built client JavaScript files contained no authorized development service-role key. Cleanup verified zero test users, sessions and temporary admin roles; the pre-existing admin roster was unchanged. All public tables retained RLS, and advisor findings remain three reviewed self-scoped helper warnings plus two expected service-only table notices. Production and original configuration remain unchanged.

## Additional direct-write pass

Provider listings still had browser INSERT grants, allowing callers to skip the listing endpoint's field validation and shared submission limits. The provider SQL now revokes both table and per-column INSERT grants from PUBLIC, anon and authenticated; service_role retains INSERT for the guarded endpoint. No production configuration or database was changed.

The 44 local tests passed again, including legacy column-grant bypass coverage and preserved service insertion. All 159 hosted authorization regressions and 43 provider/privacy/host-AI checks passed against founders-dev, including three new rejected direct-listing insert attempts. Temporary fixtures were removed. A read-only verification found zero public tables without RLS and zero browser INSERT grants on the seven guarded form tables. Previously passing password, build and mobile My Learning checks were not rerun for this SQL-only change.

Authenticated forum content writes remain available under ownership policies. This review does not establish comprehensive per-account forum spam protection; volume and abuse monitoring remain release considerations alongside the existing staging requirements.

## Forum abuse follow-up

Database triggers now enforce content-size checks and shared per-author posting limits across threads, replies and content edits. Direct API writes and service-role writes cannot bypass the guard; counters survive deletion, and browser roles cannot execute the privileged trigger function. The Worker truncates author labels to the supported 120-character bound. Existing content is preserved; count/moderation maintenance does not consume quota.

All 46 local security tests passed. Fourteen founders-dev tests passed for invalid/oversized direct content, service-role size enforcement, ordinary posting, parallel writes sharing the final slots, edit/deletion bypass denial, independent users, correct reply counters, direct trigger-call denial and minute/hour enforcement. Temporary accounts, posts and rate rows were removed. This closes the specific forum posting-volume gap; many-account abuse, signup protection and platform-level traffic limits remain staging/release concerns.

The 159 hosted authorization regressions also passed with the forum guard installed. TypeScript, build and the isolated mobile My Learning check passed. Regression-created forum rate counters were explicitly cleaned up after the temporary accounts were removed. Production remains unchanged.

## Shared forum and signup review

Forum content writes now also share global caps of 60/minute and 600/hour. The database guard checks the authoritative author record: a confirmed email, non-anonymous account and no active ban are required, including service-role writes. Global and per-author counters use a stable lock order and roll back with rejected content. Local tests cover switching accounts, global hourly/minute expiry and denied unconfirmed/anonymous/banned/deleted authors.

All 48 local tests, 21 hosted forum tests and 159 authorization regressions passed. Hosted parallel requests from different accounts could not share the final global slot. Invalid authors were denied, normal posting and counters remained correct, and test accounts, posts and all fixture forum limiter rows were removed. The read-only final verification found zero public tables without RLS. This SQL-only follow-up did not change Worker code; the preceding TypeScript, build and isolated mobile My Learning results remain applicable.

The founders-dev public Auth settings endpoint confirms email Auth enabled, signup allowed and email auto-confirm disabled. It does not expose CAPTCHA configuration or establish owner-project settings. `STAGING_ACCEPTANCE.md` consolidates the required owner checks. CAPTCHA enforcement must wait for provider credentials, client token integration and staged verification; toggling enforcement without that integration would break Auth requests. No production or Auth dashboard settings were changed.
