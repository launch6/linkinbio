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
  const common = {
    width: 40,
    height: 40,
    viewBox: "0 0 28 28",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (type === "instagram") {
    return (
      <svg {...common}>
        <rect x="5" y="5" width="18" height="18" rx="6" />
        <circle cx="14" cy="14" r="4.2" />
        <circle cx="19" cy="9" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (type === "facebook") {
    return (
      <svg {...common}>
        <path d="M16 9h2.5V5.5H16a4.5 4.5 0 0 0-4.5 4.5v2H9v3.5h2.5V23h3.5v-7h2.5V12h-2.5v-2.5A1.5 1.5 0 0 1 16 9z" />
      </svg>
    );
  }

  if (type === "tiktok") {
    return (
      <svg {...common}>
        <path d="M17 6c.5 1.6 1.7 2.7 3.3 3.1L21 9.3V12c-1.3 0-2.6-.4-3.7-1.1v3.8a5.2 5.2 0 1 1-4.7-5.2V11a2.2 2.2 0 0 0-1.7-.2 2.1 2.1 0 1 0 2.2 2.1V6h3z" />
      </svg>
    );
  }

  if (type === "youtube") {
    return (
      <svg {...common} fill="currentColor" stroke="none">
        <path d="M23.2 9.4a2.2 2.2 0 0 0-1.5-1.6C20.2 7.4 14 7.4 14 7.4s-6.2 0-7.7.4a2.2 2.2 0 0 0-1.5 1.6C4.4 11 4.4 14 4.4 14s0 3 .4 4.6a2.2 2.2 0 0 0 1.5 1.6c1.5.4 7.7.4 7.7.4s6.2 0 7.7-.4a2.2 2.2 0 0 0 1.5-1.6c.4-1.6.4-4.6.4-4.6s0-3-.4-4.6zM12.7 16.5v-5L17.3 14l-4.6 2.5z" />
      </svg>
    );
  }

  if (type === "x") {
    return (
      <svg {...common}>
        <path d="M7 6l6 7.1L7 22h2.6l4.4-6 4.4 6H21l-6-8.9L21 6h-2.6l-4 5.5L10.4 6H7z" />
      </svg>
    );
  }

  if (type === "website") {
    return (
      <svg {...common}>
        <circle cx="14" cy="14" r="9.5" />
        <path d="M4.5 14h19" />
        <path d="M14 4.5a14 14 0 0 1 3.5 9.5 14 14 0 0 1-3.5 9.5A14 14 0 0 1 10.5 14 14 14 0 0 1 14 4.5z" />
      </svg>
    );
  }

  return null;
}
function DropCard({ product: p, slug }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // --- basic fields -------------------------------------------------------
  const imageUrl = p.imageUrl || null;
  const title = p.title || "Untitled drop";
  const description = p.description || "";

  // price display: try a few common fields
  let priceDisplay =
    p.priceDisplay ||
    p.priceFormatted ||
    p.priceText ||
    (typeof p.priceCents === "number"
      ? `$${(p.priceCents / 100).toFixed(2)}`
      : null);

  const buttonText = p.buttonText || "Buy Now";

  const buyHref = `/api/products/buy?productId=${encodeURIComponent(
    p.id
  )}${slug ? `&slug=${encodeURIComponent(slug)}` : ""}`;

  // --- inventory / ended logic -------------------------------------------
  const left =
    p.unitsLeft === null || p.unitsLeft === undefined
      ? null
      : Number(p.unitsLeft);
  const total =
    p.unitsTotal === null || p.unitsTotal === undefined
      ? null
      : Number(p.unitsTotal);

  const soldOut = left !== null && left <= 0;

  const startsAt = p.dropStartsAt ? new Date(p.dropStartsAt) : null;
  const endsAt = p.dropEndsAt ? new Date(p.dropEndsAt) : null;

  let phase = "open"; // "upcoming" | "open" | "ended"
  if (startsAt && now < startsAt) {
    phase = "upcoming";
  } else if (endsAt && now >= endsAt) {
    phase = "ended";
  }

  const isEnded = soldOut || phase === "ended";

  // --- countdown (hours : minutes : seconds) ------------------------------
  let showTimer = false;
  let timerTitle = "";
  let h = "00",
    m = "00",
    s = "00";

  if (p.showTimer && (startsAt || endsAt)) {
    let target = null;

    if (phase === "upcoming" && startsAt) {
      timerTitle = "Drop starts in";
      target = startsAt;
    } else if (phase === "open" && endsAt) {
      timerTitle = "Drop ends in";
      target = endsAt;
    } else if (phase === "ended") {
      timerTitle = "Drop closed";
    }

    if (target) {
      const diffMs = target.getTime() - now.getTime();
      if (diffMs > 0) {
        showTimer = true;
        const totalSeconds = Math.floor(diffMs / 1000);
        const hh = Math.floor(totalSeconds / 3600);
        const mm = Math.floor((totalSeconds % 3600) / 60);
        const ss = totalSeconds % 60;
        h = String(hh).padStart(2, "0");
        m = String(mm).padStart(2, "0");
        s = String(ss).padStart(2, "0");
      }
    }
  }

  // inventory text (optional, under price)
  let inventoryText = "";
  if (p.showInventory && left !== null && total !== null) {
    inventoryText = `${left}/${total} available`;
  }

  // --- styles -------------------------------------------------------------
  const outer = {
    width: "100%",
    maxWidth: "420px",
    margin: "0 auto 1.5rem",
    borderRadius: "28px",
    padding: "20px 18px 22px",
    background:
      "radial-gradient(circle at top, #191b2b 0%, #050509 60%, #020206 100%)",
    boxShadow:
      "0 20px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)",
  };

  const heroFrame = {
    borderRadius: "24px",
    padding: "3px",
    background:
    "radial-gradient(circle at top, #6366ff 0%, #a855f7 40%, #101020 100%)",
    boxShadow:
      "0 14px 40px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.7)",
  };

  const heroInner = {
  borderRadius: "20px",
  background: "#0b0c15",
  overflow: "hidden",
  width: "100%",
  position: "relative",

  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0",
  textAlign: "center",
  lineHeight: 0,
};

const heroImg = {
  width: "100%",
  height: "auto",
  maxHeight: "60vh",
  objectFit: "contain",
  objectPosition: "center",
  display: "block",
  margin: "0 auto",
};


  const heroPlaceholder = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9ca3af",
    fontSize: "1rem",
  };

  const body = {
    padding: "18px 10px 0",
    textAlign: "center",
  };

  const titleStyle = {
    fontSize: "1.4rem",
    fontWeight: 700,
    margin: "0 0 0.25rem",
  };

  const priceStyle = {
    fontSize: "1.2rem",
    fontWeight: 700,
    margin: "0 0 0.2rem",
    backgroundImage: "linear-gradient(90deg,#a855f7,#6366ff)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };

  const inventoryStyle = {
    fontSize: "0.8rem",
    color: "#9ca3af",
    margin: "0 0 0.8rem",
  };

  const descStyle = {
    fontSize: "0.9rem",
    lineHeight: 1.6,
    color: "#e5e7eb",
    margin: "0 0 1rem",
  };

  const timerCard = {
    borderRadius: "18px",
    border: "1px solid rgba(148,163,184,0.4)",
    background: "#0b0c17",
    padding: "10px 14px 12px",
    margin: "0 0 1.05rem",
  };

  const timerLabel = {
    fontSize: "0.68rem",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "#9ca3af",
    margin: "0 0 6px",
  };

  const timerValues = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "2px",
  };

  const timerValue = {
    fontSize: "1.35rem",
    fontWeight: 600,
  };

  const timerSeparator = {
    fontSize: "1.25rem",
    color: "#6366ff",
    transform: "translateY(-1px)",
  };

  const timerUnits = {
    fontSize: "0.7rem",
    color: "#9ca3af",
    margin: 0,
  };

  const buttonBase = {
    width: "100%",
    borderRadius: "999px",
    padding: "0.8rem 1.1rem",
    fontSize: "0.98rem",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "0.1rem",
    transition: "transform 0.08s ease, boxShadow 0.08s ease, opacity 0.12s",
  };

  const buttonActive = {
    ...buttonBase,
    backgroundImage: "linear-gradient(90deg,#6366ff,#a855f7)",
    color: "#fff",
    boxShadow: "0 14px 36px rgba(79,70,229,0.65)",
  };

  const buttonDisabled = {
    ...buttonBase,
    backgroundImage: "linear-gradient(90deg,#374151,#1f2937)",
    color: "#9ca3af",
    boxShadow: "none",
    cursor: "default",
    opacity: 0.7,
  };

  // -----------------------------------------------------------------
  return (
    <article style={outer}>
      {/* hero */}
      <div style={heroFrame}>
        <div style={heroInner}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              style={heroImg}
              loading="lazy"
            />
          ) : (
            <div style={heroPlaceholder}>
              <span>Drop artwork</span>
            </div>
          )}
        </div>
      </div>

      {/* body */}
      <div style={body}>
        <h2 style={titleStyle}>{title}</h2>

        {priceDisplay && <p style={priceStyle}>{priceDisplay}</p>}

        {inventoryText && (
          <p style={inventoryStyle}>{inventoryText}</p>
        )}

        {description && <p style={descStyle}>{description}</p>}

        {(timerTitle || showTimer) && (
          <div style={timerCard}>
            {timerTitle && (
              <p style={timerLabel}>{timerTitle}</p>
            )}

            {showTimer && (
              <>
                <div style={timerValues}>
                  <span style={timerValue}>{h}</span>
                  <span style={timerSeparator}>:</span>
                  <span style={timerValue}>{m}</span>
                  <span style={timerSeparator}>:</span>
                  <span style={timerValue}>{s}</span>
                </div>
                <p style={timerUnits}>
                  Hours · Minutes · Seconds
                </p>
              </>
            )}
          </div>
        )}

        {/* primary button */}
        {isEnded || !p.priceUrl ? (
          <button type="button" style={buttonDisabled} disabled>
            Drop ended
          </button>
        ) : (
          <a href={buyHref} style={buttonActive}>
            {buttonText}
          </a>
        )}
      </div>
    </article>
  );
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

    if (p.showInventory && total !== null && left !== null) {
      parts.push(`${left}/${total} left`);
    }

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

    const social = profile?.social || {};

  // Ensure website link is always absolute
  // Rules:
  // - If user typed http:// or https://, keep it as-is
  // - If they typed a bare domain (mysite.com), prepend http://
  const normalizeHref = (url) => {
    if (!url) return "";
    const trimmed = url.trim();
    if (!trimmed) return "";

    // If user typed http:// or https://, respect it
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // No protocol → assume http:// (their server/Cloudflare/etc. can upgrade to https)
    return `http://${trimmed}`;
  };

  const websiteHref = normalizeHref(social.website);

  const hasSocialRow =
    social.instagram ||
    social.facebook ||
    social.tiktok ||
    social.youtube ||
    social.x ||
    websiteHref;


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

      const avatarUrl =
  profile?.avatarUrl || profile?.imageUrl || profile?.avatar || null;

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

    // Layout: single column, Linktree-style
  const mainStyle = {
    maxWidth: "500px",
    margin: "0 auto",
    padding: "2.3rem 1.5rem 2.5rem", // slightly tighter top + bottom
    textAlign: "center",
  };

  const fullWidthSection = {
    width: "100%",
  };

  // vertical rhythm
  const SECTION_GAP = "1.35rem";        // header↔drop and drop↔links
  const HEADER_STACK_SPACING = "0.8rem"; // avatar↔handle↔bio↔socials

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
        <main style={mainStyle}>
          
                {/* HEADER */}
          <header
            style={{
              width: "100%",
              marginBottom: SECTION_GAP,
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
              }}
            >
                            {/* Avatar */}
              <div
                style={{
                  marginBottom: HEADER_STACK_SPACING,
                }}
              >
                {avatarUrl ? (
  <img
    src={avatarUrl}
    alt={title || "Avatar"}
    style={{
      height: "7rem",
      width: "7rem",
      borderRadius: "999px",
      objectFit: "cover",
      border: "1px solid #27272a",
      display: "block",
    }}
  />
) : (
  <div
    style={{
      height: "6.5rem",
      width: "6.5rem",
      borderRadius: "999px",
      backgroundColor: "#18181b",
      border: "1px solid #27272a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 600,
      fontSize: "2.2rem",
    }}
  >
    {avatarInitial}
  </div>
)}

              </div>

              {/* Handle (@backyards) */}
