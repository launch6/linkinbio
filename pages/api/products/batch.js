// pages/api/products/batch.js
import { MongoClient } from "mongodb";

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

function sanitizeString(v, max = 2000) {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

function sanitizeBool(v, def = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0" || s === "") return false;
  }
  if (typeof v === "number") return v === 1;
  return def;
}

function sanitizeInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(-2147483648, Math.min(2147483647, Math.trunc(n)));
}

function sanitizeISODate(v) {
  if (typeof v !== "string" || !v) return "";
  return v.length > 40 ? v.slice(0, 40) : v;
}

function normalizeProduct(p) {
  return {
    id: sanitizeString(p?.id || "", 120),
    title: sanitizeString(p?.title || "", 400),
    description: sanitizeString(p?.description || "", 2000),
    buttonText: sanitizeString(p?.buttonText || "", 200),

    priceUrl: sanitizeString(p?.priceUrl || "", 2000),
    imageUrl: sanitizeString(p?.imageUrl || "", 2000),

    dropEndsAt: sanitizeISODate(p?.dropEndsAt || ""),
    unitsTotal: sanitizeInt(p?.unitsTotal),
    unitsLeft: sanitizeInt(p?.unitsLeft),

    published: sanitizeBool(p?.published, false),
    showTimer: sanitizeBool(p?.showTimer, false),
    showInventory: sanitizeBool(p?.showInventory, true),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const editToken = (req.query.editToken || "").toString().trim();
    if (!editToken) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing editToken in query" });
    }

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

    if (!body || !Array.isArray(body.products)) {
      return res
        .status(400)
        .json({ ok: false, error: "Body must include products array" });
    }

    const normalized = body.products
      .map(normalizeProduct)
      .filter((p) => p.id && p.id.length > 0);

    const client = await getClient();
    const db = client.db(MONGODB_DB);

    const result = await db.collection("profiles").updateOne(
      { editToken },
      {
        $set: {
          editToken,
          updatedAt: new Date(),
          products: normalized, // replace entire array
        },
        $setOnInsert: {
          createdAt: new Date(),
          plan: "free",
          planCaps: { products: 3, imagesPerProduct: 3, links: 15 },
          status: "active",
          displayName: "New Creator",
        },
      },
      { upsert: true }
    );

    return res.status(200).json({
      ok: true,
      saved: result.modifiedCount || 0,
      upserted: Boolean(result.upsertedId),
    });
  } catch (err) {
    console.error("products/batch ERROR", {
      message: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
