import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function extract(path,name){
 const file=ts.createSourceFile(path,readFileSync(new URL(path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;
 function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.text===name)found=n;ts.forEachChild(n,walk);}walk(file);assert.ok(found);
 return ts.transpileModule(found.getText(file),{compilerOptions:{target:ts.ScriptTarget.ESNext}}).outputText;
}
function fixture(name,enabled,token,mode='signin'){
 const source=extract(name==='handleEmail'?'../src/routes/auth.tsx':'../src/routes/auth.reset-password.tsx',name);
 const calls=[],states=[];let resets=0;
 const auth=new Proxy({}, {get:(_,method)=>async(...args)=>{calls.push({method,args});return {error:new Error('Fixture rejection')};}});
 const fn=new Function('CAPTCHA_ENABLED','captchaToken','mode','email','password','fullName','busy','setBusy','supabase','toast','navigate','search','captchaRef','window',source+`;return ${name};`)(enabled,token,mode,'fixture@example.invalid','Fixture-password-12!','Fixture Name',false,x=>states.push(x),{auth},{error(){},success(){}},()=>{}, {redirect:'/account/learning'}, {current:{reset(){resets++;}}},{location:{origin:'https://founders-dev-preview.cartersites.workers.dev'}});
 return {run:()=>fn({preventDefault(){}}),calls,states,resets:()=>resets};
}
test('enabled CAPTCHA blocks all three Auth requests until verification',async()=>{
 for(const [name,mode] of [['handleEmail','signin'],['handleEmail','signup'],['sendResetEmail','signin']]){
 const f=fixture(name,true,'',mode);await f.run();assert.equal(f.calls.length,0);assert.equal(f.states.length,0);
 }
});
test('Auth requests forward the CAPTCHA token and reset after failed attempts',async()=>{
 for(const [name,mode,method] of [['handleEmail','signin','signInWithPassword'],['handleEmail','signup','signUp'],['sendResetEmail','signin','resetPasswordForEmail']]){
 const f=fixture(name,true,'fixture-captcha-token',mode);await f.run();assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,method);
 const options=name==='sendResetEmail'?f.calls[0].args[1]:f.calls[0].args[0].options;
 assert.equal(options.captchaToken,'fixture-captcha-token');assert.equal(f.resets(),1);assert.deepEqual(f.states,[true,false]);
 }
});
test('unconfigured CAPTCHA preserves existing Auth requests without a token',async()=>{
 for(const [name,mode] of [['handleEmail','signin'],['handleEmail','signup'],['sendResetEmail','signin']]){
 const f=fixture(name,false,'',mode);await f.run();assert.equal(f.calls.length,1);
 const options=name==='sendResetEmail'?f.calls[0].args[1]:f.calls[0].args[0].options;assert.equal(options.captchaToken,undefined);
 }
});
