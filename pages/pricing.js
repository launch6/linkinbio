// pages/pricing.js
import { useEffect, useState, useMemo } from "react";

export default function PricingPage() {
  // UI state
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [prices, setPrices] = useState(null);

  // persisted context
  const [editToken, setEditToken] = useState("");
  const [refCode, setRefCode] = useState("");

  // Read query params ONLY on client, then persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const q = Object.fromEntries(u.searchParams.entries());

    const savedEdit =
      q.editToken || window.localStorage.getItem("editToken") || "";
    const savedRef =
      q.refCode || window.localStorage.getItem("refCode") || "";

    setEditToken(savedEdit);
    setRefCode(savedRef);

    if (q.editToken) window.localStorage.setItem("editToken", q.editToken);
    if (q.refCode) window.localStorage.setItem("refCode", q.refCode);
  }, []);

  // Load formatted price labels
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const r = await fetch("/api/pricing/list");
        const j = await r.json();
        if (on) setPrices(j);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      on = false;
    };
  }, []);

  // Referral logic
  const isStarterPlus = useMemo(
    () => !!refCode && refCode.toLowerCase() === "starterplus",
    [refCode]
  );
  const bannerMonths = useMemo(
    () => (isStarterPlus ? 6 : refCode ? 3 : 0),
    [isStarterPlus, refCode]
  );

  async function gotoCheckout(priceKey) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceKey,
          editToken,
          email: email || undefined,
          refCode,                       // triggers referral logic server-side
          applyStarter6mo: isStarterPlus, // 6M path
          applyReferral3m: !!refCode && !isStarterPlus, // 3M path
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.url) {
        throw new Error(j?.error || "Internal error creating Checkout Session.");
      }
      window.location.href = j.url;
    } catch (e) {
      setError(e.message || "Internal error creating Checkout Session.");
    } finally {
      setBusy(false);
    }
  }

  async function startFree() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/free/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editToken, email: email || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Could not start Free profile.");
      if (typeof window !== "undefined" && j.editToken) {
        window.localStorage.setItem("editToken", j.editToken);
      }
      window.location.href =
        j.redirect ||
        `/editor?editToken=${encodeURIComponent(j.editToken || editToken)}`;
    } catch (e) {
      setError(e.message || "Could not start Free profile.");
    } finally {
      setBusy(false);
    }
  }

  // Labels with safe fallbacks
  const starterMonthlyLabel   = prices?.STARTER_MONTHLY    || "$9.95 / month";
  const starterLifetimeLabel  = prices?.STARTER_LIFETIME   || "$89.95";
  const proMonthlyLabel       = prices?.PRO_MONTHLY        || "$19.95 / month";
  const proLifetimeLabel      = prices?.PRO_LIFETIME       || "$199.95";
  const bizMonthlyLabel       = prices?.BUSINESS_MONTHLY   || "$29.95 / month";
  const bizLifetimeLabel      = prices?.BUSINESS_LIFETIME  || "$299.95";
  const starterTag            = bannerMonths ? ` · ${bannerMonths} months free` : "";

  return (
    <div className="min-h-screen text-white bg-neutral-950">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-4xl font-bold mb-2">Choose your plan</h1>
        <p className="text-neutral-400 mb-6">
          Pick a tier. You can upgrade/downgrade anytime.
        </p>

        {bannerMonths ? (
          <div className="mb-6 rounded-xl border border-green-600/40 bg-green-900/20 text-green-200 p-4">
            <b>{isStarterPlus ? "Starter+ referral applied" : "Referral applied"}:</b>{" "}
            both you and your friend get <b>{bannerMonths} months free</b> on Starter
            (card required to activate). Lifetime and non-Starter plans won’t apply the referral.
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <input
            className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-4 py-3 outline-none"
            placeholder="Edit Token"
            value={editToken}
            onChange={(e) => setEditToken(e.target.value)}
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

        {/* Business */}
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

        <div className="mt-8 text-neutral-500 text-sm">
          Manage billing becomes available after your first payment.
        </div>
      </div>
    </div>
  );
}
