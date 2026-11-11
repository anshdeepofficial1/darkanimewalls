import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {basename} from "node:path";

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
};
export function cloudinaryConfig() {
  return {name: required("CLOUDINARY_CLOUD_NAME"), key: required("CLOUDINARY_API_KEY"), secret: required("CLOUDINARY_API_SECRET"), folder: process.env.CLOUDINARY_FOLDER || "dark-anime-walls", tag: process.env.CLOUDINARY_TAG || "dark-anime-walls"};
}
function sign(fields, secret) {
  const data = Object.entries(fields)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => k + "=" + v).join("&");
  return createHash("sha1").update(data + secret).digest("hex");
}
const clean = value => String(value ?? "").replace(/[|=<>]/g, " ").trim().slice(0, 900);
export function contextString(data) {
  return Object.entries(data).filter(([,value]) => value !== undefined && value !== null)
    .map(([key,value]) => {
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) throw new Error("Invalid context key");
      return key + "=" + clean(value);
    }).join("|");
}
async function cloudinaryRequest(url, form, config) {
  const params = Object.fromEntries([...form.entries()].filter(([key]) => key !== "file" && key !== "api_key" && key !== "signature"));
  form.set("api_key", config.key);
  form.set("signature", sign(params, config.secret));
  const response = await fetch(url, {method:"POST", body:form});
  const result = await response.json();
  if (!response.ok) throw new Error("Cloudinary error: " + (result.error?.message || response.status));
  return result;
}
export async function uploadAsset({filePath, publicId, kind="image", context={}, tags=[], config=cloudinaryConfig()}) {
  const timestamp = Math.floor(Date.now()/1000);
  const form = new FormData();
  form.set("timestamp",String(timestamp));
  form.set("folder",config.folder);
  form.set("public_id",publicId);
  form.set("overwrite","false");
  form.set("context",contextString(context));
  form.set("tags",[config.tag,...tags].filter(Boolean).join(","));
  const bytes = await readFile(filePath);
  const type = kind === "video" ? "video/mp4" : /\.jpe?g$/i.test(filePath) ? "image/jpeg" : "image/png";
  form.set("file",new Blob([bytes],{type}),basename(filePath));
  return cloudinaryRequest("https://api.cloudinary.com/v1_1/"+config.name+"/"+kind+"/upload",form,config);
}
export async function updateImageContext(resource, change, config=cloudinaryConfig()) {
  const timestamp = Math.floor(Date.now()/1000);
  const form = new FormData();
  form.set("timestamp",String(timestamp));
  form.set("public_id",resource.public_id);
  form.set("type","upload");
  form.set("context",contextString({...resource.context?.custom, ...change}));
  // Explicit metadata operations preserve existing tag classification.
  if (Array.isArray(resource.tags)) form.set("tags", resource.tags.join(","));
  const result = await cloudinaryRequest("https://api.cloudinary.com/v1_1/"+config.name+"/image/explicit",form,config);
  resource.context = {custom:{...resource.context?.custom,...change}};
  return result;
}
export async function listResources(config=cloudinaryConfig()) {
  const auth=Buffer.from(config.key+":"+config.secret).toString("base64");
  const assets=[];
  let cursor="";
  const seen=new Set();
  for(let i=0;i<50;i++) {
    const url = new URL("https://api.cloudinary.com/v1_1/"+config.name+"/resources/image/tags/"+encodeURIComponent(config.tag));
    url.searchParams.set("max_results","500");
    url.searchParams.set("context","true");
    if(cursor) url.searchParams.set("next_cursor",cursor);
    const r=await fetch(url,{headers:{Authorization:"Basic "+auth}});
    const v=await r.json();
    if(!r.ok) throw new Error("Cloudinary list failed: "+(v.error?.message||r.status));
    assets.push(...(v.resources||[]));
    if(!v.next_cursor) return assets;
    if(seen.has(v.next_cursor)) throw new Error("Pagination loop");
    seen.add(v.next_cursor);
    cursor=v.next_cursor;
  }
  throw new Error("Cloudinary listing exceeded safety bound");
}
