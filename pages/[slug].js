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
      if (refreshIntervalRef.current)
        clearInterval(refreshIntervalRef.current);
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
    if (
      p.showInventory &&
      total !== null &&
      left !== null
    ) {
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
      setEmailErr(
        "Please enter a valid email (e.g., name@example.com)."
      );
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

  const title =
    profile?.displayName || profile?.name || "Artist";
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

  // --- SEO / Social ---
  const firstImage = products?.[0]?.imageUrl || "";
  const site = "https://linkinbio-tau-pink.vercel.app";
  const pageUrl = slug
    ? `${site}/${encodeURIComponent(slug)}`
    : site;
  const seoTitle = title ? `${title} — Drops` : "Drops";
  const left0 = toNumberOrNull(products?.[0]?.unitsLeft);
  const total0 = toNumberOrNull(products?.[0]?.unitsTotal);
  const leftPart =
    products?.[0]?.showInventory &&
    left0 != null &&
    total0 != null
      ? ` • ${left0}/${total0} left`
      : "";
  const seoDesc =
    (products?.[0]?.title
      ? `${products[0].title}${leftPart}`
      : "Limited releases and timed drops.") +
    (bio ? ` — ${bio}` : "");

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
        <div className="max-w-5xl mx-auto px-6 py-10">
          <header className="mb-8">
            <h1 className="text-4xl font-bold">{title}</h1>
            {bio ? (
              <p className="text-neutral-400 mt-2">{bio}</p>
            ) : null}
          </header>

          {/* Email capture (slug flow) */}
          {canCollectEmail && (
            <div className="mb-8 rounded-2xl border border-neutral-800 p-5">
              <div className="text-lg font-semibold mb-2">
                Get first dibs on drops
              </div>
              {!subscribed ? (
                <form
                  onSubmit={handleSubscribe}
                  className="flex flex-col sm:flex-row gap-3 items-stretch"
                >
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
                    aria-describedby={
                      emailErr ? "email-error" : undefined
                    }
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
                <div
                  id="email-error"
                  className="mt-2 text-sm text-rose-300"
                >
                  {emailErr}
                </div>
              ) : null}
              <div className="mt-2 text-xs text-neutral-500">
                We’ll only email you about releases. Unsubscribe
                anytime.
              </div>
            </div>
          )}

          {/* Products */}
          {products.length === 0 ? (
            <div className="opacity-70">
              No products are published yet.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
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
                    className="relative rounded-2xl border border-neutral-800 overflow-hidden"
                    aria-labelledby={`prod-${p.id}-title`}
                  >
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
                      <div className="absolute left-3 top-3">
                        <span
                          className={
                            "inline-block rounded-md border px-2 py-1 text-xs font-medium shadow-sm " +
                            (badgeClass[st.key] ||
                              badgeClass.active)
                          }
                          aria-live="polite"
                        >
                          {st.label ||
                            (st.key === "active" ? "Live" : "")}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <h2
                        id={`prod-${p.id}-title`}
                        className="text-xl font-semibold mb-1"
                      >
                        {p.title || "Untitled"}
                      </h2>

                      {/* Status line (secondary) */}
                      {st.label ? (
                        <div
                          className={
                            "text-sm mb-3 " +
                            (st.soldOut || st.ended
                              ? "text-rose-300"
                              : "text-emerald-300")
                          }
                        >
                          {st.label}
                        </div>
                      ) : null}

                      {showBuy ? (
                        <a
                          href={buyHref}
                          className="inline-flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-2 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          aria-label={`Buy ${
                            p.title || "this product"
                          }`}
                          onClick={() => {
                            try {
                              navigator.sendBeacon(
                                "/api/track",
                                new Blob(
                                  [
                                    JSON.stringify({
                                      type: "buy_click",
                                      productId: p.id,
                                      publicSlug:
                                        slug || null,
                                      ts: Date.now(),
                                      ref:
                                        typeof window !==
                                        "undefined"
                                          ? window.location
                                              .href
                                          : "",
                                    }),
                                  ],
                                  {
                                    type: "application/json",
                                  }
                                )
                              );
                            } catch {}
                          }}
                        >
                          Buy{" "}
                          <span className="text-xs opacity-70">
                            →
                          </span>
                        </a>
                      ) : (
                        <div
                          className="inline-flex items-center rounded-xl border border-neutral-800 px-4 py-2 text-neutral-400"
                          aria-disabled="true"
                          role="button"
                          tabIndex={-1}
                        >
                          {st.soldOut
                            ? "Sold out"
                            : st.ended
                            ? "Drop ended"
                            : "Unavailable"}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Links */}
          {links.length > 0 && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold mb-3">
                Links
              </h2>
              <div className="space-y-3">
                {links.map((l) => {
                  const label =
                    l.label || l.url || "Link";
                  return (
                    <a
                      key={l.id || l.url}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-neutral-800 px-4 py-3 bg-neutral-900/60 hover:bg-neutral-800 transition-colors"
                    >
                      <span>{label}</span>
                      <span className="text-xs opacity-60">
                        ↗
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps() {
  // Force SSR so any slug resolves at request time.
  return { props: {} };
}
