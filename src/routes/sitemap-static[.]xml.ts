import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";
import { MARKETPLACE_TEMPLATES } from "@/lib/templates";
import { buildUrlsetXml, sitemapResponse, type SitemapUrl } from "@/lib/sitemap";

/**
 * Static sub-sitemap: pages whose URLs and content are known at build time
 * (no DB lookup needed for the URL list itself).
 */

const STATIC_URLS: Array<{ path: string; lastmod?: Date }> = [
  { path: "/" },
  { path: "/amenities" },
  { path: "/hosting" },
  { path: "/host-training-academy" },
  { path: "/become-a-host" },
  { path: "/become-a-swimming-pool-host" },
  { path: "/privacy-policy" },
  { path: "/templates" },
  ...MARKETPLACE_TEMPLATES.map((t) => ({ path: `/templates/${t.slug}` })),
  { path: "/terms-of-service" },
  { path: "/p/about" },
  { path: "/p/hosting" },
  { path: "/p/howitworksforguests" },
  { path: "/p/make-money" },
  { path: "/p/investors" },
  { path: "/p/all-locations" },
];

export const Route = createFileRoute("/sitemap-static.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date();
        const urls: SitemapUrl[] = STATIC_URLS.map((entry) => ({
          loc: `${SITE_URL}${entry.path}`,
          lastmod: entry.lastmod ?? now,
        }));
        return sitemapResponse(buildUrlsetXml(urls));
      },
    },
  },
});
