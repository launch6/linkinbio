// pages/editor.js
import { useEffect, useMemo, useState } from "react";

// Helpers for datetime-local ↔ ISO
function isoToLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:mm"
}
function localToIso(local) {
  if (!local) return "";
  const d = new Date(local); // treat as local, browser makes an ISO
  return d.toISOString();
}

const MAX_PRODUCTS_BY_PLAN = {
  free: 1,
  starter: 5,
  pro: 15,
  business: 30,
  "starter+": 5,
};
function normalizePlan(p) {
  const plan = String(p || "free").toLowerCase();
  if (plan === "starterplus" || plan === "starter+") return "starter+";
  return plan;
}

export default function EditorPage() {
  const [editToken, setEditToken] = useState("");

  // load state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState(null);

  // products editor state
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  // email capture panel state
  const [collectEmail, setCollectEmail] = useState(false);
  const [klaviyoListId, setKlaviyoListId] = useState("");
  const [saveProfMsg, setSaveProfMsg] = useState("");
  const [saveProfError, setSaveProfError] = useState("");
  const [savingProf, setSavingProf] = useState(false);

  // links editor state
  const [links, setLinks] = useState([]);
  const [savingLinks, setSavingLinks] = useState(false);
  const [saveLinksMsg, setSaveLinksMsg] = useState("");
  const [saveLinksError, setSaveLinksError] = useState("");

  // Read editToken from URL (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const t =
      u.searchParams.get("editToken") ||
      window.localStorage.getItem("editToken") ||
      "";
    setEditToken(t);
    if (t) window.localStorage.setItem("editToken", t);
  }, []);

  // Load profile + products
  useEffect(() => {
    if (!editToken) {
      setLoading(false);
      setLoadError("Missing editToken in URL");
      return;
    }
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // Profile
        const pr = await fetch(
          `/api/profile/get?editToken=${encodeURIComponent(
            editToken
          )}`,
          { cache: "no-store" }
        );
        const pj = await pr.json();
        if (!pj?.ok)
          throw new Error(pj?.error || "Failed to load profile");

        // Products
        const r = await fetch(
          `/api/products?editToken=${encodeURIComponent(
            editToken
          )}`,
          { cache: "no-store" }
        );
        const j = await r.json();
        if (!j?.ok)
          throw new Error(j?.error || "Failed to load products");

        if (!alive) return;

        setProfile(pj.profile);

        // initialize email capture fields from profile
        setCollectEmail(!!pj.profile?.collectEmail);
        setKlaviyoListId(String(pj.profile?.klaviyoListId || ""));

        // links
        setLinks(
          Array.isArray(pj.profile?.links)
            ? pj.profile.links.map((l) => ({
                id:
                  (l && l.id) ||
                  `l_${Math.random().toString(36).slice(2, 9)}`,
                label: String(l?.label || "").slice(0, 200),
                url: String(l?.url || "").slice(0, 2000),
              }))
            : []
        );

        // products
        setProducts(
          (Array.isArray(j.products) ? j.products : []).map((p) => ({
            ...p,
            dropEndsAt: p.dropEndsAt ? isoToLocal(p.dropEndsAt) : "",
            unitsTotal:
              p.unitsTotal === null || p.unitsTotal === undefined
                ? ""
                : p.unitsTotal,
            unitsLeft:
              p.unitsLeft === null || p.unitsLeft === undefined
                ? ""
                : p.unitsLeft,
            showTimer: !!p.showTimer,
            showInventory:
              "showInventory" in p ? !!p.showInventory : true,
          }))
        );
        setLoadError("");
      } catch (e) {
        if (!alive) return;
        setLoadError(e.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editToken]);

  const planLabel = useMemo(
    () => normalizePlan(profile?.plan || "free"),
    [profile]
  );
  const maxAllowed =
    MAX_PRODUCTS_BY_PLAN[planLabel] ?? MAX_PRODUCTS_BY_PLAN.free;
  const isFree = planLabel === "free";

  function onProdChange(idx, key, val) {
    setProducts((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  }

  function addProduct() {
    // Client-side gate: block if adding would exceed plan limit
    const currentCount = products.length;
    if (currentCount >= maxAllowed) {
      setSaveError(
        `Your plan (${planLabel}) allows up to ${maxAllowed} product${
          maxAllowed === 1 ? "" : "s"
        }.`
      );
      setSaveMsg("");
      return;
    }
    const id = `p_${Math.random().toString(36).slice(2, 9)}`;
    setProducts((prev) => [
      ...prev,
      {
        id,
        title: "Untitled",
        priceUrl: "",
        imageUrl: "",
        dropEndsAt: "",
        unitsTotal: "",
        unitsLeft: "",
        showTimer: false,
        showInventory: true,
        published: false,
      },
    ]);
    // Clear any prior error if we successfully add
    setSaveError("");
  }

  function removeProduct(idx) {
    setProducts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveProducts() {
    try {
      setSaving(true);
      setSaveMsg("");
      setSaveError("");

      // Second line of defense: prevent save if already over client limit
      if (products.length > maxAllowed) {
        setSaveError(
          `Your plan (${planLabel}) allows up to ${maxAllowed} product${
            maxAllowed === 1 ? "" : "s"
          }.`
        );
        return;
      }

      // sanitize/shape according to API schema
      const shaped = products.map((p) => ({
        id: p.id,
        title: String(p.title || "").slice(0, 200),
        priceUrl: String(p.priceUrl || "").slice(0, 2000),
        imageUrl: String(p.imageUrl || "").slice(0, 2000),
        dropEndsAt: p.dropEndsAt ? localToIso(p.dropEndsAt) : "",
        unitsTotal:
          p.unitsTotal === "" || p.unitsTotal === null
            ? ""
            : Math.max(0, parseInt(p.unitsTotal, 10) || 0),
        unitsLeft:
          p.unitsLeft === "" || p.unitsLeft === null
            ? ""
            : Math.max(0, parseInt(p.unitsLeft, 10) || 0),
        published: !!p.published,
        showTimer: !!p.showTimer,
        showInventory: !!p.showInventory,
      }));

      const resp = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editToken, products: shaped }),
      });

      const json = await resp.json().catch(() => ({}));

      if (!resp.ok || !json?.ok) {
        const message =
          (json && (json.message || json.error)) ||
          `Save failed (${resp.status})`;
        setSaveError(message);
        return;
      }

      setSaveMsg("Saved!");
      setSaveError("");

      // Refresh from server (to reflect any server-side normalization)
      const r2 = await fetch(
        `/api/products?editToken=${encodeURIComponent(
          editToken
        )}`,
        { cache: "no-store" }
      );
      const j2 = await r2.json();
      if (j2?.ok && Array.isArray(j2.products)) {
        setProducts(
          j2.products.map((p) => ({
            ...p,
            dropEndsAt: p.dropEndsAt ? isoToLocal(p.dropEndsAt) : "",
            unitsTotal:
              p.unitsTotal === null || p.unitsTotal === undefined
                ? ""
                : p.unitsTotal,
            unitsLeft:
              p.unitsLeft === null || p.unitsLeft === undefined
                ? ""
                : p.unitsLeft,
            showTimer: !!p.showTimer,
            showInventory:
              "showInventory" in p ? !!p.showInventory : true,
          }))
        );
      }
    } catch (e) {
      setSaveError(e.message || "Failed to save products");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 2000);
    }
  }

  async function saveProfileSettings() {
    try {
      setSavingProf(true);
      setSaveProfMsg("");
      setSaveProfError("");

      const resp = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editToken,
          collectEmail,
          klaviyoListId,
        }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        const msg =
          (json && (json.error || json.message)) ||
          `Save failed (${resp.status})`;
        setSaveProfError(msg);
        return;
      }

      // Reflect any server-side gating (e.g., Free forcing collectEmail=false)
      setCollectEmail(!!json.collectEmail);
      setKlaviyoListId(String(json.klaviyoListId || ""));

      setSaveProfMsg("Settings saved!");
      setSaveProfError("");
    } catch (e) {
      setSaveProfError(e.message || "Failed to save settings");
    } finally {
      setSavingProf(false);
      setTimeout(() => setSaveProfMsg(""), 2000);
    }
  }

  // Links helpers
  function onLinkChange(idx, key, val) {
    setLinks((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  }

  function addLinkRow() {
    setLinks((prev) => [
      ...prev,
      {
        id: `l_${Math.random().toString(36).slice(2, 9)}`,
        label: "New link",
        url: "",
      },
    ]);
    setSaveLinksError("");
    setSaveLinksMsg("");
  }

  function removeLinkRow(idx) {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
    setSaveLinksError("");
    setSaveLinksMsg("");
  }

  async function saveLinks() {
    try {
      setSavingLinks(true);
      setSaveLinksMsg("");
      setSaveLinksError("");

      const shaped = links
        .map((l) => ({
          id: l.id || `l_${Math.random().toString(36).slice(2, 9)}`,
          label: String(l.label || "").slice(0, 200),
          url: String(l.url || "").slice(0, 2000),
        }))
        .filter((l) => l.label || l.url);

      const resp = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editToken, links: shaped }),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        const msg =
          (json && (json.error || json.message)) ||
          `Save failed (${resp.status})`;
        setSaveLinksError(msg);
        return;
      }

      setLinks(
        Array.isArray(json.links)
          ? json.links.map((l) => ({
              id: l.id || `l_${Math.random().toString(36).slice(2, 9)}`,
              label: String(l.label || "").slice(0, 200),
              url: String(l.url || "").slice(0, 2000),
            }))
          : shaped
      );

      setSaveLinksMsg("Links saved!");
    } catch (e) {
      setSaveLinksError(e.message || "Failed to save links");
    } finally {
      setSavingLinks(false);
      setTimeout(() => setSaveLinksMsg(""), 2000);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="opacity-80">Loading editor…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-xl border border-red-600/40 bg-red-900/20 p-4">
          <div className="font-semibold mb-1">Can’t open editor</div>
          <div className="text-sm opacity-80">{loadError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Launch6 — Editor</h1>
            <div className="text-sm opacity-70">
              Plan: <span className="uppercase">{planLabel}</span> ·
              Limit: {maxAllowed}
            </div>
          </div>
          <code className="text-xs opacity-70">
            editToken: {editToken}
          </code>
        </div>

        {/* Inline save error / success for products */}
        {saveError ? (
          <div className="rounded-lg border border-rose-600/40 bg-rose-900/20 text-rose-100 px-3 py-2 text-sm">
            {saveError}
          </div>
        ) : null}
        {saveMsg ? (
          <div className="rounded-lg border border-green-600/40 bg-green-900/20 text-green-200 px-3 py-2 text-sm">
            {saveMsg}
          </div>
        ) : null}

        {/* Profile summary + Email capture */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 rounded-2xl border border-neutral-800 p-6">
            <div className="text-xl font-semibold mb-2">Profile</div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="opacity-60">Display name:</span>{" "}
                {profile?.displayName ||
                  profile?.name ||
                  "New Creator"}
              </div>
              <div>
                <span className="opacity-60">Public slug:</span>{" "}
                {profile?.publicSlug ||
                  profile?.slug ||
                  "(not set)"}
              </div>
              <div>
                <span className="opacity-60">Status:</span>{" "}
                {String(profile?.status ?? "active")}
              </div>
            </div>
          </div>

          {/* Email capture settings / upsell */}
          <div className="rounded-2xl border border-neutral-800 p-6">
            <div className="text-xl font-semibold mb-2">
              Email Capture
            </div>

            {isFree ? (
              <div className="text-sm text-neutral-300">
                Email capture and Klaviyo list sync are available on{" "}
                <span className="font-semibold">Starter</span> and
                above. Upgrade to start building your list from your
                drops.
              </div>
            ) : (
              <>
                {saveProfError ? (
                  <div className="mb-3 rounded-md border border-rose-600/40 bg-rose-900/20 text-rose-100 px-3 py-2 text-sm">
                    {saveProfError}
                  </div>
                ) : null}
                {saveProfMsg ? (
                  <div className="mb-3 rounded-md border border-green-600/40 bg-green-900/20 text-green-200 px-3 py-2 text-sm">
                    {saveProfMsg}
                  </div>
                ) : null}

                <label className="flex items-center gap-2 text-sm mb-3">
                  <input
                    type="checkbox"
                    className="align-middle"
                    checked={collectEmail}
                    onChange={(e) =>
                      setCollectEmail(e.target.checked)
                    }
                  />
                  Enable email capture on public page
                </label>

                <div className="text-xs opacity-70 mb-1">
                  Klaviyo List ID
                </div>
                <input
                  className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none mb-3"
                  value={klaviyoListId}
                  onChange={(e) =>
                    setKlaviyoListId(e.target.value)
                  }
                  placeholder="e.g., Vd9H2a"
                />

                <button
                  onClick={saveProfileSettings}
                  disabled={savingProf}
                  className="rounded-md border border-neutral-700 px-3 py-2 hover:bg-neutral-800 disabled:opacity-60 text-sm"
                >
                  {savingProf ? "Saving…" : "Save Settings"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Links Editor */}
        <div className="rounded-2xl border border-neutral-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xl font-semibold">Links</div>
            <div className="flex items-center gap-2">
              <button
                onClick={addLinkRow}
                className="rounded-lg border border-neutral-700 px-3 py-2 hover:bg-neutral-800"
              >
                + Add link
              </button>
              <button
                onClick={saveLinks}
                disabled={savingLinks}
                className="rounded-lg border border-green-700 px-3 py-2 hover:bg-green-900/20 disabled:opacity-60"
              >
                {savingLinks ? "Saving…" : "Save Links"}
              </button>
            </div>
          </div>

          {saveLinksError ? (
            <div className="mb-3 rounded-md border border-rose-600/40 bg-rose-900/20 text-rose-100 px-3 py-2 text-sm">
              {saveLinksError}
            </div>
          ) : null}
          {saveLinksMsg ? (
            <div className="mb-3 rounded-md border border-green-600/40 bg-green-900/20 text-green-200 px-3 py-2 text-sm">
              {saveLinksMsg}
            </div>
          ) : null}

          {links.length === 0 ? (
            <div className="opacity-70 text-sm">
              No links yet. Click “Add link”.
            </div>
          ) : (
            <div className="space-y-4">
              {links.map((l, idx) => (
                <div
                  key={l.id || idx}
                  className="grid md:grid-cols-12 gap-3 items-center"
                >
                  <div className="md:col-span-4">
                    <div className="text-xs opacity-70 mb-1">
                      Label
                    </div>
                    <input
                      className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none text-sm"
                      value={l.label || ""}
                      onChange={(e) =>
                        onLinkChange(
                          idx,
                          "label",
                          e.target.value
                        )
                      }
                      placeholder="e.g., Shop, Podcast, Gallery show"
                    />
                  </div>
                  <div className="md:col-span-7">
                    <div className="text-xs opacity-70 mb-1">
                      URL
                    </div>
                    <input
                      className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none text-sm"
                      value={l.url || ""}
                      onChange={(e) =>
                        onLinkChange(idx, "url", e.target.value)
                      }
                      placeholder="https://..."
                    />
                  </div>
                  <div className="md:col-span-1 flex md:justify-end">
                    <button
                      onClick={() => removeLinkRow(idx)}
                      className="mt-5 text-xs rounded-md border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Products Editor */}
        <div className="rounded-2xl border border-neutral-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xl font-semibold">Products</div>
            <div className="flex items-center gap-2">
              <button
                onClick={addProduct}
                className="rounded-lg border border-neutral-700 px-3 py-2 hover:bg-neutral-800"
              >
                + Add product
              </button>
              <button
                onClick={saveProducts}
                disabled={saving}
                className="rounded-lg border border-green-700 px-3 py-2 hover:bg-green-900/20 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Products"}
              </button>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="opacity-70 text-sm">
              No products yet. Click “Add product”.
            </div>
          ) : (
            <div className="space-y-6">
              {products.map((p, idx) => {
                return (
                  <div
                    key={p.id || idx}
                    className="rounded-xl border border-neutral-800 p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold">
                        {p.title || "Untitled"}
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm opacity-80">
                          <input
                            type="checkbox"
                            className="mr-2 align-middle"
                            checked={!!p.published}
                            onChange={(e) =>
                              onProdChange(
                                idx,
                                "published",
                                e.target.checked
                              )
                            }
                          />
                          Published
                        </label>
                        <button
                          onClick={() => removeProduct(idx)}
                          className="text-sm rounded-md border border-neutral-700 px-2 py-1 hover:bg-neutral-800"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs opacity-70 mb-1">
                            Title
                          </div>
                          <input
                            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                            value={p.title || ""}
                            onChange={(e) =>
                              onProdChange(
                                idx,
                                "title",
                                e.target.value
                              )
                            }
                            placeholder="e.g., Sunset Study — 12x16 Print"
                          />
                        </div>

                        <div>
                          <div className="text-xs opacity-70 mb-1">
                            Stripe Checkout URL
                          </div>
                          <input
                            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                            value={p.priceUrl || ""}
                            onChange={(e) =>
                              onProdChange(
                                idx,
                                "priceUrl",
                                e.target.value
                              )
                            }
                            placeholder="https://buy.stripe.com/..."
                          />
                        </div>

                        <div>
                          <div className="text-xs opacity-70 mb-1">
                            Image URL
                          </div>
                          <input
                            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                            value={p.imageUrl || ""}
                            onChange={(e) =>
                              onProdChange(
                                idx,
                                "imageUrl",
                                e.target.value
                              )
                            }
                            placeholder="https://…/image.jpg"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-xs opacity-70 mb-1">
                            Drop ends (timer)
                          </div>
                          <input
                            type="datetime-local"
                            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                            value={p.dropEndsAt || ""}
                            onChange={(e) =>
                              onProdChange(
                                idx,
                                "dropEndsAt",
                                e.target.value
                              )
                            }
                          />
                          <div className="text-xs opacity-60 mt-1">
                            If set, the public page can show a
                            countdown and hide “Buy” after expiry.
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs opacity-70 mb-1">
                              Total units
                            </div>
                            <input
                              type="number"
                              min="0"
                              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                              value={p.unitsTotal ?? ""}
                              onChange={(e) =>
                                onProdChange(
                                  idx,
                                  "unitsTotal",
                                  e.target.value
                                )
                              }
                              placeholder="e.g., 10"
                            />
                          </div>
                          <div>
                            <div className="text-xs opacity-70 mb-1">
                              Units left
                            </div>
                            <input
                              type="number"
                              min="0"
                              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                              value={p.unitsLeft ?? ""}
                              onChange={(e) =>
                                onProdChange(
                                  idx,
                                  "unitsLeft",
                                  e.target.value
                                )
                              }
                              placeholder="e.g., 5"
                            />
                          </div>
                        </div>

                        <div className="text-xs opacity-70">
                          If <b>Units left</b> hits 0, the public page
                          shows “Sold out” and hides “Buy”.
                        </div>

                        {/* Timer + inventory toggles */}
                        <div className="mt-3 space-y-2 text-sm">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="align-middle"
                              checked={!!p.showTimer}
                              onChange={(e) =>
                                onProdChange(
                                  idx,
                                  "showTimer",
                                  e.target.checked
                                )
                              }
                            />
                            Show countdown timer on public page
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="align-middle"
                              checked={!!p.showInventory}
                              onChange={(e) =>
                                onProdChange(
                                  idx,
                                  "showInventory",
                                  e.target.checked
                                )
                              }
                            />
                            Show “X/Y left” on public page
                          </label>
                          <div className="text-xs opacity-60">
                            Combine timer + “X/Y left” for
                            Instagram/TikTok-style drops.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
