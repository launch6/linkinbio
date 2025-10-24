// pages/api/stripe-webhook.js
import Stripe from "stripe";
import { getDb } from "../../lib/mongo"; // NOTE: path is ../../lib/mongo from /pages/api/*
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

export const config = {
  api: { bodyParser: false }, // raw body required for signature verification
};

// collect the raw request body (Node/Edge-compatible)
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

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
    const col = db.collection("subscriptions");

    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        // Only care about subscription checkouts
        if (s.mode === "subscription") {
          await col.updateOne(
            { subscriptionId: s.subscription || null },
            {
              $set: {
                subscriptionId: s.subscription || null,
                customerId: s.customer || null,
                email:
                  s.customer_details?.email ??
                  s.customer_email ??
                  null,
                status: "active", // session completed
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
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const item = sub.items?.data?.[0];

        await col.updateOne(
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
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object;
        await col.updateOne(
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
        await col.updateOne(
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
        break;
      }

      default:
        // Not critical to store—acknowledge quickly
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "handler failed" });
  }
}