<h1
  style={{
    fontSize: "1.7rem",
    lineHeight: 1.2,
    fontWeight: 700,
    margin: `0 0 ${HEADER_STACK_SPACING}`, // equal gap below, no top margin
  }}
>
  {title || "Artist"}
</h1>


  {/* Description */}
{bio ? (
  <p
    style={{
      color: "#e5e7eb",
      fontSize: "1rem",
      lineHeight: 1.5,
      margin: `0 0 ${HEADER_STACK_SPACING}`,
      whiteSpace: "pre-line", // preserve line breaks
    }}
  >
    {bio}
  </p>
) : null}

              {/* Social icons */}
              {hasSocialRow && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    gap: "0.9rem",
                  }}
                >
                  {social.instagram && (
                    <a
                      href={social.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      style={{
                        height: "4rem",
                        width: "4rem",
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
                        height: "4rem",
                        width: "4rem",
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
                        height: "4rem",
                        width: "4rem",
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
                        height: "4rem",
                        width: "4rem",
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
                        height: "4rem",
                        width: "4rem",
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
                 {websiteHref && (
  <a
    href={websiteHref}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Website"
    style={{
      height: "4rem",
      width: "4rem",
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
            </div>
          </header>


          {/* EMAIL CAPTURE (optional, still full-width) */}
          {canCollectEmail && (
            <section
              style={{
                ...fullWidthSection,
                borderRadius: "1rem",
                border: "1px solid #27272a",
                padding: "1.25rem",
                textAlign: "left",
                marginBottom: SECTION_GAP,
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

          {/* PRODUCTS / DROP CARD */}
          {products.length === 0 ? (
            <></>
          ) : (
            <section
              style={{
                ...fullWidthSection,
                marginBottom: SECTION_GAP,
              }}
            >
              {products.map((p) => (
                <DropCard key={p.id} product={p} slug={slug} />
              ))}
            </section>
          )}


          {/* LINKS (below drop card OR directly after header if no products) */}
          {links.length > 0 && (
            <section
              style={{
                width: "100%",
                marginTop: products.length === 0 ? SECTION_GAP : 0,
                marginBottom: "2rem",
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
{/* FOOTER */}
<footer
  style={{
    fontSize: "0.9rem",
    color: "#a3a3a3",
    paddingBottom: "2.25rem",
    width: "100%",
    textAlign: "center",
  }}
>
  {/* Launch6 logo CTA */}
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      marginBottom: "1rem",
    }}
  >
    <a
  href="https://launch6.com"
  target="_blank"
  rel="noopener noreferrer"
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "0.75rem",
    padding: "0.95rem 1.2rem",
    borderRadius: "999px",
    background:
      "linear-gradient(135deg, rgba(39,39,42,0.98), rgba(24,24,27,0.98))",
    border: "1px solid #27272a",
    textDecoration: "none",
    color: "#f4f4f5",
    fontSize: "0.98rem",
    fontWeight: 500,
    marginTop: "0.5rem",
  }}
>
  <img
    src="/launch6_white.png"
    alt="Launch6 logo"
    style={{
      height: "1.6rem",
      width: "auto",
      display: "block",
    }}
  />
  <span>blastoff here 🚀</span>
</a>

  </div>

  {/* Legal / utility links */}
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
