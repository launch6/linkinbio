// pages/api/track.js
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "linkinbio";

// Optional (recommended) stateless limiter via Upstash Redis REST API
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

// Share the Mongo client across API routes on the same warm instance
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
  res.setHeader("x-track-version", "v2-quiet-rl-allowlist");
}

function safeSlice(str, n = 600) {
  if (!str) return "";
  return String(str).slice(0, n);
}

function getHost(req) {
  return String(req.headers?.host || "").trim().toLowerCase();
}

function isSameOrigin(req) {
  // Soft defense: browsers send Origin; scripts often do not.
  // If Origin is present and does not match Host, treat as spam and return 204.
  const origin = String(req.headers?.origin || "").trim();
  if (!origin) return true;
  try {
    const o = new URL(origin);
    return String(o.host || "").toLowerCase() === getHost(req);
  } catch {
    return false;
  }
}

function getClientIp(req) {
  const xff = String(req.headers?.["x-forwarded-for"] || "").trim();
  if (xff) return xff.split(",")[0].trim();
  const xr = String(req.headers?.["x-real-ip"] || "").trim();
  if (xr) return xr;
  return (req.socket?.remoteAddress || "0.0.0.0").toString();
}

// ---------- Rate limiting (Upstash preferred; in-memory fallback) ----------
function memLimiter() {
  if (!global._l6TrackMemRL) global._l6TrackMemRL = new Map(); // Map<key, {count, resetAt}>
  return global._l6TrackMemRL;
}

function memHit(key, limit, windowMs) {
  const m = memLimiter();
  const now = Date.now();
  const cur = m.get(key);
  if (!cur || now > cur.resetAt) {
    m.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, count: 1 };
  }
  cur.count += 1;
  m.set(key, cur);
  return { allowed: cur.count <= limit, count: cur.count };
}

async function upstashPipeline(cmds) {
  const url = `${UPSTASH_REDIS_REST_URL.replace(/\/$/, "")}/pipeline`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`upstash_${r.status}`);
  return r.json();
}

async function upstashHit(key, limit, windowSec) {
  const cmds = [
    ["INCR", key],
    ["EXPIRE", key, String(windowSec)],
  ];
  const out = await upstashPipeline(cmds);
  const incrRes = out?.[0]?.result;
  const count = typeof incrRes === "number" ? incrRes : parseInt(String(incrRes || "0"), 10);
  return { allowed: Number.isFinite(count) ? count <= limit : true, count };
}

async function hitLimit({ key, limit, windowSec }) {
  const windowMs = windowSec * 1000;
  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashHit(key, limit, windowSec);
    } catch {
      return memHit(key, limit, windowMs);
    }
  }
  return memHit(key, limit, windowMs);
}

// Allowlist event types to reduce analytics poisoning
const ALLOWED_TYPES = new Set([
  "buy_click",
  "begin_checkout",
  "email_submit",
  "page_view",
]);

export default async function handler(req, res) {
  // SECURITY: this endpoint must not exist in production (prevents event spam + storage abuse)
  if (process.env.NODE_ENV === "production") {
    return res.status(404).end("Not Found");
  }

  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  // Same-origin soft check (silent)
  if (!isSameOrigin(req)) {
    return res.status(204).end();
  }

  const ip = getClientIp(req);

  // Viral-safe: high ceiling, still blocks obvious floods (per IP)
  const ipCap = await hitLimit({ key: `l6:track:ip:${ip}`, limit: 240, windowSec: 60 });
  if (!ipCap.allowed) {
    return res.status(204).end();
  }

  try {
    const db = (await getClient()).db(MONGODB_DB);

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

    const type = safeSlice(body.type, 48);
    if (!type || !ALLOWED_TYPES.has(type)) {
      return res.status(204).end();
    }

    const productId = safeSlice(body.productId, 160);
    const editToken = safeSlice(body.editToken, 180);
    const slug = body.slug ? safeSlice(body.slug, 120) : null;

    // If caller supplies ts, accept it only when reasonable
    const tsRaw = Number(body.ts);
    const ts = Number.isFinite(tsRaw) && tsRaw > 0 && tsRaw < Date.now() + 5 * 60 * 1000 ? tsRaw : Date.now();

    const ref =
      typeof body.ref === "string"
        ? safeSlice(body.ref, 900)
        : safeSlice(req.headers?.referer || "", 900);

    const ua =
      typeof body.ua === "string"
        ? safeSlice(body.ua, 260)
        : safeSlice(req.headers?.["user-agent"] || "", 260);

    // Require some identifier so attackers cannot fill your DB with empty junk
    const hasAnyId = !!productId || !!slug || !!editToken;
    if (!hasAnyId) return res.status(204).end();

    // Fire-and-forget insert; do not block user
    db.collection("events")
      .insertOne({
        type,
        productId: productId || null,
        editToken: editToken || null,
        slug,
        ts,
        ref,
        ua,
        ip,
      })
      .catch(() => {});

    return res.status(204).end();
  } catch (e) {
    // Never block UX; do not echo internals
    console.error("track error:", e?.message || e);
    return res.status(204).end();
  }
}
