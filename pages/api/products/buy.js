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

function toHttpUrl(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/i.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function redirectToReason(res, { editToken, reason }) {
  const qp = new URLSearchParams();
  if (editToken) qp.set("editToken", editToken);
  if (reason) qp.set("reason", reason);
  const location = `/public${qp.toString() ? "?" + qp.toString() : ""}`;
  res.writeHead(302, { Location: location });
  return res.end();
}

function pickParam(qs, keys) {
  for (const k of keys) {
    const v = qs[k];
    if (Array.isArray(v)) return v[0] ?? "";
    if (typeof v === "string") return v;
  }
  return "";
}

function toNumberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

async function findProduct({ db, id, editToken }) {
  const baseQuery = editToken
    ? { editToken, "products.id": id }
    : { "products.id": id };

  const doc = await db.collection("profiles").findOne(
    baseQuery,
    {
      projection: {
        _id: 0,
        editToken: 1,
        slug: 1,
        products: { $elemMatch: { id } },
      },
    }
  );

  const product = doc?.products?.[0];
  if (!product) return { status: "error", code: "not_found" };
  return { status: "ok", product, profile: doc };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method Not Allowed");
  }

  const id = pickParam(req.query, ["id", "productId"]).trim();
  const editToken = pickParam(req.query, ["editToken"]).trim();
  const debug = pickParam(req.query, ["debug"]).trim() === "1";

  try {
    if (!id) {
      if (debug) {
        return res.status(200).json({ ok: false, stage: "pre", error: "Missing product id", query: req.query });
      }
      return res.status(400).json({ ok: false, error: "Missing product id" });
    }

    // Stage 1: env + DB
    const diag = {
      ok: true,
      stage: "pre-connect",
      hasEnv: !!MONGODB_URI,
      dbName: MONGODB_DB,
      query: { id, editToken },
    };

    let db;
    try {
      db = (await getClient()).db(MONGODB_DB);
      diag.stage = "post-connect";
      diag.connected = true;
    } catch (e) {
      diag.connected = false;
      diag.connectError = String(e && e.message || e);
      if (debug) return res.status(200).json(diag);
      throw e;
    }

    // Stage 2: lookup
    let found;
    try {
      found = await findProduct({ db, id, editToken });
      diag.stage = "post-lookup";
      diag.lookupStatus = found.status;
    } catch (e) {
      diag.lookupStatus = "exception";
      diag.lookupError = String(e && e.message || e);
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
    const endsIso = p.dropEndsAt || "";
    const endsMs = endsIso ? Date.parse(endsIso) : null;

    const block =
      (!p.published && "unpublished") ||
      (!priceUrl && "noprice") ||
      ((left !== null && left <= 0) && "soldout") ||
      ((Number.isFinite(endsMs) && endsMs <= Date.now()) && "expired") ||
      null;

    if (debug) {
      diag.stage = "post-guard";
      diag.product = {
        id: p.id,
        published: !!p.published,
        priceUrlPresent: !!priceUrl,
        unitsLeft: left,
        unitsTotal: total,
        dropEndsAt: endsIso || null,
        dropEndsAtMs: endsMs ?? null,
      };
      diag.block = block;
      if (block) {
        return res.status(200).json(diag);
      }
    }

    if (block) {
      return redirectToReason(res, { editToken, reas
