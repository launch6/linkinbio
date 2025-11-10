// pages/api/dev/run-decrement.js
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
 * GET /api/dev/run-decrement?productId=...&editToken=...
 * Guarded by editToken. Decrements unitsLeft atomically if >= 1.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }
  const productId = String(req.query.productId || "").trim();
  const editToken = String(req.query.editToken || "").trim();
  if (!productId || !editToken) {
    return res.status(400).json({ ok:false, error:"Missing productId or editToken" });
  }

  try {
    const db = (await getClient()).db(MONGODB_DB);

    // Atomic: require matching product with numeric unitsLeft >= 1
    const q = {
      editToken,
      products: { $elemMatch: { id: productId, unitsLeft: { $type: "number", $gte: 1 } } },
    };
    const u = { $inc: { "products.$.unitsLeft": -1 } };

    const r = await db.collection("profiles").updateOne(q, u);
    const matched = r.matchedCount;
    const modified = r.modifiedCount;

    // Return the fresh product snapshot
    const doc = await db.collection("profiles").findOne(
      { editToken, "products.id": productId },
      { projection: { _id: 0, products: { $elemMatch: { id: productId } } } }
    );

    return res.status(200).json({
      ok: true,
      matched,
      modified,
      product: doc?.products?.[0] || null,
    });
  } catch (e) {
    console.error("run-decrement error:", e);
    return res.status(500).json({ ok:false, error:"run-decrement failed" });
  }
}
