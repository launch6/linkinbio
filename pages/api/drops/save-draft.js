// pages/api/drops/save-draft.js
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import fs from 'fs';
import { getDb } from '../../../lib/db';

export const config = {
  api: {
    bodyParser: false, // we handle multipart/form-data manually
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const form = formidable({
    multiples: false,
    maxFileSize: 1 * 1024 * 1024, // 1MB, same as frontend
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[save-draft] formidable error', err);
      return res.status(400).json({ ok: false, error: 'Invalid form data' });
    }

    try {
      const editToken = fields.editToken ? String(fields.editToken) : '';
      let tempDropId = fields.tempDropId ? String(fields.tempDropId) : '';

      if (!editToken && !tempDropId) {
        return res
          .status(400)
          .json({ ok: false, error: 'Missing editToken or tempDropId' });
      }

      const dropTitle = fields.dropTitle ? String(fields.dropTitle) : '';
      const dropDescription = fields.dropDescription
        ? String(fields.dropDescription)
        : '';
      const quantity = fields.quantity ? String(fields.quantity) : '';
      const btnText = fields.btnText ? String(fields.btnText) : '';
      const isTimerEnabled = String(fields.isTimerEnabled) === 'true';
      const startsAt = fields.startsAt ? String(fields.startsAt) : '';
      const endsAt = fields.endsAt ? String(fields.endsAt) : '';
      const selectedProductId = fields.selectedProductId
        ? String(fields.selectedProductId)
        : '';

      const existingImageUrl = fields.existingImageUrl
        ? String(fields.existingImageUrl)
        : '';
      const imagePreview = fields.imagePreview
        ? String(fields.imagePreview)
        : '';

      let imageUrl = existingImageUrl || imagePreview || '';

      // Handle uploaded image file -> turn into data: URL for the draft
      let uploadedFile = files.imageFile;
      if (Array.isArray(uploadedFile)) {
        uploadedFile = uploadedFile[0];
      }

      if (uploadedFile && uploadedFile.filepath) {
        try {
          const fileData = await fs.promises.readFile(uploadedFile.filepath);
          const base64 = fileData.toString('base64');
          const mime = uploadedFile.mimetype || 'image/jpeg';
          imageUrl = `data:${mime};base64,${base64}`;
        } catch (fileErr) {
          console.error('[save-draft] failed to read uploaded file', fileErr);
          // fall back to existing imageUrl if read fails
        }
      }

      const db = await getDb();
      const col = db.collection('dropDrafts');
      const now = new Date();

      if (!tempDropId) {
        tempDropId = uuidv4();
      }

      const update = {
        editToken: editToken || null,
        tempDropId,
        dropTitle,
        dropDescription,
        quantity,
        btnText,
        isTimerEnabled,
        startsAt,
        endsAt,
        selectedProductId,
        imageUrl,
        updatedAt: now,
      };

      await col.updateOne(
        { tempDropId },
        {
          $set: update,
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );

      return res.status(200).json({
        ok: true,
        tempDropId,
        imageUrl,
      });
    } catch (e) {
      console.error('[save-draft] unexpected error', e);
      return res
        .status(500)
        .json({ ok: false, error: 'Failed to save drop draft' });
    }
  });
}
