import { readLimitedText } from "@/lib/limited-json";
import { createFileRoute } from "@tanstack/react-router";
import type Stripe from "stripe";
import { stripe, getWebhookSecret } from "@/integrations/stripe/client.server";
import { handleStripeWebhookEvent } from "@/server/billing.functions";

// Stripe webhook receiver. Stripe POSTs the raw body + a signature header;
// we verify the signature, parse the event, then hand off to billing logic.
//
// Configure in Stripe Dashboard → Developers → Webhooks pointing at
// https://founders.click/api/billing/webhook (and your staging URL).
// Listen for: checkout.session.completed, customer.subscription.*,
// invoice.payment_failed, invoice.paid.
export const Route = createFileRoute("/api/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        if (!sig) {
          return new Response("Missing stripe-signature header", { status: 400 });
        }

        let secret: string;
        try {
          secret = getWebhookSecret();
        } catch (e) {
          console.error("[stripe webhook] secret not configured:", e);
          return new Response("Webhook not configured", { status: 503 });
        }

        let body: string;
        try { body = await readLimitedText(request, 1024 * 1024); } catch (error) {
          if (error instanceof Response) return error;
          return new Response("Invalid request", { status: 400 });
        }
        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, secret);
        } catch (e: any) {
          console.warn("[stripe webhook] signature verification failed:", e?.message);
          return new Response("Invalid signature", {
            status: 400,
          });
        }

        try {
          const result = await handleStripeWebhookEvent(event);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e: any) {
          console.error(`[stripe webhook] handler error for ${event.type}:`, e);
          // 500 makes Stripe retry — preferable to silent failure.
          return new Response("Webhook processing failed", {
            status: 500,
          });
        }
      },
    },
  },
});
