// pages/api/track.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// Optional (recommended) stateless limiter/dedupe via Upstash Redis REST API
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

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
  res.setHeader("x-track-version", "v2-rl-dedupe-origin-sanitize");
  // Always prevent indexing of API routes
  res.setHeader("X-Robots-Tag", "noindex");
}

function safeStr(v, maxLen = 300) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLen);
}

function cleanId(v, maxLen = 120) {
  const s = safeStr(v, maxLen);
  // allow typical ids like prod_1, price_..., etc.
  if (!s) return "";
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) return "";
  return s;
}

function cleanSlug(v, maxLen = 80) {
  return safeStr(v, maxLen).toLowerCase();
}

function getHost(req) {
  return safeStr(req.headers?.host || "", 200).toLowerCase();
}

function isSameOrigin(req) {
  // Soft defense: if Origin is present, it must match Host.
  // If Origin is absent, do not block (keeps beacons/non-browser clients from breaking).
  const origin = safeStr(req.headers?.origin || "", 300);
  if (!origin) return true;
  try {
    const o = new URL(origin);
    return safeStr(o.host || "", 200).toLowerCase() === getHost(req);
  } catch {
    return false;
  }
}

function getClientIp(req) {
  const xff = safeStr(req.headers?.["x-forwarded-for"] || "", 400);
  if (xff) return xff.split(",")[0].trim();
  const xr = safeStr(req.headers?.["x-real-ip"] || "", 80);
  if (xr) return xr;
  return safeStr(req.socket?.remoteAddress || "", 120) || "0.0.0.0";
}

function anonymizeIp(ip) {
  const s = safeStr(ip, 120);
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) {
    const parts = s.split(".");
    parts[3] = "0";
    return parts.join(".");
  }
  // IPv6: keep first 4 hextets
  if (s.includes(":")) {
    const parts = s.split(":").filter(Boolean);
    return parts.slice(0, 4).join(":") + "::";
  }
  return "0.0.0.0";
}

// ---------- Rate limiting + dedupe (Upstash preferred; in-memory fallback) ----------
function memStore() {
  if (!global._l6TrackMem) global._l6TrackMem = new Map();
  return global._l6TrackMem;
}

function memIncr(key, windowMs) {
  const m = memStore();
  const now = Date.now();
  const cur = m.get(key);
  if (!cur || now > cur.resetAt) {
    m.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  cur.count += 1;
  m.set(key, cur);
  return cur.count;
}

function memSetNx(key, windowMs) {
  const m = memStore();
  const now = Date.now();
  const cur = m.get(key);
  if (cur && now <= cur.resetAt) return false;
  m.set(key, { count: 1, resetAt: now + windowMs });
  return true;
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
  const out = await upstashPipeline([
    ["INCR", key],
    ["EXPIRE", key, String(windowSec)],
  ]);
  const incrRes = out?.[0]?.result;
  const count = typeof incrRes === "number" ? incrRes : parseInt(String(incrRes || "0"), 10);
  return { allowed: Number.isFinite(count) ? count <= limit : true, count };
}

async function upstashSetNx(key, windowSec) {
  // SET key value NX EX seconds
  const out = await upstashPipeline([["SET", key, "1", "NX", "EX", String(windowSec)]]);
  // When NX fails, result is null
  return !!out?.[0]?.result;
}

async function hitLimit({ key, limit, windowSec }) {
  const windowMs = windowSec * 1000;

  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashHit(key, limit, windowSec);
    } catch {
      const c = memIncr(key, windowMs);
      return { allowed: c <= limit, count: c };
    }
  }

  const c = memIncr(key, windowMs);
  return { allowed: c <= limit, count: c };
}

async function dedupeOnce({ key, windowSec }) {
  const windowMs = windowSec * 1000;

  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashSetNx(key, windowSec);
    } catch {
      return memSetNx(key, windowMs);
    }
  }

  return memSetNx(key, windowMs);
}

// Allowlist event types (keep tight; add more intentionally)
const ALLOWED_TYPES = new Set(["page_view", "buy_click", "begin_checkout"]);

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  // Soft origin defense (silent success to avoid being an oracle)
  if (!isSameOrigin(req)) {
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

    const type = safeStr(body.type || "", 40);
    const productId = cleanId(body.productId || "");
    const editToken = safeStr(body.editToken || "", 180); // optional; do not trust for auth
    const slug = body.slug ? cleanSlug(body.slug) : null;

    // Timestamp guard (avoid ridiculous values)
    const tsNum = Number(body.ts);
    const ts = Number.isFinite(tsNum) ? tsNum : Date.now();
    const now = Date.now();
    const tsClamped = ts < now - 1000 * 60 * 60 * 24 * 7 ? now : ts > now + 1000 * 60 * 5 ? now : ts;

    // Keep ref/ua bounded (avoid log injection + oversized docs)
    const refRaw = typeof body.ref === "string" ? body.ref : (req.headers?.referer || "");
    const uaRaw = typeof body.ua === "string" ? body.ua : (req.headers?.["user-agent"] || "");
    const ref = safeStr(refRaw, 400);
    const ua = safeStr(uaRaw, 220);

    if (!ALLOWED_TYPES.has(type) || !productId) {
      return res.status(204).end();
    }

    const ip = getClientIp(req);
    const ipAnon = anonymizeIp(ip);

    // Viral-ready limits (invisible):
    // - Per-IP global cap (protect DB)
    // - Per-IP+type cap
    const ipHard = await hitLimit({ key: `l6:track:ip:${ipAnon}`, limit: 120, windowSec: 60 });
    const ipTypeHard = await hitLimit({
      key: `l6:track:ip_type:${ipAnon}:${type}`,
      limit: 60,
      windowSec: 60,
    });

    if (!ipHard.allowed || !ipTypeHard.allowed) {
      return res.status(204).end();
    }

    // Dedupe noisy events (prevents basic spam + accidental repeats)
    // page_view: once per 30s per ip+product
    if (type === "page_view") {
      const ok = await dedupeOnce({
        key: `l6:track:dedupe:${type}:${ipAnon}:${productId}`,
        windowSec: 30,
      });
      if (!ok) return res.status(204).end();
    }

    await db.collection("events").insertOne({
      type,
      productId,
      editToken: editToken || null,
      slug,
      ts: tsClamped,
      ref: ref || null,
      ua: ua || null,
      ip: ipAnon, // store anonymized only
      createdAt: new Date(),
    });

    return res.status(204).end();
  } catch (e) {
    console.error("track error:", e?.message || e);
    return res.status(204).end();
  }
}
