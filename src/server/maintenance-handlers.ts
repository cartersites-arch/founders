import { matchesSecret } from "../lib/security-token.ts";

type Context = { request: Request };
type Options = { secret?: () => string | undefined; now?: () => number; intervalMs?: number };

/** Per-worker concurrency and cooldown; distributed limits belong at the edge. */
export function createMaintenanceHandlers(
  action: (request: Request) => Promise<Response>,
  options: Options = {},
) {
  let running = false;
  let lastStarted = -Infinity;
  const now = options.now ?? Date.now;
  return {
    GET: async () =>
      new Response("Use POST", {
        status: 405,
        headers: { Allow: "POST", "Cache-Control": "no-store" },
      }),
    POST: async ({ request }: Context) => {
      const authorization = request.headers.get("authorization");
      const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
      const expected = options.secret ? options.secret() : process.env.MAINTENANCE_HOOK_SECRET;
      if (!expected || expected.length < 32)
        return new Response("Maintenance hook not configured", { status: 503 });
      if (!(await matchesSecret(supplied, expected)))
        return new Response("Unauthorized", { status: 401 });
      if (running || now() - lastStarted < (options.intervalMs ?? 30_000)) {
        return new Response("Try again later", { status: 429, headers: { "Retry-After": "30" } });
      }
      running = true;
      lastStarted = now();
      try {
        const response = await action(request);
        response.headers.set("Cache-Control", "no-store");
        return response;
      } catch (error) {
        if (error instanceof Response && [400, 413].includes(error.status)) return error;
        return new Response("Maintenance operation failed", {
          status: 500,
          headers: { "Cache-Control": "no-store" },
        });
      } finally {
        running = false;
      }
    },
  };
}
