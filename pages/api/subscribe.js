// pages/api/subscribe.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio", KLAVIYO_API_KEY } = process.env;

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

// Very basic but effective email check for MVP:
// - single "@", at least one "." after "@", no spaces, TLD present
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const s = email.trim();
  if (!s || s.includes(" ")) return false;
  const at = s.indexOf("@");
  if (at <= 0) return false;
  const dot = s.indexOf(".", at + 2); // ensure something between @ and .
  if (dot <= at + 1) return false;
  if (dot >= s.length - 1) return false; // needs chars after "."
  return true;
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
            try { return JSON.parse(req.body || "{}"); }
            catch { return {}; }
          })();

    const editToken = String(body.editToken || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const ref = typeof body.ref === "string" ? body.ref : "";

    if (!editToken) {
      return res.status(400).json({ ok: false, error: "missing_editToken" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");
    const Subs = db.collection("subscribers");
    const Events = db.collection("events");

    // Confirm profile (and read email settings)
    const profile = await Profiles.findOne(
      { editToken },
      { projection: { _id: 0, collectEmail: 1, klaviyoListId: 1 } }
    );
    if (!profile) {
      return res.status(404).json({ ok: false, error: "profile_not_found" });
    }

    // Upsert subscriber (unique by editToken + email)
    const now = new Date();
    const upRes = await Subs.updateOne(
      { editToken, email },
      {
        $setOnInsert: { editToken, email, createdAt: now },
        $set: { updatedAt: now, lastRef: ref || null },
      },
      { upsert: true }
    );

    // Log event (best-effort)
    try {
      await Events.insertOne({
        type: "email_submit",
        editToken,
        ts: Date.now(),
        email,
        ref: ref || null,
      });
    } catch {}

    // Optional Klaviyo subscribe (best-effort; never blocks success)
    if (profile.collectEmail && profile.klaviyoListId && KLAVIYO_API_KEY) {
      try {
        await fetch(
          `https://a.klaviyo.com/api/v2/list/${encodeURIComponent(
            profile.klaviyoListId
          )}/subscribe?api_key=${encodeURIComponent(KLAVIYO_API_KEY)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ profiles: [{ email }] }),
          }
        ).catch(() => null);
      } catch {}
    }

    return res.status(200).json({
      ok: true,
      upserted: !!upRes?.upsertedId,
    });
  } catch (err) {
    console.error("subscribe ERROR", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
