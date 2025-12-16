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
  res.setHeader("x-public-version", "v6-sanitize-urls-relative-ok");
}

function send(res, status, body) {
  noStore(res);
  return res.status(status).json(body);
}

// ---- Sanitizers ----------------------------------------------------------

function safeString(v, max = 2000) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // strip non-printable control chars (keep \n \r \t)
  const cleaned = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}

function escapeHtml(s) {
  return safeString(s, 2000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeText(v, max = 2000) {
  return escapeHtml(safeString(v, max));
}

/**
 * URL allowlist:
 * - allow site-relative paths that start with "/" (but NOT "//")
 * - allow absolute http/https URLs
 * - allow bare domains by coercing to https://example.com
 * - reject any other scheme (javascript:, data:, file:, etc.)
 */
function safeUrl(v) {
  const s0 = safeString(v, 2048).trim();
  if (!s0) return "";

  // Allow same-origin relative URLs (this prevents your images from disappearing)
  if (s0.startsWith("/") && !s0.startsWith("//")) return s0;

  // Reject protocol-relative URLs explicitly
  if (s0.startsWith("//")) return "";

  // Allow absolute http/https
  if (/^https?:\/\//i.test(s0)) {
    try {
      const u = new URL(s0);
      const p = u.protocol.toLowerCase();
      if (p !== "http:" && p !== "https:") return "";
      return u.toString();
    } catch {
      return "";
    }
  }

  // If it contains a scheme-like "xxx:" reject (blocks javascript:, data:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s0)) return "";

  // Coerce bare domains/paths to https://
  try {
    const u = new URL(`https://${s0}`);
    const p = u.protocol.toLowerCase();
    if (p !== "http:" && p !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function pickBool(v, defaultValue = false) {
  if (v === undefined) return defaultValue;
  return !!v;
}

function pickNumberOrNull(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

// GET /api/public?slug=<publicSlug or slug>
export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  const rawSlug = safeString(req.query.slug, 200).trim().toLowerCase();
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
          // public fields only
          plan: 1,
          displayName: 1,
          name: 1,
          publicSlug: 1,
          slug: 1,
          status: 1,
          bio: 1,
          description: 1,

          collectEmail: 1,
          collectName: 1,
          klaviyoEnabled: 1,
          formHeadline: 1,
          formSubtext: 1,
          klaviyoListId: 1,

          links: 1,
          social: 1,
          avatarUrl: 1,
          imageUrl: 1,

          // stored products array on profile
          products: 1,
        },
      }
    );

    if (!profileDoc) {
      return send(res, 404, { ok: false, error: "profile_not_found" });
    }

    // 2) Load *published* products from this profile (no drafts)
    const productsRaw = Array.isArray(profileDoc.products) ? profileDoc.products : [];

    const products = productsRaw
      .filter((p) => {
        if (!p) return false;
        // treat missing published flag as published
        return p.published === undefined ? true : !!p.published;
      })
      .map((p) => ({
        id: safeString(p.id, 256),
        title: safeText(p.title, 300),
        description: safeText(p.description, 4000),
        imageUrl: safeUrl(p.imageUrl),
        priceUrl: safeUrl(p.priceUrl),
        priceCents: pickNumberOrNull(p.priceCents),
        priceDisplay: safeText(p.priceDisplay, 64),
        priceText: safeText(p.priceText, 64),

        dropStartsAt: p.dropStartsAt || null,
        dropEndsAt: p.dropEndsAt || null,

        showTimer: pickBool(p.showTimer, false),
        showInventory: p.showInventory === undefined ? true : !!p.showInventory,
        unitsLeft: pickNumberOrNull(p.unitsLeft),
        unitsTotal: pickNumberOrNull(p.unitsTotal),

        buttonText: safeText(p.buttonText, 64),

        // expose published for debugging/clarity
        published: p.published === undefined ? true : !!p.published,
      }));

    // 3) Normalize + validate links
    const linksRaw = Array.isArray(profileDoc.links) ? profileDoc.links : [];
    const links = linksRaw
      .map((l) => {
        const url = safeUrl(l?.url);
        if (!url) return null;
        return {
          id: safeString(l?.id, 128),
          label: safeText(l?.label || l?.title || "", 120),
          url,
        };
      })
      .filter(Boolean);

    // 4) Normalize + validate social URLs
    const socialRaw = profileDoc.social && typeof profileDoc.social === "object" ? profileDoc.social : {};
    const social = {
      instagram: safeUrl(socialRaw.instagram),
      facebook: safeUrl(socialRaw.facebook),
      tiktok: safeUrl(socialRaw.tiktok),
      youtube: safeUrl(socialRaw.youtube),
      x: safeUrl(socialRaw.x),
      website: safeUrl(socialRaw.website),
    };

    // 5) Profile fields (escaped)
    const displayName = safeText(profileDoc.displayName || profileDoc.name || "", 200);
    const name = safeText(profileDoc.name || "", 200);

    // bring description back for old + new records
    const bio = safeText(profileDoc.bio || profileDoc.description || "", 4000);
    const description = safeText(profileDoc.description || profileDoc.bio || "", 4000);

    // Keep images: allow /relative paths via safeUrl()
    const avatarUrl = safeUrl(profileDoc.avatarUrl || profileDoc.imageUrl || "");

    return send(res, 200, {
      ok: true,
      profile: {
        displayName,
        name,
        publicSlug: safeString(profileDoc.publicSlug || profileDoc.slug || rawSlug, 200),
        slug: safeString(profileDoc.slug || rawSlug, 200),
        status: safeString(profileDoc.status || "active", 40),
        plan: safeString(profileDoc.plan || "free", 40),

        bio,
        description,

        collectEmail: !!profileDoc.collectEmail,
        showForm: !!profileDoc.collectEmail, // alias for the frontend
        collectName: !!profileDoc.collectName,

        klaviyoEnabled: !!profileDoc.klaviyoEnabled,
        formHeadline: safeText(profileDoc.formHeadline || "", 200),
        formSubtext: safeText(profileDoc.formSubtext || "", 500),
        klaviyoListId: safeString(profileDoc.klaviyoListId || "", 200),

        avatarUrl,
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
