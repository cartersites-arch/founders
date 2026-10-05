import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListBlogPosts,
  adminExpandBlogPost,
  type AdminBlogRow,
} from "@/server/admin-blog.functions";
import { checkAdminRole } from "@/server/admin-auth.functions";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/blog")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.pathname, mode: "signin" },
      });
    }
    const { isAdmin } = await checkAdminRole();
    if (!isAdmin) throw redirect({ to: "/admin/no-access" });
  },
  component: AdminBlogPage,
  head: () => ({ meta: [{ title: "Blog admin — founders.click" }] }),
});

function AdminBlogPage() {
  const [rows, setRows] = useState<AdminBlogRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");

  const refresh = () => {
    adminListBlogPosts({ data: undefined as never })
      .then((r) => setRows(r.rows))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.topic ?? "").toLowerCase().includes(q) ||
        r.slug.includes(q),
    );
  }, [rows, filter]);

  const expand = async (slug: string) => {
    setBusy((b) => ({ ...b, [slug]: true }));
    try {
      const res = await adminExpandBlogPost({ data: { slug } });
      toast.success(`Expanded: ${res.word_count} words`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy((b) => ({ ...b, [slug]: false }));
    }
  };

  const expandAllShort = async () => {
    if (!filtered) return;
    const targets = filtered.filter((r) => r.word_count < 500);
    if (targets.length === 0) {
      toast.info("Nothing under 500 words to expand.");
      return;
    }
    if (!confirm(`Expand ${targets.length} posts with AI? This will use credits.`)) return;
    for (const t of targets) {
      await expand(t.slug);
      // small delay to be polite to the gateway
      await new Promise((r) => setTimeout(r, 600));
    }
  };

  const grouped = useMemo(() => {
    const m = new Map<string, AdminBlogRow[]>();
    for (const r of filtered ?? []) {
      const k = r.topic ?? "Uncategorized";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Blog admin</h1>
          <p className="text-sm text-muted-foreground">
            {rows?.length ?? "…"} posts. Click <em>Expand with AI</em> to replace seed content with
            a full article.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Filter by title, topic, slug…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-64"
          />
          <Button variant="secondary" onClick={expandAllShort} disabled={!rows}>
            Expand all short
          </Button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {!rows && <div className="text-sm text-muted-foreground">Loading…</div>}

      {grouped.map(([topic, list]) => (
        <section key={topic} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">
            {topic}{" "}
            <span className="text-sm font-normal text-muted-foreground">({list.length})</span>
          </h2>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2 w-24">Words</th>
                  <th className="px-3 py-2 w-20">Status</th>
                  <th className="px-3 py-2 w-56">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.slug} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">/blog/{r.slug}</div>
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      <span className={r.word_count < 500 ? "text-amber-600" : ""}>
                        {r.word_count}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.is_published ? (
                        <span className="text-green-700">Live</span>
                      ) : (
                        <span className="text-muted-foreground">Draft</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => expand(r.slug)} disabled={busy[r.slug]}>
                          {busy[r.slug] ? "Expanding…" : "Expand with AI"}
                        </Button>
                        <a
                          href={`/blog/${r.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm underline self-center"
                        >
                          View
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </AdminLayout>
  );
}
// touch 1777849623
