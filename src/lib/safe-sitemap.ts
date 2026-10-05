import { readLimitedBytes } from "./limited-json.ts";

const UA = "Mozilla/5.0 (compatible; PoolRentalNearMeBot/1.0; +https://www.poolrentalnearme.com)";

// Remote XML must not choose a new destination for privileged server fetches.
// DNS names still depend on the deployment's outbound network controls.
function checkedUrl(value: string, origin?: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password ||
      (url.port && url.port !== "443") || !host.includes(".") ||
      /^[\d.]+$/.test(host) || host.includes(":") ||
      /\.(localhost|local|internal|lan|home|arpa)\.?$/.test(host) ||
      host.endsWith(".") || (origin && url.origin !== origin)) {
    throw new Error("Unsafe sitemap destination");
  }
  url.hash = "";
  return url;
}

export async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const root = checkedUrl(sitemapUrl);
  const origin = root.origin;
  const signal = AbortSignal.timeout(30000);
  const visited = new Set<string>();
  const output = new Set<string>();
  let requests = 0;
  let bytesRemaining = 8 * 1024 * 1024;

  async function visit(value: string, depth: number): Promise<void> {
    if (depth > 2 || requests >= 25 || output.size >= 10000 || bytesRemaining <= 0) return;
    let url = checkedUrl(value, origin);
    if (visited.has(url.href)) return;
    visited.add(url.href);
    let response: Response | undefined;
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (requests >= 25) return;
      requests++;
      response = await fetch(url, { redirect: "manual", signal, headers: { "User-Agent": UA } });
      if (response.status < 300 || response.status >= 400) break;
      void response.body?.cancel().catch(() => {});
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new Error("Sitemap redirect rejected");
      url = checkedUrl(new URL(location, url).href, origin);
    }
    if (!response?.ok) {
      void response?.body?.cancel().catch(() => {});
      throw new Error("Sitemap request failed");
    }
    const bytes = await readLimitedBytes(response, Math.min(1024 * 1024, bytesRemaining));
    bytesRemaining -= bytes.byteLength;
    const xml = new TextDecoder().decode(bytes);
    const index = /<sitemapindex\b/i.test(xml);
    for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      if (output.size >= 10000 || signal.aborted) break;
      try {
        const child = checkedUrl(match[1].replace(/&amp;/g, "&"), origin);
        if (index) await visit(child.href, depth + 1);
        else output.add(child.href);
      } catch {
        // Skip unsafe or failed children without abandoning valid sitemap entries.
      }
    }
  }
  await visit(root.href, 0);
  return [...output];
}
