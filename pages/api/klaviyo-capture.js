// pages/api/klaviyo-capture.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, listId } = req.body || {};
  if (!email || !listId) {
    return res.status(400).json({ error: 'Missing email or listId' });
  }

  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing KLAVIYO_PRIVATE_API_KEY' });
  }

  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Revision: '2023-10-15',
  };

  try {
    // 1) Look up a profile by email
    const filter = encodeURIComponent(`equals(email,"${email}")`);
    const lookupUrl = `https://a.klaviyo.com/api/profiles?filter=${filter}&fields[profile]=email`;
    let lookup = await fetch(lookupUrl, { headers });
    let lookupJson = await lookup.json();

    let profileId =
      Array.isArray(lookupJson?.data) && lookupJson.data.length > 0
        ? lookupJson.data[0].id
        : null;

    // 2) If it doesn't exist, create it
    if (!profileId) {
      const createResp = await fetch('https://a.klaviyo.com/api/profiles', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: {
            type: 'profile',
            attributes: { email },
          },
        }),
      });

      const createJson = await createResp.json();
      if (!createResp.ok) {
        return res
          .status(400)
          .json({ error: 'Klaviyo create profile error', detail: createJson });
      }
      profileId = createJson?.data?.id;
      if (!profileId) {
        return res
          .status(400)
          .json({ error: 'Klaviyo create profile error: missing id' });
      }
    }

    // 3) Attach profile to list
    const attachUrl = `https://a.klaviyo.com/api/lists/${encodeURIComponent(
      listId
    )}/relationships/profiles`;

    const attachResp = await fetch(attachUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        data: [{ type: 'profile', id: profileId }],
      }),
    });

    const attachText = await attachResp.text();
    if (!attachResp.ok) {
      return res
        .status(400)
        .json({ error: 'Klaviyo error', detail: attachText });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Klaviyo subscribe error:', err);
    return res.status(500).json({ error: 'Failed to subscribe' });
  }
}
