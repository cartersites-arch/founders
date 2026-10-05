import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { renderSafeMarkdown } from "@/lib/safe-content";
import { resolvePublicWorkspace } from "./public-workspace.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Published content is scoped to a verified request workspace.

export type PublicPage = {
  workspace: { id: string; slug: string; name: string };
  page: {
    title: string | null;
    seo_title: string | null;
    seo_description: string | null;
    hero_image_url: string | null;
    body_html: string;
    url_path: string;
    updated_at: string;
  };
};

const _PublicPageInput = z.object({ slug: z.string().min(1).max(200) });

export const getPublicPage = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => _PublicPageInput.parse(d))
  .handler(async ({ data }): Promise<PublicPage | null> => {
    const sb = supabaseAdmin as any;
    const workspace = await resolvePublicWorkspace();

    if (!workspace) return null;

    const url_path = `/p/${data.slug}`;
    const { data: page } = await sb
      .from("content_pages")
      .select(
        "title, seo_title, seo_description, hero_image_url, body_markdown, url_path, updated_at, status",
      )
      .eq("workspace_id", workspace.id)
      .eq("url_path", url_path)
      .eq("status", "published")
      .maybeSingle();

    if (!page) return null;

    const body_html = page.body_markdown ? renderSafeMarkdown(page.body_markdown) : "";

    return {
      workspace,
      page: {
        title: page.title,
        seo_title: page.seo_title,
        seo_description: page.seo_description,
        hero_image_url: page.hero_image_url,
        body_html,
        url_path: page.url_path,
        updated_at: page.updated_at,
      },
    };
  });
