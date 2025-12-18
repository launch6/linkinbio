// pages/api/_env.js
// SECURITY: This endpoint is disabled.
// Reason: env disclosure is catastrophic in production and rarely worth the risk.

export default function handler(req, res) {
  // Always behave like it does not exist (prevents endpoint probing).
  return res.status(404).end("Not Found");
}
