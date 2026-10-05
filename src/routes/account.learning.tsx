import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyLearning,
  listMyProgress,
  type CourseProgress,
  type MyLearningRow,
} from "@/server/learning.functions";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/account/learning")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.pathname, mode: "signin" },
      });
    }
  },
  component: MyLearningPage,
  head: () => ({ meta: [{ title: "My learning — founders.click" }] }),
});

function MyLearningPage() {
  const [rows, setRows] = useState<MyLearningRow[] | null>(null);
  const [progress, setProgress] = useState<Map<string, CourseProgress>>(new Map());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      listMyLearning({ data: undefined as never }),
      listMyProgress({ data: undefined as never }),
    ])
      .then(([l, p]) => {
        setRows(l.rows);
        const m = new Map<string, CourseProgress>();
        for (const r of p.rows) m.set(r.course_slug, r);
        setProgress(m);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const completed = (rows ?? []).filter((r) => r.completed_at);
  const inProgress = (rows ?? []).filter((r) => !r.completed_at);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My learning</h1>
          <Button
            variant="outline"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
          >
            Sign out
          </Button>
        </div>

        {err && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {err}
          </div>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-foreground">Completed</h2>
          {completed.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No completions yet.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {completed.map((r) => (
                <li
                  key={r.course_slug}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="font-semibold text-foreground">
                    {r.course_title ?? r.course_slug}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Completed {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : ""}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {r.certificate_uid && (
                      <>
                        <Button asChild size="sm">
                          <a
                            href={`/api/certificates/${r.certificate_uid}.pdf`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Download certificate
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/verify/$uid" params={{ uid: r.certificate_uid }}>
                            Verify
                          </Link>
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">In progress</h2>
          {inProgress.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              You aren't enrolled in any active courses.{" "}
              <Link
                to="/help-center/$category"
                params={{ category: "e-learning-academy" }}
                className="text-primary hover:underline"
              >
                Browse the Academy
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {inProgress.map((r) => {
                const p = progress.get(r.course_slug);
                const pct = p?.progress_pct ?? 0;
                return (
                  <li
                    key={r.course_slug}
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="font-semibold text-foreground">
                      {r.course_title ?? r.course_slug}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Enrolled {r.enrolled_at ? new Date(r.enrolled_at).toLocaleDateString() : ""}
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progress</span>
                        <span className="font-medium text-foreground">{pct}%</span>
                      </div>
                      <Progress value={pct} aria-label={`${pct}% complete`} />
                    </div>
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <a href={`/help-center/e-learning-academy/${r.course_slug}`}>
                        Continue course
                      </a>
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
