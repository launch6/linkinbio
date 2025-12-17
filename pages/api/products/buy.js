// pages/api/products/buy.js
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "linkinbio";

// Reuse Mongo across invocations (Vercel)
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

function cleanId(v, maxLen = 120) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
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
  // Match public API behavior: missing flag means "published"
  return p?.published === undefined ? true : !!p.published;
}

function redirectToReason(res, { editToken, reason, slug }) {
  const qp = new URLSearchParams();
  if (editToken) qp.set("editToken", editToken);
  if (reason) qp.set("reason", reason);

  const clean = typeof slug === "string" ? slug.trim() : "";
  const base = clean ? `/${encodeURIComponent(clean)}` : "/public";
  const location = `${base}${qp.toString() ? "?" + qp.toString() : ""}`;

  res.writeHead(302, { Location: location });
  return res.end();
}

function logBeginCheckout({ db, productId, slug, req }) {
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
  // If editToken is present, privileged preview/edit context.
  // Otherwise REQUIRE slug binding to prevent cross-profile IDOR.
  const baseQuery = editToken
    ? { editToken, "products.id": id }
    : {
        $and: [{ "products.id": id }, { $or: [{ publicSlug: slug }, { slug: slug }] }],
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
  noStore(res);

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
        return res.status(200).json({ ok: false, stage: "pre", error: "Missing product id", query: req.query });
      }
      return res.status(400).json({ ok: false, error: "Missing product id" });
    }

    // Public buy requires slug binding (IDOR protection)
    if (!editToken && !slug) {
      if (debug) {
        return res.status(200).json({ ok: false, stage: "pre", error: "Missing slug", query: req.query });
      }
      return redirectToReason(res, { editToken: "", reason: "missing_slug", slug: "" });
    }

    const diag = {
      ok: true,
      stage: "pre-connect",
      hasEnv: !!MONGODB_URI,
      dbName: MONGODB_DB,
      query: { id, editToken: !!editToken, slug: slug || "" },
    };

    const db = (await getClient()).db(MONGODB_DB);

    // Lookup, bound to slug unless editToken is provided
    const found = await findProductBound({ db, id, editToken, slug });
    diag.stage = "post-lookup";
    diag.lookupStatus = found.status;

    if (found.status !== "ok") {
      if (debug) return res.status(200).json({ ...diag, result: "not_found" });
      return redirectToReason(res, { editToken, reason: "unpublished", slug });
    }

    const p = found.product;

    const priceUrl = toHttpUrl((p.priceUrl || "").trim());
    const left = toNumberOrNull(p.unitsLeft);

    const startsMs = toMsOrNull(p.dropStartsAt);
    const endsMs = toMsOrNull(p.dropEndsAt);

    const publishedOk = isPublished(p);

    const block =
      (!publishedOk && "unpublished") ||
      (!priceUrl && "noprice") ||
      (startsMs !== null && startsMs > Date.now() && "not_started") ||
      (left !== null && left <= 0 && "soldout") ||
      (endsMs !== null && endsMs <= Date.now() && "expired") ||
      null;

    if (debug) {
      const dbg = {
        ...diag,
        stage: "post-guard",
        product: {
          id: String(p.id || ""),
          published: publishedOk,
          priceUrlPresent: !!priceUrl,
          unitsLeft: left,
          dropStartsAt: p.dropStartsAt || null,
          dropStartsAtMs: startsMs,
          dropEndsAt: p.dropEndsAt || null,
          dropEndsAtMs: endsMs,
        },
        block,
      };
      if (block) return res.status(200).json(dbg);
    }

    if (block) {
      return redirectToReason(res, { editToken, reason: block, slug });
    }

    // Build outgoing URL (tag product id & pass UTMs if any)
    const out = new URL(priceUrl);

    // Always tag product id (do not trust inbound override)
    if (!out.searchParams.has("client_reference_id")) {
      out.searchParams.set("client_reference_id", id);
    }

    // Optional: tag slug for analytics/debugging (non-sensitive)
    const effectiveSlug = slug || found.profile?.publicSlug || found.profile?.slug || "";
    if (effectiveSlug && !out.searchParams.has("l6_slug")) {
      out.searchParams.set("l6_slug", effectiveSlug);
    }

    const passthrough = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    for (const key of passthrough) {
      const val = pickParam(req.query, [key]);
      if (val && !out.searchParams.has(key)) out.searchParams.set(key, val);
    }

    // Analytics: only on real begin-checkout (successful gate + redirect to Stripe)
    logBeginCheckout({ db, productId: id, slug: effectiveSlug, req });

    res.writeHead(302, { Location: out.toString() });
    return res.end();
  } catch (err) {
    console.error("products/buy error:", err);
    if (debug) {
      return res.status(200).json({ ok: false, stage: "catch", error: String((err && err.message) || err) });
    }
    return res.status(500).json({ ok: false, error: "Buy redirect failed" });
  }
}
