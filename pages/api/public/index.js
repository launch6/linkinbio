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

// GET /api/public?slug=<publicSlug or slug>
export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  const rawSlug = String(req.query.slug || "").trim().toLowerCase();
  if (!rawSlug) {
    return send(res, 400, { ok: false, error: "missing_slug" });
  }

  try {
    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");
    const Products = db.collection("products");

    // 1) Find profile by publicSlug or slug
    const profileDoc = await Profiles.findOne(
      {
        $or: [{ publicSlug: rawSlug }, { slug: rawSlug }],
      },
      {
        projection: {
          _id: 1,
          editToken: 1,
          plan: 1,
          displayName: 1,
          name: 1,
          publicSlug: 1,
          slug: 1,
          status: 1,
          bio: 1,
          description: 1,
          collectEmail: 1,
          klaviyoListId: 1,
          links: 1,
          social: 1,
          avatarUrl: 1,
          imageUrl: 1,
        },
      }
    );

    if (!profileDoc) {
      return send(res, 404, { ok: false, error: "profile_not_found" });
    }

    // 2) Load *published* products tied to this profile
    const productsRaw = await Products.find(
      {
        $and: [
          {
            $or: [
              // cover multiple possible shapes
              { profileSlug: profileDoc.slug || rawSlug },
              { profileSlug: profileDoc.publicSlug || rawSlug },
              { profileEditToken: profileDoc.editToken },
            ],
          },
          { published: true },
        ],
      },
      {
        projection: {
          _id: 1,
          title: 1,
          description: 1,
          imageUrl: 1,
          priceUrl: 1,
          priceCents: 1,
          priceDisplay: 1,
          priceText: 1,
          dropStartsAt: 1,
          dropEndsAt: 1,
          showTimer: 1,
          showInventory: 1,
          unitsLeft: 1,
          unitsTotal: 1,
          buttonText: 1,
          published: 1,
        },
      }
    ).toArray();

    const products = productsRaw.map((p) => ({
      id: String(p._id),
      title: p.title || "",
      description: p.description || "",
      imageUrl: p.imageUrl || "",
      priceUrl: p.priceUrl || "",
      priceCents: typeof p.priceCents === "number" ? p.priceCents : null,
      priceDisplay: p.priceDisplay || "",
      priceText: p.priceText || "",
      dropStartsAt: p.dropStartsAt || null,
      dropEndsAt: p.dropEndsAt || null,
      showTimer: !!p.showTimer,
      showInventory: !!p.showInventory,
      unitsLeft:
        typeof p.unitsLeft === "number" ? p.unitsLeft : null,
      unitsTotal:
        typeof p.unitsTotal === "number" ? p.unitsTotal : null,
      buttonText: p.buttonText || "",
      published: !!p.published,
    }));

    // Normalized links (only keep ones with a URL)
    const links = Array.isArray(profileDoc.links)
      ? profileDoc.links.filter(
          (l) =>
            l &&
            typeof l.url === "string" &&
            l.url.trim().length > 0
        )
      : [];

    return send(res, 200, {
      ok: true,
      profile: {
        displayName: profileDoc.displayName || profileDoc.name || "",
        name: profileDoc.name || "",
        publicSlug:
          profileDoc.publicSlug || profileDoc.slug || rawSlug,
        slug: profileDoc.slug || rawSlug,
        status: profileDoc.status || "active",
        plan: profileDoc.plan || "free",

        // 🔥 KEY BIT: bring description back for old + new records
        bio: profileDoc.bio || profileDoc.description || "",
        description: profileDoc.description || profileDoc.bio || "",

        collectEmail: !!profileDoc.collectEmail,
        klaviyoListId: profileDoc.klaviyoListId || "",
        avatarUrl: profileDoc.avatarUrl || profileDoc.imageUrl || "",
        links,
        social: profileDoc.social || {},
      },
      products,
    });
  } catch (err) {
    console.error("public:index ERROR", err?.message || err);
    return send(res, 500, { ok: false, error: "server_error" });
  }
}
