import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";
import { createSubmissionLimiter, validateSubmissionOrigin } from "@/lib/submission-limiter";

const consume = createSubmissionLimiter();

export async function guardPublicSubmission(scope: string, email?: string): Promise<void> {
  const request = getRequest();
  if (!validateSubmissionOrigin(request)) throw new Response("Forbidden", { status: 403 });
  // Trust Cloudflare's client header only when the runtime supplies CF metadata.
  // Never trust arbitrary X-Forwarded-For headers.
  const hasCloudflareContext = Boolean((request as Request & { cf?: unknown }).cf);
  const client = hasCloudflareContext ? request.headers.get("cf-connecting-ip") : null;
  const identity = client ?? "unverified-local-client";
  const minute = 60_000;
  let allowed =
    consume("all-submissions", 60, minute) && consume(`${scope}:client:${identity}`, 5, minute);
  if (allowed && email) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(email.trim().toLowerCase()),
    );
    const key = Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join("");
    allowed = consume(`${scope}:recipient:${key}`, 3, 60 * minute);
  }
  if (allowed) {
    const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest(
      "SHA-256", new TextEncoder().encode(value))), value => value.toString(16).padStart(2, "0")).join("");
    const { data, error } = await (supabaseAdmin as any).rpc("consume_submission_limits", {
      _scope: scope,
      _client_hash: await hash(identity),
      _recipient_hash: email ? await hash(email.trim().toLowerCase()) : null,
    });
    // Missing migration or database outages must never bypass the shared guard.
    if (error) throw new Response("Submission protection unavailable", { status: 503 });
    allowed = data === true;
  }
  if (!allowed)
    throw new Response("Too many submissions", { status: 429, headers: { "Retry-After": "60" } });
}
