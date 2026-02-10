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
 * Theme tokens (allowlist). Keys: launch6 | pastel | modern
 * NOTE: Pastel is redesigned per your spec.
 */
const THEME_TOKENS = {
  modern: {
    key: "modern",
    label: "Modern Pro",

    // page background + card background
    bg: "#f0eeef",
    surface: "#faf6f7",

    // text
    text: "#242c3f",
    textMuted: "rgba(36,44,63,0.72)",

    // subtle chrome
    border: "rgba(36,44,63,0.14)",
    shadow: "rgba(15,23,42,0.22)",
    inputBg: "rgba(36,44,63,0.06)",
    inputBorder: "rgba(36,44,63,0.14)",

    // accents
    accent: "#4271ca", // timer digits, price, timer border
    socialRing: "#4271ca", // social ring
    avatarRing: "#4271ca", // avatar ring

    // buttons
    buttonFill: "#4271ca",
    buttonText: "#faf6f7",

    // links
    linkFill: "#4271ca",
    linkText: "#faf6f7",
    linkBorder: "#4271ca",

    // inventory
    inventoryColor: undefined, // falls back to accent

    // pastel-only product container (unused here)
    productSurface: undefined,
    productBorder: undefined,

    icon: "#242c3f",
    footerLogoFilter: "invert(1)",
  },

  launch6: {
    key: "launch6",
    label: "Launch6",

    bg: "#000000",
    surface: "#2f2f2f",

    text: "#ffffff",
    textMuted: "rgba(255,255,255,0.78)",

    border: "rgba(255,255,255,0.14)",
    shadow: "rgba(0,0,0,0.55)",
    inputBg: "rgba(255,255,255,0.08)",
    inputBorder: "transparent",

    accent: "#9e5aef",
    socialRing: "#9e5aef",
    avatarRing: "#9e5aef",

    buttonFill: "#9e5aef",
    buttonText: "#ffffff",

    linkFill: "#9e5aef",
    linkText: "#ffffff",
    linkBorder: "#9e5aef",

    inventoryColor: undefined, // falls back to accent

    productSurface: undefined,
    productBorder: undefined,

    icon: "#ffffff",
    footerLogoFilter: "none",
  },

  pastel: {
    key: "pastel",
    label: "Pastel Dreams",

    // Outside container (card) + overall page bg
    // Your spec:
    // outside container = fdf4ee
    // inner product container = fdf9f5
    bg: "#e1ede1",        // soft mint page background (premium framing)
    surface: "#fdf4ee",   // OUTSIDE container (card)

    // text
    text: "#3b3f45",
    textMuted: "rgba(59,63,69,0.76)",

    border: "rgba(59,63,69,0.14)",
    shadow: "rgba(15,23,42,0.20)",

    // inputs sit on the outside container
    inputBg: "rgba(253,249,245,0.75)",
    inputBorder: "rgba(241,151,132,0.35)",

    // Your spec:
    // buy/join/inventory/social ring = f19784
    // timer digits + timer border + link buttons + price + avatar ring = 71afab
    buttonFill: "#f19784",
    buttonText: "#ffffff",

    accent: "#71afab",
    socialRing: "#f19784",
    avatarRing: "#71afab",

    // Links: match the reference look (teal buttons)
    linkFill: "#71afab",
    linkText: "#ffffff",
    linkBorder: "#71afab",

    // Inventory text: coral
    inventoryColor: "#f19784",

    // Pastel-only product container
    productSurface: "#fdf9f5",
    productBorder: "rgba(113,175,171,0.28)",

    icon: "#3b3f45",
    footerLogoFilter: "invert(1)",
  },
};

function getTheme(themeKeyRaw) {
  const key = typeof themeKeyRaw === "string" ? themeKeyRaw.trim().toLowerCase() : "";
  if (key === "launch6" || key === "pastel" || key === "modern") return THEME_TOKENS[key];
  return THEME_TOKENS.launch6;
}

