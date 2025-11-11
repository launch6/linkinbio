// pages/api/public/profile.js
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

// Small helper for headers so client doesn't cache this
function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const slug = String(req.query.slug || "").trim().toLowerCase();
    if (!slug) {
      return res.status(400).json({ ok: false, error: "missing_slug" });
    }

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");

    // Support either field name
    const doc = await Profiles.findOne(
      { $or: [{ publicSlug: slug }, { slug }] },
      {
        projection: {
          _id: 0,
          displayName: 1,
          bio: 1,
          collectEmail: 1,
          publicSlug: 1,
          slug: 1,
          products: 1,
        },
      }
    );

    if (!doc) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const products = Array.isArray(doc.products) ? doc.products : [];
    const published = products.filter((p) => !!p.published);

    const profile = {
      displayName: doc.displayName || doc.name || "Artist",
      bio: doc.bio || doc.description || "",
      collectEmail: !!doc.collectEmail,
      publicSlug: (doc.publicSlug || doc.slug || "").toLowerCase(),
    };

    return res.status(200).json({ ok: true, profile, products: published });
  } catch (err) {
    console.error("public/profile ERROR", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
