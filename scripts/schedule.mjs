// Instagram publishing-window estimator. Uses the owner's recent public engagement data
// only when authorized; otherwise uses EXPLORATORY test slots, never false "best times".
const INDIA_OFFSET=330*60000;
const TEST_HOURS=[8,9.5,11,12.5,14,15.5,17,18.5,20,21.5];
function indiaHour(timestamp) {
  const d=new Date(Date.parse(timestamp)+INDIA_OFFSET);
  return d.getUTCHours()+d.getUTCMinutes()/60;
}
export async function recentOwnerPosts(fetcher=fetch) {
  const account=process.env.IG_ACCOUNT_ID,token=process.env.IG_ACCESS_TOKEN;
  if(!account||!token) return [];
  const version=process.env.META_GRAPH_VERSION||"v24.0";
  const url="https://graph.facebook.com/"+version+"/"+encodeURIComponent(account)+"/media?fields=timestamp,like_count,comments_count&limit=60";
  try{
    const response=await fetcher(url,{headers:{Authorization:"Bearer "+token}});
    const data=await response.json();
    if(!response.ok) return [];
    return (data.data||[]).filter(post=>post.timestamp);
  }catch{return [];}
}
export function scheduleTen(now=Date.now(),media=[]) {
  const valid=media.filter(post=>post.timestamp&&Number.isFinite(Date.parse(post.timestamp)));
  let hours=[...TEST_HOURS];
  let basis="exploratory India test windows; insufficient authorized historical data";
  if(valid.length>=15){
    const hourly=new Map();
    for(const post of valid){
      const h=Math.floor(indiaHour(post.timestamp));
      if(h<7||h>22)continue;
      const info=hourly.get(h)||{sum:0,count:0};
      info.sum+=Math.max(0,Number(post.like_count)||0)+Math.max(0,Number(post.comments_count)||0)*2;
      info.count++;
      hourly.set(h,info);
    }
    const ranked=[...hourly.entries()].filter(([,v])=>v.count>=2)
      .sort((a,b)=>b[1].sum/b[1].count-a[1].sum/a[1].count).map(([h])=>h+0.25);
    if(ranked.length>=5){
      hours=[...new Set([...ranked,...TEST_HOURS])].slice(0,10).sort((a,b)=>a-b);
      basis="weighted owner like/comment response by local posting hour; provisional, not reach or retention";
    }
  }
  const day=new Date(now+INDIA_OFFSET).toISOString().slice(0,10);
  const start=Date.parse(day+"T00:00:00Z")-INDIA_OFFSET;
  return {basis,scheduledAt:hours.map(hour=>{
    let t=start+hour*3600000;
    if(t<now+60*60000)t+=86400000;
    return new Date(t).toISOString();
  })};
}
