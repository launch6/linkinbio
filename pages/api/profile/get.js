// pages/api/profile/get.js
import { MongoClient } from "mongodb";

export const config = {
  api: {
    // Response can include avatarUrl (data URL). Keep default body parser.
    bodyParser: true,
  },
};

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
const ALLOWED_THEMES = new Set(["launch6", "pastel", "modern"]);

function normalizeThemeValue(theme) {
  // New format: "launch6" | "pastel" | "modern"
  if (typeof theme === "string") {
    const t = theme.trim().toLowerCase();
    return ALLOWED_THEMES.has(t) ? t : "launch6";
  }

  // Legacy formats: { key }, { preset }, { theme }, etc.
  if (theme && typeof theme === "object") {
    const raw =
      (typeof theme.key === "string" && theme.key) ||
      (typeof theme.preset === "string" && theme.preset) ||
      (typeof theme.theme === "string" && theme.theme) ||
      "";

    const t = String(raw).trim().toLowerCase();

    // legacy mapping
    if (t === "dark") return "launch6";
    if (ALLOWED_THEMES.has(t)) return t;
  }

  return "launch6";
}

// GET /api/profile/get?editToken=...
export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  const editToken = String(req.query.editToken || "").trim();
  if (!editToken) {
    return send(res, 400, { ok: false, error: "Missing editToken" });
  }

  try {
    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");

    const doc = await Profiles.findOne(
      { editToken },
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
          description: 1, // legacy support
          avatarUrl: 1,   // ✅ FIX: return avatar
          collectEmail: 1,
          klaviyoListId: 1,
          links: 1,
          social: 1,
          theme: 1,
        },
      }
    );

    if (!doc) {
      return send(res, 404, { ok: false, error: "profile_not_found" });
    }

    const links = Array.isArray(doc.links)
      ? doc.links.filter((l) => l && typeof l.url === "string" && l.url.trim().length > 0)
      : [];

    return send(res, 200, {
      ok: true,
      profile: {
        editToken,
        plan: doc.plan || "free",
        displayName: doc.displayName || doc.name || "",
        name: doc.name || "",
        publicSlug: doc.publicSlug || doc.slug || "",
        slug: doc.slug || "",
        status: doc.status || "active",
        theme: normalizeThemeValue(doc.theme),

        // prefer bio, fall back to legacy description
        bio: doc.bio || doc.description || "",
        // ✅ FIX: include avatarUrl
        avatarUrl: doc.avatarUrl || "",
        collectEmail: !!doc.collectEmail,
        klaviyoListId: doc.klaviyoListId || "",
        links,
        social: doc.social || {},
      },
    });
  } catch (err) {
    console.error("profile:get ERROR", err?.message || err);
    return send(res, 500, { ok: false, error: "server_error" });
  }
}
