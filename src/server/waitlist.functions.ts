import { guardPublicSubmission } from "./submission-guard.server";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTransactionalEmailServer } from "./transactional-email.server";

const schema = z.object({
  email: z.string().trim().email().max(255),
  nearestMiles: z.number().finite().min(0).max(25000).nullable().optional(),
  city: z.string().trim().min(1).max(120).nullable().optional(),
  region: z.string().trim().min(1).max(20).nullable().optional(),
});

export const joinPoolWaitlist = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    await guardPublicSubmission("waitlist", data.email);
    let city: string | null = null;
    let region: string | null = null;
    let latitude: number | null = null;
    let longitude: number | null = null;
    let userAgent: string | null = null;
    try {
      const req = getRequest() as Request & {
        cf?: { city?: string; region?: string; latitude?: string; longitude?: string };
      };
      const cf = req.cf ?? {};
      city = data.city ?? cf.city ?? null;
      region = data.region ?? cf.region ?? null;
      latitude = cf.latitude ? Number(cf.latitude) : null;
      longitude = cf.longitude ? Number(cf.longitude) : null;
      userAgent = getRequestHeader("user-agent") ?? null;
    } catch {
      // best-effort context capture
    }

    const { error } = await (supabaseAdmin as any).from("pool_waitlist").insert({
      email: data.email.toLowerCase(),
      city,
      region,
      latitude,
      longitude,
      nearest_miles: data.nearestMiles ?? null,
      user_agent: userAgent,
    });
    if (error) {
      console.error("joinPoolWaitlist insert failed:", error);
      throw new Error("Could not save your email. Please try again.");
    }

    // Fire-and-forget confirmation email; never block the user response on it.
    try {
      await sendTransactionalEmailServer({
        templateName: "pool-waitlist-confirmation",
        recipientEmail: data.email,
        idempotencyKey: `pool-waitlist-${data.email.toLowerCase()}`,
        templateData: {
          city: data.city ?? city,
          region: data.region ?? region,
          nearestMiles: data.nearestMiles ?? null,
        },
      });
    } catch (emailErr) {
      console.error("waitlist confirmation email failed:", emailErr);
    }

    // Internal notification to the team.
    try {
      await sendTransactionalEmailServer({
        templateName: "internal-lead-notification",
        recipientEmail: "hello@poolrentalnearme.com",
        idempotencyKey: `waitlist-notify-${data.email.toLowerCase()}-${Date.now()}`,
        templateData: {
          formType: "Pool waitlist signup",
          submitterEmail: data.email,
          city: data.city ?? city,
          region: data.region ?? region,
          nearestMiles: data.nearestMiles ?? null,
        },
      });
    } catch (notifyErr) {
      console.error("waitlist internal notification failed:", notifyErr);
    }

    return { ok: true };
  });
