// pages/api/stripe/connect-link.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body || {};

    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
    if (!clientId) {
      console.error('Missing STRIPE_CONNECT_CLIENT_ID env variable');
      return res
        .status(500)
        .json({ error: 'Stripe is not configured yet. Contact support.' });
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'read_write',
    });

    // Use the onboarding token as "state" so we can match the user later
    if (token) {
      params.append('state', String(token));
    }

    const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

    return res.status(200).json({ url });
  } catch (err) {
    console.error('Stripe connect-link error:', err);
    return res
      .status(500)
      .json({ error: 'Unable to start Stripe connection. Try again later.' });
  }
}
