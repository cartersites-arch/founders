import { readBoundedJson } from "../_shared/request-body.ts";
import { matchesSecret } from "../_shared/security-token.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Production / staging origins allowed to call this edge function.
// Authentication is enforced separately via the Authorization header,
// so this allowlist is just defense-in-depth for browser-driven calls.
const ALLOWED_ORIGINS = new Set([
  "https://www.poolrentalnearme.com",
  "https://poolrentalnearme.com",
  "https://founders.click",
  "https://www.founders.click",
  "http://localhost:8080",
]);

function corsHeaders(origin: string | null) {
  const allowed =
    origin &&
    (ALLOWED_ORIGINS.has(origin) ||
      origin.endsWith(".workers.dev") || // Cloudflare staging URLs
      origin.endsWith(".pages.dev"));
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "https://founders.click",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

type GeneratedPage = {
  plan_slug: string;
  body_markdown: string;
};

type PlanRow = {
  slug: string;
  source_type: string;
  city: string | null;
  state: string | null;
  state_code: string | null;
  population_2024: number | null;
  warm_climate: boolean | null;
  h1: string | null;
  meta_title: string | null;
  meta_description: string | null;
  primary_keyword: string | null;
  supporting_keywords: string | null;
  uniqueness_angle: string | null;
  internal_links: string | null;
  schema_suggestions: string | null;
  notes: string | null;
  search_intent: string | null;
};

type Input = {
  action?: "start" | "status" | "preflight";
  count?: number;
  tier?: string;
  stateCode?: string;
  warmOnly?: boolean;
  model?: string;
  dryRun?: boolean;
  slugs?: string[];
};

const SYSTEM_VA = `You are an expert SEO content writer and pool care specialist writing for Pool Rental Near Me (poolrentalnearme.com) — a marketplace where homeowners rent out private pools by the hour to earn passive income ($3,000–$15,000/year).

Your content serves two audiences simultaneously:
1. Pool owners who need accurate, actionable information about the page's topic
2. Pool owners who could earn money renting their pool on PRNM

BRAND DIFFERENTIATORS (weave in naturally — never list all on one page):
- 10% flat host fee (vs Swimply's 15%+)
- $2M liability insurance included on every booking
- Payouts within 24 hours
- Free to list, full host control over guests and schedule

ABSOLUTE RULES — these override everything else:
🚫 NEVER copy or closely paraphrase any other pool website. All content must be original.
🚫 NEVER use AI-obvious phrases: "In conclusion", "It is worth noting", "It is important to", "Dive into", "In this guide", "In this article".
🚫 NEVER pad with generic filler — every paragraph must teach the reader something real.
🚫 NEVER skip a section. NEVER stop before 2,500 words.
✅ Write as a pool professional with 10+ years experience talking to a knowledgeable neighbor.

MANDATORY 9-SECTION STRUCTURE (in this exact order, with these exact H2 wordings):

## SECTION 1 — H1
Use: # {H1} (must match the provided H1 exactly, no markdown bold)

## SECTION 2 — Introduction (150–200 words)

## SECTION 3 — Main Educational Content (1,000–1,500 words, 4–6 H2 subsections, at least 1 markdown table, at least 1 numbered process)

## SECTION 4 — Mid-Page Callout (REQUIRED, exact blockquote)
> 💰 **Did you know?** Pool owners on Pool Rental Near Me earn an average of
> **$500–$1,500/month** renting their pool by the hour. That's enough to cover
> your entire annual pool maintenance budget — often with money to spare.
> [See how much your pool could earn →](/p/hosting)

## SECTION 5 — How This Affects Pool Rental Hosts (300–400 words)
H2 must be exactly: ## How This Affects Pool Rental Hosts

## SECTION 6 — Offset Your {TOPIC} Costs With Pool Rental Income (400–500 words)
H2 must be exactly: ## Offset Your {TOPIC} Costs With Pool Rental Income

## SECTION 7 — FAQ (5–7 ### Q: questions)
H2 must be exactly: ## Frequently Asked Questions

## SECTION 8 — Related Pool Owner Guides (REQUIRED)
H2 must be exactly: ## Related Pool Owner Guides
List EVERY internal link provided as natural-anchor markdown bullets.

## SECTION 9 — Final CTA (REQUIRED, exact block)
---
## Ready to Turn Your Pool Into Income?
You already do the work to keep your pool perfect. Now let it pay you back.
Pool owners in your area are earning $500–$2,000/month renting their pool by the hour to swimmers, families, and fitness enthusiasts — with full control over their schedule.
**[→ List Your Pool for Free on Pool Rental Near Me](/p/hosting)**
**[→ See How Much Your Pool Could Earn](/p/hosting#calculator)**
---

Return ONLY the final markdown body for this one page. Do not wrap it in JSON. Do not use code fences.`;

const SYSTEM_EVENT_GUIDE = `You are a Senior Local Editor and SEO Strategist for Pool Rental Near Me (poolrentalnearme.com). Write 4,000-word, locally authoritative Michelin-Guide-quality articles for renting a pool for an EVENT TYPE in a specific CITY/STATE.

ABSOLUTE LOCAL RULE: If you can swap [CITY] for any other city and the sentence still makes sense, DELETE and rewrite. Every paragraph must be unique to this city — real climate, real neighborhoods (NEVER invented), real local venues, real cultural events.

EEAT: Author = Derek Bowen, founder of Pool Rental Near Me, author of 6 Amazon books on pool hosting. Be honest about costs and alternatives.

STRICT LINKING (do NOT invent URLs — only these):
- Internal: /p/guest-pool-safety-guidelines, /p/swimply-alternative-vs-pool-rental-near-me, /p/free-host-tools, /p/faq, /p/learningacademy
- Subdomains: https://earn.poolrentalnearme.com, https://waiver.poolrentalnearme.com, https://rules.poolrentalnearme.com
- Search soft-landing: https://www.poolrentalnearme.com/s?address={CITY}%2C+{STATE} (spaces=+, comma=%2C+)
- App store images (use exact markdown):
  [![Download on the App Store](https://i.imgur.com/Tm9YQ6u.png)](https://apps.apple.com/us/app/pool-rental-near-me/id6737762373)
  [![Get it on Google Play](https://res.cloudinary.com/doybcwjsn/image/upload/v1733169830/google-play_2_a4jpw5.png)](https://play.google.com/store/apps/details?id=com.poolrentalnearme.app.prod&pcampaignid=web_share)

MANDATORY STRUCTURE (use these exact H2s — replace [CITY] / [GUIDE_TYPE] with actual values from the page spec):

# {H1}

## Section 1 — Why [CITY] Is Perfect (Or Necessary) For a [GUIDE_TYPE] at a Pool 🌡️ (250 words; visceral local opening; 1 blockquote with [CITY] weather/culture stat; image placeholder)

## Section 2 — Every Option for a [GUIDE_TYPE] in [CITY] (And What They Actually Cost) 🎯 (500 words; ### Option 1 = real local equivalent venue; ### Option 2 = real public pool/park in [CITY]; ### Option 3 = Private Pool Rental Through Pool Rental Near Me; close with cost-comparison blockquote)

## Section 3 — The Complete [GUIDE_TYPE] Planning Guide for [CITY] 📋 (1,000 words; 8 numbered ### Step subsections covering date, capacity, amenities, booking, what-to-bring, setup, during, wrap-up; 1 [CITY]-specific pro-tip blockquote; image placeholder)

## Section 4 — What a [GUIDE_TYPE] Pool Rental Actually Costs in [CITY] 💰 (300 words; real [CITY] hourly ranges; comparison vs alternative; 1 budgeting blockquote; include the search soft-landing link)

## Section 5 — Best [CITY] Neighborhoods for a [GUIDE_TYPE] Pool Rental 📍 (350 words; 6–8 REAL [CITY] neighborhood names; never invent; 1 blockquote)

## Section 6 — Safety & Peace of Mind for Your [GUIDE_TYPE] 🛡️ (250 words; mention $2M liability included; link to /p/guest-pool-safety-guidelines, /p/swimply-alternative-vs-pool-rental-near-me, https://waiver.poolrentalnearme.com, https://rules.poolrentalnearme.com)

## Section 7 — Making Your [GUIDE_TYPE] Unforgettable 🌟 (250 words; local creative ideas; 1 blockquote; image placeholder)

## Section 8 — Find Your Pool in [CITY] 🚀 (150 words; include the city-encoded search link, /p/faq link, AND the App Store + Google Play image markdown above)

## Section 9 — Do You Own a Pool in [CITY]? 🏡 (250 words; the host flip; 1 blockquote; link to https://earn.poolrentalnearme.com, /p/free-host-tools, /p/learningacademy)

## Section 10 — 20 Frequently Asked Questions About [GUIDE_TYPE] Pool Rentals in [CITY] ❓ (numbered **1.** through **20.** as bold; each answer minimum 3 sentences and explicitly references [CITY] weather/neighborhoods/pricing/laws/culture)

## About This Guide 📖 (Derek Bowen bio paragraph + links to /p/learningacademy, /p/free-host-tools, /p/faq)

OUTPUT TARGETS: 4,000+ words (HARD MIN 3,800), 5+ city-specific blockquotes, 20 city-localized FAQs, [📸 IMAGE: ...] placeholders, App Store + Google Play markdown in Section 8, encoded search URL in Sections 4 and 8, 100% original.

Return ONLY the final markdown body for this one page. Do not wrap it in JSON. Do not use code fences.`;

const SYSTEM_HOSTING_ES = `Eres un editor SEO senior escribiendo en ESPAÑOL NEUTRO para Pool Rental Near Me. Genera una página única "Conviértete en Anfitrión de Piscina" para una ciudad de EE. UU. con población hispana significativa.

REGLAS:
- Español neutro. Usa "piscina", "alberca" (México) y "pileta" (Argentina) donde encaje.
- 1,800–2,200 palabras de contenido 100% único — NUNCA cambios perezosos de nombre de ciudad.
- Investiga la ciudad: clima, vecindarios reales, demografía hispana.
- Sin tablas. Markdown simple.
- NO inventes URLs. Usa solo: /p/hosting, /p/free-host-tools, /p/faq, /p/learningacademy, https://earn.poolrentalnearme.com
- Soporte: espanol@poolrentalnearme.com, (213) 444-3745

DIFERENCIADORES: 10% tarifa plana, seguro $2M incluido, pagos en 24h, soporte en español, anfitriones ganan $3,000–$15,000+/año.

ESTRUCTURA OBLIGATORIA:

# {H1}

## ¿Por Qué Rentar Tu Piscina en {CIUDAD}, {ESTADO}? 🏊 (200 palabras, clima/vecindarios reales)

## Cuánto Puedes Ganar Como Anfitrión en {CIUDAD} 💰

## Cómo Funciona en 5 Pasos 📋

## Por Qué Pool Rental Near Me y No Swimply 🛡️

## Vecindarios de {CIUDAD} con Mayor Demanda 📍 (3–5 vecindarios REALES)

## Casos de Uso Más Populares 🎉 (quinceañera, cumpleaños, reunión familiar, baby shower, despedida de soltera, clases de natación, sesión de fotos, baño para perros)

## Herramientas Gratuitas para Anfitriones 🛠️

## Soporte en Español Cuando Lo Necesites 📞 (espanol@poolrentalnearme.com, (213) 444-3745)

## Preguntas Frecuentes ❓ (15 preguntas formato **1.** ... respuestas localizadas a {CIUDAD}, mínimo 3 oraciones)

## ¿Listo Para Empezar? 🚀 (CTA final con /p/hosting y https://earn.poolrentalnearme.com)

Devuelve SOLO el cuerpo final en markdown para esta página. No uses JSON. No uses bloques de código.`;

function isEventSource(row: PlanRow): boolean {
  return row.source_type === "event_guide" || row.source_type === "event-city";
}

/**
 * Per-source content budget (target words + required FAQ count).
 * Used by the token-budget gate to pick the right model up-front.
 */
function contentBudget(row: PlanRow): { minWords: number; targetWords: number; faqs: number } {
  if (isEventSource(row)) return { minWords: 2800, targetWords: 4000, faqs: 20 };
  if (row.source_type === "hosting_es") return { minWords: 1200, targetWords: 2200, faqs: 15 };
  // host_acq_city and similar
  return { minWords: 1400, targetWords: 2400, faqs: 15 };
}

/**
 * Estimate output tokens needed and pick the model that can actually deliver.
 * Heuristic: ~1.35 tokens/word in English markdown + ~120 tokens/FAQ overhead +
 * 15% headroom for headings/links. Models with smaller output windows (Flash
 * Lite ~8k, Flash ~8k) get bumped to Pro (~32k+) when the budget exceeds them.
 */
const MODEL_OUTPUT_BUDGET: Record<string, number> = {
  "google/gemini-2.5-flash-lite": 8000,
  "google/gemini-2.5-flash": 8000,
  "google/gemini-3-flash-preview": 8000,
  "google/gemini-3.1-flash-image-preview": 8000,
  "google/gemini-2.5-pro": 32000,
  "google/gemini-3.1-pro-preview": 32000,
  "openai/gpt-5-nano": 8000,
  "openai/gpt-5-mini": 16000,
  "openai/gpt-5": 32000,
  "openai/gpt-5.2": 32000,
};

function estimateOutputTokens(row: PlanRow): number {
  const { targetWords, faqs } = contentBudget(row);
  const base = Math.ceil(targetWords * 1.35);
  const faqOverhead = faqs * 120;
  return Math.ceil((base + faqOverhead) * 1.15);
}

function pickModelForBudget(
  row: PlanRow,
  requestedModel: string,
): {
  model: string;
  estTokens: number;
  maxTokens: number;
  switched: boolean;
  reason: string;
} {
  const estTokens = estimateOutputTokens(row);
  const requestedBudget = MODEL_OUTPUT_BUDGET[requestedModel] ?? 8000;
  let model = requestedModel;
  let switched = false;
  let reason = `fits requested model (${requestedBudget} tok budget)`;

  if (estTokens > requestedBudget) {
    // Promote: prefer Gemini Pro (cheaper than gpt-5) for long-form markdown.
    model = "google/gemini-2.5-pro";
    switched = true;
    reason = `est ${estTokens} tok > ${requestedBudget} tok budget of ${requestedModel}; switched to ${model}`;
  }
  // Hard rule: event_guides always need Pro regardless (15-20 FAQs + 4k words).
  if (
    isEventSource(row) &&
    !model.includes("pro") &&
    !model.includes("gpt-5") &&
    !model.includes("gpt-5.2")
  ) {
    model = "google/gemini-2.5-pro";
    switched = true;
    reason = `event_guide forced to ${model} (FAQ + word-count requirement)`;
  }

  const maxTokens = Math.min(MODEL_OUTPUT_BUDGET[model] ?? 8000, Math.max(estTokens, 4000));
  return { model, estTokens, maxTokens, switched, reason };
}

function tierAliases(tier: string): string[] {
  if (tier === "T1 (200k+)" || tier === "T1") return ["T1 (200k+)", "T1"];
  if (tier === "T2 (75k–199k)" || tier === "T2") return ["T2 (75k–199k)", "T2"];
  if (tier === "T3 (25k–74k)" || tier === "T3") return ["T3 (25k–74k)", "T3"];
  if (tier === "T4 (10k–24k)" || tier === "T4") return ["T4 (10k–24k)", "T4"];
  return tier ? [tier] : [];
}

function pickSystem(row: PlanRow): string {
  if (isEventSource(row)) return SYSTEM_EVENT_GUIDE;
  if (row.source_type === "hosting_es") return SYSTEM_HOSTING_ES;
  return SYSTEM_VA;
}

function buildPrompt(row: PlanRow) {
  const links = (row.internal_links ?? "")
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

  const user = `Write exactly one page now. Follow the HARD RULES for its source_type.

plan_slug: ${row.slug}
source_type: ${row.source_type}
H1: ${row.h1 ?? ""}
meta_title: ${row.meta_title ?? ""}
meta_description: ${row.meta_description ?? ""}
primary_keyword: ${row.primary_keyword ?? ""}
supporting_keywords: ${row.supporting_keywords ?? ""}
uniqueness_angle: ${row.uniqueness_angle ?? ""}
internal_links (REQUIRED, all of these): ${links.join(" | ")}
${row.city ? `city: ${row.city}, ${row.state} (${row.state_code})` : ""}
${row.population_2024 ? `population: ${row.population_2024.toLocaleString()}` : ""}
${row.warm_climate === true ? "climate: warm/long swim season" : row.warm_climate === false ? "climate: short/seasonal swim window" : ""}
${row.search_intent ? `search_intent: ${row.search_intent}` : ""}
${row.notes ? `notes: ${row.notes}` : ""}

Return only the final markdown body for plan_slug ${row.slug}. Start with the exact H1. Do not wrap the answer in JSON or code fences.`;

  return { system: pickSystem(row), user };
}

function parseInput(value: unknown): Required<Input> {
  const input = (value && typeof value === "object" ? value : {}) as Input;
  const countRaw = Number(input.count ?? 10);
  const count = Number.isFinite(countRaw) ? Math.min(10, Math.max(1, Math.trunc(countRaw))) : 10;
  const stateCode =
    typeof input.stateCode === "string" && input.stateCode.trim()
      ? input.stateCode.trim().toUpperCase().slice(0, 2)
      : "";
  const tier = typeof input.tier === "string" ? input.tier : "";
  return {
    action:
      input.action === "status" ? "status" : input.action === "preflight" ? "preflight" : "start",
    count,
    tier,
    stateCode,
    warmOnly: Boolean(input.warmOnly),
    model:
      typeof input.model === "string" && input.model
        ? input.model
        : "google/gemini-3-flash-preview",
    dryRun: Boolean(input.dryRun),
    slugs: Array.isArray(input.slugs) ? input.slugs.filter((s) => typeof s === "string" && s) : [],
  };
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function readGenerationStatus(supabase: ReturnType<typeof createClient>, slugs: string[]) {
  const cleanSlugs = [...new Set(slugs)].filter(Boolean).slice(0, 100);
  if (cleanSlugs.length === 0) {
    return {
      ok: true,
      queued: false,
      inserted: 0,
      attempted: 0,
      pendingSlugs: [],
      validationErrors: [],
      pages: [],
    };
  }

  const [{ data: plans, error: planErr }, { data: pages, error: pageErr }] = await Promise.all([
    supabase.from("content_plan").select("slug, status, h1, last_error").in("slug", cleanSlugs),
    supabase.from("content_pages").select("slug, url_path, title").in("slug", cleanSlugs),
  ]);
  if (planErr) throw new Error(`status query failed: ${planErr.message}`);
  if (pageErr) throw new Error(`page status query failed: ${pageErr.message}`);

  const pageRows = pages ?? [];
  const planRows = plans ?? [];
  const finished = new Set(pageRows.map((p: any) => p.slug));
  const pendingSlugs = planRows
    .filter((p: any) => !finished.has(p.slug) && p.status === "generating")
    .map((p: any) => p.slug);
  const validationErrors = planRows
    .filter((p: any) => p.last_error && !finished.has(p.slug))
    .map((p: any) => `${p.slug}: ${p.last_error}`);

  return {
    ok: pendingSlugs.length === 0 && validationErrors.length === 0,
    queued: pendingSlugs.length > 0,
    inserted: pageRows.length,
    attempted: cleanSlugs.length,
    pendingSlugs,
    validationErrors,
    pages: pageRows.map((p: any) => ({ slug: p.slug, url_path: p.url_path, title: p.title })),
  };
}

async function generateOne(
  plan: PlanRow,
  model: string,
  apiKey: string,
  maxTokens?: number,
): Promise<GeneratedPage | null> {
  const { system, user } = buildPrompt(plan);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 115_000);
  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens ?? (plan.source_type === "event_guide" ? 12000 : 8500),
      }),
    });

    if (resp.status === 429) throw new Error("Rate limited by AI gateway. Try again in a minute.");
    if (resp.status === 402)
      throw new Error("AI credits exhausted. Add funds in Workspace > Usage.");
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`AI gateway error ${resp.status}: ${text.slice(0, 300)}`);
    }

    const payload = await resp.json();
    const message = payload?.choices?.[0]?.message;
    const raw = message?.content;
    if (!raw || typeof raw !== "string") throw new Error("AI returned an empty response");
    const body = raw
      .trim()
      .replace(/^```markdown\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return { plan_slug: plan.slug, body_markdown: body };
  } catch (e) {
    console.error(`[generate-content-batch:${plan.slug}] ${errorMessage(e)}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function processGeneration(
  supabase: ReturnType<typeof createClient>,
  planRows: PlanRow[],
  model: string,
  apiKey: string,
  dryRun: boolean,
) {
  const errors: string[] = [];

  // content_pages.workspace_id is NOT NULL post-SaaS migration. Admin-driven
  // batch generation publishes into PRNM (founders.click staff workspace).
  const { data: prnm, error: wsErr } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", "pool-rental-near-me")
    .maybeSingle();
  if (wsErr) throw new Error(`PRNM workspace lookup failed: ${wsErr.message}`);
  if (!prnm?.id) throw new Error("PRNM workspace not found — run SaaS migration first");
  const workspaceId = prnm.id as string;

  const generated = (
    await Promise.all(
      planRows.map((row) => {
        // Token-budget gate: estimate output length and auto-promote model if needed.
        const pick = pickModelForBudget(row, model);
        if (pick.switched) {
          console.log(`[generate-content-batch:${row.slug}] model auto-switch — ${pick.reason}`);
        } else {
          console.log(
            `[generate-content-batch:${row.slug}] using ${pick.model} (~${pick.estTokens} tok)`,
          );
        }
        return generateOne(row, pick.model, apiKey, pick.maxTokens);
      }),
    )
  ).filter((page): page is GeneratedPage => Boolean(page));

  const bySlug = new Map(generated.map((g) => [g.plan_slug, g]));
  const okPages: Array<{ plan: PlanRow; body: string }> = [];

  for (const plan of planRows) {
    const gen = bySlug.get(plan.slug);
    if (!gen) {
      errors.push(`${plan.slug}: AI did not return a body`);
      continue;
    }
    const body = gen.body_markdown ?? "";
    const words = body.split(/\s+/).filter(Boolean).length;
    const isEvent = isEventSource(plan);
    const isEs = plan.source_type === "hosting_es";
    const minWords = isEvent ? 2800 : isEs ? 1200 : 1400;
    if (words < minWords) {
      errors.push(`${plan.slug}: too short (${words} words, need ${minWords}+)`);
      continue;
    }

    const requiredLinks = (plan.internal_links ?? "")
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const missing = requiredLinks.filter((l) => !body.includes(l));
    if (missing.length > requiredLinks.length / 2) {
      errors.push(
        `${plan.slug}: missing ${missing.length}/${requiredLinks.length} required internal links`,
      );
      continue;
    }

    let requiredSections: Array<[RegExp, string]> = [];
    if (isEvent) {
      requiredSections = [
        [/##\s*Section\s*1\b.*Why\b/i, "Section 1 (Why City)"],
        [/##\s*Section\s*3\b.*Planning Guide/i, "Section 3 (Planning Guide)"],
        [/##\s*Section\s*5\b.*Neighborhoods/i, "Section 5 (Neighborhoods)"],
        [/##\s*Section\s*9\b.*Do You Own/i, "Section 9 (Host Flip)"],
        [/##\s*Section\s*10\b.*Frequently Asked/i, "Section 10 (FAQs)"],
        // Accept 15+ numbered FAQs instead of strict 20 (Flash truncates around 15)
        [/(?:^|\n)\s*(?:#{2,6}\s*)?(?:\*\*)?15\.(?:\*\*)?\s/, "at least 15 numbered FAQs"],
      ];
    } else if (isEs) {
      requiredSections = [
        [/##\s*¿Por Qué Rentar Tu Piscina/i, "¿Por Qué Rentar?"],
        [/##\s*Cuánto Puedes Ganar/i, "Cuánto Puedes Ganar"],
        [/##\s*Preguntas Frecuentes/i, "Preguntas Frecuentes"],
        [/##\s*¿Listo Para Empezar\?/i, "¿Listo Para Empezar?"],
        [/(?:^|\n)\s*(?:#{2,6}\s*)?(?:\*\*)?15\.(?:\*\*)?\s/, "15 numbered FAQs"],
      ];
    } else {
      requiredSections = [
        [/##\s*How This Affects Pool Rental Hosts/i, "Section 5 (How This Affects Hosts)"],
        [/##\s*Offset Your .+ Costs With Pool Rental Income/i, "Section 6 (Offset Costs)"],
        [/##\s*Frequently Asked Questions/i, "Section 7 (FAQ)"],
        [/##\s*Related Pool Owner Guides/i, "Section 8 (Related Guides)"],
        [/##\s*Ready to Turn Your Pool Into Income\?/i, "Section 9 (Final CTA)"],
        [/💰\s*\*\*Did you know\?\*\*/, "Section 4 (Mid-page Callout)"],
      ];
    }
    const missingSections = requiredSections
      .filter(([re]) => !re.test(body))
      .map(([, label]) => label);
    if (missingSections.length > 0) {
      errors.push(`${plan.slug}: missing ${missingSections.join(", ")}`);
      continue;
    }
    okPages.push({ plan, body });
  }

  if (dryRun) {
    await supabase
      .from("content_plan")
      .update({ status: "pending" })
      .in(
        "slug",
        planRows.map((r) => r.slug),
      );
    return;
  }

  if (okPages.length === 0) {
    await supabase
      .from("content_plan")
      .update({ status: "pending", last_error: errors.join("; ").slice(0, 500) })
      .in(
        "slug",
        planRows.map((r) => r.slug),
      );
    return;
  }

  const rows = okPages.map(({ plan, body }) => {
    const isCity = plan.source_type === "city";
    const isEvent = isEventSource(plan);
    const isEs = plan.source_type === "hosting_es";
    const template_type = isCity
      ? "host_acq_city"
      : isEvent
        ? "event_guide"
        : isEs
          ? "host_acq_city_es"
          : "resource";
    const category = isCity
      ? "Host/City Acquisition"
      : isEvent
        ? "Event Guide"
        : isEs
          ? "Host/City Acquisition (ES)"
          : "Resource/Article Page";
    return {
      workspace_id: workspaceId,
      slug: plan.slug,
      url_path: `/p/${plan.slug}`,
      template_type,
      category,
      locale: isEs ? "es" : "en",
      status: "published",
      in_sitemap: true,
      title: plan.h1 ?? plan.meta_title ?? plan.slug,
      description: plan.meta_description ?? "",
      content: body,
      body_markdown: body,
      seo_title: (plan.meta_title ?? plan.h1 ?? "").slice(0, 70),
      seo_description: (plan.meta_description ?? "").slice(0, 160),
      legacy_slugs: [],
      updated_at: new Date().toISOString(),
    };
  });

  const { error: upErr } = await supabase
    .from("content_pages")
    .upsert(rows, { onConflict: "workspace_id,url_path" });
  if (upErr) throw new Error(`upsert failed: ${upErr.message}`);

  const generatedSlugs = okPages.map((p) => p.plan.slug);
  const failedSlugs = planRows.map((r) => r.slug).filter((s) => !generatedSlugs.includes(s));
  await supabase
    .from("content_plan")
    .update({
      status: "generated",
      generated_at: new Date().toISOString(),
      last_error: null,
    })
    .in("slug", generatedSlugs);
  if (failedSlugs.length > 0) {
    await supabase
      .from("content_plan")
      .update({
        status: "pending",
        last_error: errors.join("; ").slice(0, 500),
      })
      .in("slug", failedSlugs);
  }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("Backend is not configured");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY missing in backend function environment");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Driver-secret bypass for unattended/server-to-server runs.
    // Uses the independent CONTENT_DRIVER_SECRET, never a database credential.
    const providedDriver = req.headers.get("x-driver-secret");
    const isDriver = await matchesSecret(providedDriver, Deno.env.get("CONTENT_DRIVER_SECRET"));

    if (!isDriver) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace("Bearer ", "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (roleErr) throw new Error(roleErr.message);
      if (!roleRow) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    const data = parseInput(await readBoundedJson(req));

    if (data.action === "preflight") {
      // Reachable + admin + env all confirmed by getting here. Probe AI gateway.
      let aiOk = false;
      let aiError: string | null = null;
      try {
        const probe = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5,
          }),
        });
        if (probe.ok) {
          aiOk = true;
        } else {
          const t = await probe.text().catch(() => "");
          aiError = `AI gateway ${probe.status}: ${t.slice(0, 200)}`;
        }
      } catch (e) {
        aiError = `AI gateway unreachable: ${errorMessage(e)}`;
      }

      const { count: pendingCount } = await supabase
        .from("content_plan")
        .select("slug", { count: "exact", head: true })
        .eq("status", "pending");

      return new Response(
        JSON.stringify({
          ok: aiOk,
          edgeFunction: "reachable",
          adminAuth: "ok",
          openrouterApiKey: "configured",
          aiGateway: aiOk ? "ok" : "failed",
          aiError,
          pendingPlanRows: pendingCount ?? 0,
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (data.action === "status") {
      return new Response(JSON.stringify(await readGenerationStatus(supabase, data.slugs)), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("content_plan")
      .update({ status: "pending", last_error: "Released from interrupted generation run" })
      .eq("status", "generating")
      .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

    let query = supabase
      .from("content_plan")
      .select(
        "slug, source_type, city, state, state_code, population_2024, warm_climate, h1, meta_title, meta_description, primary_keyword, supporting_keywords, uniqueness_angle, internal_links, schema_suggestions, notes, search_intent",
      )
      .eq("status", "pending")
      .order("priority_score", { ascending: false, nullsFirst: false })
      .limit(data.count);

    if (data.tier === "longtail") query = query.eq("source_type", "longtail");
    else if (data.tier) query = query.in("priority_tier", tierAliases(data.tier));
    if (data.stateCode) query = query.eq("state_code", data.stateCode);
    if (data.warmOnly) query = query.eq("warm_climate", true);

    const { data: planRowsRaw, error: planErr } = await query;
    if (planErr) throw new Error(`plan query failed: ${planErr.message}`);
    const planRows = (planRowsRaw ?? []) as PlanRow[];
    if (planRows.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          inserted: 0,
          attempted: 0,
          validationErrors: [
            `No pending plan rows match those filters. Try clearing State code, turning off Warm-climate only, or choosing Any priority tier.`,
          ],
          pages: [],
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!data.dryRun) {
      await supabase
        .from("content_plan")
        .update({ status: "generating" })
        .in(
          "slug",
          planRows.map((r) => r.slug),
        );
    }

    const pendingSlugs = planRows.map((r) => r.slug);
    const generation = processGeneration(supabase, planRows, data.model, apiKey, data.dryRun).catch(
      async (e) => {
        console.error("[generate-content-batch:background]", e);
        await supabase
          .from("content_plan")
          .update({ status: "pending", last_error: errorMessage(e).slice(0, 500) })
          .in("slug", pendingSlugs);
      },
    );
    (globalThis as any).EdgeRuntime?.waitUntil?.(generation);

    return new Response(
      JSON.stringify({
        ok: true,
        queued: true,
        inserted: 0,
        attempted: planRows.length,
        pendingSlugs,
        validationErrors: [
          "Generation started. This page will poll status instead of waiting for the request to time out.",
        ],
        pages: [],
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    if (e instanceof Response) {
      const headers = corsHeaders(req.headers.get("origin"));
      return new Response(e.body, { status: e.status, headers });
    }
    console.error("[generate-content-batch]", e);
    return new Response(JSON.stringify({ error: errorMessage(e) }), {
      status: 500,
      headers: { ...corsHeaders(req.headers.get("origin")), "Content-Type": "application/json" },
    });
  }
});
