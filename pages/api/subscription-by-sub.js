// pages/api/subscription-by-sub.js
import { getDb } from "../../lib/mongo";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { subscriptionId } = req.query;
  if (!subscriptionId) {
    return res.status(400).json({ error: "Missing subscriptionId" });
  }

  try {
    const db = await getDb();
    const doc = await db
      .collection("subscriptions")
      .findOne({ subscriptionId: String(subscriptionId) });

    if (!doc) return res.status(404).json({ found: false });

    // Don’t leak internal Mongo IDs or noisy fields unless you want them
    const { _id, ...safe } = doc;
    return res.status(200).json({ found: true, subscription: safe });
  } catch (err) {
    console.error("read subscription error:", err);
    return res.status(500).json({ error: "server error" });
  }
}
