// pages/api/products/index.js
import { MongoClient } from "mongodb";

/** ── DB bootstrap (local cache so we don't reconnect every call) ─────────── */
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "linkinbio";

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI env");
}

let _client = global._launch6MongoClient;
async function getClient() {
  if (_client) return _client;
  const c = new MongoClient(MONGODB_URI);
  await c.connect();
  _client = c;
  global._launch6MongoClient = c;
  return c;
}

/** ── Helpers ────────────────────────────────────────────────────────────── */
function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}
function send(res, status, body) {
  setNoStore(res);
  return res.status(status).json(body);
}
function cleanStr(x, max = 500) {
  if (typeof x !== "string") return "";
  const s = x.trim();
  return s.length > max ? s.slice(0, max) : s;
}
function toISOorEmpty(v) {
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : d.toISOString();
}
function toIntOrEmpty(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : "";
}
function toBool(v) {
  return !!v;
}
function sanitizeProduct(p) {
  return {
    id: cleanStr(p?.id || `p_${Math.random().toString(36).slice(2, 10)}`, 64),
    title: cleanStr(p?.title || "", 300),
    priceUrl: cleanStr(p?.priceUrl || "", 1000),
    imageUrl: cleanStr(p?.imageUrl || "", 1000),

    // MVP fields
    dropEndsAt: toISOorEmpty(p?.dropEndsAt || ""),
    unitsTotal: toIntOrEmpty(p?.unitsTotal),
    unitsLeft: toIntOrEmpty(p?.unitsLeft),

    published: toBool(p?.published),
  };
}

/** ── API Route ──────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  try {
    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");

    if (req.method === "GET") {
      const editToken = cleanStr(req.query.editToken || "", 200);
      if (!editToken) {
        return send(res, 400, { ok: false, error: "Missing editToken" });
      }

      const doc = await Profiles.findOne({ editToken }, { projection: { products: 1, _id: 0 } });
      return send(res, 200, { ok: true, products: doc?.products || [] });
    }

    if (req.method === "POST") {
      const body =
        req.body && typeof req.body === "object"
          ? req.body
          : (() => {
              try {
                return JSON.parse(req.body || "{}");
              } catch {
                return {};
              }
            })();

      const editToken = cleanStr(body.editToken || "", 200);
      const incoming = Array.isArray(body.products) ? body.products : null;

      if (!editToken) {
        return send(res, 400, { ok: false, error: "Missing editToken" });
      }
      if (!incoming) {
        return send(res, 400, { ok: false, error: "Body must include products array" });
      }

      // Sanitize + cap to a reasonable number for MVP
      const products = incoming.slice(0, 100).map(sanitizeProduct);

      const result = await Profiles.updateOne(
        { editToken },
        {
          $set: {
            products,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      return send(res, 200, {
        ok: true,
        saved: products.length,
        upserted: !!result?.upsertedId,
      });
    }

    res.setHeader("Allow", "GET, POST");
    setNoStore(res);
    return res.status(405).end("Method Not Allowed");
  } catch (err) {
    console.error("products:index ERROR", { message: err?.message, stack: err?.stack });
    return send(res, 500, { ok: false, error: "Server error" });
  }
}
