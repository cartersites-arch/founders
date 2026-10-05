import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type Stripe from "stripe";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { stripe } from "@/integrations/stripe/client.server";
import { PLAN_FEATURES, type Plan } from "@/lib/plans";
import { SITE_URL } from "@/lib/seo";

// ─────────────────────────────────────────────────────────────────────────────
// Billing server functions: checkout session, customer portal, webhook
// reconciliation. Stripe price IDs live in env vars (stubs in .env.example);
// the price-id <-> plan mapping is computed server-side at request time.
// ─────────────────────────────────────────────────────────────────────────────

const PUBLIC_PLANS: Plan[] = ["starter", "growth", "scale"];

function priceIdForPlan(plan: Plan): string {
  const envVar = PLAN_FEATURES[plan].stripePriceEnvVar;
  if (!envVar) {
    throw new Error(`Plan "${plan}" is not self-serve.`);
  }
  const id = process.env[envVar];
  if (!id) {
    throw new Error(
      `Stripe price env var ${envVar} is not set. Add it to .env or wrangler secrets.`,
    );
  }
  return id;
}

/** Inverse lookup: Stripe price ID -> plan. Used by the webhook. */
export function planForPriceId(priceId: string): Plan | null {
  for (const plan of ["starter", "growth", "scale"] as const) {
    const envVar = PLAN_FEATURES[plan].stripePriceEnvVar;
    if (!envVar) continue;
    if (process.env[envVar] === priceId) return plan;
  }
  return null;
}

const _CheckoutInput = z.object({
  plan: z.enum(["starter", "growth", "scale"]),
  workspaceId: z.string().uuid().optional(),
  // Set when the user is just landing from the marketing page and we need to
  // create a workspace before checkout.
  marketplaceName: z.string().min(1).max(120).optional(),
  marketplaceDomain: z
    .string()
    .max(253)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Use a valid hostname like example.com")
    .optional(),
});

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => _CheckoutInput.parse(d))
  .handler(async ({ context, data }) => {
    const { userId, claims } = context as { userId: string; claims: any };
    const sb = supabaseAdmin as any;
    const email: string | undefined = claims?.email;

    // Find or create the workspace for this checkout.
    let workspaceId = data.workspaceId;
    if (!workspaceId) {
      // Try to find an existing workspace this user owns.
      const { data: owned } = await sb
        .from("workspaces")
        .select("id")
        .eq("owner_user_id", userId)
        .limit(1);
      workspaceId = owned?.[0]?.id;
    }

    if (!workspaceId) {
      // First-time onboarding: create a draft workspace. Marketplace name +
      // domain are required at this point (collected on /onboarding).
      if (!data.marketplaceName) {
        throw new Error("Marketplace name required to start checkout. Complete onboarding first.");
      }
      // Slug collision: workspaces.slug is UNIQUE. Two customers naming
      // theirs "Pool Rental" would clash, so we retry up to 50 times with
      // numeric suffixes.
      const baseSlug = slugify(data.marketplaceName) || "workspace";
      let slug = baseSlug;
      let attempt = 1;
      let created: { id: string } | null = null;
      let lastErr: { code?: string; message?: string } | null = null;
      while (attempt <= 50) {
        const { data: c, error } = await sb
          .from("workspaces")
          .insert({
            slug,
            name: data.marketplaceName,
            marketplace_domain: data.marketplaceDomain ?? null,
            owner_user_id: userId,
            plan: data.plan,
            subscription_status: "incomplete",
          })
          .select("id")
          .single();
        if (!error && c) {
          created = c;
          break;
        }
        lastErr = error as { code?: string; message?: string };
        // Postgres unique_violation = 23505. Disambiguate which constraint
        // failed by inspecting the message text; the marketplace_domain
        // collision is a user-facing problem, the slug collision is internal.
        const msg = (error?.message || "").toLowerCase();
        if (error?.code !== "23505") break;
        if (msg.includes("marketplace_domain")) {
          throw new Error(
            "That marketplace domain is already in use. Use a different domain or contact support if you own it.",
          );
        }
        if (msg.includes("workspaces_slug_key") || msg.includes("slug")) {
          attempt += 1;
          slug = `${baseSlug}-${attempt}`;
          continue;
        }
        break;
      }
      if (!created) {
        throw new Error(lastErr?.message || "Could not create workspace.");
      }
      workspaceId = created.id;

      await sb.from("workspace_members").insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: "owner",
      });
    } else {
      // Membership check: only owners can start checkout.
      const { data: m } = await sb
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!m || m.role !== "owner") {
        throw new Error("Only the workspace owner can change billing.");
      }
    }

    // Look up the workspace's existing Stripe customer (if any).
    const { data: ws } = await sb
      .from("workspaces")
      .select("id, name, stripe_customer_id, marketplace_domain")
      .eq("id", workspaceId)
      .single();

    let stripeCustomerId: string | undefined = ws?.stripe_customer_id ?? undefined;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        name: ws?.name,
        metadata: {
          workspace_id: workspaceId!,
          owner_user_id: userId,
          marketplace_domain: ws?.marketplace_domain ?? "",
        },
      });
      stripeCustomerId = customer.id;
      await sb
        .from("workspaces")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", workspaceId);
    }

    const priceId = priceIdForPlan(data.plan);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/app/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/onboarding?plan=${data.plan}`,
      subscription_data: {
        // 14-day free trial, no card required (matches landing FAQ).
        trial_period_days: 14,
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: {
          workspace_id: workspaceId!,
          plan: data.plan,
        },
      },
      metadata: {
        workspace_id: workspaceId!,
        plan: data.plan,
      },
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }
    return { url: session.url };
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as { userId: string };
    const sb = supabaseAdmin as any;

    const { data: rows } = await sb
      .from("workspace_members")
      .select("role, workspaces!inner(id, stripe_customer_id)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (!row || row.role !== "owner") {
      throw new Error("Only the workspace owner can manage billing.");
    }
    const customerId = row.workspaces.stripe_customer_id;
    if (!customerId) {
      throw new Error("No Stripe customer for this workspace yet.");
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${SITE_URL}/account/billing`,
    });
    return { url: portal.url };
  });

