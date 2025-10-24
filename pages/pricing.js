// pages/pricing.js
import { useEffect, useMemo, useState } from "react";

const TIERS = [
  { id: "starter", label: "Starter", priceIdEnv: "STRIPE_PRICE_STARTER_MONTHLY", display: "$9.95 / month" },
  // Add more tiers/prices as needed:
  // { id: "pro", label: "Pro", priceIdEnv: "STRIPE_PRICE_PRO_MONTHLY", display: "$19 / month" },
  // { id: "business", label: "Business", priceIdEnv: "STRIPE_PRICE_BUSINESS_MONTHLY", display: "$49 / month" },
];

export default function PricingPage() {
  const [editToken, setEditToken] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // 1) Pull token from URL on first load; 2) fallback to localStorage
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get("editToken");
      if (fromUrl) {
        localStorage.setItem("editToken", fromUrl);
        setEditToken(fromUrl);
        return;
      }
    } catch {}
    try {
      const fromStorage = localStorage.getItem("editToken") || "";
      if (fromStorage) {
        setEditToken(fromStorage);
      }
    } catch {}
  }, []);

  // For a quick visual hint whether we’re missing it
  const hasToken = useMemo(() => Boolean(editToken && String(editToken).trim().length > 0), [editToken]);

  async function startCheckout({ priceIdEnv }) {
    setError("");
    if (!hasToken) {
      setError("Missing editToken. Paste it below and try again.");
      return;
    }
    setCreating(true);
    try {
      // NOTE: priceId is optional; the server will fallback to STRIPE_PRICE_STARTER_MONTHLY
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editToken,
          // You can optionally pass email so Stripe pre-fills it:
          ...(email ? { email } : {}),
          // If you want to force a specific price, uncomment and set from env in your server:
          // priceId: process.env[priceIdEnv]
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to create checkout");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e.message || "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: "40px auto", padding: "0 16px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Choose your plan</h1>

      {!hasToken && (
        <div style={{ background: "#fff3cd", color: "#664d03", padding: 12, borderRadius: 8, border: "1px solid #ffe69c", margin: "12px 0" }}>
          <strong>Heads up:</strong> We need your <code>editToken</code> so we can apply the plan to the right profile.
        </div>
      )}

      <div style={{ display: "grid", gap: 12, margin: "12px 0" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 14, color: "#333" }}>Edit Token</span>
          <input
            value={editToken}
            onChange={(e) => setEditToken(e.target.value)}
            onBlur={() => {
              try { if (editToken) localStorage.setItem("editToken", editToken); } catch {}
            }}
            placeholder="paste your editToken"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 14, color: "#333" }}>Email (optional, pre-fills Stripe)</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>
      </div>

      {error && (
        <div style={{ background: "#f8d7da", color: "#842029", padding: 12, borderRadius: 8, border: "1px solid #f5c2c7", margin: "12px 0" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        {TIERS.map((t) => (
          <div key={t.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{t.label}</div>
                <div style={{ opacity: 0.75 }}>{t.display}</div>
              </div>
              <button
                onClick={() => startCheckout({ priceIdEnv: t.priceIdEnv })}
                disabled={creating}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  cursor: creating ? "not-allowed" : "pointer",
                  background: "#000",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {creating ? "Starting…" : "Choose plan"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
        Tip: if you came from Checkout, the URL also includes <code>?editToken=...</code>. We automatically save that for next time.
      </p>
    </div>
  );
}
