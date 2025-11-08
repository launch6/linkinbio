// pages/editor.js
import { useEffect, useMemo, useState } from "react";

/** tiny helpers (no libs) */
function toDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
function fmtCountdown(target) {
  if (!target) return "";
  const now = new Date().getTime();
  const end = target.getTime();
  const diff = Math.max(0, end - now);
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}
function isExpired(target) {
  const d = toDate(target);
  if (!d) return false;
  return Date.now() >= d.getTime();
}

export default function EditorPage() {
  const [editToken, setEditToken] = useState("");
  const [state, setState] = useState({ loading: true, error: "", profile: null });

  // ------- load profile -------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const t = u.searchParams.get("editToken") || window.localStorage.getItem("editToken") || "";
    setEditToken(t);
    if (!t) {
      setState({ loading: false, error: "Missing editToken in URL", profile: null });
      return;
    }
    fetch(`/api/profile/get?editToken=${encodeURIComponent(t)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) throw new Error(j?.error || "Failed to load profile");
        setState({ loading: false, error: "", profile: j.profile || {} });
        window.localStorage.setItem("editToken", t);
      })
      .catch((e) => setState({ loading: false, error: e.message || "Failed to load", profile: null }));
  }, []);

  // ----------------- Product Editor (local-only for now) -----------------
  const [products, setProducts] = useState([]);
  useEffect(() => {
    if (state.profile?.products) setProducts(state.profile.products);
  }, [state.profile]);

  const blankProduct = {
    id: "",
    title: "",
    priceUrl: "",
    imageUrl: "",
    // new MVP fields
    dropEndsAt: "", // ISO string suitable for <input type="datetime-local">
    unitsTotal: "",
    unitsLeft: "",
    published: true,
  };
  const [form, setForm] = useState(blankProduct);
  const editingIndex = useMemo(
    () => products.findIndex((p) => p.id && form.id && p.id === form.id),
    [products, form.id]
  );

  function resetForm() {
    setForm(blankProduct);
  }
  function upsertProduct() {
    // minimal validation
    if (!form.title.trim()) return alert("Title is required");
    if (!form.priceUrl.trim()) return alert("Stripe Checkout URL is required");
    // normalize numeric fields
    const total = form.unitsTotal === "" ? "" : Math.max(0, parseInt(form.unitsTotal, 10) || 0);
    const left = form.unitsLeft === "" ? "" : Math.max(0, parseInt(form.unitsLeft, 10) || 0);
    const record = {
      ...form,
      id: form.id || `p_${Math.random().toString(36).slice(2, 10)}`,
      unitsTotal: total,
      unitsLeft: left,
    };
    setProducts((prev) => {
      const i = prev.findIndex((p) => p.id === record.id);
      if (i >= 0) {
        const copy = prev.slice();
        copy[i] = record;
        return copy;
      }
      return [record, ...prev];
    });
    resetForm();
  }
  function editProduct(p) {
    // Convert dropEndsAt to value acceptable by datetime-local input
    const dt = p.dropEndsAt ? new Date(p.dropEndsAt) : null;
    setForm({
      ...blankProduct,
      ...p,
      dropEndsAt: dt ? new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
    });
  }
  function removeProduct(id) {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    if (form.id === id) resetForm();
  }

  // live preview for the currently selected/edited product
  const preview = useMemo(() => {
    const d = toDate(form.dropEndsAt);
    const expired = isExpired(form.dropEndsAt);
    const countdown = d ? fmtCountdown(d) : "";
    const showSoldOut = form.unitsLeft !== "" && Number(form.unitsLeft) <= 0;
    const buyVisible = !expired && !showSoldOut && !!form.priceUrl;
    return { expired, countdown, showSoldOut, buyVisible };
  }, [form.dropEndsAt, form.unitsLeft, form.priceUrl]);

  // ----------------- page chrome -----------------
  if (state.loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="opacity-80">Loading editor…</div>
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-xl border border-red-600/40 bg-red-900/20 p-4">
          <div className="font-semibold mb-1">Can’t open editor</div>
          <div className="text-sm opacity-80">{state.error}</div>
        </div>
      </div>
    );
  }

  const p = state.profile || {};

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Launch6 — Editor</h1>
          <code className="text-xs opacity-70">editToken: {editToken}</code>
        </div>

        {/* top summary */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 rounded-2xl border border-neutral-800 p-6">
            <div className="text-xl font-semibold mb-2">Profile</div>
            <div className="space-y-2 text-sm">
              <div><span className="opacity-60">Display name:</span> {p.displayName || p.name || "New Creator"}</div>
              <div><span className="opacity-60">Public slug:</span> {p.publicSlug || p.slug || "(not set)"}</div>
              <div><span className="opacity-60">Plan:</span> {p.plan}</div>
              <div><span className="opacity-60">Products:</span> {products.length}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-6">
            <div className="text-xl font-semibold mb-2">Next steps</div>
            <ol className="list-decimal list-inside text-sm space-y-2 opacity-90">
              <li>Add a product (below)</li>
              <li>We’ll wire “Save to server” in the next step</li>
              <li>Publish your page</li>
            </ol>
          </div>
        </div>

        {/* PRODUCT EDITOR */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* form */}
          <div className="md:col-span-2 rounded-2xl border border-neutral-800 p-6">
            <div className="text-xl font-semibold mb-4">
              {editingIndex >= 0 ? "Edit product" : "Add a product"}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <label className="block">
                <div className="opacity-70 mb-1">Title *</div>
                <input
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Sunset #12 — 14x20” print"
                />
              </label>

              <label className="block">
                <div className="opacity-70 mb-1">Stripe Checkout URL *</div>
                <input
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2"
                  value={form.priceUrl}
                  onChange={(e) => setForm((f) => ({ ...f, priceUrl: e.target.value }))}
                  placeholder="https://checkout.stripe.com/c/pay/cs_test_..."
                />
              </label>

              <label className="block md:col-span-2">
                <div className="opacity-70 mb-1">Image URL (optional)</div>
                <input
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2"
                  value={form.imageUrl}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="https://…/image.jpg"
                />
              </label>

              {/* MVP: Manual Timer */}
              <label className="block">
                <div className="opacity-70 mb-1">Drop ends on (date & time)</div>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2"
                  value={form.dropEndsAt}
                  onChange={(e) => setForm((f) => ({ ...f, dropEndsAt: e.target.value }))}
                />
              </label>

              {/* MVP: Scarcity counter */}
              <label className="block">
                <div className="opacity-70 mb-1">Total units (manual)</div>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2"
                  value={form.unitsTotal}
                  onChange={(e) => setForm((f) => ({ ...f, unitsTotal: e.target.value }))}
                  placeholder="e.g., 10"
                />
              </label>

              <label className="block">
                <div className="opacity-70 mb-1">Units left (manual)</div>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2"
                  value={form.unitsLeft}
                  onChange={(e) => setForm((f) => ({ ...f, unitsLeft: e.target.value }))}
                  placeholder="e.g., 5"
                />
              </label>

              <label className="block">
                <div className="opacity-70 mb-1">Published</div>
                <select
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2"
                  value={form.published ? "1" : "0"}
                  onChange={(e) => setForm((f) => ({ ...f, published: e.target.value === "1" }))}
                >
                  <option value="1">Yes</option>
                  <option value="0">No (draft)</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-white text-black font-medium"
                onClick={upsertProduct}
              >
                {editingIndex >= 0 ? "Update product (local)" : "Add product (local)"}
              </button>
              {editingIndex >= 0 && (
                <button
                  className="px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="mt-6 text-xs opacity-70">
              This step saves **locally** in the editor. In the next step we’ll
              connect a backend endpoint to persist products to your profile.
            </div>
          </div>

          {/* live preview card */}
          <div className="rounded-2xl border border-neutral-800 p-6">
            <div className="text-xl font-semibold mb-3">Live preview</div>
            <div className="rounded-xl border border-neutral-700 p-4 space-y-2">
              <div className="font-semibold">{form.title || "Untitled product"}</div>
              {form.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  src={form.imageUrl}
                  className="w-full rounded-lg object-cover aspect-[4/3] border border-neutral-800"
                />
              ) : (
                <div className="w-full aspect-[4/3] rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs opacity-60">
                  No image
                </div>
              )}

              {/* scarcity + timer readout */}
              <div className="text-sm">
                {form.unitsLeft !== "" && form.unitsTotal !== "" ? (
                  <div className="opacity-90">
                    {Number(form.unitsLeft) <= 0 ? (
                      <span className="text-red-400 font-medium">Sold out</span>
                    ) : (
                      <span>{form.unitsLeft}/{form.unitsTotal} left</span>
                    )}
                    {form.dropEndsAt && !isExpired(form.dropEndsAt) && (
                      <span className="opacity-60"> &nbsp;— ends in {fmtCountdown(toDate(form.dropEndsAt))}</span>
                    )}
                  </div>
                ) : form.dropEndsAt ? (
                  <div className="opacity-60">
                    {isExpired(form.dropEndsAt) ? "Drop ended" : `Ends in ${fmtCountdown(toDate(form.dropEndsAt))}`}
                  </div>
                ) : null}
              </div>

              {preview.buyVisible ? (
                <a
                  href={form.priceUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white text-black font-medium"
                >
                  Buy
                </a>
              ) : (
                <button
                  disabled
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 opacity-70"
                >
                  {preview.expired ? "Drop ended" : preview.showSoldOut ? "Sold out" : "Buy"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* products list */}
        <div className="mt-10 rounded-2xl border border-neutral-800 p-6">
          <div className="text-xl font-semibold mb-4">Your products (local)</div>
          {products.length === 0 ? (
            <div className="text-sm opacity-70">No products yet.</div>
          ) : (
            <div className="space-y-3">
              {products.map((pr) => {
                const expired = isExpired(pr.dropEndsAt);
                const countdown = pr.dropEndsAt && !expired ? fmtCountdown(toDate(pr.dropEndsAt)) : "";
                const soldOut = pr.unitsLeft !== "" && Number(pr.unitsLeft) <= 0;
                return (
                  <div
                    key={pr.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 p-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{pr.title}</div>
                      <div className="text-xs opacity-70">
                        {pr.unitsLeft !== "" && pr.unitsTotal !== "" && (
                          <span>{pr.unitsLeft}/{pr.unitsTotal} left</span>
                        )}
                        {pr.dropEndsAt && (
                          <span>
                            {pr.unitsLeft !== "" && pr.unitsTotal !== "" ? " • " : ""}
                            {expired ? "Drop ended" : `Ends in ${countdown}`}
                          </span>
                        )}
                        {(soldOut || expired) && <span> • hidden Buy</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-sm"
                        onClick={() => editProduct(pr)}
                      >
                        Edit
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-lg bg-red-600/90 text-white text-sm"
                        onClick={() => removeProduct(pr.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-6 text-xs opacity-60">
            Next step: we’ll wire a “Save to server” button that persists this list to your profile via an API.
          </div>
        </div>
      </div>
    </div>
  );
}
