// pages/api/products/index.js
import { MongoClient, ObjectId } from "mongodb";

let cachedClient = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI");
  const client = new MongoClient(uri, { ignoreUndefined: true });
  await client.connect();
  cachedClient = client;
  return client;
}

function sanitizeProduct(input = {}) {
  const out = {
    title: typeof input.title === "string" ? input.title.slice(0, 120) : "",
    description:
      typeof input.description === "string"
        ? input.description.slice(0, 2000)
        : "",
    images: Array.isArray(input.images)
      ? input.images.filter((u) => typeof u === "string").slice(0, 6)
      : [],
    stripeUrl:
      typeof input.stripeUrl === "string" ? input.stripeUrl.slice(0, 2048) : "",
    // NEW MVP FIELDS (Timer + Scarcity)
    dropEndsAt:
      typeof input.dropEndsAt === "string" || input.dropEndsAt instanceof Date
        ? new Date(input.dropEndsAt)
        : null,
    unitsTotal:
      Number.isFinite(Number(input.unitsTotal)) && Number(input.unitsTotal) >= 0
        ? Number(input.unitsTotal)
        : null,
    unitsLeft:
      Number.isFinite(Number(input.unitsLeft)) && Number(input.unitsLeft) >= 0
        ? Number(input.unitsLeft)
        : null,

    // Optional owner scoping; wire later with auth
    owner: typeof input.owner === "string" ? input.owner : null,
    updatedAt: new Date(),
  };

  if (
    out.unitsTotal !== null &&
    out.unitsLeft !== null &&
    out.unitsLeft > out.unitsTotal
  ) {
    out.unitsLeft = out.unitsTotal;
  }
  return out;
}

export default async function handler(req, res) {
  try {
    const client = await getClient();
    const db = client.db(process.env.MONGODB_DB || "linkinbio");
    const col = db.collection("products");

    if (req.method === "GET") {
      const { id, owner } = req.query;

      if (id) {
        const doc = await col.findOne({ _id: new ObjectId(String(id)) });
        if (!doc) return res.status(404).json({ error: "Not found" });
        return res.status(200).json(doc);
      }

      const query = owner ? { owner: String(owner) } : {};
      const items = await col.find(query).sort({ updatedAt: -1 }).limit(50).toArray();
      return res.status(200).json(items);
    }

    if (req.method === "POST") {
      const data = sanitizeProduct(req.body || {});
      if (!data.title || !data.stripeUrl) {
        return res.status(400).json({ error: "title and stripeUrl are required" });
      }
      data.createdAt = new Date();

      const { insertedId } = await col.insertOne(data);
      const created = await col.findOne({ _id: insertedId });
      return res.status(201).json(created);
    }

    if (req.method === "PUT") {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const patch = sanitizeProduct(req.body || {});
      delete patch.createdAt;

      const result = await col.findOneAndUpdate(
        { _id: new ObjectId(String(id)) },
        { $set: patch },
        { returnDocument: "after" }
      );
      if (!result.value) return res.status(404).json({ error: "Not found" });
      return res.status(200).json(result.value);
    }

    res.setHeader("Allow", "GET,POST,PUT");
    return res.status(405).end("Method Not Allowed");
  } catch (err) {
    console.error("products API error", err);
    return res.status(500).json({ error: "Server error" });
  }
}
