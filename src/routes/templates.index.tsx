import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer, Header } from "@/components/founders-home";
import { buildMeta } from "@/lib/seo";
import {
  MARKETPLACE_TEMPLATES,
  TEMPLATE_PAGES,
  TEMPLATE_PROCESS_LABEL,
  type MarketplaceTemplate,
} from "@/lib/templates";

export const Route = createFileRoute("/templates/")({
  head: () =>
    buildMeta({
      title: "Sharetribe Marketplace Templates — founders.click",
      description:
        "Ready-to-launch marketplace designs built on the Sharetribe Web Template. Every screen maps to a real Sharetribe page — rentals, services, resale and venue booking.",
      path: "/templates",
      image: null,
    }),
  component: TemplatesPage,
});

function TemplatesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center sm:py-24">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sharetribe Template Marketplace
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Marketplace designs built <span className="text-primary">on</span> the Sharetribe
            template — not around it.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Most marketplace themes are pretty mockups your developer has to reverse-engineer. Ours
            start from the Sharetribe Web Template's own pages and transaction flows, so every
            screen you buy maps straight to code you already have.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {MARKETPLACE_TEMPLATES.map((t) => (
            <TemplateCard key={t.slug} template={t} />
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Every template includes all 10 core Sharetribe flows
          </h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {TEMPLATE_PAGES.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3"
              >
                <span className="font-medium">{p.name}</span>
                <code className="text-xs text-muted-foreground">{p.sharetribe}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function TemplateCard({ template: t }: { template: MarketplaceTemplate }) {
  return (
    <Link
      to="/templates/$slug"
      params={{ slug: t.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <PreviewFrame template={t} className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold">{t.name}</h3>
          <span className="text-lg font-bold">${t.priceUsd}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip>{t.niche}</Chip>
          <Chip>{TEMPLATE_PROCESS_LABEL[t.process]}</Chip>
        </div>
        <span className="mt-5 text-sm font-semibold text-primary group-hover:underline">
          View template →
        </span>
      </div>
    </Link>
  );
}

/**
 * Scaled-down, non-interactive iframe of the live Magic Patterns preview —
 * always in sync with the latest published design, no screenshots to maintain.
 */
function PreviewFrame({
  template: t,
  className = "",
}: {
  template: MarketplaceTemplate;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden border-b border-border ${className}`}
      style={{ backgroundColor: t.accent }}
    >
      <iframe
        src={t.previewUrl}
        title={`${t.name} preview`}
        loading="lazy"
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-25 border-0 bg-white"
      />
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}
