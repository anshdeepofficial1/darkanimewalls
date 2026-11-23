/*
 * Dynamic image sitemap for the public wallpaper collection.
 * Mirrors the existing /api/wallpapers published-only catalog, so hidden,
 * draft and scheduled items are not exposed to search engines.
 * Google image sitemap format: https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 */
const getWallpapers = require("./wallpapers");
const SITE = "https://darkanimewalls.vercel.app";
function xml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function isDesktop(w) {
  return /desktop/i.test(String(w.type || "")) || Number(w.width) > Number(w.height);
}
function isMobile(w) {
  return /mobile/i.test(String(w.type || "")) || Number(w.height) > Number(w.width);
}
module.exports = async function handler(req,res) {
  if(req.method !== "GET") {
    res.setHeader("Allow","GET");
    res.status(405).send("Method not allowed");
    return;
  }
  const capture = {
    code:200,
    data:null,
    status(n){this.code=n;return this},
    setHeader(){return this},
    json(payload){this.data=payload;return this}
  };
  try {
    await getWallpapers({method:"GET",query:{}},capture);
    if(capture.code !== 200 || !Array.isArray(capture.data?.wallpapers)) {
      res.status(503).send("Wallpaper catalogue temporarily unavailable");
      return;
    }
    const publicImages=capture.data.wallpapers.filter(w =>
      w.isPublished !== false && typeof w.imageUrl === "string" &&
      /^https:\/\/res\.cloudinary\.com\//.test(w.imageUrl)
    );
    const collections = [
      {path:"/explore.html", images:publicImages},
      {path:"/mobile-wallpapers.html", images:publicImages.filter(isMobile)},
      {path:"/desktop-wallpapers.html", images:publicImages.filter(isDesktop)}
    ];
    const chunks=[
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
    ];
    for(const collection of collections) {
      if(!collection.images.length)continue;
      chunks.push("  <url>","    <loc>"+xml(SITE+collection.path)+"</loc>");
      for(const w of collection.images) {
        chunks.push("    <image:image><image:loc>"+xml(w.imageUrl)+"</image:loc></image:image>");
      }
      chunks.push("  </url>");
    }
    chunks.push("</urlset>");
    res.setHeader("Content-Type","application/xml; charset=utf-8");
    res.setHeader("Cache-Control","s-maxage=600, stale-while-revalidate=3600");
    res.status(200).send(chunks.join("\n"));
  } catch(error) {
    res.status(503).send("Image sitemap temporarily unavailable");
  }
};