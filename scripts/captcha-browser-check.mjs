// Run against a local build with VITE_TURNSTILE_SITE_KEY set to the Cloudflare test site key.
// Every Auth and CAPTCHA request is intercepted; no email or external verification is sent.
import {Miniflare} from 'miniflare';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import {readFileSync,readdirSync,existsSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../dist/server',import.meta.url).pathname,origin='https://founders-dev-preview.cartersites.workers.dev';
const c=JSON.parse(readFileSync(root+'/wrangler.json','utf8')),modules={};
function scan(dir,p=''){for(const f of readdirSync(dir,{withFileTypes:true})){if(f.isDirectory())scan(dir+'/'+f.name,p+f.name+'/');else if(f.name.endsWith('.js'))modules[p+f.name]={type:'esm',contents:readFileSync(dir+'/'+f.name,'utf8')};}}scan(root);
const env={...c.vars,SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY,SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture'};
const mf=new Miniflare({workers:[{config:{name:c.name,compatibilityDate:c.compatibility_date,compatibilityFlags:c.compatibility_flags,env:Object.fromEntries(Object.entries(env).map(([k,v])=>[k,{type:'text',value:v}])),manifest:{mainModule:'index.js',modules}},dev:{outboundService:{type:'fetcher',handler:async()=>{throw Error('Unexpected server outbound request');}}}}]});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});const results=[];let calls=[],scriptRequests=0,failScript=false;
const providerScript=`window.fixtureCaptcha={callbacks:[],removed:0,resets:0};window.turnstile={render:(el,opts)=>{window.fixtureCaptcha.callbacks.push(opts);el.textContent='Verification fixture';return String(window.fixtureCaptcha.callbacks.length);},reset:()=>{window.fixtureCaptcha.resets++;},remove:()=>{window.fixtureCaptcha.removed++;}};`;
function check(name,value){assert.ok(value,name);results.push({name,passed:true});}
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='challenges.cloudflare.com'){scriptRequests++;if(failScript)return route.abort();return route.fulfill({status:200,contentType:'application/javascript',body:providerScript});}
  if(u.hostname.endsWith('.supabase.co')){
   assert.equal(u.hostname,'vpewpybdvtnhwxhzyubc.supabase.co');
   if(req.method()==='POST'){
    const body=req.postDataJSON();calls.push({path:u.pathname,redirect:u.searchParams.get('redirect_to'),body});
    if(u.pathname==='/auth/v1/token')return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'invalid_grant',error_description:'Fixture credential rejection'})});
    if(u.pathname==='/auth/v1/signup')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'00000000-0000-4000-8000-000000000001',email:'fixture@example.invalid',identities:[]})});
    if(u.pathname==='/auth/v1/recover')return route.fulfill({status:200,contentType:'application/json',body:'{}'});
   }
   throw Error('Unexpected Auth request');
  }
  if(u.origin!==origin)return route.abort();
  const asset=new URL('../dist/client',import.meta.url).pathname+u.pathname;
  if(u.pathname.startsWith('/fw-assets/')&&existsSync(asset))return route.fulfill({status:200,contentType:u.pathname.endsWith('.css')?'text/css':'application/javascript',body:readFileSync(asset)});
  const r=await mf.dispatchFetch(req.url(),{method:req.method(),headers:await req.allHeaders(),body:req.postDataBuffer()??undefined});
  if(req.isNavigationRequest())check('CSP permits only explicit CAPTCHA script host',r.headers.get('content-security-policy')?.includes('https://challenges.cloudflare.com')&&!r.headers.get('content-security-policy')?.split(';').find(v=>v.trim().startsWith('script-src'))?.includes("'unsafe-inline'"));
  return route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});
 });
 const page=await context.newPage();
 const emit=async(kind='callback')=>page.evaluate(kind=>{const c=window.fixtureCaptcha.callbacks.at(-1);c[kind]('fixture-captcha-token');},kind);
 if(process.env.CAPTCHA_TEST_MODE==='disabled'){
 await page.goto(origin+'/auth?redirect=%2Faccount%2Flearning');await page.getByRole('heading',{name:'Welcome back'}).waitFor();
 const signIn=page.getByRole('button',{name:'Sign in',exact:true}).last();check('Unconfigured sign-in is available',await signIn.isEnabled());
 check('Unconfigured widget is absent',await page.getByLabel('Security verification').count()===0);
 await page.locator('#email').fill('fixture@example.invalid');await page.locator('#password').fill('Fixture-password-12!');
 let response=page.waitForResponse(r=>r.url().includes('/auth/v1/token'));await signIn.click();await response;
 check('Unconfigured sign-in has no CAPTCHA token',calls.at(-1).body.gotrue_meta_security?.captcha_token===undefined);
 await page.getByRole('button',{name:'Create account',exact:true}).first().click();
 await page.locator('#fullName').fill('Fixture Name');await page.locator('#email').fill('fixture@example.invalid');await page.locator('#password').fill('Fixture-password-12!');
 response=page.waitForResponse(r=>r.url().includes('/auth/v1/signup'));await page.getByRole('button',{name:'Create account',exact:true}).last().click();await response;
 check('Unconfigured signup has no CAPTCHA token',calls.at(-1).body.gotrue_meta_security?.captcha_token===undefined);
 await page.goto(origin+'/auth/reset-password');await page.getByRole('heading',{name:'Reset your password'}).waitFor();
 check('Unconfigured recovery is available',await page.getByRole('button',{name:'Send reset link'}).isEnabled());
 await page.locator('#email').fill('fixture@example.invalid');response=page.waitForResponse(r=>r.url().includes('/auth/v1/recover'));await page.getByRole('button',{name:'Send reset link'}).click();await response;
 check('Unconfigured recovery has no CAPTCHA token',calls.at(-1).body.gotrue_meta_security?.captcha_token===undefined);
 check('No CAPTCHA script requested when unconfigured',scriptRequests===0);
 }else{
 await page.goto(origin+'/auth?redirect=%2Faccount%2Flearning');await page.getByRole('heading',{name:'Welcome back'}).waitFor();await page.waitForFunction(()=>window.fixtureCaptcha?.callbacks.length>0);
 const signIn=page.getByRole('button',{name:'Sign in',exact:true}).last();check('Sign-in waits for verification',await signIn.isDisabled());
 await emit();check('Completed challenge enables sign-in',await signIn.isEnabled());
 await emit('expired-callback');check('Expired token blocks sign-in',await signIn.isDisabled());
 await emit('error-callback');await page.getByRole('alert').filter({hasText:'Verification could not finish'}).waitFor();check('Challenge error exposes retry',await page.getByRole('button',{name:'Retry verification'}).isVisible());
 await page.getByRole('button',{name:'Retry verification'}).click();await page.waitForFunction(()=>window.fixtureCaptcha.callbacks.length===2);
 await page.locator('#email').fill('fixture@example.invalid');await page.locator('#password').fill('Fixture-password-12!');await emit();await signIn.click();await page.waitForFunction(()=>window.fixtureCaptcha.resets>0);
 check('Sign-in token forwarded',calls.at(-1)?.path==='/auth/v1/token'&&calls.at(-1).body.gotrue_meta_security?.captcha_token==='fixture-captcha-token');check('Used token cleared after rejected sign-in',await signIn.isDisabled());
 await page.getByRole('button',{name:'Create account',exact:true}).first().click();await page.waitForFunction(()=>window.fixtureCaptcha.callbacks.length===3);
 const signup=page.getByRole('button',{name:'Create account',exact:true}).last();check('Mode switch requires new challenge',await signup.isDisabled());
 await page.locator('#fullName').fill('Fixture Name');await page.locator('#email').fill('fixture@example.invalid');await page.locator('#password').fill('Fixture-password-12!');await emit();await signup.click();await page.waitForFunction(()=>window.fixtureCaptcha.resets===2);
 check('Signup token forwarded',calls.at(-1)?.path==='/auth/v1/signup'&&calls.at(-1).body.gotrue_meta_security?.captcha_token==='fixture-captcha-token');check('Signup cannot reuse token',await signup.isDisabled());
 await page.goto(origin+'/auth/reset-password');await page.getByRole('heading',{name:'Reset your password'}).waitFor();await page.waitForFunction(()=>window.fixtureCaptcha?.callbacks.length>0);
 const reset=page.getByRole('button',{name:'Send reset link'});check('Reset request waits for verification',await reset.isDisabled());
 await page.locator('#email').fill('fixture@example.invalid');await emit();await reset.click();await page.waitForFunction(()=>window.fixtureCaptcha.resets===1);
 check('Reset token forwarded',calls.at(-1)?.path==='/auth/v1/recover'&&calls.at(-1).body.gotrue_meta_security?.captcha_token==='fixture-captcha-token');check('Reset callback stays on preview',calls.at(-1).redirect===origin+'/auth/reset-password');check('Reset cannot reuse token',await reset.isDisabled());
 await page.getByRole('button',{name:'Enter a recovery code'}).click();check('Code recovery remains reachable',await page.locator('#recovery-code').isVisible());check('Widget removed on code form',await page.evaluate(()=>window.fixtureCaptcha.removed>0));
 failScript=true;await page.reload();await page.getByRole('button',{name:'Retry verification'}).waitFor();check('Script failure blocks sending',await page.getByRole('button',{name:'Send reset link'}).isDisabled());
 failScript=false;await page.getByRole('button',{name:'Retry verification'}).click();await page.waitForFunction(()=>window.fixtureCaptcha?.callbacks.length>0);check('Script failure retry loads widget',true);
 }
 check('Only three mocked Auth submissions',calls.length===3);if(process.env.CAPTCHA_TEST_MODE!=='disabled')check('Provider script requested',scriptRequests>=3);
 console.log('CAPTCHA mobile browser checks passed:',results.length);writeFileSync(process.env.CAPTCHA_RESULTS_PATH || '/tmp/founders-captcha-browser-results.json',JSON.stringify(results));
}finally{await browser.close();await mf.dispose();}
