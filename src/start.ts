import { createStart, createMiddleware } from "@tanstack/react-start";
import { cspNonceForRequest } from "@/lib/csp-nonce";
import { resolveWorkspaceHost } from "@/lib/verified-host";
import { supabase } from "@/integrations/supabase/client";

// Response security headers; production scripts require a request nonce or an explicit integration host.
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
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "script-src 'self'",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https:",
    "media-src 'self' https: blob:",
  ].join("; "),
};

// Production is served through the canonical host(s). Any other host (preview
// deploys, staging, raw worker URLs) is internal-only and must NEVER be
// indexed — otherwise Google sees duplicate content competing with prod.
// We send X-Robots-Tag: noindex, nofollow on every response when the request
// host is not a canonical production host. Forwarded hosts are trusted only
// when the reverse proxy supplies the dedicated proxy credential.
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
  if (url.pathname.startsWith("/lovable/") || url.pathname === "/email/unsubscribe") {
    return next();
  }
  const nonce = cspNonceForRequest(request);
  const result = await next();
  // The Worker runtime returns a Response — attach headers if available.
  const response = (result as { response?: Response }).response;
  if (response && typeof response.headers?.set === "function") {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(k)) response.headers.set(k, v);
    }
    const scriptPolicy = import.meta.env.DEV
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : `script-src 'self' 'nonce-${nonce}' https://widget.intercom.io https://js.intercomcdn.com`;
    response.headers.set("Content-Security-Policy", SECURITY_HEADERS["Content-Security-Policy"]!.replace("script-src 'self'", scriptPolicy));
    const host = await resolveWorkspaceHost(request.headers, process.env.FOUNDERS_PROXY_SECRET);
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
