import { readLimitedJson, readLimitedText } from "@/lib/limited-json";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/email/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Extract token from query params
        const url = new URL(request.url);
        const token = url.searchParams.get("token");

        if (typeof token !== "string" || token.length < 16 || token.length > 256) {
          return Response.json({ error: "Token is required" }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Look up the token
        const { data: tokenRecord, error: lookupError } = await supabase
          .from("email_unsubscribe_tokens")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (lookupError || !tokenRecord) {
          return Response.json({ error: "Invalid or expired token" }, { status: 404 });
        }

        if (tokenRecord.used_at) {
          return Response.json({ valid: false, reason: "already_unsubscribed" });
        }

        return Response.json({ valid: true });
      },

      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Extract token from query params (always present for RFC 8058 one-click)
        const url = new URL(request.url);
        let token: string | null = url.searchParams.get("token");

        // Detect RFC 8058 one-click unsubscribe: POST with form-encoded body
        // containing "List-Unsubscribe=One-Click". Email clients (Gmail, Apple Mail,
        // etc.) send this when the user clicks "Unsubscribe" in the mail UI.
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/x-www-form-urlencoded")) {
          let formText: string;
          try {
            formText = await readLimitedText(request, 8192);
          } catch (error) {
            if (error instanceof Response) return error;
            return Response.json({ error: "Invalid request" }, { status: 400 });
          }
          const params = new URLSearchParams(formText);
          // For one-click, token comes from query param (already set above).
          // Otherwise, token may be in the form body.
          if (!params.get("List-Unsubscribe")) {
            const formToken = params.get("token");
            if (formToken) {
              token = formToken;
            }
          }
        } else {
          // JSON body (from the app's unsubscribe page)
          try {
            const body = (await readLimitedJson(request, 8192)) as Record<string, unknown>;
            if (typeof body.token === "string") {
              token = body.token;
            }
          } catch (error) {
            if (error instanceof Response && error.status === 413) return error;
            // Fall through — token stays from query param
          }
        }

        if (typeof token !== "string" || token.length < 16 || token.length > 256) {
          return Response.json({ error: "Token is required" }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: result, error } = await supabase.rpc("apply_email_unsubscribe", { _token: token });
        if (error) {
          console.error("Failed to process unsubscribe");
          return Response.json({ error: "Failed to process unsubscribe" }, { status: 500 });
        }
        if (result === "invalid") return Response.json({ error: "Invalid or expired token" }, { status: 404 });
        if (result === "already") return Response.json({ success: false, reason: "already_unsubscribed" });
        if (result !== "success") return Response.json({ error: "Failed to process unsubscribe" }, { status: 500 });
        return Response.json({ success: true });
      },
    },
  },
});
