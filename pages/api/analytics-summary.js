// pages/api/analytics-summary.js
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "linkinbio";

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
 * GET /api/analytics-summary?editToken=...&days=7
 * - editToken (optional): if passed, only counts events for that token
 * - days (optional): lookback window (default 7)
 * Returns:
 * {
 *   ok: true,
 *   range: { from: <iso>, to: <iso>, days: <n> },
 *   totals: [
 *     { productId: "p_123", type: "buy_click", count: 12, lastTs: 1730000000000 }
 *   ]
 * }
 */
export default async function handler(req, res) {
  // SECURITY: analytics summaries must not be public in production
  if (process.env.NODE_ENV === "production") {
    return res.status(404).end("Not Found");
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const editToken = typeof req.query.editToken === "string" ? req.query.editToken.trim() : "";
    const days = Math.max(1, Math.min(90, parseInt(String(req.query.days || "7"), 10) || 7));
    const to = Date.now();
    const from = to - days * 24 * 60 * 60 * 1000;

    const db = (await getClient()).db(MONGODB_DB);
    const match = {
      ts: { $gte: from, $lte: to },
      type: { $in: ["buy_click"] }, // extend with more types later
    };
    if (editToken) match.editToken = editToken;

    const agg = await db.collection("events").aggregate([
      { $match: match },
      {
        $group: {
          _id: { productId: "$productId", type: "$type" },
          count: { $sum: 1 },
          lastTs: { $max: "$ts" },
        },
      },
      {
        $project: {
          _id: 0,
          productId: "$_id.productId",
          type: "$_id.type",
          count: 1,
          lastTs: 1,
        },
      },
      { $sort: { count: -1, lastTs: -1 } },
    ]).toArray();

    return res.status(200).json({
      ok: true,
      range: { from, to, days, fromIso: new Date(from).toISOString(), toIso: new Date(to).toISOString() },
      totals: agg,
    });
  } catch (e) {
    console.error("analytics-summary error:", e);
    return res.status(500).json({ ok: false, error: "analytics summary failed" });
  }
}
