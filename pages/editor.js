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
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState("");

  // Products state for the editor
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  // Read editToken from URL (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const t = u.searchParams.get("editToken") || window.localStorage.getItem("editToken") || "";
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
        const pr = await fetch(`/api/profile/get?editToken=${encodeURIComponent(editToken)}`, { cache: "no-store" });
        const pj = await pr.json();
        if (!pj?.ok) throw new Error(pj?.error || "Failed to load profile");
        // Products
        const r = await fetch(`/api/products?editToken=${encodeURIComponent(editToken)}`, { cache: "no-store" });
        const j = await r.json();
        if (!j?.ok) throw new Error(j?.error || "Failed to load products");

        if (!alive) return;
        setProfile(pj.profile);
        setProducts(
          (Array.isArray(j.products) ? j.products : []).map((p) => ({
            ...p,
            dropEndsAt: p.dropEndsAt ? isoToLocal(p.dropEndsAt) : "",
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

  const planLabel = useMemo(() => normalizePlan(profile?.plan || "free"), [profile]);
  const maxAllowed = MAX_PRODUCTS_BY_PLAN[planLabel] ?? MAX_PRODUCTS_BY_PLAN.free;

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
      setSaveError(`Your plan (${planLabel}) allows up to ${maxAllowed} product${maxAllowed === 1 ? "" : "s"}.`);
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

      // Second line of defense: prevent save if already over client limit (e.g., user edited in dev tools)
      if (products.length > maxAllowed) {
        setSaveError(`Your plan (${planLabel}) allows up to ${maxAllowed} product${maxAllowed === 1 ? "" : "s"}.`);
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
          p.unitsTotal === "" || p.unitsTotal === null ? "" : Math.max(0, parseInt(p.unitsTotal, 10) || 0),
        unitsLeft:
          p.unitsLeft === "" || p.unitsLeft === null ? "" : Math.max(0, parseInt(p.unitsLeft, 10) || 0),
        published: !!p.published,
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
      const r2 = await fetch(`/api/products?editToken=${encodeURIComponent(editToken)}`, { cache: "no-store" });
      const j2 = await r2.json();
      if (j2?.ok && Array.isArray(j2.products)) {
        setProducts(
          j2.products.map((p) => ({
            ...p,
            dropEndsAt: p.dropEndsAt ? isoToLocal(p.dropEndsAt) : "",
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
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Launch6 — Editor</h1>
            <div className="text-sm opacity-70">
              Plan: <span className="uppercase">{planLabel}</span> · Limit: {maxAllowed}
            </div>
          </div>
          <code className="text-xs opacity-70">editToken: {editToken}</code>
        </div>

        {/* Inline save error / success */}
        {saveError ? (
          <div className="mb-4 rounded-lg border border-rose-600/40 bg-rose-900/20 text-rose-100 px-3 py-2 text-sm">
            {saveError}
          </div>
        ) : null}
        {saveMsg ? (
          <div className="mb-4 rounded-lg border border-green-600/40 bg-green-900/20 text-green-200 px-3 py-2 text-sm">
            {saveMsg}
          </div>
        ) : null}

        {/* Profile summary */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 rounded-2xl border border-neutral-800 p-6">
            <div className="text-xl font-semibold mb-2">Profile</div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="opacity-60">Display name:</span>{" "}
                {profile?.displayName || profile?.name || "New Creator"}
              </div>
              <div>
                <span className="opacity-60">Public slug:</span>{" "}
                {profile?.publicSlug || profile?.slug || "(not set)"}
              </div>
              <div>
                <span className="opacity-60">Status:</span> {String(profile?.status ?? "active")}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-6">
            <div className="text-xl font-semibold mb-2">Next steps</div>
            <ol className="list-decimal list-inside text-sm space-y-2 opacity-90">
              <li>Add a product (below)</li>
              <li>Click <b>Save Products</b></li>
              <li>Publish and share your l6.io link</li>
            </ol>
          </div>
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
            <div className="opacity-70 text-sm">No products yet. Click “Add product”.</div>
          ) : (
            <div className="space-y-6">
              {products.map((p, idx) => {
                return (
                  <div key={p.id || idx} className="rounded-xl border border-neutral-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold">{p.title || "Untitled"}</div>
                      <div className="flex items-center gap-3">
                        <label className="text-sm opacity-80">
                          <input
                            type="checkbox"
                            className="mr-2 align-middle"
                            checked={!!p.published}
                            onChange={(e) => onProdChange(idx, "published", e.target.checked)}
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
                          <div className="text-xs opacity-70 mb-1">Title</div>
                          <input
                            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                            value={p.title || ""}
                            onChange={(e) => onProdChange(idx, "title", e.target.value)}
                            placeholder="e.g., Sunset Study — 12x16 Print"
                          />
                        </div>

                        <div>
                          <div className="text-xs opacity-70 mb-1">Stripe Checkout URL</div>
                          <input
                            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                            value={p.priceUrl || ""}
                            onChange={(e) => onProdChange(idx, "priceUrl", e.target.value)}
                            placeholder="https://buy.stripe.com/..."
                          />
                        </div>

                        <div>
                          <div className="text-xs opacity-70 mb-1">Image URL</div>
                          <input
                            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                            value={p.imageUrl || ""}
                            onChange={(e) => onProdChange(idx, "imageUrl", e.target.value)}
                            placeholder="https://…/image.jpg"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-xs opacity-70 mb-1">Drop ends (timer)</div>
                          <input
                            type="datetime-local"
                            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                            value={p.dropEndsAt || ""}
                            onChange={(e) => onProdChange(idx, "dropEndsAt", e.target.value)}
                          />
                          <div className="text-xs opacity-60 mt-1">
                            If set, the public page shows a countdown and hides “Buy” after expiry.
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs opacity-70 mb-1">Total units</div>
                            <input
                              type="number"
                              min="0"
                              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                              value={p.unitsTotal ?? ""}
                              onChange={(e) => onProdChange(idx, "unitsTotal", e.target.value)}
                              placeholder="e.g., 10"
                            />
                          </div>
                          <div>
                            <div className="text-xs opacity-70 mb-1">Units left</div>
                            <input
                              type="number"
                              min="0"
                              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 outline-none"
                              value={p.unitsLeft ?? ""}
                              onChange={(e) => onProdChange(idx, "unitsLeft", e.target.value)}
                              placeholder="e.g., 5"
                            />
                          </div>
                        </div>

                        <div className="text-xs opacity-70">
                          If <b>Units left</b> hits 0, the public page shows “Sold out” and hides “Buy”.
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
