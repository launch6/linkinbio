// pages/api/public.js
import { getDb } from "../../lib/mongodb";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const { slug } = req.query;

  if (!slug || typeof slug !== "string") {
    return res.status(400).json({ ok: false, error: "missing_slug" });
  }

  try {
    const db = await getDb();

    const profiles = db.collection("profiles");
    const linksCol = db.collection("links");
    const productsCol = db.collection("products");

    // 1) Find the profile by slug
    const profile = await profiles.findOne({ slug });

    if (!profile) {
      return res
        .status(404)
        .json({ ok: false, error: "profile_not_found" });
    }

    const profileId = String(profile._id);

    // 2) Fetch enabled links for this profile, sorted
    const links = await linksCol
      .find({ profileId, enabled: true })
      .sort({ sortOrder: 1 })
      .toArray();

    // 3) Fetch published products/drops for this profile
    const products = await productsCol
      .find({ profileId, published: true })
      .toArray();

    // 4) Shape the data for the public page
    const publicProfile = {
      slug: profile.slug,
      name: profile.name,
      description: profile.description || "",
      social: profile.social || {},
      collectEmail:
        !!profile.collectEmail &&
        !!profile.klaviyo?.isActive &&
        !!profile.klaviyo?.listId,
      klaviyo: profile.klaviyo || null,
      links: links.map((l) => ({
        id: String(l._id),
        label: l.label,
        url: l.url,
        sortOrder: l.sortOrder ?? 0,
      })),
    };

    const publicProducts = products.map((p) => ({
      id: String(p._id),
      title: p.title,
      description: p.description || "",
      imageUrl: p.imageUrl || null,
      priceUrl: p.priceUrl || null,
      dropEndsAt: p.dropEndsAt || null,
      unitsTotal: p.unitsTotal ?? null,
      unitsLeft: p.unitsLeft ?? null,
      showInventory: !!p.showInventory,
      showTimer: !!p.showTimer,
      published: !!p.published,
    }));

    return res.status(200).json({
      ok: true,
      profile: publicProfile,
      products: publicProducts,
    });
  } catch (err) {
    console.error("Error in /api/public:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
