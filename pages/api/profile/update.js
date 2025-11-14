// pages/api/profile/update.js
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

function cleanLinks(arr) {
  if (!Array.isArray(arr)) return null;
  const out = [];
  for (const raw of arr) {
    if (!raw) continue;
    const label = String(raw.label || "").trim();
    const url = String(raw.url || "").trim();
    if (!label && !url) continue;
    let id = String(raw.id || "").trim();
    if (!id) {
      id = `l_${Math.random().toString(36).slice(2, 10)}`;
    }
    out.push({ id, label, url });
  }
  return out;
}

function cleanSocial(raw) {
  if (!raw || typeof raw !== "object") return null;
  // 👇 added "facebook" here
  const keys = ["instagram", "facebook", "tiktok", "youtube", "x", "website"];
  const out = {};
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed) {
        out[k] = trimmed.slice(0, 500);
      }
    }
  }
  return out;
}

// POST /api/profile/update
// Body can include:
// - editToken (required)
// - displayName, bio, publicSlug
// - social: { instagram, facebook, tiktok, youtube, x, website }
// - collectEmail / klaviyoListId  (plan-gated; Free forces false/null)
// - links: [{ id?, label, url }]  (allowed for all plans)
export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  let body = {};
  if (req.body && typeof req.body === "object") {
    body = req.body;
  } else {
    try {
      body = JSON.parse(req.body || "{}");
    } catch {
      body = {};
    }
  }

  const editToken = String(body.editToken || "").trim();
  if (!editToken) {
    return send(res, 400, { ok: false, error: "Missing editToken" });
  }

  const client = await getClient();
  const db = client.db(MONGODB_DB);
  const Profiles = db.collection("profiles");

  const profile = await Profiles.findOne(
    { editToken },
    {
      projection: {
        _id: 0,
        plan: 1,
        collectEmail: 1,
        klaviyoListId: 1,
        links: 1,
        displayName: 1,
        bio: 1,
        publicSlug: 1,
        social: 1,
      },
    }
  );

  if (!profile) {
    return send(res, 404, {
      ok: false,
      error: "profile_not_found",
    });
  }

  const plan = String(profile.plan || "free").toLowerCase();
  const isFree = plan === "free";

  const hasCollect = Object.prototype.hasOwnProperty.call(body, "collectEmail");
  const hasList = Object.prototype.hasOwnProperty.call(body, "klaviyoListId");
  const hasDisplayName = Object.prototype.hasOwnProperty.call(body, "displayName");
  const hasBio = Object.prototype.hasOwnProperty.call(body, "bio");
  const hasPublicSlug = Object.prototype.hasOwnProperty.call(body, "publicSlug");
  const hasSocial = Object.prototype.hasOwnProperty.call(body, "social");

  const incomingLinks = Array.isArray(body.links) ? body.links : null;
  const incomingSocialRaw = hasSocial ? body.social : null;

  let collectEmail = !!profile.collectEmail;
  let klaviyoListId = profile.klaviyoListId || null;
  let links = Array.isArray(profile.links) ? profile.links : [];
  let social = profile.social || {};
  let displayName = profile.displayName || "";
  let bio = profile.bio || "";
  let publicSlug = profile.publicSlug || "";

  // Plan-gated email capture
  if (isFree) {
    collectEmail = false;
    klaviyoListId = null;
  } else {
    if (hasCollect) {
      collectEmail = !!body.collectEmail;
    }
    if (hasList) {
      const raw = (body.klaviyoListId || "").toString().trim();
      klaviyoListId = raw || null;
    }
  }

  // Display name
  if (hasDisplayName) {
    displayName = ((body.displayName || "").toString().trim()).slice(0, 120);
  }

  // Bio
  if (hasBio) {
    bio = ((body.bio || "").toString().trim()).slice(0, 2000);
  }

  // Public slug
  let newPublicSlug = publicSlug;
  if (hasPublicSlug) {
    let raw = (body.publicSlug || "").toString().trim();
    if (raw) {
      let slug = raw.toLowerCase();
      slug = slug.replace(/[^a-z0-9-]/g, "-");
      slug = slug.replace(/-+/g, "-");
      slug = slug.replace(/^-|-$/g, "");
      newPublicSlug = slug || "";
    } else {
      newPublicSlug = "";
    }

    // Enforce uniqueness if changed and not empty
    if (newPublicSlug && newPublicSlug !== (publicSlug || "")) {
      const existing = await Profiles.findOne(
        {
          publicSlug: newPublicSlug,
          editToken: { $ne: editToken },
        },
        { projection: { _id: 1 } }
      );
      if (existing) {
        return send(res, 400, {
          ok: false,
          error: "slug_taken",
          message: "That URL slug is already in use.",
        });
      }
    }

    publicSlug = newPublicSlug;
  }

  // Social (allowed for all plans)
  if (hasSocial) {
    const cleanedSocial = cleanSocial(incomingSocialRaw);
    social = cleanedSocial || {};
  }

  // Links (allowed for all plans)
  if (incomingLinks) {
    const cleanedLinks = cleanLinks(incomingLinks);
    if (cleanedLinks !== null) {
      links = cleanedLinks;
    }
  }

  const update = {
    updatedAt: new Date(),
    collectEmail,
    klaviyoListId,
  };
  if (hasDisplayName) update.displayName = displayName;
  if (hasBio) update.bio = bio;
  if (hasPublicSlug) update.publicSlug = publicSlug || null;
  if (hasSocial) update.social = social;
  if (incomingLinks) update.links = links;

  await Profiles.updateOne(
    { editToken },
    {
      $set: update,
    }
  );

  return send(res, 200, {
    ok: true,
    plan,
    collectEmail,
    klaviyoListId,
    links,
    displayName,
    bio,
    publicSlug,
    social,
  });
}
