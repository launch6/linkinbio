// pages/api/profile/get.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) return cachedDb;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  const client = cachedClient ?? new MongoClient(MONGODB_URI);
  if (!cachedClient) {
    await client.connect();
    cachedClient = client;
  }
  cachedDb = client.db(MONGODB_DB);
  return cachedDb;
}

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}
function send(res, status, body) {
  setNoStore(res);
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  try {
    const editToken = String(req.query.editToken || "");
    if (!editToken) {
      return send(res, 400, { ok: false, error: "Missing editToken" });
    }

    const db = await getDb();
    const profile = await db
      .collection("profiles")
      .findOne({ editToken }, { projection: { _id: 0 } });

    if (!profile) return send(res, 404, { ok: false, error: "Not found" });
    return send(res, 200, { ok: true, profile });
  } catch (err) {
    console.error("profile:get ERROR", err?.message);
    return send(res, 500, { ok: false, error: "Server error" });
  }
}
