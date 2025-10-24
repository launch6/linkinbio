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
    // Expecting JSON body like: { priceId, editToken, email }
    const { priceId, editToken, email } = (req.body && typeof req.body === "object")
      ? req.body
      : (() => { try { return JSON.parse(req.body || "{}"); } catch { return {}; } })();

    // Fallback to your Starter Monthly env if priceId not provided
    const price = priceId || process.env.STRIPE_PRICE_STARTER_MONTHLY;
    if (!price) {
      return res.status(400).json({ error: "Missing priceId and STRIPE_PRICE_STARTER_MONTHLY" });
    }

    // Build a base URL that never points at localhost in prod
    const envBase = (process.env.BASE_URL || "").trim();
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const baseUrl = envBase || `${proto}://${host}`;

    const success_url = `${baseUrl}/pricing?status=success`;
    const cancel_url = `${baseUrl}/pricing?status=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      // Always create/attach a Customer so we get stable IDs back on webhooks
      customer_creation: "always",
      // Attach your profile reference so the webhook can update the right user later
      client_reference_id: editToken || null, // pass your profile/edit token from the dashboard
      // Optional: prefill email if you have it
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
