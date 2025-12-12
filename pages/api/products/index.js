// pages/api/products/index.js
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

// headers helpers
function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}
function send(res, status, body) {
  noStore(res);
  return res.status(status).json(body);
}

// sanitize helpers
function toBool(v, def = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  if (typeof v === "number") return v === 1;
  return def;
}
function toNonNegIntOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function toIsoOrEmpty(v) {
  if (!v) return "";
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}
function toTrimmedString(v, max = 4000) {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s.length > max ? s.slice(0, max) : s;
}
function toPriceCentsOrNull(v) {
  // We treat this as already-cents if it is an integer.
  // If Step 3 sends dollars->cents, this stays correct.
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  return int >= 0 ? int : null;
}

// Enforce plan-based product limits (aligned with frontend)
function maxProductsForPlan(planRaw) {
  const plan = String(planRaw || "free").toLowerCase();
  if (plan === "starterplus" || plan === "starter+") return 5;

  switch (plan) {
    case "starter":
      return 5;
    case "pro":
      return 15;
    case "business":
      return 30;
    default:
      return 1; // free / unknown
  }
}

// GET: list products
// POST: create/update (array) with plan enforcement
export default async function handler(req, res) {
  noStore(res);
  try {
    const method = req.method;
    if (!["GET", "POST"].includes(method)) {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).end("Method Not Allowed");
    }

    const editToken = String(
      req.query.editToken || req.body?.editToken || ""
    ).trim();
    if (!editToken) return send(res, 400, { ok: false, error: "Missing editToken" });

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");

    const profile = await Profiles.findOne(
      { editToken },
      { projection: { _id: 0, plan: 1, products: 1 } }
    );

    if (method === "GET") {
      const products = Array.isArray(profile?.products) ? profile.products : [];
      return send(res, 200, { ok: true, products });
    }

    // POST — save array of products
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

    const arr = Array.isArray(body.products) ? body.products : [];

    const cleaned = arr.map((p) => {
      const id =
        toTrimmedString(p?.id || "", 120) ||
        `p_${Math.random().toString(36).slice(2, 10)}`;

      const title = toTrimmedString(p?.title || "", 400);
      const description = toTrimmedString(p?.description || "", 5000);

      const priceUrl = toTrimmedString(p?.priceUrl || "", 2000);
      const priceDisplay = toTrimmedString(p?.priceDisplay || "", 80);
      const priceText = toTrimmedString(p?.priceText || "", 120);
      const priceCents = toPriceCentsOrNull(p?.priceCents);

      const imageUrl = toTrimmedString(p?.imageUrl || "", 2000);

      const dropStartsAt = toIsoOrEmpty(p?.dropStartsAt || "");
      const dropEndsAt = toIsoOrEmpty(p?.dropEndsAt || "");

      const unitsTotal = toNonNegIntOrNull(p?.unitsTotal);
      const unitsLeftRaw = toNonNegIntOrNull(p?.unitsLeft);

      const published = !!p?.published;

      const showTimer = toBool(p?.showTimer, false);
      const showInventory = toBool(p?.showInventory, true);

      const buttonText = toTrimmedString(p?.buttonText || "", 60);

      // Guard: unitsLeft cannot exceed unitsTotal if both present
      let safeLeft = unitsLeftRaw;
      if (unitsTotal !== null && safeLeft !== null) {
        safeLeft = Math.min(unitsTotal, safeLeft);
      }

      return {
        id,
        title,
        description,

        imageUrl,

        priceUrl,
        priceDisplay,
        priceText,
        priceCents,

        dropStartsAt,
        dropEndsAt,

        showTimer,
        showInventory,

        unitsTotal,
        unitsLeft: safeLeft,

        buttonText,

        published: !!published,
      };
    });

    // Plan enforcement
    const plan = profile?.plan || "free";
    const max = maxProductsForPlan(plan);
    if (cleaned.length > max) {
      return send(res, 403, { ok: false, error: "plan_limit", max });
    }

    const r = await Profiles.updateOne(
      { editToken },
      {
        $set: {
          updatedAt: new Date(),
          products: cleaned,
        },
      },
      { upsert: true }
    );

    return send(res, 200, {
      ok: true,
      matched: r.matchedCount || 0,
      upserted: !!r.upsertedId,
      products: cleaned,
    });
  } catch (err) {
    console.error("products API ERROR", err?.message);
    return send(res, 500, { ok: false, error: "server_error" });
  }
}
