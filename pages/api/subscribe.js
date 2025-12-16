// pages/api/subscribe.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// You said you have this in Vercel already; support either name.
const KLAVIYO_API_KEY =
  process.env.KLAVIYO_API_KEY ||
  process.env.KLAVIYO_PRIVATE_API_KEY ||
  "";

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
  // Use this header to confirm you’re hitting the new deploy via curl.
  res.setHeader("x-subscribe-version", "v4-klaviyo-v2");
}

// Simple but safe email validation
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const s = email.trim();
  if (!s || s.includes(" ")) return false;
  const at = s.indexOf("@");
  if (at <= 0) return false;
  const dot = s.indexOf(".", at + 2);
  if (dot <= at + 1) return false;
  if (dot >= s.length - 1) return false;
  return true;
}

function slugFromRef(ref) {
  try {
    const u = new URL(ref);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  } catch {
    return "";
  }
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

function splitName(name) {
  const raw = String(name || "").trim();
  if (!raw) return { firstName: "", lastName: "" };
  const parts = raw.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ").trim(),
  };
}

async function subscribeKlaviyoV2({ listId, email, firstName, lastName }) {
  const url = `https://a.klaviyo.com/api/v2/list/${encodeURIComponent(
    listId
  )}/subscribe?api_key=${encodeURIComponent(KLAVIYO_API_KEY)}`;

  // Keep payload conservative; names are optional.
  const profile = { email };
  if (firstName) profile.first_name = firstName;
  if (lastName) profile.last_name = lastName;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profiles: [profile] }),
  });

  const text = await r.text().catch(() => "");
  return { ok: r.ok, status: r.status, text };
}

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const body = parseBody(req);

    const email = String(body.email || "").trim().toLowerCase();
    const ref = typeof body.ref === "string" ? body.ref : "";
    const name = String(body.name || "").trim();

    // Accept editToken OR publicSlug (and infer slug from ref)
    let editToken = String(body.editToken || "").trim();
    let publicSlug = String(body.publicSlug || "").trim() || slugFromRef(ref);

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");
    const Subs = db.collection("subscribers");
    const Events = db.collection("events");

    // Resolve profile by editToken or publicSlug
    let profile = null;

    if (editToken) {
      profile = await Profiles.findOne(
        { editToken },
        { projection: { _id: 0, editToken: 1, collectEmail: 1, klaviyoListId: 1 } }
      );
    } else if (publicSlug) {
      profile = await Profiles.findOne(
        { $or: [{ publicSlug }, { slug: publicSlug }] },
        { projection: { _id: 0, editToken: 1, collectEmail: 1, klaviyoListId: 1 } }
      );
      if (profile?.editToken) editToken = profile.editToken;
    }

    if (!profile) {
      return res.status(404).json({ ok: false, error: "profile_not_found" });
    }
    if (!profile.collectEmail) {
      return res.status(403).json({ ok: false, error: "email_collection_disabled" });
    }

    // STRICT: do not say success unless Klaviyo is configured AND returns 2xx.
    if (!profile?.klaviyoListId) {
      return res.status(502).json({
        ok: false,
        error: "klaviyo_not_configured",
        klaviyo: {
          attempted: false,
          ok: false,
          status: null,
          reason: "missing_klaviyo_list_id_on_profile",
        },
      });
    }

    if (!KLAVIYO_API_KEY) {
      return res.status(502).json({
        ok: false,
        error: "klaviyo_not_configured",
        klaviyo: {
          attempted: false,
          ok: false,
          status: null,
          reason: "missing_KLAVIYO_API_KEY_env",
        },
      });
    }

    const { firstName, lastName } = splitName(name);

    const k = await subscribeKlaviyoV2({
      listId: profile.klaviyoListId,
      email,
      firstName,
      lastName,
    });

    if (!k.ok) {
      return res.status(502).json({
        ok: false,
        error: "klaviyo_failed",
        klaviyo: {
          attempted: true,
          ok: false,
          status: k.status,
          reason: (k.text || "klaviyo_non_2xx").slice(0, 240),
        },
      });
    }

    // DB writes are best-effort (do not flip success -> failure after Klaviyo accepted)
    const now = new Date();
    try {
      await Subs.updateOne(
        { editToken, email },
        {
          $setOnInsert: { editToken, email, createdAt: now },
          $set: { updatedAt: now, lastRef: ref || null, name: name || null },
        },
        { upsert: true }
      );
    } catch {}

    try {
      await Events.insertOne({
        type: "email_submit",
        editToken,
        ts: Date.now(),
        email,
        ref: ref || null,
      });
    } catch {}

    return res.status(200).json({
      ok: true,
      klaviyo: {
        attempted: true,
        ok: true,
        status: k.status,
        // helpful for debugging without exposing secrets
        listId: profile.klaviyoListId,
      },
    });
  } catch (err) {
    console.error("subscribe ERROR", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
