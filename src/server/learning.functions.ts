import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "./learning.server";

const SlugInput = z.object({ course_slug: z.string().min(1).max(120) });

export type LearnerCourseStatus = {
  course_slug: string;
  is_enrolled: boolean;
  is_completed: boolean;
  certificate_uid: string | null;
  completed_at: string | null;
};

export const getMyCourseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }): Promise<LearnerCourseStatus> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const [enrollRes, completeRes] = await Promise.all([
      supabase
        .from("course_enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("course_slug", data.course_slug)
        .maybeSingle(),
      supabase
        .from("course_completions")
        .select("certificate_uid, completed_at, revoked_at")
        .eq("user_id", userId)
        .eq("course_slug", data.course_slug)
        .maybeSingle(),
    ]);

    const completion = completeRes.data && !completeRes.data.revoked_at ? completeRes.data : null;

    return {
      course_slug: data.course_slug,
      is_enrolled: !!enrollRes.data || !!completion,
      is_completed: !!completion,
      certificate_uid: completion?.certificate_uid ?? null,
      completed_at: completion?.completed_at ?? null,
    };
  });

export const enrollInCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase
      .from("course_enrollments")
      .upsert(
        { user_id: userId, course_slug: data.course_slug },
        { onConflict: "user_id,course_slug", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markCourseComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // Already completed?
    const { data: existing, error: existingError } = await supabase
      .from("course_completions")
      .select("certificate_uid, revoked_at")
      .eq("user_id", userId)
      .eq("course_slug", data.course_slug)
      .maybeSingle();

    if (existingError) throw new Error("Could not verify course completion");
    if (existing?.revoked_at) throw new Error("This completion was revoked. Contact support.");
    if (existing) {
      return { ok: true, certificate_uid: existing.certificate_uid as string, already: true };
    }

    // Look up authoritative course title (admin client; courses are public but we
    // want to ensure the slug is real).
    const { data: course, error: courseErr } = await supabaseAdmin
      .from("courses")
      .select("slug, title, is_published")
      .eq("slug", data.course_slug)
      .maybeSingle();
    if (courseErr) throw new Error(courseErr.message);
    if (!course || !course.is_published) {
      throw new Error("Course not found or not published");
    }

    // Look up learner display name from profile (fallback to claims/email).
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    const claims = (context as { claims: Record<string, unknown> }).claims;
    const learnerName =
      (profile?.full_name as string | undefined) ||
      (profile?.display_name as string | undefined) ||
      (claims?.["email"] as string | undefined)?.split("@")[0] ||
      "Learner";

    // Auto-enroll if not yet enrolled.
    await supabase
      .from("course_enrollments")
      .upsert(
        { user_id: userId, course_slug: data.course_slug },
        { onConflict: "user_id,course_slug", ignoreDuplicates: true },
      );

    // Insert via service role: the user-facing INSERT RLS policy was removed
    // to prevent certificate forgery. The course existence + published check
    // above is the only gate, so this insert must run as the trusted server.
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("course_completions")
      .insert({
        user_id: userId,
        course_slug: data.course_slug,
        course_title: course.title,
        learner_name: learnerName,
      })
      .select("certificate_uid")
      .single();

    if (insertErr) throw new Error(insertErr.message);

    // Mark progress 100% and log a 'completed' event
    await supabase.from("course_progress").upsert(
      {
        user_id: userId,
        course_slug: data.course_slug,
        progress_pct: 100,
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      },
      { onConflict: "user_id,course_slug" },
    );
    await supabase
      .from("course_progress_events")
      .insert({ user_id: userId, course_slug: data.course_slug, event_type: "completed" });

    return { ok: true, certificate_uid: inserted.certificate_uid as string, already: false };
  });

// ============================================================
// Progress tracking
// ============================================================

export type CourseProgress = {
  course_slug: string;
  progress_pct: number;
  total_seconds_spent: number;
  started_at: string | null;
  last_activity_at: string | null;
  completed_at: string | null;
};

const HeartbeatInput = z.object({
  course_slug: z.string().min(1).max(120),
  seconds_delta: z.number().int().min(1).max(120), // cap per ping
  expected_minutes: z.number().int().min(1).max(600).optional(),
});

