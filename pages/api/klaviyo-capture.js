// pages/api/klaviyo-capture.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
  const bodyListId =
    typeof body.listId === "string" ? body.listId.trim() : "";

  // If listId is not provided in the body, fall back to env default
  const listId =
    bodyListId || (process.env.KLAVIYO_DEFAULT_LIST_ID || "").trim();

  if (!rawEmail || !listId) {
    return res
      .status(400)
      .json({ error: "Missing email or listId", code: "missing_params" });
  }

  // Very small server-side email sanity check
  const at = rawEmail.indexOf("@");
  const dot = rawEmail.lastIndexOf(".");
  if (at <= 0 || dot <= at + 1 || dot >= rawEmail.length - 1) {
    return res.status(400).json({ error: "Invalid email", code: "invalid_email" });
  }

  const apiKey = process.env.KLAVIYO_PRIVATE_API_KEY;
  if (!apiKey) {
    console.error("Missing KLAVIYO_PRIVATE_API_KEY env var");
    return res.status(500).json({ error: "Server not configured" });
  }

  const headers = {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Revision: "2023-10-15",
  };

  try {
    // 1) Look up a profile by email
    const filter = encodeURIComponent(`equals(email,"${rawEmail}")`);
    const lookupUrl = `https://a.klaviyo.com/api/profiles?filter=${filter}&fields[profile]=email`;

    const lookup = await fetch(lookupUrl, { headers });
    const lookupJson = await lookup.json().catch(() => ({}));

    let profileId =
      Array.isArray(lookupJson?.data) && lookupJson.data.length > 0
        ? lookupJson.data[0].id
        : null;

    // 2) If it doesn't exist, create it
    if (!profileId) {
      const createResp = await fetch("https://a.klaviyo.com/api/profiles", {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "profile",
            attributes: { email: rawEmail },
          },
        }),
      });

      const createJson = await createResp.json().catch(() => ({}));
      if (!createResp.ok) {
        console.error("Klaviyo create profile error:", createJson);
        return res
          .status(400)
          .json({ error: "Klaviyo create profile error", detail: createJson });
      }

      profileId = createJson?.data?.id;
      if (!profileId) {
        console.error("Klaviyo create profile missing id:", createJson);
        return res.status(400).json({
          error: "Klaviyo create profile error: missing id",
          detail: createJson,
        });
      }
    }

    // 3) Attach profile to list
    const attachUrl = `https://a.klaviyo.com/api/lists/${encodeURIComponent(
      listId
    )}/relationships/profiles`;

    const attachResp = await fetch(attachUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: [{ type: "profile", id: profileId }],
      }),
    });

    const attachText = await attachResp.text();
    if (!attachResp.ok) {
      console.error("Klaviyo list attach error:", attachText);
      return res
        .status(400)
        .json({ error: "Klaviyo error", detail: attachText });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Klaviyo subscribe error:", err);
    return res.status(500).json({ error: "Failed to subscribe" });
  }
}
