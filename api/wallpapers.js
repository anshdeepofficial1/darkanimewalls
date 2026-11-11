const { fetchCatalog, buildCatalog } = require("../lib/catalog");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({error: "Method not allowed"});
  const studioRequested = ["true", "1"].includes(String(req.query?.studio || "").toLowerCase());
  const studioPassword = process.env.STUDIO_PASSWORD;
  // Never accept passwords in query strings (which may be logged and cached).
  const authorized = !!studioPassword && req.headers?.["x-studio-password"] === studioPassword;
  if (studioRequested && !authorized) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(401).json({error: "Invalid studio password."});
  }
  try {
    const resources = await fetchCatalog({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
      tag: process.env.CLOUDINARY_TAG || "dark-anime-walls"
    });
    const wallpapers = buildCatalog(resources, {studio: authorized, now: Date.now()});
    // A short cache is a compromise: publication becomes visible within roughly one
    // cache lifetime, not necessarily at an exact second.
    res.setHeader("Cache-Control", studioRequested ? "no-store" : "public, s-maxage=10, stale-while-revalidate=10");
    return res.status(200).json({wallpapers, total: wallpapers.length});
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    const configuration = /environment variables/.test(error.message);
    const pagination = /pagination/.test(error.message);
    return res.status(configuration ? 500 : pagination ? 503 : 502).json({error: error.message || "Catalog temporarily unavailable"});
  }
};
