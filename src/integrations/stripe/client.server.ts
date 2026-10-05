import { isLocalIsolation } from "@/lib/isolation-policy";
// ─────────────────────────────────────────────────────────────────────────────
// Server-only Stripe client.
//
// Lazy-initialized so the module is importable in environments where
// STRIPE_SECRET_KEY isn't set (e.g. CI typecheck). Throws on first use if the
// key is missing.
// ─────────────────────────────────────────────────────────────────────────────
import Stripe from "stripe";

let _stripe: Stripe | undefined;

function buildStripe(): Stripe {
  if (isLocalIsolation()) {
    throw new Error("Billing is disabled in isolated local testing.");
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env (and `wrangler secret put STRIPE_SECRET_KEY` for prod).",
    );
  }
  return new Stripe(key, {
    // Stripe SDK is forward-compatible — pin to the version we develop
    // against, then bump deliberately.
    apiVersion: "2025-09-30.clover" as Stripe.LatestApiVersion,
    appInfo: {
      name: "founders.click",
      url: "https://founders.click",
    },
  });
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop, receiver) {
    if (!_stripe) _stripe = buildStripe();
    return Reflect.get(_stripe, prop, receiver);
  },
});

export const STRIPE_WEBHOOK_SECRET_ENV = "STRIPE_WEBHOOK_SECRET";

export function getWebhookSecret(): string {
  const secret = process.env[STRIPE_WEBHOOK_SECRET_ENV];
  if (!secret) {
    throw new Error(
      `${STRIPE_WEBHOOK_SECRET_ENV} is not set. Get it from Stripe Dashboard → Developers → Webhooks.`,
    );
  }
  return secret;
}
