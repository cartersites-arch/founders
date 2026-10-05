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
- 21 local security/database tests passed. TypeScript and build passed.
- Source inventory reviewed 162 server-function exports and 11 raw HTML insertion sites; these are review counts, not hosted test counts.
- Database verification found zero public tables without RLS and zero remaining test users, workspaces, forum records, unsubscribe/suppression records or telemetry fixtures.
- Security advisors retain three intentional self-scoped permission-helper warnings and one expected no-browser-policy notice for the service-only limiter table.

Tests sent no real email, Stripe payment or AI requests. The built mobile My Learning check uses isolated Auth/database fixtures; it is not a live production login check. Earlier founders-dev password checks passed, but do not verify the original project's settings.

## Remaining limits

Original-project storage permissions and real Stripe, email, queue, content-generation, proxy, Intercom and scheduler flows need owner staging checks. Founders-dev has no Storage buckets, so it cannot establish production Storage safety.

Customer AI generation uses a count-before-generate monthly quota. Parallel requests can exceed that quota; strict cost enforcement needs atomic reservations, cancellation/failure handling and concurrency tests. This is an outstanding finding.

Access JWTs can remain valid until expiry after sign-out under normal Supabase behavior. Immediate revocation, if required, needs a separately specified policy and tests. This review does not certify that every endpoint or integration is free of vulnerabilities.
