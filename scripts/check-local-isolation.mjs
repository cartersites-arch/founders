import { readFileSync } from "node:fs";
import { assertDevelopmentSupabaseUrl, DEVELOPMENT_PROJECT } from "../src/lib/isolation-policy.ts";

const branch = readFileSync(".git/HEAD", "utf8").trim();
if (branch !== "ref: refs/heads/security-hardening")
  throw new Error("Isolation: use the security-hardening branch.");
for (const key of ["SUPABASE_URL", "VITE_SUPABASE_URL"])
  assertDevelopmentSupabaseUrl(process.env[key]);
const config = readFileSync("supabase/config.toml", "utf8");
if (!config.includes(`project_id = "${DEVELOPMENT_PROJECT}"`))
  throw new Error("Isolation: wrong CLI project.");
const worker = readFileSync("wrangler.jsonc", "utf8");
if (worker.includes('"account_id"') || !worker.includes('"workers_dev": false')) {
  throw new Error("Isolation: hosted deployment must stay disabled.");
}
console.log("Local isolation preflight passed; no deployment authorized.");