export const recordHeartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => HeartbeatInput.parse(input))
  .handler(async ({ data, context }): Promise<CourseProgress> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    // Look up course duration if not provided
    let expectedMin = data.expected_minutes;
    if (!expectedMin) {
      const { data: course } = await supabaseAdmin
        .from("courses")
        .select("duration_minutes")
        .eq("slug", data.course_slug)
        .maybeSingle();
      expectedMin = (course?.duration_minutes as number | null) || 30;
    }

    const { data: existing } = await supabase
      .from("course_progress")
      .select("total_seconds_spent, progress_pct, started_at, completed_at")
      .eq("user_id", userId)
      .eq("course_slug", data.course_slug)
      .maybeSingle();

    const isFirst = !existing;
    const newSeconds = (existing?.total_seconds_spent ?? 0) + data.seconds_delta;
    const targetSeconds = expectedMin * 60;
    const computedPct = Math.min(99, Math.floor((newSeconds / targetSeconds) * 100));
    // Don't downgrade an existing higher pct (e.g. manual completion = 100)
    const nextPct = Math.max(existing?.progress_pct ?? 0, computedPct);

    const nowIso = new Date().toISOString();
    const { data: upserted, error } = await supabase
      .from("course_progress")
      .upsert(
        {
          user_id: userId,
          course_slug: data.course_slug,
          total_seconds_spent: newSeconds,
          progress_pct: nextPct,
          last_activity_at: nowIso,
          ...(isFirst ? { started_at: nowIso } : {}),
        },
        { onConflict: "user_id,course_slug" },
      )
      .select(
        "course_slug, progress_pct, total_seconds_spent, started_at, last_activity_at, completed_at",
      )
      .single();

    if (error) throw new Error(error.message);

    // Log events: 'started' on first heartbeat, 'heartbeat' otherwise
    await supabase.from("course_progress_events").insert({
      user_id: userId,
      course_slug: data.course_slug,
      event_type: isFirst ? "started" : "heartbeat",
      metadata: { seconds_delta: data.seconds_delta, progress_pct: nextPct },
    });

    return upserted as CourseProgress;
  });

const LogEventInput = z.object({
  course_slug: z.string().min(1).max(120),
  event_type: z.enum([
    "mark_complete_clicked",
    "certificate_downloaded",
    "certificate_verified",
    "resumed",
    "progress_updated",
  ]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const logProgressEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LogEventInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { error } = await supabase.from("course_progress_events").insert({
      user_id: userId,
      course_slug: data.course_slug,
      event_type: data.event_type,
      metadata: data.metadata ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyCourseProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SlugInput.parse(input))
  .handler(async ({ data, context }): Promise<CourseProgress | null> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: row } = await supabase
      .from("course_progress")
      .select(
        "course_slug, progress_pct, total_seconds_spent, started_at, last_activity_at, completed_at",
      )
      .eq("user_id", userId)
      .eq("course_slug", data.course_slug)
      .maybeSingle();
    return (row as CourseProgress) ?? null;
  });

export const listMyProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: CourseProgress[] }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    const { data: rows } = await supabase
      .from("course_progress")
      .select(
        "course_slug, progress_pct, total_seconds_spent, started_at, last_activity_at, completed_at",
      )
      .eq("user_id", userId)
      .order("last_activity_at", { ascending: false });
    return { rows: (rows ?? []) as CourseProgress[] };
  });

// ============================================================
// Admin: aggregate + per-user drilldown
// ============================================================

// requireAdmin moved to ./learning.server

export type AdminCourseSummary = {
  course_slug: string;
  course_title: string | null;
  enrollments: number;
  completions: number;
  avg_progress_pct: number;
};

export const adminGetCourseSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: AdminCourseSummary[] }> => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);

    const [enrollRes, completeRes, progressRes, coursesRes] = await Promise.all([
      supabaseAdmin.from("course_enrollments").select("course_slug"),
      supabaseAdmin.from("course_completions").select("course_slug, revoked_at"),
      supabaseAdmin.from("course_progress").select("course_slug, progress_pct"),
      supabaseAdmin.from("courses").select("slug, title"),
    ]);

    const titles = new Map<string, string>();
    for (const c of coursesRes.data ?? []) titles.set(c.slug as string, c.title as string);

    const enrollCount = new Map<string, number>();
    for (const r of enrollRes.data ?? [])
      enrollCount.set(r.course_slug, (enrollCount.get(r.course_slug) ?? 0) + 1);

    const completeCount = new Map<string, number>();
    for (const r of completeRes.data ?? []) {
      if (r.revoked_at) continue;
      completeCount.set(r.course_slug, (completeCount.get(r.course_slug) ?? 0) + 1);
    }

    const pctSum = new Map<string, { sum: number; n: number }>();
    for (const r of progressRes.data ?? []) {
      const cur = pctSum.get(r.course_slug) ?? { sum: 0, n: 0 };
      cur.sum += r.progress_pct as number;
      cur.n += 1;
      pctSum.set(r.course_slug, cur);
    }

    const slugs = new Set<string>([
      ...enrollCount.keys(),
      ...completeCount.keys(),
      ...pctSum.keys(),
    ]);

    const rows: AdminCourseSummary[] = Array.from(slugs).map((slug) => {
      const p = pctSum.get(slug);
      return {
        course_slug: slug,
        course_title: titles.get(slug) ?? null,
        enrollments: enrollCount.get(slug) ?? 0,
        completions: completeCount.get(slug) ?? 0,
        avg_progress_pct: p && p.n > 0 ? Math.round(p.sum / p.n) : 0,
      };
    });

    rows.sort((a, b) => b.enrollments - a.enrollments);
    return { rows };
  });

