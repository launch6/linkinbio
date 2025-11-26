// pages/[slug].js
import Head from "next/head";
import { useRouter } from "next/router";
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

// simple client-side email validator (matches API)
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

// Small inline SVG icons for socials
function SocialIcon({ type }) {
  // bigger frame, same 24x24 drawing space so icons actually scale up
  const size = 28;
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (type === "instagram") {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17" cy="7" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (type === "facebook") {
    return (
      <svg {...common}>
        <path d="M14 8h2V4h-2a4 4 0 0 0-4 4v2H8v4h2v6h4v-6h2v-4h-2V8a1 1 0 0 1 1-1z" />
      </svg>
    );
  }

  if (type === "tiktok") {
    return (
      <svg {...common}>
        <path d="M15 5c.4 1.3 1.4 2.3 2.7 2.7L19 8.1V11c-1 0-2-.3-3-.9v3.2a5 5 0 1 1-4.5-5V10a2.1 2.1 0 0 0-1.5-.1A2 2 0 1 0 13 12V5h2z" />
      </svg>
    );
  }

  if (type === "youtube") {
    return (
      <svg {...common} fill="currentColor" stroke="none">
        <path d="M21.8 8.3a2 2 0 0 0-1.4-1.4C19 6.5 12 6.5 12 6.5s-7 0-8.4.4A2 2 0 0 0 2.2 8.3C1.8 9.7 1.8 12 1.8 12s0 2.3.4 3.7a2 2 0 0 0 1.4 1.4c1.4.4 8.4.4 8.4.4s7 0 8.4-.4a2 2 0 0 0 1.4-1.4c.4-1.4.4-3.7.4-3.7s0-2.3-.4-3.7zM10.5 14.7V9.3L15 12l-4.5 2.7z" />
      </svg>
    );
  }

  if (type === "x") {
    return (
      <svg {...common}>
        <path d="M6 5l5.2 6.1L6 19h2.2L12 12.9 15.8 19H18l-5.2-7.9L18 5h-2.2L12 10.1 8.2 5H6z" />
      </svg>
    );
  }

  if (type === "website") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a12 12 0 0 1 3 9 12 12 0 0 1-3 9 12 12 0 0 1-3-9 12 12 0 0 1 3-9z" />
      </svg>
    );
  }

  return null;
}

