import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

// Standalone in-memory PostgreSQL fixtures: no URLs, credentials, scheduler,
// original migrations or hosted database access.
test("workspace billing fields and direct form writes cannot bypass server authorization", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-0000-0000-000000000001";
  const other = "00000000-0000-0000-0000-000000000002";
  const workspace = "00000000-0000-0000-0000-000000000003";
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('test.user_id', true), '')::uuid;
      $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      CREATE TYPE public.app_role AS ENUM ('admin', 'user');
      CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
      CREATE TABLE public.workspaces (
        id uuid PRIMARY KEY, slug text, name text, marketplace_domain text,
        domain_verified_at timestamptz, owner_user_id uuid, plan text,
        subscription_status text, trial_ends_at timestamptz, current_period_end timestamptz,
        stripe_customer_id text, stripe_subscription_id text, is_internal boolean,
        created_at timestamptz, updated_at timestamptz
      );
      CREATE TABLE public.workspace_members(workspace_id uuid, user_id uuid, role text);
      CREATE TABLE public.pool_waitlist(email text);
      CREATE TABLE public.feature_requests(email text);
      CREATE TABLE public.provider_leads(email text);
      CREATE TABLE public.provider_claims(email text);
      CREATE TABLE public.provider_plan_requests(email text);
      CREATE TABLE public.city_link_clicks(email text);
      CREATE FUNCTION public.workspace_for_host(text) RETURNS text LANGUAGE sql AS $$ SELECT $1; $$;
      CREATE FUNCTION public.count_providers_by_category() RETURNS integer LANGUAGE sql AS $$ SELECT 0; $$;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
      GRANT INSERT ON public.pool_waitlist TO anon;
      GRANT UPDATE(plan) ON public.workspaces TO PUBLIC;
      INSERT INTO public.workspaces(id,name,plan,is_internal,owner_user_id) VALUES ('${workspace}','Own workspace','starter',false,'${owner}');
      INSERT INTO public.workspace_members VALUES ('${workspace}','${owner}','owner');
      INSERT INTO public.user_roles VALUES ('${owner}','user'),('${other}','admin');
    `);
    await db.exec(readFileSync(new URL("./fixtures/billing-schema.sql", import.meta.url), "utf8"));
    await db.exec(readFileSync(new URL("./fixtures/privacy-schema.sql", import.meta.url), "utf8"));
    await db.exec("CREATE TABLE public.content_pages(id uuid PRIMARY KEY,workspace_id uuid,created_at timestamptz DEFAULT now()); GRANT ALL ON public.content_pages TO service_role; CREATE TABLE public.course_completions(id uuid,user_id uuid,course_slug text,course_title text,learner_name text,certificate_uid text,completed_at timestamptz,revoked_at timestamptz,revoke_reason text);");
    await db.exec(readFileSync(new URL("./fixtures/provider-schema.sql", import.meta.url), "utf8"));
    await db.exec(
      readFileSync(new URL("../docs/security/apply-security.sql", import.meta.url), "utf8"),
    );
    await db.exec(`
      ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "Members read" ON public.workspaces FOR SELECT TO authenticated USING(public.is_workspace_member(id,auth.uid()) OR public.has_role(auth.uid(),'admin'));
      CREATE POLICY "Owners update" ON public.workspaces FOR UPDATE TO authenticated USING(public.is_workspace_owner(id,auth.uid())) WITH CHECK(public.is_workspace_owner(id,auth.uid()));
      SET ROLE authenticated;
      SET test.user_id = '${owner}';
    `);
    assert.equal((await db.query("SELECT name FROM public.workspaces")).rows.length, 1);
    await db.exec("UPDATE public.workspaces SET name='Allowed name'");
    for (const field of [
      "plan='enterprise'",
      "is_internal=true",
      "subscription_status='active'",
      "marketplace_domain='victim.example'",
      "domain_verified_at=now()",
      "stripe_customer_id='another_customer'",
      `owner_user_id='${other}'`,
    ]) {
      await assert.rejects(
        () => db.exec(`UPDATE public.workspaces SET ${field}`),
        /permission denied/,
      );
    }
    assert.equal(
      (await db.query(`SELECT public.has_role('${other}','admin') AS permitted`)).rows[0].permitted,
      false,
    );
    assert.equal(
      (await db.query(`SELECT public.is_workspace_member('${workspace}','${other}') AS permitted`))
        .rows[0].permitted,
      false,
    );
    await db.exec(`SET test.user_id = '${other}'`);
    const updated = await db.query(
      "UPDATE public.workspaces SET name='Unauthorized rename' RETURNING id",
    );
    assert.equal(updated.rows.length, 0);
    for (const table of [
      "pool_waitlist",
      "feature_requests",
      "provider_leads",
      "provider_claims",
      "provider_plan_requests",
      "city_link_clicks",
    ]) {
      await assert.rejects(
        () => db.exec(`INSERT INTO public.${table} VALUES ('fixture@example.invalid')`),
        /permission denied/,
      );
    }
    await db.exec("RESET ROLE; SET ROLE anon;");
    await assert.rejects(
      () => db.exec("INSERT INTO public.pool_waitlist VALUES ('fixture@example.invalid')"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.exec(`SELECT public.has_role('${other}','admin')`),
      /permission denied/,
    );
    await assert.rejects(() => db.exec("SELECT public.workspace_for_host('fixture')"), /permission denied/);
    await assert.rejects(() => db.exec("SELECT public.count_providers_by_category()"), /permission denied/);
    await db.exec("RESET ROLE; SET ROLE service_role;");
    await db.exec("SELECT public.workspace_for_host('fixture'), public.count_providers_by_category()");
    await db.exec("UPDATE public.workspaces SET plan='growth',is_internal=false");
    await db.exec("INSERT INTO public.pool_waitlist VALUES ('fixture@example.invalid')");
    const row = (await db.query("SELECT name,plan FROM public.workspaces")).rows[0];
    assert.equal(row.name, "Allowed name");
    assert.equal(row.plan, "growth");
  } finally {
    await db.close();
  }
});