export const listSelfServePlans = createServerFn({ method: "GET" }).handler(async () => {
  return PUBLIC_PLANS.map((plan) => ({
    plan,
    name: PLAN_FEATURES[plan].name,
    monthlyUsdCents: PLAN_FEATURES[plan].monthlyUsdCents,
    blurb: PLAN_FEATURES[plan].blurb,
  }));
});

// ─── Webhook handler ────────────────────────────────────────────────────────

export type WebhookResult = { received: true; ignored?: boolean; error?: string };

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<WebhookResult> {
  const sb = supabaseAdmin as any;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = (session.metadata?.workspace_id as string | undefined) ?? null;
      if (!workspaceId) return { received: true, ignored: true };
      // The actual subscription state will be picked up by
      // customer.subscription.created — here we just make sure the workspace
      // knows its Stripe customer.
      if (session.customer && typeof session.customer === "string") {
        const { data: rows, error } = await sb
          .from("workspaces")
          .update({ stripe_customer_id: session.customer })
          .eq("id", workspaceId)
          .or(`stripe_customer_id.is.null,stripe_customer_id.eq.${session.customer}`)
          .select("id");
        if (error || !rows?.length) throw new Error("Billing customer update failed");
      }
      return { received: true };
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const notification = event.data.object as Stripe.Subscription;
      const customerId = typeof notification.customer === "string" ? notification.customer : notification.customer.id;
      const workspaceId = notification.metadata?.workspace_id ?? (await resolveWorkspaceByCustomer(customerId));
      if (!workspaceId) return { received: true, ignored: true };
      const { data: existing, error: lookupError } = await sb.from("customer_subscriptions")
        .select("last_event_id,last_event_at").eq("workspace_id", workspaceId).maybeSingle();
      if (lookupError) throw new Error("Billing state lookup failed");
      if (existing?.last_event_id === event.id || (existing?.last_event_at &&
        new Date(existing.last_event_at).getTime() > event.created * 1000)) return { received: true, ignored: true };
      // Notification payloads may be stale, including different events in the same second.
      // Fetch authoritative Stripe state after reading the revision; the RPC checks that
      // revision under a workspace lock before atomically writing both billing tables.
      const sub = await stripe.subscriptions.retrieve(notification.id);
      const currentCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      if (currentCustomerId !== customerId || (sub.metadata?.workspace_id && sub.metadata.workspace_id !== workspaceId))
        throw new Error("Billing subscription identity mismatch");

      const item = sub.items.data[0];
      const priceId = item?.price?.id ?? null;
      const plan = priceId ? planForPriceId(priceId) : null;
      const status = sub.status;
      const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
      const currentPeriodStart = sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null;
      const currentPeriodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;
      const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null;

      const { data: applied, error } = await sb.rpc("apply_stripe_subscription_event", {
        _workspace_id: workspaceId,
        _event_id: event.id,
        _event_at: new Date(event.created * 1000).toISOString(),
        _expected_event_id: existing?.last_event_id ?? null,
        _subscription: {
          stripe_customer_id: currentCustomerId,
          stripe_subscription_id: sub.id,
          allow_subscription_replacement: event.type === "customer.subscription.created",
          stripe_price_id: priceId,
          plan: plan ?? "starter",
          status,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          trial_ends_at: trialEnd,
          canceled_at: canceledAt,
          raw: sub,
        },
      });
      if (error) throw new Error("Billing transaction failed; retry required");
      if (applied !== true) return { received: true, ignored: true };

      return { received: true };
    }

    case "invoice.payment_failed": {
      // Status flip is handled by the customer.subscription.updated event
      // Stripe fires alongside; we log here so failures are visible in worker
      // logs without grepping raw Stripe deliveries. (Dunning email TODO.)
      const inv = event.data.object as Stripe.Invoice;
      console.warn(
        "[billing] invoice.payment_failed",
        JSON.stringify({
          invoiceId: inv.id,
          customer: inv.customer,
          amountDue: inv.amount_due,
          attempt: inv.attempt_count,
        }),
      );
      return { received: true };
    }
    case "invoice.paid": {
      return { received: true };
    }

    default:
      return { received: true, ignored: true };
  }
}

async function resolveWorkspaceByCustomer(customerId: string): Promise<string | null> {
  const sb = supabaseAdmin as any;
  const { data, error } = await sb
    .from("workspaces")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error("Billing workspace lookup failed");
  return data?.id ?? null;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || `workspace-${Date.now()}`
  );
}
