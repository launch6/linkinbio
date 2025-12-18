// pages/api/_debug-stripe.js
export default function handler(req, res) {
  // SECURITY: this endpoint must not exist in production
  if (process.env.NODE_ENV === "production") {
    return res.status(404).end("Not Found");
  }

  // In non-prod, still do not disclose anything about secrets.
  return res.status(401).end("Disabled");
}
