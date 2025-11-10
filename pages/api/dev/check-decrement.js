// pages/api/dev/check-decrement.js
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB  = process.env.MONGODB_DB || "linkinbio";

let cachedClient = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  const c = new MongoClient(MONGODB_URI);
  await c.connect();
  cachedClient = c;
  return c;
}

/**
 * GET /api/dev/check-decrement?productId=...
 * Read-only: tells us whether the webhook's decrement query would match.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  const productId = String(req.query.productId || "").trim();
  if (!productId) return res.status(400).json({ ok:false, error:"Missing productId" });

  try {
    const db = (await getClient()).db(MONGODB_DB);

    // Find the product doc and return its unitsLeft + type
    const doc = await db.collection("profiles").findOne(
      { "products.id": productId },
      { projection: { _id: 0, editToken: 1, slug: 1, products: { $elemMatch: { id: productId } } } }
    );

    const p = doc?.products?.[0] || null;
    const unitsLeft = p?.unitsLeft ?? null;
    const unitsLeftType = (unitsLeft === null) ? "null" : typeof unitsLeft;

    // Would the webhook's query match?
    const matchCount = await db.collection("profiles").countDocuments({
      products: { $elemMatch: { id: productId, unitsLeft: { $type: "number", $gte: 1 } } }
    });

    return res.status(200).json({
      ok: true,
      productId,
      profileHint: { editToken: doc?.editToken || null, slug: doc?.slug || null },
      productSnapshot: p,
      unitsLeft,
      unitsLeftType,
      webhookQueryWouldMatch: matchCount > 0,
      matchCount
    });
  } catch (e) {
    console.error("check-decrement error:", e);
    return res.status(500).json({ ok:false, error:"check failed" });
  }
}
