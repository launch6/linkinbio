// pages/pricing.js
import { useEffect, useMemo, useState } from "react";

function useQuery() {
  const [q, setQ] = useState({});
  useEffect(() => {
    const u = new URL(window.location.href);
    const obj = Object.fromEntries(u.searchParams.entries());
    setQ(obj);
    // persist for future visits
    if (obj.editToken) localStorage.setItem("editToken", obj.editToken);
    if (obj.refCode) localStorage.setItem("refCode", obj.refCode);
  }, []);
  return q;
}

export default function PricingPage() {
  const q = useQuery();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const editToken = useMemo(
    () => q.editToken || localStorage.getItem("editToken") || "",
    [q.editToken]
  );
  const refCode = useMemo(
    () => q.refCode || localStorage.getItem("refCode") || "",
    [q.refCode]
  );

  const [prices, setPrices] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/pricing/list");
        const json = await r.json();
        if (alive) setPrices(json);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function gotoCheckout(priceKey) {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceKey,
          editToken,
          email: email || undefined,
          refCode,
          // tell API to try 6-month free when Starter Monthly + referral
          applyStarter6mo: !!refCode,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Internal error creating Checkout Session.");
      window.location.href = j.url;
    } catch (e) {
      console.error(e);
      setError(e.message || "Internal error creating Checkout Session.");
    } finally {
      setBusy(false);
    }
  }

  async function startFree() {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/free/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editToken, email: email || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Could not start Free profile.");
      // persist any new token returned
      if (j.editToken) localStorage.setItem("editToken", j.editToken);
      window.location.href = j.redirect || `/editor?editToken=${encodeURIComponent(j.editToken || editToken)}`;
    } catch (e) {
      console.error(e);
      setError(e.message || "Could not start Free profile.");
    } finally {
      setBusy(false);
    }
  }

  const starterMonthlyLabel = prices?.STARTER_MONTHLY || "$9.95 / month";
  const starterLifetimeLabel = prices?.STARTER_LIFETIME || "$89.95";
  const proMonthlyLabel = prices?.PRO_MONTHLY || "$19.95 / month";
  const proLifetimeLabel = prices?.PRO_LIFETIME || "$199.95";
  const bizMonthlyLabel = prices?.BUSINESS_MONTHLY || "$29.95 / month";
  const bizLifetimeLabel = prices?.BUSINESS_LIFETIME || "$299.95";

  const starterTag = refCode ? " · 6 months free" : "";

  return (
    <div className="min-h-screen text-white bg-neutral-950">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-bold mb-2">Choose your plan</h1>
        <p className="text-neutral-400 mb-6">Pick a tier. You can upgrade/downgrade anytime.</p>

        {refCode ? (
          <div className="mb-6 rounded-xl border border-green-600/40 bg-green-900/20 text-green-200 p-4">
            <b>Starter+ referral applied:</b> both you and your friend get <b>6 months free</b> on Starter
            (card required to activate). Lifetime and non-Starter plans won’t apply the referral.
          </div>
        ) : null}

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <input
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-4 py-3 outline-none"
            placeholder="Edit Token"
            value={editToken}
            onChange={(e) => localStorage.setItem("editToken", e.target.value)}
            readOnly
          />
          <input
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-4 py-3 outline-none"
            placeholder="you@example.com (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-600/40 bg-red-900/20 text-red-200 p-4">
            {error}
          </div>
        ) : null}

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Free */}
          <div className="rounded-2xl border border-neutral-800 p-6">
            <div className="text-2xl font-semibold mb-2">Free</div>
            <p className="text-neutral-400 mb-6">
              Create your page, add links, collect emails, and try products with basic limits.
              You’re on Free until you upgrade.
            </p>
            <button
              onClick={startFree}
              disabled={busy}
              className="w-full rounded-xl border border-neutral-700 px-4 py-3 hover:bg-neutral-800 disabled:opacity-60"
            >
              {busy ? "Starting..." : "Get Started Free"}
            </button>
          </div>

          {/* Starter */}
          <div className="rounded-2xl border border-neutral-800 p-6">
            <div className="text-2xl font-semibold mb-2">Starter</div>
            <div className="space-y-3">
              <button
                onClick={() => gotoCheckout("STRIPE_PRICE_STARTER_MONTHLY")}
                disabled={busy}
                className="w-full rounded-xl border border-neutral-700 px-4 py-3 hover:bg-neutral-800 disabled:opacity-60"
              >
                Monthly — {starterMonthlyLabel}{starterTag}
              </button>
              <button
                onClick={() => gotoCheckout("STRIPE_PRICE_STARTER_LIFETIME")}
                disabled={busy}
                className="w-full rounded-xl border border-neutral-700 px-4 py-3 hover:bg-neutral-800 disabled:opacity-60"
              >
                Lifetime — {starterLifetimeLabel}
              </button>
            </div>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border border-neutral-800 p-6">
            <div className="text-2xl font-semibold mb-2">Pro</div>
            <div className="space-y-3">
              <button
                onClick={() => gotoCheckout("STRIPE_PRICE_PRO_MONTHLY")}
                disabled={busy}
                className="w-full rounded-xl border border-neutral-700 px-4 py-3 hover:bg-neutral-800 disabled:opacity-60"
              >
                Monthly — {proMonthlyLabel}
              </button>
              <button
                onClick={() => gotoCheckout("STRIPE_PRICE_PRO_LIFETIME")}
                disabled={busy}
                className="w-full rounded-xl border border-neutral-700 px-4 py-3 hover:bg-neutral-800 disabled:opacity-60"
              >
                Lifetime — {proLifetimeLabel}
              </button>
            </div>
          </div>
        </div>

        {/* Business row */}
        <div className="grid md:grid-cols-3 gap-6 mt-6">
          <div className="md:col-start-3 rounded-2xl border border-neutral-800 p-6">
            <div className="text-2xl font-semibold mb-2">Business</div>
            <div className="space-y-3">
              <button
                onClick={() => gotoCheckout("STRIPE_PRICE_BUSINESS_MONTHLY")}
                disabled={busy}
                className="w-full rounded-xl border border-neutral-700 px-4 py-3 hover:bg-neutral-800 disabled:opacity-60"
              >
                Monthly — {bizMonthlyLabel}
              </button>
              <button
                onClick={() => gotoCheckout("STRIPE_PRICE_BUSINESS_LIFETIME")}
                disabled={busy}
                className="w-full rounded-xl border border-neutral-700 px-4 py-3 hover:bg-neutral-800 disabled:opacity-60"
              >
                Lifetime — {bizLifetimeLabel}
              </button>
            </div>
          </div>
        </div>

        {/* Manage billing hint */}
        <div className="mt-8 text-neutral-500 text-sm">
          Manage billing becomes available after your first payment.
        </div>
      </div>
    </div>
  );
}
