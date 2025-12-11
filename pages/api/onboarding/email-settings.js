// pages/api/onboarding/email-settings.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// --- DB bootstrap with global cache ---
// (same pattern as pages/api/profile/get.js)
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

// POST /api/onboarding/email-settings
// body: { token, enableForm, collectName, klaviyoListId }
export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { ok: false, error: "method_not_allowed" });
  }

  try {
    const body = req.body || {};

    const token = String(body.token || body.editToken || "").trim();
    if (!token) {
      return send(res, 400, { ok: false, error: "missing_token" });
    }

    const enableForm = !!body.enableForm;
    const collectName = !!body.collectName;
    const rawListId = body.klaviyoListId != null ? String(body.klaviyoListId) : "";
    const klaviyoListId = enableForm ? rawListId.trim() : "";

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");

    const update = {
      collectEmail: enableForm,
      collectName,
    };

    // If form is enabled, keep the list id; otherwise clear it
    if (enableForm && klaviyoListId) {
      update.klaviyoListId = klaviyoListId;
    } else {
      update.klaviyoListId = "";
    }

    const result = await Profiles.updateOne(
      { editToken: token },
      { $set: update }
    );

    if (!result.matchedCount) {
      return send(res, 404, { ok: false, error: "profile_not_found" });
    }

    return send(res, 200, { ok: true });
  } catch (err) {
    console.error("email-settings ERROR", err?.message || err);
    return send(res, 500, { ok: false, error: "server_error" });
  }
}
