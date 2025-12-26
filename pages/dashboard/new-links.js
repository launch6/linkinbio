// pages/dashboard/new-links.js
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

// SVGs for each social – line art, color controlled via CSS (currentColor)
const SocialIconMap = {
  instagram: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <path d="M16 11.5A4 4 0 1 1 12.5 8 4 4 0 0 1 16 11.5z" />
      <circle cx="17.5" cy="6.5" r="0.75" />
    </svg>
  ),
  facebook: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2h-2.5A3.5 3.5 0 0 0 9 5.5V9H6v4h3v8h4v-8h3l1-4h-4V5.5A1.5 1.5 0 0 1 14.5 4H18V2z" />
    </svg>
  ),
  tiktok: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path
        d="M17 6c.5 1.6 1.7 2.7 3.3 3.1L21 9.3V12c-1.3 0-2.6-.4-3.7-1.1v3.8a5.2 5.2 0 1 1-4.7-5.2V11a2.2 2.2 0 0 0-1.7-.2 2.1 2.1 0 1 0 2.2 2.1V6h3z"
        transform="translate(12 12) scale(1.2) translate(-12 -12)"
      />
    </svg>
  ),
  youtube: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <polygon points="10 9 16 12 10 15 10 9" fill="currentColor" stroke="none" />
    </svg>
  ),
  x: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4l14 16" />
      <path d="M5 20L19 4" />
    </svg>
  ),
  website: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9z" />
    </svg>
  ),
};

const SOCIAL_CONFIG = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'x', label: 'X' },
  { key: 'website', label: 'Website' },
];

const THEME_CONFIG = [
  {
    key: 'launch6',
    label: 'Launch6',
    left: '#000000',
    right: '#A855F7',
  },
  {
    key: 'pastel',
    label: 'Pastel Dreams',
    left: '#B9E2F5',
    right: '#FFD1DC',
  },
  {
    key: 'modern',
    label: 'Modern Pro',
    left: '#FFFFFF',
    right: '#2563EB',
  },
];

const getSocialBaseUrl = (key) => {
  switch (key) {
    case 'instagram':
      return 'https://www.instagram.com/';
    case 'facebook':
      return 'https://www.facebook.com/';
    case 'tiktok':
      return 'https://www.tiktok.com/@';
    case 'youtube':
      return 'https://www.youtube.com/';
    case 'x':
      return 'https://x.com/';
    case 'website':
      return '';
    default:
      return 'https://';
  }
};

const isSocialComplete = (key, urls) => {
  const base = getSocialBaseUrl(key);
  const val = urls[key];
  return !!val && val.length > base.length;
};

const normalizeLinkUrl = (value) => {
  let url = (value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
};

const isValidLinkUrl = (value) => {
  const normalized = normalizeLinkUrl(value);
  try {
    const parsed = new URL(normalized);
    return !!parsed.hostname && parsed.hostname.includes('.');
  } catch {
    return false;
  }
};

export default function NewLinks() {
  const router = useRouter();
  const { token } = router.query;

  const [links, setLinks] = useState([{ id: 1, label: 'Shop my latest pieces', url: '' }]);

  const [socialUrls, setSocialUrls] = useState({
    instagram: '',
    facebook: '',
    tiktok: '',
    youtube: '',
    x: '',
    website: '',
  });

  const [activeSocialKey, setActiveSocialKey] = useState('instagram');
  const [themeKey, setThemeKey] = useState('launch6');
  const [saving, setSaving] = useState(false);
  const [linkError, setLinkError] = useState('');
  const draggingIdRef = useRef(null);

  const hydratedOnceRef = useRef(false);

  // Hydrate Step 2 from DB so Back works and state persists across reloads.
  
  // Theme persistence (safe UI-only): keep the selection while onboarding.
useEffect(() => {
  const t = token ? String(token) : '';
  const storageKey = t ? `l6_theme_${t}` : 'l6_theme_default';
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved && THEME_CONFIG.some((x) => x.key === saved)) {
      setThemeKey(saved);
    }
  } catch {}
}, [token]);

