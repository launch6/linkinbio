// pages/api/drops/load-draft.js
import { getDb } from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { tempDropId, editToken } = req.query;

  if (!tempDropId && !editToken) {
    return res
      .status(400)
      .json({ ok: false, error: 'Missing tempDropId or editToken' });
  }

  try {
    const db = await getDb();
    const col = db.collection('dropDrafts');

    // Prefer tempDropId when present; otherwise fall back to editToken
    const query = tempDropId
      ? { tempDropId: String(tempDropId) }
      : { editToken: String(editToken) };

    const doc = await col.findOne(query, { sort: { updatedAt: -1 } });

    if (!doc) {
      return res
        .status(404)
        .json({ ok: false, error: 'Draft not found' });
    }

    const {
      tempDropId: id,
      dropTitle,
      dropDescription,
      quantity,
      btnText,
      isTimerEnabled,
      startsAt,
      endsAt,
      selectedProductId,
      imageUrl,
    } = doc;

    return res.status(200).json({
      ok: true,
      draft: {
        tempDropId: id,
        dropTitle: dropTitle || '',
        dropDescription: dropDescription || '',
        quantity: quantity || '',
        btnText: btnText || '',
        isTimerEnabled: !!isTimerEnabled,
        startsAt: startsAt || '',
        endsAt: endsAt || '',
        selectedProductId: selectedProductId || '',
        imageUrl: imageUrl || '',
      },
    });
  } catch (e) {
    console.error('[load-draft] unexpected error', e);
    return res
      .status(500)
      .json({ ok: false, error: 'Failed to load drop draft' });
  }
}
