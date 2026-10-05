import { readLimitedText } from "../../lib/limited-json.ts";

/**
 * Verify an inbound webhook from Emailit.
 *
 * Scheme (per Emailit docs):
 *   1. Read headers: `X-Emailit-Signature` (hex) + `X-Emailit-Timestamp` (Unix seconds).
 *   2. Concatenate `${timestamp}.${rawBody}`.
 *   3. HMAC-SHA256 with the signing secret (the secret string includes the
 *      `whsec_` prefix — sign with the full string, not the part after the prefix).
 *   4. Hex-encode the digest.
 *   5. Compare timing-safely against the header.
 *
 * Replaces `verifyWebhookRequest` from @lovable.dev/webhooks-js for the
 * suppression endpoint.
 */

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export class EmailitVerifyError extends Error {
  readonly code: "missing_headers" | "invalid_timestamp" | "stale_timestamp" | "invalid_signature";

  constructor(code: EmailitVerifyError["code"], message: string) {
    super(message);
    this.name = "EmailitVerifyError";
    this.code = code;
  }
}

export interface EmailitVerifyOptions {
  /** Max clock skew. Default 5 minutes. Pass `null` to disable replay protection. */
  toleranceMs?: number | null;
}

/**
 * Verify the request and return the raw body string.
 * Caller should `JSON.parse` the returned body if needed.
 *
 * Throws EmailitVerifyError on any verification failure.
 */
export async function verifyEmailitWebhook(
  request: Request,
  secret: string,
  opts: EmailitVerifyOptions = {},
): Promise<string> {
  const signature = request.headers.get("x-emailit-signature");
  const timestamp = request.headers.get("x-emailit-timestamp");

  if (!signature || !timestamp) {
    throw new EmailitVerifyError(
      "missing_headers",
      "Missing X-Emailit-Signature or X-Emailit-Timestamp",
    );
  }

  const tsNum = Number(timestamp);
  if (!/^\d{1,12}$/.test(timestamp) || !Number.isSafeInteger(tsNum)) {
    throw new EmailitVerifyError("invalid_timestamp", `Invalid timestamp: ${timestamp}`);
  }

  const tolerance = opts.toleranceMs === undefined ? FIVE_MINUTES_MS : opts.toleranceMs;
  if (tolerance != null) {
    const skewMs = Math.abs(Date.now() - tsNum * 1000);
    if (skewMs > tolerance) {
      throw new EmailitVerifyError(
        "stale_timestamp",
        `Timestamp ${timestamp} is outside tolerance (${skewMs}ms > ${tolerance}ms)`,
      );
    }
  }

  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    throw new EmailitVerifyError("invalid_signature", "Invalid signature format");
  }
  const rawBody = await readLimitedText(request, 1024 * 1024);
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);

  if (!timingSafeEqualHex(signature, expected)) {
    throw new EmailitVerifyError("invalid_signature", "Signature mismatch");
  }

  return rawBody;
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Constant-time comparison of two hex strings. Returns false on any length mismatch.
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
