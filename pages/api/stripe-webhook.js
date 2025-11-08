// pages/api/stripe-webhook.js
import Stripe from "stripe";
import { MongoClient } from "mongodb";
import { buffer } from "micro"; // <-- official way to get raw body

export const config = {
  api: { bodyParser: false }, // MUST be disabled for Stripe signature verification
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
  return { plan: "starter", cadence: "monthly" };
}

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
  } catch {
    // ignore
  }
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

// ---------- Webhook handler ----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  if (!sig) {
    console.error("WEBHOOK ERROR: Missing stripe-signature header");
    return res.status(400).json({ error: "Missing Stripe signature header" });
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    console.error("WEBHOOK ERROR: Missing STRIPE_WEBHOOK_SECRET env");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  let buf;
  try {
    buf = await buffer(req); // << raw bytes exactly as sent by Stripe
  } catch (e) {
    console.error("WEBHOOK ERROR: Failed to read raw body", { message: e?.message });
    return res.status(400).json({ error: "Unable to read raw body" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    console.error("WEBHOOK VERIFY FAIL", {
      message: err?.message,
      secretTail: endpointSecret.slice(-8),
      payloadBytes: buf?.length,
      sigHeaderSample: String(sig).slice(0, 32) + "...",
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("WEBHOOK OK", { type: event?.type, id: event?.id });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await upsertFromCheckoutSession(event.data.object);
        break;
      case "customer.subscription.created":
        await updateFromSubscriptionCreated(event.data.object);
        break;
      case "invoice.paid":
        await markInvoicePaid(event.data.object);
        break;
      default:
        console.log("Unhandled Stripe event:", event.type);
    }
  } catch (e) {
    console.error("WEBHOOK HANDLER ERROR", { type: event.type, message: e?.message });
    return res.status(500).json({ error: "Failed to persist event" });
  }

  return res.status(200).json({ received: true });
}
