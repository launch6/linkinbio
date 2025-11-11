// pages/api/public/profile.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

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

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const slug = String(req.query.slug || "").trim();
    if (!slug) return res.status(400).json({ ok: false, error: "missing_slug" });

    const client = await getClient();
    const db = client.db(MONGODB_DB);

    const doc = await db.collection("profiles").findOne(
      { $or: [{ publicSlug: slug }, { slug }] },
      {
        projection: {
          _id: 0,
          displayName: 1,
          name: 1,
          bio: 1,
          description: 1,
          collectEmail: 1,
          klaviyoListId: 1, // not shown to client; only used to decide if capture is enabled
          products: 1,
        },
      }
    );

    if (!doc) return res.status(404).json({ ok: false, error: "not_found" });

    const profilePublic = {
      displayName: doc.displayName || doc.name || "Artist",
      bio: doc.bio || doc.description || "",
      collectEmail: !!doc.collectEmail,
    };

    const productsPublished = (Array.isArray(doc.products) ? doc.products : [])
      .filter(p => !!p.published)
      .map(p => ({
        id: p.id,
        title: p.title || "",
        priceUrl: p.priceUrl || "",
        imageUrl: p.imageUrl || "",
        dropEndsAt: p.dropEndsAt || "",
        unitsTotal: p.unitsTotal ?? "",
        unitsLeft: p.unitsLeft ?? "",
        published: true,
      }));

    return res.status(200).json({
      ok: true,
      slug,
      profile: profilePublic,
      products: productsPublished,
    });
  } catch (err) {
    console.error("public/profile ERROR", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
