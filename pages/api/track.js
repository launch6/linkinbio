// pages/api/track.js
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

// Accepts POST with JSON body. Example:
// { type: "buy_click", productId: "p_abc123", editToken: "l6_demo_token", slug, ts, ref, ua }
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const db = (await getClient()).db(MONGODB_DB);
    const body =
      req.body && typeof req.body === "object"
        ? req.body
        : (() => { try { return JSON.parse(req.body || "{}"); } catch { return {}; } })();

    const type = String(body.type || "");
    const productId = String(body.productId || "");
    const editToken = String(body.editToken || "");
    const slug = body.slug ? String(body.slug) : null;
    const ts = Number.isFinite(+body.ts) ? +body.ts : Date.now();
    const ref = typeof body.ref === "string" ? body.ref : (req.headers.referer || "");
    const ua = typeof body.ua === "string" ? body.ua : (req.headers["user-agent"] || "");

    if (!type || !productId) {
      // Keep silent for malformed hits; don’t break UX
      return res.status(204).end();
    }

    await db.collection("events").insertOne({
      type,
      productId,
      editToken: editToken || null,
      slug,
      ts,
      ref,
      ua,
      ip: (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString(),
    });

    // 204 = No Content (ideal for beacons)
    return res.status(204).end();
  } catch (e) {
    console.error("track error:", e);
    // Never block the user — still return 204
    return res.status(204).end();
  }
}
