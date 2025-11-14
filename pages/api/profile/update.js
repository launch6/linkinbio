// pages/api/profile/update.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// --- DB bootstrap with global cache (shared with other routes) ---
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
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

function send(res, status, body) {
  noStore(res);
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  // Parse body safely (Next can give us an object or a JSON string)
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
    { projection: { _id: 0, plan: 1 } }
  );

  if (!profile) {
    return send(res, 404, {
      ok: false,
      error: "profile_not_found",
    });
  }

  const plan = String(profile.plan || "free").toLowerCase();
  const isFree = plan === "free";

  // Raw inputs from client
  const rawCollect = body.collectEmail;
  const rawList = body.klaviyoListId;

  // Plan-based gating
  let collectEmail = false;
  let klaviyoListId = null;

  if (!isFree) {
    collectEmail = !!rawCollect;
    const list = (rawList || "").trim();
    klaviyoListId = list || null;
  }

  await Profiles.updateOne(
    { editToken },
    {
      $set: {
        updatedAt: new Date(),
        collectEmail,
        klaviyoListId,
      },
    }
  );

  return send(res, 200, {
    ok: true,
    plan,
    collectEmail,
    klaviyoListId,
  });
}
