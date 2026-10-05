import {readFileSync,readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const excluded = new Set(['20260503182127_700b741d-ffb4-4862-936b-1a9f25c0b713.sql','20260506033943_34219255-a00e-4e8a-b029-b88535d085c6.sql','20260506043307_302156ca-6573-4385-a0f9-5c6a43ae97ba.sql','20260506040820_0cea82ec-d98d-48cc-915c-b6dc71b10d74.sql','20260506041315_91cd3844-5ec5-4d3c-b058-b05832000c40.sql']);
let sql='-- UNAPPLIED DEVELOPMENT REVIEW DRAFT. NOT A MIGRATION.\n-- Target: founders-dev only. Review prerequisites before application.\n';const manifest=[];
for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()){
 let source=readFileSync('supabase/migrations/'+name,'utf8'); const hash=createHash('sha256').update(source).digest('hex');let status='included';
 if(excluded.has(name)){manifest.push({name,hash,status:'excluded: schedulers, networking extensions or competitor seeds'});continue;}
 if(name==='20260505004403_email_infra.sql'){
 const start=source.indexOf('-- Email send log table'); const middle=source.indexOf('-- RPC wrappers');const resume=source.indexOf('-- Suppressed emails table');const end=source.indexOf('-- ============================================================');
 if([start,middle,resume,end].some(n=>n<0))throw new Error('Email migration boundaries changed');
 source=source.slice(start,middle)+source.slice(resume,end);status='sanitized: email tables only; no queues, network extensions, vault or scheduler instructions';
 }
 if(/\b(?:cron|net|pgmq|vault)\s*\.|\b(?:pg_cron|pg_net|supabase_vault|pgmq)\b/i.test(source))throw new Error('Unsafe infrastructure reference in '+name);
 sql+='\n-- Source: '+name+'\n'+source+'\n';manifest.push({name,hash,status});
}
const protection=readFileSync('docs/security/workspace-privileges.sql','utf8');sql+='\n-- Reviewed hardening draft; still unapplied\n'+protection; sql+='\n'+readFileSync('docs/security/privileged-function-access.sql','utf8');
mkdirSync('docs/security/development',{recursive:true});writeFileSync('docs/security/development/schema-review.sql',sql);writeFileSync('docs/security/development/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('Prepared local SQL review and provenance manifest; no database contacted.');
