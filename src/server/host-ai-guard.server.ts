import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest, setResponseStatus } from "@tanstack/react-start/server";
import { validateSubmissionOrigin } from "@/lib/submission-limiter";

export async function guardHostAi(userId: string): Promise<void> {
  if (!validateSubmissionOrigin(getRequest())) {
    setResponseStatus(403);
    throw new Error("Forbidden");
  }
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest(
    "SHA-256", new TextEncoder().encode(userId))), value => value.toString(16).padStart(2,"0")).join("");
  const { data, error } = await (supabaseAdmin as any).rpc("consume_submission_limits", {
    _scope: "host-ai", _client_hash: hash, _recipient_hash: hash,
  });
  if (error) {
    setResponseStatus(503);
    throw new Error("AI usage protection unavailable");
  }
  if (data !== true) {
    setResponseStatus(429);
    throw new Error("AI tool limit reached: five attempts per minute and twenty per day. Try again later.");
  }
}
