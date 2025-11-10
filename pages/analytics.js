// pages/analytics.js
import { useEffect, useMemo, useState } from "react";

function fmtDate(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

export default function AnalyticsPage() {
  const [editToken, setEditToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([]); // from /api/products
  const [sum7, setSum7] = useState(null);       // /api/analytics-summary?days=7
  const [sum30, setSum30] = useState(null);     // /api/analytics-summary?days=30

  // read editToken from URL (?editToken=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const t = u.searchParams.get("editToken") || window.localStorage.getItem("editToken") || "";
    setEditToken(t);
    if (t) window.localStorage.setItem("editToken", t);
  }, []);

  useEffect(() => {
    if (!editToken) { setLoading(false); setError("Missing editToken"); return; }
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // products (to map productId -> title)
        const pr = await fetch(`/api/products?editToken=${encodeURIComponent(editToken)}`, { cache: "no-store" });
        const pj = await pr.json();
        if (!pj?.ok) throw new Error(pj?.error || "Failed to load products");
        // analytics
        const r7 = await fetch(`/api/analytics-summary?editToken=${encodeURIComponent(editToken)}&days=7`, { cache: "no-store" });
        const j7 = await r7.json();
        const r30 = await fetch(`/api/analytics-summary?editToken=${encodeURIComponent(editToken)}&days=30`, { cache: "no-store" });
        const j30 = await r30.json();

        if (!alive) return;
        setProducts(Array.isArray(pj.products) ? pj.products : []);
        setSum7(j7?.ok ? j7 : { ok: false, totals: [] });
        setSum30(j30?.ok ? j30 : { ok: false, totals: [] });
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load analytics");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [editToken]);

  // Build maps for rendering
  const titleById = useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(p.id, p.title || "Untitled");
    return m;
  }, [products]);

  function Table({ data, label }) {
    const totals = Array.isArray(data?.totals) ? data.totals : [];
    return (
      <div className="rounded-2xl border border-neutral-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">{label}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-950">
              <tr className="text-left text-neutral-400">
                <th className="px-4 py-2 border-b border-neutral-800">Product</th>
                <th className="px-4 py-2 border-b border-neutral-800">Product ID</th>
                <th className="px-4 py-2 border-b border-neutral-800">Event</th>
                <th className="px-4 py-2 border-b border-neutral-800">Count</th>
                <th className="px-4 py-2 border-b border-neutral-800">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {totals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-neutral-500">No events in this range.</td>
                </tr>
              ) : (
                totals.map((row, i) => (
                  <tr key={i} className="border-b border-neutral-900">
                    <td className="px-4 py-2">{titleById.get(row.productId) || "Untitled"}</td>
                    <td className="px-4 py-2 text-neutral-400">{row.productId}</td>
                    <td className="px-4 py-2">{row.type}</td>
                    <td className="px-4 py-2">{row.count}</td>
                    <td className="px-4 py-2 text-neutral-400">{fmtDate(row.lastTs)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data?.range ? (
          <div className="px-4 py-2 text-xs text-neutral-500">
            Window: {new Date(data.range.from).toLocaleString()} → {new Date(data.range.to).toLocaleString()}
          </div>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">Loading analytics…</div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-xl border border-red-600/40 bg-red-900/20 p-4">
          <div className="font-semibold mb-1">Can’t load analytics</div>
          <div className="text-sm opacity-80">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <div className="text-sm text-neutral-400">editToken: {editToken}</div>
          </div>
          <div className="text-sm">
            <a href={`/public?editToken=${encodeURIComponent(editToken)}`} className="underline mr-4">View public</a>
            <a href={`/editor?editToken=${encodeURIComponent(editToken)}`} className="underline">Open editor</a>
          </div>
        </div>

        <Table data={sum7} label="Last 7 days — Buy clicks" />
        <Table data={sum30} label="Last 30 days — Buy clicks" />
      </div>
    </div>
  );
}
