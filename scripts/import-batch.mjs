// Prepare exactly ten checked wallpaper pairs as Cloudinary drafts.
// Usage: node scripts/import-batch.mjs batch.json
import {readFile, mkdir, mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {resolve, dirname, join} from "node:path";
import {execFileSync} from "node:child_process";
import {uploadAsset} from "./cloudinary.mjs";

function dimensions(path) {
  const result=JSON.parse(execFileSync("ffprobe",["-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","json",path],{encoding:"utf8"}));
  const {width,height}=result.streams?.[0] || {};
  if(!width||!height) throw new Error("Cannot inspect image dimensions: "+path);
  return {width,height};
}
function verifyRatio(path,expected) {
  const {width,height}=dimensions(path);
  const actual=width/height;
  if(Math.abs(actual-expected)>0.025) throw new Error("Wrong image ratio "+width+"x"+height+" for "+path);
  if(Math.min(width,height)<700) throw new Error("Low resolution wallpaper: "+path);
}
function safeId(value) {
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,70}$/.test(String(value||""))) throw new Error("Unsafe or missing ID");
  return value;
}
function safePath(base,path) {
  if(typeof path!=="string"||!path.trim()) throw new Error("Missing file path");
  return resolve(base,path);
}
function makeVideo(source,dest,audio) {
  const args=["-hide_banner","-loglevel","error","-y","-loop","1","-framerate","24","-i",source];
  if(audio) args.push("-i",audio);
  else args.push("-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=48000");
  args.push("-t","8","-vf","scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p",
    "-c:v","libx264","-preset","veryfast","-crf","22","-r","24",
    "-c:a","aac","-b:a","128k","-ar","48000","-movflags","+faststart",dest);
  execFileSync("ffmpeg",args,{stdio:"inherit"});
}
const [manifestFile]=process.argv.slice(2);
if(!manifestFile) throw new Error("Usage: node scripts/import-batch.mjs batch.json");
const absolute=resolve(manifestFile);
const manifest=JSON.parse(await readFile(absolute,"utf8"));
const base=dirname(absolute);
const dropId=safeId(manifest.dropId);
const character=String(manifest.character||"").trim();
if(!character) throw new Error("Missing chosen trending character");
if(!Array.isArray(manifest.pairs)||manifest.pairs.length!==10) throw new Error("Exactly ten mobile/desktop pairs are required");
const planned=[];
const pairIds=new Set();
for(const pair of manifest.pairs) {
  const pairId=safeId(pair.pairId);
  if(pairIds.has(pairId)) throw new Error("Duplicate pair ID: "+pairId);
  pairIds.add(pairId);
  if(pair.qaApproved!==true) throw new Error("A visual QA pass is required for "+pairId);
  const scheduledAt=Date.parse(pair.scheduledAt);
  if(!Number.isFinite(scheduledAt)||scheduledAt<Date.now()-300000) throw new Error("Invalid or expired release time for "+pairId);
  if(!String(pair.caption||"").trim()) throw new Error("Caption missing for "+pairId);
  const mobile=safePath(base,pair.mobileFile), desktop=safePath(base,pair.desktopFile);
  verifyRatio(mobile,9/16);
  verifyRatio(desktop,16/9);
  const audio=pair.audioFile?safePath(base,pair.audioFile):null;
  if(audio && pair.audioRightsConfirmed!==true) throw new Error("Audio rights must be confirmed for "+pairId);
  if(!audio && !pair.musicQuery && !pair.audioId && process.env.ALLOW_SILENT_REELS!=="true") throw new Error("Choose authorized Instagram Audio API music, licensed file, or explicitly allow silent Reels: "+pairId);
  planned.push({pair,pairId,mobile,desktop,audio,scheduledAt:new Date(scheduledAt).toISOString()});
}
if(process.env.CONFIRM_BATCH_IMPORT!=="true") throw new Error("Set CONFIRM_BATCH_IMPORT=true after reviewing the 10 concepts. No images were uploaded.");
const temp=await mkdtemp(join(tmpdir(),"daw-batch-"));
try {
  for(const item of planned) {
    const {pair,pairId,mobile,desktop,audio,scheduledAt}=item;
    const shared={title:String(pair.title||character+" wallpaper"),category:character,mood:String(pair.mood||"Cinematic"),
      description:String(pair.description||"Original dark anime wallpaper"),draft:"true",publishAt:scheduledAt,
      pairId,dropId,qaStatus:"approved",source:"automation",extraTags:String(pair.tags||"")};
    const videoPath=join(temp,pairId+".mp4");
    makeVideo(mobile,videoPath,audio);
    const movie=await uploadAsset({filePath:videoPath,kind:"video",publicId:dropId+"-"+pairId+"-reel",tags:[character.toLowerCase().replace(/\s+/g,"-")],context:{dropId,pairId}});
    const mobileUpload=await uploadAsset({filePath:mobile,publicId:dropId+"-"+pairId+"-mobile",
      tags:["mobile","automation"],context:{...shared,type:"Mobile 9:16",reelUrl:movie.secure_url,
        igCaption:String(pair.caption),igStatus:"queued",musicCredit:String(pair.musicCredit||""),musicQuery:String(pair.musicQuery||""),igAudioId:String(pair.audioId||"")}});
    const desktopUpload=await uploadAsset({filePath:desktop,publicId:dropId+"-"+pairId+"-desktop",
      tags:["desktop","automation"],context:{...shared,type:"Desktop 16:9",igStatus:"paired"}});
    console.log(JSON.stringify({pairId,scheduledAt,mobileId:mobileUpload.public_id,desktopId:desktopUpload.public_id,reelUrl:movie.secure_url}));
  }
} finally { await rm(temp,{recursive:true,force:true}); }
console.log("All ten pairs staged as private drafts. Publishing requires separate Instagram credentials and scheduler.");
