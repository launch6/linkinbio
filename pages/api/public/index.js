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

// --- minimal defang + url validation (preserves production data:image/ images) ---
function defangText(v, maxLen = 5000) {
  let s = typeof v === "string" ? v : v == null ? "" : String(v);
  s = s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, maxLen);
  // Neutralize tag injection without changing frontend rendering
  s = s.replace(/[<>]/g, "");
  return s.trim();
}

function isHttpUrl(s) {
  return typeof s === "string" && (s.startsWith("http://") || s.startsWith("https://"));
}

function isRelativePath(s) {
  return typeof s === "string" && s.startsWith("/") && !s.startsWith("//");
}

function isDataImage(s) {
  if (typeof s !== "string" || !s.startsWith("data:image/")) return false;
  // data:image/<subtype>[;...]
  const subtype = s.substring(11).split(";")[0];
  // Allow only safe raster types; explicitly blocks svg+xml
  return ["jpeg", "jpg", "png", "webp", "gif"].includes(String(subtype || "").toLowerCase());
}

// For image src fields: allow http/https, allow /relative, allow data:image/ (production uses this)
function sanitizeImageSrc(v) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  if (isHttpUrl(s)) return s;
  if (isRelativePath(s)) return s;
  if (isDataImage(s)) return s;
  return "";
}

