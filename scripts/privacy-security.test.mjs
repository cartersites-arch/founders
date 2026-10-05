import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
async function fixture(){const db=new PGlite();await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.user_id',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`);
await db.exec(readFileSync(new URL('./fixtures/privacy-schema.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../docs/security/privacy-forum-unsubscribe.sql',import.meta.url),'utf8'));
await db.exec(`CREATE TRIGGER replies_count AFTER INSERT OR DELETE ON public.mb_replies FOR EACH ROW EXECUTE FUNCTION public.mb_update_thread_reply_count();
CREATE TRIGGER likes_count AFTER INSERT OR DELETE ON public.mb_likes FOR EACH ROW EXECUTE FUNCTION public.mb_update_like_counts();`);return db;}
test('profiles are private to their owner while service access remains',async()=>{const db=await fixture();try{
await db.exec(`INSERT INTO public.profiles(user_id,full_name) VALUES('${a}','Fixture A'),('${b}','Fixture B');SET ROLE anon`);
assert.equal((await db.query('SELECT * FROM public.profiles')).rows.length,0);
await db.exec(`RESET ROLE;SET ROLE authenticated;SET test.user_id='${a}'`);
assert.deepEqual((await db.query('SELECT full_name FROM public.profiles')).rows,[{full_name:'Fixture A'}]);
await db.exec('RESET ROLE;SET ROLE service_role');assert.equal((await db.query('SELECT * FROM public.profiles')).rows.length,2);
}finally{await db.close();}});
test('forum authors cannot forge moderation fields, while replies and likes maintain cross-author counters',async()=>{const db=await fixture();try{
await db.exec(`SET ROLE authenticated;SET test.user_id='${a}'`);
const thread=(await db.query('INSERT INTO public.mb_threads(user_id,title,body) VALUES($1,$2,$3) RETURNING id',[a,'Fixture','Content'])).rows[0].id;
await assert.rejects(()=>db.exec('UPDATE public.mb_threads SET is_pinned=true'),/permission denied/);
await assert.rejects(()=>db.exec('UPDATE public.mb_threads SET reply_count=500'),/permission denied/);
await assert.rejects(()=>db.query('INSERT INTO public.mb_threads(user_id,title,body,is_pinned) VALUES($1,$2,$3,true)',[a,'Forged','Content']),/permission denied/);
await db.exec("UPDATE public.mb_threads SET title='Allowed edit'");
await db.exec(`SET test.user_id='${b}'`);
const reply=(await db.query('INSERT INTO public.mb_replies(user_id,thread_id,body) VALUES($1,$2,$3) RETURNING id',[b,thread,'Reply'])).rows[0].id;
await db.query('INSERT INTO public.mb_likes(user_id,thread_id) VALUES($1,$2)',[b,thread]);
assert.deepEqual((await db.query('SELECT reply_count,like_count FROM public.mb_threads')).rows,[{reply_count:1,like_count:1}]);
await assert.rejects(()=>db.exec('UPDATE public.mb_replies SET like_count=100'),/permission denied/);
await assert.rejects(()=>db.exec('SELECT public.mb_update_like_counts()'),/permission denied/);
await db.query('DELETE FROM public.mb_replies WHERE id=$1',[reply]);await db.query('DELETE FROM public.mb_likes WHERE user_id=$1',[b]);
assert.deepEqual((await db.query('SELECT reply_count,like_count FROM public.mb_threads')).rows,[{reply_count:0,like_count:0}]);
}finally{await db.close();}});
test('unsubscribe is atomic, repairs earlier partial writes, and rejects browser RPC access',async()=>{const db=await fixture();try{
const token='fixture-unsubscribe-token-at-least-sixteen';
await db.query('INSERT INTO public.email_unsubscribe_tokens(token,email) VALUES($1,$2)',[token,'fixture@example.invalid']);
await db.exec("ALTER TABLE public.suppressed_emails ADD CONSTRAINT fail_fixture CHECK(email<>'fixture@example.invalid');SET ROLE service_role");
await assert.rejects(()=>db.query('SELECT public.apply_email_unsubscribe($1)',[token]),/fail_fixture/);
assert.equal((await db.query('SELECT used_at FROM public.email_unsubscribe_tokens')).rows[0].used_at,null);
await db.exec('RESET ROLE;ALTER TABLE public.suppressed_emails DROP CONSTRAINT fail_fixture;SET ROLE service_role');
assert.equal((await db.query('SELECT public.apply_email_unsubscribe($1) AS result',[token])).rows[0].result,'success');
await db.exec('DELETE FROM public.suppressed_emails');
assert.equal((await db.query('SELECT public.apply_email_unsubscribe($1) AS result',[token])).rows[0].result,'already');
assert.equal((await db.query('SELECT count(*)::int AS count FROM public.suppressed_emails')).rows[0].count,1);
for(const role of ['anon','authenticated']){await db.exec(`RESET ROLE;SET ROLE ${role}`);await assert.rejects(()=>db.query('SELECT public.apply_email_unsubscribe($1)',[token]),/permission denied/);}
}finally{await db.close();}});
