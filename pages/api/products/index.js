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

/** ── Limits by plan ─────────────────────────────────────────────────────── */
const MAX_PRODUCTS_BY_PLAN = {
  free: 1,
  starter: 5,
  pro: 15,
  business: 30,
  // hidden Starter+ behaves as starter for limits
  "starter+": 5,
};
function normalizePlan(p) {
  const plan = String(p || "free").toLowerCase();
  if (plan === "starterplus" || plan === "starter+") return "starter+";
  return plan;
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
        return res.status(400).json({ ok: false, error: "Missing editToken" });
      }

      const doc = await Profiles.findOne({ editToken }, { projection: { products: 1, _id: 0 } });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, products: doc?.products || [] });
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
        return res.status(400).json({ ok: false, error: "Missing editToken" });
      }
      if (!incoming) {
        return res.status(400).json({ ok: false, error: "Body must include products array" });
      }

      // Load profile to check plan
      const profile = await Profiles.findOne(
        { editToken },
        { projection: { _id: 1, plan: 1 } }
      );
      const plan = normalizePlan(profile?.plan || "free");
      const maxAllowed = MAX_PRODUCTS_BY_PLAN[plan] ?? MAX_PRODUCTS_BY_PLAN.free;

      // Sanitize + cap absurd input size
      const products = incoming.slice(0, 100).map(sanitizeProduct);

      // Enforce plan limit (count total products, regardless of published state)
      const count = products.length;
      if (count > maxAllowed) {
        return res.status(400).json({
          ok: false,
          error: "limit",
          message: `Your plan (${plan}) allows up to ${maxAllowed} product${maxAllowed === 1 ? "" : "s"}.`,
          plan,
          limit: maxAllowed,
          attempted: count,
        });
      }

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

      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        ok: true,
        saved: products.length,
        upserted: !!result?.upsertedId,
        plan,
        limit: maxAllowed,
      });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end("Method Not Allowed");
  } catch (err) {
    console.error("products:index ERROR", { message: err?.message, stack: err?.stack });
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
