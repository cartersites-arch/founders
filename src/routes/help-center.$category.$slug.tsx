import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { Mail, Phone } from "lucide-react";
import { getHelpArticle } from "@/server/help-center.functions";
import { SiteHeader, SiteFooter } from "@/components/site-layout";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { buildMeta, breadcrumbJsonLd, ldJsonScript, SITE_URL, SITE_NAME } from "@/lib/seo";

export const Route = createFileRoute("/help-center/$category/$slug")({
  loader: async ({ params }) => {
    const { article, category, related } = await getHelpArticle({
      data: { slug: params.slug },
    });
    if (!article || article.category_slug !== params.category) throw notFound();
    return { article, category, related };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.article) return {};
    const a = loaderData.article;
    const title = a.seo_title || `${a.title} | ${SITE_NAME} Help`;
    const description = a.seo_description || a.excerpt || a.title;
    const meta = buildMeta({
      title,
      description: description.slice(0, 160),
      path: `/help-center/${params.category}/${params.slug}`,
      type: "article",
    });
    const articleLd = {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: a.title,
      description,
      datePublished: a.created_at,
      dateModified: a.updated_at,
      mainEntityOfPage: `${SITE_URL}/help-center/${params.category}/${params.slug}`,
      publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    };
    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Help Center", path: "/help-center" },
      {
        name: loaderData.category?.name || params.category,
        path: `/help-center/${params.category}`,
      },
      {
        name: a.title,
        path: `/help-center/${params.category}/${params.slug}`,
      },
    ]);
    return {
      ...meta,
      scripts: [ldJsonScript(articleLd), ldJsonScript(crumbs)],
    };
  },
  component: HelpArticlePage,
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
        <h1 className="text-3xl font-bold">Article not found</h1>
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

// Very small markdown renderer — supports headings, bullet lists, bold,
// paragraphs. Avoids adding a runtime markdown dep.
function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const out: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let olBuffer: string[] = [];
  let key = 0;

  const flushUl = () => {
    if (listBuffer.length) {
      out.push(
        <ul key={`ul-${key++}`} className="my-4 list-disc space-y-1 pl-6">
          {listBuffer.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />
          ))}
        </ul>,
      );
      listBuffer = [];
    }
  };
  const flushOl = () => {
    if (olBuffer.length) {
      out.push(
        <ol key={`ol-${key++}`} className="my-4 list-decimal space-y-1 pl-6">
          {olBuffer.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />
          ))}
        </ol>,
      );
      olBuffer = [];
    }
  };
  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code class='rounded bg-muted px-1 py-0.5 text-sm'>$1</code>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushUl();
      flushOl();
      continue;
    }
    if (line.startsWith("# ")) {
      flushUl();
      flushOl();
      out.push(
        <h1 key={key++} className="mt-8 text-3xl font-bold tracking-tight">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      flushUl();
      flushOl();
      out.push(
        <h2 key={key++} className="mt-8 text-2xl font-bold tracking-tight">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      flushUl();
      flushOl();
      out.push(
        <h3 key={key++} className="mt-6 text-xl font-semibold">
          {line.slice(4)}
        </h3>,
      );
    } else if (/^[-*]\s+/.test(line)) {
      flushOl();
      listBuffer.push(line.replace(/^[-*]\s+/, ""));
    } else if (/^\d+\.\s+/.test(line)) {
      flushUl();
      olBuffer.push(line.replace(/^\d+\.\s+/, ""));
    } else {
      flushUl();
      flushOl();
      out.push(
        <p
          key={key++}
          className="my-4 leading-7 text-foreground"
          dangerouslySetInnerHTML={{ __html: inline(line) }}
        />,
      );
    }
  }
  flushUl();
  flushOl();
  return out;
}

function HelpArticlePage() {
  const { article, category, related } = Route.useLoaderData();
  const params = Route.useParams();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Help Center", path: "/help-center" },
            {
              name: category?.name || params.category,
              path: `/help-center/${params.category}`,
            },
            {
              name: article.title,
              path: `/help-center/${params.category}/${params.slug}`,
            },
          ]}
        />

        <article className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {category?.name}
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {article.title}
          </h1>
          {article.excerpt && (
            <p className="mt-4 text-lg text-muted-foreground">{article.excerpt}</p>
          )}

          {article.content && (
            <div className="mt-8 max-w-none text-foreground">{renderMarkdown(article.content)}</div>
          )}
        </article>

        {/* Contact card */}
        <div className="mt-12 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">Still need help?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Our support team is here to help.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <a
              href="mailto:support@founders.click"
              className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
            >
              <Mail className="h-4 w-4" /> support@founders.click
            </a>
            <a
              href="tel:+18664203702"
              className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
            >
              <Phone className="h-4 w-4" /> 866-420-3702
            </a>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold text-foreground">More in {category?.name}</h2>
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {related.map((r: { slug: string; title: string }) => (
                <li key={r.slug}>
                  <Link
                    to="/help-center/$category/$slug"
                    params={{ category: params.category, slug: r.slug }}
                    className="block rounded-xl border border-border bg-card px-5 py-4 text-sm font-semibold text-foreground hover:border-primary hover:text-primary"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
