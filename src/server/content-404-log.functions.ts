import { guardPublicSubmission } from "@/server/submission-guard.server";
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

/**
 * Records a 404 hit on a /p/{slug} URL. Upserts on `url_path` so repeat hits
 * just bump `hit_count` + `last_seen_at` instead of creating duplicate rows.
 *
 * Called from the `/p/$slug` route's `beforeLoad` when `lookupContentPage`
 * returns `not_found`. Runs server-side during SSR so we capture bot traffic
 * too.
 */
export const log404 = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        urlPath: z.string().min(1).max(2048).regex(/^\/p\/[^\s]*$/),
        slug: z.string().max(120).nullable().optional(),
        referrer: z.string().max(2048).nullable().optional(),
        userAgent: z.string().max(1024).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      await guardPublicSubmission("content-404");
      // Capture request headers server-side if not provided by caller.
      let referrer = data.referrer ?? null;
      let userAgent = data.userAgent ?? null;
      try {
        const { getRequestHeader } = await import("@tanstack/react-start/server");
        if (!referrer) referrer = getRequestHeader("referer") ?? null;
        if (!userAgent) userAgent = getRequestHeader("user-agent") ?? null;
      } catch {
        // headers unavailable; continue without
      }

      // Upsert: if row exists for this url_path, bump hit_count + last_seen_at.
      const { data: existing } = await (supabaseAdmin as any)
        .from("content_404_log")
        .select("id, hit_count")
        .eq("url_path", data.urlPath)
        .maybeSingle();

      if (existing) {
        await (supabaseAdmin as any)
          .from("content_404_log")
          .update({
            hit_count: (existing.hit_count ?? 0) + 1,
            last_seen_at: new Date().toISOString(),
            referrer: data.referrer ?? undefined,
            user_agent: data.userAgent ?? undefined,
            resolved_at: null,
          })
          .eq("id", existing.id);
      } else {
        await (supabaseAdmin as any).from("content_404_log").insert({
          url_path: data.urlPath,
          slug: data.slug ?? null,
          referrer: data.referrer ?? null,
          user_agent: data.userAgent ?? null,
        });
      }
    } catch (err) {
      // Never let logging failures break the 404 response.
      if (!(err instanceof Response)) console.error("[404-log] failed to record");
    }
    return { ok: true };
  });

export interface Content404Row {
  id: string;
  url_path: string;
  slug: string | null;
  referrer: string | null;
  user_agent: string | null;
  hit_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
}

/** Admin: list recent 404s, optionally filtered to unresolved only. */
export const list404s = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        unresolvedOnly: z.boolean().optional().default(true),
        limit: z.number().int().min(1).max(500).optional().default(100),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: Content404Row[] }> => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);

    let q = (supabaseAdmin as any)
      .from("content_404_log")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(data.limit);
    if (data.unresolvedOnly) q = q.is("resolved_at", null);
    const { data: rows, error } = await q;
    if (error) {
      console.error("[404-log] list failed", error);
      return { rows: [] };
    }
    return { rows: (rows ?? []) as Content404Row[] };
  });

/** Admin: mark a 404 row as resolved (e.g., after redirecting or creating the page). */
export const resolve404 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        notes: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await assertAdmin(userId);

    const { error } = await (supabaseAdmin as any)
      .from("content_404_log")
      .update({
        resolved_at: new Date().toISOString(),
        resolution_notes: data.notes ?? null,
      })
      .eq("id", data.id);
    if (error) {
      console.error("[404-log] resolve failed", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  });
