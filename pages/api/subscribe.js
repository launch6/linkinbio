// pages/api/subscribe.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// Accept either env var name (you may have KLAVIYO_PRIVATE_API_KEY in Vercel)
const KLAVIYO_API_KEY =
  process.env.KLAVIYO_API_KEY || process.env.KLAVIYO_PRIVATE_API_KEY || "";

// Optional (recommended) stateless limiter via Upstash Redis REST API
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";

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

function noStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("x-subscribe-version", "v6-honeypot-rl-klaviyo-soft");
}

function safeSlice(str, n = 400) {
  if (!str) return "";
  return String(str).slice(0, n);
}

// Simple but safe email validation
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const s = email.trim();
  if (!s || s.includes(" ")) return false;
  const at = s.indexOf("@");
  if (at <= 0) return false;
  const dot = s.indexOf(".", at + 2);
  if (dot <= at + 1) return false;
  if (dot >= s.length - 1) return false;
  return true;
}

function slugFromRef(ref) {
  try {
    const u = new URL(ref);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  } catch {
    return "";
  }
}

function getHost(req) {
  return String(req.headers?.host || "").trim().toLowerCase();
}

function isSameOrigin(req) {
  // Soft defense: block cross-site spam while not breaking non-browser clients.
  // Browsers send Origin on fetch POST; curl often does not.
  const origin = String(req.headers?.origin || "").trim();
  if (!origin) return true;
  try {
    const host = getHost(req);
    const o = new URL(origin);
    return String(o.host || "").toLowerCase() === host;
  } catch {
    return false;
  }
}

function getClientIp(req) {
  // Vercel sets x-forwarded-for: "client, proxy1, proxy2"
  const xff = String(req.headers?.["x-forwarded-for"] || "").trim();
  if (xff) return xff.split(",")[0].trim();
  const xr = String(req.headers?.["x-real-ip"] || "").trim();
  if (xr) return xr;
  return "0.0.0.0";
}

// ---------- Rate limiting (Upstash preferred; in-memory fallback) ----------
function memLimiter() {
  // Map<key, { count:number, resetAt:number }>
  if (!global._l6SubscribeMemRL) global._l6SubscribeMemRL = new Map();
  return global._l6SubscribeMemRL;
}

function memHit(key, limit, windowMs) {
  const m = memLimiter();
  const now = Date.now();
  const cur = m.get(key);
  if (!cur || now > cur.resetAt) {
    m.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, count: 1 };
  }
  const next = cur.count + 1;
  cur.count = next;
  m.set(key, cur);
  return { allowed: next <= limit, count: next };
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

// Sliding-window counters: INCR + EXPIRE each hit
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

  // Prefer stateless Upstash if configured
  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashHit(key, limit, windowSec);
    } catch {
      // degrade silently to mem
      return memHit(key, limit, windowMs);
    }
  }

  // local/dev fallback
  return memHit(key, limit, windowMs);
}

