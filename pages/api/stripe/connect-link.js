// pages/api/stripe/connect-link.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { token } = req.body || {};

    // Support both names, but prefer STRIPE_CLIENT_ID (what you documented)
    const clientId =
      process.env.STRIPE_CLIENT_ID || process.env.STRIPE_CONNECT_CLIENT_ID;

    const redirectUrl = process.env.STRIPE_CONNECT_REDIRECT_URL;

    if (!clientId || !redirectUrl) {
      console.error('[connect-link] Missing Stripe Connect env vars', {
        hasClientId: !!clientId,
        hasRedirectUrl: !!redirectUrl,
      });

      return res
        .status(500)
        .json({ error: 'Stripe is not configured yet. Contact support.' });
    }

    if (!token) {
      return res
        .status(400)
        .json({ error: 'Missing onboarding token.' });
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'read_write',
      redirect_uri: redirectUrl,
      state: String(token),
    });

    const url = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

    return res.status(200).json({ url });
  } catch (err) {
    console.error('Stripe connect-link error:', err);
    return res
      .status(500)
      .json({
        error: 'Unable to start Stripe connection. Try again later.',
      });
  }
}
