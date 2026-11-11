const test=require("node:test");
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {Script}=require("node:vm");
test("all public page inline scripts have valid JavaScript",()=>{
  for(const filename of ["index.html","mobile-wallpapers.html","desktop-wallpapers.html","studio.html"]){
    const html=readFileSync(filename,"utf8");
    const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
      .filter(([,attributes])=>!/application\/ld\+json/i.test(attributes));
    for(const [,attributes,body] of scripts) {
      if(/\bsrc=/i.test(attributes))continue;
      assert.doesNotThrow(()=>new Script(body,{filename}),filename+" contains invalid inline JavaScript");
    }
  }
});
test("custom schedules are sourced from owner interactions only when enough data exists",async()=>{
  const {scheduleTen}=await import("../scripts/schedule.mjs");
  const epoch=Date.parse("2026-11-11T00:00:00Z");
  const noData=scheduleTen(epoch,[]);
  assert.match(noData.basis,/exploratory/i);
  assert.equal(noData.scheduledAt.length,10);
  assert.equal(new Set(noData.scheduledAt).size,10);
  assert.ok(noData.scheduledAt.every(value=>Date.parse(value)>epoch));
});
