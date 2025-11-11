// pages/api/profile/update.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// ---- DB bootstrap (cached) ----
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

// helpers
function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}
function cleanStr(x, max = 200) {
  if (typeof x !== "string") return "";
  const s = x.trim();
  return s.length > max ? s.slice(0, max) : s;
}
function slugify(x) {
  const s = (x || "").toString().trim().toLowerCase();
  // allow a–z, 0–9, dash; collapse multiple dashes
  return s.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const body =
      req.body && typeof req.body === "object"
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || "{}"); } catch { return {}; }
          })();

    const editToken = cleanStr(body.editToken || "", 200);
    if (!editToken) {
      return res.status(400).json({ ok: false, error: "Missing editToken" });
    }

    // Optional fields we allow updating
    const updates = {};
    if (body.displayName !== undefined) updates.displayName = cleanStr(body.displayName, 200);
    if (body.bio !== undefined)        updates.bio = cleanStr(body.bio, 2000);

    if (body.collectEmail !== undefined) updates.collectEmail = !!body.collectEmail;
    if (body.klaviyoListId !== undefined) updates.klaviyoListId = cleanStr(body.klaviyoListId, 200);

    // NEW: allow setting publicSlug (or updating it)
    let desiredSlug = null;
    if (body.publicSlug !== undefined) {
      const s = slugify(body.publicSlug);
      if (!s) {
        return res.status(400).json({ ok: false, error: "invalid_slug" });
      }
      desiredSlug = s;
    }

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");

    // If a new slug was requested, ensure it isn't taken by another profile
    if (desiredSlug) {
      const taken = await Profiles.findOne({
        $or: [{ publicSlug: desiredSlug }, { slug: desiredSlug }],
        editToken: { $ne: editToken },
      }, { projection: { _id: 1 } });

      if (taken) {
        return res.status(409).json({ ok: false, error: "slug_taken" });
      }
      updates.publicSlug = desiredSlug;
    }

    updates.updatedAt = new Date();

    const result = await Profiles.updateOne(
      { editToken },
      { $set: updates },
      { upsert: true }
    );

    // return a small echo of what we set
    const profile = { editToken, ...updates };
    return res.status(200).json({
      ok: true,
      matched: result.matchedCount || 0,
      upserted: !!result.upsertedId,
      profile,
    });
  } catch (err) {
    console.error("profile:update ERROR", err?.message);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
