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

  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
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

/**
 * THEME TOKENS
 * - bg: outside background
 * - surface: inside vertical container
 * - card: optional inner card background (pastel uses white for drop-info card)
 * - accent: timer digits + timer border + price color
 * - buttonFill / buttonText: buy + link buttons
 * - socialRing: outline around social icons only
 * - icon: social icon glyph color
 */
const THEME_TOKENS = {
  modern: {
    key: "modern",
    label: "Modern Pro",
    bg: "#f0eeef",
    surface: "#faf6f7",
    card: "#faf6f7",

    text: "#242c3f",
    textMuted: "rgba(36,44,63,0.72)",

    border: "rgba(36,44,63,0.14)",
    shadow: "rgba(15,23,42,0.18)",
    inputBg: "rgba(36,44,63,0.06)",

    accent: "#4271ca",
    buttonFill: "#4271ca",
    buttonText: "#faf6f7",

    socialRing: "#4271ca",
    icon: "#242c3f",

    footerLogoFilter: "invert(1)",
  },

  launch6: {
    key: "launch6",
    label: "Launch6",
    bg: "#000000",
    surface: "#2f2f2f",
    card: "#2f2f2f",

    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.78)",

    border: "rgba(255,255,255,0.14)",
    shadow: "rgba(0,0,0,0.80)",
    inputBg: "rgba(255,255,255,0.08)",

    accent: "#9e5aef",
    buttonFill: "#9e5aef",
    buttonText: "#ffffff",

    socialRing: "#9e5aef",
    icon: "#ffffff",

    footerLogoFilter: "none",
  },

  pastel: {
    key: "pastel",
    label: "Pastel Dreams",
    bg: "#ffffff",
    surface: "#bfdff0",     // inside vertical container (blue)
    card: "#ffffff",        // drop info card (white)

    text: "#515862",
    textMuted: "rgba(81,88,98,0.78)",

    border: "rgba(81,88,98,0.16)",
    shadow: "rgba(15,23,42,0.16)",
    inputBg: "rgba(255,255,255,0.55)",

    accent: "#4271ca",      // timer + price (blue)
    buttonFill: "#f7d0d9",  // buttons (pink)
    buttonText: "#242c3f",  // dark text reads premium + accessible on pink

    socialRing: "#f7d0d9",  // social outline (pink)
    icon: "#515862",

    footerLogoFilter: "invert(1)",
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

function ThemedSocialButton({ href, label, iconType, theme }) {
  if (!href) return null;

  const outer = {
    height: "4.1rem",
    width: "4.1rem",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    background: theme.surface,
    border: `2px solid ${theme.socialRing}`, // ONLY social outline
    boxShadow: `0 12px 30px ${theme.shadow}`,
    color: theme.icon, // icon glyph color
  };

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} style={outer}>
      <SocialIcon type={iconType} />
    </a>
  );
}

