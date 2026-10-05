import { readLimitedBytes } from "./limited-json.ts";

// Run before TanStack deserializes a server-function body, including multipart.
// Streamed bytes are authoritative; Content-Length alone is not sufficient.
export async function boundServerFunctionRequest(request: Request): Promise<Request> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith("/_serverFn/") || !request.body) return request;
  const maximum = 1024 * 1024;
  if (Number(request.headers.get("content-length")) > maximum) {
    throw new Response("Request too large", { status: 413 });
  }
  try {
    // The framework retains the original request and its Cloudflare metadata.
    // Pre-read only a bounded clone before allowing framework deserialization.
    await readLimitedBytes(request.clone(), maximum);
  } catch (error) {
    // Cancel both tee branches when rejected. Canceling only the clone would
    // wait for the unconsumed original and stall the size-limit response.
    void request.body.cancel().catch(() => {});
    throw error;
  }
  return request;
}
