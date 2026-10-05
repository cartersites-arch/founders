import test from "node:test";
import assert from "node:assert/strict";
import {
  assertDevelopmentSupabaseUrl,
  assertAllowedRequest,
  createIsolatedFetch,
} from "../src/lib/isolation-policy.ts";

const dev = "https://vpewpybdvtnhwxhzyubc.supabase.co";
test("only the exact development project is accepted", () => {
  assertDevelopmentSupabaseUrl(dev);
  for (const url of [
    undefined,
    "https://ptfjspcphskifoseidut.supabase.co",
    `${dev}.evil.test`,
    `${dev}/other`,
    "http://vpewpybdvtnhwxhzyubc.supabase.co",
    "https://user:password@vpewpybdvtnhwxhzyubc.supabase.co",
  ]) {
    assert.throws(() => assertDevelopmentSupabaseUrl(url));
  }
});
test("production, external services, RPCs and Edge Functions are blocked before fetch", async () => {
  let calls = 0;
  const guarded = createIsolatedFetch(async () => {
    calls++;
    return new Response("ok");
  });
  for (const url of [
    "https://founders.click",
    "https://api.stripe.com/v1/customers",
    "https://fresh-web.lovable.app/api/public/hooks/competitor-radar-scan",
    `${dev}/rest/v1/rpc/enqueue_email`,
    `${dev}/rest/v1/%72pc/enqueue_email`,
    `${dev}/functions/v1/drive-content-generation`,
    "https://ptfjspcphskifoseidut.supabase.co/rest/v1/workspaces",
  ]) {
    await assert.rejects(() => guarded(url));
  }
  assert.equal(calls, 0);
});
test("development database and local requests disable redirects", async () => {
  let options;
  const guarded = createIsolatedFetch(async (_input, init) => {
    options = init;
    return new Response("ok");
  });
  await guarded(new Request(`${dev}/rest/v1/workspaces`), { redirect: "follow" });
  assert.equal(options.redirect, "error");
  assertAllowedRequest("http://127.0.0.1:8080/");
  assertAllowedRequest(`${dev}/auth/v1/token`);
  assert.throws(() => assertAllowedRequest("http://localhost.evil.test:8080/"));
});

test("browser relative URLs resolve locally and external URLs remain blocked", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { location: { href: "http://127.0.0.1:8080/auth" } };
  try {
    assert.doesNotThrow(() => assertAllowedRequest("/api/public/hooks/competitor-radar-scan"));
    assert.throws(() => assertAllowedRequest("//example.invalid/api"));
    assert.throws(() => assertAllowedRequest("https://example.invalid/api"));
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
