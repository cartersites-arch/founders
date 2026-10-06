import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireFeatureAccess } from "@/server/workspace.functions";
import { PLAN_FEATURES, type Plan } from "@/lib/plans";

// ─────────────────────────────────────────────────────────────────────────────
// Customer-facing content server functions. These are workspace-scoped, unlike
// the admin variants which always publish into PRNM. Every gated call goes
// through requireFeatureAccess so plan limits + subscription_status are
// enforced server-side, not just by sidebar lock badges.
// ─────────────────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "write_page",
    description: "Return the generated page as structured data.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "H1 (no markdown). 30–100 chars." },
        seo_title: { type: "string", description: "<=60 chars, includes primary keyword." },
        seo_description: {
          type: "string",
          description: "<=155 chars, compelling and specific.",
        },
        body_markdown: {
          type: "string",
          description: "Full markdown body, 600-1200 words, no frontmatter",
        },
      },
      required: ["title", "seo_title", "seo_description", "body_markdown"],
    },
  },
};

const CreateInputSchema = z.object({
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(500).optional().default(""),
  topic: z.string().trim().min(10).max(2000),
  model: z.string().min(1).max(80).default("openai/gpt-5"),
});

export const createCustomerPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CreateInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { workspaceId, plan } = await requireFeatureAccess(userId, "content.quick_page");

    const { data: ws, error: wsErr } = await (supabaseAdmin as any)
      .from("workspaces")
      .select("name, marketplace_domain, is_internal")
      .eq("id", workspaceId)
      .maybeSingle();
    if (wsErr) throw new Error(wsErr.message);
    if (!ws) throw new Error("Workspace not found");
    const brandName = (ws.name as string) || "your marketplace";

    // Quota: count content_pages this workspace created since the start of
    // the current UTC month. Internal workspaces (PRNM) bypass.
    if (!ws.is_internal) {
      const quota = PLAN_FEATURES[plan as Plan].quotas.pageGenerationsPerMonth;
      if (Number.isFinite(quota)) {
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);
        const { count, error: cErr } = await (supabaseAdmin as any)
          .from("content_pages")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .gte("created_at", monthStart.toISOString());
        if (cErr) throw new Error(cErr.message);
        if ((count ?? 0) >= quota) {
          throw new Error(
            `Monthly page-generation quota reached (${quota} on the ${PLAN_FEATURES[plan as Plan].name} plan). Upgrade or wait until next month.`,
          );
        }
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

    const baseSlug = slugify(data.title);
    if (!baseSlug) throw new Error("Could not derive slug from title");
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const { data: existing } = await (supabaseAdmin as any)
        .from("content_pages")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("url_path", `/p/${slug}`)
        .maybeSingle();
      if (!existing) break;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
      if (suffix > 50) throw new Error("Could not find a unique slug");
    }

    const systemPrompt = `
You write SEO + brand content for "${brandName}", a marketplace.
Voice: confident, friendly, customer-first, never spammy. Short paragraphs. Real, useful copy — no filler.
Format: Markdown only. Use ## and ### headings.
Always end with a short CTA paragraph that invites the reader to explore "${brandName}".
Return your answer ONLY by calling the write_page tool.
`.trim();

    const userPrompt = `Write a page for ${brandName}.

Title (H1): "${data.title}"
${data.description ? `One-line summary: "${data.description}"` : ""}

What this page should be about (interpret literally and build the article around this):
${data.topic}

Length: 600-1200 words.
Use ## for main sections and ### for sub-points. Lead with a strong opening that gets right into the value — no fluff.
seo_title (≤60 chars) and seo_description (≤155 chars) optimized for the topic.`;

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: data.model,
        // Leave room for reasoning and a complete 600–1200 word page.
        max_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "write_page" } },
      }),
    });

    if (resp.status === 402) throw new Error("AI credits exhausted.");
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI gateway ${resp.status}: ${t.slice(0, 300)}`);
    }
    const json = await resp.json();
    if (json?.choices?.[0]?.finish_reason === "length") {
      throw new Error("AI response was truncated. Try generating the page again.");
    }
    const tc = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc?.function?.arguments) throw new Error("AI response missing tool call");
    const gen = JSON.parse(tc.function.arguments) as {
      title: string;
      seo_title: string;
      seo_description: string;
      body_markdown: string;
    };
    if (!gen.body_markdown || gen.body_markdown.length < 300) {
      throw new Error(`Generated body too short (${gen.body_markdown?.length ?? 0} chars)`);
    }

    const url_path = `/p/${slug}`;
    const { data: inserted, error: insErr } = await (supabaseAdmin as any)
      .from("content_pages")
      .insert({
        workspace_id: workspaceId,
        slug,
        url_path,
        title: gen.title || data.title,
        seo_title: (gen.seo_title || data.title).slice(0, 70),
        seo_description: (gen.seo_description || data.description || "").slice(0, 160),
        body_markdown: gen.body_markdown,
        category: "Resource/Article Page",
        template_type: "resource",
        status: "published",
        in_sitemap: true,
        locale: "en",
        priority: 0,
      })
      .select("id, url_path, title, slug")
      .single();
    if (insErr) throw new Error(insErr.message);

    return {
      ok: true,
      page: inserted as { id: string; url_path: string; title: string; slug: string },
      words: gen.body_markdown.split(/\s+/).length,
    };
  });

export type CustomerPageRow = {
  id: string;
  url_path: string;
  title: string;
  slug: string;
  status: string;
  template_type: string | null;
  updated_at: string | null;
};

export const listCustomerPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: CustomerPageRow[] }> => {
    const { userId } = context as { userId: string };
    const { workspaceId } = await requireFeatureAccess(userId, "content.quick_page");

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("content_pages")
      .select("id, url_path, title, slug, status, template_type, updated_at")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    return { rows: (rows ?? []) as CustomerPageRow[] };
  });

export type CustomerPageDetail = {
  id: string;
  workspace_id: string;
  url_path: string;
  slug: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  body_markdown: string | null;
  status: string;
  template_type: string | null;
  updated_at: string | null;
};

export const getCustomerPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ page: CustomerPageDetail | null }> => {
    const { userId } = context as { userId: string };
    const { workspaceId } = await requireFeatureAccess(userId, "content.quick_page");

    const { data: row, error } = await (supabaseAdmin as any)
      .from("content_pages")
      .select(
        "id, workspace_id, url_path, slug, title, seo_title, seo_description, body_markdown, status, template_type, updated_at",
      )
      .eq("workspace_id", workspaceId)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { page: (row as CustomerPageDetail | null) ?? null };
  });

const UpdateInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  seo_title: z.string().trim().max(70).optional().default(""),
  seo_description: z.string().trim().max(200).optional().default(""),
  body_markdown: z.string().min(1).max(80_000),
  status: z.enum(["published", "draft"]).default("published"),
});

export const updateCustomerPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { workspaceId } = await requireFeatureAccess(userId, "content.quick_page");

    const { error } = await (supabaseAdmin as any)
      .from("content_pages")
      .update({
        title: data.title,
        seo_title: data.seo_title || null,
        seo_description: data.seo_description || null,
        body_markdown: data.body_markdown,
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCustomerPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const { workspaceId } = await requireFeatureAccess(userId, "content.quick_page");

    const { error } = await (supabaseAdmin as any)
      .from("content_pages")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
