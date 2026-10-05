import test from "node:test";
import assert from "node:assert/strict";
import { configurePreviewRuntime } from "./configure-preview-runtime.mjs";

const url = "https://vpewpybdvtnhwxhzyubc.supabase.co";
const config = { name: "founders-dev-preview", preview_urls: false, triggers: {}, vars: { SUPABASE_URL: url } };
const env = { VITE_DEVELOPMENT_PREVIEW: "1", VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture" };

test("generated preview deployment carries the build publishable key as a runtime binding", () => {
  const result = configurePreviewRuntime(config, { ...env, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture" });
  assert.equal(result.vars.SUPABASE_PUBLISHABLE_KEY, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  assert.equal(result.keep_vars, true);
  assert.equal(result.vars.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(config.vars.SUPABASE_PUBLISHABLE_KEY, undefined);
});
test("configuration rejects other targets, projects, and secret keys", () => {
  for (const badConfig of [{ ...config, name: "founders-click" }, { ...config, account_id: "other" }, { ...config, routes: [] }, { ...config, triggers: { crons: ["* * * * *"] } }, { ...config, preview_urls: true }]) {
    assert.throws(() => configurePreviewRuntime(badConfig, env));
  }
  for (const overrides of [{ VITE_DEVELOPMENT_PREVIEW: "0" }, { VITE_SUPABASE_URL: "https://other.supabase.co" }, { VITE_SUPABASE_PUBLISHABLE_KEY: "sb_secret_fixture" }, { VITE_SUPABASE_PUBLISHABLE_KEY: "" }]) {
    assert.throws(() => configurePreviewRuntime(config, { ...env, ...overrides }));
  }
});
