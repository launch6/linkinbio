// pages/api/stripe-webhook.js
import Stripe from "stripe";
import { MongoClient } from "mongodb";

export const config = {
  api: { bodyParser: false }, // Stripe requires the raw body to verify signatures
};

// ---------- Stripe + DB ----------
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
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

function envPriceToPlan(priceId) {
  if (!priceId) return { plan: "free", cadence: null };
  const map = [
    { env: "STRIPE_PRICE_STARTER_MONTHLY", plan: "starter", cadence: "monthly" },
    { env: "STRIPE_PRICE_STARTER_LIFETIME", plan: "starter", cadence: "lifetime" },
    { env: "STRIPE_PRICE_PRO_MONTHLY", plan: "pro", cadence: "monthly" },
    { env: "STRIPE_PRICE_PRO_LIFETIME", plan: "pro", cadence: "lifetime" },
    { env: "STRIPE_PRICE_BUSINESS_MONTHLY", plan: "business", cadence: "monthly" },
    { env: "STRIPE_PRICE_BUSINESS_LIFETIME", plan: "business", cadence: "lifetime" },
  ];
  for (const row of map) {
    if (process.env[row.env] && process.env[row.env] === priceId) {
      return { plan: row.plan, cadence: row.cadence };
    }
  }
  // Fallback: assume starter monthly if unknown (but store priceId)
  return { plan: "starter", cadence: "monthly" };
}

async function upsertFromCheckoutSession(session) {
  const client = await getClient();
  const db = client.db(MONGODB_DB);

  // Metadata we set when creating Checkout Session
  const editToken = session?.metadata?.editToken || null;
  const refCode = session?.metadata?.refCode || null;

  // Subscription sessions have subscription + customer + line_items
  const customerId = session?.customer || null;
  const subscriptionId = session?.subscription || null;

  // Stripe may not expand line items; grab the price from the session if present
  let priceId = null;
  try {
    const line = session?.line_items?.data?.[0];
    priceId = line?.price?.id || null;
  } catch {
    // ignore
  }
  // Fallback: some sessions include display_items/after_expansion; or we keep price in metadata.priceId
  priceId = priceId || session?.metadata?.priceId || null;

  // Determine plan from price
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

// ---------- Webhook handler ----------
export default async function handler(req, res) {
  try {
    // Minimal debug to confirm runtime values (safe to keep)
    console.log("webhook: method", req.method, "url", req.url, "host", req.headers.host);
    console.log("webhook: header keys", Object.keys(req.headers || {}));
    console.log("webhook: secret prefix", (process.env.STRIPE_WEBHOOK_SECRET || "").slice(0, 8)); // <—

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

    switch (type) {
      case "checkout.session.completed": {
        try {
          await upsertFromCheckoutSession(obj);
        } catch (e) {
          console.error("checkout.session.completed handler error", { message: e?.message });
          return res.status(500).json({ error: "Failed to persist checkout session" });
        }
        break;
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
        console.log("Unhandled Stripe event:", type);
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("stripe-webhook UNCAUGHT", { message: err?.message, stack: err?.stack });
    return res.status(500).json({ error: "Internal webhook error" });
  }
}
