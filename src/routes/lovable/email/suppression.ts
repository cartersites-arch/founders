import { createClient } from "@supabase/supabase-js";
import { EmailitVerifyError, verifyEmailitWebhook } from "@/integrations/emailit/verify";
import { createFileRoute } from "@tanstack/react-router";

type SuppressionReason = "bounce" | "complaint" | "unsubscribe";

// Emailit webhook event envelope
// (https://emailit.com/docs/webhooks — type: email.bounced / email.complained / email.suppressed)
interface EmailitWebhookEvent {
  event_id?: string;
  type: string;
  data: {
    object: {
      id?: string;
      to?: string | string[];
      message_id?: string;
      reason?: string;
      bounce_type?: string;
      [key: string]: unknown;
    };
  };
}

// Map Emailit's event type → our internal reason.
function eventTypeToReason(type: string): SuppressionReason | null {
  switch (type) {
    case "email.bounced":
      return "bounce";
    case "email.complained":
      return "complaint";
    case "email.suppressed":
      // Emailit fires email.suppressed for unsubscribes AND repeated bounces.
      // We treat it as unsubscribe; a prior bounce event would already have
      // upserted the row with reason='bounce'.
      return "unsubscribe";
    default:
      return null;
  }
}

function extractRecipient(obj: EmailitWebhookEvent["data"]["object"]): string | null {
  if (typeof obj.to === "string") return obj.to;
  if (Array.isArray(obj.to) && obj.to.length > 0 && typeof obj.to[0] === "string") return obj.to[0];
  return null;
}

function mapReasonToStatus(reason: SuppressionReason): "bounced" | "complained" | "suppressed" {
  switch (reason) {
    case "bounce":
      return "bounced";
    case "complaint":
      return "complained";
    default:
      return "suppressed";
  }
}

function mapReasonToMessage(reason: SuppressionReason): string {
  switch (reason) {
    case "bounce":
      return "Permanent bounce — email address is invalid or rejected";
    case "complaint":
      return "Spam complaint — recipient marked email as spam";
    case "unsubscribe":
      return "Recipient unsubscribed";
  }
}

export const Route = createFileRoute("/lovable/email/suppression")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.EMAILIT_WEBHOOK_SECRET;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
          console.error("Missing required environment variables");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Verify Emailit's HMAC signature, then parse the event envelope.
        let event: EmailitWebhookEvent;
        try {
          const rawBody = await verifyEmailitWebhook(request, webhookSecret);
          event = JSON.parse(rawBody) as EmailitWebhookEvent;
        } catch (error) {
          if (error instanceof Response && error.status === 413) return error;
          if (error instanceof EmailitVerifyError) {
            switch (error.code) {
              case "invalid_signature":
                console.error("Invalid webhook signature");
                return Response.json({ error: "Invalid signature" }, { status: 401 });
              case "stale_timestamp":
                console.error("Stale webhook timestamp");
                return Response.json({ error: "Stale timestamp" }, { status: 401 });
              case "missing_headers":
              case "invalid_timestamp":
                console.error("Invalid webhook headers", { code: error.code });
                return Response.json({ error: "Invalid headers" }, { status: 400 });
            }
          }
          if (error instanceof SyntaxError) {
            console.error("Invalid webhook JSON");
            return Response.json({ error: "Invalid payload" }, { status: 400 });
          }
          console.error("Unexpected error during verification", { error });
          return Response.json({ error: "Internal error" }, { status: 500 });
        }

        // Ignore events we don't handle (delivered, opened, clicked, etc.) —
        // 200 OK so Emailit doesn't retry them.
        const reason = eventTypeToReason(event.type);
        if (!reason) {
          return Response.json({ ignored: true, type: event.type });
        }

        const recipient = extractRecipient(event.data?.object ?? {});
        if (!recipient) {
          console.warn("Suppression event missing recipient", {
            type: event.type,
            event_id: event.event_id,
          });
          return Response.json({ ignored: true, reason: "missing_recipient" });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const normalizedEmail = recipient.toLowerCase();
        const messageId =
          typeof event.data.object.message_id === "string" ? event.data.object.message_id : null;

        // 1. Upsert to suppressed_emails (idempotent — safe for retries)
        const { error: suppressError } = await supabase.from("suppressed_emails").upsert(
          {
            email: normalizedEmail,
            reason,
            metadata: event.data.object as Record<string, unknown>,
          },
          { onConflict: "email" },
        );

        if (suppressError) {
          console.error("Failed to upsert suppressed email", {
            error: suppressError,
            email_redacted: normalizedEmail[0] + "***@" + normalizedEmail.split("@")[1],
          });
          return Response.json({ error: "Failed to write suppression" }, { status: 500 });
        }

        // 2. Append a new log entry for the suppression event (never update existing rows)
        const sendLogStatus = mapReasonToStatus(reason);
        const sendLogMessage = mapReasonToMessage(reason);

        const { error: insertError } = await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "system",
          recipient_email: normalizedEmail,
          status: sendLogStatus,
          error_message: sendLogMessage,
          metadata: event.data.object as Record<string, unknown>,
        });

        if (insertError) {
          // Non-fatal — log and continue. The suppression was already recorded.
          console.warn("Failed to insert email_send_log", {
            error: insertError,
          });
        }

        console.log("Suppression processed", {
          email_redacted: normalizedEmail[0] + "***@" + normalizedEmail.split("@")[1],
          reason,
          type: event.type,
          event_id: event.event_id,
          has_message_id: !!messageId,
        });

        return Response.json({ success: true });
      },
    },
  },
});
