export default function handler(req, res) {
  const s = process.env.STRIPE_WEBHOOK_SECRET || '';
  res.status(200).json({
    env: process.env.VERCEL_ENV || 'unknown',
    hasSecret: Boolean(s),
    secretPrefix: s ? s.slice(0, 6) + '…' : '(missing)'
  });
}
