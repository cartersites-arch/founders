// Public driver: kicks the generate-content-batch function repeatedly until
// the pending queue is drained or maxBatches is reached. Designed to be
// invoked unattended (e.g. from a sandbox curl loop or pg_cron) so the user
// doesn't have to keep the admin browser tab open.
//
// POST with Authorization: Bearer CONTENT_DRIVER_SECRET. Never put credentials in URLs.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { matchesSecret } from "../_shared/security-token.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-driver-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const expected = Deno.env.get("CONTENT_DRIVER_SECRET");
    if (!expected || expected.length < 32) return json({ error: "Driver not configured" }, 503);
    const authorization = req.headers.get("authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!(await matchesSecret(token, expected))) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const maxBatches = Math.min(Number(url.searchParams.get("maxBatches") ?? 60), 200);
    const count = Math.min(Number(url.searchParams.get("count") ?? 10), 10);
    const model = url.searchParams.get("model") ?? "google/gemini-3-flash-preview";
    if (!Number.isInteger(maxBatches) || maxBatches < 1 || !Number.isInteger(count) || count < 1 || model.length > 100 || !/^[a-zA-Z0-9_./:-]+$/.test(model)) return json({ error: "Invalid parameters" }, 400);

    const results: Array<Record<string, unknown>> = [];
    let totalAttempted = 0;

    for (let i = 0; i < maxBatches; i++) {
      // Release stuck "generating" rows older than 5 min.
      await supabase
        .from("content_plan")
        .update({ status: "pending", last_error: "Released by driver (stuck >5m)" })
        .eq("status", "generating")
        .lt("updated_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

      // Check queue
      const { count: pending } = await supabase
        .from("content_plan")
        .select("slug", { count: "exact", head: true })
        .eq("status", "pending");
      if (!pending || pending === 0) {
        results.push({ batch: i, note: "queue empty", pending: 0 });
        break;
      }

      // Kick a batch with the dedicated driver credential.
      const r = await fetch(`${supabaseUrl}/functions/v1/generate-content-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-driver-secret": expected,
          // satisfy the function gateway's expected header even when the function
          // itself is verify_jwt=false:
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({ action: "start", count, model }),
      });
      const text = await r.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* keep raw */
      }
      results.push({ batch: i, status: r.status, pending, body });

      const attempted = (body as { attempted?: number })?.attempted ?? 0;
      totalAttempted += attempted;

      // Wait for the background job to mostly finish before queuing the next.
      // Poll status until the slugs we just queued are out of "generating".
      const slugs = (body as { pendingSlugs?: string[] })?.pendingSlugs ?? [];
      if (slugs.length > 0) {
        for (let p = 0; p < 60; p++) {
          await new Promise((res) => setTimeout(res, 3000));
          const { count: stillGen } = await supabase
            .from("content_plan")
            .select("slug", { count: "exact", head: true })
            .in("slug", slugs)
            .eq("status", "generating");
          if (!stillGen || stillGen === 0) break;
        }
      } else {
        // Nothing queued (filters or empty) — stop.
        break;
      }
    }

    return json({ ok: true, totalAttempted, batches: results.length, results });
  } catch (e) {
    return json({ error: "Content generation failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
