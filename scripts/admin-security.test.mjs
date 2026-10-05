import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {MIN_NEW_PASSWORD_LENGTH,MAX_NEW_PASSWORD_LENGTH} from '../src/lib/password-policy.ts';
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';

async function fixture(){
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.user_roles(user_id uuid,role text,PRIMARY KEY(user_id,role));
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_roles TO service_role;
 INSERT INTO public.user_roles VALUES ('${a}','admin'),('${b}','admin'),('${b}','editor');`);
 await db.exec(readFileSync(new URL('../docs/security/admin-role-removal.sql',import.meta.url),'utf8'));
 return db;
}
test('admin removal rechecks caller, prevents self-removal and preserves unrelated roles',async()=>{
 const db=await fixture();try{
 await db.exec('SET ROLE service_role');
 await assert.rejects(db.query('SELECT revoke_admin_role($1,$2)',[a,a]),/Invalid admin removal/);
 assert.equal((await db.query('SELECT revoke_admin_role($1,$2) AS removed',[a,b])).rows[0].removed,true);
 await assert.rejects(db.query('SELECT revoke_admin_role($1,$2)',[b,a]),/Admin access required/);
 assert.equal((await db.query("SELECT user_id FROM public.user_roles WHERE role='admin'")).rows[0].user_id,a);
 assert.equal((await db.query("SELECT role FROM public.user_roles WHERE user_id=$1",[b])).rows[0].role,'editor');
 assert.equal((await db.query('SELECT revoke_admin_role($1,$2) AS removed',[a,b])).rows[0].removed,true);
 }finally{await db.close();}
});
test('browser roles cannot impersonate callers through the privileged removal RPC',async()=>{
 const db=await fixture();try{
 for(const role of ['anon','authenticated']){
  await db.exec(`SET ROLE ${role}`);
  await assert.rejects(db.query('SELECT public.revoke_admin_role($1,$2)',[a,b]),/permission denied/);
  await db.exec('RESET ROLE');
 }
 }finally{await db.close();}
});
test('admin password validators reject short and oversized replacements before side effects',async()=>{
 const {default:ts}=await import('typescript');
 const {z}=await import('zod');
 const source=readFileSync(new URL('../src/server/admin-team.functions.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 const createServerFn=()=>({middleware(){return this;},inputValidator(fn){this.validate=fn;return this;},handler(fn){return {validate:this.validate,handler:fn};}});
 const endpoints=new Function('createServerFn','z','requireSupabaseAuth','supabaseAdmin','MIN_NEW_PASSWORD_LENGTH','MAX_NEW_PASSWORD_LENGTH',js+';return {createAdminUser,setAdminPassword};')(createServerFn,z,{},new Proxy({},{get(){throw Error('Unexpected database access');}}),MIN_NEW_PASSWORD_LENGTH,MAX_NEW_PASSWORD_LENGTH);
 for(const [name,endpoint] of Object.entries(endpoints)){
  const input=name==='createAdminUser'?{email:'fixture@example.invalid'}:{user_id:a};
  assert.throws(()=>endpoint.validate({...input,password:'Ab3!xY9p'}));
  assert.throws(()=>endpoint.validate({...input,password:'x'.repeat(MAX_NEW_PASSWORD_LENGTH+1)}));
  assert.equal(endpoint.validate({...input,password:'A'.repeat(MIN_NEW_PASSWORD_LENGTH)}).password.length,MIN_NEW_PASSWORD_LENGTH);
 }
});
test('admin reset requests delivery with a recovery callback and does not report failed delivery as success',async()=>{
 const {default:ts}=await import('typescript');const {z}=await import('zod');
 const source=readFileSync(new URL('../src/server/admin-team.functions.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 const createServerFn=()=>({middleware(){return this;},inputValidator(fn){this.validate=fn;return this;},handler(fn){return fn;}});
 let delivered=0,deny=false,fail=false;
 const chain={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:deny?null:{role:'admin'}})};
 const client={from:()=>chain,auth:{resetPasswordForEmail:async(email,options)=>{
  delivered++;assert.equal(email,'fixture@example.invalid');assert.equal(options.redirectTo,'https://founders-dev-preview.cartersites.workers.dev/auth/reset-password');
  return {error:fail?new Error('PRIVATE INTERNAL DETAIL'):null};
 }}};
 const handler=new Function('createServerFn','z','requireSupabaseAuth','supabaseAdmin','MIN_NEW_PASSWORD_LENGTH','MAX_NEW_PASSWORD_LENGTH','getRequest',js+';return sendAdminPasswordReset;')(createServerFn,z,{},client,MIN_NEW_PASSWORD_LENGTH,MAX_NEW_PASSWORD_LENGTH,()=>new Request('https://founders-dev-preview.cartersites.workers.dev/_serverFn/fixture'));
 const input={data:{email:' FIXTURE@EXAMPLE.INVALID '},context:{userId:a}};
 deny=true;await assert.rejects(handler(input),/Forbidden/);assert.equal(delivered,0);
 deny=false;assert.deepEqual(await handler(input),{ok:true});assert.equal(delivered,1);
 fail=true;await assert.rejects(handler(input),error=>error.message.includes('Unable to send')&&!error.message.includes('PRIVATE'));
});
