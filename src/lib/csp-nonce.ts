const nonces = new WeakMap<Request, string>();

export function cspNonceForRequest(request: Request): string {
  let nonce = nonces.get(request);
  if (!nonce) {
    nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
    nonces.set(request, nonce);
  }
  return nonce;
}
