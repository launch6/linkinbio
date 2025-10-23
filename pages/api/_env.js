// pages/api/_env.js
export const config = { api: { bodyParser: false } };

export default function handler(req, res) {
  const mask = (v, lead = 10, tail = 6) =>
    v ? `${v.slice(0, lead)}…${v.slice(-tail)}` : null;

  const whsec = process.env.STRIPE_WEBHOOK_SECRET || "";
  const sk = process.env.STRIPE_SECRET_KEY || "";
  const base = process.env.BASE_URL || "";

  res.status(200).json({
    ok: true,
    env: {
      STRIPE_WEBHOOK_SECRET: mask(whsec), // e.g. whsec_IA1v8n…BaWi
      STRIPE_SECRET_KEY: mask(sk, 7, 4),  // e.g. sk_test_…pQ9r
      BASE_URL: base || null,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    },
  });
}
