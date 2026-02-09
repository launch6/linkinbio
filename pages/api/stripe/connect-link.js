// pages/api/stripe/connect-link.js

export default async function handler(req, res) {
  // Read envs once at the top
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;

  // Always derive redirect_uri from the current request host so Preview uses Preview.
  // On Vercel, x-forwarded-host / x-forwarded-proto are the correct values.
  const forwardedHost = (req.headers['x-forwarded-host'] || '').toString().split(',')[0].trim();
  const host = (forwardedHost || req.headers.host || '').toString().split(',')[0].trim();

  const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
  const protocol = forwardedProto || (host.startsWith('localhost') ? 'http' : 'https');

const redirectUrl = `https://www.l6.io/api/stripe/connect-callback`;

  // 🔍 DEBUG MODE:
  // Hitting this route with GET in the browser will show what the server
  // actually sees for these env vars. Example:
  // https://<your-domain>/api/stripe/connect-link
  if (req.method === 'GET') {
    return res.status(200).json({
      debug: true,
      hasClientId: !!clientId,
      hasRedirectUrl: !!redirectUrl,
      clientId,
      redirectUrl,
    });
  }

  // Normal behavior for the app: POST only
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { token } = req.body || {};

    if (!clientId || !redirectUrl) {
      console.error('[connect-link] Missing Stripe Connect env vars', {
        hasClientId: !!clientId,
        hasRedirectUrl: !!redirectUrl,
      });

      return res.status(500).json({
        error: 'Stripe is not configured yet. Contact support.',
        hasClientId: !!clientId,
        hasRedirectUrl: !!redirectUrl,
      });
    }

    if (!token) {
      return res.status(400).json({ error: 'Missing onboarding token.' });
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
    return res.status(500).json({
      error: 'Unable to start Stripe connection. Try again later.',
    });
  }
}
