import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { ChevronRight, Search } from "lucide-react";
import { getHelpCategoryWithArticles } from "@/server/help-center.functions";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getCategoryIcon } from "@/lib/category-icons";
import { buildMeta, breadcrumbJsonLd, ldJsonScript, SITE_NAME } from "@/lib/seo";

export const Route = createFileRoute("/help-center/$category/")({
  loader: async ({ params }) => {
    const { category, articles } = await getHelpCategoryWithArticles({
      data: { slug: params.category },
    });
    if (!category) throw notFound();
    return { category, articles };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.category) return {};
    const c = loaderData.category;
    const title = c.seo_title || `${c.name} — ${SITE_NAME} Help Center`;
    const description =
      c.seo_description || c.description || `Help articles in the ${c.name} category.`;
    const meta = buildMeta({
      title,
      description: description.slice(0, 160),
      path: `/help-center/${params.category}`,
      image: c.hero_image_url ?? undefined,
    });
    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Help Center", path: "/help-center" },
      { name: c.name, path: `/help-center/${params.category}` },
    ]);
    return { ...meta, scripts: [ldJsonScript(crumbs)] };
  },
  component: HelpCategoryPage,
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
        <h1 className="text-3xl font-bold">Category not found</h1>
        <Link
          to="/help-center"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Back to Help Center
        </Link>
      </main>
      <SiteFooter />
    </div>
  ),
});

function HelpCategoryPage() {
  const { category, articles } = Route.useLoaderData();
  const params = Route.useParams();
  const Icon = getCategoryIcon(category.icon);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
            <Breadcrumbs
              items={[
                { name: "Home", path: "/" },
                { name: "Help Center", path: "/help-center" },
                { name: category.name, path: `/help-center/${params.category}` },
              ]}
            />
            <div className="mt-6 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
                <Icon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  {category.name}
                </h1>
                {category.description && (
                  <p className="mt-3 max-w-2xl text-base text-muted-foreground">
                    {category.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              {articles.length} {articles.length === 1 ? "article" : "articles"}
            </h2>
            <Link
              to="/help-center"
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <Search className="mr-1.5 h-4 w-4" /> Search all articles
            </Link>
          </div>

          {articles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              No articles yet in this category.
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {articles.map((a: { slug: string; title: string; excerpt: string | null }) => (
                <li key={a.slug}>
                  <Link
                    to="/help-center/$category/$slug"
                    params={{ category: params.category, slug: a.slug }}
                    className="group flex items-start justify-between gap-4 px-6 py-5 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-foreground group-hover:text-primary">
                        {a.title}
                      </h3>
                      {a.excerpt && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {a.excerpt}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
