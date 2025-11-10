// pages/api/profile/update.js
import { MongoClient } from "mongodb";

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

let cached = global._launch6MongoClient;
async function getClient() {
  if (cached) return cached;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  const c = new MongoClient(MONGODB_URI);
  await c.connect();
  cached = c;
  global._launch6MongoClient = c;
  return c;
}

function cleanStr(x, max = 500) {
  if (typeof x !== "string") return "";
  const s = x.trim();
  return s.length > max ? s.slice(0, max) : s;
}
function toBool(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).end("Method Not Allowed");
    }

    // Accept JSON body
    const body =
      req.body && typeof req.body === "object"
        ? req.body
        : (() => {
            try { return JSON.parse(req.body || "{}"); } catch { return {}; }
          })();

    const editToken = cleanStr(body.editToken || "", 200);
    if (!editToken) {
      return res.status(400).json({ ok: false, error: "Missing editToken" });
    }

    // Only allow these fields for now
    const collectEmail = toBool(body.collectEmail);
    const klaviyoListId = cleanStr(body.klaviyoListId || "", 200);

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const Profiles = db.collection("profiles");

    const update = {
      $set: {
        updatedAt: new Date(),
        collectEmail,
        klaviyoListId,
      },
    };

    const result = await Profiles.updateOne({ editToken }, update, { upsert: true });

    return res.status(200).json({
      ok: true,
      matched: result.matchedCount,
      upserted: !!result.upsertedId,
      profile: { editToken, collectEmail, klaviyoListId },
    });
  } catch (err) {
    console.error("profile:update ERROR", { message: err?.message, stack: err?.stack });
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
