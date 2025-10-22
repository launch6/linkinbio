// pages/api/checkout/create.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).end();

    // Build a safe base URL that never points at localhost in prod
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host  = req.headers.host;
    const envBase = process.env.BASE_URL?.trim();
    const baseUrl = envBase || `${proto}://${host}`;

    const success_url = `${baseUrl}/pricing?status=success`;
    const cancel_url  = `${baseUrl}/pricing?status=cancelled`;

    // TODO: use your real price IDs / mode etc.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', // or 'payment'
      line_items: [{ price: process.env.STRIPE_PRICE_ID_STARTER_MONTHLY, quantity: 1 }],
      allow_promotion_codes: true,
      success_url,
      cancel_url,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout create error', err);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
