import { readLimitedJson } from "@/lib/limited-json";
import { guardPublicSubmission } from "@/server/submission-guard.server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Lightweight, public click-tracking endpoint for the "nearby cities" links.
// Called via navigator.sendBeacon — must accept text/plain bodies and respond fast.

const slugRegex = /^[a-z0-9-]+$/;
const Body = z.object({
  to_city_slug: z.string().min(1).max(120).regex(slugRegex),
  from_city_slug: z.string().min(1).max(120).regex(slugRegex).optional().nullable(),
  referrer_path: z.string().max(2000).optional().nullable(),
});

function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(/;\s*/);
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    if (p.slice(0, eq) === name) {
      try {
        const value = decodeURIComponent(p.slice(eq + 1));
        return /^[a-z0-9]{16,64}$/.test(value) ? value : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function randomVisitorId(): string {
  // 16 bytes of randomness, base36 — short, opaque, anonymous
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += b.toString(36);
  return out.slice(0, 24);
}

export const Route = createFileRoute("/api/public/track-city-click")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof Body>;
        try {
          // sendBeacon defaults to text/plain — read as text then JSON.parse
          await guardPublicSubmission("city-click");
          parsed = Body.parse(await readLimitedJson(request, 8192));
        } catch (error) {
          if (error instanceof Response) return error;
          return new Response("Bad request", { status: 400 });
        }

        const headers = request.headers;
        const ua = (headers.get("user-agent") || "").slice(0, 500);
        const country =
          headers.get("cf-ipcountry") ||
          headers.get("x-vercel-ip-country") ||
          headers.get("x-country") ||
          null;
        const region =
          headers.get("cf-region") ||
          headers.get("x-vercel-ip-country-region") ||
          headers.get("x-region") ||
          null;

        // Anonymous visitor cookie (90 days). Not a user id, not tied to an account.
        let visitorHash = getCookie(headers.get("cookie"), "prnm_vid");
        const setCookie = !visitorHash;
        if (!visitorHash) visitorHash = randomVisitorId();

        const { error } = await supabaseAdmin.from("city_link_clicks").insert({
          to_city_slug: parsed.to_city_slug,
          from_city_slug: parsed.from_city_slug ?? null,
          referrer_path: parsed.referrer_path ?? null,
          user_agent: ua || null,
          visitor_hash: visitorHash,
          country,
          region,
        });

        if (error) {
          console.error("track-city-click insert failed", error);
          return new Response("error", { status: 500 });
        }

        const resHeaders: Record<string, string> = {
          "content-type": "text/plain",
          "cache-control": "no-store",
        };
        if (setCookie) {
          resHeaders["set-cookie"] =
            `prnm_vid=${visitorHash}; Path=/; Max-Age=${60 * 60 * 24 * 90}; SameSite=Lax; HttpOnly; Secure`;
        }
        return new Response(null, { status: 204, headers: resHeaders });
      },
    },
  },
});
