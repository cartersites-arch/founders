import { fetchSitemapUrls } from "@/lib/safe-sitemap";
import { createMaintenanceHandlers } from "@/server/maintenance-handlers";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";



async function runRadar() {
  const sb = supabaseAdmin as any;
  const { count: before } = await sb
    .from("competitor_urls")
    .select("*", { count: "exact", head: true });
  const { data: sites } = await sb.from("competitor_sites").select("*").eq("is_active", true);
  const results: any[] = [];
  for (const site of sites || []) {
    try {
      const urls = await fetchSitemapUrls(site.sitemap_url);
      const unique = Array.from(new Set(urls)).slice(0, 10000);
      const now = new Date().toISOString();
      const { data: existing } = await sb
        .from("competitor_urls")
        .select("url")
        .eq("site_id", site.id);
      const existingSet = new Set((existing || []).map((r: any) => r.url));
      const newOnes = unique.filter((u) => !existingSet.has(u));
      if (newOnes.length) {
        await sb.from("competitor_urls").insert(
          newOnes.map((url) => ({
            site_id: site.id,
            url,
            first_seen_at: now,
            last_seen_at: now,
          })),
        );
      }
      await sb
        .from("competitor_sites")
        .update({ last_checked_at: now, last_url_count: unique.length })
        .eq("id", site.id);
      results.push({ domain: site.domain, new_count: newOnes.length, total: unique.length });
    } catch (e: any) {
      results.push({ domain: site.domain, error: e?.message });
    }
  }
  const { count: after } = await sb
    .from("competitor_urls")
    .select("*", { count: "exact", head: true });
  return { before, after, delta: (after || 0) - (before || 0), results };
}

async function runSerp() {
  const sb = supabaseAdmin as any;
  const fcKey = process.env.FIRECRAWL_API_KEY;
  if (!fcKey) return { error: "FIRECRAWL_API_KEY missing" };
  const { count: before } = await sb
    .from("serp_rankings")
    .select("*", { count: "exact", head: true });
  const { data: kws } = await sb
    .from("tracked_keywords")
    .select("*")
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(2);
  const results: any[] = [];
  for (const kw of kws || []) {
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(kw.keyword)}&gl=${kw.market || "us"}&num=100`;
      const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${fcKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: searchUrl, formats: ["html"], onlyMainContent: false }),
      });
      if (!resp.ok) {
        results.push({ keyword: kw.keyword, error: `FC ${resp.status}` });
        continue;
      }
      const json = await resp.json();
      const html: string = json?.data?.html || json?.html || "";
      const urlMatches = Array.from(html.matchAll(/href="(https?:\/\/[^"]+)"/g)).map((m) => m[1]);
      const seen = new Set<string>();
      const ordered: string[] = [];
      for (const u of urlMatches) {
        if (u.includes("google.com") || u.includes("/search?") || u.includes("webcache.")) continue;
        if (seen.has(u)) continue;
        seen.add(u);
        ordered.push(u);
      }
      let position: number | null = null;
      let urlFound: string | null = null;
      for (let i = 0; i < ordered.length; i++) {
        if (ordered[i].includes("poolrentalnearme.com")) {
          position = i + 1;
          urlFound = ordered[i];
          break;
        }
      }
      const now = new Date().toISOString();
      await sb
        .from("serp_rankings")
        .insert({ keyword_id: kw.id, position, url_found: urlFound, checked_at: now });
      await sb
        .from("tracked_keywords")
        .update({
          previous_position: kw.last_position,
          last_position: position,
          last_checked_at: now,
        })
        .eq("id", kw.id);
      results.push({ keyword: kw.keyword, position, sample_results: ordered.length });
    } catch (e: any) {
      results.push({ keyword: kw.keyword, error: e?.message });
    }
  }
  const { count: after } = await sb
    .from("serp_rankings")
    .select("*", { count: "exact", head: true });
  return { before, after, delta: (after || 0) - (before || 0), results };
}

async function runAudit() {
  const sb = supabaseAdmin as any;
  const lovKey = process.env.OPENROUTER_API_KEY;
  if (!lovKey) return { error: "OPENROUTER_API_KEY missing" };
  const { count: before } = await sb
    .from("page_audits")
    .select("*", { count: "exact", head: true });
  const { data: page } = await sb
    .from("content_pages")
    .select("url_path, title, seo_description, body_markdown")
    .not("body_markdown", "is", null)
    .not("url_path", "is", null)
    .limit(1)
    .maybeSingle();
  if (!page) return { error: "No content page found to audit" };
  const ourBody = (page.body_markdown || "").slice(0, 6000);
  const prompt = `You are an SEO auditor. Score this page 0-100 and return STRICT JSON:
{"score": <0-100>, "summary": "<one sentence>", "strengths": ["..."], "weaknesses": ["..."], "recommendations": ["..."]}

Page URL: ${page.url_path}
Title: ${page.title || "(none)"}
Description: ${page.seo_description || "(none)"}
Body (truncated):
${ourBody}

Return ONLY JSON, no markdown fences.`;
  const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!aiResp.ok) return { error: `AI ${aiResp.status}: ${(await aiResp.text()).slice(0, 200)}` };
  const aiJson = await aiResp.json();
  const content: string = aiJson?.choices?.[0]?.message?.content || "";
  const cleaned = content
    .replace(/```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { error: "non-JSON", raw: content.slice(0, 200) };
  }
  const { data: row, error } = await sb
    .from("page_audits")
    .insert({
      url_path: page.url_path,
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      summary: String(parsed.summary || "").slice(0, 1000),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 20) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 20) : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.slice(0, 20)
        : [],
    })
    .select("id, url_path, score, summary")
    .maybeSingle();
  if (error) return { error: error.message };
  const { count: after } = await sb.from("page_audits").select("*", { count: "exact", head: true });
  return { before, after, delta: (after || 0) - (before || 0), audit: row };
}

async function runAll() {
  const radar = await runRadar();
  const serp = await runSerp();
  const audit = await runAudit();
  return { ok: true, radar, serp, audit, ran_at: new Date().toISOString() };
}

export const Route = createFileRoute("/api/public/hooks/seo-self-test")({
  server: {
    handlers: createMaintenanceHandlers(async () => Response.json(await runAll())),
  },
});
