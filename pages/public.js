// pages/public.js
import { useEffect, useRef, useState } from "react";

/** Format ms as "Xd Yh Zm Ws". */
function formatRemaining(ms) {
  if (ms <= 0) return "ended";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (mins || hours || days) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function toNumberOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default function PublicPage() {
  const [editToken, setEditToken] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [remaining, setRemaining] = useState({}); // { [id]: ms|null }
  const timerRef = useRef(null);

  // read URL params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const t = u.searchParams.get("editToken") || "";
    const r = u.searchParams.get("reason") || "";
    setEditToken(t);
    setReason(r);
  }, []);

  // fetch profile + products
  useEffect(() => {
    if (!editToken) {
      setLoading(false);
      setError("Missing editToken in URL");
      return;
    }
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const pr = await fetch(`/api/profile/get?editToken=${encodeURIComponent(editToken)}`);
        const pj = await pr.json();
        if (!pj?.ok) throw new Error(pj?.error || "Failed to load profile");

        const r = await fetch(`/api/products?editToken=${encodeURIComponent(editToken)}`);
        const j = await r.json();
        if (!j?.ok) throw new Error(j?.error || "Failed to load products");

        if (!alive) return;
        const onlyPublished = (j.products || []).filter((p) => !!p.published);
        setProfile(pj.profile);
        setProducts(onlyPublished);
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editToken]);

  // countdown ticker
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!products.length) return;

    function tick() {
      const now = Date.now();
      const next = {};
      for (const p of products) {
        const endsIso = p.dropEndsAt || "";
        const endsMs = endsIso ? Date.parse(endsIso) : null;
        next[p.id] = Number.isFinite(endsMs) ? Math.max(0, endsMs - now) : null;
      }
      setRemaining(next);
    }

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [products]);

  function productStatus(p) {
    const left = toNumberOrNull(p.unitsLeft);
    const total = toNumberOrNull(p.unitsTotal);
    const rem = remaining[p.id]; // ms|null
    const ended = rem === 0;
    const soldOut = left !== null && left <= 0;

    // Flags for micro-UX
    const endsSoon = Number.isFinite(rem) && rem !== null && rem > 0 && rem <= DAY_MS;
    const lowStock =
      left !== null &&
      ((total && total > 0 && left / total <= 0.2) || left <= 3) &&
      left > 0;

    if (soldOut) {
      return { label: "Sold out", ended: false, soldOut: true, endsSoon: false, lowStock: false };
    }
    if (rem === null && total !== null && left !== null) {
      return {
        label: `${left}/${total} left`,
        ended: false,
        soldOut: false,
        endsSoon: false,
        lowStock,
      };
    }
    if (rem === null) {
      return { label: "", ended: false, soldOut: false, endsSoon: false, lowStock: false };
    }
    if (ended) {
      return { label: "Drop ended", ended: true, soldOut: false, endsSoon: false, lowStock: false };
    }

    const base = `Ends in ${formatRemaining(rem)}`;
    if (total !== null && left !== null) {
      return {
        label: `${left}/${total} left — ${base}`,
        ended: false,
        soldOut: false,
        endsSoon,
        lowStock,
      };
    }
    return { label: base, ended: false, soldOut: false, endsSoon, lowStock: false };
  }

  function humanReason(r) {
    switch ((r || "").toLowerCase()) {
      case "expired": return "This drop has ended.";
      case "soldout": return "This item is sold out.";
      case "unpublished": return "This product isn’t available right now.";
      case "noprice": return "This product doesn’t have a checkout set yet.";
      default: return "";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="opacity-80">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-xl border border-red-600/40 bg-red-900/20 p-4">
          <div className="font-semibold mb-1">Can’t load page</div>
          <div className="text-sm opacity-80">{error}</div>
        </div>
      </div>
    );
  }

  const title = profile?.displayName || profile?.name || "Artist";
  const bio = profile?.bio || profile?.description || "";
  const reasonText = humanReason(reason);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Banner (optional) */}
        {reasonText ? (
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-900/20 text-amber-200 p-4">
            {reasonText}
          </div>
        ) : null}

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold">{title}</h1>
          {bio ? <p className="text-neutral-400 mt-2">{bio}</p> : null}
        </header>

        {/* Products */}
        {products.length === 0 ? (
          <div className="opacity-70">No products are published yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {products.map((p) => {
              const st = productStatus(p);
              const showBuy = !st.ended && !st.soldOut && !!p.priceUrl;
              const buyHref = `/api/products/buy?productId=${encodeURIComponent(
                p.id
              )}&editToken=${encodeURIComponent(editToken)}`;

              // Badge styles
              const statusClass =
                st.soldOut || st.ended
                  ? "text-red-300"
                  : st.endsSoon
                  ? "text-amber-300"
                  : "text-green-300";

              return (
                <article key={p.id} className="rounded-2xl border border-neutral-800 overflow-hidden">
                  {p.imageUrl ? (
                    <div className="relative">
                      <img
                        src={p.imageUrl}
                        alt={p.title || "Product image"}
                        className="w-full aspect-[4/3] object-cover"
                        loading="lazy"
                      />
                      {/* Ribbon for Ends soon */}
                      {st.endsSoon && !st.soldOut && !st.ended ? (
                        <div className="absolute top-3 left-3 rounded-md bg-amber-500/20 border border-amber-400/40 px-2 py-1 text-xs text-amber-100 backdrop-blur">
                          Ends soon
                        </div>
                      ) : null}
                      {/* Ribbon for Low stock */}
                      {st.lowStock && !st.soldOut && !st.ended ? (
                        <div className="absolute top-3 right-3 rounded-md bg-fuchsia-500/20 border border-fuchsia-400/40 px-2 py-1 text-xs text-fuchsia-100 backdrop-blur">
                          Low stock
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="p-5">
                    <h2 className="text-xl font-semibold mb-1">{p.title || "Untitled"}</h2>

                    {st.label ? (
                      <div className={`text-sm mb-3 ${statusClass}`}>{st.label}</div>
                    ) : null}

                    {showBuy ? (
                      <a
                        href={buyHref}
                        className="inline-block rounded-xl border border-neutral-700 px-4 py-2 hover:bg-neutral-800"
                      >
                        Buy
                      </a>
                    ) : (
                      <div className="inline-flex rounded-xl border border-neutral-800 px-4 py-2 text-neutral-400">
                        {st.soldOut ? "Sold out" : st.ended ? "Drop ended" : "Unavailable"}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
