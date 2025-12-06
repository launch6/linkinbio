// pages/api/stripe/connect-link.js
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const connectClientId = process.env.STRIPE_CONNECT_CLIENT_ID;
const oauthRedirectUrl = process.env.STRIPE_OAUTH_REDIRECT_URL;

// Simple safety checks so we don't leak secrets or crash on misconfig
if (!stripeSecretKey) {
  console.warn(
    '[Stripe] STRIPE_SECRET_KEY is not set. /api/stripe/connect-link will respond with 500.'
  );
}

const stripe =
  stripeSecretKey &&
  new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
  });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!stripeSecretKey || !connectClientId || !oauthRedirectUrl) {
      return res.status(500).json({
        error:
          'Stripe Connect is not fully configured on the server. Ask support to set STRIPE_SECRET_KEY, STRIPE_CONNECT_CLIENT_ID, and STRIPE_OAUTH_REDIRECT_URL.',
      });
    }

    const { token } = req.body || {};

    // Build the OAuth URL per Stripe Connect docs
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: connectClientId,
      scope: 'read_write',
      redirect_uri: oauthRedirectUrl,
    });

    // Use the onboarding token as "state" so you can match the artist profile later
    if (token) {
      params.append('state', String(token));
    }

    const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

    return res.status(200).json({ url });
  } catch (err) {
    console.error('Stripe connect-link error:', err);
    return res
      .status(500)
      .json({ error: 'Unable to start Stripe connection.' });
  }
}
