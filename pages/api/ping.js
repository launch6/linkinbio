// pages/api/ping.js
export default function handler(req, res) {
  // Minimal health check. Do not disclose env, config, or internals.
  return res.status(200).json({ ok: true, ts: Date.now() });
}
