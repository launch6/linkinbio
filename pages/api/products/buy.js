// pages/api/products/buy.js
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

function pickParam(qs, keys) {
  for (const k of keys) {
    const v = qs[k];
    if (Array.isArray(v)) return v[0] ?? "";
    if (typeof v === "string") return v;
  }
  return "";
}

function cleanId(v, maxLen = 120) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  // remove control chars + cap length
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLen);
}

function cleanSlug(v, maxLen = 80) {
  return cleanId(v, maxLen).toLowerCase();
}

function toHttpUrl(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/i.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function toNumberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function toMsOrNull(iso) {
  if (!iso) return null;
  const ms = Date.parse(String(iso));
  return Number.isFinite(ms) ? ms : null;
}

function isPublished(p) {
  // IMPORTANT: match public API behavior: missing flag means "published"
  return p?.published === undefined ? true : !!p.published;
}

function redirectToReason(res, { editToken, reason }) {
  const qp = new URLSearchParams();
  if (editToken) qp.set("editToken", editToken);
  if (reason) qp.set("reason", reason);
  const location = `/public${qp.toString() ? "?" + qp.toString() : ""}`;
  res.writeHead(302, { Location: location });
  return res.end();
}

async function findProductBound({ db, id, editToken, slug }) {
  // If editToken is present, this is a privileged preview/edit context.
  // Otherwise, REQUIRE slug binding to prevent cross-profile IDOR.
  const baseQuery = editToken
    ? { editToken, "products.id": id }
    : {
        $and: [
          { "products.id": id },
          { $or: [{ publicSlug: slug }, { slug: slug }] },
        ],
      };

  const doc = await db.collection("profiles").findOne(baseQuery, {
    projection: {
      _id: 0,
      editToken: 1,
      slug: 1,
      publicSlug: 1,
      status: 1,
      products: { $elemMatch: { id } },
    },
  });

  const product = doc?.products?.[0];
  if (!product) return { status: "error", code: "not_found" };
  return { status: "ok", product, profile: doc };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  const id = cleanId(pickParam(req.query, ["id", "productId"]));
  const editToken = cleanId(pickParam(req.query, ["editToken"]));
  const slug = cleanSlug(pickParam(req.query, ["slug", "publicSlug"]));
  const debug = pickParam(req.query, ["debug"]).trim() === "1";

  try {
    if (!id) {
      if (debug) {
        return res.status(200).json({
          ok: false,
          stage: "pre",
          error: "Missing product id",
          query: req.query,
        });
      }
      return res.status(400).json({ ok: false, error: "Missing product id" });
    }

    // If this is a public buy (no editToken), require slug binding for IDOR protection.
    if (!editToken && !slug) {
      if (debug) {
        return res.status(200).json({
          ok: false,
          stage: "pre",
          error: "Missing slug",
          query: req.query,
        });
      }
      return redirectToReason(res, { editToken: "", reason: "missing_slug" });
    }

    const diag = {
      ok: true,
      stage: "pre-connect",
      hasEnv: !!MONGODB_URI,
      dbName: MONGODB_DB,
      query: { id, editToken: !!editToken, slug: slug || "" },
    };

    let db;
    try {
      db = (await getClient()).db(MONGODB_DB);
      diag.stage = "post-connect";
      diag.connected = true;
    } catch (e) {
      diag.connected = false;
      diag.connectError = String((e && e.message) || e);
      if (debug) return res.status(200).json(diag);
      throw e;
    }

    // Lookup, bound to slug unless editToken is provided
    let found;
    try {
      found = await findProductBound({ db, id, editToken, slug });
      diag.stage = "post-lookup";
      diag.lookupStatus = found.status;
    } catch (e) {
      diag.lookupStatus = "exception";
      diag.lookupError = String((e && e.message) || e);
      if (debug) return res.status(200).json(diag);
      throw e;
    }

    if (found.status !== "ok") {
      if (debug) {
        diag.result = "not_found";
        return res.status(200).json(diag);
      }
      return redirectToReason(res, { editToken, reason: "unpublished" });
    }

    const p = found.product;

    const priceUrl = toHttpUrl((p.priceUrl || "").trim());
    const left = toNumberOrNull(p.unitsLeft);
    const total = toNumberOrNull(p.unitsTotal);

    const startsMs = toMsOrNull(p.dropStartsAt);
    const endsMs = toMsOrNull(p.dropEndsAt);

    const publishedOk = isPublished(p);

    const block =
      (!publishedOk && "unpublished") ||
      (!priceUrl && "noprice") ||
      ((startsMs !== null && startsMs > Date.now()) && "not_started") ||
      ((left !== null && left <= 0) && "soldout") ||
      ((endsMs !== null && endsMs <= Date.now()) && "expired") ||
      null;

    if (debug) {
      diag.stage = "post-guard";
      diag.product = {
        id: String(p.id || ""),
        published: publishedOk,
        priceUrlPresent: !!priceUrl,
        unitsLeft: left,
        unitsTotal: total,
        dropStartsAt: p.dropStartsAt || null,
        dropStartsAtMs: startsMs,
        dropEndsAt: p.dropEndsAt || null,
        dropEndsAtMs: endsMs,
      };
      diag.block = block;
      if (block) return res.status(200).json(diag);
    }

    if (block) {
      return redirectToReason(res, { editToken, reason: block });
    }

    // Build outgoing URL (tag product id & pass UTMs if any)
    const out = new URL(priceUrl);

    // Always tag product id (do not trust any inbound override)
    if (!out.searchParams.has("client_reference_id")) {
      out.searchParams.set("client_reference_id", id);
    }

    // Optional: tag slug for analytics/debugging (non-sensitive)
    if (slug && !out.searchParams.has("l6_slug")) {
      out.searchParams.set("l6_slug", slug);
    }

    const passthrough = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    for (const key of passthrough) {
      const val = pickParam(req.query, [key]);
      if (val && !out.searchParams.has(key)) out.searchParams.set(key, val);
    }

    res.writeHead(302, { Location: out.toString() });
    return res.end();
  } catch (err) {
    console.error("products/buy error:", err);
    if (pickParam(req.query, ["debug"]).trim() === "1") {
      return res.status(200).json({
        ok: false,
        stage: "catch",
        error: String((err && err.message) || err),
      });
    }
    return res.status(500).json({ ok: false, error: "Buy redirect failed" });
  }
}
