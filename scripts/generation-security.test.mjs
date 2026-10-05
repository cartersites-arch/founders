import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const w='00000000-0000-4000-8000-000000000001',a='00000000-0000-4000-8000-000000000002',b='00000000-0000-4000-8000-000000000003';
async function fixture(){const db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.workspaces(id uuid PRIMARY KEY,plan text,subscription_status text,is_internal boolean);
CREATE TABLE public.workspace_members(workspace_id uuid,user_id uuid);
CREATE TABLE public.user_roles(user_id uuid,role text);
CREATE TABLE public.content_pages(id uuid DEFAULT gen_random_uuid(),workspace_id uuid,created_at timestamptz DEFAULT now());
GRANT ALL ON public.workspaces,public.workspace_members,public.user_roles,public.content_pages TO service_role;
INSERT INTO public.workspaces VALUES('${w}','starter','active',false);INSERT INTO public.workspace_members VALUES('${w}','${a}');`);
await db.exec(readFileSync(new URL('../docs/security/customer-generation.sql',import.meta.url),'utf8'));return db;}
async function claim(db,user=a){return(await db.query('SELECT public.claim_customer_generation($1,$2) AS allowed',[w,user])).rows[0].allowed;}
test('generation quota preserves existing pages and cannot be reset by deleting them or retrying failed attempts',async()=>{const db=await fixture();try{
await db.exec(`INSERT INTO public.content_pages(workspace_id) SELECT '${w}' FROM generate_series(1,49);SET ROLE service_role`);
assert.equal(await claim(db),true);assert.equal(await claim(db),false);
await db.exec('DELETE FROM public.content_pages');assert.equal(await claim(db),false);
assert.equal((await db.query('SELECT attempts FROM public.customer_generation_usage')).rows[0].attempts,50);
await db.exec(`UPDATE public.customer_generation_usage SET month_start=(date_trunc('month',now() AT TIME ZONE 'UTC')-interval '1 month')::date`);
assert.equal(await claim(db),true);
}finally{await db.close();}});
test('generation accounting blocks browser RPC/table access and rechecks membership and subscription',async()=>{const db=await fixture();try{
for(const role of ['anon','authenticated']){await db.exec(`SET ROLE ${role}`);await assert.rejects(()=>claim(db),/permission denied/);await assert.rejects(()=>db.query('SELECT * FROM public.customer_generation_usage'),/permission denied/);await db.exec('RESET ROLE');}
await db.exec('SET ROLE service_role');await assert.rejects(()=>claim(db,b),/authorization required/);
await db.exec("UPDATE public.workspaces SET subscription_status='canceled'");await assert.rejects(()=>claim(db),/inactive/);
await db.exec("UPDATE public.workspaces SET subscription_status=NULL");await assert.rejects(()=>claim(db),/inactive/);
assert.equal((await db.query('SELECT count(*)::integer AS count FROM public.customer_generation_usage')).rows[0].count,0);
}finally{await db.close();}});
test('unlimited plans still have shared burst protection and disabled monthly limits retain usage accounting',async()=>{const db=await fixture();try{
await db.exec("UPDATE public.workspaces SET plan='enterprise';SET ROLE service_role");for(let i=0;i<10;i++)assert.equal(await claim(db),true);assert.equal(await claim(db),false);
await db.exec("UPDATE public.customer_generation_usage SET minute_start=now()-interval '1 hour'");assert.equal(await claim(db),true);
await db.exec("UPDATE public.workspaces SET plan='starter';UPDATE public.customer_generation_usage SET attempts=50,minute_start=now()-interval '1 hour'");assert.equal(await claim(db),false);
}finally{await db.close();}});
