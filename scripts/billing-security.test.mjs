import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const workspace='00000000-0000-0000-0000-000000000001';
async function fixture(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.workspaces(id uuid PRIMARY KEY, stripe_customer_id text, stripe_subscription_id text,plan text,subscription_status text,trial_ends_at timestamptz,current_period_end timestamptz);
 GRANT ALL ON public.workspaces TO service_role;
 INSERT INTO public.workspaces(id,stripe_customer_id,plan,subscription_status) VALUES ('${workspace}','cus_fixture','starter','incomplete');`);
 await db.exec(readFileSync(new URL('./fixtures/billing-schema.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../docs/security/billing-and-submission.sql',import.meta.url),'utf8'));
 return db;
}
const state=(status='active',extra={})=>({stripe_customer_id:'cus_fixture',stripe_subscription_id:'sub_fixture',stripe_price_id:'price_fixture',plan:'growth',status,...extra});
async function apply(db,id,time,expected,value=state()){
 return (await db.query('SELECT public.apply_stripe_subscription_event($1,$2,$3,$4,$5) AS applied',[workspace,id,time,expected,JSON.stringify(value)])).rows[0].applied;
}
const old='2026-01-01T00:00:00Z',next='2026-01-01T00:00:01Z';
test('billing serializes snapshots, ignores stale/duplicate events and reconciles both tables',async()=>{
 const db=await fixture();try{
 await db.exec('SET ROLE service_role');
 assert.equal(await apply(db,'evt_old',old,null),true);
 assert.equal(await apply(db,'evt_new',next,'evt_old',state('canceled')),true);
 assert.equal(await apply(db,'evt_delayed',old,null),false);
 assert.equal(await apply(db,'evt_new',next,null),false);
 await assert.rejects(()=>apply(db,'evt_conflict',next,'evt_old'),/Concurrent billing update/);
 assert.equal(await apply(db,'evt_retry',next,'evt_new',state('canceled')),true);
 const a=(await db.query('SELECT plan,status,last_event_id FROM public.customer_subscriptions')).rows[0];
 const b=(await db.query('SELECT plan,subscription_status FROM public.workspaces')).rows[0];
 assert.equal(a.status,'canceled');assert.equal(a.last_event_id,'evt_retry');assert.equal(a.plan,b.plan);assert.equal(a.status,b.subscription_status);
 assert.equal(await apply(db,'evt_replacement',next,'evt_retry',state('active',{stripe_subscription_id:'sub_successor',allow_subscription_replacement:true})),true);
 assert.equal(await apply(db,'evt_old_subscription', '2026-01-01T00:00:02Z','evt_replacement',state('canceled')),false);
 await assert.rejects(()=>apply(db,'evt_duplicate_checkout','2026-01-01T00:00:02Z','evt_replacement',state('active',{stripe_subscription_id:'sub_third',allow_subscription_replacement:true})),/Previous subscription still live/);
 await assert.rejects(()=>apply(db,'evt_other_customer',next,'evt_retry',state('active',{stripe_customer_id:'cus_wrong'})),/Billing customer mismatch/);
 }finally{await db.close();}
});
test('billing rolls back the subscription when its workspace mirror fails',async()=>{
 const db=await fixture();try{
 await db.exec(`ALTER TABLE public.workspaces ADD CONSTRAINT reject_active CHECK(subscription_status<>'active')`);
 await assert.rejects(()=>apply(db,'evt_failure',old,null),/reject_active/);
 assert.equal((await db.query('SELECT count(*)::int AS count FROM public.customer_subscriptions')).rows[0].count,0);
 assert.equal((await db.query('SELECT subscription_status FROM public.workspaces')).rows[0].subscription_status,'incomplete');
 await db.exec('ALTER TABLE public.workspaces DROP CONSTRAINT reject_active');
 assert.equal(await apply(db,'evt_failure',old,null),true);
 }finally{await db.close();}
});
test('billing and shared submission RPCs reject browser roles',async()=>{
 const db=await fixture();try{
 for(const role of ['anon','authenticated']){
 await db.exec(`SET ROLE ${role}`);
 await assert.rejects(()=>apply(db,'evt_denied',old,null),/permission denied/);
 await assert.rejects(()=>db.query('SELECT public.consume_submission_limits($1,$2,$3)',['provider-plan','a'.repeat(64),null]),/permission denied/);
 await assert.rejects(()=>db.exec('SELECT * FROM public.submission_rate_limits'),/permission denied/);
 await db.exec('RESET ROLE');
 }
 }finally{await db.close();}
});
test('shared counters limit recipients across clients and scopes expire without storing PII',async()=>{
 const db=await fixture();try{
 await db.exec('SET ROLE service_role');
 const consume=async(client,recipient=null)=> (await db.query('SELECT public.consume_submission_limits($1,$2,$3) AS allowed',['provider-plan',client.repeat(64),recipient?.repeat(64)??null])).rows[0].allowed;
 for(const client of ['a','b','c'])assert.equal(await consume(client,'d'),true);
 assert.equal(await consume('e','d'),false);
 await db.exec("UPDATE public.submission_rate_limits SET expires_at=now()-interval '1 second'");
 assert.equal(await consume('e','d'),true);
 for(let i=0;i<4;i++)assert.equal(await consume('f'),true);
 assert.equal(await consume('f'),true);assert.equal(await consume('f'),false);
 await assert.rejects(()=>db.query('SELECT public.consume_submission_limits($1,$2,$3)',['unknown-scope','a'.repeat(64),null]),/Invalid submission/);
 const rows=(await db.query('SELECT key FROM public.submission_rate_limits')).rows;assert.ok(rows.length<20);assert.ok(rows.every(r=>!r.key.includes('@')));
 }finally{await db.close();}
});