function DropCard({ product: p, slug, theme }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const imageUrl = normalizeImageSrc(p.imageUrl || "") || null;
  const title = p.title || "Untitled drop";
  const description = p.description || "";

  let priceDisplay =
    p.priceDisplay ||
    p.priceFormatted ||
    p.priceText ||
    (typeof p.priceCents === "number" ? `$${(p.priceCents / 100).toFixed(2)}` : null);

  const buttonText = p.buttonText || "Buy Now";

  const buyHref = `/api/products/buy?productId=${encodeURIComponent(p.id)}${
    slug ? `&slug=${encodeURIComponent(slug)}` : ""
  }`;

  const left = p.unitsLeft === null || p.unitsLeft === undefined ? null : Number(p.unitsLeft);
  const total = p.unitsTotal === null || p.unitsTotal === undefined ? null : Number(p.unitsTotal);
  const soldOut = left !== null && left <= 0;

  const startsAt = p.dropStartsAt ? new Date(p.dropStartsAt) : null;
  const endsAt = p.dropEndsAt ? new Date(p.dropEndsAt) : null;

  let phase = "open";
  if (startsAt && now < startsAt) phase = "upcoming";
  else if (endsAt && now >= endsAt) phase = "ended";

  const isEnded = soldOut || phase === "ended";

  // timer
  let showTimer = false;
  let timerTitle = "";
  let mode = "hours";
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

  // inventory text
  let inventoryText = "";
  if (p.showInventory && left !== null) {
    inventoryText = `Only ${left} left!`;
  }

  const wrapper = {
    width: "100%",
    maxWidth: "420px",
    margin: "0 auto 1.5rem",
    boxSizing: "border-box",
  };

  const heroFrame = {
    borderRadius: "22px",
    overflow: "hidden",
    border: `1px solid ${theme.border}`,
    background: theme.surface,
    boxShadow: `0 20px 60px ${theme.shadow}`, // premium shadow on all themes
  };

  const heroImg = {
    width: "100%",
    height: "auto",
    display: "block",
  };

  const heroPlaceholder = {
    width: "100%",
    minHeight: "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.textMuted,
    fontSize: "1rem",
    background: theme.surface,
  };

  // DROP INFO CARD
  // Pastel: white card around drop info (title/price/inventory/desc/timer/button)
  const infoCard = {
    marginTop: "14px",
    borderRadius: "24px",
    padding: "18px 16px 16px",
    background: theme.key === "pastel" ? theme.card : theme.surface,
    border: `1px solid ${theme.border}`,
    boxShadow: `0 18px 56px ${theme.shadow}`, // premium shadow on all themes
    textAlign: "center",
    boxSizing: "border-box",
  };

  const titleStyle = { fontSize: "1.35rem", fontWeight: 900, margin: "0 0 0.2rem", color: theme.text };

  const priceStyle = {
    fontSize: "1.35rem",
    fontWeight: 900,
    margin: "0 0 0.15rem",
    color: theme.accent, // price stays accent
  };

  const inventoryStyle = {
    fontSize: "0.95rem",
    fontWeight: 900,
    color: theme.accent,
    margin: "0 0 0.8rem",
  };

  const descStyle = {
    fontSize: "0.92rem",
    lineHeight: 1.55,
    color: theme.textMuted,
    margin: "0 0 1rem",
    whiteSpace: "pre-line",
  };

  const timerCard = {
    borderRadius: "18px",
    padding: "10px 14px 12px",
    margin: "0 0 1.05rem",
    border: `2px solid ${theme.accent}`,
    background: theme.key === "pastel" ? "#ffffff" : theme.surface,
    boxShadow: theme.key === "launch6" ? "none" : `0 14px 44px ${theme.shadow}`,
  };

  const timerLabel = {
    fontSize: "0.68rem",
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: theme.textMuted,
    margin: "0 0 6px",
  };

  const timerValues = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: "8px",
    marginBottom: "2px",
    color: theme.accent,
  };

  const timerValue = { fontSize: "1.35rem", fontWeight: 900 };
  const timerSeparator = { fontSize: "1.25rem", color: theme.accent, transform: "translateY(-1px)" };
  const timerUnits = { fontSize: "0.7rem", color: theme.textMuted, margin: 0 };

  const buttonBase = {
    width: "100%",
    borderRadius: "999px",
    padding: "0.85rem 1.1rem",
    fontSize: "1rem",
    fontWeight: 900,
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0.1rem auto 0",
    boxSizing: "border-box",
    transition: "transform 0.08s ease, box-shadow 0.08s ease, opacity 0.12s",
  };

  const buttonActive = {
    ...buttonBase,
    background: theme.buttonFill,
    color: theme.buttonText,
    boxShadow: `0 18px 56px ${theme.shadow}`, // premium shadow on all themes
  };

  const buttonDisabled = {
    ...buttonBase,
    background: "rgba(148,163,184,0.35)",
    color: theme.key === "launch6" ? "rgba(255,255,255,0.75)" : "rgba(36,44,63,0.65)",
    boxShadow: "none",
    cursor: "default",
    opacity: 0.75,
  };

  return (
    <article style={wrapper}>
      <div style={heroFrame}>
        {imageUrl ? (
          <img src={imageUrl} alt={title} style={heroImg} loading="lazy" />
        ) : (
          <div style={heroPlaceholder}>
            <span>Drop artwork</span>
          </div>
        )}
      </div>

      <div style={infoCard}>
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

  const canCollectEmail =
    profile?.showForm === true || (profile?.showForm !== false && profile?.collectEmail !== false);

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

  const pageShell = {
    minHeight: "100vh",
    background: theme.bg,
    color: theme.text,
    padding: "2.2rem 1.2rem 2.6rem",
    boxSizing: "border-box",
  };

  // INNER VERTICAL CONTAINER (everything sits inside)
  const innerContainer = {
    maxWidth: "560px",
    margin: "0 auto",
    background: theme.surface,
    borderRadius: "32px",
    border: `1px solid ${theme.border}`, // neutral border
    boxShadow: `0 28px 90px ${theme.shadow}`, // premium shadow on all themes
    padding: "2.1rem 1.4rem 2.2rem",
    boxSizing: "border-box",
  };

  const mainStyle = {
    maxWidth: "500px",
    margin: "0 auto",
    textAlign: "center",
    color: theme.text,
  };

  const fullWidthSection = { width: "100%" };
  const SECTION_GAP = "1.35rem";
  const HEADER_STACK_SPACING = "0.8rem";

  // solid link pill to remove weird end shading
  const linkPill = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.95rem 1.2rem",
    borderRadius: "18px",
    background: theme.buttonFill,
    color: theme.buttonText,
    textDecoration: "none",
    fontSize: "0.98rem",
    fontWeight: 900,
    boxShadow: `0 18px 56px ${theme.shadow}`,
    boxSizing: "border-box",
  };

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
          website: websiteHp,
          formTs: formTsRef.current,
          ref: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.ok) {
        if (json?.error === "email_collection_disabled") setEmailErr("Email signup is unavailable right now.");
        else if (json?.error === "invalid_email") setEmailErr("Please enter a valid email.");
        else if (json?.error === "profile_not_found") setEmailErr("Creator not found.");
        else setEmailErr("Subscribe failed. Please try again.");
        return;
      }
      setSubscribed(true);
    } catch {
      setEmailErr("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={pageShell}>
        <div style={innerContainer}>
          <main style={mainStyle}>
            <div style={{ opacity: 0.8 }}>Loading…</div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageShell}>
        <div style={innerContainer}>
          <div
            style={{
              maxWidth: "720px",
              width: "100%",
              borderRadius: "16px",
              border: `1px solid ${theme.border}`,
              background: theme.key === "pastel" ? "#ffffff" : theme.surface,
              padding: "16px",
              boxShadow: `0 18px 56px ${theme.shadow}`,
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontWeight: 900, marginBottom: "6px" }}>Can’t load page</div>
            <div style={{ fontSize: "14px", color: theme.textMuted }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDesc} />
        <meta name="robots" content="index,follow,max-image-preview:large" />

        <meta property="og:type" content="website" />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDesc} />
        {firstImage ? <meta property="og:image" content={firstImage} /> : null}

        <meta name="twitter:card" content={firstImage ? "summary_large_image" : "summary"} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDesc} />
        {firstImage ? <meta name="twitter:image" content={firstImage} /> : null}
        <link rel="canonical" href={pageUrl} />
      </Head>

      <div style={pageShell}>
        <div style={innerContainer}>
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
                        backgroundColor: theme.surface,
                        boxShadow: `0 18px 56px ${theme.shadow}`,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: "6.5rem",
                        width: "6.5rem",
                        borderRadius: "999px",
                        backgroundColor: theme.surface,
                        border: `1px solid ${theme.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: "2.2rem",
                        boxShadow: `0 18px 56px ${theme.shadow}`,
                        color: theme.text,
                      }}
                    >
                      {avatarInitial}
                    </div>
                  )}
                </div>

                <h1
                  style={{
                    fontSize: "1.7rem",
                    lineHeight: 1.2,
                    fontWeight: 900,
                    margin: `0 0 ${HEADER_STACK_SPACING}`,
                    color: theme.text,
                  }}
                >
                  {title || "Artist"}
                </h1>

                {bio ? (
                  <p
                    style={{
                      color: theme.textMuted,
                      fontSize: "1rem",
                      lineHeight: 1.5,
                      margin: `0 0 ${HEADER_STACK_SPACING}`,
                      whiteSpace: "pre-line",
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

            {/* PRODUCTS */}
            {products.length > 0 && (
              <section style={{ ...fullWidthSection, marginBottom: SECTION_GAP }}>
                {products.map((p) => (
                  <DropCard key={p.id} product={p} slug={slug} theme={theme} />
                ))}
              </section>
            )}

            {/* EMAIL CAPTURE (shadow mini-container around the whole section) */}
            {canCollectEmail && (
              <section
                style={{
                  width: "100%",
                  margin: `0 auto ${SECTION_GAP}`,
                  display: "flex",
                  justifyContent: "center",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "420px",
                    borderRadius: "22px",
                    padding: "18px 18px 16px",
                    background: theme.key === "pastel" ? "#ffffff" : theme.surface,
                    border: `1px solid ${theme.border}`,
                    boxShadow: `0 18px 56px ${theme.shadow}`,
                    textAlign: "center",
                    boxSizing: "border-box",
                  }}
                >
                  <h2 style={{ margin: "0 0 0.95rem", fontSize: "1.35rem", fontWeight: 900, lineHeight: 1.2 }}>
                    {(profile?.formHeadline || profile?.emailHeadline || "Get first dibs on drops").trim()}
                  </h2>

                  {!subscribed ? (
                    <form
                      onSubmit={handleSubscribe}
                      style={{ display: "flex", flexDirection: "column", gap: "0.75rem", position: "relative" }}
                    >
                      {/* Honeypot */}
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
                            borderRadius: "9999px",
                            backgroundColor: theme.inputBg,
                            border: `1px solid ${theme.border}`,
                            padding: "0.9rem 1.1rem",
                            fontSize: "1.05rem",
                            color: theme.text,
                            outline: "none",
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
                          display: "flex",
                          alignItems: "stretch",
                          borderRadius: "9999px",
                          backgroundColor: theme.inputBg,
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
                            color: theme.text,
                            outline: "none",
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
                            cursor: submitting ? "default" : "pointer",
                            opacity: submitting ? 0.75 : 1,
                            background: theme.buttonFill,
                            color: theme.buttonText,
                          }}
                        >
                          {submitting ? "Joining…" : "Join"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      style={{
                        borderRadius: "12px",
                        border: `1px solid ${theme.border}`,
                        background: theme.key === "pastel" ? "#ffffff" : theme.surface,
                        padding: "10px 12px",
                        fontSize: "0.92rem",
                        color: theme.text,
                      }}
                    >
                      You’re in! We’ll let you know about new drops.
                    </div>
                  )}

                  {emailErr ? (
                    <div id="email-error" style={{ marginTop: "0.55rem", fontSize: "0.85rem", color: "#ef4444" }}>
                      {emailErr}
                    </div>
                  ) : null}
                </div>
              </section>
            )}

            {/* LINKS */}
            {links.length > 0 && (
              <section style={{ width: "100%", marginTop: products.length === 0 ? SECTION_GAP : 0, marginBottom: "2rem" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {links.map((l) => {
                    const safeHref = normalizeHref(l.url);
                    if (!safeHref) return null;
                    const label = l.label || l.url || "Link";
                    const key = l.id || l.url || label;
                    return (
                      <a
                        key={key}
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        referrerPolicy="no-referrer"
                        style={linkPill}
                      >
                        <span>{label}</span>
                        <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>↗</span>
                      </a>
                    );
                  })}
                </div>
              </section>
            )}

            {/* FOOTER */}
            <footer style={{ fontSize: "0.9rem", color: theme.textMuted, paddingBottom: "0.6rem", width: "100%", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.05rem" }}>
                <a
                  href="https://launch6.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Powered by Launch6"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.55rem",
                    padding: "0.28rem 0.55rem",
                    borderRadius: "999px",
                    textDecoration: "none",
                    color: theme.textMuted,
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    background: theme.key === "launch6" ? "transparent" : "rgba(15,23,42,0.04)",
                    border: `1px solid ${theme.border}`,
                    boxShadow: theme.key === "launch6" ? "none" : `0 14px 44px ${theme.shadow}`,
                  }}
                >
                  <span>Powered by</span>
                  <img
                    src="/launch6_white.png"
                    alt="Launch6"
                    style={{
                      height: "1.65rem",
                      width: "auto",
                      opacity: 0.95,
                      transform: "translateY(1px)",
                      filter: theme.footerLogoFilter,
                    }}
                  />
                  <span style={{ opacity: 0.55, fontSize: "0.78rem", marginLeft: "0.05rem" }}>↗</span>
                </a>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.9rem" }}>
                <button type="button" style={{ textDecoration: "underline", background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer" }}>
                  Cookie preferences
                </button>
                <button type="button" style={{ textDecoration: "underline", background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer" }}>
                  Report page
                </button>
                <button type="button" style={{ textDecoration: "underline", background: "transparent", border: "none", color: theme.textMuted, cursor: "pointer" }}>
                  Privacy
                </button>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps() {
  // Force SSR so any slug resolves at request time.
  return { props: {} };
}
