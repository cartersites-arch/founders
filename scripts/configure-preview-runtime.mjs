import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { assertDevelopmentSupabaseUrl } from "../src/lib/isolation-policy.ts";

export function configurePreviewRuntime(config, env) {
  if (env.VITE_DEVELOPMENT_PREVIEW !== "1" || config.name !== "founders-dev-preview" ||
    config.account_id || config.routes || Object.keys(config.triggers ?? {}).length || config.preview_urls !== false) {
    throw new Error("Preview runtime configuration target mismatch.");
  }
  assertDevelopmentSupabaseUrl(config.vars?.SUPABASE_URL);
  assertDevelopmentSupabaseUrl(env.VITE_SUPABASE_URL);
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key?.startsWith("sb_publishable_")) {
    throw new Error("Preview build requires the founders-dev publishable key, never a secret key.");
  }
  return {
    ...config,
    keep_vars: true,
    vars: { ...config.vars, SUPABASE_PUBLISHABLE_KEY: key },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = "dist/server/wrangler.json";
  const config = configurePreviewRuntime(JSON.parse(readFileSync(path, "utf8")), process.env);
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
  console.log("Preview runtime publishable-key binding configured; key value withheld.");
}
