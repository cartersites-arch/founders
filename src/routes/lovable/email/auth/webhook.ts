import * as React from "react";
import { render } from "@react-email/components";
import { StandardWebhookError, verifyStandardWebhook } from "@/integrations/webhooks/standard";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";
import { loadEmailBranding } from "@/server/email-branding.functions";

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: "Confirm your email",
  invite: "You've been invited",
  magiclink: "Your login link",
  recovery: "Reset your password",
  email_change: "Confirm your new email",
  reauthentication: "Your verification code",
};

// Template mapping
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
};

// Sending domain — overridable per environment via wrangler.jsonc vars.
// Must match a verified domain in your Emailit workspace.
const SENDER_DOMAIN = process.env.EMAILIT_SENDER_DOMAIN ?? "founders.click";
const ROOT_DOMAIN = process.env.SITE_ROOT_DOMAIN ?? "founders.click";
const FROM_DOMAIN = SENDER_DOMAIN;

// Shape of the Supabase Auth Send Email hook payload.
// https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
//
// Supabase fires an HTTPS webhook to our endpoint each time it needs to
// send a transactional email (signup confirm, magic link, password reset,
// email change, reauthentication, invite). Payload shape:
interface SupabaseSendEmailPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | "signup"
      | "invite"
      | "magiclink"
      | "recovery"
      | "email_change"
      | "reauthentication";
    site_url: string;
    /** Present only on email_change — the proposed new email's verification token */
    token_new?: string;
    token_hash_new?: string;
    /** Present only on email_change — the user's prior email address */
    new_email?: string;
  };
}

function redactEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "***";
  return `${localPart[0]}***@${domain}`;
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handlePost(request);
        } catch (e) {
          // TEMP: surface any unhandled error from inner steps so we can see
          // what's failing. Without this Cloudflare just logs 'HTTPError 500'
          // with no useful info.
          const err = e as Error;
          console.error("[auth-webhook] UNHANDLED", {
            name: err?.name,
            message: err?.message,
            stack: err?.stack?.slice(0, 800),
          });
          return Response.json(
            { error: "Internal error" },
            { status: 500 },
          );
        }
      },
    },
  },
});

async function handlePost(request: Request): Promise<Response> {
  const hookSecret = process.env.SEND_EMAIL_HOOK_SECRET;

  if (!hookSecret) {
    console.error("SEND_EMAIL_HOOK_SECRET not configured");
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Verify Supabase Auth's standard-webhooks signature, then parse payload.
  let payload: SupabaseSendEmailPayload;
  let run_id = "";
  try {
    const rawBody = await verifyStandardWebhook(request, hookSecret);
    payload = JSON.parse(rawBody) as SupabaseSendEmailPayload;
    // The webhook-id header doubles as our run_id for tracing — Supabase
    // doesn't include a run_id in the payload itself.
    run_id = request.headers.get("webhook-id") ?? "";
  } catch (error) {
    if (error instanceof StandardWebhookError) {
      switch (error.code) {
        case "invalid_signature":
        case "missing_headers":
        case "invalid_timestamp":
        case "stale_timestamp":
        case "invalid_secret":
          console.error("Invalid webhook signature", { code: error.code, message: error.message });
          return Response.json({ error: "Invalid signature" }, { status: 401 });
      }
    }
    if (error instanceof SyntaxError) {
      console.error("Invalid webhook JSON", { error: error.message });
      return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
    }

    console.error("Webhook verification failed", { error });
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  if (!payload?.email_data?.email_action_type || !payload?.user?.email) {
    console.error("Webhook payload missing required fields", {
      hasEmailData: !!payload?.email_data,
      hasUser: !!payload?.user,
      run_id,
    });
    return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  const emailType = payload.email_data.email_action_type;
  const recipientEmail = payload.user.email;
  console.log("Received auth event", {
    emailType,
    email_redacted: redactEmail(recipientEmail),
    run_id,
  });

  const EmailTemplate = EMAIL_TEMPLATES[emailType];
  if (!EmailTemplate) {
    console.error("Unknown email type", { emailType, run_id });
    return Response.json({ error: `Unknown email type: ${emailType}` }, { status: 400 });
  }

  // Load branding from DB (falls back to defaults)
  const brandingRow = await loadEmailBranding();
  const branding = {
    siteName: brandingRow.site_name,
    senderName: brandingRow.sender_name,
    logoUrl: brandingRow.logo_url,
    primaryColor: brandingRow.primary_color,
    primaryTextColor: brandingRow.primary_text_color,
    footerText: brandingRow.footer_text,
  };

  // Build the confirmation URL. Pattern:
  //   https://<project-ref>.supabase.co/auth/v1/verify?token=<token_hash>&type=<email_action_type>&redirect_to=<redirect_to>
  // We use the Supabase Auth API URL (always supabase.co) for the
  // verify endpoint; user lands on the redirect_to (founders.click)
  // after Supabase consumes the token.
  const confirmationUrl = (() => {
    const supabaseUrl = (
      import.meta.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ""
    ).replace(/\/$/, "");
    const params = new URLSearchParams({
      token: payload.email_data.token_hash,
      type: emailType,
      redirect_to: payload.email_data.redirect_to,
    });
    return `${supabaseUrl}/auth/v1/verify?${params.toString()}`;
  })();

  // Build template props from Supabase's send-email payload.
  const templateProps = {
    siteName: branding.siteName,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: recipientEmail,
    confirmationUrl,
    token: payload.email_data.token,
    email: recipientEmail,
    // Email-change action puts the user's prior email in the user object
    // and the proposed new email in email_data.new_email.
    oldEmail: emailType === "email_change" ? recipientEmail : undefined,
    newEmail: payload.email_data.new_email,
    branding,
  };

  // Render React Email to HTML and plain text
  const element = React.createElement(EmailTemplate, templateProps);
  const html = await render(element);
  const text = await render(element, { plainText: true });

  // Enqueue email for async processing by the dispatcher (process-email-queue).
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing Supabase environment variables");
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const messageId = crypto.randomUUID();

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: recipientEmail,
    status: "pending",
  });

  const { error: enqueueError } = await supabase.rpc("enqueue_email", {
    queue_name: "auth_emails",
    payload: {
      run_id,
      message_id: messageId,
      to: recipientEmail,
      from: `${branding.senderName} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: EMAIL_SUBJECTS[emailType] || "Notification",
      html,
      text,
      purpose: "transactional",
      label: emailType,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    console.error("Failed to enqueue auth email", { error: enqueueError, run_id, emailType });
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: recipientEmail,
      status: "failed",
      error_message: "Failed to enqueue email",
    });
    return Response.json({ error: "Failed to enqueue email" }, { status: 500 });
  }

  console.log("Auth email enqueued", {
    emailType,
    email_redacted: redactEmail(recipientEmail),
    run_id,
  });

  return Response.json({ success: true, queued: true });
}
