// pages/api/stripe/connect-callback.js
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // same as your other Stripe code
});

export default async function handler(req, res) {
  const { code, state } = req.query || {};

  if (!code || !state) {
    console.error('[connect-callback] Missing code or state', { code, state });
    return res.status(400).send('Missing code or state from Stripe.');
  }

  try {
    // Exchange the authorization code for a connected account
    const response = await stripe.oauth.token({
      grant_type: 'authorization_code',
      code: String(code),
    });

    const connectedAccountId = response.stripe_user_id;

    if (!connectedAccountId) {
      console.error(
        '[connect-callback] No stripe_user_id in OAuth response',
        response
      );
      return res
        .status(500)
        .send('Stripe did not return a connected account.');
    }

    // Later: store { onboardingToken: state, stripeAccountId: connectedAccountId } in Mongo
    console.log('[connect-callback] Connected account linked', {
      onboardingToken: state,
      stripeAccountId: connectedAccountId,
    });

    // Build base URL from current host (works in preview + prod)
    const host = req.headers.host;
    const protocol = host && host.startsWith('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Send user back to Step 3 with stripe_connected=1 so the UI updates
    const redirectUrl = `${baseUrl}/dashboard/new-drop?token=${encodeURIComponent(
      String(state)
    )}&stripe_connected=1`;

    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error('[connect-callback] Error exchanging Stripe OAuth code', err);
    return res
      .status(500)
      .send('Stripe connection failed. Please close this window and try again.');
  }
}
