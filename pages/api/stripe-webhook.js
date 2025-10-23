// pages/api/stripe-webhook.js
export const config = {
  api: { bodyParser: false }, // must be false so we can read the raw stream
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const contentType = req.headers['content-type'];
  const rawBody = await getRawBody(req);

  // Log to Vercel function logs so we can see exactly what arrived
  console.log('--- STRIPE WEBHOOK DEBUG ---');
  console.log('hasSigHeader:', !!sig);
  console.log('sigHeaderRaw:', sig || null);
  console.log('contentType:', contentType || null);
  console.log('rawBodyLen:', rawBody.length);
  console.log('env.hasSecret:', !!process.env.STRIPE_WEBHOOK_SECRET);
  console.log('env.hasKey:', !!process.env.STRIPE_SECRET_KEY);
  console.log('requestHeaders:', req.headers);
  console.log('--- /STRIPE WEBHOOK DEBUG ---');

  // Echo back a compact summary to the browser/Stripe Workbench
  return res.status(200).json({
    ok: true,
    received: {
      hasSigHeader: Boolean(sig),
      contentType: contentType || null,
      rawBodyLen: rawBody.length,
      env: {
        STRIPE_WEBHOOK_SECRET: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
      },
    },
  });
}
