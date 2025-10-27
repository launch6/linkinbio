// pages/api/free/start.js
import { MongoClient } from "mongodb";
import { randomUUID } from "crypto";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "linkinbio";

let cachedClient = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const body =
      req.body && typeof req.body === "object"
        ? req.body
        : (() => { try { return JSON.parse(req.body || "{}"); } catch { return {}; } })();

    // Accept (or create) an editToken so the editor knows which profile to open.
    let { editToken, email } = body || {};
    if (!editToken || typeof editToken !== "string" || editToken.length < 8) {
      editToken = randomUUID();
    }

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const now = new Date();

    // Minimal profile document for MVP
    const update = {
      $setOnInsert: {
        editToken,
        createdAt: now,
        publicSlug: null,           // filled later in editor
      },
      $set: {
        plan: "free",
        planCaps: {
          products: 3,
          imagesPerProduct: 3,
          links: 15,
        },
        email: email || null,
        updatedAt: now,
      },
    };

    await db.collection("profiles").updateOne({ editToken }, update, { upsert: true });

    return res.status(200).json({
      ok: true,
      editToken,
      redirect: `/editor?editToken=${encodeURIComponent(editToken)}`,
    });
  } catch (err) {
    console.error("free:start ERROR", { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: "Failed to start Free profile." });
  }
}
