// pages/api/stripe-webhook.js
import Stripe from "stripe";
import { MongoClient } from "mongodb";

export const config = {
  api: { bodyParser: false }, // Stripe needs raw body
};

// ---------- Stripe + DB ----------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // You said Workbench/webhook endpoint is on 2025-10-29.clover
  apiVersion: "2025-10-29.clover",
});

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

// ---------- Helpers ----------
async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    try {
      const chunks = [];
      req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    } catch (e) {
      reject(e);
    }
  });
}

// Map Stripe plan price IDs (env) to Launch6 plans (no unsafe defaults)
const PLAN_PRICE_MAP = [
  { env: "STRIPE_PRICE_STARTER_MONTHLY", plan: "starter", cadence: "monthly" },
  { env: "STRIPE_PRICE_STARTER_LIFETIME", plan: "starter", cadence: "lifetime" },
  { env: "STRIPE_PRICE_PRO_MONTHLY", plan: "pro", cadence: "monthly" },
  { env: "STRIPE_PRICE_PRO_LIFETIME", plan: "pro", cadence: "lifetime" },
  { env: "STRIPE_PRICE_BUSINESS_MONTHLY", plan: "business", cadence: "monthly" },
  { env: "STRIPE_PRICE_BUSINESS_LIFETIME", plan: "business", cadence: "lifetime" },
];

function isPlanPriceId(priceId) {
  if (!priceId) return false;
  for (const row of PLAN_PRICE_MAP) {
    if (process.env[row.env] && process.env[row.env] === priceId) return true;
  }
  return false;
}

function envPriceToPlan(priceId) {
  if (!priceId) return { plan: null, cadence: null };
  for (const row of PLAN_PRICE_MAP) {
    if (process.env[row.env] && process.env[row.env] === priceId) {
      return { plan: row.plan, cadence: row.cadence };
    }
  }
  return { plan: null, cadence: null };
}

// ---------- Plan/Profile updates (kept) ----------
async function upsertFromCheckoutSession(session) {
  const client = await getClient();
  const db = client.db(MONGODB_DB);

  const editToken = session?.metadata?.editToken || null;
  const refCode = session?.metadata?.refCode || null;

  const customerId = session?.customer || null;
  const subscriptionId = session?.subscription || null;

  let priceId = null;
  try {
    const line = session?.line_items?.data?.[0];
    priceId = line?.price?.id || null;
  } catch {}
  priceId = priceId || session?.metadata?.priceId || null;

  const planInfo = envPriceToPlan(priceId);

  const update = {
    $set: {
      updatedAt: new Date(),
      "stripe.customerId": customerId || null,
      "stripe.subscriptionId": planInfo.cadence === "lifetime" ? null : subscriptionId || null,
      "stripe.priceId": priceId || null,
      "stripe.lastEvent": "checkout.session.completed",
      refCode: refCode || null,
      plan: planInfo.plan,
    },
  };

  const query = editToken ? { editToken } : { "stripe.customerId": customerId };
  await db.collection("profiles").updateOne(query, update, { upsert: true });
}

async function updateFromSubscriptionCreated(sub) {
  const client = await getClient();
  const db = client.db(MONGODB_DB);

  const customerId = sub?.customer || null;
  const subscriptionId = sub?.id || null;
  const priceId = sub?.items?.data?.[0]?.price?.id || null;
  const planInfo = envPriceToPlan(priceId);

  await db.collection("profiles").updateOne(
    { "stripe.customerId": customerId },
    {
      $set: {
        updatedAt: new Date(),
        "stripe.subscriptionId": subscriptionId,
        "stripe.priceId": priceId,
        "stripe.lastEvent": "customer.subscription.created",
        plan: planInfo.plan,
      },
    }
  );
}

async function markInvoicePaid(inv) {
  const client = await getClient();
  const db = client.db(MONGODB_DB);

  const customerId = inv?.customer || null;
  const priceId = inv?.lines?.data?.[0]?.price?.id || null;
  const planInfo = envPriceToPlan(priceId);

  await db.collection("profiles").updateOne(
    { "stripe.customerId": customerId },
    {
      $set: {
        updatedAt: new Date(),
        "stripe.lastEvent": "invoice.paid",
        "stripe.priceId": priceId || null,
        plan: planInfo.plan,
      },
    }
  );
}

