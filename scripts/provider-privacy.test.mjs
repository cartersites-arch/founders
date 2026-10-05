import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../docs/security/provider-privacy.sql',import.meta.url),'utf8');

test('public provider projection revokes legacy table and private column reads while preserving business fields',async()=>{
 const db=new PGlite();
 try {
  const publicColumns=sql.match(/GRANT SELECT \(([^)]+)\)/)[1].split(',');
  const privateColumns=['submitter_email','submission_notes','claimed_by','gsc_clicks','new_private_field'];
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
   CREATE TABLE public.providers(${[...publicColumns,...privateColumns].map(c=>`${c} ${c==='is_published'?'boolean':'text'}`).join(',')});
   ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
   CREATE POLICY public_published ON public.providers FOR SELECT TO anon,authenticated USING (is_published=true);
   GRANT SELECT ON public.providers TO PUBLIC,anon,authenticated;
   GRANT SELECT(submitter_email,submission_notes) ON public.providers TO anon,authenticated;
   INSERT INTO public.providers(id,slug,name,is_published,submitter_email,new_private_field) VALUES ('public','public','Published business',true,'PRIVATE','PRIVATE'),('draft','draft','Unpublished business',false,'PRIVATE','PRIVATE');`);
  await db.exec(sql);
  for(const role of ['anon','authenticated']){
   await db.exec(`SET ROLE ${role}`);
   const rows=(await db.query('SELECT slug,name FROM public.providers')).rows;
   assert.deepEqual(rows,[{slug:'public',name:'Published business'}]);
   for(const column of privateColumns)await assert.rejects(db.query(`SELECT ${column} FROM public.providers`),/permission denied/);
   await assert.rejects(db.query('SELECT * FROM public.providers'),/permission denied/);
   await db.exec('RESET ROLE');
  }
  await db.exec('SET ROLE service_role');
  assert.equal((await db.query('SELECT submitter_email,new_private_field FROM public.providers')).rows.length,2);
 } finally {await db.close();}
});
