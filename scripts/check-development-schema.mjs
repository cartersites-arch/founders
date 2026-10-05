import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const db=new PGlite();
try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'anon'::text $$;`);
 await db.exec(readFileSync('docs/security/development/schema-review.sql','utf8'));
 const tables=await db.query("SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'"); console.log('Public tables loaded:',tables.rows[0].n);
 const unsafe=await db.query("SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('cron','net','vault','pgmq')"); if(unsafe.rows[0].n)throw new Error('Unexpected infrastructure functions');
 console.log('PASS sanitized schema loads into in-memory PostgreSQL with Auth stubs.');
}catch(e){console.log('Schema initialization blocked:',e.message);process.exitCode=1;}finally{await db.close();}
