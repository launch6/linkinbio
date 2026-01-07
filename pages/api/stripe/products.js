// pages/api/stripe/products.js
import Stripe from "stripe";
import { MongoClient } from "mongodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

const { MONGODB_URI, MONGODB_DB = "linkinbio" } = process.env;

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

function money(amount, currency) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "usd").toUpperCase(),
    }).format((amount || 0) / 100);
  } catch {
    return `$${((amount || 0) / 100).toFixed(2)}`;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

  try {
    const client = await getClient();
    const db = client.db(MONGODB_DB);
    const profile = await db.collection("profiles").findOne(
      { editToken: token },
      { projection: { "stripe.accountId": 1, "stripe.connectedAccountId": 1 } }
    );

    const acct = profile?.stripe?.accountId || profile?.stripe?.connectedAccountId;
    if (!acct) return res.status(400).json({ ok: false, error: "stripe_not_connected" });

    // Products on connected account
    const prods = await stripe.products.list(
      { limit: 50, active: true },
      { stripeAccount: acct }
    );

    const items = [];
    for (const p of prods.data || []) {
      const prices = await stripe.prices.list(
        { product: p.id, limit: 25, active: true },
        { stripeAccount: acct }
      );

      // Prefer one_time prices for art sales
      const oneTime = (prices.data || []).filter((pr) => pr.type === "one_time");
      const chosen = oneTime[0] || (prices.data || [])[0] || null;

      if (!chosen) continue;

      items.push({
        stripeProductId: p.id,
        stripePriceId: chosen.id,
        name: p.name || "Untitled",
        currency: chosen.currency || "usd",
        unitAmount: chosen.unit_amount || 0,
        priceDisplay: money(chosen.unit_amount || 0, chosen.currency || "usd"),
        priceCents: chosen.unit_amount || 0,
      });
    }

    return res.status(200).json({ ok: true, products: items });
  } catch (e) {
    console.error("[stripe/products] error", e?.message || e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
