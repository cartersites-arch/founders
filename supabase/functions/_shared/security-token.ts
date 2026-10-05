/** Compare fixed-length digests, never log either credential. */
export async function matchesSecret(
  supplied: string | null,
  expected: string | undefined,
): Promise<boolean> {
  if (!expected || expected.length < 32 || !supplied || supplied.length > 512) return false;
  const encode = new TextEncoder();
  const [a, b] = await Promise.all(
    [supplied, expected].map((value) => crypto.subtle.digest("SHA-256", encode.encode(value))),
  );
  const left = new Uint8Array(a),
    right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i]! ^ right[i]!;
  return difference === 0;
}
