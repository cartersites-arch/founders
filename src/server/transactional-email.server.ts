import { isLocalIsolation } from "@/lib/isolation-policy";
// Server-side helper for enqueuing transactional emails from server functions
// (including public/unauthenticated triggers like the waitlist form).
// Mirrors the logic of /lovable/email/transactional/send.ts but callable directly
// from server code using supabaseAdmin.
import * as React from "react";
import { render as renderAsync } from "@react-email/components";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { SITE_NAME } from "@/lib/seo";

const SENDER_DOMAIN = process.env.EMAILIT_SENDER_DOMAIN ?? "notify.founders.click";
const FROM_DOMAIN = SENDER_DOMAIN;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface SendParams {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, any>;
}

export async function sendTransactionalEmailServer({
  templateName,
  recipientEmail,
  idempotencyKey,
  templateData = {},
}: SendParams): Promise<{ success: boolean; reason?: string }> {
  if (isLocalIsolation()) {
    return { success: false, reason: "disabled_in_isolated_local_testing" };
  }
  const supabase = supabaseAdmin as any;
  const template = TEMPLATES[templateName];
  if (!template) {
    console.error("Template not found", { templateName });
    return { success: false, reason: "template_not_found" };
  }

  const effectiveRecipient = template.to || recipientEmail;
  if (!effectiveRecipient) {
    return { success: false, reason: "no_recipient" };
  }
  const normalizedEmail = effectiveRecipient.toLowerCase();
  const messageId = crypto.randomUUID();
  const idemKey = idempotencyKey || messageId;

  // Suppression check
  const { data: suppressed } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (suppressed) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "suppressed",
    });
    return { success: false, reason: "email_suppressed" };
  }

  // Get-or-create unsubscribe token
  let unsubscribeToken: string;
  const { data: existingToken } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token;
  } else if (!existingToken) {
    unsubscribeToken = generateToken();
    await supabase
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: stored } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (stored?.token) unsubscribeToken = stored.token;
  } else {
    return { success: false, reason: "email_suppressed" };
  }

  // Render
  const element = React.createElement(template.component, templateData);
  const html = await renderAsync(element);
  const plainText = await renderAsync(element, { plainText: true });
  const resolvedSubject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: "pending",
  });

  const { error: enqueueError } = await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: "transactional",
      label: templateName,
      idempotency_key: idemKey,
      unsubscribe_token: unsubscribeToken!,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    console.error("Failed to enqueue email", { templateName, error: enqueueError });
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: "failed",
      error_message: "Failed to enqueue email",
    });
    return { success: false, reason: "enqueue_failed" };
  }

  return { success: true };
}
