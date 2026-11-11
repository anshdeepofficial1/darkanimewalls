const test = require("node:test");
const assert = require("node:assert/strict");
const {publicationState,buildCatalog,fetchCatalog} = require("../lib/catalog");

function makeResource(id,ctx={},extra={}) {
  return {public_id:id,format:"png",width:1080,height:1920,secure_url:"https://example.org/"+id+".png",
    created_at:"2026-11-11T00:00:00.000Z",tags:["dark-anime-walls"],context:{custom:ctx},...extra};
}
test("draft assets never leak even after their scheduled time",()=>{
  assert.equal(publicationState({draft:"true",publishAt:"2020-01-01T00:00:00Z"},Date.now()).isPublished,false);
});
test("not-yet-released assets remain hidden",()=>{
  assert.equal(publicationState({draft:"false",publishAt:"2099-01-01T00:00:00Z"}).isPublished,false);
});
test("invalid publish dates fail closed",()=>{
  assert.equal(publicationState({draft:"false",publishAt:"tomorrow-ish"}).isPublished,false);
});
test("paired catalog preserves IDs and excludes hidden tags",()=>{
  const resources=[makeResource("a",{draft:"false",pairId:"one",dropId:"drop1"}),
    makeResource("b",{draft:"true",pairId:"two"}),
    makeResource("c",{draft:"false"},{tags:["dark-anime-walls","hidden"]})];
  const publicItems=buildCatalog(resources);
  assert.equal(publicItems.length,1);
  assert.equal(publicItems[0].pairId,"one");
  assert.equal(buildCatalog(resources,{studio:true}).length,2);
});
test("catalog fetches through pagination without truncating at 100",async()=>{
  let calls=0;
  const fetcher=async url=>{
    calls++;
    const cursor=new URL(url).searchParams.get("next_cursor");
    return {ok:true,json:async()=>cursor?{resources:Array.from({length:5},(_,i)=>makeResource("last"+i))}:
      {resources:Array.from({length:500},(_,i)=>makeResource("first"+i)),next_cursor:"page2"}};
  };
  const resources=await fetchCatalog({cloudName:"demo",apiKey:"key",apiSecret:"secret",fetcher});
  assert.equal(resources.length,505);
  assert.equal(calls,2);
});
test("pagination fails closed instead of silently dropping older assets",async()=>{
  const fetcher=async()=>({ok:true,json:async()=>({resources:[makeResource("a")],next_cursor:"stillmore"})});
  await assert.rejects(()=>fetchCatalog({cloudName:"demo",apiKey:"key",apiSecret:"secret",fetcher,maxPages:1}),/pagination limit/i);
});
