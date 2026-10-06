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
const out = new URL("../docs/ai-generation-proof/", import.meta.url).pathname.replace(/\/$/, "");
const results = JSON.parse(fs.readFileSync(out + "/results.json", "utf8"));
const records = fs
  .readFileSync(out + "/provider.jsonl", "utf8")
  .trim()
  .split("\n")
  .map(JSON.parse)
  .filter((r) => r.status === 200)
  .slice(-3);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
try {
  for (let i = 0; i < results.runs.length; i++) {
    const r = results.runs[i];
    const page = await context.newPage();
    const response = await page.goto("http://localhost:8082" + r.path, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(response.status(), 200);
    await page.locator("article").waitFor();
    assert.equal(await page.locator("main > h1").innerText(), r.render_h1);
    const text = await page.locator("article").innerText();
    const h2size = await page
      .locator("article h2")
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize);
    assert.equal(h2size, "24px");
    await page.screenshot({ path: out + `/generation-${i + 1}-rendered.png`, fullPage: true });
    const reload = await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(reload.status(), 200);
    assert.equal(await page.locator("article").innerText(), text);
    await page.screenshot({ path: out + `/generation-${i + 1}-reload.png`, fullPage: true });
    const query =
      process.env.SUPABASE_URL.replace(/\/$/, "") +
      "/rest/v1/content_pages?select=id,workspace_id,body_markdown,status&workspace_id=eq." +
      results.workspace +
      "&id=eq." +
      r.id;
    const db = await fetch(query, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
    assert.equal(db.status, 200);
    const rows = await db.json();
    assert.equal(rows.length, 1);
    assert.equal(
      crypto.createHash("sha256").update(rows[0].body_markdown).digest("hex"),
      r.body_sha256,
    );
    Object.assign(r, {
      local_url: "http://localhost:8082" + r.path,
      final_fresh_browser_status: response.status(),
      final_reload_status: reload.status(),
      heading_font_size: h2size,
      provider_response_id: records[i].id,
      actual_model: records[i].model,
      cost: records[i].usage.cost,
    });
    console.log(r.local_url, response.status(), records[i].id);
    await page.close();
  }
  results.final_verified_at = new Date().toISOString();
  fs.writeFileSync(out + "/results.json", JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
