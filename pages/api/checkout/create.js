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
    // Accept JSON or raw stringified body
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

    const { priceId, editToken, email } = body;

    // Require editToken so we can map the checkout -> profile in the webhook
    if (!editToken) {
      return res.status(400).json({ error: "Missing editToken" });
    }

    // Fallback to Starter Monthly env var if priceId is not provided
    const price = priceId || process.env.STRIPE_PRICE_STARTER_MONTHLY;
    if (!price) {
      return res
        .status(400)
        .json({ error: "Missing priceId and STRIPE_PRICE_STARTER_MONTHLY" });
    }

    // ---- FORCE CANONICAL BASE (no preview aliases) ----
    // Prefer BASE_URL; otherwise fall back to the known canonical domain.
    const canonicalFallback = "https://linkinbio-mark-barattos-projects.vercel.app";
    const baseRaw = (process.env.BASE_URL || canonicalFallback).trim();
    const BASE = baseRaw.replace(/\/$/, ""); // strip trailing slash

    const success_url = `${BASE}/pricing?editToken=${encodeURIComponent(
      editToken
    )}&status=success`;
    const cancel_url = `${BASE}/pricing?editToken=${encodeURIComponent(
      editToken
    )}&status=cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,

      // Carry the profile token everywhere
      client_reference_id: editToken,
      metadata: { editToken },
      subscription_data: { metadata: { editToken } },

      // Optional: prefill email
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
