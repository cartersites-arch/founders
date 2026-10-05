import * as React from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { getCategoryIcon } from "@/lib/category-icons";
import { Search, ChevronRight, Mail, Phone } from "lucide-react";
import {
  listHelpCategories,
  listPopularHelpArticles,
  searchHelpArticles,
} from "@/server/help-center.functions";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { buildMeta, breadcrumbJsonLd, ldJsonScript, SITE_URL, SITE_NAME } from "@/lib/seo";

export const Route = createFileRoute("/help-center/")({
  loader: async () => {
    const [{ categories }, { articles }] = await Promise.all([
      listHelpCategories(),
      listPopularHelpArticles(),
    ]);
    return { categories, popular: articles };
  },
  head: () => {
    const title = `Help Center — ${SITE_NAME}`;
    const description =
      "Search the PoolRentalNearMe Help Center. Guides for hosts and guests on listing, booking, payments, safety, pool management, marketing, and more.";
    const meta = buildMeta({
      title,
      description,
      path: "/help-center",
    });
    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Help Center", path: "/help-center" },
    ]);
    return { ...meta, scripts: [ldJsonScript(crumbs)] };
  },
  component: HelpCenterIndex,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-muted-foreground">{error instanceof Error ? error.message : "Unexpected error"}</p>
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Retry
          </button>
        </main>
        <SiteFooter />
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold">Page not found</h1>
      </main>
      <SiteFooter />
    </div>
  ),
});

function CategoryIcon({ name }: { name?: string | null }) {
  const Icon = getCategoryIcon(name);
  return <Icon className="h-6 w-6" />;
}

function HelpCenterIndex() {
  const { categories, popular } = Route.useLoaderData();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<
    Array<{ slug: string; title: string; excerpt: string | null; category_slug: string }>
  >([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { results } = await searchHelpArticles({ data: { q: term } });
        if (!cancelled) setResults(results);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary via-primary to-primary-glow text-primary-foreground">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              How can we help?
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base opacity-90 sm:text-lg">
              Search guides for hosts and guests — listing, bookings, payments, safety, maintenance,
              and more.
            </p>
            <div className="mx-auto mt-10 max-w-2xl">
              <div className="relative">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search articles…"
                  className="h-14 w-full rounded-full border-0 bg-background pl-14 pr-5 text-base text-foreground shadow-2xl outline-none ring-0 focus:ring-2 focus:ring-primary-foreground/40"
                  aria-label="Search help articles"
                />
              </div>
              {query.trim().length >= 2 && (
                <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-2xl bg-background text-left text-foreground shadow-xl">
                  {searching && (
                    <div className="px-5 py-4 text-sm text-muted-foreground">Searching…</div>
                  )}
                  {!searching && results.length === 0 && (
                    <div className="px-5 py-4 text-sm text-muted-foreground">
                      No results for “{query}”.
                    </div>
                  )}
                  {results.map((r) => (
                    <Link
                      key={r.slug}
                      to="/help-center/$category/$slug"
                      params={{ category: r.category_slug, slug: r.slug }}
                      className="block border-t border-border px-5 py-3 first:border-t-0 hover:bg-muted"
                    >
                      <div className="text-sm font-semibold">{r.title}</div>
                      {r.excerpt && (
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {r.excerpt}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center justify-center gap-3 text-sm sm:flex-row sm:gap-8">
              <a
                href="mailto:support@founders.click"
                className="inline-flex items-center gap-2 opacity-90 hover:opacity-100"
              >
                <Mail className="h-4 w-4" />
                support@founders.click
              </a>
              <a
                href="tel:+18664203702"
                className="inline-flex items-center gap-2 opacity-90 hover:opacity-100"
              >
                <Phone className="h-4 w-4" />
                Host support: 866-420-3702
              </a>
            </div>
          </div>
        </section>

        {/* Categories grid */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Browse by category</h2>
          <p className="mt-2 text-muted-foreground">
            {categories.length} categories of guides and resources.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(
              (c: {
                slug: string;
                name: string;
                description: string | null;
                icon: string | null;
              }) => (
                <Link
                  key={c.slug}
                  to="/help-center/$category"
                  params={{ category: c.slug }}
                  className="group flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CategoryIcon name={c.icon} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground group-hover:text-primary">
                    {c.name}
                  </h3>
                  {c.description && (
                    <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                  )}
                  <span className="mt-4 inline-flex items-center text-sm font-semibold text-primary">
                    Browse <ChevronRight className="ml-1 h-4 w-4" />
                  </span>
                </Link>
              ),
            )}
          </div>
        </section>

        {/* Popular articles */}
        {popular.length > 0 && (
          <section className="bg-muted/40">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Popular articles
              </h2>
              <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {popular.map((a: { slug: string; title: string; category_slug: string }) => (
                  <li key={a.slug}>
                    <Link
                      to="/help-center/$category/$slug"
                      params={{ category: a.category_slug, slug: a.slug }}
                      className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-sm hover:border-primary hover:shadow"
                    >
                      <span className="text-sm font-semibold text-foreground">{a.title}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* E-Learning callout */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 sm:p-12">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">E-Learning Academy</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Take certified courses on water safety, CPR, host best practices, and emergency
              procedures — all from the PoolRentalNearMe Learning Center.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/help-center/$category"
                params={{ category: "e-learning-academy" }}
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary-glow"
              >
                Browse courses
              </Link>
              <Link
                to="/help-center/$category"
                params={{ category: "e-learning-academy" }}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-background px-5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                Learning resources
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export { Route as HelpCenterIndexRoute };
export const _helpUrl = `${SITE_URL}/help-center`;