// Heuristic: allow bare domains like "example.com/path" by prepending https://
// (keeps behavior aligned with your frontend normalizeHref, but enforced server-side)
function normalizeSchemelessToHttps(s) {
  if (typeof s !== "string") return "";
  const t = s.trim();
  if (!t) return "";

  // keep relative paths as-is (they’ll be rejected by sanitizeHrefLink anyway)
  if (t.startsWith("/")) return t;

  // reject obvious whitespace early
  if (/\s/.test(t)) return "";

  // allow these schemes to pass through unchanged
  if (/^https?:\/\//i.test(t)) return t;
  if (/^(mailto:|tel:)/i.test(t)) return t;

  // If it *looks* like it has a scheme, distinguish real schemes from host:port
  // e.g. "example.com:3000" should be treated as schemeless and become https://example.com:3000
  const m = t.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (m) {
    const beforeColon = String(m[1] || "");
    if (beforeColon.includes(".")) return `https://${t}`; // host:port case
    return t; // real scheme like javascript:, data:, etc. (sanitizers will drop it)
  }

  // plain bare domain/path
  if (t.includes(".")) return `https://${t}`;

  return t;
}

// For clickable profile links + social: allow http/https, mailto:, tel:, and schemeless -> https://
function sanitizeHrefLink(v) {
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return "";

  const s = normalizeSchemelessToHttps(raw);

  if (s.startsWith("mailto:") || s.startsWith("tel:")) return s;
  if (isHttpUrl(s)) return s;

  return "";
}

// For product priceUrl: allow http/https only (plus schemeless -> https://), block mailto/tel/relative/data/javascript
function sanitizeHrefPrice(v) {
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return "";
  const s = normalizeSchemelessToHttps(raw);
  if (isHttpUrl(s)) return s;
  return "";
}

// Sanitize social object defensively (only allow known keys and safe hrefs)
function sanitizeSocialObject(socialRaw) {
  const s = socialRaw && typeof socialRaw === "object" ? socialRaw : {};
  return {
    instagram: sanitizeHrefLink(s.instagram || ""),
    facebook: sanitizeHrefLink(s.facebook || ""),
    tiktok: sanitizeHrefLink(s.tiktok || ""),
    youtube: sanitizeHrefLink(s.youtube || ""),
    x: sanitizeHrefLink(s.x || ""),
    website: sanitizeHrefLink(s.website || ""),
  };
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

    // 1) Find profile by publicSlug or slug
    const profileDoc = await Profiles.findOne(
      { $or: [{ publicSlug: rawSlug }, { slug: rawSlug }] },
      {
        projection: {
          collectName: 1,
          klaviyoEnabled: 1,
          formHeadline: 1,
          formSubtext: 1,
          plan: 1,
          _id: 1,
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
          products: 1,
        },
      }
    );

    if (!profileDoc) {
      return send(res, 404, { ok: false, error: "profile_not_found" });
    }

// --- Non-blocking analytics ---
// IMPORTANT: only count a "real" page view when explicitly requested.
// This prevents inflation from polling (15s refresh) and visibility refreshes.
const trackView = String(req.query.trackView || "") === "1";

// Optional lightweight bot filter (keeps your counter cleaner; tune later)
const ua = String(req.headers["user-agent"] || "").toLowerCase();
const looksLikeBot =
  ua.includes("bot") ||
  ua.includes("spider") ||
  ua.includes("crawler") ||
  ua.includes("headless") ||
  ua.includes("lighthouse");

if (trackView && !looksLikeBot && profileDoc._id) {
  Profiles.updateOne(
    { _id: profileDoc._id },
    {
      $inc: { viewCount: 1 },
      $set: { lastViewedAt: new Date() },
    }
  ).catch((e) => console.error("public:viewCount update failed", e?.message || e));
}

    // 2) Load *published* products from this profile
    const productsRaw = Array.isArray(profileDoc.products) ? profileDoc.products : [];

    const products = productsRaw
      // treat products with no `published` flag as published
      .filter((p) => p && (p.published === undefined ? true : !!p.published))
      .map((p) => ({
        id: String(p.id || ""),
        title: defangText(p.title || "", 200),
        description: defangText(p.description || "", 5000),
        imageUrl: sanitizeImageSrc(p.imageUrl || ""),
        priceUrl: sanitizeHrefPrice(p.priceUrl || ""),
        priceCents: typeof p.priceCents === "number" ? p.priceCents : null,
        priceDisplay: defangText(p.priceDisplay || "", 80),
        priceText: defangText(p.priceText || "", 80),
        dropStartsAt: p.dropStartsAt || null,
        dropEndsAt: p.dropEndsAt || null,
        showTimer: !!p.showTimer,
        showInventory: p.showInventory === undefined ? true : !!p.showInventory,
        unitsLeft: typeof p.unitsLeft === "number" ? p.unitsLeft : null,
        unitsTotal: typeof p.unitsTotal === "number" ? p.unitsTotal : null,
        buttonText: defangText(p.buttonText || "", 80),
        published: p.published === undefined ? true : !!p.published,
      }));

    // 3) Normalize links (http/https + mailto/tel + schemeless -> https)
    const links = Array.isArray(profileDoc.links)
      ? profileDoc.links
          .map((l) => {
            const url = sanitizeHrefLink(l?.url || "");
            if (!url) return null;
            return {
              ...l,
              label: defangText(l?.label || "", 80),
              url,
            };
          })
          .filter(Boolean)
      : [];

    const social = sanitizeSocialObject(profileDoc.social);

    return send(res, 200, {
      ok: true,
      profile: {
        displayName: defangText(profileDoc.displayName || profileDoc.name || "", 120),
        name: defangText(profileDoc.name || "", 120),
        publicSlug: defangText(profileDoc.publicSlug || profileDoc.slug || rawSlug, 80),
        slug: defangText(profileDoc.slug || rawSlug, 80),
        status: defangText(profileDoc.status || "active", 40),
        plan: defangText(profileDoc.plan || "free", 40),

        // bring description back for old + new records
        bio: defangText(profileDoc.bio || profileDoc.description || "", 5000),
        description: defangText(profileDoc.description || profileDoc.bio || "", 5000),

        collectEmail: !!profileDoc.collectEmail,
        showForm: !!profileDoc.collectEmail,
        collectName: !!profileDoc.collectName,
        klaviyoEnabled: !!profileDoc.klaviyoEnabled,
        formHeadline: defangText(profileDoc.formHeadline || "", 200),
        formSubtext: defangText(profileDoc.formSubtext || "", 500),
        klaviyoListId: defangText(profileDoc.klaviyoListId || "", 120),
        avatarUrl: sanitizeImageSrc(profileDoc.avatarUrl || profileDoc.imageUrl || ""),
        links,
        social,
      },
      products,
    });
  } catch (err) {
    console.error("public:index ERROR", err?.message || err);
    return send(res, 500, { ok: false, error: "server_error" });
  }
}
