// pages/pricing.js
import { useEffect, useMemo, useState } from "react";

const PLANS = [
  // FREE (informational only; no checkout)
  {
    id: "free",
    label: "Free",
    options: [],
    note:
      "Create your page, add links, collect emails, and try products with basic limits. You’re on Free until you upgrade.",
  },

  // Paid tiers
  {
    id: "starter",
    label: "Starter",
    options: [
      { label: "Monthly", priceKey: "STRIPE_PRICE_STARTER_MONTHLY", supportsReferral: true },
      { label: "Lifetime", priceKey: "STRIPE_PRICE_STARTER_LIFETIME" },
    ],
  },
  {
    id: "pro",
    label: "Pro",
    options: [
      { label: "Monthly", priceKey: "STRIPE_PRICE_PRO_MONTHLY" },
      { label: "Lifetime", priceKey: "STRIPE_PRICE_PRO_LIFETIME" },
    ],
  },
  {
    id: "business",
    label: "Business",
    options: [
      { label: "Monthly", priceKey: "STRIPE_PRICE_BUSINESS_MONTHLY" },
      { label: "Lifetime", priceKey: "STRIPE_PRICE_BUSINESS_LIFETIME" },
    ],
  },
];

function fmtPrice(p) {
  if (!p || p.error) return null;
  const amount = (p.unit_amount ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (p.currency || "usd").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export default function PricingPage() {
  const [editToken, setEditToken] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState("");
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null);
  const [hasCustomer, setHasCustomer] = useState(false);
  const [catalog, setCatalog] = useState({}); // priceKey -> price object
  const [refCode, setRefCode] = useState("");

  // Read token + status + refCode from URL; persist; fallback to localStorage
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get("editToken");
      const status = url.searchParams.get("status");
      const urlRef = url.searchParams.get("refCode");

      if (status === "success") setBanner({ type: "success", text: "Payment successful." });
      if (status === "cancelled") setBanner({ type: "warn", text: "Checkout cancelled." });

      if (urlRef) {
        setRefCode(urlRef);
        try {
          localStorage.setItem("refCode", urlRef);
        } catch {}
      } else {
        try {
          const savedRef = localStorage.getItem("refCode");
          if (savedRef) setRefCode(savedRef);
        } catch {}
      }

      if (fromUrl) {
        localStorage.setItem("editToken", fromUrl);
        setEditToken(fromUrl);
        return;
      }
    } catch {}

    try {
      const fromStorage = localStorage.getItem("editToken") || "";
      if (fromStorage) setEditToken(fromStorage);
    } catch {}
  }, []);

  // Load live prices (labels come from Stripe via our API)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/pricing/list");
        const data = await res.json();
        if (res.ok && data?.prices) setCatalog(data.prices);
      } catch {}
    })();
  }, []);

  // Probe for an existing customer to enable the billing portal button
  useEffect(() => {
    (async () => {
      if (!editToken) return;
      try {
        const res = await fetch("/api/billing/create-portal-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ editToken }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.url) setHasCustomer(true);
      } catch {}
    })();
  }, [editToken]);

  const hasToken = useMemo(() => Boolean(editToken && String(editToken).trim()), [editToken]);
  const showStarterPlus = Boolean(refCode);

  async function startCheckout({ priceKey, supportsReferral, applyStarter6mo }) {
    setError("");
    if (!hasToken) {
      setError("Missing editToken. Paste it below and try again.");
      return;
    }
    setCreating(priceKey);
    try {
      const body = {
        editToken,
        ...(email ? { email } : {}),
        priceKey,
        ...(refCode && supportsReferral ? { refCode } : {}),
        ...(applyStarter6mo ? { applyStarter6mo: true } : {}),
      };

      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || "Failed to start checkout");
      window.location.href = data.url;
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setCreating("");
    }
  }

  async function openPortal() {
    setError("");
    try {
      const res = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editToken }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) throw new Error(data?.error || "Could not open billing portal");
      window.location.href = data.url;
    } catch (e) {
      setError(e.message || "Could not open billing portal");
    }
  }

  return (
    <div
      style={{
        maxWidth: 1080,
        margin: "40px auto",
        padding: "0 16px",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 6 }}>Choose your plan</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>Pick a tier. You can upgrade/downgrade anytime.</p>

      {banner && (
        <div
          style={{
            margin: "16px 0",
            padding: 12,
            borderRadius: 8,
            border: "1px solid",
            borderColor: banner.type === "success" ? "#b6e6bd" : "#ffe69c",
            background: banner.type === "success" ? "#d1f7d6" : "#fff3cd",
            color: banner.type === "success" ? "#0a5c22" : "#664d03",
          }}
        >
          {banner.text}
        </div>
      )}

      {!hasToken && (
        <div
          style={{
            background: "#fff3cd",
            color: "#664d03",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ffe69c",
            margin: "12px 0",
          }}
        >
          <strong>Heads up:</strong> We need your <code>editToken</code> to attach the plan to the
          right profile.
        </div>
      )}

      {showStarterPlus && (
        <div
          style={{
            margin: "12px 0",
            padding: 12,
            borderRadius: 8,
            border: "1px dashed #2e7d32",
            background: "#edf7ed",
            color: "#1b5e20",
            fontSize: 14,
          }}
        >
          <strong>Starter+ referral applied:</strong> both you and your friend get{" "}
          <strong>6 months free</strong> on Starter (card required to activate). Lifetime and
          non-Starter plans won’t apply the referral.
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 12,
          margin: "12px 0",
          gridTemplateColumns: "1fr 1fr",
          alignItems: "end",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 14, color: "#333" }}>Edit Token</span>
          <input
            value={editToken}
            onChange={(e) => setEditToken(e.target.value)}
            onBlur={() => {
              try {
                if (editToken) localStorage.setItem("editToken", editToken);
              } catch {}
            }}
            placeholder="paste your editToken"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 14, color: "#333" }}>Email (optional)</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>
      </div>

      {error && (
        <div
          style={{
            background: "#f8d7da",
            color: "#842029",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #f5c2c7",
            margin: "12px 0",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(4, 1fr)",
          marginTop: 16,
        }}
      >
        {PLANS.map((plan) => (
          <div key={plan.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{plan.label}</div>

            {/* FREE: show note only */}
            {plan.id === "free" ? (
              <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>
                {plan.note || "Start for free. Upgrade anytime."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {plan.options.map((opt) => {
                  const price = catalog[opt.priceKey];
                  const isStarterMonthly =
                    plan.id === "starter" && opt.priceKey === "STRIPE_PRICE_STARTER_MONTHLY";

                  const base = fmtPrice(price);
                  const label =
                    isStarterMonthly && showStarterPlus && base
                      ? `Monthly — ${base} · 6 months free`
                      : base
                      ? `${opt.label} — ${base}${price?.interval ? ` / ${price.interval}` : ""}`
                      : `${opt.label}${price?.error ? " — (unavailable)" : ""}`;

                  const disabled =
                    creating === opt.priceKey || !hasToken || !!price?.error || !price;

                  const supportsReferral = Boolean(opt.supportsReferral);
                  const applyStarter6mo = Boolean(isStarterMonthly && showStarterPlus);

                  return (
                    <button
                      key={opt.label}
                      onClick={() =>
                        startCheckout({ priceKey: opt.priceKey, supportsReferral, applyStarter6mo })
                      }
                      disabled={disabled}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        cursor: disabled ? "not-allowed" : "pointer",
                        background: disabled ? "#e9ecef" : "#000",
                        color: disabled ? "#6c757d" : "#fff",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                      title={price?.error ? price.error : undefined}
                    >
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={openPortal}
          disabled={!hasCustomer}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: hasCustomer ? "#fff" : "#f4f4f4",
            cursor: hasCustomer ? "pointer" : "not-allowed",
            fontWeight: 600,
          }}
        >
          Manage billing
        </button>
        {!hasCustomer && (
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            Becomes available after your first payment.
          </span>
        )}
      </div>

      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
        Tip: we save <code>editToken</code> and any <code>refCode</code> from the URL so you don’t
        need to paste them again.
      </p>
    </div>
  );
}
