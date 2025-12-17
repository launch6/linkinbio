// pages/api/products/buy.js
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "linkinbio";

// Comma-separated allowlist. Defaults to Stripe Payment Links + Stripe Checkout.
const ALLOWED_CHECKOUT_HOSTS = (process.env.ALLOWED_CHECKOUT_HOSTS ||
  "buy.stripe.com,checkout.stripe.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

let cachedClient = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  const c = new MongoClient(MONGODB_URI);
  await c.connect();
  cachedClient = c;
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

function normalizeSchemelessToHttps(raw) {
  if (typeof raw !== "string") return "";
  const t = raw.trim();
  if (!t) return "";

  // Already has scheme
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(t)) return t;

  // Do not accept relative or protocol-relative
  if (t.startsWith("/") || t.startsWith("//")) return "";

  // Bare domain heuristic
  if (t.includes(".") && !/\s/.test(t)) return `https://${t}`;

  return "";
}

function toHttpUrl(raw) {
  const u = normalizeSchemelessToHttps(raw);
  if (!u) return null;
  try {
    const url = new URL(u);
    if (!/^https?:$/i.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isAllowedCheckoutHost(urlObj) {
  const host = String(urlObj?.hostname || "").toLowerCase();
  if (!host) return false;

  // host === allowed OR host endsWith ".allowed" to permit subdomains if you add them intentionally
  return ALLOWED_CHECKOUT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
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

function redirectToReason(res, { editToken, reason, slug }) {
  const qp = new URLSearchParams();
  if (editToken) qp.set("editToken", editToken);
  if (reason) qp.set("reason", reason);

  const baseSlug = typeof slug === "string" ? slug.trim() : "";
  const base = baseSlug ? `/${encodeURIComponent(baseSlug)}` : "/";

  const location = `${base}${qp.toString() ? "?" + qp.toString() : ""}`;
  res.writeHead(302, { Location: location });
  return res.end();
}

async function findProductBound({ db, id, editToken, slug }) {
  // If editToken is present, privileged preview/edit context.
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

function logBeginCheckout({ db, productId, slug, req }) {
  try {
    const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
    const utm = {};
    for (const k of utmKeys) {
      const v = pickParam(req.query, [k]);
      if (v) utm[k] = v;
    }

    // Fire-and-forget
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
  } catch {
    // ignore
  }
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
  const debugRequested = pickParam(req.query, ["debug"]).trim() === "1";
// Never allow debug output in production
const debug = debugRequested && process.env.NODE_ENV !== "production";


  try {
    if (!id) {
      if (debug) return res.status(200).json({ ok: false, stage: "pre", error: "Missing product id" });
      return res.status(400).json({ ok: false, error: "Missing product id" });
    }

    // Public buys must be slug-bound (IDOR protection)
    if (!editToken && !slug) {
      if (debug) return res.status(200).json({ ok: false, stage: "pre", error: "Missing slug" });
      return redirectToReason(res, { editToken: "", reason: "missing_slug", slug: "" });
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
      if (debug) return res.status(200).json({ ...diag, result: "not_found" });
      return redirectToReason(res, { editToken, reason: "unpublished", slug });
    }

    const p = found.product;

    const priceUrlStr = toHttpUrl((p.priceUrl || "").trim());
    let priceUrlObj = null;
    if (priceUrlStr) {
      try {
        priceUrlObj = new URL(priceUrlStr);
      } catch {
        priceUrlObj = null;
      }
    }

    const hostOk = !!priceUrlObj && isAllowedCheckoutHost(priceUrlObj);

    const left = toNumberOrNull(p.unitsLeft);
    const total = toNumberOrNull(p.unitsTotal);

    const startsMs = toMsOrNull(p.dropStartsAt);
    const endsMs = toMsOrNull(p.dropEndsAt);

    const publishedOk = isPublished(p);

    const block =
      (!publishedOk && "unpublished") ||
      (!priceUrlObj && "noprice") ||
      (!hostOk && "bad_checkout_host") ||
      ((startsMs !== null && startsMs > Date.now()) && "not_started") ||
      ((left !== null && left <= 0) && "soldout") ||
      ((endsMs !== null && endsMs <= Date.now()) && "expired") ||
      null;

    if (debug) {
      return res.status(200).json({
        ...diag,
        stage: "post-guard",
        product: {
          id: String(p.id || ""),
          published: publishedOk,
          priceUrlPresent: !!priceUrlObj,
          checkoutHost: priceUrlObj ? priceUrlObj.hostname : null,
          hostAllowed: hostOk,
          unitsLeft: left,
          unitsTotal: total,
          dropStartsAt: p.dropStartsAt || null,
          dropStartsAtMs: startsMs,
          dropEndsAt: p.dropEndsAt || null,
          dropEndsAtMs: endsMs,
        },
        block,
      });
    }

    if (block) {
      return redirectToReason(res, { editToken, reason: block, slug });
    }

    // Begin-checkout analytics (non-blocking)
    logBeginCheckout({ db, productId: id, slug, req });

    // Build outgoing URL safely
    const out = priceUrlObj;

    // Always tag product id (do not trust any inbound override)
    if (!out.searchParams.has("client_reference_id")) out.searchParams.set("client_reference_id", id);

    // Optional tag for analytics/debugging (non-sensitive)
    if (slug && !out.searchParams.has("l6_slug")) out.searchParams.set("l6_slug", slug);

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
      return res.status(200).json({ ok: false, stage: "catch", error: String((err && err.message) || err) });
    }
    return res.status(500).json({ ok: false, error: "Buy redirect failed" });
  }
}
