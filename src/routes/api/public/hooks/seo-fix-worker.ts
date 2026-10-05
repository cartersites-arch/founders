import { createMaintenanceHandlers } from "@/server/maintenance-handlers";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runSeoFix } from "@/server/admin-tools.functions";

const MAX_PER_INVOCATION = 5;

async function processBatch() {
  const sb = supabaseAdmin as any;
  const { data: jobs } = await sb
    .from("seo_fix_jobs")
    .select("id, page_id, mode, attempts, max_attempts")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(MAX_PER_INVOCATION);

  const list = (jobs || []) as Array<{
    id: string;
    page_id: string;
    mode: "full" | "meta_only" | "title_only";
    attempts: number;
    max_attempts: number;
  }>;
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const job of list) {
    // Claim the job (best-effort; if another worker beat us, skip)
    const { data: claimed } = await sb
      .from("seo_fix_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      const res = await runSeoFix(job.page_id, job.mode);
      if (res.ok) {
        await sb
          .from("seo_fix_jobs")
          .update({
            status: "done",
            result: res,
            finished_at: new Date().toISOString(),
            error: null,
          })
          .eq("id", job.id);
        results.push({ id: job.id, ok: true });
      } else {
        const giveUp = job.attempts + 1 >= job.max_attempts;
        await sb
          .from("seo_fix_jobs")
          .update({
            status: giveUp ? "failed" : "queued",
            error: res.error,
            finished_at: giveUp ? new Date().toISOString() : null,
          })
          .eq("id", job.id);
        results.push({ id: job.id, ok: false, error: res.error });
      }
    } catch (e: any) {
      const giveUp = job.attempts + 1 >= job.max_attempts;
      await sb
        .from("seo_fix_jobs")
        .update({
          status: giveUp ? "failed" : "queued",
          error: e?.message || "Worker exception",
          finished_at: giveUp ? new Date().toISOString() : null,
        })
        .eq("id", job.id);
      results.push({ id: job.id, ok: false, error: e?.message });
    }
  }

  return { processed: results.length, results };
}

export const Route = createFileRoute("/api/public/hooks/seo-fix-worker")({
  server: {
    handlers: createMaintenanceHandlers(async () => Response.json(await processBatch())),
  },
});
