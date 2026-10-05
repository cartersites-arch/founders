import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-layout";
import { createCustomerPage } from "@/server/customer-content.functions";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/pages/new")({
  head: () => ({
    meta: [
      { title: "Generate a page — founders.click" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: NewPagePage,
});

function NewPagePage() {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [topic, setTopic] = React.useState("");
  const [model, setModel] = React.useState("openai/gpt-5");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    page: { url_path: string; title: string; slug: string };
    words: number;
  } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await createCustomerPage({
        data: { title, description, topic, model },
      });
      setResult({ page: res.page, words: res.words });
      setTitle("");
      setDescription("");
      setTopic("");
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = title.trim().length >= 3 && topic.trim().length >= 10 && !busy;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Generate a page</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Type a title and what the page should be about. We&apos;ll write it on-brand and
              publish it at <code>/p/&#123;slug&#125;</code>.
            </p>
          </div>
          <Link
            to="/app/dashboard"
            className="shrink-0 text-sm text-muted-foreground hover:underline"
          >
            ← Workspace
          </Link>
        </div>

        <form
          onSubmit={submit}
          className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6"
        >
          <div>
            <label className="block text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The host's guide to weekend pricing"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={140}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The H1 and basis for the URL slug.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium">
              Short description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="One line — what's the gist?"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium">
              What should this page be about?{" "}
              <span className="text-destructive">*</span>
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Tell us the angle, audience, and any specifics to cover. We'll handle SEO and structure."
              className="mt-1 min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={2000}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {topic.length}/2000 characters. The more specific, the better.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium">Model</label>
            <p className="mt-1 text-xs text-muted-foreground">Submitted generation attempts count toward your monthly allowance, including attempts that fail after being sent.</p>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="openai/gpt-5">GPT-5 (best quality)</option>
              <option value="openai/gpt-5-mini">GPT-5 mini (faster)</option>
              <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (fastest)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {busy ? "Writing & publishing…" : "Generate & publish page"}
          </button>
        </form>

        {error && (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-5">
            <div className="text-sm font-semibold">
              Published — {result.words.toLocaleString()} words
            </div>
            <div className="mt-1 font-mono text-xs">{result.page.url_path}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={result.page.url_path}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                View page →
              </a>
              <Link
                to="/app/dashboard"
                className="inline-block rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Back to workspace
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
