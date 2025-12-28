// pages/api/free/start.js
import { MongoClient } from "mongodb";
import { randomUUID, randomInt } from "crypto";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "linkinbio";

let cachedClient = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

// create a simple, probably-unique slug placeholder
function makeSlug() {
  return `new-creator-${randomInt(1000, 9999)}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const body =
      req.body && typeof req.body === "object"
        ? req.body
        : (() => { try { return JSON.parse(req.body || "{}"); } catch { return {}; } })();

    let { editToken, email } = body || {};
    if (!editToken || typeof editToken !== "string" || editToken.length < 8) {
      editToken = randomUUID();
    }

    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const now = new Date();

    // Minimal but "editor-safe" defaults
    const defaults = {
      editToken,
      createdAt: now,
      status: "active",               // avoid “offline/being updated” banners
      plan: "free",
      planCaps: {
        products: 3,
        imagesPerProduct: 3,
        links: 15,
      },
      displayName: "New Creator",
      bio: "",
      avatarUrl: "",
            theme: "launch6",

      links: [],                      // editor expects arrays present
      products: [],                   // MVP: manual fulfillment
      klaviyo: {
        enabled: false,
        privateKey: null,
        listId: null,
      },
      // public slug is optional but some UIs assume it's non-null
      publicSlug: makeSlug(),
      updatedAt: now,
      email: email || null,
    };

    // Upsert with shape that satisfies editor render
    await db.collection("profiles").updateOne(
      { editToken },
      {
        $setOnInsert: {
          editToken: defaults.editToken,
          createdAt: defaults.createdAt,
        },
        $set: {
          status: defaults.status,
          plan: defaults.plan,
          planCaps: defaults.planCaps,
          displayName: defaults.displayName,
          bio: defaults.bio,
          avatarUrl: defaults.avatarUrl,
          theme: defaults.theme,
          links: defaults.links,
          products: defaults.products,
          klaviyo: defaults.klaviyo,
          publicSlug: defaults.publicSlug,
          updatedAt: defaults.updatedAt,
          email: defaults.email,
        },
      },
      { upsert: true }
    );

    return res.status(200).json({
      ok: true,
      editToken,
      redirect: `/editor?editToken=${encodeURIComponent(editToken)}`,
    });
  } catch (err) {
    console.error("free:start ERROR", { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: "Failed to start Free profile." });
  }
}
