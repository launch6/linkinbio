// pages/[slug].js
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

/** Format ms as "Xd Yh Zm Ws". (still used by older status logic if needed) */
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

/**
 * Defense-in-depth: normalize external hrefs.
 * - allow https/http, mailto/tel
 * - block javascript:, data:, vbscript:
 * - block relative and protocol-relative
 * - allow bare domains => https://
 */
function normalizeHref(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();

  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return "";
  }

  if (lower.startsWith("mailto:") || lower.startsWith("tel:")) {
    return trimmed;
  }

  // If it has any other scheme, only allow http/https
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "";
  }

  // Block relative and protocol-relative URLs
  if (trimmed.startsWith("/") || trimmed.startsWith("//")) return "";

  // Allow bare domains by prepending https://
  if (trimmed.includes(".") && !/\s/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return "";
}

/**
 * Defense-in-depth for image src:
 * - allow https/http
 * - allow data:image/(png|jpeg|jpg|webp|gif) only
 * - block javascript:, svg data payloads, protocol-relative, relative URLs
 */
function normalizeImageSrc(src) {
  if (!src || typeof src !== "string") return "";
  const trimmed = src.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();

  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:")) return "";
  if (trimmed.startsWith("/") || trimmed.startsWith("//")) return "";

  // allow http/https
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // allow safe data:image only (no svg)
  if (lower.startsWith("data:image/")) {
    // Only allow common raster image types
    if (
      lower.startsWith("data:image/png") ||
      lower.startsWith("data:image/jpeg") ||
      lower.startsWith("data:image/jpg") ||
      lower.startsWith("data:image/webp") ||
      lower.startsWith("data:image/gif")
    ) {
      return trimmed;
    }
    return "";
  }

  return "";
}

/** Theme tokens (allowlist to match server). */
const THEME_TOKENS = {
  launch6: {
    key: "launch6",
    label: "Launch6",
    bgTop: "#191b2b",
    bgMid: "#050509",
    bgBot: "#020206",
    inner: "#0b0c15",
    accentA: "#6366ff",
    accentB: "#a855f7",
    muted: "#9ca3af",
    border: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(148,163,184,0.40)",
    pillA: "rgba(99,102,255,0.18)",
    pillB: "rgba(168,85,247,0.18)",
  },
  pastel: {
    key: "pastel",
    label: "Pastel Dreams",
    bgTop: "#0b1220",
    bgMid: "#070a12",
    bgBot: "#02030a",
    inner: "#070b14",
    accentA: "#B9E2F5",
    accentB: "#FFD1DC",
    muted: "#a3a3a3",
    border: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(255,255,255,0.18)",
    pillA: "rgba(185,226,245,0.18)",
    pillB: "rgba(255,209,220,0.18)",
  },
  modern: {
    key: "modern",
    label: "Modern Pro",
    bgTop: "#0b1020",
    bgMid: "#070912",
    bgBot: "#02040a",
    inner: "#070b14",
    accentA: "#2563EB",
    accentB: "#FFFFFF",
    muted: "#a3a3a3",
    border: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(255,255,255,0.20)",
    pillA: "rgba(37,99,235,0.18)",
    pillB: "rgba(255,255,255,0.10)",
  },
};

