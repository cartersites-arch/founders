import { assertDevelopmentSupabaseUrl, createIsolatedFetch } from "@/lib/isolation-policy";
import { createMiddleware } from "@tanstack/react-start";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function failAuthentication(message: string, status: number): never {
  // Server functions serialize Error; raw Response failures can otherwise
  // reach callers as an undefined result rather than rejecting the promise.
  setResponseStatus(status);
  throw new Error(message);
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ];
      const message = `Missing Supabase environment variable(s): ${missing.join(", ")}. Set them in .env (dev) or via wrangler secret put (prod).`;
      console.error(`[Supabase] ${message}`);
      failAuthentication(message, 500);
    }

    assertDevelopmentSupabaseUrl(SUPABASE_URL);
    const request = getRequest();

    if (!request?.headers) {
      failAuthentication("Unauthorized: No request headers available", 401);
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      failAuthentication("Unauthorized: No authorization header provided", 401);
    }

    if (!authHeader.startsWith("Bearer ")) {
      failAuthentication("Unauthorized: Only Bearer tokens are supported", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      failAuthentication("Unauthorized: No token provided", 401);
    }

    const supabase = createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      global: {
        fetch: createIsolatedFetch(fetch),
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      failAuthentication("Unauthorized: Invalid token", 401);
    }

    if (!data.claims.sub) {
      failAuthentication("Unauthorized: No user ID found in token", 401);
    }

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
      },
    });
  },
);
