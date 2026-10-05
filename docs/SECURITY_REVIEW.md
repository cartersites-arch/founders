# Founders security and local isolation review

This branch implements source hardening and prepares an isolated local review of the Founders security findings. It is not a production hardening release. No changes have been sent to Derek's repository, no migrations have been applied, and no deployment or credential rotation has been performed.

## Source and scope

The audit inspected commit `dc9fab033e038e013bd61acf121fd73cdd89cc6d`. At inspection, both `cartersites-arch/founders` and its parent `derekbowen/founders` had that commit on `main`. Work is confined to the `security-hardening` branch of the fork; its pull request remains draft.

## Local development safeguards

The application accepts only the `founders-dev` Supabase project, `vpewpybdvtnhwxhzyubc`. Server fetch requests are restricted to loopback HTTP and that project's Auth, REST and Storage endpoints. Redirects, database RPCs, Edge Function invocations and other external services are blocked. Supabase clients independently validate the project and use guarded fetch.

Public maintenance hooks, email routes and the billing webhook return 503. Transactional email, billing and Intercom are disabled. The copied content driver is disabled and its hardcoded credential has been removed from the working source. This does not revoke the original deployed credential or erase Git history.

The Supabase configuration project ID now identifies the development project. This is not proof of a CLI link; no CLI linking or schema operations were performed. The Cloudflare configuration no longer selects the original account; hosted Worker URLs are disabled. There is no deployment command in this review workflow. These configuration changes alone cannot prevent a person from invoking a CLI directly with other credentials.

Run from the repository root with Node 24 and development credentials supplied through the environment:

```sh
npm run test:isolation
npm run dev
```

Both Supabase URL variables must identify the development project. Do not copy production keys. The preflight requires the `security-hardening` branch. The test suite uses stub fetch implementations and does not contact a database.

## Security findings and deployment requirements

| Priority                             | Source finding                                            | Proposed production change                                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High                                 | Hardcoded content-driver credential                       | Rotate with the original service owner's coordination; replace with a scoped secret and header authentication. Never rotate Derek's credential from this fork. |
| High                                 | Unauthenticated privileged maintenance routes             | Add scheduler or administrator authentication, POST-only mutations, rate limits and concurrency controls.                                                      |
| High                                 | Unsanitized customer Markdown rendered as HTML            | Sanitize HTML with a strict element, attribute and URL-scheme allowlist before rendering.                                                                      |
| High, conditional on deployed grants | Workspace owners can update privilege and billing columns | Restrict updates to approved customer-editable columns; reserve plan, internal status and billing identifiers for trusted server operations.                   |
| Medium                               | Permissive production CSP                                 | Use explicit origins and nonce or hash based script rules. The local CSP in this branch is not a final production policy.                                      |
| Medium                               | Forwarded host trusted without domain verification        | Verify domain ownership and accept forwarded host headers only from trusted proxies.                                                                           |
| Medium                               | Public submissions lack application abuse limits          | Add rate limits, challenge controls and notification deduplication.                                                                                            |

Source fixes now require dedicated bearer secrets and POST for maintenance and backfill, bound request sizes, sanitize Markdown and JSON-LD, restrict public reads to published pages within the verified workspace, authenticate forwarded hosts, add script nonces and a production CSP, and limit public submissions. Local maintenance shutdowns remain enabled. Submission limits are per process; distributed edge limits and challenge controls remain deployment requirements.

`docs/security/workspace-privileges.sql` is an unapplied review draft, not a migration. It restricts sensitive workspace updates, prevents direct submission inserts bypassing server controls, and limits membership/role helpers to the requesting user. The Supabase CLI could not initialize its local configuration here; promote the reviewed SQL using a CLI-generated migration before any authorized database change. It was tested only against an in-memory fixture, not the deployed schema. Deployed grants, policies, migrations, external account ownership and current dependency advisories remain unverified. Later migrations already protect the quality views; those are not outstanding findings.

## Migration and deployment boundaries

Historical migrations are preserved. Two contain scheduled calls to existing Lovable endpoints. Do not run `supabase db push`, reset a connected database, invoke Edge Functions or deploy this branch. Even a development migration run could trigger those external endpoints after scheduler registration. Prepare a separate sanitized database bootstrap and inspect existing development cron jobs before any schema operations.

Before a hosted test, select an independently owned Cloudflare account, Worker and domain, and verify all secrets, webhooks and scheduled jobs belong to the development environment. Use network or account permissions as an additional boundary. The fetch guard does not sandbox arbitrary shell commands, SDK transports that bypass fetch, database cron jobs or browser navigation.

## Review and validation

Review this branch against the audit commit. Do not merge development-only shutdowns into production as a security fix. Sharing or applying production fixes should be a separate reviewed change.

A source inspection exposed the driver credential in tool output during the audit. Its value is omitted here. Treat it as compromised and coordinate remediation with its owner; the fork does not authorize changing the original deployment.

Validation completed: three isolation tests, nine source security tests, and one in-memory PostgreSQL privilege test passed; the client and server build succeeded. With scoped socket permission, the local server returned HTTP 200 with six nonce-bearing scripts, and the maintenance route returned 503. Server fetch used a fixture that blocks hosted requests. No hosted database was contacted by these tests. Type checking reported the same four route-search `redirect` errors as the original audit commit, with no additional errors. Full browser and hosted end-to-end tests remain outstanding.

## Dependency and mobile follow-up

Compatible dependency updates remove all advisories reported by `npm audit`, including development dependencies, at this review. Seroval resolves to 1.6.8. An Axios 1.20.0 override prevents the nested Firecrawl dependency retaining a vulnerable Axios version. This audit is a point-in-time check, not proof that no undisclosed vulnerabilities exist.

The closed mobile navigation panel was extending the page width. Its wrapper now clips the translated panel, and the closed menu is inert. Chromium smoke checks at 390 by 844 pixels show no horizontal overflow or uncaught errors for home, authentication, password reset and help center, with non-loopback browser requests blocked. Authentication input accepted sample text; real sign-in, submissions and deployed database compatibility remain untested. Updated router error handling accepts unknown errors; the four original redirect-search type errors remain.
