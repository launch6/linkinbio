// pages/api/public/index.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// --- DB bootstrap with global cache ---
let _client = global._launch6MongoClient;
async function getClient() {
  if (_client) return _client;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  const c = new MongoClient(MONGODB_URI);
  await c.connect();
  _client = c;
  global._launch6MongoClient = c;
  return c;
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

function send(res, status, body) {
  noStore(res);
  return res.status(status).json(body);
}

/**
 * GET /api/public?slug=mark
 * Returns a public-safe payload for the profile + published products.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    noStore(res);
    return res.status(405).end("Method Not Allowed");
  }

  const slug = String(req.query.slug || "").trim();
  if (!slug) {
    return send(res, 400, { ok: false, error: "missing_slug" });
  }

  try {
    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");

    // Only expose public-safe fields
    const doc = await Profiles.findOne(
      {
        $or: [
          { publicSlug: slug },
          { slug }, // legacy fallback
        ],
      },
      {
        projection: {
          _id: 0,
          displayName: 1,
          name: 1,
          bio: 1,
          description: 1,
          collectEmail: 1,
          publicSlug: 1,
          slug: 1,
          products: 1,

          // socials – support both old and new shapes
          social: 1,
          socialLinks: 1,
          instagram: 1,
          tiktok: 1,
          youtube: 1,
          twitter: 1,
          facebook: 1,
          website: 1,

          // custom links
          links: 1,
        },
      }
    );

    if (!doc) {
      return send(res, 404, { ok: false, error: "not_found" });
    }

    const published = Array.isArray(doc.products)
      ? doc.products.filter((p) => !!p?.published)
      : [];

    // Normalize socials into profile.social
    const rawSocial = doc.social || doc.socialLinks || {};
    const social = {
      instagram: rawSocial.instagram || doc.instagram || "",
      facebook: rawSocial.facebook || doc.facebook || "",
      tiktok: rawSocial.tiktok || doc.tiktok || "",
      youtube: rawSocial.youtube || doc.youtube || "",
      x: rawSocial.x || rawSocial.twitter || doc.twitter || "",
      website: rawSocial.website || doc.website || "",
    };

    // Normalize links into profile.links
    const rawLinks = Array.isArray(doc.links) ? doc.links : [];
    const links = rawLinks.map((l) => ({
      id: String(l?.id || "").trim() || `link_${Math.random().toString(36).slice(2, 10)}`,
      label: String(l?.label || "").trim() || String(l?.url || ""),
      url: String(l?.url || "").trim(),
    }));

    return send(res, 200, {
      ok: true,
      profile: {
        displayName: doc.displayName || doc.name || "",
        bio: doc.bio || doc.description || "",
        collectEmail: !!doc.collectEmail,
        publicSlug: doc.publicSlug || doc.slug || slug,
        social,
        links,
      },
      products: published,
    });
  } catch (err) {
    console.error("public:index ERROR", err?.message);
    return send(res, 500, { ok: false, error: "server_error" });
  }
}
