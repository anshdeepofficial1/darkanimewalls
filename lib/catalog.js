// Cloudinary-backed catalog. Keep shared filters in one place for API + tests.
const TAG = process.env.CLOUDINARY_TAG || "dark-anime-walls";

function bool(value) {
  return value === true || ["true", "yes", "on", "1"].includes(String(value ?? "").trim().toLowerCase());
}
function list(value) {
  return String(value || "").split(",").map(x => x.trim()).filter(Boolean);
}
function cleanContext(resource) {
  return resource.context?.custom || {};
}
function publicationState(ctx, now = Date.now()) {
  const draft = bool(ctx.draft);
  const publishAt = String(ctx.publishAt || "");
  const ts = publishAt ? Date.parse(publishAt) : null;
  // Invalid dates are never released accidentally.
  return { draft, publishAt, isPublished: !draft && (!publishAt || (Number.isFinite(ts) && ts <= now)) };
}
function safeName(value) {
  return String(value || "wallpaper")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "").trim()
    .replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "wallpaper";
}
function wallpaperFromResource(resource, now = Date.now()) {
  const ctx = cleanContext(resource);
  const fallback = (resource.public_id || "wallpaper").split("/").pop();
  const title = ctx.title || fallback.replace(/[-_]/g, " ");
  const type = ctx.type || (resource.width > resource.height ? "Desktop 16:9" : "Mobile 9:16");
  const state = publicationState(ctx, now);
  const downloadName = safeName(title) + (resource.format ? "." + resource.format : "");
  const url = resource.secure_url || "";
  const downloadUrl = url ? url + (url.includes("?") ? "&" : "?") + "dl=" + encodeURIComponent(downloadName) : "";
  return {
    public_id: resource.public_id, title, category: ctx.category || "Dark Anime",
    type, mood: ctx.mood || "Mixed", tags: resource.tags || [],
    description: ctx.description || "Premium dark anime wallpaper.",
    resolution: resource.width + "x" + resource.height,
    width: resource.width, height: resource.height,
    imageUrl: url, downloadName, downloadUrl, createdAt: resource.created_at,
    draft: state.draft, publishAt: state.publishAt, isPublished: state.isPublished,
    extraTags: list(ctx.extraTags), pairId: ctx.pairId || "",
    dropId: ctx.dropId || "", instagramPostId: ctx.instagramPostId || ""
  };
}
async function fetchCatalog({cloudName, apiKey, apiSecret, tag = TAG, fetcher = fetch, pageSize = 500, maxPages = 20}) {
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary environment variables are missing.");
  const auth = Buffer.from(apiKey + ":" + apiSecret).toString("base64");
  const all = [];
  let cursor = "";
  const seen = new Set();
  for (let page = 0; page < maxPages; page++) {
    const url = new URL("https://api.cloudinary.com/v1_1/" + encodeURIComponent(cloudName) + "/resources/image/tags/" + encodeURIComponent(tag));
    url.searchParams.set("max_results", String(pageSize));
    url.searchParams.set("context", "true");
    if (cursor) url.searchParams.set("next_cursor", cursor);
    const response = await fetcher(url.toString(), {headers: {Authorization: "Basic " + auth}});
    let data;
    try { data = await response.json(); } catch { throw new Error("Invalid Cloudinary response"); }
    if (!response.ok) throw new Error(data.error?.message || "Cloudinary catalog request failed");
    all.push(...(data.resources || []));
    if (!data.next_cursor) return all;
    if (seen.has(data.next_cursor)) throw new Error("Cloudinary catalog pagination loop detected");
    cursor = data.next_cursor;
    seen.add(cursor);
  }
  throw new Error("Catalog exceeds configured pagination limit; refusing incomplete results");
}
function buildCatalog(resources, {studio = false, now = Date.now()} = {}) {
  return resources
    .filter(resource => !resource.tags?.includes("hidden"))
    .map(resource => wallpaperFromResource(resource, now))
    .filter(item => studio || item.isPublished)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
}
module.exports = {bool, list, publicationState, wallpaperFromResource, fetchCatalog, buildCatalog};
