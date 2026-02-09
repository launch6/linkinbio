// pages/api/billing/create-portal-session.js
import Stripe from "stripe";
import { getDb } from "@/lib/db";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  try {
    // Expecting JSON body like: { editToken }
    const { editToken } =
      (req.body && typeof req.body === "object")
        ? req.body
        : (() => { try { return JSON.parse(req.body || "{}"); } catch { return {}; } })();

    if (!editToken) {
      return res.status(400).json({ error: "Missing editToken" });
    }

    const db = await getDb();
    const profiles = db.collection("profiles");
    const profile = await profiles.findOne({ editToken });

    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const customerId = profile?.stripe?.customerId;
    if (!customerId) {
      return res.status(400).json({ error: "No Stripe customer found for this profile" });
    }

    const returnUrl = `${process.env.BASE_URL}/dashboard/${encodeURIComponent(editToken)}`;

    // Optional: restrict what the user can do in the portal (safe defaults)
    const configuration = undefined; // use your default portal config from Stripe Dashboard if set

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
      configuration,
      // You could also pass `flow_data` or `on_behalf_of` here in the future if needed.
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("create-portal-session error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
