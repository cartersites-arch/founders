import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Footer, Header } from "@/components/founders-home";
import { SITE_URL } from "@/lib/seo";
import {
  getTemplate,
  TEMPLATE_PAGES,
  TEMPLATE_PROCESS_LABEL,
  templateBuyHref,
} from "@/lib/templates";

export const Route = createFileRoute("/templates/$slug")({
  loader: ({ params }) => {
    const template = getTemplate(params.slug);
    if (!template) throw notFound();
    return { template };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.template;
    if (!t) return {};
    const title = `${t.name} — ${t.tagline} | Sharetribe Template`;
    return {
      meta: [
        { title },
        { name: "description", content: t.description },
        { property: "og:title", content: title },
        { property: "og:description", content: t.description },
        { property: "og:url", content: `${SITE_URL}/templates/${t.slug}` },
        { name: "robots", content: "index,follow" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: `${t.name} Sharetribe Marketplace Template`,
            description: t.description,
            offers: {
              "@type": "Offer",
              price: t.priceUsd,
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: `${SITE_URL}/templates/${t.slug}`,
            },
          }),
        },
      ],
    };
  },
  component: TemplateDetailPage,
});

function TemplateDetailPage() {
  const { template: t } = Route.useLoaderData();
  const buyHref = templateBuyHref(t);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link to="/templates" className="text-sm text-muted-foreground hover:text-foreground">
          ← All templates
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.name}</h1>
            <p className="mt-2 text-lg text-muted-foreground">{t.tagline}</p>

            <div className="mt-6 overflow-hidden rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-yellow-400" />
                <span className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-3 truncate text-xs text-muted-foreground">
                  Live preview — click around, every page works
                </span>
              </div>
              <iframe
                src={t.previewUrl}
                title={`${t.name} live preview`}
                className="h-[70vh] min-h-[480px] w-full border-0 bg-white"
              />
            </div>

            <h2 className="mt-12 text-xl font-bold">About this template</h2>
            <p className="mt-3 text-muted-foreground">{t.description}</p>

            <h2 className="mt-10 text-xl font-bold">Highlights</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              {t.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>

            <h2 className="mt-10 text-xl font-bold">Pages included</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {TEMPLATE_PAGES.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>{p.name}</span>
                  <code className="truncate text-xs text-muted-foreground">{p.sharetribe}</code>
                </div>
              ))}
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-border p-6 shadow-sm">
              <div className="text-3xl font-bold">${t.priceUsd}</div>
              <p className="mt-1 text-sm text-muted-foreground">One-time · commercial license</p>
              <a
                href={buyHref}
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90"
              >
                {t.checkoutUrl ? "Buy template" : "Get this template"}
              </a>
              <a
                href={t.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-full border border-border px-6 font-medium hover:bg-muted"
              >
                Open full preview ↗
              </a>

              <dl className="mt-6 space-y-3 border-t border-border pt-6 text-sm">
                <Row label="Niche" value={t.niche} />
                <Row label="Transaction flow" value={TEMPLATE_PROCESS_LABEL[t.process]} />
                <Row label="Built on" value="Sharetribe Web Template" />
                <Row label="Stack" value="React + Tailwind" />
              </dl>

              <div className="mt-6 border-t border-border pt-6">
                <p className="text-sm font-semibold">Best for</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.bestFor.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              <p className="mt-6 text-xs text-muted-foreground">
                You get the editable Magic Patterns design plus the source code, ready to port into
                your Sharetribe Web Template fork.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
