// pages/api/products/buy.js
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

function pickParam(qs, keys) {
  for (const k of keys) {
    const v = qs?.[k];
    if (Array.isArray(v)) return v[0] ?? "";
    if (typeof v === "string") return v;
  }
  return "";
}

function cleanId(v, maxLen = 120) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLen);
}

function cleanSlug(v, maxLen = 80) {
  return cleanId(v, maxLen).toLowerCase();
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
  // Match public API behavior: missing flag => published
  return p?.published === undefined ? true : !!p.published;
}

// Stripe-only allowlist for the outbound redirect
function toStripeCheckoutUrl(u) {
  try {
    const url = new URL(String(u || "").trim());
    if (!/^https?:$/i.test(url.protocol)) return null;

    const host = (url.hostname || "").toLowerCase();
    const isStripe = host === "stripe.com" || host.endsWith(".stripe.com");
    if (!isStripe) return null;

    return url.toString();
  } catch {
    return null;
  }
}

function redirectToProfile(res, { slug, editToken, reason }) {
  const qp = new URLSearchParams();
  if (editToken) qp.set("editToken", editToken);
  if (reason) qp.set("reason", reason);

  const base = slug ? `/${encodeURIComponent(slug)}` : "/public";
  const location = `${base}${qp.toString() ? "?" + qp.toString() : ""}`;

  res.writeHead(302, { Location: location });
  return res.end();
}

function logBeginCheckoutRedirect({ db, productId, slug, req }) {
  try {
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    const utm = {};
    for (const k of utmKeys) {
      const v = pickParam(req.query, [k]);
      if (v) utm[k] = v;
    }

    db.collection("analytics")
      .insertOne({
        type: "begin_checkout_redirect",
        ts: new Date(),
        productId: String(productId || ""),
        slug: String(slug || ""),
        referer: String(req.headers?.referer || ""),
        ua: String(req.headers?.["user-agent"] || ""),
        utm,
      })
      .catch(() => {});
  } catch {}
}

async function findProductBound({ db, id, editToken, slug }) {
  // If editToken is present, allow lookup by editToken + product id.
  // Otherwise, REQUIRE slug binding to prevent cross-profile IDOR.
  const query = editToken
    ? { editToken, "products.id": id }
    : {
        $and: [
          { "products.id": id },
          { $or: [{ publicSlug: slug }, { slug: slug }] },
        ],
      };

  const doc = await db.collection("profiles").findOne(query, {
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
      if (debug) return res.status(200).json({ ok: false, stage: "pre", error: "missing_product_id" });
      return res.status(400).json({ ok: false, error: "missing_product_id" });
    }

    // Public buy MUST be bound to a slug (IDOR protection)
    if (!editToken && !slug) {
      if (debug) return res.status(200).json({ ok: false, stage: "pre", error: "missing_slug" });
      return redirectToProfile(res, { slug: "", editToken: "", reason: "missing_slug" });
    }

    const db = (await getClient()).db(MONGODB_DB);

    const found = await findProductBound({ db, id, editToken, slug });
    if (found.status !== "ok") {
      if (debug) return res.status(200).json({ ok: false, stage: "lookup", error: "not_found" });
      return redirectToProfile(res, { slug, editToken, reason: "unpublished" });
    }

    const p = found.product;

    const priceUrl = toStripeCheckoutUrl(p.priceUrl || "");
    const left = toNumberOrNull(p.unitsLeft);

    const startsMs = toMsOrNull(p.dropStartsAt);
    const endsMs = toMsOrNull(p.dropEndsAt);

    const block =
      (!isPublished(p) && "unpublished") ||
      (!priceUrl && "noprice") ||
      (startsMs !== null && startsMs > Date.now() && "not_started") ||
      (left !== null && left <= 0 && "soldout") ||
      (endsMs !== null && endsMs <= Date.now() && "expired") ||
      null;

    if (debug) {
      return res.status(200).json({
        ok: true,
        stage: "post-guard",
        product: {
          id: String(p.id || ""),
          published: isPublished(p),
          priceUrlPresent: !!priceUrl,
          unitsLeft: left,
          dropStartsAt: p.dropStartsAt || null,
          dropStartsAtMs: startsMs,
          dropEndsAt: p.dropEndsAt || null,
          dropEndsAtMs: endsMs,
        },
        block,
      });
    }

    if (block) {
      return redirectToProfile(res, { slug, editToken, reason: block });
    }

    // Fire-and-forget analytics (low risk if spammed; do not block redirect)
    logBeginCheckoutRedirect({ db, productId: id, slug, req });

    // Build outgoing URL (tag product id & pass UTMs if any)
    const out = new URL(priceUrl);

    // Do not trust inbound overrides
    out.searchParams.set("client_reference_id", id);

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
    if (debug) {
      return res.status(200).json({
        ok: false,
        stage: "catch",
        error: String((err && err.message) || err),
      });
    }
    return res.status(500).json({ ok: false, error: "Buy redirect failed" });
  }
}
