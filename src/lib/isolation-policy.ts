export const DEVELOPMENT_PROJECT = "vpewpybdvtnhwxhzyubc";
export const DEVELOPMENT_HOST = `${DEVELOPMENT_PROJECT}.supabase.co`;

export function assertDevelopmentSupabaseUrl(value: string | undefined): void {
  if (!value) throw new Error("Isolation: development Supabase URL is required.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== DEVELOPMENT_HOST ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Isolation: only the founders-dev Supabase project is allowed.");
  }
}

export function assertAllowedRequest(input: string | URL | Request): void {
  const raw = input instanceof Request ? input.url : String(input);
  const url = new URL(raw, typeof window === "undefined" ? undefined : window.location.href);
  if (url.pathname.includes("%")) {
    throw new Error("Isolation: encoded endpoint paths are disabled.");
  }
  if (url.username || url.password) throw new Error("Isolation: URL credentials are forbidden.");
  if (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    return;
  if (
    url.protocol === "https:" &&
    url.hostname === DEVELOPMENT_HOST &&
    !url.port &&
    ["/auth/v1/", "/rest/v1/", "/storage/v1/"].some((prefix) => url.pathname.startsWith(prefix)) &&
    !url.pathname.startsWith("/rest/v1/rpc/")
  )
    return;
  throw new Error("Isolation: external services, Edge Functions, and database RPCs are disabled.");
}

export function createIsolatedFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    assertAllowedRequest(input);
    // Never follow a redirect to an unchecked destination.
    return baseFetch(input, { ...init, redirect: "error" });
  };
}

const INSTALL_MARKER = Symbol.for("founders.isolated-fetch");
export function installIsolatedFetch(): void {
  const state = globalThis as typeof globalThis & { [INSTALL_MARKER]?: boolean };
  if (state[INSTALL_MARKER]) return;
  globalThis.fetch = createIsolatedFetch(globalThis.fetch.bind(globalThis));
  state[INSTALL_MARKER] = true;
}

export function isLocalIsolation(): boolean {
  return true;
}
