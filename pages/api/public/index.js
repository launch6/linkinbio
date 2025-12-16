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
  res.setHeader("x-public-version", "v1-published-sanitize");
}

function safeString(v, maxLen = 2000) {
  if (typeof v !== "string") return "";
  const s = v.replace(/[\u0000-\u001F\u007F]/g, "").trim(); // strip control chars
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

// React already escapes string output, so do NOT HTML-escape to &amp; etc.
// Instead, strip tags to prevent any stored HTML from being replayed elsewhere.
function stripTags(s) {
  return s.replace(/<[^>]*>/g, "");
}

function safeText(v, maxLen = 2000) {
  return stripTags(safeString(v, maxLen));
}

function safeUrl(v) {
  const s = safeString(v, 2048);
  if (!s) return "";
  try {
    const u = new URL(s);
    const p = u.protocol.toLowerCase();
    if (p !== "http:" && p !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function sanitizeLinks(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((l) => {
      if (!l || typeof l !== "object") return null;
      const url = safeUrl(l.url);
      if (!url) return null;
      return {
        id: safeString(l.id || "", 120) || undefined,
        label: safeText(l.label || "", 160) || undefined,
        url,
      };
    })
    .filter(Boolean);
}

function sanitizeSocial(social) {
  const s = social && typeof social === "object" ? social : {};
  return {
    instagram: safeUrl(s.instagram),
    facebook: safeUrl(s.facebook),
    tiktok: safeUrl(s.tiktok),
    youtube: safeUrl(s.youtube),
    x: safeUrl(s.x),
    website: safeUrl(s.website),
  };
}

function sanitizeProduct(p) {
  const obj = p && typeof p === "object" ? p : {};
  const imageUrl = safeUrl(obj.imageUrl);

  // Keep common fields your UI expects; strip any HTML from text.
  return {
    id: safeString(obj.id || obj._id || "", 120),
    published: !!obj.published,
    title: safeText(obj.title || "", 200),
    description: safeText(obj.description || "", 5000),
    imageUrl: imageUrl || null,

    // optional UI fields
    buttonText: safeText(obj.buttonText || "", 80),
    priceDisplay: safeText(obj.priceDisplay || obj.priceFormatted || obj.priceText || "", 80),

    // inventory + timer fields (pass-through safely)
    showInventory: !!obj.showInventory,
    unitsLeft: typeof obj.unitsLeft === "number" ? obj.unitsLeft : obj.unitsLeft == null ? null : Number(obj.unitsLeft),
    unitsTotal: typeof obj.unitsTotal === "number" ? obj.unitsTotal : obj.unitsTotal == null ? null : Number(obj.unitsTotal),

    showTimer: !!obj.showTimer,
    dropStartsAt: obj.dropStartsAt || null,
    dropEndsAt: obj.dropEndsAt || null,
  };
}

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const slug = safeString(req.query?.slug || "", 120);
    if (!slug) return res.status(400).json({ ok: false, error: "missing_slug" });

    const client = await getClient();
    const db = client.db(MONGODB_DB);

    const Profiles = db.collection("profiles");

    // Pull only what the public page needs. Keep editToken INTERNAL (used to fetch products).
    const profileDoc = await Profiles.findOne(
      { $or: [{ publicSlug: slug }, { slug }] },
      {
        projection: {
          _id: 0,
          editToken: 1,

          // display fields
          displayName: 1,
          name: 1,
          bio: 1,
          description: 1,

          // images + urls
          avatarUrl: 1,
          imageUrl: 1,
          avatar: 1,

          links: 1,
          social: 1,

          // email capture config + text
          showForm: 1,
          collectEmail: 1,
          collectName: 1,
          formHeadline: 1,
          emailHeadline: 1,

          // fallback if you ever stored products on profile
          products: 1,
        },
      }
    );

    if (!profileDoc) {
      return res.status(404).json({ ok: false, error: "profile_not_found" });
    }

    const editToken = safeString(profileDoc.editToken || "", 200);

    // Sanitize/shape profile for public response (and remove internal fields)
    const profile = {
      displayName: safeText(profileDoc.displayName || "", 200),
      name: safeText(profileDoc.name || "", 200),
      bio: safeText(profileDoc.bio || profileDoc.description || "", 5000),

      avatarUrl: safeUrl(profileDoc.avatarUrl) || safeUrl(profileDoc.imageUrl) || safeUrl(profileDoc.avatar) || null,

      links: sanitizeLinks(profileDoc.links),
      social: sanitizeSocial(profileDoc.social),

      showForm: profileDoc.showForm,
      collectEmail: !!profileDoc.collectEmail,
      collectName: !!profileDoc.collectName,
      formHeadline: safeText(profileDoc.formHeadline || "", 240),
      emailHeadline: safeText(profileDoc.emailHeadline || "", 240),
    };

    // Products: published-only (server-enforced)
    let products = [];

    // Preferred: separate products collection keyed by editToken
    if (editToken) {
      try {
        const Products = db.collection("products");
        const rows = await Products.find({ editToken, published: true }).toArray();
        if (Array.isArray(rows) && rows.length) {
          products = rows;
        }
      } catch {
        // ignore and fallback to profile.products
      }
    }

    // Fallback: products stored on profile document
    if (!products.length && Array.isArray(profileDoc.products)) {
      products = profileDoc.products.filter((p) => !!p?.published);
    }

    const sanitizedProducts = Array.isArray(products)
      ? products.map(sanitizeProduct).filter((p) => p && p.published)
      : [];

    return res.status(200).json({ ok: true, profile, products: sanitizedProducts });
  } catch (err) {
    console.error("public ERROR", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
