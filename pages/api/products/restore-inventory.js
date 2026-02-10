// pages/api/products/restore-inventory.js
import { getDb } from "../../../lib/mongo";

function safeTrim(v) {
  return typeof v === "string" ? v.trim() : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(404).end("Not Found");

  try {
    const { token, productId, unitsLeft } = req.body || {};
    const editToken = safeTrim(token);
    const pid = safeTrim(productId);
    const n = Number(unitsLeft);

    if (!editToken || !pid || !Number.isInteger(n) || n < 0) {
      return res.status(400).json({ ok: false, error: "Bad input" });
    }

    const db = await getDb();
    const Profiles = db.collection("profiles");

    // Find the profile by editToken and update the matching product only
    const r = await Profiles.updateOne(
      { editToken, "products.id": pid },
      {
        $set: {
          "products.$.unitsLeft": n,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      ok: true,
      matched: r.matchedCount || 0,
      modified: r.modifiedCount || 0,
      productId: pid,
      unitsLeft: n,
    });
  } catch (e) {
    console.error("restore-inventory error", e?.message || e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}
