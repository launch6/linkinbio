// pages/api/stripe-webhook.js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export const config = {
  api: { bodyParser: false }, // we need the raw body for signature verification
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let event;
  try {
    const sig = req.headers['stripe-signature'];
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // For now, just log what arrives. We'll wire DB updates in the next step.
    console.log('✅ Stripe event received:', event.type, event.id);

    switch (event.type) {
      case 'checkout.session.completed':
        // TODO: mark plan active, set planExpiresAt if Starter+ promo, etc.
        break;
      case 'invoice.paid':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // TODO: keep subscription state in sync
        break;
      default:
        break;
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'handler failed' });
  }
}
