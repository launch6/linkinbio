// pages/api/klaviyo/lists.js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'Missing KLAVIYO_PRIVATE_API_KEY in environment',
    });
  }

  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Revision: '2023-10-15',
  };

  try {
    const url = 'https://a.klaviyo.com/api/lists?fields[list]=name';
    const upstream = await fetch(url, { headers });
    const json = await upstream.json();

    if (!upstream.ok) {
      console.error('Klaviyo lists error:', json);
      return res.status(400).json({
        error: 'Klaviyo error loading lists',
        detail: json,
      });
    }

    const lists = (json.data || []).map((item) => ({
      id: item.id,
      name: item.attributes?.name || 'Untitled list',
    }));

    return res.status(200).json({ ok: true, lists });
  } catch (err) {
    console.error('Klaviyo lists exception:', err);
    return res.status(500).json({ error: 'Failed to load Klaviyo lists.' });
  }
}
