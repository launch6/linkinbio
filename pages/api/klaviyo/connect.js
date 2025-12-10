// pages/api/klaviyo/connect.js

export default async function handler(req, res) {
  // We only allow POST from the onboarding UI
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  const defaultListId = process.env.KLAVIYO_DEFAULT_LIST_ID;

  if (!apiKey || !defaultListId) {
    return res.status(500).json({
      error:
        'Klaviyo is not configured. Set KLAVIYO_PRIVATE_API_KEY and KLAVIYO_DEFAULT_LIST_ID.',
    });
  }

  // Later we can call Klaviyo to verify the key and lists.
  // For now, if env vars exist, we treat it as "connected".
  return res.status(200).json({ ok: true });
}
