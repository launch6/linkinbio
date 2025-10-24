// pages/api/pricing/list.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const PRICE_KEYS = [
  "STRIPE_PRICE_STARTER_MONTHLY",
  "STRIPE_PRICE_STARTER_LIFETIME",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_LIFETIME",
  "STRIPE_PRICE_BUSINESS_MONTHLY",
  "STRIPE_PRICE_BUSINESS_LIFETIME",
];

export default async function handler(req, res) {
  try {
    const out = {};
    for (const key of PRICE_KEYS) {
      const id = process.env[key];
      if (!id) continue;
      try {
        const price = await stripe.prices.retrieve(id);
        out[key] = {
          id: price.id,
          currency: price.currency,
          unit_amount: price.unit_amount,
          type: price.type,
          interval: price.recurring?.interval || null,
          nickname: price.nickname || null,
        };
      } catch (e) {
        out[key] = { error: `Could not retrieve ${id}` };
      }
    }
    res.status(200).json({ prices: out });
  } catch (err) {
    console.error("pricing/list error", err);
    res.status(500).json({ error: "Failed to load prices" });
  }
}
