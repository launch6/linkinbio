// pages/api/stripe-webhook.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
});

// Next needs raw body for Stripe signature verification.
export const config = {
  api: { bodyParser: false },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  // ---- DEBUG PROBE (GET) ----
  // Lets us confirm in production that the webhook secret is present.
  if (req.method === 'GET') {
    const s = process.env.STRIPE_WEBHOOK_SECRET || '';
    return res.status(200).json({
      env: process.env.VERCEL_ENV || 'unknown',
      hasSecret: Boolean(s),
      secretPrefix: s ? s.slice(0, 6) + '…' : '(missing)',
    });
  }

  // ---- STRIPE WEBHOOK (POST) ----
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end('Method Not Allowed');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // If this happens in prod, env var is not set in Vercel → Production.
    return res
      .status(400)
      .send('Webhook Error: STRIPE_WEBHOOK_SECRET is missing in the environment');
  }

  let event;
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).send('Webhook Error: Missing stripe-signature header');
    }

    const rawBody = await getRawBody(req);

    // Construct and verify the event.
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || 'invalid payload'}`);
  }

  try {
    // Minimal handler — expand as needed.
    console.log('✅ Stripe event:', event.type, event.id);

    switch (event.type) {
      case 'checkout.session.completed':
        // TODO: mark plan active, set planExpiresAt for promo, etc.
        break;

      case 'invoice.paid':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // TODO: keep subscription state in sync
        break;

      default:
        // No-op for unhandled events
        break;
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'handler failed' });
  }
}
