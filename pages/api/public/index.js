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
  noStore(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
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
      { publicSlug: slug },
      {
        projection: {
          _id: 0,
          displayName: 1,
          bio: 1,
          collectEmail: 1,
          publicSlug: 1,
          products: 1,
          links: 1,
          social: 1,
        },
      }
    );

    if (!doc) {
      return send(res, 404, { ok: false, error: "not_found" });
    }

    const published = Array.isArray(doc.products)
      ? doc.products.filter((p) => !!p?.published)
      : [];

    const links = Array.isArray(doc.links)
      ? doc.links.filter(
          (l) =>
            l &&
            typeof l.url === "string" &&
            l.url.trim().length > 0
        )
      : [];

    return send(res, 200, {
      ok: true,
      profile: {
        displayName: doc.displayName || "",
        bio: doc.bio || "",
        collectEmail: !!doc.collectEmail,
        publicSlug: doc.publicSlug || slug,
        links,
        social: doc.social || {},
      },
      products: published,
    });
  } catch (err) {
    console.error("public:index ERROR", err?.message);
    return send(res, 500, { ok: false, error: "server_error" });
  }
}
