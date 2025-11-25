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

  const debugLabel = "DEBUG-PUBLIC-V8";

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

  const badgeClass = {
    active:
      "bg-emerald-500/20 border-emerald-400/40 text-emerald-200",
    soldout:
      "bg-rose-500/20 border-rose-400/40 text-rose-200",
    ended:
      "bg-amber-500/20 border-amber-400/40 text-amber-200",
  };

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
  // TEMP: hard-coded test link so we can see the link UI
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
    maxWidth: "420px",
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
          <header style={{ width: "100%" }}>
            <div style={{ marginBottom: "0.75rem" }}>B</div>

            <div
              style={{
                height: "3.5rem",
                width: "3.5rem",
                borderRadius: "9999px",
                backgroundColor: "#111827",
                border: "1px solid #374151",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                fontWeight: 700,
                margin: "0 auto 0.75rem auto",
              }}
            >
              {avatarInitial}
            </div>

            <h1
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: "0.5rem",
              }}
            >
              {title ? `@${title}` : "Artist"}
            </h1>

            {hasSocialRow && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "0.75rem",
                  fontSize: "1.1rem",
                  marginBottom: "0.75rem",
                }}
              >
                {social.instagram && <span>📸</span>}
                {social.facebook && <span>📘</span>}
                {social.tiktok && <span>🎵</span>}
                {social.youtube && <span>▶️</span>}
                {social.x && <span>✖️</span>}
                {social.website && <span>🌐</span>}
              </div>
            )}

            {bio ? (
              <p
                style={{
                  color: "#d1d5db",
                  fontSize: "0.9rem",
                  marginBottom: "0.5rem",
                }}
              >
                {bio}
              </p>
            ) : null}
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
                      fontSize: "0.9rem",
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
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.9rem",
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
                    fontSize: "0.85rem",
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

          {/* PRODUCTS (NO IMAGE FOR NOW) */}
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
                  slug
                    ? `&slug=${encodeURIComponent(slug)}`
                    : ""
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
          maxWidth: "340px", // cap size on desktop/laptop
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
      fontSize: "0.75rem",
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
      fontSize: "1.1rem",
      fontWeight: 600,
      marginBottom: "0.5rem",
    }}
  >
    {p.title || "Untitled"}
  </h2>
  {st.label ? (
    <div
      style={{
        fontSize: "0.85rem",
        marginBottom: "0.75rem",
        color: st.soldOut || st.ended ? "#fecaca" : "#6ee7b7",
      }}
    >
      {st.label}
    </div>
  ) : null}
  {/* ...rest of card unchanged... */}
</article>

                );
              })}
            </section>
          )}

          
    {/* LINKS */}
{links.length > 0 && (
  <div
    style={{
      marginTop: "24px",
      width: "100%",
      maxWidth: "420px",
      marginLeft: "auto",
      marginRight: "auto",
    }}
  >
    <div
      style={{
        fontSize: "0.9rem",
        fontWeight: 600,
        textAlign: "center",
        marginBottom: "12px",
      }}
    >
      Links
    </div>

    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
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
              padding: "0.9rem 1.1rem",
              borderRadius: "999px",
              background:
                "linear-gradient(135deg, rgba(39,39,42,0.95), rgba(24,24,27,0.95))",
              border: "1px solid #27272a",
              textDecoration: "none",
              color: "#f4f4f5",
              fontSize: "0.95rem",
            }}
          >
            <span>{label}</span>
            <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>↗</span>
          </a>
        );
      })}
    </div>
  </div>
)}

{/* LINKS UNDER DROP CARD */}
{links.length > 0 && (
  <div
    style={{
      marginTop: "24px",
      width: "100%",
      maxWidth: "26rem",
      marginLeft: "auto",
      marginRight: "auto",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
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
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            border: "1px solid #27272a",
            backgroundColor: "rgba(24,24,27,0.85)",
            textDecoration: "none",
            color: "#f9fafb",
            fontSize: "0.95rem",
          }}
        >
          <span>{label}</span>
          <span
            style={{
              fontSize: "0.75rem",
              opacity: 0.6,
            }}
          >
            ↗
          </span>
        </a>
      );
    })}
  </div>
)}

          {/* FOOTER */}
          <footer
            style={{
              fontSize: "0.75rem",
              color: "#737373",
              paddingBottom: "1.5rem",
              width: "100%",
            }}
          >
            <div style={{ marginBottom: "0.25rem" }}>
              Made with <span style={{ fontWeight: 600 }}>Launch6</span>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "0.75rem",
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
