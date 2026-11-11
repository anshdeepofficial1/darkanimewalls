// Publish due, quality-approved 9:16 Reels, then release matching Cloudinary image pairs.
// Credentials are supplied only via Actions secrets. Safe default: no live API calls without env.
import {cloudinaryConfig,listResources,updateImageContext} from "./cloudinary.mjs";
const account=process.env.IG_ACCOUNT_ID;
const token=process.env.IG_ACCESS_TOKEN;
const version=process.env.META_GRAPH_VERSION || "v24.0";
if(!account || !token) throw new Error("Instagram professional account ID and token are not configured. No posts attempted.");
if(!/^v\d+\.\d+$/.test(version)) throw new Error("Invalid Meta Graph API version");
const graphBase="https://graph.facebook.com/"+version+"/";
async function graph(path, options={}) {
  const url=graphBase+path;
  const response=await fetch(url,{
    method:options.method||"GET",
    headers:{Authorization:"Bearer "+token,...(options.data?{"Content-Type":"application/x-www-form-urlencoded"}:{})},
    body:options.data?new URLSearchParams(options.data):undefined
  });
  const data=await response.json();
  if(!response.ok || data.error) throw new Error("Instagram API: "+(data.error?.message||response.status));
  return data;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const custom=resource=>resource.context?.custom||{};
const isMobile=resource=>resource.width < resource.height || /^mobile/i.test(custom(resource).type||"");
const due=resource=>{
  const c=custom(resource);
  const timestamp=Date.parse(c.publishAt||"");
  return c.source==="automation" && c.qaStatus==="approved" && c.draft==="true"
    && Number.isFinite(timestamp) && timestamp<=Date.now();
};
async function getPublishedReel(caption) {
  // Recovery after an interrupted job: checking existing media avoids re-posting
  // when Instagram published the Reel but metadata update failed.
  const result=await graph(account+"/media?fields=id,caption,permalink,timestamp&limit=50");
  return (result.data||[]).find(p=>String(p.caption||"").trim()===caption.trim())||null;
}
async function createAndPublish(resource) {
  const ctx=custom(resource),caption=String(ctx.igCaption||"").trim(),video=String(ctx.reelUrl||"");
  if(!caption || !/^https:\/\//.test(video)) throw new Error("Missing Reel URL/caption: "+resource.public_id);
  const existing=await getPublishedReel(caption);
  if(existing) return {id:existing.id,permalink:existing.permalink,recovered:true};
  // Music can come from Meta's authorized Instagram Audio API, Facebook Login only.
  // If the requested track is unavailable, do not silently publish without music.
  let audioId=String(ctx.igAudioId||"").trim();
  const musicQuery=String(ctx.musicQuery||"").trim();
  if(!audioId && musicQuery) {
    if(process.env.IG_AUDIO_API_ENABLED!=="true") throw new Error("Instagram Audio API access is not enabled for "+resource.public_id);
    const search=await graph("ig_audio?audio_type=music&search_query="+encodeURIComponent(musicQuery));
    const candidate=(search.data||[])[0];
    audioId=String(candidate?.audio_id||candidate?.id||"");
    if(!/^\d+$/.test(audioId)) throw new Error("No Meta-authorized music matched "+musicQuery);
  }
  if(!audioId && process.env.ALLOW_SILENT_REELS!=="true") throw new Error("No licensed soundtrack selected; publication deferred");
  // Store a marker before creating the container. A crash requires reconciliation,
  // rather than silently starting a duplicate new attempt next run.
  await updateImageContext(resource,{igStatus:"publishing"});
  const params={media_type:"REELS",video_url:video,caption,share_to_feed:"true"};
  if(audioId) params.audio_configuration=JSON.stringify({audio_id:audioId,audio_volume:100,video_volume:0});
  const created=await graph(account+"/media",{method:"POST",data:params});
  if(!created.id) throw new Error("Instagram did not return a media container ID");
  await updateImageContext(resource,{igContainerId:created.id});
  let ready=false;
  for(let attempt=0;attempt<12;attempt++) {
    const status=await graph(created.id+"?fields=status_code,status");
    if(status.status_code==="FINISHED"){ready=true;break;}
    if(["ERROR","EXPIRED"].includes(status.status_code)) throw new Error("Reel processing failed: "+(status.status||status.status_code));
    await sleep(10000);
  }
  if(!ready) throw new Error("Reel container not ready; publishing deferred");
  const published=await graph(account+"/media_publish",{method:"POST",data:{creation_id:created.id}});
  if(!published.id) throw new Error("Instagram did not confirm a published media ID");
  return {id:published.id,recovered:false};
}
const config=cloudinaryConfig();
const assets=await listResources(config);
const groups=new Map();
for(const asset of assets){
  const c=custom(asset);
  if(!c.dropId || !c.pairId || c.source!=="automation") continue;
  const key=c.dropId+"/"+c.pairId;
  if(!groups.has(key)) groups.set(key,[]);
  groups.get(key).push(asset);
}
let publishedCount=0, failedCount=0,skippedCount=0;
for(const [key,group] of groups){
  const mobile=group.find(isMobile),desktop=group.find(a=>!isMobile(a));
  if(!mobile||!desktop){skippedCount++;console.warn("Missing wallpaper pair:",key);continue;}
  if(!due(mobile) && custom(mobile).igStatus!=="published") continue;
  if(!due(mobile) && custom(mobile).igStatus==="published" && custom(desktop).draft!=="true") continue;
  if(custom(mobile).publishAt!==custom(desktop).publishAt){failedCount++;console.error("Mismatched publication times:",key);continue;}
  try{
    const ctx=custom(mobile);
    if(ctx.igStatus==="published") {
      // Repair incomplete website release without duplicating Instagram content.
      if(ctx.draft==="true") await updateImageContext(mobile,{draft:"false"});
      if(custom(desktop).draft==="true") await updateImageContext(desktop,{draft:"false"});
      console.log("Repaired website release:",key);continue;
    }
    if(ctx.igStatus==="publishing") {
      const already=await getPublishedReel(String(ctx.igCaption||""));
      if(!already){skippedCount++;console.warn("Uncertain Instagram state; manual reconciliation required:",key);continue;}
      await updateImageContext(mobile,{igStatus:"published",igPostId:already.id});
    }else if(ctx.igStatus==="queued"){
      const post=await createAndPublish(mobile);
      await updateImageContext(mobile,{igStatus:"published",igPostId:post.id});
    }else{skippedCount++;continue;}
    await updateImageContext(mobile,{draft:"false"});
    await updateImageContext(desktop,{draft:"false"});
    console.log("Instagram published and website pair released:",key);
    publishedCount++;
  }catch(error){
    failedCount++;
    console.error("Could not complete pair "+key+": "+error.message);
  }
}
console.log(JSON.stringify({instagramPublished:publishedCount,failed:failedCount,skipped:skippedCount}));
if(failedCount) process.exitCode=1;
