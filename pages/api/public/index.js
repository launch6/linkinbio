// pages/api/public/index.js
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");

  const slug = String(req.query.slug || "").trim();

  return res.status(200).json({
    ok: true,
    version: "public-debug-v1",
    slug,
    note: "If you see this, you are hitting the new /api/public handler.",
  });
}
