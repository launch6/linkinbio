// pages/api/ping.js
export const config = {
  api: { bodyParser: false }, // keep consistent with other API routes
};

export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    method: req.method,
    now: new Date().toISOString(),
    // show presence of critical envs without leaking values
    env: {
      BASE_URL: !!process.env.BASE_URL,
      STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
  });
}
