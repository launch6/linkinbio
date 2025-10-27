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

export default async function handler(req, res) {
  try {
    const editToken = String(req.query.editToken || "");
    if (!editToken) {
      return res.status(400).json({ ok: false, error: "Missing editToken" });
    }

    const db = await getDb();
    const profile = await db
      .collection("profiles")
      .findOne({ editToken }, { projection: { _id: 0 } });

    if (!profile) return res.status(404).json({ ok: false, error: "Not found" });
    return res.status(200).json({ ok: true, profile });
  } catch (err) {
    console.error("profile:get ERROR", err?.message);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
