// pages/api/billing/activate-free.js
import { getDb } from "@/lib/mongo";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }
  try {
    const { editToken } =
      typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");

    if (!editToken) return res.status(400).json({ error: "Missing editToken" });

    const db = await getDb();
    const profiles = db.collection("profiles");

    const result = await profiles.findOneAndUpdate(
      { editToken },
      {
        $set: {
          plan: "free",
          planExpiresAt: null,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!result.value) return res.status(404).json({ error: "Profile not found" });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("activate-free error", e);
    return res.status(500).json({ error: "Failed to activate free plan" });
  }
}