export default function PublicSlugPage() {
  const router = useRouter();
  const { slug } = router.query;

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

  const timerRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  const debugLabel = "DEBUG-PUBLIC-V11";

  // fetch public profile + products via slug (robust JSON guard)
  async function fetchAll(slugVal) {
    const url = `/api/public?slug=${encodeURIComponent(slugVal)}`;
    const r = await fetch(url, { cache: "no-store" });

    const ct = (r.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      const text = await r.text().catch(() => "");
      throw new Error(text ? "Upstream not JSON" : "Failed to load");
    }

    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.ok) {
      throw new Error(j?.error || "Failed to load");
    }

    setProfile(j.profile || null);
    setProducts(
      Array.isArray(j.products)
        ? j.products.filter((p) => !!p.published)
        : []
    );
  }

  // initial + periodic refresh
  useEffect(() => {
    if (!slug) return;
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        await fetchAll(slug);
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
      fetchAll(slug).catch(() => {});
    }, 15000);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchAll(slug).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [slug]);

  // track page_view (slug-based)
  useEffect(() => {
    if (!slug) return;
    try {
      const payload = {
        type: "page_view",
        ts: Date.now(),
        ref:
          typeof window !== "undefined"
            ? window.location.href
            : "",
        publicSlug: slug,
      };
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/track", blob);
    } catch {}
  }, [slug]);

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

  // status builder that respects flags
  function productStatus(p) {
    const left = toNumberOrNull(p.unitsLeft);
    const total = toNumberOrNull(p.unitsTotal);
    const rem = remaining[p.id]; // ms or null
       const ended = rem === 0;
    const soldOut = left !== null && left <= 0;

    if (soldOut)
      return {
        key: "soldout",
        label: "Sold out",
        ended: false,
        soldOut: true,
      };
    if (ended)
      return {
        key: "ended",
        label: "Drop ended",
        ended: true,
        soldOut: false,
      };

    const parts = [];

    // only show X/Y when showInventory is true and both numbers exist
    if (p.showInventory && total !== null && left !== null) {
      parts.push(`${left}/${total} left`);
    }

    // only show countdown when showTimer is true and timer exists
    if (p.showTimer && rem !== null) {
      parts.push(`Ends in ${formatRemaining(rem)}`);
    }

    return {
      key: "active",
      label: parts.join(" — "),
      ended: false,
      soldOut: false,
    };
  }

  // handle slug-based subscribe
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
          publicSlug: slug,
          email,
          ref:
            typeof window !== "undefined"
              ? window.location.href
              : "",
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        if (json?.error === "email_collection_disabled") {
          setEmailErr("Email signup is unavailable right now.");
        } else if (json?.error === "invalid_email") {
          setEmailErr("Please enter a valid email.");
        } else if (json?.error === "profile_not_found") {
          setEmailErr("Creator not found.");
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
  const canCollectEmail = !!profile?.collectEmail;

  const links = Array.isArray(profile?.links)
    ? profile.links.filter(
        (l) =>
          l &&
          typeof l.url === "string" &&
          l.url.trim().length > 0
      )
    : [];

  // TEMP: hard-coded test link so we can see link UI
  links.push({
    id: "test-link",
    label: "Backyards of Key West Shop",
    url: "https://backyardsofkeywest.com",
  });

  const social = profile?.social || {};
  const hasSocialRow =
    social.instagram ||
    social.facebook ||
    social.tiktok ||
    social.youtube ||
    social.x ||
    social.website;

  // --- SEO / Social ---
  const firstImage = products?.[0]?.imageUrl || "";
  const site = "https://linkinbio-tau-pink.vercel.app";
  const pageUrl = slug ? `${site}/${encodeURIComponent(slug)}` : site;
  const seoTitle = title ? `${title} — Drops` : "Drops";
  const left0 = toNumberOrNull(products?.[0]?.unitsLeft);
  const total0 = toNumberOrNull(products?.[0]?.unitsTotal);
  const leftPart =
    products?.[0]?.showInventory && left0 != null && total0 != null
      ? ` • ${left0}/${total0} left`
      : "";
  const seoDesc =
    (products?.[0]?.title
      ? `${products[0].title}${leftPart}`
      : "Limited releases and timed drops.") +
    (bio ? ` — ${bio}` : "");

  const avatarInitial =
    (title && title.trim().charAt(0).toUpperCase()) || "L";

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

  // INLINE STYLES to force centering no matter what global CSS does
  
  const mainStyle = {
  maxWidth: "500px",        // wider like Linktree
  margin: "0 auto",
  padding: "2.5rem 1.5rem",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  gap: "2rem",
  alignItems: "center",
};

  const fullWidthSection = {
    width: "100%",
  };

  return (
    <>
      <Head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
        <meta
          name="robots"
          content="index,follow,max-image-preview:large"
        />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDesc} />
        {firstImage ? (
          <meta property="og:image" content={firstImage} />
        ) : null}

        {/* Twitter */}
        <meta
          name="twitter:card"
          content={firstImage ? "summary_large_image" : "summary"}
        />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDesc} />
        {firstImage ? (
          <meta name="twitter:image" content={firstImage} />
        ) : null}
        <link rel="canonical" href={pageUrl} />
      </Head>

      <div className="min-h-screen bg-neutral-950 text-white">
        {/* DEBUG MARKER */}
        <div
          style={{
            position: "fixed",
            top: 4,
            left: 4,
            fontSize: 12,
            opacity: 0.7,
            pointerEvents: "none",
            zIndex: 50,
          }}
        >
          {debugLabel}
        </div>

        <main style={mainStyle}>
          {/* HEADER */}
          <header
            style={{
              width: "100%",
              marginBottom: "0.75rem",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "32rem",
                margin: "0 auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: "0.85rem",
              }}
            >
              {/* Avatar */}
              <div>
                <div
                  style={{
                    height: "3.5rem",
                    width: "3.5rem",
                    borderRadius: "999px",
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: "1.4rem",
                  }}
                >
                  {avatarInitial}
                </div>
              </div>

              {/* Handle */}
              <h1
                style={{
                  fontSize: "1.7rem",
                  lineHeight: 1.2,
                  fontWeight: 700,
                }}
              >
                {title ? `@${title}` : "Artist"}
              </h1>

                         {/* Social icons */}
              {hasSocialRow && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "0.75rem",
                  }}
                >
                  {social.instagram && (
                    <a
                      href={social.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      style={{
  height: "2.8rem",
  width: "2.8rem",
  borderRadius: "999px",
  border: "1px solid #27272a",
  backgroundColor: "rgba(24,24,27,0.9)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#f9fafb",
  textDecoration: "none",
}}

                    >
                      <SocialIcon type="instagram" />
                    </a>
                  )}
                  {social.facebook && (
                    <a
                      href={social.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                      style={{
                        height: "2.4rem",
                        width: "2.4rem",
                        borderRadius: "999px",
                        border: "1px solid #27272a",
                        backgroundColor: "rgba(24,24,27,0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#f9fafb",
                        textDecoration: "none",
                      }}
                    >
                      <SocialIcon type="facebook" />
                    </a>
                  )}
                  {social.tiktok && (
                    <a
                      href={social.tiktok}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="TikTok"
                      style={{
                        height: "2.4rem",
                        width: "2.4rem",
                        borderRadius: "999px",
                        border: "1px solid #27272a",
                        backgroundColor: "rgba(24,24,27,0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#f9fafb",
                        textDecoration: "none",
                      }}
                    >
                      <SocialIcon type="tiktok" />
                    </a>
                  )}
                  {social.youtube && (
                    <a
                      href={social.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="YouTube"
                      style={{
                        height: "2.4rem",
                        width: "2.4rem",
                        borderRadius: "999px",
                        border: "1px solid #27272a",
                        backgroundColor: "rgba(24,24,27,0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#f9fafb",
                        textDecoration: "none",
                      }}
                    >
                      <SocialIcon type="youtube" />
                    </a>
                  )}
                  {social.x && (
                    <a
                      href={social.x}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="X"
                      style={{
                        height: "2.4rem",
                        width: "2.4rem",
                        borderRadius: "999px",
                        border: "1px solid #27272a",
                        backgroundColor: "rgba(24,24,27,0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#f9fafb",
                        textDecoration: "none",
                      }}
                    >
                      <SocialIcon type="x" />
                    </a>
                  )}
                  {social.website && (
                    <a
                      href={social.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Website"
                      style={{
                        height: "2.4rem",
                        width: "2.4rem",
                        borderRadius: "999px",
                        border: "1px solid #27272a",
                        backgroundColor: "rgba(24,24,27,0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#f9fafb",
                        textDecoration: "none",
                      }}
                    >
                      <SocialIcon type="website" />
                    </a>
                  )}
                </div>
              )}
              
            {bio ? (
  <p
    style={{
      color: "#e5e7eb",
      fontSize: "1rem",
      lineHeight: 1.5,
      margin: "1.25rem 0 1.25rem", // equal space above & below
    }}
  >
    {bio}
  </p>
) : null}
            </div>
          </header>

          {/* EMAIL CAPTURE */}
          {canCollectEmail && (
            <section
              style={{
                ...fullWidthSection,
                borderRadius: "1rem",
                border: "1px solid #27272a",
                padding: "1.25rem",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontSize: "1.05rem",
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                }}
              >
                Get first dibs on drops
              </div>
              {!subscribed ? (
                <form
                  onSubmit={handleSubscribe}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    style={{
                      borderRadius: "0.5rem",
                      backgroundColor: "#020617",
                      border: "1px solid #3f3f46",
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.95rem",
                      color: "white",
                    }}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailErr) setEmailErr("");
                    }}
                    aria-invalid={!!emailErr}
                    aria-describedby={
                      emailErr ? "email-error" : undefined
                    }
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      borderRadius: "0.5rem",
                      border: "1px solid #059669",
                      padding: "0.55rem 0.9rem",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                      color: "white",
                      cursor: "pointer",
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? "Joining…" : "Join"}
                  </button>
                </form>
              ) : (
                <div
                  style={{
                    borderRadius: "0.5rem",
                    border: "1px solid rgba(16,185,129,0.5)",
                    backgroundColor: "rgba(6,95,70,0.3)",
                    padding: "0.5rem 0.75rem",
                    fontSize: "0.9rem",
                    color: "#a7f3d0",
                  }}
                >
                  You’re in! We’ll let you know about new drops.
                </div>
              )}
              {emailErr ? (
                <div
                  id="email-error"
                  style={{
                    marginTop: "0.35rem",
                    fontSize: "0.8rem",
                    color: "#fecaca",
                  }}
                >
                  {emailErr}
                </div>
              ) : null}
              <div
                style={{
                  marginTop: "0.35rem",
                  fontSize: "0.75rem",
                  color: "#737373",
                }}
              >
                We’ll only email you about releases. Unsubscribe anytime.
              </div>
            </section>
          )}

          {/* PRODUCTS */}
          {products.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No products are published yet.</div>
          ) : (
            <section style={fullWidthSection}>
              {products.map((p) => {
                const st = productStatus(p);
                const showBuy =
                  !st.ended && !st.soldOut && !!p.priceUrl;
                const buyHref = `/api/products/buy?productId=${encodeURIComponent(
                  p.id
                )}${
                  slug ? `&slug=${encodeURIComponent(slug)}` : ""
                }`;

                return (
                  <article
                    key={p.id}
                    style={{
                      borderRadius: "1rem",
                      border: "1px solid #27272a",
                      backgroundColor: "rgba(24,24,27,0.85)",
                      padding: "1.25rem",
                      marginBottom: "1.5rem",
                    }}
                    aria-labelledby={`prod-${p.id}-title`}
                  >
                    {/* HERO IMAGE – centered & capped */}
                    {p.imageUrl && (
                      <div
                        style={{
                          width: "100%",
                          marginBottom: "1rem",
                          display: "flex",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            maxWidth: "460px",
                            borderRadius: "0.75rem",
                            overflow: "hidden",
                            backgroundColor: "#09090b",
                          }}
                        >
                          <img
                            src={p.imageUrl}
                            alt={p.title || "Product image"}
                            loading="lazy"
                            style={{
                              width: "100%",
                              height: "auto",
                              display: "block",
                              objectFit: "cover",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#a3a3a3",
                        marginBottom: "0.35rem",
                      }}
                    >
                      Drop
                    </div>
                    <h2
                      id={`prod-${p.id}-title`}
                      style={{
                        fontSize: "1.15rem",
                        fontWeight: 600,
                        marginBottom: "0.5rem",
                      }}
                    >
                      {p.title || "Untitled"}
                    </h2>

                    {st.label ? (
                      <div
                        style={{
                          fontSize: "0.9rem",
                          marginBottom: "0.75rem",
                          color:
                            st.soldOut || st.ended
                              ? "#fecaca"
                              : "#6ee7b7",
                        }}
                      >
                        {st.label}
                      </div>
                    ) : null}

                    {p.description ? (
                      <p
                        style={{
                          fontSize: "0.9rem",
                          color: "#e5e5e5",
                          marginBottom: showBuy ? "0.9rem" : 0,
                        }}
                      >
                        {p.description}
                      </p>
                    ) : null}

                    {showBuy && (
                      <a
                        href={buyHref}
                        style={{
                          marginTop: "0.25rem",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0.7rem 1.1rem",
                          borderRadius: "999px",
                          border: "1px solid #f97316",
                          background:
                            "linear-gradient(135deg, #f97316, #ea580c)",
                          color: "#020617",
                          fontSize: "0.95rem",
                          fontWeight: 600,
                          textDecoration: "none",
                          width: "100%",
                        }}
                      >
                        View drop
                      </a>
                    )}
                  </article>
                );
              })}
            </section>
          )}

          {/* LINKS (below drop card) */}
          {links.length > 0 && (
            <section
              style={{
                width: "100%",
                marginTop: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {links.map((l) => {
                  const label = l.label || l.url || "Link";
                  return (
                    <a
                      key={l.id || l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.95rem 1.2rem",
                        borderRadius: "999px",
                        background:
                          "linear-gradient(135deg, rgba(39,39,42,0.98), rgba(24,24,27,0.98))",
                        border: "1px solid #27272a",
                        textDecoration: "none",
                        color: "#f4f4f5",
                        fontSize: "0.98rem",
                      }}
                    >
                      <span>{label}</span>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          opacity: 0.6,
                        }}
                      >
                        ↗
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* FOOTER */}
         <footer
  style={{
    fontSize: "0.9rem",
    color: "#a3a3a3",
    paddingBottom: "2.25rem",
    width: "100%",
    marginTop: "2rem",
  }}
>
  <div
    style={{
      margin: "1.25rem 0", // equal space above & below this line
      lineHeight: 1.4,
      textAlign: "center",
    }}
  >
    Join{" "}
    <a
      href="https://launch6.com"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontWeight: 600,
        textDecoration: "underline",
        textUnderlineOffset: "2px",
        color: "#e5e5e5",
      }}
    >
      Launch6
    </a>{" "}
    to create your own artist drops.
  </div>

  <div
    style={{
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: "0.9rem",
    }}
  >
    <button style={{ textDecoration: "underline" }}>
      Cookie preferences
    </button>
    <button style={{ textDecoration: "underline" }}>
      Report page
    </button>
    <button style={{ textDecoration: "underline" }}>
      Privacy
    </button>
  </div>
</footer>
        </main>
      </div>
    </>
  );
}

export async function getServerSideProps() {
  // Force SSR so any slug resolves at request time.
  return { props: {} };
}
