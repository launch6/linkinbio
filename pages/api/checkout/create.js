// pages/api/checkout/create.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export default async function handler(req, res) {
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

    const { editToken, email, priceId, priceKey } = body;

    if (!editToken) {
      return res.status(400).json({ error: "Missing editToken" });
    }

    // Resolve the Stripe Price to use
    let resolvedPrice = null;

    if (priceId) {
      resolvedPrice = priceId; // explicit override
    } else if (priceKey) {
      const envVal = process.env[priceKey];
      if (!envVal) {
        return res
          .status(400)
          .json({ error: `Missing env var for priceKey "${priceKey}"` });
      }
      resolvedPrice = envVal;
    } else {
      // Fallback for legacy callers
      resolvedPrice = process.env.STRIPE_PRICE_STARTER_MONTHLY;
      if (!resolvedPrice) {
        return res.status(400).json({
          error:
            "No price provided. Set STRIPE_PRICE_STARTER_MONTHLY or pass priceId/priceKey.",
        });
      }
    }

    // Use canonical BASE_URL (avoid preview/alias surprises)
    const canonicalFallback = "https://linkinbio-mark-barattos-projects.vercel.app";
    const baseRaw = (process.env.BASE_URL || canonicalFallback).trim();
    const BASE = baseRaw.replace(/\/$/, "");

    const success_url = `${BASE}/pricing?editToken=${encodeURIComponent(
      editToken
    )}&status=success`;
    const cancel_url = `${BASE}/pricing?editToken=${encodeURIComponent(
      editToken
    )}&status=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: resolvedPrice, quantity: 1 }],
      allow_promotion_codes: true,

      // Carry profile token through
      client_reference_id: editToken,
      metadata: { editToken },
      subscription_data: { metadata: { editToken } },

      ...(email ? { customer_email: email } : {}),

      success_url,
      cancel_url,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("checkout create error", err);
    return res.status(500).json({ error: "Failed to create checkout session" });
  }
}