// ---------- Product stock decrement ----------
async function wasProcessed(eventId) {
  const client = await getClient();
  const db = client.db(MONGODB_DB);
  const col = db.collection("events_processed");
  const found = await col.findOne({ _id: eventId });
  return !!found;
}
async function markProcessed(eventId) {
  const client = await getClient();
  const db = client.db(MONGODB_DB);
  const col = db.collection("events_processed");
  try {
    await col.insertOne({ _id: eventId, ts: Date.now() });
  } catch {
    // duplicate insert is fine (already processed)
  }
}

/**
 * Decrement unitsLeft by 1 for productId across any profile document that has that product.
 * Guard: only decrement if unitsLeft is a number >= 1.
 */
async function decrementUnitsLeftByProductId(productId) {
  if (!productId) return { matched: 0, modified: 0, product: null };

  const client = await getClient();
  const db = client.db(MONGODB_DB);
  const Profiles = db.collection("profiles");

  // Find the document that contains this product with unitsLeft >= 1
  const doc = await Profiles.findOne(
    { "products.id": productId, "products.unitsLeft": { $type: "number", $gte: 1 } },
    { projection: { _id: 1 } }
  );
  if (!doc?._id) return { matched: 0, modified: 0, product: null };

  // Atomic decrement on the matching array element
  const r = await Profiles.updateOne(
    { _id: doc._id, "products.id": productId, "products.unitsLeft": { $type: "number", $gte: 1 } },
    { $inc: { "products.$.unitsLeft": -1 }, $set: { updatedAt: new Date() } }
  );

  // Return the updated product snapshot (optional, helpful for logs)
  const updated = await Profiles.findOne(
    { _id: doc._id, "products.id": productId },
    { projection: { _id: 0, products: { $elemMatch: { id: productId } } } }
  );

  return {
    matched: r.matchedCount || 0,
    modified: r.modifiedCount || 0,
    product: updated?.products?.[0] || null,
  };
}

// ---------- Webhook handler ----------
export default async function handler(req, res) {
  try {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      return res.status(400).json({ error: "Missing Stripe signature header" });
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("WEBHOOK ERROR: Missing STRIPE_WEBHOOK_SECRET env");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    const rawBody = await readRawBody(req);

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("WEBHOOK VERIFY FAIL", { message: err?.message });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const type = event.type;
    const obj = event.data.object;

    // Idempotency gate for decrementing logic (only for events we act on)
    const candidateForDecrement =
      type === "checkout.session.completed" &&
      obj?.payment_status === "paid" &&
      obj?.status === "complete";

    if (candidateForDecrement) {
      // If we've already processed this event, skip entirely
      if (await wasProcessed(event.id)) {
        return res.status(200).json({ received: true, duplicate: true });
      }
    }

    switch (type) {
      case "checkout.session.completed": {
        // Keep your plan/profile logic
        try {
          await upsertFromCheckoutSession(obj);
        } catch (e) {
          console.error("checkout.session.completed profile update error", { message: e?.message });
          // continue; profile plan update failing should not block stock decrement
        }

        // New: product stock decrement — requires client_reference_id set by /api/products/buy
        const productId = obj?.client_reference_id || null;

        if (productId) {
          try {
            const dec = await decrementUnitsLeftByProductId(productId);
            // Mark processed after successful attempt (even if matched=0, to avoid replays)
            await markProcessed(event.id);

            return res.status(200).json({
              received: true,
              decremented: dec.modified === 1,
              match: dec.matched,
              productId,
              productSnapshot: dec.product || null,
            });
          } catch (e) {
            console.error("decrementUnitsLeft error", { message: e?.message, productId });
            // Don't mark processed here so Stripe can retry
            return res.status(500).json({ error: "Failed to decrement unitsLeft" });
          }
        } else {
          // No product id present — just acknowledge so Stripe doesn't keep retrying
          await markProcessed(event.id);
          return res.status(200).json({ received: true, productId: null });
        }
      }

      case "customer.subscription.created": {
        try {
          await updateFromSubscriptionCreated(obj);
        } catch (e) {
          console.error("subscription.created handler error", { message: e?.message });
          return res.status(500).json({ error: "Failed to persist subscription" });
        }
        break;
      }

      case "invoice.paid": {
        try {
          await markInvoicePaid(obj);
        } catch (e) {
          console.error("invoice.paid handler error", { message: e?.message });
          return res.status(500).json({ error: "Failed to persist invoice" });
        }
        break;
      }

      default:
        // Acknowledge unhandled events
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("stripe-webhook UNCAUGHT", { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: "Internal webhook error" });
  }
}
