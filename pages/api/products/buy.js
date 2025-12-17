// pages/api/products/buy.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// --- DB bootstrap with global cache (serverless-friendly) ---
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

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}

function pickParam(qs, keys) {
  for (const k of keys) {
    const v = qs[k];
    if (Array.isArray(v)) return v[0] ?? "";
    if (typeof v === "string") return v;
  }
  return "";
}

function cleanText(v, maxLen = 200) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLen);
}

function cleanSlug(v, maxLen = 80) {
  return cleanText(v, maxLen).toLowerCase();
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

function redirectToProfile(res, { slug, reason }) {
  const qp = new URLSearchParams();
  if (reason) qp.set("reason", reason);

  const base = slug ? `/${encodeURIComponent(slug)}` : "/public";
  const location = `${base}${qp.toString() ? `?${qp.toString()}` : ""}`;

  noStore(res);
  res.writeHead(302, { Location: location });
  return res.end();
}

function fireAndForgetBeginCheckout({ db, productId, slug, req }) {
  try {
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    const utm = {};
    for (const k of utmKeys) {
      const v = pickParam(req.query, [k]);
      if (v) utm[k] = v;
    }

    db.collection("analytics")
      .insertOne({
        type: "begin_checkout",
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
  // If editToken is present, allow privileged preview (no slug binding).
  // Otherwise REQUIRE slug binding to prevent cross-profile IDOR.
  const query = editToken
    ? { editToken, "products.id": id }
    : { $and: [{ "products.id": id }, { $or: [{ publicSlug: slug }, { slug }] }] };

  const doc = await db.collection("profiles").findOne(query, {
    projection: {
      _id: 0,
      slug: 1,
      publicSlug: 1,
      status: 1,
      products: { $elemMatch: { id } },
    },
  });

  const product = doc?.products?.[0];
  if (!product) return { status: "error", code: "not_found" };

  const resolvedSlug = cleanSlug(doc.publicSlug || doc.slug || slug || "");
  return { status: "ok", product, resolvedSlug };
}

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  const id = cleanText(pickParam(req.query, ["id", "productId"]), 120);
  const editToken = cleanText(pickParam(req.query, ["editToken"]), 200);
  const slug = cleanSlug(pickParam(req.query, ["slug", "publicSlug"]), 80);
  const debug = pickParam(req.query, ["debug"]).trim() === "1";

  try {
    if (!id) {
      if (debug) return res.status(200).json({ ok: false, stage: "pre", error: "missing_product_id" });
      return res.status(400).json({ ok: false, error: "Missing product id" });
    }

    // Public buys must be slug-bound (IDOR protection)
    if (!editToken && !slug) {
      if (debug) return res.status(200).json({ ok: false, stage: "pre", error: "missing_slug" });
      return redirectToProfile(res, { slug: "", reason: "missing_slug" });
    }

    const client = await getClient();
    const db = client.db(MONGODB_DB);

    const found = await findProductBound({ db, id, editToken, slug });
    if (found.status !== "ok") {
      if (debug) return res.status(200).json({ ok: false, stage: "lookup", error: "not_found" });
      return redirectToProfile(res, { slug, reason: "unpublished" });
    }

    const p = found.product;
    const resolvedSlug = found.resolvedSlug || slug;

    const priceUrl = toHttpUrl(cleanText(p.priceUrl || "", 2000));
    const left = toNumberOrNull(p.unitsLeft);
    const total = toNumberOrNull(p.unitsTotal);

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
        block,
        resolvedSlug,
        product: {
          id: String(p.id || ""),
          published: isPublished(p),
          priceUrlPresent: !!priceUrl,
          unitsLeft: left,
          unitsTotal: total,
          dropStartsAt: p.dropStartsAt || null,
          dropEndsAt: p.dropEndsAt || null,
        },
      });
    }

    if (block) {
      return redirectToProfile(res, { slug: resolvedSlug, reason: block });
    }

    // Track "begin checkout" (best-effort)
    fireAndForgetBeginCheckout({ db, productId: id, slug: resolvedSlug, req });

    // Redirect to Stripe URL safely and append tracking params
    const out = new URL(priceUrl);

    if (!out.searchParams.has("client_reference_id")) {
      out.searchParams.set("client_reference_id", id);
    }
    if (resolvedSlug && !out.searchParams.has("l6_slug")) {
      out.searchParams.set("l6_slug", resolvedSlug);
    }

    const passthrough = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    for (const key of passthrough) {
      const val = pickParam(req.query, [key]);
      if (val && !out.searchParams.has(key)) out.searchParams.set(key, val);
    }

    noStore(res);
    res.writeHead(302, { Location: out.toString() });
    return res.end();
  } catch (err) {
    console.error("products/buy error:", err);
    if (pickParam(req.query, ["debug"]).trim() === "1") {
      return res.status(200).json({ ok: false, stage: "catch", error: String(err?.message || err) });
    }
    return res.status(500).json({ ok: false, error: "Buy redirect failed" });
  }
}
