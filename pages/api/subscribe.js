// pages/api/subscribe.js
import { MongoClient } from "mongodb";

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
  res.setHeader("x-subscribe-version", "v5-klaviyo-jsonapi");
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

function safeSlice(str, n = 400) {
  if (!str) return "";
  return String(str).slice(0, n);
}

export default async function handler(req, res) {
  noStore(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
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
    const name = String(body.name || "").trim(); // stored in Mongo only (not sent to Klaviyo)

    // Accept editToken OR publicSlug (and infer slug from ref)
    let editToken = String(body.editToken || "").trim();
    let publicSlug = String(body.publicSlug || "").trim() || slugFromRef(ref);

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
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
      return res
        .status(403)
        .json({ ok: false, error: "email_collection_disabled" });
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
      });
    } catch {}

    // ---- Klaviyo (STRICT) ----
    let klaviyo = { attempted: false, ok: false, status: null, reason: null };

    if (!profile?.klaviyoListId) {
      klaviyo.reason = "missing_klaviyo_list_id_on_profile";
      return res
        .status(502)
        .json({ ok: false, error: "klaviyo_not_configured", klaviyo });
    }

    if (!KLAVIYO_API_KEY) {
      klaviyo.reason = "missing_KLAVIYO_API_KEY_env";
      return res
        .status(502)
        .json({ ok: false, error: "klaviyo_not_configured", klaviyo });
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

    const kRes = await fetch(
      "https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/",
      {
        method: "POST",
        headers: {
          Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
          accept: "application/json",
          "content-type": "application/json",
          // pinned revision per Klaviyo docs for this workflow
          revision: "2023-10-15",
        },
        body: JSON.stringify(payload),
      }
    );

    klaviyo.status = kRes.status;
    const kText = await kRes.text().catch(() => "");
    klaviyo.ok = kRes.ok;

    if (!kRes.ok) {
      klaviyo.reason = safeSlice(kText) || "klaviyo_non_2xx";
      return res
        .status(502)
        .json({ ok: false, error: "klaviyo_failed", klaviyo });
    }

    return res.status(200).json({ ok: true, klaviyo });
  } catch (err) {
    console.error("subscribe ERROR", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
