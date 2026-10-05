/** Bound privileged Edge Function input without trusting Content-Length. */
export async function readBoundedJson(request: Request, maximum = 1024 * 1024): Promise<any> {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const bytes = new Uint8Array(maximum);
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > maximum) {
        void reader.cancel().catch(() => {});
        throw new Response("Request too large", { status: 413 });
      }
      bytes.set(value, size);
      size += value.byteLength;
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder().decode(bytes.subarray(0, size))); }
  catch { throw new Response("Invalid JSON", { status: 400 }); }
}
