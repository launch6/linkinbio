// pages/api/check-env.js

export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    method: req.method,
    now: new Date().toISOString(),
    env: {
      BASE_URL: !!process.env.BASE_URL,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
      STRIPE_CONNECT_CLIENT_ID: !!process.env.STRIPE_CONNECT_CLIENT_ID,
      STRIPE_CONNECT_REDIRECT_URL: !!process.env.STRIPE_CONNECT_REDIRECT_URL,
    },
  });
}
