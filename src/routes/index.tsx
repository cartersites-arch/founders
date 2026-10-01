import { createFileRoute } from "@tanstack/react-router";
import { FoundersHome } from "@/components/founders-home";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "founders.click — AI Growth Engine for Sharetribe Marketplace Founders" },
      {
        name: "description",
        content:
          "Custom-coded SEO, AI content generation, and ops tools — without the agency price tag. Built for Sharetribe marketplace founders.",
      },
      { property: "og:title", content: "founders.click — Replace your SEO agency" },
      {
        property: "og:description",
        content:
          "Most Sharetribe founders can't afford an SEO agency. founders.click replaces one — at a fraction of the cost.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_URL,
        }),
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return <FoundersHome />;
}
