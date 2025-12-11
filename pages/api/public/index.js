// pages/api/public.js
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

// GET /api/public?slug=...
export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  const slugRaw = String(req.query.slug || "").trim();
  if (!slugRaw) {
    return send(res, 400, { ok: false, error: "Missing slug" });
  }

  const slug = slugRaw.toLowerCase();

  try {
    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");
    const Products = db.collection("products");

    // Find profile by publicSlug OR slug
    const profileDoc = await Profiles.findOne(
      {
        $or: [
          { publicSlug: slug },
          { slug },
        ],
      },
      {
        projection: {
          _id: 0,
          editToken: 1,
          plan: 1,
          displayName: 1,
          name: 1,
          publicSlug: 1,
          slug: 1,
          status: 1,
          bio: 1,
          collectEmail: 1,
          klaviyoListId: 1,
          links: 1,
          social: 1,
          avatarUrl: 1, // ✅ include avatar
        },
      }
    );

    if (!profileDoc) {
      return send(res, 404, { ok: false, error: "profile_not_found" });
    }

    const links = Array.isArray(profileDoc.links)
      ? profileDoc.links.filter(
          (l) =>
            l &&
            typeof l.url === "string" &&
            l.url.trim().length > 0
        )
      : [];

    // Pull published products for this profile via editToken
    const products = await Products.find(
      {
        editToken: profileDoc.editToken,
        published: true,
      },
      {
        projection: {
          _id: 0,
          id: 1,
          title: 1,
          description: 1,
          imageUrl: 1,
          priceCents: 1,
          priceDisplay: 1,
          priceFormatted: 1,
          priceText: 1,
          buttonText: 1,
          priceUrl: 1,
          unitsLeft: 1,
          unitsTotal: 1,
          dropStartsAt: 1,
          dropEndsAt: 1,
          showTimer: 1,
          showInventory: 1,
          published: 1,
        },
      }
    ).toArray();

    return send(res, 200, {
      ok: true,
      profile: {
        editToken: profileDoc.editToken,
        plan: profileDoc.plan || "free",
        displayName: profileDoc.displayName || profileDoc.name || "",
        name: profileDoc.name || "",
        publicSlug: profileDoc.publicSlug || profileDoc.slug || "",
        slug: profileDoc.slug || "",
        status: profileDoc.status || "active",
        bio: profileDoc.bio || "",
        collectEmail: !!profileDoc.collectEmail,
        klaviyoListId: profileDoc.klaviyoListId || "",
        avatarUrl: profileDoc.avatarUrl || "", // ✅ expose to frontend
        links,
        social: profileDoc.social || {},
      },
      products: Array.isArray(products) ? products : [],
    });
  } catch (err) {
    console.error("public ERROR", err?.message || err);
    return send(res, 500, { ok: false, error: "server_error" });
  }
}
