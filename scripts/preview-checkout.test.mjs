import test from "node:test";
import assert from "node:assert/strict";
import { assertPreviewCheckout } from "./preview-checkout.mjs";
const sha = "a".repeat(40);
const ci = {WORKERS_CI:"1", WORKERS_CI_BRANCH:"security-hardening", WORKERS_CI_COMMIT_SHA:sha};
test("local branch and matching detached Cloudflare checkout pass",()=>{
 assert.doesNotThrow(()=>assertPreviewCheckout("ref: refs/heads/security-hardening",{}));
 assert.doesNotThrow(()=>assertPreviewCheckout(sha,ci));
});
test("main, unknown detached checkout and mismatched CI metadata fail",()=>{
 for(const [head,env] of [
 ["ref: refs/heads/main",ci], [sha,{}], [sha,{...ci,WORKERS_CI_BRANCH:"main"}],
 [sha,{...ci,WORKERS_CI_COMMIT_SHA:"b".repeat(40)}], [sha,{...ci,WORKERS_CI_COMMIT_SHA:undefined}],
 ["ref: refs/heads/security-hardening",{...ci,WORKERS_CI_BRANCH:"main"}],
 ]) assert.throws(()=>assertPreviewCheckout(head,env));
});
