// pages/api/subscribe.js
import { MongoClient } from "mongodb";

export const config = {
  api: {
    // Keep payloads small to reduce abuse surface
    bodyParser: { sizeLimit: "16kb" },
  },
};

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// Accept either env var name (you may have KLAVIYO_PRIVATE_API_KEY in Vercel)
const KLAVIYO_API_KEY =
  process.env.KLAVIYO_API_KEY || process.env.KLAVIYO_PRIVATE_API_KEY || "";

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
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("x-subscribe-version", "v6-hardened");
}

function getIp(req) {
  const xff = String(req.headers["x-forwarded-for"] || "");
  const first = xff.split(",")[0]?.trim();
  return first || String(req.socket?.remoteAddress || "unknown");
}

function rateLimitOrThrow(req, { limit, windowMs, keySuffix = "" }) {
  const ip = getIp(req);
  const now = Date.now();
  const key = `sub:${ip}:${keySuffix}`;

  const store = global._l6SubscribeRateLimit || new Map();
  global._l6SubscribeRateLimit = store;

  const hit = store.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > hit.resetAt) {
    hit.count = 0;
    hit.resetAt = now + windowMs;
  }

  hit.count += 1;
  store.set(key, hit);

  // opportunistic cleanup
  if (store.size > 5000) {
    for (const [k, v] of store.entries()) {
      if (now > (v?.resetAt || 0) + windowMs) store.delete(k);
    }
  }

  if (hit.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((hit.resetAt - now) / 1000));
    const err = new Error("rate_limited");
    err.statusCode = 429;
    err.retryAfterSec = retryAfterSec;
    throw err;
  }
}

function sanitizeString(v, maxLen) {
  let s = typeof v === "string" ? v : v == null ? "" : String(v);
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  s = s.trim();
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

// Simple but safe email validation
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const s = email.trim();
  if (!s || s.includes(" ")) return false;
  if (s.length > 254) return false;
  const at = s.indexOf("@");
  if (at <= 0) return false;
  const dot = s.indexOf(".", at + 2);
  if (dot <= at + 1) return false;
  if (dot >= s.length - 1) return false;
  return true;
}

function cleanSlug(v) {
  const s = sanitizeString(v, 80).toLowerCase();
  // keep it tight to reduce weird lookups / logging junk
  if (!s) return "";
  if (!/^[a-z0-9_-]{1,80}$/.test(s)) return "";
  return s;
}

function slugFromRef(ref, reqHost) {
  try {
    const u = new URL(ref);
    // If Referer is present, require same host to prevent cross-site ref spoofing.
    if (reqHost && u.host && u.host !== reqHost) return "";
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  // Reject cross-site HTML form posts and other content-types.
  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (!ct.includes("application/json")) {
    return res.status(415).json({ ok: false, error: "unsupported_media_type" });
  }

  // Best-effort same-origin check when headers exist (does not block valid clients with missing headers).
  const host = String(req.headers.host || "");
  const origin = String(req.headers.origin || "");
  const referer = String(req.headers.referer || "");
  if (origin && host && !origin.includes(host)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }
  if (referer && host) {
    try {
      const r = new URL(referer);
      if (r.host && r.host !== host) {
        return res.status(403).json({ ok: false, error: "forbidden" });
      }
    } catch {
      // ignore malformed referer
    }
  }

  try {
    // Rate limit: per-IP short burst + per-IP sustained.
    rateLimitOrThrow(req, { limit: 6, windowMs: 30_000, keySuffix: "burst" });
    rateLimitOrThrow(req, { limit: 30, windowMs: 10 * 60_000, keySuffix: "sustained" });

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

    const emailRaw = sanitizeString(body.email || "", 300);
    const email = emailRaw.trim().toLowerCase();

    const ref = sanitizeString(typeof body.ref === "string" ? body.ref : "", 2048);
    const name = sanitizeString(body.name || "", 120); // stored in Mongo only (not sent to Klaviyo)

    // Accept editToken OR publicSlug (and infer slug from ref)
    let editToken = sanitizeString(body.editToken || "", 120);
    let publicSlug = cleanSlug(body.publicSlug || "");
    if (!publicSlug && ref) {
      publicSlug = cleanSlug(slugFromRef(ref, host));
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    // Additional rate limit keyed by email to reduce targeted spam
    rateLimitOrThrow(req, { limit: 6, windowMs: 10 * 60_000, keySuffix: `email:${email}` });

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
      // Avoid giving attackers extra signal; keep the existing error your UI expects.
      return res.status(404).json({ ok: false, error: "profile_not_found" });
    }

    // Enabled unless explicitly false (prevents breaking older profiles)
    if (profile.collectEmail === false) {
      return res.status(403).json({ ok: false, error: "email_collection_disabled" });
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
          ip: getIp(req),
          ua: sanitizeString(req.headers?.["user-agent"] || "", 300),
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
        ip: getIp(req),
        ua: sanitizeString(req.headers?.["user-agent"] || "", 300),
      });
    } catch {}

    // ---- Klaviyo (STRICT) ----
    const klaviyo = { attempted: false, ok: false, status: null };

    if (!profile?.klaviyoListId || !KLAVIYO_API_KEY) {
      // Do not leak config specifics to public callers; keep response stable for UI.
      return res.status(502).json({ ok: false, error: "klaviyo_not_configured", klaviyo });
    }

    klaviyo.attempted = true;

    // Correct JSON:API subscribe job shape (list is a relationship, not list_id)
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

    const kRes = await fetchWithTimeout(
      "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/",
      {
        method: "POST",
        headers: {
          Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
          accept: "application/json",
          "content-type": "application/json",
          revision: "2023-10-15",
        },
        body: JSON.stringify(payload),
      },
      7000
    );

    klaviyo.status = kRes.status;
    klaviyo.ok = kRes.ok;

    if (!kRes.ok) {
      const kText = await kRes.text().catch(() => "");
      console.error("klaviyo subscribe failed:", kRes.status, String(kText || "").slice(0, 800));
      return res.status(502).json({ ok: false, error: "klaviyo_failed", klaviyo });
    }

    return res.status(200).json({ ok: true, klaviyo });
  } catch (err) {
    if (err && err.statusCode === 429) {
      res.setHeader("Retry-After", String(err.retryAfterSec || 30));
      return res.status(429).json({ ok: false, error: "rate_limited" });
    }

    console.error("subscribe ERROR", err?.message || err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
