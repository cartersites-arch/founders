import { createRequire } from "node:module";
const require = createRequire(
  process.env.PROOF_PLAYWRIGHT_PACKAGE || "/tmp/founders-proof-browser/package.json",
);
const { chromium } = require("playwright");
import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
assert.equal(
  new URL(process.env.SUPABASE_URL).hostname,
  "vpewpybdvtnhwxhzyubc.supabase.co",
  "Development Supabase project required",
);
const session = JSON.parse(
  fs.readFileSync(
    process.env.PROOF_SESSION_FILE || "/tmp/founders-proof-browser/session.json",
    "utf8",
  ),
);
const base = process.env.PROOF_BASE_URL || "http://localhost:8082";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Local proof URL required");
const out = new URL("../docs/ai-generation-proof/", import.meta.url).pathname.replace(/\/$/, "");
const workspace = "0944aa62-2f20-4937-9cea-e5c06992f7bc";
const host = "founders-dev-preview.cartersites.workers.dev";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
await context.addInitScript(
  ({ session }) =>
    localStorage.setItem("sb-vpewpybdvtnhwxhzyubc-auth-token", JSON.stringify(session)),
  { session },
);
await context.route(base + "/**", (route) =>
  route.continue({
    headers: {
      ...route.request().headers(),
      authorization: "Bearer " + session.access_token,
      "x-forwarded-host": host,
    },
  }),
);
await context.route("https://vpewpybdvtnhwxhzyubc.supabase.co/**", async (route) => {
  try {
    const request = route.request();
    const response = await fetch(request.url(), {
      method: request.method(),
      headers: request.headers(),
      body: request.postData() || undefined,
    });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: Buffer.from(await response.arrayBuffer()),
    });
  } catch {
    await route.abort();
  }
});
const publicContext = await browser.newContext({
  viewport: { width: 1280, height: 1000 },
  extraHTTPHeaders: {},
});
const evidence = {
  started_at: new Date().toISOString(),
  base,
  workspace,
  forwarded_host: host,
  authenticated_ui:
    "Existing development proof owner; session supplied to browser and same-origin requests",
  public_render:
    "Fresh browser context without authentication, with preview workspace forwarded host",
  runs: [],
};
const cases = [
  [
    "AI Proof Weekend Pool Pricing October 2026 Complete",
    "Explain weekend pool rental pricing to new marketplace hosts. Give concrete examples of hourly rates, minimum bookings, peak hours, cleaning costs, and how to test prices.",
    "openrouter/free",
  ],
  [
    "AI Proof Guest Arrival Checklist October 2026 Complete",
    "Write a practical guest arrival checklist for private pool hosts covering directions, parking, check-in, safety orientation, amenities, and checkout. Include a sample guest message.",
    "openrouter/free",
  ],
  [
    "AI Proof Family Pool Party Planning October 2026 Complete",
    "Help families plan a pool party with a realistic budget, headcount, shade, food, supervision, weather alternatives, and a timeline. Avoid unsupported insurance or safety guarantees.",
    "openrouter/free",
  ],
];
try {
  const page = await context.newPage();
  for (let i = 0; i < cases.length; i++) {
    const [title, topic, model] = cases[i];
    await page.goto(base + "/app/pages/new", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Generate & publish page" }).waitFor();
    await page.waitForTimeout(2000);
    await page.locator('input[type="text"]').nth(0).fill(title);
    await page
      .locator('input[type="text"]')
      .nth(1)
      .fill("Live AI generation and persistence proof in the development workspace.");
    await page.locator("textarea").fill(topic);
    await page.locator("select").selectOption(model);
    await page.screenshot({ path: out + `/generation-${i + 1}-input.png`, fullPage: true });
    console.log("Generating", i + 1, model);
    await page.getByRole("button", { name: "Generate & publish page" }).click();
    await Promise.race([
      page.getByText(/Published —/).waitFor({ timeout: 240000 }),
      page
        .getByText("AI credits exhausted.", { exact: true })
        .waitFor({ timeout: 240000 })
        .then(() => {
          throw new Error("AI credits exhausted.");
        }),
    ]);
    const link = page.getByRole("link", { name: "View page →" });
    const path = await link.getAttribute("href");
    assert(path?.startsWith("/p/"));
    const resultText = (await page.locator("body").innerText()).match(/Published —[^\n]+/)?.[0];
    await page.screenshot({ path: out + `/generation-${i + 1}-published.png`, fullPage: true });
    const query =
      process.env.SUPABASE_URL.replace(/\/$/, "") +
      "/rest/v1/content_pages?select=id,workspace_id,title,url_path,slug,status,body_markdown,seo_title,seo_description,created_at,updated_at&workspace_id=eq." +
      workspace +
      "&url_path=eq." +
      encodeURIComponent(path);
    const read = async () => {
      const r = await fetch(query, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
      });
      assert.equal(r.status, 200);
      const rows = await r.json();
      assert.equal(rows.length, 1);
      return rows[0];
    };
    const row = await read();
    assert.equal(row.workspace_id, workspace);
    assert.equal(row.status, "published");
    assert(row.body_markdown.length > 300);
    const hash = crypto.createHash("sha256").update(row.body_markdown).digest("hex");
    fs.writeFileSync(
      out + `/generation-${i + 1}-database.json`,
      JSON.stringify({ ...row, body_sha256: hash }, null, 2),
    );
    const publicPage = await publicContext.newPage();
    const response = await publicPage.goto(base + path, { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200);
    await publicPage.locator("article").waitFor();
    assert.equal(await publicPage.locator("main > h1").innerText(), row.title);
    assert((await publicPage.locator("article").innerText()).length > 300);
    const html = await publicPage.locator("article").innerHTML();
    assert(/<h2[\s>]/.test(html));
    assert(/<p[\s>]/.test(html));
    fs.writeFileSync(out + `/generation-${i + 1}-rendered.html`, html);
    await publicPage.screenshot({
      path: out + `/generation-${i + 1}-rendered.png`,
      fullPage: true,
    });
    const before = await publicPage.locator("article").innerText();
    const reload = await publicPage.reload({ waitUntil: "domcontentloaded" });
    assert.equal(reload.status(), 200);
    assert.equal(await publicPage.locator("article").innerText(), before);
    const rowAfter = await read();
    assert.equal(crypto.createHash("sha256").update(rowAfter.body_markdown).digest("hex"), hash);
    await publicPage.screenshot({ path: out + `/generation-${i + 1}-reload.png`, fullPage: true });
    let previewStatus;
    try {
      previewStatus = (await fetch("https://" + host + path)).status;
    } catch (e) {
      previewStatus = e.message;
    }
    const run = {
      title,
      requested_model: model,
      path,
      id: row.id,
      body_sha256: hash,
      words: row.body_markdown.split(/\s+/).length,
      resultText,
      database_persisted: true,
      render_status: response.status(),
      render_h1: row.title,
      rendered_h2_count: await publicPage.locator("article h2").count(),
      reload_status: reload.status(),
      reload_identical: true,
      post_reload_database_identical: true,
      public_preview_status: previewStatus,
    };
    evidence.runs.push(run);
    fs.writeFileSync(out + "/results.json", JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(run));
    await publicPage.close();
  }
} catch (e) {
  evidence.error = e.message;
  fs.writeFileSync(out + "/results.json", JSON.stringify(evidence, null, 2));
  console.error("PROOF FAILED", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
