// pages/api/subscribe.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

// Accept either env var name (you have KLAVIYO_PRIVATE_API_KEY in Vercel)
const KLAVIYO_API_KEY =
  process.env.KLAVIYO_API_KEY ||
  process.env.KLAVIYO_PRIVATE_API_KEY ||
  "";

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
  res.setHeader("x-subscribe-version", "v3-klaviyo-relationships"); // deploy tag
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

function safeJsonParse(maybeJson) {
  try {
    return JSON.parse(maybeJson);
  } catch {
    return null;
  }
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
    const name = String(body.name || "").trim();

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
          },
        }
      );

      if (profile?.editToken) editToken = profile.editToken; // normalize downstream
    }

    if (!profile) {
      return res.status(404).json({ ok: false, error: "profile_not_found" });
    }
    if (!profile.collectEmail) {
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
        $set: { updatedAt: now, lastRef: ref || null, name: name || null },
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
        name: name || null,
        ref: ref || null,
      });
    } catch {}

    // --- Klaviyo (STRICT: UI must not say success unless Klaviyo succeeded) ---
    const klaviyo = { attempted: false, ok: false, status: null, reason: null };

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

    // name split (safe)
    const rawName = (name || "").trim();
    const parts = rawName ? rawName.split(/\s+/) : [];
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ").trim();

    // Klaviyo requires consented_at to be in the past when historical_import=true
    const consentedAt = new Date(Date.now() - 5000).toISOString();

    // Correct JSON:API payload uses relationships.list (NOT attributes.list_id)
    const payload = {
      data: {
        type: "profile-subscription-bulk-create-job",
        attributes: {
          custom_source: "Launch6 public page",
          historical_import: true,
          profiles: {
            data: [
              {
                type: "profile",
                attributes: {
                  email,
                  ...(firstName ? { first_name: firstName } : {}),
                  ...(lastName ? { last_name: lastName } : {}),
                  subscriptions: {
                    email: {
                      marketing: {
                        consent: "SUBSCRIBED",
                        consented_at: consentedAt,
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
              id: profile.klaviyoListId,
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
          accept: "application/vnd.api+json",
          "content-type": "application/vnd.api+json",
          revision: "2024-10-15",
        },
        body: JSON.stringify(payload),
      }
    );

    klaviyo.status = kRes.status;

    const kText = await kRes.text().catch(() => "");
    if (!kRes.ok) {
      // keep reason short but useful
      const parsed = safeJsonParse(kText);
      klaviyo.ok = false;
      klaviyo.reason = parsed
        ? JSON.stringify(parsed).slice(0, 500)
        : (kText || "klaviyo_non_2xx").slice(0, 500);

      return res
        .status(502)
        .json({ ok: false, error: "klaviyo_failed", klaviyo });
    }

    klaviyo.ok = true;
    return res.status(200).json({ ok: true, klaviyo });
  } catch (err) {
    console.error("subscribe ERROR", err?.message);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
