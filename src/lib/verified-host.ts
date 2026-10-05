import { matchesSecret } from "./security-token.ts";

export function normalizeWorkspaceHost(raw: string | null | undefined): string | null {
  if (!raw || raw.includes(",") || /[\s/@?#\\]/.test(raw)) return null;
  try {
    const url = new URL(`http://${raw}`);
    if (url.pathname !== "/" || url.username || url.password) return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** A client-supplied forwarded host cannot select another workspace. */
export async function resolveWorkspaceHost(
  headers: Headers,
  proxySecret?: string,
): Promise<string | null> {
  const forwarded = headers.get("x-forwarded-host");
  if (forwarded) {
    if (!(await matchesSecret(headers.get("x-founders-proxy-token"), proxySecret))) return null;
    return normalizeWorkspaceHost(forwarded);
  }
  return normalizeWorkspaceHost(headers.get("host"));
}

export const FALLBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  "founders.click",
  "poolrentalnearme.com",
  "poolrentalnearme.online",
]);
