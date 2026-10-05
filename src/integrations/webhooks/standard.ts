import { readLimitedText } from "../../lib/limited-json";
/**
 * Verify an inbound webhook signed per the Standard Webhooks spec
 * (https://www.standardwebhooks.com/). Used by Supabase Auth Hooks.
 *
 * Headers:
 *   - `webhook-id`: idempotency key (UUID-ish)
 *   - `webhook-timestamp`: Unix seconds
 *   - `webhook-signature`: one or more space-separated `v1,<base64-sig>` values
 *
 * Algorithm:
 *   to_sign = `${webhook_id}.${webhook_timestamp}.${rawBody}`
 *   sig = base64(HMAC-SHA256(secret_bytes, to_sign))
 *
 * Secret format from Supabase: `v1,whsec_<base64_secret>`. The `<base64_secret>`
 * decodes to the raw HMAC key bytes.
 *
 * Replaces `verifyWebhookRequest` from @lovable.dev/webhooks-js for the
 * Supabase Auth send-email hook.
 */

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export class StandardWebhookError extends Error {
  readonly code:
    | "missing_headers"
    | "invalid_timestamp"
    | "stale_timestamp"
    | "invalid_signature"
    | "invalid_secret";

  constructor(code: StandardWebhookError["code"], message: string) {
    super(message);
    this.name = "StandardWebhookError";
    this.code = code;
  }
}

export interface StandardWebhookOptions {
  /** Max clock skew. Default 5 minutes. Pass `null` to disable replay protection. */
  toleranceMs?: number | null;
}

/**
 * Verify the request and return the raw body string.
 *
 * Throws StandardWebhookError on any verification failure.
 */
export async function verifyStandardWebhook(
  request: Request,
  secret: string,
  opts: StandardWebhookOptions = {},
): Promise<string> {
  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const sigHeader = request.headers.get("webhook-signature");

  if (!id || !timestamp || !sigHeader) {
    throw new StandardWebhookError(
      "missing_headers",
      "Missing webhook-id, webhook-timestamp, or webhook-signature",
    );
  }

  const tsNum = parseInt(timestamp, 10);
  if (!Number.isFinite(tsNum)) {
    throw new StandardWebhookError("invalid_timestamp", `Invalid timestamp: ${timestamp}`);
  }

  const tolerance = opts.toleranceMs === undefined ? FIVE_MINUTES_MS : opts.toleranceMs;
  if (tolerance != null) {
    const skewMs = Math.abs(Date.now() - tsNum * 1000);
    if (skewMs > tolerance) {
      throw new StandardWebhookError(
        "stale_timestamp",
        `Timestamp ${timestamp} is outside tolerance (${skewMs}ms > ${tolerance}ms)`,
      );
    }
  }

  // Strip Supabase's `v1,whsec_` prefix if present, leaving raw base64 secret.
  const cleanedSecret = secret.replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
  let secretBytes: Uint8Array;
  try {
    secretBytes = base64ToBytes(cleanedSecret);
  } catch (e) {
    throw new StandardWebhookError("invalid_secret", "Could not base64-decode webhook secret");
  }

  const rawBody = await readLimitedText(request, 1024 * 1024);
  const expectedSig = await hmacSha256Base64(secretBytes, `${id}.${timestamp}.${rawBody}`);

  // Header may contain multiple space-separated signatures (key rotation).
  // Compare against any. Each is in the form `v1,<base64>`.
  const provided = sigHeader
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);
  const matched = provided.some((entry) => {
    const idx = entry.indexOf(",");
    if (idx < 0) return false;
    const version = entry.slice(0, idx);
    const value = entry.slice(idx + 1);
    if (version !== "v1") return false;
    return timingSafeEqualString(value, expectedSig);
  });

  if (!matched) {
    throw new StandardWebhookError("invalid_signature", "No signature matched");
  }

  return rawBody;
}

function base64ToBytes(b64: string): Uint8Array {
  // atob is available in modern Node (>=18) and in Cloudflare Workers.
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function hmacSha256Base64(secretBytes: Uint8Array, data: string): Promise<string> {
  // Web Crypto on Workers/Node 18+ expects a BufferSource; the explicit
  // .buffer slice avoids the SharedArrayBuffer/ArrayBuffer type mismatch
  // some TS configs flag for raw Uint8Array.
  const keyData = secretBytes.buffer.slice(
    secretBytes.byteOffset,
    secretBytes.byteOffset + secretBytes.byteLength,
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToBase64(new Uint8Array(sig));
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
