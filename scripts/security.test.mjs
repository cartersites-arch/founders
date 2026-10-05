import test from "node:test";
import assert from "node:assert/strict";
import { renderSafeMarkdown } from "../src/lib/safe-content.ts";
import { serializeScriptJson } from "../src/lib/script-json.ts";
import { cspNonceForRequest } from "../src/lib/csp-nonce.ts";
import { normalizeWorkspaceHost, resolveWorkspaceHost } from "../src/lib/verified-host.ts";
import { createMaintenanceHandlers } from "../src/server/maintenance-handlers.ts";
import {
  createSubmissionLimiter,
  validateSubmissionOrigin,
} from "../src/lib/submission-limiter.ts";
import { readLimitedJson } from "../src/lib/limited-json.ts";

const secret = "fixture-only-maintenance-token-not-a-real-credential";
function request(method = "POST", token = secret) {
  return new Request("http://localhost/hooks", {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test("customer HTML cannot inject scripts, handlers, unsafe links or embedded documents", () => {
  const html = renderSafeMarkdown(`# Safe heading
<script>alert(1)</script><img src=x onerror=alert(2)><iframe srcdoc='<script>alert(3)</script>'></iframe><svg onload=alert(4)></svg>
<a href="javascript:alert(5)" onclick="alert(6)">bad link</a><a href="//evil.test">relative protocol</a>
[encoded attack](javascript&#58;alert(7))
[valid link](https://example.test/path)
**bold** and *emphasis*
`);
  assert.doesNotMatch(
    html,
    /<script|<img|<iframe|<svg|onerror|onclick|onload|javascript:|href="\/\//i,
  );
  assert.match(html, /<h1>Safe heading<\/h1>/);
  assert.match(html, /href="https:\/\/example.test\/path"/);
  assert.match(html, /<strong>bold<\/strong>/);
});
test("JSON LD cannot close its enclosing script", () => {
  const payload = { name: "</script><script>alert(1)</script>&\u2028" };
  const encoded = serializeScriptJson(payload);
  assert.doesNotMatch(encoded, /<|>|&|\u2028/);
  assert.deepEqual(JSON.parse(encoded), payload);
});
test("CSP nonces are stable for one request and distinct across requests", () => {
  const a = request("GET");
  const nonce = cspNonceForRequest(a);
  assert.match(nonce, /^[A-Za-z0-9+/]{32}$/);
  assert.equal(nonce, cspNonceForRequest(a));
  assert.notEqual(nonce, cspNonceForRequest(request("GET")));
});
test("only authenticated proxy headers select a forwarded workspace", async () => {
  const headers = new Headers({ host: "localhost:8080", "x-forwarded-host": "customer.example" });
  assert.equal(await resolveWorkspaceHost(headers, secret), null);
  headers.set("x-founders-proxy-token", "wrong");
  assert.equal(await resolveWorkspaceHost(headers, secret), null);
  headers.set("x-founders-proxy-token", secret);
  assert.equal(await resolveWorkspaceHost(headers, secret), "customer.example");
  headers.set("x-forwarded-host", "customer.example,attacker.example");
  assert.equal(await resolveWorkspaceHost(headers, secret), null);
  assert.equal(normalizeWorkspaceHost("www.customer.example:443"), "customer.example");
  for (const invalid of [
    "user@customer.example",
    "customer.example/path",
    "customer.example?x=1",
    "customer.example#fragment",
    " customer.example",
  ])
    assert.equal(normalizeWorkspaceHost(invalid), null);
});
test("maintenance auth rejects GET, missing secrets and forged credentials before side effects", async () => {
  let calls = 0;
  const action = async () => {
    calls++;
    return Response.json({ ok: true });
  };
  const hooks = createMaintenanceHandlers(action, { secret: () => secret });
  assert.equal((await hooks.GET()).status, 405);
  assert.equal((await hooks.POST({ request: request("POST", null) })).status, 401);
  assert.equal((await hooks.POST({ request: request("POST", "bad") })).status, 401);
  const unset = createMaintenanceHandlers(action, { secret: () => undefined });
  assert.equal((await unset.POST({ request: request() })).status, 503);
  assert.equal(calls, 0);
  const response = await hooks.POST({ request: request() });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls, 1);
});
test("maintenance blocks concurrent work, enforces cooldown and releases failed jobs", async () => {
  let time = 1,
    release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const hooks = createMaintenanceHandlers(
    async () => {
      await pending;
      return new Response("ok");
    },
    { secret: () => secret, now: () => time },
  );
  const first = hooks.POST({ request: request() });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal((await hooks.POST({ request: request() })).status, 429);
  release();
  assert.equal((await first).status, 200);
  assert.equal((await hooks.POST({ request: request() })).status, 429);
  time += 30_000;
  assert.equal((await hooks.POST({ request: request() })).status, 200);
  const failed = createMaintenanceHandlers(
    async () => {
      throw new Error("secret internal detail");
    },
    { secret: () => secret, now: () => time },
  );
  assert.equal(
    await (await failed.POST({ request: request() })).text(),
    "Maintenance operation failed",
  );
  time += 30_000;
  assert.equal((await failed.POST({ request: request() })).status, 500);
});
test("submission counters bound memory, reject bursts and expire", () => {
  let time = 0;
  const consume = createSubmissionLimiter(() => time, 2);
  assert.equal(consume("client-a", 2, 1000), true);
  assert.equal(consume("client-a", 2, 1000), true);
  assert.equal(consume("client-a", 2, 1000), false);
  assert.equal(consume("client-b", 2, 1000), true);
  assert.equal(consume("client-c", 2, 1000), false);
  time = 1000;
  assert.equal(consume("client-c", 2, 1000), true);
});
test("cross-origin submissions are rejected", () => {
  assert.equal(
    validateSubmissionOrigin(
      new Request("https://own.example/form", { headers: { origin: "https://attacker.example" } }),
    ),
    false,
  );
  assert.equal(
    validateSubmissionOrigin(
      new Request("https://own.example/form", { headers: { origin: "https://own.example" } }),
    ),
    true,
  );
});
test("request JSON is bounded by actual streamed bytes", async () => {
  const valid = new Request("http://localhost", { method: "POST", body: '{"limit":1}' });
  assert.deepEqual(await readLimitedJson(valid), { limit: 1 });
  await assert.rejects(
    () => readLimitedJson(new Request("http://localhost", { method: "POST", body: "{" })),
    (error) => error instanceof Response && error.status === 400,
  );
  await assert.rejects(
    () =>
      readLimitedJson(
        new Request("http://localhost", { method: "POST", body: "x".repeat(20) }),
        10,
      ),
    (error) => error instanceof Response && error.status === 413,
  );
});
