// pages/api/stripe/connect-callback.js
import Stripe from "stripe";
import { MongoClient } from "mongodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "linkinbio";

let cachedClient = null;
async function getClient() {
  if (cachedClient) return cachedClient;
  if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");
  const c = new MongoClient(MONGODB_URI);
  await c.connect();
  cachedClient = c;
  return c;
}

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

        // Persist to the profile tied to this onboarding token (editToken)
    const db = (await getClient()).db(MONGODB_DB);

    const r = await db.collection("profiles").updateOne(
      { editToken: String(state) },
      {
        $set: {
          updatedAt: new Date(),
          "stripe.accountId": connectedAccountId,
          "stripe.connectedAt": new Date(),
          "stripe.lastEvent": "connect.oauth.completed",
        },
      }
    );

    console.log("[connect-callback] Connected account linked", {
      onboardingToken: String(state),
      stripeAccountId: connectedAccountId,
      matched: r.matchedCount,
      modified: r.modifiedCount,
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
