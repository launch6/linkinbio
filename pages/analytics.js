// pages/api/analytics-summary.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// --- DB bootstrap with global cache ---
let _client = global._launch6MongoClient;
async function getClient() {
  if (_client) return _client;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  const c = new MongoClient(MONGODB_URI);
  await c.connect();
  _client = c;
  global._launch6MongoClient = c;
  return c;
}

// --- headers ---
function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}
function send(res, status, body) {
  noStore(res);
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      noStore(res);
      return res.status(405).end("Method Not Allowed");
    }

    const editToken = String(req.query.editToken || "").trim();
    if (!editToken) {
      return send(res, 400, { ok: false, error: "Missing editToken" });
    }

    const daysParam = String(req.query.days || "30").trim();
    const days = Math.max(1, Math.min(90, parseInt(daysParam, 10) || 30));

    const now = Date.now();
    const from = now - days * 24 * 60 * 60 * 1000;
    const to = now;

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Events = db.collection("events"); // created by /api/track

    // Optional: if you want a lightweight index
    // await Events.createIndex({ editToken: 1, ts: -1 });

    const match = {
      editToken,
      ts: { $gte: from, $lte: to },
    };

    const pipeline = [
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
      { $limit: 1000 },
    ];

    const totals = await Events.aggregate(pipeline).toArray();

    return send(res, 200, {
      ok: true,
      totals,
      range: {
        from,
        to,
        days,
        fromIso: new Date(from).toISOString(),
        toIso: new Date(to).toISOString(),
      },
    });
  } catch (err) {
    console.error("analytics-summary ERROR", err?.message);
    return send(res, 500, { ok: false, error: "Server error" });
  }
}
