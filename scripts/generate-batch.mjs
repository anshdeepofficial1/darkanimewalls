// Paid OpenAI Images API provider, STRICTLY OPT-IN. ChatGPT Plus usage is not API billing.
// Usage: ENABLE_PAID_IMAGE_API=I_ACCEPT_SEPARATE_API_CHARGES OPENAI_API_KEY=... node scripts/generate-batch.mjs research.json out-dir
// Recompose 16:9 using the original 9:16 source centered on an outpainted background.
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve,join} from "node:path";
import {execFileSync} from "node:child_process";
import {scheduleTen,recentOwnerPosts} from "./schedule.mjs";
if(process.env.ENABLE_PAID_IMAGE_API!=="I_ACCEPT_SEPARATE_API_CHARGES") {
  throw new Error("Paid API disabled. ChatGPT Plus does not pay for unattended Images API usage. Nothing generated or charged.");
}
if(!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured; nothing generated");
const [input,dirArg] = process.argv.slice(2);
if(!input||!dirArg) throw new Error("Usage: node scripts/generate-batch.mjs research.json output-dir");
const research=JSON.parse(await readFile(resolve(input),"utf8"));
if(!research.selectedCharacter || !research.sources?.length) throw new Error("Research file must contain sourced current character evidence");
const outputDir=resolve(dirArg);
await mkdir(outputDir,{recursive:true});
const character=research.selectedCharacter;
const anime=research.selectedAnime||"anime";
const concepts=[
 ["Portrait","Cinematic painterly portrait, thoughtful 3/4 gaze, pale early morning light, empty soft architecture above, natural skin shading, navy and amber."],
 ["Ink","Beautiful hand-inked manga illustration with subtle screen tones, detailed brushwork, mostly monochrome with one precise vermilion accent, unusual diagonal layout."],
 ["Rain","Quiet narrow Japanese street after rain, character standing in lower-middle with umbrella and reflections, realistic cloth folds, wide negative space above."],
 ["Silhouette","Minimal atmospheric silhouette against luminous distant skyline, small figure, beautiful controlled graphic composition, deep violet and muted blue."],
 ["Action","Dynamic action frozen in time, off-axis perspective, visible accurate hands and anatomy, readable body pose, restrained energy details not generic neon flames."],
 ["Forest","Melancholic forest trail with filtered afternoon sunlight and floating dust, character seated lower down, warm greens and delicate cel shading."],
 ["Profile","Close side profile with soft cold rim-light and realistic hair strands, elegant asymmetry, atmospheric mist and black negative space."],
 ["Rooftop","Quiet city rooftop at golden hour, character contemplative and looking toward the horizon, long shadows, vast open sky."],
 ["Poster","Sophisticated handmade Japanese illustration poster with controlled texture but no letters or typography, striking red/black/cream graphic design."],
 ["Epic","Majestic yet restrained hero scene with monumental scenery, beautiful depth and environmental storytelling, cinematic blue/bronze palette."]
];
const SIZE_MOBILE="1152x2048",SIZE_DESKTOP="2048x1152";
let attempts=0;
async function api(path,body) {
  if(++attempts>30) throw new Error("Hard limit of 30 API requests reached; no further charges attempted");
  const resp=await fetch("https://api.openai.com/v1/"+path,{
    method:"POST",headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const data=await resp.json();
  if(!resp.ok) throw new Error("OpenAI Images API failed: "+(data.error?.message||resp.status));
  if(!data.data?.[0]?.b64_json) throw new Error("Image API did not return image data");
  return Buffer.from(data.data[0].b64_json,"base64");
}
async function generateImage(prompt,size) {
  return api("images/generations",{model:"gpt-image-2.5-sunburst",size,quality:"high",output_format:"png",prompt});
}
async function editImage(original,prompt,size) {
  return api("images/edits",{model:"gpt-image-2.5-sunburst",size,quality:"high",output_format:"png",
    images:[{image_url:"data:image/png;base64,"+original.toString("base64")}],prompt});
}
async function visionReview(image,condition,preview=null) {
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",headers:{"Authorization":"Bearer "+process.env.OPENAI_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({model:process.env.OPENAI_QA_MODEL||"gpt-4.1-mini",input:[{
      role:"user",content:[{type:"input_text",text:"Evaluate this "+condition+
      " wallpaper strictly for visibly malformed anatomy, off-model character depiction of "+character+
      ", cheap repetitive neon effects, visual noise, unreadable silhouette, and poor wallpaper usability. For mobile, upper 22 percent must have unobstructed space for phone clock and widgets; do not reject a small unobtrusive skyline. Respond ONLY JSON {pass:boolean,reason:string}. Reject obviously bad images."},
      {type:"input_image",image_url:"data:image/png;base64,"+image.toString("base64")},
      ...(preview?[{type:"input_text",text:"Second image shows a simulated phone lockscreen clock overlaid for QA only. The clock is NOT in the original artwork. Reject if the clock obscures the character's face or key focal details."},{type:"input_image",image_url:"data:image/png;base64,"+preview.toString("base64")}]:[])]}
    ],max_output_tokens:180})
  });
  const data=await response.json();
  if(!response.ok) throw new Error("Vision QA failed: "+(data.error?.message||response.status));
  const text=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==="output_text").map(x=>x.text).join("");
  try {
    const verdict=JSON.parse(text.replace(/^```(?:json)?/,"").replace(/```$/,"").trim());
    return verdict.pass===true;
  } catch {return false;}
}
function renderLockscreenPreview(source,dest) {
  execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-y","-i",source,
    "-vf","drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='09\\\\:41':fontcolor=white:fontsize=148:x=(w-text_w)/2:y=h*0.10:shadowcolor=black:shadowx=2:shadowy=2",
    "-frames:v","1",dest],{stdio:"inherit"});
}
function compositeExactCenter(backgroundPath,mobilePath,desktopPath) {
  execFileSync("ffmpeg",["-hide_banner","-loglevel","error","-y","-i",backgroundPath,"-i",mobilePath,
    "-filter_complex","[1:v]scale=648:1152[centre];[0:v][centre]overlay=x=(main_w-overlay_w)/2:y=0:format=auto,format=rgb24[out]",
    "-map","[out]","-frames:v","1",desktopPath],{stdio:"inherit"});
}
const {basis:scheduleBasis,scheduledAt:publishSchedule}=scheduleTen(Date.now(),await recentOwnerPosts());
const day=new Date(Date.now()+330*60000).toISOString().slice(0,10);
const dropId="daw-"+day.replace(/-/g,"");
const result={dropId,character,researchSources:research.sources,scheduleBasis,pairs:[]};
for(let i=0;i<concepts.length;i++){
  const [name,brief]=concepts[i],index=String(i+1).padStart(2,"0");
  const mainPrompt="Create one outstanding ORIGINAL 9:16 2D anime wallpaper of "+character+
    " from "+anime+". Faithfully preserve unmistakable canonical hair, face, costume and identity. Art-directed like premium artist-made anime illustration, beautiful purposeful scene, no text, logos or watermarks. "+
    brief+" Composition rule: upper 22 percent remains visually quiet to accommodate lockscreen clock; show important face and hands below that area. Crisp anatomy, coherent costume and perspective. No collage, no split panels.";
  const mobile=await generateImage(mainPrompt,SIZE_MOBILE);
  const mobileFile=join(outputDir,index+"-mobile.png");
  await writeFile(mobileFile,mobile);
  const lockPreviewPath=join(outputDir,index+"-lockscreen-preview.png");
  renderLockscreenPreview(mobileFile,lockPreviewPath);
  if(!(await visionReview(mobile,"mobile 9:16",await readFile(lockPreviewPath)))) throw new Error("Visual QA rejected mobile design "+index+". No incomplete batch will be imported.");
  const extendPrompt="Extend this EXACT 9:16 anime wallpaper to a 16:9 desktop scene. Keep the original character's facial features, exact position, pose, outfit, lighting and all content in the center identical. Create only natural matching scenery to the left and right, the central 9:16 scene fills the full height, no borders or cropping. No text. Art direction: "+brief;
  const outpaint=await editImage(mobile,extendPrompt,SIZE_DESKTOP);
  const outpaintPath=join(outputDir,index+"-extended-background.png");
  await writeFile(outpaintPath,outpaint);
  const desktopFile=join(outputDir,index+"-desktop.png");
  compositeExactCenter(outpaintPath,mobileFile,desktopFile);
  const desktop=await readFile(desktopFile);
  if(!(await visionReview(desktop,"desktop 16:9 outpaint"))) throw new Error("Visual QA rejected desktop design "+index+". No incomplete batch will be imported.");
  result.pairs.push({pairId:index,title:character+" — "+name,mood:name,description:brief,
    mobileFile:index+"-mobile.png",desktopFile:index+"-desktop.png",caption:
      character+" — "+name+" ✨\nSave this wallpaper and download both versions from darkanimewalls.vercel.app\n#AnimeWallpaper #"+character.replace(/[^a-zA-Z0-9]/g,"")+" #DarkAnimeWalls",
    scheduledAt:publishSchedule[i],qaApproved:true,qaProvider:"image-vision-review",
    audioFile:null,musicQuery:["cinematic piano","manga dark instrumental","rain lofi","ambient night","dramatic phonk","forest lofi","dreamy slow reverb","city pop instrumental","dark cinematic","epic orchestral"][i],musicCredit:"Meta-authorized music selected at publish time"});
  console.log("Completed image pair "+(i+1)+"/10");
}
await writeFile(join(outputDir,"batch.json"),JSON.stringify(result,null,2));
console.log("Created exactly 10 validated pairs. Batch remains unimported: licensed audio and explicit import confirmation required.");
