import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { FALLBACK_HOSTS, resolveWorkspaceHost } from "@/lib/verified-host";

export async function resolvePublicWorkspace(): Promise<{
  id: string;
  slug: string;
  name: string;
} | null> {
  const host = await resolveWorkspaceHost(getRequest().headers, process.env.FOUNDERS_PROXY_SECRET);
  if (!host) return null;
  const sb = supabaseAdmin as any;
  const { data: workspace, error } = await sb
    .from("workspaces")
    .select("id, slug, name")
    .eq("marketplace_domain", host)
    .not("domain_verified_at", "is", null)
    .maybeSingle();
  if (error) throw new Error("Workspace lookup failed");
  if (workspace) return workspace;
  if (!FALLBACK_HOSTS.has(host)) return null;
  const { data: internal, error: fallbackError } = await sb
    .from("workspaces")
    .select("id, slug, name")
    .eq("slug", "pool-rental-near-me")
    .eq("is_internal", true)
    .maybeSingle();
  if (fallbackError) throw new Error("Workspace lookup failed");
  return internal ?? null;
}
