# Auth CAPTCHA setup

The app supports Cloudflare Turnstile on email signup, password sign-in and reset-email requests. It sends the widget token through Supabase's `captchaToken` option. Verification is enforced by Supabase Auth, including callers that skip this app; the frontend widget alone is not the security boundary.

The widget is off when `VITE_TURNSTILE_SITE_KEY` is absent. This preserves existing deployments until a staged setup is ready. The public site key is a build variable. The corresponding secret belongs only in Supabase Auth's CAPTCHA settings; it is not a Worker runtime variable and must never enter browser code.

## Owner steps on staging

1. In Cloudflare **Turnstile**, create a widget for the exact staging hostname. Keep its secret private. Use a separate widget for production when production deployment is explicitly approved.
2. Add the widget's public site key as `VITE_TURNSTILE_SITE_KEY` to the staging Worker's build environment, then rebuild the review branch. For the existing Founders preview, select **founders-dev-preview → Settings → Build → Build variables and secrets**. A runtime-only variable will not populate this Vite build variable. Keep all existing Supabase, Stripe and other project credentials.
3. Verify that signup, sign-in and reset-email pages show the widget and allow a successful challenge. The CSP explicitly permits scripts from `https://challenges.cloudflare.com`; the existing HTTPS frame/connect policy supports the widget.
4. In the corresponding **staging Supabase project → Authentication → Attack Protection**, enable CAPTCHA, choose **Cloudflare Turnstile**, enter the matching secret and save. Do this after the staging app with the site key is deployed. For founders-dev only, the project reference is `vpewpybdvtnhwxhzyubc`; Derek should use his own intended staging project, not copy development secrets to production.
5. With owner-controlled test accounts, exercise signup/email confirmation, successful sign-in, wrong-password retry, challenge expiry/error/retry and reset-email delivery. Submit Auth requests directly with missing/invalid/reused CAPTCHA tokens and confirm they are rejected. Confirm that admin reset-email delivery still works with its service-role client, and that recovery-code verification and setting a new password work. Validate the actual provider's domain restrictions and mobile accessibility.
6. Remove fixtures. Record results in `STAGING_ACCEPTANCE.md`. If reverting to a build without CAPTCHA support, disable CAPTCHA enforcement in staging first so signup/login/recovery are not locked out. Production rollout requires the same coordinated review.

No live widget or Supabase CAPTCHA setting was created or changed in this work. Supplied tools do not provide Cloudflare Turnstile management or Supabase Auth configuration access. Only public site keys should be shared for build configuration; never paste the CAPTCHA secret into chat.

## Implementation behavior

Submission waits for a successful challenge when a site key is configured. Used tokens are cleared after every request, including API/network failure. Expired/error/timeout callbacks invalidate the token; failures expose a retry. Switching signup/sign-in modes removes the old widget. Recovery codes and new-password updates retain their existing session/OTP checks; they do not request a second widget challenge. No token is persisted to storage or logged. The widget loader is shared and has a fifteen-second loading timeout.

## Local evidence and reproduction

Three source-handler tests cover all three Auth actions: missing-token denial, forwarding/reset after failed Auth requests, and unchanged behavior when unconfigured. The enabled mobile browser pass uses a local built Worker with all Auth and provider requests intercepted. It covers expiry, failed verification, retry, mode changes, single-use token handling, reset callback and recovery-code access. It does not verify Cloudflare's live challenge or Supabase's live CAPTCHA enforcement.

`npm run test:security` runs the reproducible local suite. The optional `scripts/captcha-browser-check.mjs` uses Miniflare and Playwright. Set `PLAYWRIGHT_MODULE` to an installed Playwright/Playwright Core module if it is not installed in the project, and `CHROMIUM_PATH` to an available Chromium executable. Use development Supabase build bindings only; this test intercepts all remote requests. Build with Cloudflare's public test site key `1x00000000000000000000AA` for the enabled test. Run the script against a build without `VITE_TURNSTILE_SITE_KEY` with `CAPTCHA_TEST_MODE=disabled` to check the unconfigured flows. Restore an unconfigured build after testing; the public test key must not be used as a production security control.
