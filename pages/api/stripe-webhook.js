// pages/api/stripe-webhook.js
import Stripe from 'stripe';

export const config = {
  api: { bodyParser: false }, // we need raw body for Stripe signature verification
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
});

// tiny helper to read raw body (needed for signature verification)
async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  // ---- GET/HEAD: simple probe so we can confirm this file is deployed
  if (req.method === 'GET' || req.method === 'HEAD') {
    const hasSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
    const secretPrefix = hasSecret ? String(process.env.STRIPE_WEBHOOK_SECRET).slice(0, 7) : null;
    return res.status(200).json({
      ok: true,
      route: '/api/stripe-webhook',
      method: req.method,
      hasSecret,
      secretPrefix,
      node: process.version,
      now: new Date().toISOString(),
    });
  }

  // ---- POST: Stripe webhook handling
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, GET, HEAD');
    return res.status(405).end('Method Not Allowed');
  }

  // Verify Stripe signature
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    const rawBody = await getRawBody(req);
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // <-- must be set on Vercel
    if (!endpointSecret) {
      return res.status(500).send('Missing STRIPE_WEBHOOK_SECRET');
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️  Webhook signature verification failed:', err?.message || err);
    return res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
  }

  try {
    // For now just log; you’ll wire real updates later.
    console.log('✅ Stripe event:', event.type, event.id);

    switch (event.type) {
      case 'checkout.session.completed':
        // TODO: mark plan active
        break;
      case 'invoice.paid':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // TODO: sync subscription state
        break;
      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'handler failed' });
  }
}
