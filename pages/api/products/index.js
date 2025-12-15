// pages/api/products/index.js
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

// helpers
function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const body = normalizeBody(req);
    const editToken = (body.editToken || "").trim();
    const products = Array.isArray(body.products) ? body.products : [];

    if (!editToken) {
      return res.status(400).json({ ok: false, error: "missing_edit_token" });
    }
    if (products.length === 0) {
      return res.status(400).json({ ok: false, error: "no_products" });
    }

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");

    const nowIso = new Date().toISOString();

    const safeProducts = products.map((p, idx) => {
      const id =
        typeof p.id === "string" && p.id.trim()
          ? p.id.trim()
          : `p_${Date.now()}_${idx}`;

      const unitsTotal = numOrNull(p.unitsTotal);
      let unitsLeft = numOrNull(
        p.unitsLeft != null ? p.unitsLeft : unitsTotal
      );
      if (unitsTotal != null && unitsLeft != null) {
        unitsLeft = Math.min(unitsTotal, unitsLeft);
      }

      const dropStartsAt =
        typeof p.dropStartsAt === "string" && p.dropStartsAt.trim()
          ? p.dropStartsAt.trim()
          : "";
      const dropEndsAt =
        typeof p.dropEndsAt === "string" && p.dropEndsAt.trim()
          ? p.dropEndsAt.trim()
          : "";

      const priceCents =
        typeof p.priceCents === "number" && Number.isFinite(p.priceCents)
          ? p.priceCents
          : null;

      return {
        id,
        title: (p.title || "").trim(),
        description: (p.description || "").trim(),
        imageUrl: (p.imageUrl || "").trim(),

        priceUrl: (p.priceUrl || "").trim(),
        priceCents,
        priceDisplay: (p.priceDisplay || "").trim(),
        priceText: (p.priceText || "").trim(),

        dropStartsAt,
        dropEndsAt,
        showTimer: !!p.showTimer,
        showInventory: !!p.showInventory,

        unitsTotal,
        unitsLeft,

        buttonText: (p.buttonText || "Buy Now").trim(),
        published: p.published !== false,

        updatedAt: nowIso,
      };
    });

    await Profiles.updateOne(
      { editToken },
      {
        $set: {
          editToken, // keep it on the doc
          products: safeProducts,
          updatedAt: nowIso,
        },
      },
      { upsert: true }
    );

    return res.status(200).json({ ok: true, products: safeProducts });
  } catch (err) {
    console.error("/api/products error:", err?.message || err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
