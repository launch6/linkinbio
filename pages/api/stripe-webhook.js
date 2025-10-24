// pages/api/stripe-webhook.js
import Stripe from "stripe";
import { getDb } from "../../lib/mongo";

export const config = {
  api: { bodyParser: false }, // raw body required for Stripe signature verification
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

// helper: read raw body
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// helper: map a Stripe price.id -> internal plan name
function priceIdToPlan(priceId) {
  if (!priceId) return null;

  // Map your known prices from env vars
  const MAP = [
    { id: process.env.STRIPE_PRICE_STARTER_MONTHLY, plan: "starter" },
    { id: process.env.STRIPE_PRICE_STARTER_LIFETIME, plan: "starter_lifetime" },
    { id: process.env.STRIPE_PRICE_PRO_MONTHLY, plan: "pro" },
    { id: process.env.STRIPE_PRICE_BUSINESS_MONTHLY, plan: "business" },
  ];

  for (const m of MAP) {
    if (m.id && m.id === priceId) return m.plan;
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  // 1) Verify signature
  let event;
  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["stripe-signature"];
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("⚠️  Signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    const db = await getDb();
    const subs = db.collection("subscriptions");
    const profiles = db.collection("profiles");

    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;

        // Store basic subscription event
        if (s.mode === "subscription") {
          await subs.updateOne(
            { subscriptionId: s.subscription || null },
            {
              $set: {
                subscriptionId: s.subscription || null,
                customerId: s.customer || null,
                email: s.customer_details?.email ?? s.customer_email ?? null,
                status: "active",
                paymentStatus: s.payment_status,
                cancelAtPeriodEnd: false,
                updatedAt: new Date(),
                createdAt: new Date(),
                source: "checkout.session.completed",
              },
            },
            { upsert: true }
          );
        }

        // Expand line_items to find the exact price that was purchased
        let priceId = null;
        try {
          const sessionFull = await stripe.checkout.sessions.retrieve(s.id, {
            expand: ["line_items.data.price"],
          });
          const li = sessionFull?.line_items?.data?.[0];
          priceId = li?.price?.id ?? null;
        } catch (e) {
          console.error("Failed to expand line_items:", e?.message || e);
        }

        const plan = priceIdToPlan(priceId) || "starter"; // default to starter if unknown
        const editToken = s.client_reference_id || null;

        // If we have a profile reference, update the profile's plan immediately
        if (editToken) {
          const profileUpdate = {
            plan,
            // If you later support trials/lifetime via metadata, set planExpiresAt here
            updatedAt: new Date(),
            // Store a small snapshot of Stripe linkage if helpful:
            stripe: {
              customerId: s.customer || null,
              subscriptionId: s.subscription || null,
              priceId: priceId || null,
              lastEvent: "checkout.session.completed",
            },
          };

          const r = await profiles.updateOne(
            { editToken: String(editToken) },
            { $set: profileUpdate },
            { upsert: false } // do not create profiles here; only update existing
          );

          if (r.matchedCount === 0) {
            console.warn("No profile matched editToken from client_reference_id:", editToken);
          }
        } else {
          console.warn("No client_reference_id on checkout.session.completed; cannot map to profile.");
        }

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const item = sub.items?.data?.[0];

        await subs.updateOne(
          { subscriptionId: sub.id },
          {
            $set: {
              subscriptionId: sub.id,
              customerId: sub.customer || null,
              status: sub.status, // active, past_due, canceled, etc.
              priceId: item?.price?.id ?? null,
              productId: item?.price?.product ?? null,
              currentPeriodStart: sub.current_period_start
                ? new Date(sub.current_period_start * 1000)
                : null,
              currentPeriodEnd: sub.current_period_end
                ? new Date(sub.current_period_end * 1000)
                : null,
              cancelAtPeriodEnd: !!sub.cancel_at_period_end,
              updatedAt: new Date(),
              source: "customer.subscription.updated",
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        );

        // Optional: keep profile.plan in sync from subscription updated
        try {
          const plan = priceIdToPlan(item?.price?.id);
          if (plan) {
            await profiles.updateMany(
              { "stripe.subscriptionId": sub.id },
              {
                $set: {
                  plan,
                  updatedAt: new Date(),
                },
              }
            );
          }
        } catch (e) {
          console.error("profile sync on subscription.updated failed:", e?.message || e);
        }

        break;
      }

      case "invoice.paid": {
        const inv = event.data.object;
        await subs.updateOne(
          { subscriptionId: inv.subscription || null },
          {
            $set: {
              lastInvoiceId: inv.id,
              lastInvoicePaidAt: inv.status_transitions?.paid_at
                ? new Date(inv.status_transitions.paid_at * 1000)
                : new Date(),
              updatedAt: new Date(),
              source: "invoice.paid",
            },
          },
          { upsert: true }
        );
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;

        await subs.updateOne(
          { subscriptionId: sub.id },
          {
            $set: {
              status: "canceled",
              canceledAt: sub.canceled_at
                ? new Date(sub.canceled_at * 1000)
                : new Date(),
              updatedAt: new Date(),
              source: "customer.subscription.deleted",
            },
          }
        );

        // Downgrade linked profile(s)
        try {
          await profiles.updateMany(
            { "stripe.subscriptionId": sub.id },
            {
              $set: {
                plan: "free",
                updatedAt: new Date(),
              },
            }
          );
        } catch (e) {
          console.error("profile downgrade on subscription.deleted failed:", e?.message || e);
        }

        break;
      }

      default:
        // Acknowledge quickly for unhandled event types
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "handler failed" });
  }
}