export type AdminLearnerRow = {
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  enrollments: number;
  completions: number;
  last_activity_at: string | null;
};

export const adminListLearners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: AdminLearnerRow[] }> => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);

    const [enrollRes, completeRes, progressRes] = await Promise.all([
      supabaseAdmin.from("course_enrollments").select("user_id"),
      supabaseAdmin.from("course_completions").select("user_id, revoked_at"),
      supabaseAdmin.from("course_progress").select("user_id, last_activity_at"),
    ]);

    const userIds = new Set<string>();
    for (const r of enrollRes.data ?? []) userIds.add(r.user_id as string);
    for (const r of completeRes.data ?? []) userIds.add(r.user_id as string);
    for (const r of progressRes.data ?? []) userIds.add(r.user_id as string);

    const idList = Array.from(userIds);
    const { data: profiles } = idList.length
      ? await supabaseAdmin
          .from("profiles")
          .select("user_id, display_name, full_name")
          .in("user_id", idList)
      : {
          data: [] as Array<{
            user_id: string;
            display_name: string | null;
            full_name: string | null;
          }>,
        };

    const profileMap = new Map<string, { display_name: string | null; full_name: string | null }>();
    for (const p of profiles ?? [])
      profileMap.set(p.user_id as string, {
        display_name: (p.display_name as string | null) ?? null,
        full_name: (p.full_name as string | null) ?? null,
      });

    const enrollCount = new Map<string, number>();
    for (const r of enrollRes.data ?? [])
      enrollCount.set(r.user_id as string, (enrollCount.get(r.user_id as string) ?? 0) + 1);

    const completeCount = new Map<string, number>();
    for (const r of completeRes.data ?? []) {
      if (r.revoked_at) continue;
      const uid = r.user_id as string;
      completeCount.set(uid, (completeCount.get(uid) ?? 0) + 1);
    }

    const lastActivity = new Map<string, string>();
    for (const r of progressRes.data ?? []) {
      const uid = r.user_id as string;
      const ts = r.last_activity_at as string;
      const cur = lastActivity.get(uid);
      if (!cur || ts > cur) lastActivity.set(uid, ts);
    }

    const rows: AdminLearnerRow[] = idList.map((uid) => ({
      user_id: uid,
      display_name: profileMap.get(uid)?.display_name ?? null,
      full_name: profileMap.get(uid)?.full_name ?? null,
      enrollments: enrollCount.get(uid) ?? 0,
      completions: completeCount.get(uid) ?? 0,
      last_activity_at: lastActivity.get(uid) ?? null,
    }));

    rows.sort((a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? ""));
    return { rows };
  });

export type AdminLearnerDetail = {
  profile: { user_id: string; display_name: string | null; full_name: string | null } | null;
  progress: Array<CourseProgress & { course_title: string | null }>;
  events: Array<{
    id: string;
    course_slug: string;
    event_type: string;
    metadata: { [x: string]: {} } | null;
    created_at: string;
  }>;
  completions: Array<{
    course_slug: string;
    course_title: string;
    completed_at: string;
    certificate_uid: string;
    revoked_at: string | null;
  }>;
};

