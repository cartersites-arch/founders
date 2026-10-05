import { createMaintenanceHandlers } from "@/server/maintenance-handlers";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { render as renderAsync } from "@react-email/components";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { SITE_NAME } from "@/lib/seo";

/**
 * Daily SEO digest — called by pg_cron once per day.
 * Compiles new competitor pages, critical AI audit flags, and rank drops
 * from the last 24h, then enqueues an email to SEO_DIGEST_RECIPIENT.
 */

const SENDER_DOMAIN = process.env.EMAILIT_SENDER_DOMAIN ?? "notify.founders.click";
const FROM_DOMAIN = SENDER_DOMAIN;
const RECIPIENT = process.env.SEO_DIGEST_RECIPIENT ?? "derek@founders.click";

async function buildDigestData() {
  const sb = supabaseAdmin as any;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // 1. New competitor pages discovered in the last 24h
  const { data: newPagesRows, count: newPagesCount } = await sb
    .from("competitor_pages")
    .select("url, domain, title", { count: "exact" })
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(15);

  // 2. Critical AI audit flags (score < 60) in the last 24h
  const { data: auditsRows, count: auditsCount } = await sb
    .from("page_audits")
    .select("url_path, score, summary", { count: "exact" })
    .lt("score", 60)
    .gte("audited_at", since)
    .order("score", { ascending: true })
    .limit(15);

  // 3. Significant rank drops (>=5 positions worse vs previous reading)
  let rankDrops: {
    keyword: string;
    previous_position: number | null;
    current_position: number | null;
  }[] = [];
  try {
    const { data: rankRows } = await sb
      .from("serp_rankings")
      .select("keyword, position, checked_at")
      .gte("checked_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order("checked_at", { ascending: false })
      .limit(500);
    if (rankRows && Array.isArray(rankRows)) {
      const byKeyword = new Map<string, any[]>();
      for (const r of rankRows) {
        const list = byKeyword.get(r.keyword) || [];
        list.push(r);
        byKeyword.set(r.keyword, list);
      }
      for (const [keyword, list] of byKeyword.entries()) {
        if (list.length < 2) continue;
        const [current, previous] = list;
        const cur = current.position ?? 100;
        const prev = previous.position ?? 100;
        if (cur - prev >= 5) {
          rankDrops.push({
            keyword,
            previous_position: previous.position,
            current_position: current.position,
          });
        }
      }
      rankDrops = rankDrops.slice(0, 10);
    }
  } catch {
    // serp_rankings may not exist yet — non-fatal
  }

  // 4. New host leads in the last 24h (above-board matcher results)
  let hostLeads: any[] = [];
  let totalHostLeads = 0;
  try {
    const { data: leadRows, count: leadCount } = await sb
      .from("competitor_host_matches")
      .select(
        "competitor_url, domain, candidate_name, candidate_business_name, candidate_email, candidate_phone, candidate_website, candidate_evidence, match_confidence",
        { count: "exact" },
      )
      .eq("status", "new")
      .gte("match_confidence", 50)
      .gte("created_at", since)
      .order("match_confidence", { ascending: false })
      .limit(10);
    hostLeads = leadRows || [];
    totalHostLeads = leadCount || 0;
  } catch {
    // table may not exist yet
  }

  return {
    dateLabel: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    newCompetitorPages: newPagesRows || [],
    totalNewCompetitor: newPagesCount || 0,
    criticalAudits: auditsRows || [],
    totalCriticalAudits: auditsCount || 0,
    rankDrops,
    hostLeads,
    totalHostLeads,
  };
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sendDigest(force: boolean) {
  const sb = supabaseAdmin as any;
  const data = await buildDigestData();

  const totalSignals =
    data.totalNewCompetitor +
    data.totalCriticalAudits +
    data.rankDrops.length +
    data.totalHostLeads;
  if (!force && totalSignals === 0) {
    return { sent: false, reason: "no_signals", data };
  }

  const template = TEMPLATES["daily-seo-digest"];
  if (!template) throw new Error("Template not registered");

  // Suppression check
  const { data: suppressed } = await sb
    .from("suppressed_emails")
    .select("id")
    .eq("email", RECIPIENT.toLowerCase())
    .maybeSingle();
  if (suppressed) return { sent: false, reason: "suppressed" };

  // Get/create unsubscribe token
  let token: string;
  const { data: existing } = await sb
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", RECIPIENT.toLowerCase())
    .maybeSingle();
  if (existing && !existing.used_at) {
    token = existing.token;
  } else {
    token = generateToken();
    await sb
      .from("email_unsubscribe_tokens")
      .upsert(
        { token, email: RECIPIENT.toLowerCase() },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: stored } = await sb
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", RECIPIENT.toLowerCase())
      .maybeSingle();
    token = stored?.token || token;
  }

  const element = React.createElement(template.component, data);
  const html = await renderAsync(element);
  const text = await renderAsync(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(data) : template.subject;

  const messageId = `daily-seo-digest-${new Date().toISOString().slice(0, 10)}`;
  const idempotencyKey = messageId;

  await sb.from("email_send_log").insert({
    message_id: messageId,
    template_name: "daily-seo-digest",
    recipient_email: RECIPIENT,
    status: "pending",
  });

  const { error: enqErr } = await sb.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: RECIPIENT,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: "daily-seo-digest",
      idempotency_key: idempotencyKey,
      unsubscribe_token: token,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqErr) {
    await sb.from("email_send_log").insert({
      message_id: messageId,
      template_name: "daily-seo-digest",
      recipient_email: RECIPIENT,
      status: "failed",
      error_message: enqErr.message || "enqueue failed",
    });
    return { sent: false, error: enqErr.message };
  }

  return {
    sent: true,
    message_id: messageId,
    signals: totalSignals,
    summary: {
      new_competitor_pages: data.totalNewCompetitor,
      critical_audits: data.totalCriticalAudits,
      rank_drops: data.rankDrops.length,
    },
  };
}

export const Route = createFileRoute("/api/public/hooks/daily-seo-digest")({
  server: {
    handlers: createMaintenanceHandlers(async (request) => {
      const force = new URL(request.url).searchParams.get("force") === "1";
      return Response.json(await sendDigest(force));
    }),
  },
});
