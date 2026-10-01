import * as React from "react";
import { Link } from "@tanstack/react-router";

/**
 * founders.click marketing landing page (Phase B-1.5: full PDF design port).
 * Self-contained — does not depend on the legacy SiteHeader/SiteFooter.
 */
export function FoundersHome() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <Problem />
      <FeatureGrid />
      <DashboardSection />
      <ContentFactorySection />
      <SEOToolsSection />
      <OpsSection />
      <WhyChooseUsSection />
      <Pricing />
      <FAQ />
      <ClosingCta />
      <Footer />
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────
export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
          <span className="text-base font-bold tracking-tight">founders.click</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <a
            href="/#features"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Features
          </a>
          <Link
            to="/templates"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Templates
          </Link>
          <a
            href="/#pricing"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Pricing
          </a>
          <a
            href="/#faq"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            search={{ redirect: "/app/dashboard", mode: "signin" } as never}
            className="hidden h-9 items-center justify-center rounded-full border border-border px-4 text-sm font-medium hover:bg-muted sm:inline-flex"
          >
            Log in
          </Link>
          <Link
            to="/auth"
            search={{ redirect: "/onboarding", mode: "signup" } as never}
            className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
      >
        <polyline points="8 6 4 12 8 18" />
        <polyline points="16 6 20 12 16 18" />
      </svg>
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center sm:py-28 lg:py-32">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          The AI Growth Engine for Sharetribe Marketplace Founders
        </p>
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Most Sharetribe founders can't afford an SEO agency.{" "}
          <span className="text-primary">founders.click replaces one.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Custom-coded SEO, AI content generation, and ops tools — purpose-built for marketplace
          operators. Without the agency price tag.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/auth"
            search={{ redirect: "/onboarding", mode: "signup" } as never}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 sm:w-auto"
          >
            Start free trial — no developers required
          </Link>
          <a
            href="/#features"
            className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border px-8 text-base font-medium hover:bg-muted sm:w-auto"
          >
            See what's inside
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Problem ────────────────────────────────────────────────────────────────
function Problem() {
  const cards = [
    {
      n: "01",
      title: "Agency budgets are brutal",
      body: "Hiring devs or agencies costs $5,000–$20,000/month just for content and SEO.",
    },
    {
      n: "02",
      title: "Sharetribe ships nothing for growth",
      body: "No native Sharetribe tools for bulk page generation, rank tracking, or lead ops.",
    },
    {
      n: "03",
      title: "Competitors are pulling away",
      body: "Swimply and Peerspace publish thousands of pages — you can't keep up manually.",
    },
  ];
  return (
    <section className="border-b border-border bg-muted/20">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Sharetribe founders are losing the SEO &amp; content race
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">founders.click changes that.</p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.n} className="rounded-2xl border border-border bg-background p-7 shadow-sm">
              <div className="text-sm font-mono text-primary">{c.n}</div>
              <h3 className="mt-3 text-lg font-semibold">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 4-Feature Grid ─────────────────────────────────────────────────────────
function FeatureGrid() {
  const features = [
    {
      title: "Dashboard",
      body: "Morning command center with live KPIs and AI-ranked action items.",
    },
    {
      title: "Content",
      body: "AI content factory generating hundreds of pages per day automatically.",
    },
    {
      title: "SEO",
      body: "Rank tracking, competitor radar, link audits, and keyword opportunities.",
    },
    {
      title: "Users & Ops",
      body: "Lead inbox, directory moderation, email tools, and team admin.",
    },
  ];
  return (
    <section id="features" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to grow
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A comprehensive suite of tools purpose-built for Sharetribe marketplace operators.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border p-7 transition-colors hover:bg-muted/40"
            >
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Dashboard Section ─────────────────────────────────────────────────────
function DashboardSection() {
  return (
    <section className="border-b border-border bg-muted/20">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Dashboard</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Your morning command center
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            The Dashboard auto-refreshes every 30 seconds and surfaces exactly what needs your
            attention — organized into 6 tabs: Today / Revenue / SEO / Factory / Humans / Tools.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          <DashCard
            label="Today's Top 3 Actions"
            items={[
              { tag: "CRITICAL", text: "90 providers awaiting moderation" },
              { tag: "IMPORTANT", text: "Triage 1,523 404 errors" },
              { tag: "OPPORTUNITY", text: "Spanish coverage currently at 6%" },
            ]}
          />
          <DashCard
            label="Revenue &amp; Conversion Pulse"
            body="Tracks Host Signups, New Listings, Booking Requests (7d), GMV (7d), Lead Inbox volume, and Visitor → Host conversion rate in real time."
          />
          <DashCard
            label="Organic Performance"
            body="Live Google Search Console data: indexed pages, clicks, impressions, avg. position, and top winners vs. decliners."
          />
          <DashCard
            label="SEO Coach AI"
            body={`Ask "What's my biggest SEO problem?" or "I have 30 minutes — what should I do?" and get step-by-step guided fixes instantly.`}
          />
        </div>
        <div className="mt-12 grid grid-cols-3 gap-6 text-center">
          <KPI big="30s" small="AUTO-REFRESH" />
          <KPI big="6" small="ORGANIZED TABS" />
          <KPI big="48h" small="HUMAN SLA FLAG" />
        </div>
      </div>
    </section>
  );
}

function DashCard({
  label,
  body,
  items,
}: {
  label: string;
  body?: string;
  items?: Array<{ tag: string; text: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-7 shadow-sm">
      <h3 className="text-lg font-semibold" dangerouslySetInnerHTML={{ __html: label }} />
      {body && (
        <p
          className="mt-3 text-sm text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}
      {items && (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((it) => (
            <li key={it.text} className="flex gap-3">
              <span className="font-mono text-xs font-semibold tracking-wide text-primary">
                {it.tag}
              </span>
              <span className="text-foreground">{it.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KPI({ big, small }: { big: string; small: string }) {
  return (
    <div>
      <div className="text-3xl font-bold sm:text-4xl">{big}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {small}
      </div>
    </div>
  );
}

// ─── Content Factory Section ───────────────────────────────────────────────
function ContentFactorySection() {
  const tools = [
    {
      title: "Quick Page Builder",
      body: "Type a title + description, pick an AI model (GPT-5, Gemini 2.5 Pro), and publish instantly at /p/{slug}. One shot. No SQL required.",
    },
    {
      title: "Content Factory Engine",
      body: "Auto-loops up to 100 pages per run at ~$0.012/page. Includes T1/T2/T3 priority tiers, dry-run mode, and live rejection logs.",
    },
    {
      title: "Bulk Page Editor",
      body: "Table view of all your pages. Filter by Published / Pending / Draft. Click any row to add AI content or edit manually. Full metadata visible.",
    },
    {
      title: "Blog Admin & Learning",
      body: "Auto-generates blog drafts by category. Tracks your e-learning academy: enrollments, completions, and per-learner activity.",
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Content</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Stop paying agencies. Generate hundreds of pages.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A full content production pipeline — from one-shot page generation to bulk importing
            thousands of rows — all without writing a single line of SQL.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {tools.map((t) => (
            <div key={t.title} className="rounded-2xl border border-border p-7">
              <h3 className="text-lg font-semibold">{t.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-7">
          <h3 className="text-lg font-semibold">Data Import</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload CSVs up to 100MB+ for content_plan or content_pages. Ships in 200-row chunks with
            browser-side parsing for maximum reliability.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── SEO Tools Section ─────────────────────────────────────────────────────
function SEOToolsSection() {
  const tools = [
    {
      title: "Competitor Radar",
      body: "Tracks Swimply, Giggster &amp; Peerspace daily (10k URLs each). Surfaces new pages, city gaps, and strategic intel digests.",
    },
    {
      title: "Rank Tracker",
      body: "Daily SERP position checks for your priority keywords. Current vs. previous position with win/loss indicators.",
    },
    {
      title: "AI Page Auditor",
      body: "Paste any URL → get a 0–100 score benchmarked against competitors. Returns exact actionable recommendations.",
    },
    {
      title: "Link Auditor",
      body: "Scans all published pages for broken internal links. Finds 4xx/5xx/3xx errors. One-click fixes per path or bulk repair.",
    },
    {
      title: "Keyword Opportunities",
      body: "Import GSC data → surfaces pages ranking positions 5–20. One-click AI rewrite to push rankings into the top 3.",
    },
    {
      title: "Internal Link Recommender",
      body: `Analyzes 500 pages for topic overlaps. 300 pending suggestions with one-click "Apply all 300."`,
    },
  ];
  return (
    <section className="border-b border-border bg-muted/20">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">SEO</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Replace your SEO agency. Every tool built in.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Competitor monitoring, rank tracking, link auditing, and keyword gap analysis — all
            connected to your live site data.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => (
            <div key={t.title} className="rounded-2xl border border-border bg-background p-7">
              <h3 className="text-lg font-semibold" dangerouslySetInnerHTML={{ __html: t.title }} />
              <p
                className="mt-2 text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: t.body }}
              />
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          <strong className="text-foreground">Bonus:</strong> Sitemap &amp; 404 management — full
          inventory of 17 sitemap files by template type. Logs every 404 hit with referrer data for
          instant triage.
        </p>
      </div>
    </section>
  );
}

// ─── Ops Section ───────────────────────────────────────────────────────────
function OpsSection() {
  const tools = [
    {
      n: "1",
      title: "Lead Inbox",
      body: "Triage inbound provider/host leads by status: New / Contacted / Closed. Full contact details per lead.",
    },
    {
      n: "2",
      title: "Email Verify",
      body: "Validates leads via API (100k+ credits). Batch-verify up to 100 at a time. Auto-excludes invalid emails.",
    },
    {
      n: "3",
      title: "Social Lead Hunter",
      body: "Daily scrapes Instagram, FB, TikTok, and Craigslist for marketplace-relevant profiles. Bulk outreach workflow built in.",
    },
    {
      n: "4",
      title: "Directory Moderation",
      body: "Review submissions by plan tier. Pending approvals queue. Actions: Approve, Reject, or AI content generation.",
    },
  ];
  const extras = ["Email Branding", "Site Footer Editor", "Admin Team", "Listing Claims & Plans"];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Users &amp; Ops
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Run your marketplace like a pro
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            All your operational tools in one admin panel — no extra subscriptions, no duct tape.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {tools.map((t) => (
            <div key={t.title} className="rounded-2xl border border-border p-7">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {t.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {extras.map((e) => (
            <span
              key={e}
              className="rounded-full border border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {e}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Why Choose Us Section ─────────────────────────────────────────────────
function WhyChooseUsSection() {
  const reasons = [
    {
      title: "Fraction of Agency Cost",
      body: "Generate pages at $0.012 each, automate SEO audits, and run lead outreach — all without retaining a single contractor.",
    },
    {
      title: "Move at AI Speed",
      body: "Publish up to 200 pages/day, fix 300 internal links in one click, and get your morning priorities ranked before your first coffee.",
    },
    {
      title: "Always Know What's Next",
      body: "The AI Dashboard and SEO Coach mean you're never guessing — you always have a prioritized, data-backed action list ready.",
    },
  ];
  return (
    <section className="border-b border-border bg-muted/20">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Built for Sharetribe founders who want to win
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Solo founders and lean teams get the same leverage as a well-funded startup with a full
            engineering team. Every feature is designed to cut costs and compound your organic
            growth.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {reasons.map((r) => (
            <div
              key={r.title}
              className="rounded-2xl border border-border bg-background p-7 shadow-sm"
            >
              <h3 className="text-lg font-semibold">{r.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ────────────────────────────────────────────────────────────────
function Pricing() {
  const plans: Array<{
    name: string;
    /** Used to deep-link into /onboarding?plan=... — null for Enterprise (sales-led). */
    slug: "starter" | "growth" | "scale" | null;
    price: string;
    period: string;
    blurb: string;
    highlight?: boolean;
    features: string[];
  }> = [
    {
      name: "Starter",
      slug: "starter",
      price: "$109",
      period: "/mo",
      blurb: "Solo founders launching their first marketplace.",
      features: [
        "Quick Page Builder",
        "Up to 50 AI pages/month",
        "Bulk Page Editor",
        "Blog Admin",
        "Basic Rank Tracker (50 keywords)",
        "Lead Inbox",
        "Email Verify (1,000/mo credits)",
        "Site Footer Editor",
        "1 admin seat",
        "Email support (48h SLA)",
      ],
    },
    {
      name: "Growth",
      slug: "growth",
      price: "$390",
      period: "/mo",
      blurb: "Scaling marketplaces with active SEO &amp; content goals.",
      highlight: true,
      features: [
        "Everything in Starter, plus:",
        "Up to 500 AI pages/month",
        "Content Factory Engine (T1/T2/T3 tiers)",
        "Competitor Radar (Swimply / Peerspace / Giggster)",
        "AI Page Auditor",
        "Link Auditor + bulk repair",
        "Keyword Opportunities (GSC import)",
        "Internal Link Recommender",
        "Social Lead Hunter",
        "Directory Moderation",
        "3 admin seats",
        "Priority email support (24h SLA)",
      ],
    },
    {
      name: "Scale",
      slug: "scale",
      price: "$899",
      period: "/mo",
      blurb: "Established platforms competing on volume and velocity.",
      features: [
        "Everything in Growth, plus:",
        "Up to 5,000 AI pages/month",
        "SEO Coach AI",
        "Custom AI model selection (GPT-5, Gemini 2.5 Pro)",
        "Email Branding (custom templates)",
        "Listing Claims &amp; Plans",
        "Admin Team (10 seats)",
        "Sitemap &amp; 404 Management",
        "Data Import (100MB+ CSVs)",
        "Slack notifications",
        "Live chat support (4h SLA)",
      ],
    },
    {
      name: "Enterprise",
      slug: null,
      price: "Custom",
      period: "",
      blurb: "Multi-team operators with custom integrations.",
      features: [
        "Everything in Scale, plus:",
        "Unlimited AI page generation",
        "Custom AI model fine-tuning",
        "White-label dashboard",
        "Custom integrations (CRM, analytics)",
        "Dedicated success engineer",
        "SOC 2 Type II report",
        "DPA &amp; custom MSA",
        "99.9% uptime SLA",
        "Onboarding workshop",
      ],
    },
  ];
  return (
    <section id="pricing" className="border-b border-border">
      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Pick a plan, replace your agency
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every plan includes the full admin panel. Upgrade for more page-generation volume,
            keyword tracking slots, and team seats.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded-2xl border p-7 shadow-sm ${
                p.highlight
                  ? "border-primary bg-background ring-2 ring-primary/30"
                  : "border-border bg-background"
              }`}
            >
              {p.highlight && (
                <div className="-mt-1 mb-3 inline-flex w-fit rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                  MOST POPULAR
                </div>
              )}
              <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {p.name}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{p.price}</span>
                <span className="text-muted-foreground">{p.period}</span>
              </div>
              <p
                className="mt-3 text-sm text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: p.blurb }}
              />
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42L8.5 11.793l6.79-6.79a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span dangerouslySetInnerHTML={{ __html: f }} />
                  </li>
                ))}
              </ul>
              {p.slug ? (
                <Link
                  to="/auth"
                  search={{ redirect: `/onboarding?plan=${p.slug}`, mode: "signup" } as never}
                  className={`mt-8 inline-flex h-10 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition-all ${
                    p.highlight
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border hover:bg-muted"
                  }`}
                >
                  Start free trial
                </Link>
              ) : (
                <a
                  href="mailto:hello@founders.click?subject=Enterprise%20plan%20inquiry"
                  className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-full border border-border px-5 text-sm font-semibold transition-all hover:bg-muted"
                >
                  Talk to us
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ────────────────────────────────────────────────────────────────────
function FAQ() {
  const faqs = [
    {
      q: "Does this require Sharetribe Flex or Bridge?",
      a: "Either works. founders.click connects via the Sharetribe Marketplace API, so any active Sharetribe marketplace can plug in. No code changes to your Sharetribe instance.",
    },
    {
      q: "How does the /p/{slug} content render on my site?",
      a: "We provide a one-line reverse-proxy snippet for your domain. Pages render at yoursite.com/p/{slug} as if they were native — no subdomain, no separate URL. Great for SEO.",
    },
    {
      q: "Do I need to bring my own AI API keys?",
      a: "No. Every plan includes AI generation credits. You can optionally bring your own OpenAI / OpenRouter / Anthropic key if you want unlimited usage at provider pricing.",
    },
    {
      q: "How long does setup take?",
      a: "About 15 minutes. Connect your Sharetribe API key, point your /p/* path at our worker, and you're live. We'll import your first 100 pages on Day 1.",
    },
    {
      q: "What happens to my pages if I cancel?",
      a: "You own all generated content. We provide a one-click CSV export at any time. Cancellation is immediate — no contracts, no clawbacks.",
    },
    {
      q: "Can I move to a different model later (GPT-5 → Claude → Gemini)?",
      a: "Yes. Pick the model per-tool, per-job. Quick Page Builder, Content Factory, AI Page Auditor — each can use a different model based on your quality/cost trade-off.",
    },
    {
      q: "Is there a free trial?",
      a: "Yes — 14 days free, no credit card. You get the full Growth tier features. Start generating pages immediately; we won't bill until day 15.",
    },
  ];
  return (
    <section id="faq" className="border-b border-border bg-muted/20">
      <div className="mx-auto max-w-3xl px-6 py-20 lg:py-24">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Knowledge Base</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>
        <div className="mt-12 divide-y divide-border rounded-2xl border border-border bg-background">
          {faqs.map((f, i) => (
            <details key={i} className="group p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <h3 className="text-base font-semibold">{f.q}</h3>
                <svg
                  className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Closing CTA ────────────────────────────────────────────────────────────
function ClosingCta() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center lg:py-24">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to see it live?</h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Start your free trial today. 14 days, no credit card. Generate your first 100 pages before
          you decide whether to pay us a dollar.
        </p>
        <Link
          to="/auth"
          search={{ redirect: "/onboarding", mode: "signup" } as never}
          className="mt-10 inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90"
        >
          Start your free trial
        </Link>
      </div>
    </section>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────
export function Footer() {
  return (
    <footer>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <Logo />
          <span>founders.click</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href="/#features" className="hover:text-foreground">
            Features
          </a>
          <a href="/templates" className="hover:text-foreground">
            Templates
          </a>
          <a href="/#pricing" className="hover:text-foreground">
            Pricing
          </a>
          <a href="/#faq" className="hover:text-foreground">
            FAQ
          </a>
          <a href="/privacy-policy" className="hover:text-foreground">
            Privacy
          </a>
        </div>
        <div>© 2026 founders.click</div>
      </div>
    </footer>
  );
}