// -------------------- Handler --------------------
export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  // Origin/Host soft check (silent fail to avoid becoming an oracle for attackers)
  if (!isSameOrigin(req)) {
    return res.status(200).json({ ok: true, klaviyo: { attempted: false, ok: false } });
  }

  try {
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

    const email = String(body.email || "").trim().toLowerCase();
    const ref = typeof body.ref === "string" ? body.ref : "";
    const name = String(body.name || "").trim();

    // Honeypot: bots often fill it; humans never see it.
    const website = String(body.website || "").trim();

    // Optional timing hint from client (ms timestamp). Use as a weak signal only.
    const formTs = (() => {
      const n = Number(body.formTs);
      return Number.isFinite(n) ? n : null;
    })();
    const tooFast = formTs != null ? Date.now() - formTs < 350 : false;

    // Accept editToken OR publicSlug (and infer slug from ref)
    let editToken = String(body.editToken || "").trim();
    let publicSlug = String(body.publicSlug || "").trim() || slugFromRef(ref);
    publicSlug = String(publicSlug || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    // Hard bot signal: honeypot filled.
    // Respond success but do not store or forward.
    if (website) {
      return res.status(200).json({ ok: true, klaviyo: { attempted: false, ok: false } });
    }

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");
    const Subs = db.collection("subscribers");
    const Events = db.collection("events");

    // Resolve profile by editToken or publicSlug
    let profile = null;

    if (editToken) {
      profile = await Profiles.findOne(
        { editToken },
        {
          projection: {
            _id: 0,
            editToken: 1,
            collectEmail: 1,
            klaviyoListId: 1,
            publicSlug: 1,
            slug: 1,
          },
        }
      );
    } else if (publicSlug) {
      profile = await Profiles.findOne(
        { $or: [{ publicSlug }, { slug: publicSlug }] },
        {
          projection: {
            _id: 0,
            editToken: 1,
            collectEmail: 1,
            klaviyoListId: 1,
            publicSlug: 1,
            slug: 1,
          },
        }
      );
      if (profile?.editToken) editToken = profile.editToken;
    }

    if (!profile) {
      return res.status(404).json({ ok: false, error: "profile_not_found" });
    }

    // Enabled unless explicitly false (prevents breaking older profiles)
    if (profile.collectEmail === false) {
      return res.status(403).json({ ok: false, error: "email_collection_disabled" });
    }

    const ip = getClientIp(req);
    const slugKey = String(profile.publicSlug || profile.slug || publicSlug || "").toLowerCase();

    // Viral-ready limits:
    // - Per-IP cap (protects DB + downstream)
    // - Per-IP+slug cap (tightest)
    // - Per-slug cap applies ONLY to Klaviyo forwarding (protect deliverability during attacks)
    const ipHard = await hitLimit({ key: `l6:sub:ip:${ip}`, limit: 25, windowSec: 60 });
    const ipSlugHard = await hitLimit({ key: `l6:sub:ip_slug:${ip}:${slugKey}`, limit: 10, windowSec: 60 });

    // If a user trips hard limits, respond success but do not store.
    if (!ipHard.allowed || !ipSlugHard.allowed) {
      return res.status(200).json({ ok: true, klaviyo: { attempted: false, ok: false } });
    }

    // Upsert subscriber (unique by editToken + email)
    const now = new Date();
    await Subs.updateOne(
      { editToken, email },
      {
        $setOnInsert: { editToken, email, createdAt: now },
        $set: {
          updatedAt: now,
          lastRef: ref || null,
          ...(name ? { name } : {}),
          // store soft risk signals for later review / dashboards (does not affect UX)
          ...(tooFast ? { risk: { tooFast: true, ts: now } } : {}),
        },
      },
      { upsert: true }
    );

    // Log event (best-effort)
    try {
      await Events.insertOne({
        type: "email_submit",
        editToken,
        ts: Date.now(),
        email,
        ref: ref || null,
        ip,
        slug: slugKey,
        tooFast,
      });
    } catch {}

    // ---- Klaviyo (soft + protective) ----
    // Default behavior: internal save succeeded => return ok: true.
    // Only attempt Klaviyo when configured AND traffic is not suspicious.
    const klaviyo = { attempted: false, ok: false, status: null };

    // If creator has not configured Klaviyo, still succeed.
    if (!profile?.klaviyoListId || !KLAVIYO_API_KEY) {
      return res.status(200).json({ ok: true, klaviyo });
    }

    // Slug-level limiter for Klaviyo forwarding only (protect account health during attacks)
    const slugForward = await hitLimit({ key: `l6:sub:slug_forward:${slugKey}`, limit: 600, windowSec: 60 });

    // If suspicious, skip Klaviyo silently
    if (tooFast || !slugForward.allowed) {
      return res.status(200).json({ ok: true, klaviyo });
    }

    klaviyo.attempted = true;

    // Correct JSON:API subscribe job shape
    const payload = {
      data: {
        type: "profile-subscription-bulk-create-job",
        attributes: {
          profiles: {
            data: [
              {
                type: "profile",
                attributes: {
                  email,
                  subscriptions: {
                    email: {
                      marketing: {
                        consent: "SUBSCRIBED",
                      },
                    },
                  },
                },
              },
            ],
          },
        },
        relationships: {
          list: {
            data: {
              type: "list",
              id: String(profile.klaviyoListId).trim(),
            },
          },
        },
      },
    };

    const kRes = await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/", {
      method: "POST",
      headers: {
        Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
        accept: "application/json",
        "content-type": "application/json",
        revision: "2023-10-15",
      },
      body: JSON.stringify(payload),
    });

    klaviyo.status = kRes.status;
    klaviyo.ok = kRes.ok;

    // Never fail the fan’s UX due to Klaviyo.
    if (!kRes.ok) {
      const kText = await kRes.text().catch(() => "");
      console.error("klaviyo_failed", kRes.status, safeSlice(kText));
      return res.status(200).json({ ok: true, klaviyo: { attempted: true, ok: false, status: kRes.status } });
    }

    return res.status(200).json({ ok: true, klaviyo });
  } catch (err) {
    console.error("subscribe ERROR", err?.message || err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