// Generic ring style (used for social + avatar with different ring colors)
function ringStyle(theme, ringColor) {
  const ring = `linear-gradient(135deg, ${ringColor}, ${ringColor})`;
  return {
    border: "1px solid transparent",
    backgroundImage: `linear-gradient(${theme.surface}, ${theme.surface}), ${ring}`,
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
  };
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
const ELEVATION = {
  hero: "0 18px 48px",
  card: "0 16px 44px",
  soft: "0 10px 26px",
  float: "0 26px 80px",
};

function ThemedSocialButton({ href, label, iconType, theme }) {
  if (!href) return null;

  const outer = {
    height: "4.0rem",
    width: "4.0rem",
    borderRadius: "999px",
    padding: "2px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    boxShadow: `0 10px 28px ${theme.shadow}`,
    ...ringStyle(theme, theme.socialRing),
  };

  const inner = {
    height: "100%",
    width: "100%",
    borderRadius: "999px",
    background: theme.surface,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.icon,
  };

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} style={outer} className="l6-click">
      <span style={inner}>
        <SocialIcon type={iconType} />
      </span>
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

  // Backward-compatible description keys
  const description =
    p.description ||
    p.dropDescription ||
    p.details ||
    p.body ||
    p.desc ||
    "";

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
  const soldOut = left !== null && left <= 0;

  const startsAt = p.dropStartsAt ? new Date(p.dropStartsAt) : null;
  const endsAt = p.dropEndsAt ? new Date(p.dropEndsAt) : null;

  let phase = "open";
  if (startsAt && now < startsAt) phase = "upcoming";
  else if (endsAt && now >= endsAt) phase = "ended";

  const isEnded = soldOut || phase === "ended";

    // If we're sold out / ended, do not keep showing a live countdown.
  if (isEnded) {
    showTimer = false;
    timerTitle = "";
  }

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

  let inventoryText = "";
  if (p.showInventory && left !== null) {
    inventoryText = `Only ${left} left!`;
  }

  const isPastel = theme.key === "pastel";

  // Pastel-only: white product shell (houses image + all drop content)
  const dropShellBg = isPastel ? "#fdf9f5" : theme.surface;

  const card = {
    width: "100%",
    maxWidth: "420px",
    margin: "0 auto 1.35rem",
    boxSizing: "border-box",
    textAlign: "center",
  };

  const dropShell = {
    borderRadius: "24px",
    background: dropShellBg,
    border: `1px solid ${theme.border}`,
    boxShadow: `${ELEVATION.hero} ${theme.shadow}`,
    overflow: "hidden",
  };

  const imageArea = {
    padding: "14px 14px 0",
    background: dropShellBg,
    boxSizing: "border-box",
  };

 const heroFrame = {
  borderRadius: "18px",
  overflow: "hidden",
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  boxShadow: `${ELEVATION.soft} ${theme.shadow}`,

  // Make the frame adapt to the image (no forced square)
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const heroImg = {
  width: "100%",
  height: "auto",
  display: "block",

  // Prevent super-tall images from taking over the whole page
  maxHeight: "520px",
  objectFit: "contain",
};

  const heroPlaceholder = {
    width: "100%",
    minHeight: "220px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: theme.textMuted,
    fontSize: "1rem",
    background: theme.surface,
  };

  const body = {
    padding: "14px 18px 18px",
    boxSizing: "border-box",
  };

  const titleStyle = { fontSize: "1.35rem", fontWeight: 900, margin: "0.35rem 0 0.25rem", color: theme.text };

  const priceStyle = {
    fontSize: "1.35rem",
    fontWeight: 900,
    margin: "0 0 0.1rem",
    color: theme.accent,
  };

  const inventoryStyle = {
    fontSize: "0.95rem",
    fontWeight: 900,
    color: theme.buttonFill, // “Only X left!” matches button color (Pastel coral, Launch6 purple, Modern blue)
    margin: "0 0 0.75rem",
  };

  const descStyle = {
    fontSize: "0.95rem",
    lineHeight: 1.55,
    color: theme.textMuted,
    margin: "0 0 1.05rem",
    whiteSpace: "pre-line",
    padding: "0 0.15rem",
  };

  const timerCard = {
    borderRadius: "18px",
    padding: "10px 14px 12px",
    margin: "0 auto 1.05rem",
    maxWidth: "360px",
    border: `2px solid ${theme.accent}`,
    background: dropShellBg,
    boxShadow: `${ELEVATION.soft} ${theme.shadow}`,
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

  const button = {
    width: "100%",
    borderRadius: "999px",
    padding: "0.92rem 1.1rem",
    fontSize: "0.98rem",
    fontWeight: 900,
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0.2rem auto 0",
    boxSizing: "border-box",
    background: theme.buttonFill,
    color: theme.buttonText,
    boxShadow: `${ELEVATION.card} ${theme.shadow}`,
  };

  const buttonDisabled = {
    ...button,
    background: "rgba(148,163,184,0.35)",
    color: theme.key === "launch6" ? "rgba(255,255,255,0.75)" : "rgba(36,44,63,0.65)",
    boxShadow: "none",
    cursor: "default",
    opacity: 0.8,
  };

  return (
    <article style={card}>
      <div style={dropShell}>
        <div style={imageArea}>
          <div style={heroFrame}>
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

{(priceDisplay || p?.priceDisplay || p?.priceText) && (
  <p style={priceStyle}>{priceDisplay || p?.priceDisplay || p?.priceText}</p>
)}

          {inventoryText && <p style={inventoryStyle}>{inventoryText}</p>}

          {description && <p style={descStyle}>{description}</p>}

          {(timerTitle || showTimer) && (
            <div style={timerCard}>
              {timerTitle && <p style={timerLabel}>{timerTitle}</p>}

              {showTimer ? (
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
              ) : null}
            </div>
          )}

          {isEnded ? (
            <button type="button" style={buttonDisabled} disabled>
              Drop ended
            </button>
          ) : (
            <a href={buyHref} style={button} className="l6-btn">
              {buttonText}
            </a>
          )}
        </div>
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
    // If we return from checkout with ?success=1, force an immediate refresh
    // and then clean the URL so it doesn't retrigger.
    try {
      if (typeof window !== "undefined") {
        const u = new URL(window.location.href);
        if (u.searchParams.get("success") === "1") {
          fetchAll(slug, { trackView: false }).catch(() => {});
          u.searchParams.delete("success");
          window.history.replaceState({}, "", u.toString());
        }
      }
    } catch {}

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

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.l6.io";
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

  const SECTION_GAP = "1.35rem";
  const HEADER_STACK_SPACING = "0.75rem";

  const linkPill = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.95rem 1.2rem",
    borderRadius: "16px",
    background: theme.linkFill,
    color: theme.linkText,
    border: `1px solid ${theme.linkBorder || theme.linkFill}`,
    textDecoration: "none",
    fontSize: "0.98rem",
    fontWeight: 900,
    boxShadow: `${ELEVATION.card} ${theme.shadow}`,
    boxSizing: "border-box",
  };

  const inputWrapBase = {
    width: "100%",
    maxWidth: "420px",
    margin: "0 auto",
    borderRadius: "9999px",
    backgroundColor: theme.inputBg,
    overflow: "hidden",
    boxSizing: "border-box",
    boxShadow:
      theme.inputBorder === "transparent"
        ? "none"
        : `inset 0 0 0 1px ${theme.inputBorder}`,
  };

  const inputBase = {
    width: "100%",
    border: "none",
    backgroundColor: "transparent",
    padding: "0.92rem 1.1rem",
    fontSize: "1.02rem",
    color: theme.text,
    outline: "none",
    boxSizing: "border-box",
  };

  const joinButton = {
    border: "none",
    padding: "0 1.35rem",
    fontSize: "1.02rem",
    fontWeight: 900,
    cursor: submitting ? "default" : "pointer",
    opacity: submitting ? 0.78 : 1,
    background: theme.buttonFill, // coral in pastel
    color: theme.buttonText,
  };

  const poweredStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.55rem",
    padding: "0.28rem 0.55rem",
    borderRadius: "999px",
    textDecoration: "none",
    color: theme.textMuted,
    fontSize: "0.85rem",
    fontWeight: 800,
    background: "rgba(0,0,0,0)",
    border: `1px solid ${theme.border}`,
    boxShadow: `${ELEVATION.soft} ${theme.shadow}`,
  };

  const footerLinkBtn = {
    textDecoration: "underline",
    background: "transparent",
    border: "none",
    color: theme.textMuted,
    cursor: "pointer",
    fontWeight: 700,
  };

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

      <div className="l6-page">
        <div className="l6-card">
          {loading ? (
            <div style={{ padding: "56px 20px", textAlign: "center", color: theme.textMuted, fontWeight: 800 }}>
              Loading…
            </div>
          ) : error ? (
            <div style={{ padding: "28px 20px" }}>
              <div
                style={{
                  borderRadius: "16px",
                  border: `1px solid ${theme.border}`,
                  background: theme.surface,
                  padding: "16px",
                  bboxShadow: `${ELEVATION.hero} ${theme.shadow}`,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: "6px", color: theme.text }}>Can’t load page</div>
                <div style={{ fontSize: "14px", color: theme.textMuted }}>{error}</div>
              </div>
            </div>
          ) : (
            <main className="l6-inner">
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
                          ...ringStyle(theme, theme.avatarRing || theme.socialRing),
                          display: "inline-block",
                          boxShadow: `0 18px 48px ${theme.shadow}`,
                        }}
                      >
                        <img
                          src={avatarUrl}
                          alt={title || "Avatar"}
                          style={{
                            height: "6.8rem",
                            width: "6.8rem",
                            borderRadius: "999px",
                            objectFit: "cover",
                            display: "block",
                            backgroundColor: theme.surface,
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          height: "6.4rem",
                          width: "6.4rem",
                          borderRadius: "999px",
                          backgroundColor: theme.surface,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: "2.2rem",
                          boxShadow: `0 18px 48px ${theme.shadow}`,
                          ...ringStyle(theme, theme.avatarRing || theme.socialRing),
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
                      lineHeight: 1.15,
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
                        fontSize: "0.98rem",
                        lineHeight: 1.5,
                        margin: `0 0 ${HEADER_STACK_SPACING}`,
                        whiteSpace: "pre-line",
                        maxWidth: "26rem",
                      }}
                    >
                      {bio}
                    </p>
                  ) : null}

                  {/* Social icons */}
                  {hasSocialRow && (
                    <div style={{ display: "flex", justifyContent: "center", gap: "0.85rem", flexWrap: "wrap" }}>
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
                <section style={{ width: "100%", marginBottom: SECTION_GAP }}>
                  {products.map((p) => (
                    <DropCard key={p.id} product={p} slug={slug} theme={theme} />
                  ))}
                </section>
              )}

              {/* EMAIL CAPTURE */}
              {canCollectEmail && (
                <section style={{ width: "100%", margin: `0 auto ${SECTION_GAP}`, textAlign: "center" }}>
                  <h2
                    style={{
                      margin: "0 0 0.95rem",
                      fontSize: "1.25rem",
                      fontWeight: 900,
                      lineHeight: 1.2,
                      color: theme.text,
                    }}
                  >
                    {(profile?.formHeadline || profile?.emailHeadline || "Get first dibs on drops").trim()}
                  </h2>

                  {!subscribed ? (
                    <form
                      onSubmit={handleSubscribe}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                        position: "relative",
                        alignItems: "center",
                      }}
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
                        <div style={{ ...inputWrapBase }}>
                          <input
                            type="text"
                            autoComplete="name"
                            style={inputBase}
                            placeholder="Full name (optional)"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                          />
                        </div>
                      )}

                      <div
                        style={{
                          ...inputWrapBase,
                          display: "flex",
                          alignItems: "stretch",
                        }}
                      >
                        <input
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          style={{ ...inputBase, flex: 1, minWidth: 0 }}
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (emailErr) setEmailErr("");
                          }}
                          aria-invalid={!!emailErr}
                          aria-describedby={emailErr ? "email-error" : undefined}
                        />

                        <button type="submit" disabled={submitting} style={joinButton} className="l6-btn">
                          {submitting ? "Joining…" : "Join"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div
                      style={{
                        borderRadius: "14px",
                        background: "rgba(255,255,255,0.20)",
                        padding: "10px 12px",
                        fontSize: "0.92rem",
                        color: theme.text,
                        boxShadow: `0 10px 26px ${theme.shadow}`,
                        maxWidth: "420px",
                        margin: "0 auto",
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
                      return (
                        <a
                          key={l.id || l.url}
                          href={safeHref}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          referrerPolicy="no-referrer"
                          style={linkPill}
                          className="l6-link"
                        >
                          <span>{label}</span>
                          <span style={{ fontSize: "0.85rem", opacity: 0.92 }}>↗</span>
                        </a>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* FOOTER */}
              <footer style={{ fontSize: "0.9rem", color: theme.textMuted, paddingBottom: "2.0rem", width: "100%", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.05rem" }}>
                  <a
                    href="https://launch6.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Powered by Launch6"
                    style={poweredStyle}
                    className="l6-link"
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
                  <button type="button" style={footerLinkBtn}>
                    Cookie preferences
                  </button>
                  <button type="button" style={footerLinkBtn}>
                    Report page
                  </button>
                  <button type="button" style={footerLinkBtn}>
                    Privacy
                  </button>
                </div>
              </footer>
            </main>
          )}
        </div>

        {/* Responsive “full-bleed mobile, floating card desktop” */}
        <style jsx global>{`
          html,
          body {
            padding: 0;
            margin: 0;
          }
          body {
            background: ${theme.bg};
          }

          .l6-page {
            min-height: 100vh;
            background: ${theme.bg};
            display: block;
          }

          /* Mobile: full-bleed, no outer margins, no corner rounding */
          .l6-card {
            min-height: 100vh;
            width: 100%;
            background: ${theme.surface}; /* Pastel outside container = #fdf4ee */
            border-radius: 0;
            margin: 0;
            box-shadow: none;
          }

          .l6-inner {
            padding: 34px 18px 0;
            text-align: center;
            color: ${theme.text};
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
          }

          /* Desktop/Tablet: floating centered card */
          @media (min-width: 768px) {
            .l6-page {
              padding: 28px 16px;
            }
            .l6-card {
              max-width: 450px;
              margin: 0 auto;
              border-radius: 40px;
              border: 1px solid ${theme.border};
              box-shadow: ${ELEVATION.float} ${theme.shadow};
              overflow: hidden;
            }
            .l6-inner {
              padding: 40px 26px 0;
            }
          }

          /* Premium micro-interactions */
          .l6-btn,
          .l6-link,
          .l6-click {
            transition: transform 120ms ease, filter 120ms ease, opacity 120ms ease;
            will-change: transform;
          }
          @media (hover: hover) and (pointer: fine) {
            .l6-btn:hover,
            .l6-link:hover,
            .l6-click:hover {
              transform: translateY(-1px);
              filter: brightness(1.02);
            }
          }
        `}</style>
      </div>
    </>
  );
}

export async function getServerSideProps() {
  // Force SSR so any slug resolves at request time.
  return { props: {} };
}
