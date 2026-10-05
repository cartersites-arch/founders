export async function readLimitedBytes(request: Request | Response, maximum = 65536): Promise<Uint8Array<ArrayBuffer>> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  let bytes = new Uint8Array(Math.min(4096, maximum));
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const nextSize = size + value.byteLength;
      if (nextSize > maximum) {
        void reader.cancel().catch(() => {});
        throw new Response("Request too large", { status: 413 });
      }
      if (nextSize > bytes.byteLength) {
        const grown = new Uint8Array(Math.min(maximum, Math.max(nextSize, bytes.byteLength * 2)));
        grown.set(bytes);
        bytes = grown;
      }
      bytes.set(value, size);
      size = nextSize;
    }
  } finally {
    reader.releaseLock();
  }
  // A bounded contiguous buffer also prevents many tiny chunks from creating
  // an unbounded array of chunk objects before the byte limit is reached.
  return bytes.slice(0, size);
}

export async function readLimitedText(request: Request | Response, maximum = 65536): Promise<string> {
  return new TextDecoder().decode(await readLimitedBytes(request, maximum));
}

export async function readLimitedJson(request: Request | Response, maximum = 65536): Promise<unknown> {
  const text = await readLimitedText(request, maximum);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Response("Invalid JSON", { status: 400 });
  }
}
