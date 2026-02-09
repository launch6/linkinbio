// pages/api/free/online.js
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

/**
 * Sets flags many UIs use to consider a profile "online":
 * - status: "active"
 * - published / isPublished: true
 * - offline / pageOffline: false
 * - publishedAt: now (if missing)
 */
export default async function handler(req, res) {
    // SECURITY: free endpoints must not exist in production
  if (process.env.NODE_ENV === "production") {
    return res.status(404).end("Not Found");
  }
  try {
    const editToken = String(req.query.editToken || "");
    if (!editToken) return res.status(400).json({ ok: false, error: "Missing editToken" });

    const db = await getDb();
    const now = new Date();

    const result = await db.collection("profiles").findOneAndUpdate(
      { editToken },
      {
        $set: {
          status: "active",
          published: true,
          isPublished: true,
          offline: false,
          pageOffline: false,
        },
        $setOnInsert: { createdAt: now },
        $currentDate: { updatedAt: true, publishedAt: { $type: "date" } },
      },
      { returnDocument: "after", upsert: true, projection: { _id: 0 } }
    );

    return res.status(200).json({ ok: true, profile: result.value });
  } catch (err) {
    console.error("free:online ERROR", err?.message);
    return res.status(500).json({ ok: false, error: "Failed to set online" });
  }
}
