import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSitemapUrls } from '../src/lib/safe-sitemap.ts';

async function mocked(handler, run) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    assert.equal(options.redirect, 'manual');
    assert.ok(options.signal);
    return handler(String(url), calls.length);
  };
  try { await run(calls); } finally { globalThis.fetch = original; }
}

test('normal nested sitemaps and same-origin redirects retain valid page URLs', async () => {
  await mocked(url => {
    if (url.endsWith('/index.xml')) return new Response('<sitemapindex><loc>https://example.com/child.xml</loc></sitemapindex>');
    if (url.endsWith('/child.xml')) return new Response(null, { status: 302, headers: { location: '/pages.xml' } });
    return new Response('<urlset><loc>https://example.com/page?a=1&amp;b=2</loc></urlset>');
  }, async calls => {
    assert.deepEqual(await fetchSitemapUrls('https://example.com/index.xml'), ['https://example.com/page?a=1&b=2']);
    assert.equal(calls.length, 3);
  });
});
test('unsafe initial destinations cause no requests', async () => {
  await mocked(() => { throw new Error('must not fetch'); }, async calls => {
    for (const url of ['http://example.com/x', 'https://127.0.0.1/x', 'https://[::1]/x', 'https://localhost/x', 'https://metadata.internal/x', 'https://user:pass@example.com/x', 'https://example.com:8443/x']) {
      await assert.rejects(fetchSitemapUrls(url));
    }
    assert.equal(calls.length, 0);
  });
});
test('remote XML cannot fetch foreign or private destinations', async () => {
  await mocked(() => new Response('<sitemapindex><loc>https://127.0.0.1/x</loc><loc>https://other.example.com/x</loc><loc>https://example.com/index.xml</loc></sitemapindex>'), async calls => {
    assert.deepEqual(await fetchSitemapUrls('https://example.com/index.xml'), []);
    assert.equal(calls.length, 1);
  });
});
test('cross-origin redirect is rejected before a second request', async () => {
  await mocked(() => new Response(null, { status: 302, headers: { location: 'https://other.example.com/x' } }), async calls => {
    await assert.rejects(fetchSitemapUrls('https://example.com/index.xml'));
    assert.equal(calls.length, 1);
  });
});
test('oversized downloads and redirect loops are bounded', async () => {
  await mocked(() => new Response('x'.repeat(1024 * 1024 + 1)), async calls => {
    await assert.rejects(fetchSitemapUrls('https://example.com/index.xml'), error => error.status === 413);
    assert.equal(calls.length, 1);
  });
  await mocked(() => new Response(null, { status: 302, headers: { location: '/again.xml' } }), async calls => {
    await assert.rejects(fetchSitemapUrls('https://example.com/index.xml'));
    assert.equal(calls.length, 4);
  });
});
test('wide recursive indexes share a total request budget', async () => {
  await mocked((_url, count) => new Response(`<sitemapindex>${Array.from({length: 100}, (_, i) => `<loc>https://example.com/${count}-${i}.xml</loc>`).join('')}</sitemapindex>`), async calls => {
    await fetchSitemapUrls('https://example.com/index.xml');
    assert.equal(calls.length, 25);
  });
});

import { readBoundedJson } from '../supabase/functions/_shared/request-body.ts';
test('Edge input limits count actual streamed bytes and retain normal JSON', async () => {
  assert.deepEqual(await readBoundedJson(new Request('https://example.com', {method:'POST',body:'{"ok":true}'})), {ok:true});
  await assert.rejects(readBoundedJson(new Request('https://example.com', {method:'POST',headers:{'content-length':'1'},body:'x'.repeat(21)}),20), e => e.status === 413);
  await assert.rejects(readBoundedJson(new Request('https://example.com', {method:'POST',body:'{'})), e => e.status === 400);
});
test('help generation rejects GET before reading credentials or contacting providers', async () => {
  const { readFileSync } = await import('node:fs');
  const { default: ts } = await import('typescript');
  let handler;
  const source = readFileSync(new URL('../supabase/functions/generate-help-article/index.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText.replace(/^import .*;\s*$/gm, '').replace(/^export {};\s*$/gm, '');
  new Function('serve', 'Deno', js)(fn => {handler=fn;}, {env:{get:()=>{throw new Error('Unexpected credential access');}}});
  const response = await handler(new Request('https://example.com', {method:'GET'}));
  assert.equal(response.status,405);
  assert.equal(response.headers.get('allow'),'POST, OPTIONS');
});

test('all four privileged Edge handlers preserve size and JSON errors after admin checks', async () => {
  const { readFileSync } = await import('node:fs');
  const { default: ts } = await import('typescript');
  const chain = {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{role:'admin'},error:null})};
  const client = {auth:{getUser:async()=>({data:{user:{id:'fixture'}},error:null})},from:()=>chain};
  for (const name of ['generate-help-article','generate-course-content','generate-content-batch','seed-blog-posts']) {
    let handler;
    const source = readFileSync(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8');
    const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ESNext}}).outputText.replace(/^import .*;\s*$/gm,'').replace(/^export {};\s*$/gm,'');
    new Function('serve','Deno','createClient','readBoundedJson','matchesSecret',js)(fn=>{handler=fn;},{serve:fn=>{handler=fn;},env:{get:()=> 'fixture-only'}},()=>client,readBoundedJson,async()=>false);
    for (const [body,status] of [['x'.repeat(1024*1024+1),413],['{',400]]) {
      const response = await handler(new Request('https://example.com',{method:'POST',headers:{authorization:'Bearer fixture'},body}));
      assert.equal(response.status,status,name);
    }
  }
});
