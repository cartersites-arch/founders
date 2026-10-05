import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('revoked completions cannot be erased or rewritten by their owner to request a fresh certificate',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.course_completions(id uuid,user_id uuid,course_slug text,course_title text,learner_name text,certificate_uid text,completed_at timestamptz,revoked_at timestamptz,revoke_reason text);
 ALTER TABLE public.course_completions ENABLE ROW LEVEL SECURITY;
 CREATE POLICY owner_read ON public.course_completions FOR SELECT TO authenticated USING(true);
 CREATE POLICY owner_delete ON public.course_completions FOR DELETE TO authenticated USING(true);
 GRANT ALL ON public.course_completions TO authenticated,service_role;
 GRANT UPDATE(revoked_at),INSERT(certificate_uid) ON public.course_completions TO PUBLIC;
 INSERT INTO public.course_completions(certificate_uid,revoked_at) VALUES('FIXTURE-REVOKED',now());`);
 await db.exec(readFileSync(new URL('../docs/security/course-completion.sql',import.meta.url),'utf8'));
 await db.exec('SET ROLE authenticated');assert.equal((await db.query('SELECT certificate_uid FROM public.course_completions')).rows.length,1);
 await assert.rejects(()=>db.exec('DELETE FROM public.course_completions'),/permission denied/);
 await assert.rejects(()=>db.exec('UPDATE public.course_completions SET revoked_at=NULL'),/permission denied/);
 await assert.rejects(()=>db.exec("INSERT INTO public.course_completions(certificate_uid) VALUES('FORGED')"),/permission denied/);
 await db.exec('RESET ROLE;SET ROLE service_role;DELETE FROM public.course_completions');assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.course_completions')).rows[0].n,0);
 }finally{await db.close();}
});
