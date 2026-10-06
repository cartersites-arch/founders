import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicPage } from "@/server/public-page.functions";
import { buildMeta, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const result = await getPublicPage({ data: { slug: params.slug } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const { page } = loaderData;
    const title = page.seo_title || page.title || params.slug;
    const description = page.seo_description || page.title || "";
    return buildMeta({
      title,
      description: description.slice(0, 160),
      path: `/p/${params.slug}`,
      image: page.hero_image_url ?? null,
      type: "article",
    });
  },
  component: PublicPage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">The content at this URL hasn't been published.</p>
    </main>
  ),
});

function PublicPage() {
  const { page, workspace } = Route.useLoaderData();
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      {page.hero_image_url && (
        <img
          src={page.hero_image_url}
          alt=""
          className="mb-8 aspect-video w-full rounded-2xl object-cover"
        />
      )}
      {page.title && (
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{page.title}</h1>
      )}
      <article
        className="public-page-content mt-8 max-w-none"
        // body_markdown is admin/AI-generated content stored in our DB.
        // Source is constrained to markdown via the generation prompt.
        dangerouslySetInnerHTML={{ __html: page.body_html }}
      />
      <p className="mt-12 text-xs text-muted-foreground">
        {workspace.name} · last updated {new Date(page.updated_at).toLocaleDateString()} ·{" "}
        <a className="hover:underline" href={`${SITE_URL}${page.url_path}`}>
          source
        </a>
      </p>
    </main>
  );
}
