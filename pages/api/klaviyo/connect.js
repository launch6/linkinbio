// pages/api/klaviyo/connect.js

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  const listId = process.env.KLAVIYO_DEFAULT_LIST_ID;

  if (!apiKey || !listId) {
    return res.status(500).json({
      ok: false,
      error: 'Klaviyo is not configured. Set KLAVIYO_PRIVATE_API_KEY and KLAVIYO_DEFAULT_LIST_ID.',
    });
  }

  try {
    const resp = await fetch(`https://a.klaviyo.com/api/lists/${listId}`, {
      method: 'GET',
      headers: {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        Accept: 'application/json',
        Revision: '2024-07-15',
      },
    });

    const text = await resp.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON error; leave json as null
    }

    if (!resp.ok) {
      console.error('Klaviyo connect error:', resp.status, text);
      return res.status(500).json({
        ok: false,
        error: 'Unable to reach Klaviyo. Double-check your API key and list ID.',
      });
    }

    const listName = json?.data?.attributes?.name ?? null;

    return res.status(200).json({
      ok: true,
      listId,
      listName,
    });
  } catch (err) {
    console.error('Klaviyo connect unexpected error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Unexpected error talking to Klaviyo.',
    });
  }
}