function getTheme(themeKeyRaw) {
  const key = typeof themeKeyRaw === "string" ? themeKeyRaw.trim().toLowerCase() : "";
  if (key === "launch6" || key === "pastel" || key === "modern") return THEME_TOKENS[key];
  return THEME_TOKENS.launch6;
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

function DropCard({ product: p, slug, theme }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // --- basic fields -------------------------------------------------------
  const imageUrl = normalizeImageSrc(p.imageUrl || "") || null;
  const title = p.title || "Untitled drop";
  const description = p.description || "";

  // price display: try a few common fields
  let priceDisplay =
    p.priceDisplay ||
    p.priceFormatted ||
    p.priceText ||
    (typeof p.priceCents === "number" ? `$${(p.priceCents / 100).toFixed(2)}` : null);

  const buttonText = p.buttonText || "Buy Now";

  const buyHref = `/api/products/buy?productId=${encodeURIComponent(p.id)}${
    slug ? `&slug=${encodeURIComponent(slug)}` : ""
  }`;

  // --- inventory / ended logic -------------------------------------------
  const left = p.unitsLeft === null || p.unitsLeft === undefined ? null : Number(p.unitsLeft);
  const total = p.unitsTotal === null || p.unitsTotal === undefined ? null : Number(p.unitsTotal);
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

  // --- countdown (Days : Hours : Minutes : Seconds) -----------------------
  let showTimer = false;
  let timerTitle = "";
  let mode = "hours"; // "hours" = H:M:S, "days" = D:H:M:S
  let d = "0";
  let h = "00";
  let m = "00";
  let s = "00";

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
        const days = Math.floor(totalSeconds / 86400);
        const remAfterDays = totalSeconds % 86400;
        const hours = Math.floor(remAfterDays / 3600);
        const remAfterHours = remAfterDays % 3600;
        const mins = Math.floor(remAfterHours / 60);
        const secs = remAfterHours % 60;

        if (days > 0) {
          mode = "days";
          d = String(days);
        }

        h = String(hours).padStart(2, "0");
        m = String(mins).padStart(2, "0");
        s = String(secs).padStart(2, "0");
      }
    }
  }

  // inventory text (optional, under price)
  let inventoryText = "";
  if (p.showInventory && left !== null && total !== null) {
    inventoryText = `${left}/${total} available`;
  }

  // --- themed styles ------------------------------------------------------
  const outer = {
    width: "100%",
    maxWidth: "420px",
    margin: "0 auto 1.5rem",
    boxSizing: "border-box",
    borderRadius: "28px",
    padding: "20px 18px 22px",
    background: `radial-gradient(circle at top, ${theme.bgTop} 0%, ${theme.bgMid} 60%, ${theme.bgBot} 100%)`,
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.85)",
    border: `1px solid ${theme.border}`,
  };

  const heroFrame = {
    borderRadius: "24px",
    padding: "3px",
    background: `radial-gradient(circle at top, ${theme.accentA} 0%, ${theme.accentB} 42%, ${theme.inner} 100%)`,
    boxShadow: "0 14px 40px rgba(0, 0, 0, 0.9)",
  };

  const heroInner = {
    borderRadius: "20px",
    background: theme.inner,
    overflow: "hidden",
    width: "100%",
    position: "relative",
    lineHeight: 0,
  };

  const heroImg = {
    width: "100%",
    height: "auto",
    display: "block",
  };

  const heroPlaceholder = {
    width: "100%",
    height: "100%",
    minHeight: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.muted,
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
    backgroundImage: `linear-gradient(90deg, ${theme.accentB}, ${theme.accentA})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };

  const inventoryStyle = {
    fontSize: "0.8rem",
    color: theme.muted,
    margin: "0 0 0.8rem",
  };

  const descStyle = {
    fontSize: "0.9rem",
    lineHeight: 1.6,
    color: "#e5e7eb",
    margin: "0 0 1rem",
    whiteSpace: "pre-line",
  };

  const timerCard = {
    borderRadius: "18px",
    border: `1px solid ${theme.cardBorder}`,
    background: theme.inner,
    padding: "10px 14px 12px",
    margin: "0 0 1.05rem",
  };

  const timerLabel = {
    fontSize: "0.68rem",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: theme.muted,
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
    color: theme.accentA,
    transform: "translateY(-1px)",
  };

  const timerUnits = {
    fontSize: "0.7rem",
    color: theme.muted,
    margin: 0,
  };

  const buttonBase = {
    width: "100%",
    borderRadius: "999px",
    padding: "0.8rem 1.1rem",
    fontSize: "0.98rem",
    fontWeight: 700,
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0.1rem auto 0",
    boxSizing: "border-box",
    transition: "transform 0.08s ease, boxShadow 0.08s ease, opacity 0.12s",
  };

  const buttonActive = {
    ...buttonBase,
    backgroundImage: `linear-gradient(90deg, ${theme.accentA}, ${theme.accentB})`,
    color: "#fff",
    boxShadow: "0 14px 36px rgba(0,0,0,0.35)",
  };

  const buttonDisabled = {
    ...buttonBase,
    backgroundImage: "linear-gradient(90deg,#374151,#1f2937)",
    color: "#9ca3af",
    boxShadow: "none",
    cursor: "default",
    opacity: 0.7,
  };

  return (
    <article style={outer}>
      <div style={heroFrame}>
        <div style={heroInner}>
          {imageUrl ? (
            <img src={imageUrl} alt={title} style={heroImg} loading="lazy" />
          ) : (
            <div style={heroPlaceholder}>
              <span>Drop artwork</span>
            </div>
          )}
        </div>
      </div>

      <div style={body}>
        <h2 style={titleStyle}>{title}</h2>

        {priceDisplay && <p style={priceStyle}>{priceDisplay}</p>}

        {inventoryText && <p style={inventoryStyle}>{inventoryText}</p>}

        {description && <p style={descStyle}>{description}</p>}

        {(timerTitle || showTimer) && (
          <div style={timerCard}>
            {timerTitle && <p style={timerLabel}>{timerTitle}</p>}

            {showTimer && (
              <>
                <div style={timerValues}>
                  {mode === "days" && (
                    <>
                      <span style={timerValue}>{d}</span>
                      <span style={timerSeparator}>:</span>
                    </>
                  )}
                  <span style={timerValue}>{h}</span>
                  <span style={timerSeparator}>:</span>
                  <span style={timerValue}>{m}</span>
                  <span style={timerSeparator}>:</span>
                  <span style={timerValue}>{s}</span>
                </div>
                <p style={timerUnits}>
                  {mode === "days" ? "Days · Hours · Minutes · Seconds" : "Hours · Minutes · Seconds"}
                </p>
              </>
            )}
          </div>
        )}

        {isEnded ? (
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

function ThemedSocialButton({ href, label, iconType, theme }) {
  if (!href) return null;

  const ring = {
    height: "4.1rem",
    width: "4.1rem",
    borderRadius: "999px",
    padding: "2px",
    backgroundImage: `linear-gradient(135deg, ${theme.accentA}, ${theme.accentB})`,
    boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const inner = {
    height: "100%",
    width: "100%",
    borderRadius: "999px",
    border: `1px solid ${theme.border}`,
    background: `linear-gradient(135deg, rgba(24,24,27,0.92), rgba(10,10,18,0.92))`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#f9fafb",
    textDecoration: "none",
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      style={ring}
    >
      <span style={inner}>
        <SocialIcon type={iconType} />
      </span>
    </a>
  );
}

export default function PublicSlugPage() {
  const router = useRouter();
  const { slug } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);

  // email capture UI state
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [websiteHp, setWebsiteHp] = useState(""); // honeypot (invisible)
  const formTsRef = useRef(Date.now()); // when the form was shown
  const [emailErr, setEmailErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const refreshIntervalRef = useRef(null);

  // fetch public profile + products via slug (robust JSON guard)
  async function fetchAll(slugVal, opts = {}) {
    const trackView = !!opts.trackView;
    const url = `/api/public?slug=${encodeURIComponent(slugVal)}${trackView ? "&trackView=1" : ""}`;
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
    setProducts(Array.isArray(j.products) ? j.products.filter((p) => !!p.published) : []);
  }

  // initial + periodic refresh (trackView only once per session)
  useEffect(() => {
    if (!slug) return;

    try {
      formTsRef.current = Date.now();
      setWebsiteHp("");
    } catch {}

    let alive = true;

    const viewKey = `l6_view_tracked_${String(slug)}`;
    let shouldTrackView = false;

    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        if (!sessionStorage.getItem(viewKey)) {
          sessionStorage.setItem(viewKey, "1");
          shouldTrackView = true;
        }
      }
    } catch {
      shouldTrackView = false;
    }

    (async () => {
      try {
        setLoading(true);
        await fetchAll(slug, { trackView: shouldTrackView });
        if (!alive) return;
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    // Poll without tracking (prevents inflated viewCount)
    refreshIntervalRef.current = setInterval(() => {
      fetchAll(slug, { trackView: false }).catch(() => {});
    }, 15000);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchAll(slug, { trackView: false }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [slug]);

  const title = profile?.displayName || profile?.name || "Artist";
  const bio = profile?.bio || profile?.description || "";

  const theme = getTheme(profile?.theme);

  // default: email capture ON unless explicitly disabled
  const canCollectEmail =
    profile?.showForm === true || (profile?.showForm !== false && profile?.collectEmail !== false);

  // Normalize links again client-side (defense-in-depth)
  const links = Array.isArray(profile?.links)
    ? profile.links
        .map((l) => {
          const url = normalizeHref(l?.url || "");
          if (!url) return null;
          return { ...l, url };
        })
        .filter(Boolean)
    : [];

  const socialRaw = profile?.social || {};
  const social = {
    instagram: normalizeHref(socialRaw.instagram),
    facebook: normalizeHref(socialRaw.facebook),
    tiktok: normalizeHref(socialRaw.tiktok),
    youtube: normalizeHref(socialRaw.youtube),
    x: normalizeHref(socialRaw.x),
    website: normalizeHref(socialRaw.website),
  };

  const websiteHref = social.website;

  const hasSocialRow =
    social.instagram || social.facebook || social.tiktok || social.youtube || social.x || websiteHref;

  // --- SEO / Social ---
  const firstImage = normalizeImageSrc(products?.[0]?.imageUrl || "");
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://l6.io";
  const pageUrl = slug ? `${site.replace(/\/$/, "")}/${encodeURIComponent(slug)}` : site;
  const seoTitle = title ? `${title} — Drops` : "Drops";
  const left0 = toNumberOrNull(products?.[0]?.unitsLeft);
  const total0 = toNumberOrNull(products?.[0]?.unitsTotal);
  const leftPart =
    products?.[0]?.showInventory && left0 != null && total0 != null ? ` • ${left0}/${total0} left` : "";
  const seoDesc =
    (products?.[0]?.title ? `${products[0].title}${leftPart}` : "Limited releases and timed drops.") +
    (bio ? ` — ${bio}` : "");

  const avatarInitial = (title && title.trim().charAt(0).toUpperCase()) || "L";
  const avatarUrl = normalizeImageSrc(profile?.avatarUrl || profile?.imageUrl || profile?.avatar || "");

  // early states
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
    padding: "2.3rem 1.5rem 2.5rem",
    textAlign: "center",
  };

  const fullWidthSection = { width: "100%" };

  // vertical rhythm
  const SECTION_GAP = "1.35rem";
  const HEADER_STACK_SPACING = "0.8rem";

  // themed link pill wrapper
  const linkPillOuter = {
    padding: "2px",
    borderRadius: "999px",
    backgroundImage: `linear-gradient(135deg, ${theme.accentA}, ${theme.accentB})`,
    boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
  };

  const linkPillInner = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.95rem 1.2rem",
    borderRadius: "999px",
    background: `linear-gradient(135deg, ${theme.pillA}, ${theme.pillB}), linear-gradient(135deg, rgba(39,39,42,0.95), rgba(24,24,27,0.95))`,
    border: `1px solid ${theme.border}`,
    textDecoration: "none",
    color: "#f4f4f5",
    fontSize: "0.98rem",
    backdropFilter: "blur(6px)",
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
          name: fullName,
          website: websiteHp, // honeypot
          formTs: formTsRef.current, // timing hint (ms)
          ref: typeof window !== "undefined" ? window.location.href : "",
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

  return (
    <>
      <Head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
        <meta name="robots" content="index,follow,max-image-preview:large" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDesc} />
        {firstImage ? <meta property="og:image" content={firstImage} /> : null}

        {/* Twitter */}
        <meta name="twitter:card" content={firstImage ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDesc} />
        {firstImage ? <meta name="twitter:image" content={firstImage} /> : null}
        <link rel="canonical" href={pageUrl} />
      </Head>

      <div
        className="min-h-screen text-white"
        style={{
          background: `radial-gradient(circle at top, ${theme.bgTop} 0%, ${theme.bgMid} 62%, ${theme.bgBot} 100%)`,
        }}
      >
        <main style={mainStyle}>
          {/* HEADER */}
          <header style={{ width: "100%", marginBottom: SECTION_GAP }}>
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
              <div style={{ marginBottom: HEADER_STACK_SPACING }}>
                {avatarUrl ? (
                  <div
                    style={{
                      padding: "2px",
                      borderRadius: "999px",
                      backgroundImage: `linear-gradient(135deg, ${theme.accentA}, ${theme.accentB})`,
                      display: "inline-block",
                      boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
                    }}
                  >
                    <img
                      src={avatarUrl}
                      alt={title || "Avatar"}
                      style={{
                        height: "7rem",
                        width: "7rem",
                        borderRadius: "999px",
                        objectFit: "cover",
                        border: `1px solid ${theme.border}`,
                        display: "block",
                        backgroundColor: theme.inner,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      height: "6.5rem",
                      width: "6.5rem",
                      borderRadius: "999px",
                      backgroundColor: theme.inner,
                      border: `1px solid ${theme.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "2.2rem",
                      boxShadow: "0 14px 34px rgba(0,0,0,0.35)",
                    }}
                  >
                    {avatarInitial}
                  </div>
                )}
              </div>

              {/* Handle / name */}
              <h1
                style={{
                  fontSize: "1.7rem",
                  lineHeight: 1.2,
                  fontWeight: 800,
                  margin: `0 0 ${HEADER_STACK_SPACING}`,
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
                    whiteSpace: "pre-line",
                    opacity: 0.92,
                  }}
                >
                  {bio}
                </p>
              ) : null}

              {/* Social icons */}
              {hasSocialRow && (
                <div style={{ display: "flex", justifyContent: "center", gap: "0.9rem", flexWrap: "wrap" }}>
                  <ThemedSocialButton href={social.instagram} label="Instagram" iconType="instagram" theme={theme} />
                  <ThemedSocialButton href={social.facebook} label="Facebook" iconType="facebook" theme={theme} />
                  <ThemedSocialButton href={social.tiktok} label="TikTok" iconType="tiktok" theme={theme} />
                  <ThemedSocialButton href={social.youtube} label="YouTube" iconType="youtube" theme={theme} />
                  <ThemedSocialButton href={social.x} label="X" iconType="x" theme={theme} />
                  <ThemedSocialButton href={websiteHref} label="Website" iconType="website" theme={theme} />
                </div>
              )}
            </div>
          </header>

          {/* PRODUCTS / DROP CARD */}
          {products.length > 0 && (
            <section style={{ ...fullWidthSection, marginBottom: SECTION_GAP }}>
              {products.map((p) => (
                <DropCard key={p.id} product={p} slug={slug} theme={theme} />
              ))}
            </section>
          )}

          {/* EMAIL CAPTURE */}
          {canCollectEmail && (
            <section
              style={{
                width: "100%",
                maxWidth: "420px",
                margin: `0 auto ${SECTION_GAP}`,
                padding: "20px 18px 22px",
                borderRadius: "28px",
                textAlign: "center",
                background: `radial-gradient(circle at top, ${theme.bgTop} 0%, ${theme.bgMid} 60%, ${theme.bgBot} 100%)`,
                border: `1px solid ${theme.cardBorder}`,
                boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
                boxSizing: "border-box",
              }}
            >
              <h2
                style={{
                  width: "100%",
                  maxWidth: "420px",
                  marginTop: "-0.25rem",
                  marginRight: "auto",
                  marginLeft: "auto",
                  marginBottom: "0.95rem",
                  textAlign: "center",
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  lineHeight: 1.2,
                }}
              >
                {(profile?.formHeadline || profile?.emailHeadline || "Get first dibs on drops").trim()}
              </h2>

              {!subscribed ? (
                <form
                  onSubmit={handleSubscribe}
                  style={{ display: "flex", flexDirection: "column", gap: "0.75rem", position: "relative" }}
                >
                  {/* Honeypot (invisible). Bots often fill this; humans never see it. */}
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

                  {profile?.collectName && (
                    <input
                      type="text"
                      autoComplete="name"
                      style={{
                        width: "100%",
                        maxWidth: "420px",
                        margin: "0 auto",
                        borderRadius: "9999px",
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: `1px solid ${theme.border}`,
                        padding: "0.9rem 1.1rem",
                        fontSize: "1.05rem",
                        color: "white",
                        outline: "none",
                        boxShadow: "none",
                        boxSizing: "border-box",
                      }}
                      placeholder="Full name (optional)"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  )}

                  <div
                    style={{
                      width: "100%",
                      maxWidth: "420px",
                      margin: "0 auto",
                      display: "flex",
                      alignItems: "stretch",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(255,255,255,0.06)",
                      border: `1px solid ${theme.border}`,
                      overflow: "hidden",
                      boxSizing: "border-box",
                    }}
                  >
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: "none",
                        backgroundColor: "transparent",
                        padding: "0.9rem 1.1rem",
                        fontSize: "1.05rem",
                        color: "white",
                        outline: "none",
                        boxShadow: "none",
                      }}
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
                      style={{
                        border: "none",
                        padding: "0 1.4rem",
                        fontSize: "1.05rem",
                        fontWeight: 900,
                        color: "white",
                        cursor: submitting ? "default" : "pointer",
                        opacity: submitting ? 0.75 : 1,
                        backgroundImage: `linear-gradient(90deg, ${theme.accentA}, ${theme.accentB})`,
                        boxShadow: "0 14px 36px rgba(0,0,0,0.35)",
                      }}
                    >
                      {submitting ? "Joining…" : "Join"}
                    </button>
                  </div>
                </form>
              ) : (
                <div
                  style={{
                    borderRadius: "0.75rem",
                    border: "1px solid rgba(16,185,129,0.45)",
                    backgroundColor: "rgba(6,95,70,0.25)",
                    padding: "0.7rem 0.9rem",
                    fontSize: "0.92rem",
                    color: "#a7f3d0",
                  }}
                >
                  You’re in! We’ll let you know about new drops.
                </div>
              )}

              {emailErr ? (
                <div id="email-error" style={{ marginTop: "0.55rem", fontSize: "0.85rem", color: "#fecaca" }}>
                  {emailErr}
                </div>
              ) : null}
            </section>
          )}

          {/* LINKS */}
          {links.length > 0 && (
            <section
              style={{
                width: "100%",
                marginTop: products.length === 0 ? SECTION_GAP : 0,
                marginBottom: "2rem",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {links.map((l) => {
                  const safeHref = normalizeHref(l.url);
                  if (!safeHref) return null;

                  const label = l.label || l.url || "Link";

                  return (
                    <div key={l.id || l.url} style={linkPillOuter}>
                      <a
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        referrerPolicy="no-referrer"
                        style={linkPillInner}
                      >
                        <span>{label}</span>
                        <span style={{ fontSize: "0.8rem", opacity: 0.65 }}>↗</span>
                      </a>
                    </div>
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
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
  <a
    href="https://launch6.com"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Powered by LAUNCH6"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "0.55rem",
      padding: "0.45rem 0.75rem",
      borderRadius: "999px",
      textDecoration: "none",
      color: "rgba(244,244,245,0.92)",
      fontSize: "0.85rem",
      fontWeight: 700,
      background: "transparent",
      border: `1px solid ${theme.border}`,
      boxShadow: "none",
      maxWidth: "100%",
    }}
  >
    <span style={{ opacity: 0.92 }}>Powered by</span>
<img
  src="/launch6_white.png"
  alt="Launch6"
  style={{
    height: "1.32rem", // 25% larger than 1.05rem
    width: "auto",
    opacity: 0.95,
    transform: "translateY(1px)", // visually centers with text
  }}
/>
<span style={{ opacity: 0.55, fontSize: "0.78rem", marginLeft: "0.15rem" }}>↗</span>

  </a>
</div>

            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.9rem" }}>
              <button type="button" style={{ textDecoration: "underline", background: "transparent", border: "none", color: "#a3a3a3" }}>
                Cookie preferences
              </button>
              <button type="button" style={{ textDecoration: "underline", background: "transparent", border: "none", color: "#a3a3a3" }}>
                Report page
              </button>
              <button type="button" style={{ textDecoration: "underline", background: "transparent", border: "none", color: "#a3a3a3" }}>
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