useEffect(() => {
  const t = token ? String(token) : '';
  const storageKey = t ? `l6_theme_${t}` : 'l6_theme_default';
  try {
    if (themeKey) localStorage.setItem(storageKey, themeKey);
  } catch {}
}, [token, themeKey]);

  useEffect(() => {
    if (!token) return;
    if (hydratedOnceRef.current) return;
    hydratedOnceRef.current = true;

    (async () => {
      try {
        const r = await fetch(
          `/api/profile/get?editToken=${encodeURIComponent(token)}`,
          { cache: 'no-store' }
        );
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok || !j?.profile) return;

        const prof = j.profile;

        const rawLinks = Array.isArray(prof.links)
          ? prof.links
          : Array.isArray(prof.linkButtons)
          ? prof.linkButtons
          : Array.isArray(prof.buttons)
          ? prof.buttons
          : [];

        const nextLinks =
          rawLinks.length > 0
            ? rawLinks.slice(0, 6).map((l, idx) => ({
                id: typeof l?.id === 'number' ? l.id : idx + 1,
                label: String(l?.label || '').slice(0, 80),
                url: String(l?.url || '').slice(0, 2000),
              }))
            : [{ id: 1, label: 'Shop my latest pieces', url: '' }];

        setLinks(nextLinks);

        const profSocial =
          prof.social && typeof prof.social === 'object' ? prof.social : {};
        const nextSocial = {
          instagram: String(profSocial.instagram || prof.instagram || ''),
          facebook: String(profSocial.facebook || prof.facebook || ''),
          tiktok: String(profSocial.tiktok || prof.tiktok || ''),
          youtube: String(profSocial.youtube || prof.youtube || ''),
          x: String(profSocial.x || prof.x || ''),
          website: String(profSocial.website || prof.website || ''),
        };
        setSocialUrls(nextSocial);

        const firstComplete =
          SOCIAL_CONFIG.find((net) => isSocialComplete(net.key, nextSocial))?.key ||
          'instagram';
        setActiveSocialKey(firstComplete);
      } catch {
        // silent — do not block onboarding UX
      }
    })();
  }, [token]);

  const usedSocialCount = SOCIAL_CONFIG.reduce(
    (count, net) => (isSocialComplete(net.key, socialUrls) ? count + 1 : count),
    0
  );

  const handleLinkChange = (id, field, value) => {
    setLinks((prev) => prev.map((link) => (link.id === id ? { ...link, [field]: value } : link)));
  };

  const handleRemoveLink = (id) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddRow = () => {
    setLinks((prev) => {
      if (prev.length >= 6) return prev;
      const numericIds = prev
        .map((l) => (typeof l.id === 'number' ? l.id : parseInt(String(l.id), 10)))
        .filter((n) => Number.isFinite(n));
      const nextId = numericIds.length ? Math.max(...numericIds) + 1 : 1;
      return [...prev, { id: nextId, label: '', url: '' }];
    });
  };

  // Step navigation helpers
  const goToStep1 = () => {
    // Change this if your Step 1 route differs
    const step1Path = '/dashboard/new';
    if (token) {
      window.location.href = `${step1Path}?token=${encodeURIComponent(token)}`;
    } else {
      window.location.href = step1Path;
    }
  };

  const goToStep3 = () => {
  if (token) {
    window.location.href = `/dashboard/new-drop?token=${encodeURIComponent(token)}`;
  } else {
    window.location.href = `/dashboard/new-drop`;
  }
};

  const handleSocialIconClick = (key) => {
    const complete = isSocialComplete(key, socialUrls);
    if (!complete && usedSocialCount >= 4) return;

    setActiveSocialKey(key);

    if (!socialUrls[key]) {
      const base = getSocialBaseUrl(key);
      setSocialUrls((prev) => ({ ...prev, [key]: base }));
    }
  };

  const handleActiveSocialUrlChange = (e) => {
    if (!activeSocialKey) return;

    let value = e.target.value;
    const base = getSocialBaseUrl(activeSocialKey);

    if (!value) {
      setSocialUrls((prev) => ({ ...prev, [activeSocialKey]: '' }));
      return;
    }

    if (value.length < base.length) {
      value = base;
    } else if (!value.startsWith(base)) {
      const tail = value.slice(base.length).replace(/\s+/g, '');
      value = base + tail;
    }

    setSocialUrls((prev) => ({ ...prev, [activeSocialKey]: value }));
  };

  const handleClearActiveSocial = () => {
    if (!activeSocialKey) return;
    setSocialUrls((prev) => ({ ...prev, [activeSocialKey]: '' }));
  };

  const activeSocialUrl =
    activeSocialKey && socialUrls[activeSocialKey] ? socialUrls[activeSocialKey] : '';

  const activeSocialPlaceholder = !activeSocialKey
    ? 'https://yourwebsite.com'
    : activeSocialKey === 'website'
    ? 'https://'
    : getSocialBaseUrl(activeSocialKey);

  const handleDragStart = (id) => (event) => {
    draggingIdRef.current = id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(id));
    }
  };

  const handleDragEnd = () => {
    draggingIdRef.current = null;
  };

  const handleDropOn = (targetId) => {
    const sourceId = draggingIdRef.current;
    if (!sourceId || sourceId === targetId) return;

    setLinks((prev) => {
      const sourceIndex = prev.findIndex((l) => l.id === sourceId);
      const targetIndex = prev.findIndex((l) => l.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    setLinkError('');

    const linksWithUrls = links.filter((l) => l.url.trim());
    if (linksWithUrls.length === 0) {
      setLinkError('Add at least one link URL before continuing.');
      return;
    }

    const invalidLinks = linksWithUrls.filter((l) => !isValidLinkUrl(l.url));
    if (invalidLinks.length > 0) {
      setLinkError(
        'One or more links have an invalid URL. Try something like backyardsofkeywest.com or https://example.com.'
      );
      return;
    }

    setSaving(true);

    try {
      const resp = await fetch('/api/profile/links-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
  
body: JSON.stringify({
  editToken: token || '',
  links,
  social: socialUrls,
  theme: themeKey,
}),

      });

      const json = await resp.json().catch(() => ({}));

      if (!resp.ok || !json?.ok) {
        const msg =
          json?.error === 'profile_not_found'
            ? 'We could not find your profile. Try going back to Step 1.'
            : 'There was a problem saving your links. Please try again.';
        alert(msg);
        setSaving(false);
        return;
      }

      goToStep3();
    } catch (err) {
      console.error(err);
      alert('Network error saving links. Please try again.');
      setSaving(false);
    }
  };

  return (
    <main className="onboarding-root">
      <div className="logo-row">
        <img src="/launch6_white.png" alt="Launch6" className="logo" />
      </div>

          <div className="progress-bar-container">
            <div className="progress-bar-fill" />
          </div>

          <p className="step-label">STEP 2 OF 4</p>
          <h1 className="title">Add links &amp; socials</h1>

          <div className="subtitle-block">
            <p className="subtitle-line">
              Let&apos;s light up your social icons and stack your content buttons.
            </p>
          </div>

          {/* SOCIALS */}
          <section className="social-section">
            <p className="section-label">YOUR SOCIAL ICONS</p>

            <div className="social-icon-row">
              {SOCIAL_CONFIG.map((net) => {
                const complete = isSocialComplete(net.key, socialUrls);
                const isDisabled = !complete && usedSocialCount >= 4;

                return (
                  <button
                    key={net.key}
                    type="button"
                    className={[
                      'social-icon-column',
                      complete ? 'social-icon-active' : '',
                      isDisabled ? 'social-icon-disabled' : '',
                      activeSocialKey === net.key ? 'social-icon-editing' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => handleSocialIconClick(net.key)}
                    disabled={isDisabled}
                  >
                    <span className="social-icon-circle">
                      <span className="social-icon-svg-wrapper">
                        {SocialIconMap[net.key]}
                      </span>
                    </span>
                    <span className="social-icon-label">{net.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="social-helper-text">Choose up to 4 icons.</p>

            {activeSocialKey && (
              <div className="social-url-pill">
                <span className="social-url-pill-icon">
                  <span className="social-icon-svg-wrapper social-pill-svg">
                    {SocialIconMap[activeSocialKey]}
                  </span>
                </span>
                <input
                  type="text"
                  className="social-url-input"
                  placeholder={activeSocialPlaceholder}
                  value={activeSocialUrl}
                  onChange={handleActiveSocialUrlChange}
                />
                {activeSocialUrl && (
                  <button
                    type="button"
                    className="social-url-clear"
                    onClick={handleClearActiveSocial}
                    aria-label="Clear social URL"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
          </section>

          {/* LINKS */}
          {/* THEME */}
<section className="theme-section">
  <p className="section-label">CHOOSE YOUR THEME</p>

  <div className="theme-shell">
    <div className="theme-row">
      {THEME_CONFIG.map((t) => {
        const selected = themeKey === t.key;
        return (
          <button
            key={t.key}
            type="button"
            className={['theme-btn', selected ? 'theme-selected' : ''].filter(Boolean).join(' ')}
            onClick={() => setThemeKey(t.key)}
            aria-pressed={selected}
          >
            <span className="theme-swatch" aria-hidden="true">
  <span className="theme-half theme-half-left" style={{ background: t.left }} />
  <span className="theme-half theme-half-right" style={{ background: t.right }} />
  {selected && <span className="theme-check">✓</span>}
</span>

            <span className="theme-label">{t.label}</span>
          </button>
        );
      })}
    </div>
  </div>
</section>

{/* LINKS */}
<form onSubmit={handleSubmit} className="form">

            <section className="links-section">
              <div className="links-header-row">
                <p className="section-label">LINK BUTTONS</p>
                <p className="links-header-helper">Add key links. Drag to reorder.</p>
              </div>

              <div className="links-list">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="link-card"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropOn(link.id)}
                  >
                    <div
                      className="drag-handle"
                      aria-hidden="true"
                      draggable
                      onDragStart={handleDragStart(link.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <span className="drag-dots">⋮⋮</span>
                    </div>

                    <div className="link-inputs-wrapper">
                      <input
                        type="text"
                        className="link-input link-label-input"
                        placeholder="Shop my latest pieces"
                        value={link.label}
                        onChange={(e) => handleLinkChange(link.id, 'label', e.target.value)}
                      />
                      <input
                        type="text"
                        className="link-input link-url-input"
                        placeholder="https://..."
                        value={link.url}
                        onChange={(e) => handleLinkChange(link.id, 'url', e.target.value)}
                      />
                    </div>

                    <button
                      type="button"
                      className="link-remove"
                      onClick={() => handleRemoveLink(link.id)}
                      aria-label="Remove link"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button type="button" className="add-link-button" onClick={handleAddRow}>
                + Add another link
              </button>

              {linkError && <p className="field-error">{linkError}</p>}
            </section>

                          <div className="actions-row content-rail">
                <button
                  type="button"
                  className="btn btn-secondary btn-flex"
                  onClick={goToStep1}
                  disabled={saving}
                >
                  ← Back
                </button>

                <button
                  type="submit"
                  className="btn btn-primary btn-flex"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Continue'}
                </button>
              </div>

            <p className="footer-note">
              You can always edit links and socials later from your dashboard.
            </p>
          </form>
        </div>
      </div>

      <style jsx>{`
        :global(html),
        :global(body) {
          background-color: #121219;
          margin: 0;
          padding: 0;
        }

        .onboarding-root {
          min-height: 100vh;
          background-color: #121219;
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px 16px 40px;
          font-family: ${fontStack};
        }

        .logo-row {
          margin-bottom: 15px;
        }

        .logo {
          height: 48px;
          width: auto;
        }

        .card {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .card-inner {
          width: 100%;
          max-width: 540px;
          background: rgba(9, 9, 18, 0.96);
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
          padding: 32px 40px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        @media (max-width: 600px) {
          .card-inner {
            padding: 28px 18px 24px;
            border-radius: 24px;
          }
        }

                  .actions-row {
            width: 100%;
            display: flex;
            gap: 14px;
            margin-top: 18px;
          }

          .btn-flex {
            flex: 1;
          }

          .btn-secondary {
            background: rgba(255, 255, 255, 0.06);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.14);
            box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
          }

          .btn-secondary:disabled {
            opacity: 0.7;
            cursor: default;
            box-shadow: none;
          }

          .btn-secondary:not(:disabled):active {
            transform: translateY(1px);
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
          }

          @media (max-width: 600px) {
            .actions-row {
              flex-direction: column;
            }
          }

        .progress-bar-container {
          width: 100%;
          max-width: 260px;
          height: 4px;
          background: #252837;
          border-radius: 2px;
          margin: 0 auto 16px;
        }

        .progress-bar-fill {
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, #6366ff, #a855f7);
          border-radius: 2px;
        }

        .step-label {
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #8b8fa5;
          margin-bottom: 8px;
          margin-top: 0;
        }

        .title {
          font-size: 28px;
          font-weight: 700;
          margin: 0 0 10px;
          text-align: center;
        }

        .subtitle-block {
          text-align: center;
          width: 100%;
          margin-bottom: 24px;
        }

        .subtitle-line {
          font-size: 16px;
          color: #ffffff;
          margin: 0;
          line-height: 1.5;
          font-weight: 400;
        }

        .form {
          width: 100%;
          margin-top: 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .content-rail {
          width: 100%;
          max-width: 100%;
        }

        .social-section {
          width: 100%;
          margin-bottom: 26px;
        }
          .theme-section {
  width: 100%;
  margin-bottom: 18px;
}

.theme-shell {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid #2e3247;
  border-radius: 18px;
  padding: 14px 12px;
}

.theme-row {
  display: flex;
  justify-content: center;
  gap: 22px;
  flex-wrap: wrap;
}

.theme-btn {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.theme-swatch {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35);
  position: relative;
  overflow: hidden; /* prevents edge sliver */
  background: transparent;
}
  .theme-half {
  position: absolute;
  top: 0;
  bottom: 0;
  display: block;
}

/* slight overlap prevents the thin seam/sliver */
.theme-half-left {
  left: 0;
  width: calc(50% + 1px);
}

.theme-half-right {
  right: 0;
  width: calc(50% + 1px);
}

.theme-selected .theme-swatch {
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.55), 0 10px 26px rgba(0, 0, 0, 0.35);
  transform: scale(1.02);
}

.theme-check {
  position: absolute;
  right: 4px;
  top: 4px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.24);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #ffffff;
  z-index: 3;
  pointer-events: none;
}

.theme-label {
  font-size: 12px;
  color: #d0d2ff;
}

        .section-label {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #a1a4c0;
          margin: 0 0 16px;
          text-align: center;
        }

        .social-icon-row {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .social-icon-column {
          background: transparent;
          border: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }

        .social-icon-column:disabled {
          cursor: default;
        }

        .social-icon-circle {
          width: 52px;
          height: 52px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #26293b;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
          transition: all 0.2s ease;
        }

        .social-icon-svg-wrapper {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #c4c7ff;
        }

        .social-icon-label {
          font-size: 11px;
          color: #d0d2ff;
        }

        .social-icon-active .social-icon-circle {
          background: linear-gradient(45deg, #a855f7, #6366ff);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.14),
            0 6px 16px rgba(80, 60, 200, 0.6);
        }

        .social-icon-active .social-icon-svg-wrapper {
          color: #ffffff;
        }

        .social-icon-disabled .social-icon-circle {
          opacity: 0.3;
        }

        .social-icon-editing .social-icon-circle {
          box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.5),
            0 6px 16px rgba(80, 60, 200, 0.6);
          transform: scale(1.05);
        }

        .social-helper-text {
          font-size: 12px;
          color: #8b8fa5;
          margin: 4px 0 14px;
          text-align: center;
        }

        .field-error {
          margin-top: 6px;
          font-size: 12px;
          color: #f97373;
          text-align: left;
          padding-left: 4px;
        }

        .social-url-pill {
          width: 100%;
          border-radius: 999px;
          background: #181a26;
          border: 1px solid #34384f;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .social-url-pill-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: 18px;
          margin-right: 10px;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: linear-gradient(90deg, #6366ff, #a855f7);
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
        }

        .social-pill-svg {
          color: #ffffff;
        }

        .social-url-input {
          flex: 1;
          border: none;
          background: transparent;
          color: #ffffff;
          font-family: ${fontStack};
          font-size: 14px;
          outline: none;
          padding: 10px 0;
        }

        .social-url-input::placeholder {
          color: #8b8fa5;
        }

        .social-url-clear {
          border: none;
          background: transparent;
          color: #8b8fa5;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          margin-right: 16px;
          transition: color 0.15s ease;
        }

        .social-url-clear:hover {
          color: #ffffff;
        }

        .links-section {
          width: 100%;
          margin-top: 22px;
        }

        .links-header-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .links-header-helper {
          font-size: 12px;
          color: #8b8fa5;
          margin: 0;
        }

        .links-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .link-card {
          display: flex;
          align-items: center;
          background: #1c1f2e;
          border-radius: 16px;
          padding: 8px 10px;
          border: 1px solid #2e3247;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }

        .drag-handle {
          width: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #62667f;
          cursor: grab;
          margin-right: 8px;
        }

        .drag-handle:active {
          cursor: grabbing;
        }

        .drag-dots {
          font-size: 20px;
          line-height: 1;
        }

        .link-inputs-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 4px 8px 4px 4px;
        }

        .link-input {
          border: none;
          background: transparent;
          font-family: ${fontStack};
          outline: none;
          padding: 0;
        }

        .link-label-input {
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
        }

        .link-url-input {
          font-size: 14px;
          color: #ffffff;
          opacity: 0.9;
        }

        .link-input::placeholder {
          color: #737799;
        }

        .link-remove {
          border: none;
          background: transparent;
          color: #a1a4c0;
          font-size: 20px;
          cursor: pointer;
          padding: 0 6px;
        }

        .link-remove:hover {
          color: #ff4b81;
        }

        .add-link-button {
          margin-top: 10px;
          border: none;
          background: transparent;
          color: #c4c6ff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          padding: 0;
        }

        .add-link-button:hover {
          text-decoration: underline;
        }

        .actions-row {
          margin-top: 28px;
          display: flex;
        }

        .btn {
          flex: 1;
          border-radius: 999px;
          border: none;
          font-family: ${fontStack};
          font-size: 14px;
          font-weight: 500;
          padding: 12px 16px;
          cursor: pointer;
          transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease;
        }

        .btn-primary {
          background: linear-gradient(90deg, #6366ff, #a855f7);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(88, 92, 255, 0.55);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: default;
          box-shadow: none;
        }

        .btn-primary:not(:disabled):active {
          transform: translateY(1px);
          box-shadow: 0 4px 14px rgba(88, 92, 255, 0.4);
        }

        .btn-full-width {
          width: 100%;
        }

        .footer-note {
          margin-top: 18px;
          font-size: 12px;
          color: #8b8fa5;
          text-align: center;
          max-width: 100%;
        }
      `}</style>
    </main>
  );
}
