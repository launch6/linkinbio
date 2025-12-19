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

// simple client-side email validator mirroring the API
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const s = email.trim();
  if (!s || s.includes(" ")) return false;
  const at = s.indexOf("@");
  if (at <= 0) return false;
  const dot = s.indexOf(".", at + 2);
  if (dot <= at + 1) return false;
  if (dot >= s.length - 1) return false;
  return true;
}

function formatPriceFromProduct(p) {
  const d = String(p?.priceDisplay || "").trim();
  if (d) return d;
  const t = String(p?.priceText || "").trim();
  if (t) return t;
  const c = typeof p?.priceCents === "number" && Number.isFinite(p.priceCents) ? p.priceCents : null;
  if (c != null) return `$${(c / 100).toFixed(2)}`;
  return "";
}

export default function PublicPage() {
  const [editToken, setEditToken] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [remaining, setRemaining] = useState({}); // { [id]: ms }

  // email capture UI state
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  // invisible honeypot + timing hint
  const [websiteHp, setWebsiteHp] = useState("");
  const formStartTsRef = useRef(Date.now());

  const timerRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  // read URL params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const t = u.searchParams.get("editToken") || "";
    const r = u.searchParams.get("reason") || "";
    setEditToken(t);
    setReason(r);
  }, []);

  // fetch profile + products (no-store; APIs already send no-store headers)
  async function fetchAll(token) {
    const pr = await fetch(`/api/profile/get?editToken=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const pj = await pr.json();
    if (!pj?.ok) throw new Error(pj?.error || "Failed to load profile");

    const r = await fetch(`/api/products?editToken=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    const j = await r.json();
    if (!j?.ok) throw new Error(j?.error || "Failed to load products");

    const onlyPublished = (j.products || []).filter((p) => !!p.published);
    setProfile(pj.profile);
    setProducts(onlyPublished);
  }

  // initial fetch + periodic refresh + on-focus refresh
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
        await fetchAll(editToken);
        if (!alive) return;
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    refreshIntervalRef.current = setInterval(() => {
      fetchAll(editToken).catch(() => {});
    }, 15000);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchAll(editToken).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      document.removeEventListener("visibilitychange", onVis);
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
        next[p.id] = endsMs ? Math.max(0, endsMs - now) : null;
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
    const rem = remaining[p.id]; // ms or null
    const ended = rem === 0;
    const soldOut = left !== null && left <= 0;

    if (soldOut) return { key: "soldout", label: "Sold out", ended: false, soldOut: true };
    if (rem === null && total !== null && left !== null) {
      return { key: "active", label: `${left}/${total} left`, ended: false, soldOut: false };
    }
    if (rem === null) {
      return { key: "active", label: "", ended: false, soldOut: false };
    }
    if (ended) return { key: "ended", label: "Drop ended", ended: true, soldOut: false };

    const base = `Ends in ${formatRemaining(rem)}`;
    if (total !== null && left !== null) {
      return { key: "active", label: `${left}/${total} left — ${base}`, ended: false, soldOut: false };
    }
    return { key: "active", label: base, ended: false, soldOut: false };
  }

  function humanReason(r) {
    switch ((r || "").toLowerCase()) {
      case "expired":
        return "This drop has ended.";
      case "soldout":
        return "This item is sold out.";
      case "unpublished":
        return "This product isn’t available right now.";
      case "noprice":
        return "This product doesn’t have a checkout set yet.";
      default:
        return "";
    }
  }

  // Badge styles by state
  const badgeClass = {
    active: "bg-emerald-500/20 border-emerald-400/40 text-emerald-200",
    soldout: "bg-rose-500/20 border-rose-400/40 text-rose-200",
    ended: "bg-amber-500/20 border-amber-400/40 text-amber-200",
  };

  // handle email submit
  async function handleSubscribe(e) {
    e.preventDefault();
    setEmailErr("");

    if (!isValidEmail(email)) {
      setEmailErr("Please enter a valid email (e.g., name@example.com).");
      return;
    }

    try {
      setSubmitting(true);

      const resp = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editToken,
          email,
          ref: typeof window !== "undefined" ? window.location.href : "",
          website: websiteHp,
          formTs: formStartTsRef.current,
        }),
      });

      const json = await resp.json().catch(() => ({}));

      if (!resp.ok || !json?.ok) {
        if (json?.error === "email_collection_disabled") {
          setEmailErr("Email signup is unavailable right now.");
        } else if (json?.error === "invalid_email") {
          setEmailErr("Please enter a valid email.");
        } else {
          setEmailErr("Subscribe failed. Please try again.");
        }
        return;
      }

      setSubscribed(true);
    } catch {
      setEmailErr("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = profile?.displayName || profile?.name || "Artist";
  const bio = profile?.bio || profile?.description || "";
  const reasonText = humanReason(reason);
  const canCollectEmail = !!profile?.collectEmail;

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

        {/* Email capture (only if enabled) */}
        {canCollectEmail && (
          <div className="mb-8 rounded-2xl border border-neutral-800 p-5">
            <div className="text-lg font-semibold mb-2">Get first dibs on drops</div>

            {!subscribed ? (
              <form
                onSubmit={handleSubscribe}
                className="flex flex-col sm:flex-row gap-3 items-stretch"
              >
                {/* Honeypot (invisible) */}
                <input
                  type="text"
                  name="website"
                  value={websiteHp}
                  onChange={(e) => setWebsiteHp(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: "-10000px",
                    top: "auto",
                    width: "1px",
                    height: "1px",
                    overflow: "hidden",
                  }}
                />

                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="flex-1 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailErr) setEmailErr("");
                  }}
                  aria-invalid={!!emailErr}
                  aria-describedby={emailErr ? "email-error" : undefined}
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg border border-emerald-600 px-4 py-2 hover:bg-emerald-900/20 disabled:opacity-60"
                >
                  {submitting ? "Joining…" : "Join"}
                </button>
              </form>
            ) : (
              <div className="rounded-lg border border-emerald-600/40 bg-emerald-900/20 text-emerald-200 px-3 py-2 text-sm">
                You’re in! We’ll let you know about new drops.
              </div>
            )}

            {emailErr ? (
              <div id="email-error" className="mt-2 text-sm text-rose-300">
                {emailErr}
              </div>
            ) : null}

            <div className="mt-2 text-xs text-neutral-500">
              We’ll only email you about releases. Unsubscribe anytime.
            </div>
          </div>
        )}

        {/* Products */}
        {products.length === 0 ? (
          <div className="opacity-70">No products are published yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {products.map((p) => {
              const st = productStatus(p);

              // Buy is intentionally disabled while /api/products/buy is being fixed
              const showBuy = !st.ended && !st.soldOut && !!p.priceUrl;

              const priceLabel = formatPriceFromProduct(p);

              return (
                <article
                  key={p.id}
                  className="relative rounded-2xl border border-neutral-800 overflow-hidden"
                  aria-labelledby={`prod-${p.id}-title`}
                >
                  {/* Image with corner ribbon */}
                  <div className="relative">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.title || "Product image"}
                        className="w-full aspect-[4/3] object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full aspect-[4/3] bg-neutral-900" />
                    )}

                    {/* Corner ribbon */}
                    <div className="absolute left-3 top-3">
                      <span
                        className={
                          "inline-block rounded-md border px-2 py-1 text-xs font-medium shadow-sm " +
                          (badgeClass[st.key] || badgeClass.active)
                        }
                        aria-live="polite"
                      >
                        {st.soldOut ? "Sold out" : st.ended ? "Drop ended" : st.label || "Live"}
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h2 id={`prod-${p.id}-title`} className="text-xl font-semibold mb-1">
                      {p.title || "Untitled"}
                    </h2>

                    {/* Price */}
                    {priceLabel ? (
                      <div className="text-base font-semibold text-white mb-2">{priceLabel}</div>
                    ) : (
                      <div className="text-sm text-neutral-400 mb-2">Price not set</div>
                    )}

                    {/* Status line (secondary) */}
                    {st.label ? (
                      <div
                        className={
                          "text-sm mb-3 " +
                          (st.soldOut || st.ended ? "text-rose-300" : "text-emerald-300")
                        }
                      >
                        {st.label}
                      </div>
                    ) : null}

{showBuy ? (
  <a
    href={buyHref}
    className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-2 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
    aria-label={`Buy ${p.title || "this product"}`}
  >
    {p.buttonText || "Buy Now"}
    <span className="text-xs opacity-70">→</span>
  </a>
) : (
  <div
    className="inline-flex items-center rounded-xl border border-neutral-800 px-4 py-2 text-neutral-400"
    aria-disabled="true"
    role="button"
    tabIndex={-1}
  >
    {st.soldOut ? "Sold out" : st.ended ? "Drop ended" : "Checkout coming soon"}
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
