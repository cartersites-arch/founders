import { serializeScriptJson } from "./script-json";
/**
 * SEO helpers for building meta tags and JSON-LD structured data.
 */

export const SITE_URL = "https://founders.click";
export const SITE_NAME = "founders.click";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;
export const SITE_LOGO = `${SITE_URL}/og-default.jpg`;

// Social profiles will be added once the founders.click handles are claimed.
export const SOCIAL_PROFILES: string[] = [];

export interface SeoMetaInput {
  title: string;
  description: string;
  path: string; // starts with /
  canonicalPath?: string; // overrides `path` for canonical (e.g. strip query)
  image?: string | null;
  type?: "website" | "article" | "product";
  noindex?: boolean;
  prevPath?: string | null;
  nextPath?: string | null;
  /**
   * Bidirectional hreflang links. When set, emits <link rel="alternate"
   * hreflang="..."> tags for each entry. Always include x-default. Each `href`
   * must be an absolute URL.
   */
  hreflang?: Array<{ lang: string; href: string }>;
}

export function buildMeta({
  title,
  description,
  path,
  canonicalPath,
  image,
  type = "website",
  noindex,
  prevPath,
  nextPath,
  hreflang,
}: SeoMetaInput) {
  const canonicalUrl = `${SITE_URL}${canonicalPath ?? path}`;
  // og:url and twitter URLs should reflect the canonical location, not the
  // (potentially legacy) request path. This keeps social shares deduplicated
  // when a page is reachable via multiple URLs that 301 to one canonical.
  const url = canonicalUrl;
  const resolvedImage = image === null ? null : (image ?? DEFAULT_OG_IMAGE);
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:site_name", content: SITE_NAME },
    { name: "twitter:card", content: resolvedImage ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (resolvedImage) {
    meta.push({ property: "og:image", content: resolvedImage });
    meta.push({ property: "og:image:width", content: "1200" });
    meta.push({ property: "og:image:height", content: "630" });
    meta.push({ name: "twitter:image", content: resolvedImage });
  }
  if (noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }
  const links: Array<Record<string, string>> = [{ rel: "canonical", href: canonicalUrl }];
  if (prevPath) links.push({ rel: "prev", href: `${SITE_URL}${prevPath}` });
  if (nextPath) links.push({ rel: "next", href: `${SITE_URL}${nextPath}` });
  if (hreflang?.length) {
    for (const h of hreflang) {
      links.push({ rel: "alternate", hrefLang: h.lang, href: h.href });
    }
  }
  return { meta, links };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export interface ItemListEntry {
  name: string;
  path: string;
  image?: string | null;
}

export function itemListJsonLd(items: ItemListEntry[], listName?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    ...(listName ? { name: listName } : {}),
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}${item.path}`,
      name: item.name,
      ...(item.image ? { image: item.image } : {}),
    })),
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: SITE_LOGO,
    ...(SOCIAL_PROFILES.length ? { sameAs: SOCIAL_PROFILES } : {}),
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  };
}

export function ldJsonScript(obj: unknown) {
  return {
    type: "application/ld+json",
    children: serializeScriptJson(obj),
  };
}
