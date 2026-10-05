import { installIsolatedFetch, DEVELOPMENT_HOST } from "@/lib/isolation-policy";
import { createStart, createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

installIsolatedFetch();

// Baseline security headers applied to every response (HTML, server fns, server routes).
// Local review CSP allows only this app and the development Supabase project.
// External embeds, media, fonts and support scripts stay disabled.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    `img-src 'self' data: blob: https://${DEVELOPMENT_HOST}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    // 'unsafe-inline' + 'unsafe-eval' required by Vite/React runtime hydration
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    `connect-src 'self' https://${DEVELOPMENT_HOST} ws://localhost:* ws://127.0.0.1:*`,
    "frame-src 'none'",
    `media-src 'self' blob: https://${DEVELOPMENT_HOST}`,
  ].join("; "),
};

// Production is served through the canonical host(s). Any other host (preview
// deploys, staging, raw worker URLs) is internal-only and must NEVER be
// indexed — otherwise Google sees duplicate content competing with prod.
// We send X-Robots-Tag: noindex, nofollow on every response when the request
// host is not the canonical production host. The reverse proxy is configured
// to forward the original Host as X-Forwarded-Host, so requests proxied
// through prod will have the canonical host and stay indexable.
const PRODUCTION_HOSTS = new Set([
  "founders.click",
  "www.founders.click",
  "poolrentalnearme.com",
  "www.poolrentalnearme.com",
]);

function isNonProductionHost(hostHeader: string | null): boolean {
  if (!hostHeader) return true; // unknown -> safer to noindex
  const host = hostHeader.split(":")[0]!.toLowerCase();
  return !PRODUCTION_HOSTS.has(host);
}

const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url);
  if (
    url.pathname.startsWith("/lovable/") ||
    url.pathname.startsWith("/api/public/hooks/") ||
    url.pathname === "/api/public/backfill-content-pages" ||
    url.pathname === "/api/billing/webhook" ||
    url.pathname === "/email/unsubscribe"
  ) {
    return new Response("Disabled in isolated local testing", { status: 503 });
  }
  const result = await next();
  // The Worker runtime returns a Response — attach headers if available.
  const response = (result as { response?: Response }).response;
  if (response && typeof response.headers?.set === "function") {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(k)) response.headers.set(k, v);
    }
    // Forwarded host wins (set by EC2 nginx); fall back to direct Host header.
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost ?? request.headers.get("host");
    if (isNonProductionHost(host)) {
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }
  }
  return result;
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware],
  serverFns: {
    fetch: async (url, requestInit) => {
      const init = requestInit ?? {};
      const headers = new Headers(init.headers);
      if (!headers.has("authorization")) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) headers.set("authorization", `Bearer ${token}`);
      }
      return fetch(url, { ...init, headers });
    },
  },
}));
