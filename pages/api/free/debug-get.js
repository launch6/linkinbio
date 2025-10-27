// pages/api/free/debug-get.js
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "linkinbio";

let cached = null;
async function getDb() {
  if (cached) return cached;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cached = client.db(MONGODB_DB);
  return cached;
}

export default async function handler(req, res) {
  try {
    const { editToken } = req.query || {};
    if (!editToken) return res.status(400).json({ error: "Missing editToken" });

    const db = await getDb();
    const doc = await db.collection("profiles").findOne(
      { editToken: String(editToken) },
      { projection: { _id: 0 } }
    );

    if (!doc) return res.status(404).json({ error: "Not found" });

    return res.status(200).json({ ok: true, profile: doc });
  } catch (err) {
    console.error("free:debug-get ERROR", err?.message);
    return res.status(500).json({ error: "Debug read failed" });
  }
}
