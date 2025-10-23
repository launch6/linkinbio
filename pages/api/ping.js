export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: '/api/ping',
    method: req.method,
    now: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'no-commit-env',
  });
}
