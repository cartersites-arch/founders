# Founders security and local isolation review

This branch prepares an isolated local review of the Founders security findings. It is not a production hardening release. No changes have been sent to Derek's repository, no migrations have been applied, and no deployment or credential rotation has been performed.

## Source and scope

The audit inspected commit `dc9fab033e038e013bd61acf121fd73cdd89cc6d`. At inspection, both `cartersites-arch/founders` and its parent `derekbowen/founders` had that commit on `main`. Work is confined to the local `security-hardening` branch of the fork.

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

## Proposed security fixes for review

| Priority                             | Source finding                                            | Proposed production change                                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High                                 | Hardcoded content-driver credential                       | Rotate with the original service owner's coordination; replace with a scoped secret and header authentication. Never rotate Derek's credential from this fork. |
| High                                 | Unauthenticated privileged maintenance routes             | Add scheduler or administrator authentication, POST-only mutations, rate limits and concurrency controls.                                                      |
| High                                 | Unsanitized customer Markdown rendered as HTML            | Sanitize HTML with a strict element, attribute and URL-scheme allowlist before rendering.                                                                      |
| High, conditional on deployed grants | Workspace owners can update privilege and billing columns | Restrict updates to approved customer-editable columns; reserve plan, internal status and billing identifiers for trusted server operations.                   |
| Medium                               | Permissive production CSP                                 | Use explicit origins and nonce or hash based script rules. The local CSP in this branch is not a final production policy.                                      |
| Medium                               | Forwarded host trusted without domain verification        | Verify domain ownership and accept forwarded host headers only from trusted proxies.                                                                           |
| Medium                               | Public submissions lack application abuse limits          | Add rate limits, challenge controls and notification deduplication.                                                                                            |

These production fixes have not been implemented in this local isolation setup. Deployed grants, policies, migrations, external account ownership and current dependency advisories remain unverified. Later migrations already protect the quality views; those are not outstanding findings.

## Migration and deployment boundaries

Historical migrations are preserved. Two contain scheduled calls to existing Lovable endpoints. Do not run `supabase db push`, reset a connected database, invoke Edge Functions or deploy this branch. Even a development migration run could trigger those external endpoints after scheduler registration. Prepare a separate sanitized database bootstrap and inspect existing development cron jobs before any schema operations.

Before a hosted test, select an independently owned Cloudflare account, Worker and domain, and verify all secrets, webhooks and scheduled jobs belong to the development environment. Use network or account permissions as an additional boundary. The fetch guard does not sandbox arbitrary shell commands, SDK transports that bypass fetch, database cron jobs or browser navigation.

## Review and validation

Review this branch against the audit commit. Do not merge development-only shutdowns into production as a security fix. Sharing or applying production fixes should be a separate reviewed change.

A source inspection exposed the driver credential in tool output during the audit. Its value is omitted here. Treat it as compromised and coordinate remediation with its owner; the fork does not authorize changing the original deployment.

Validation completed: the three isolation tests and configuration preflight passed, and the client and server build succeeded. Local server startup was blocked by the execution environment denying a listening socket, so no browser or end-to-end validation was completed. Type checking reported the same four route-search `redirect` errors in both the original audit commit and this branch, with no additional errors reported for the isolation changes.