export const adminGetLearnerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    await requireAdmin(userId);

    const [profRes, progRes, evRes, compRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id, display_name, full_name")
        .eq("user_id", data.user_id)
        .maybeSingle(),
      supabaseAdmin
        .from("course_progress")
        .select(
          "course_slug, progress_pct, total_seconds_spent, started_at, last_activity_at, completed_at",
        )
        .eq("user_id", data.user_id)
        .order("last_activity_at", { ascending: false }),
      supabaseAdmin
        .from("course_progress_events")
        .select("id, course_slug, event_type, metadata, created_at")
        .eq("user_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("course_completions")
        .select("course_slug, course_title, completed_at, certificate_uid, revoked_at")
        .eq("user_id", data.user_id)
        .order("completed_at", { ascending: false }),
    ]);

    const slugs = new Set<string>();
    for (const r of progRes.data ?? []) slugs.add(r.course_slug as string);
    const { data: courses } = slugs.size
      ? await supabaseAdmin.from("courses").select("slug, title").in("slug", Array.from(slugs))
      : { data: [] as Array<{ slug: string; title: string }> };
    const titleMap = new Map<string, string>();
    for (const c of courses ?? []) titleMap.set(c.slug as string, c.title as string);

    return {
      profile: (profRes.data as AdminLearnerDetail["profile"]) ?? null,
      progress: (progRes.data ?? []).map((r: any) => ({
        course_slug: r.course_slug,
        progress_pct: r.progress_pct,
        total_seconds_spent: r.total_seconds_spent,
        started_at: r.started_at,
        last_activity_at: r.last_activity_at,
        completed_at: r.completed_at,
        course_title: titleMap.get(r.course_slug) ?? null,
      })),
      events: (evRes.data ?? []).map((e: any) => ({
        id: e.id as string,
        course_slug: e.course_slug as string,
        event_type: e.event_type as string,
        metadata: (e.metadata ?? null) as { [x: string]: {} } | null,
        created_at: e.created_at as string,
      })),
      completions: (compRes.data ?? []) as AdminLearnerDetail["completions"],
    };
  });

export type MyLearningRow = {
  course_slug: string;
  course_title: string | null;
  enrolled_at: string | null;
  completed_at: string | null;
  certificate_uid: string | null;
};

export const listMyLearning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: MyLearningRow[] }> => {
    const { supabase, userId } = context as { supabase: any; userId: string };

    const [enrollRes, completionsRes] = await Promise.all([
      supabase
        .from("course_enrollments")
        .select("course_slug, enrolled_at")
        .eq("user_id", userId)
        .order("enrolled_at", { ascending: false }),
      supabase
        .from("course_completions")
        .select("course_slug, course_title, completed_at, certificate_uid, revoked_at")
        .eq("user_id", userId)
        .is("revoked_at", null)
        .order("completed_at", { ascending: false }),
    ]);

    const slugs = new Set<string>();
    (enrollRes.data ?? []).forEach((r: { course_slug: string }) => slugs.add(r.course_slug));
    (completionsRes.data ?? []).forEach((r: { course_slug: string }) => slugs.add(r.course_slug));

    // Pull titles for enrollments that don't have a completion record.
    const slugList = Array.from(slugs);
    const { data: courses } = slugList.length
      ? await supabaseAdmin.from("courses").select("slug, title").in("slug", slugList)
      : { data: [] as Array<{ slug: string; title: string }> };
    const titleMap = new Map<string, string>();
    for (const c of courses ?? []) titleMap.set(c.slug, c.title);

    const enrollMap = new Map<string, string>();
    for (const e of enrollRes.data ?? []) enrollMap.set(e.course_slug, e.enrolled_at as string);

    const completionMap = new Map<
      string,
      { course_title: string; completed_at: string; certificate_uid: string }
    >();
    for (const c of completionsRes.data ?? []) {
      completionMap.set(c.course_slug, {
        course_title: c.course_title as string,
        completed_at: c.completed_at as string,
        certificate_uid: c.certificate_uid as string,
      });
    }

    const rows: MyLearningRow[] = slugList.map((slug) => {
      const completion = completionMap.get(slug);
      return {
        course_slug: slug,
        course_title: completion?.course_title ?? titleMap.get(slug) ?? null,
        enrolled_at: enrollMap.get(slug) ?? null,
        completed_at: completion?.completed_at ?? null,
        certificate_uid: completion?.certificate_uid ?? null,
      };
    });

    // Sort: completed first by completed_at desc, then enrolled by enrolled_at desc
    rows.sort((a, b) => {
      const ad = a.completed_at ?? a.enrolled_at ?? "";
      const bd = b.completed_at ?? b.enrolled_at ?? "";
      return bd.localeCompare(ad);
    });

    return { rows };
  });

// Public verification: anyone can resolve a UID to a redacted summary.
export const verifyCertificate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ certificate_uid: z.string().min(4).max(40) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("course_completions")
      .select(
        "certificate_uid, course_slug, course_title, learner_name, completed_at, revoked_at, revoke_reason",
      )
      .eq("certificate_uid", data.certificate_uid)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { found: false as const };
    return {
      found: true as const,
      certificate_uid: row.certificate_uid as string,
      course_slug: row.course_slug as string,
      course_title: row.course_title as string,
      learner_name: row.learner_name as string,
      completed_at: row.completed_at as string,
      revoked_at: (row.revoked_at as string | null) ?? null,
      revoke_reason: (row.revoke_reason as string | null) ?? null,
    };
  });
