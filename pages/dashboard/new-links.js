import { useState, useRef } from 'react';
import { useRouter } from 'next/router';

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

// -------------------------------------------------------------------------
// SVG ICONS
// -------------------------------------------------------------------------
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
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
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
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  ),
  tiktok: (
    // FINAL CORRECTED: Line art of the stylized music note (matches screenshot)
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
      <path d="M9 1v17.4a.6.6 0 0 0 .6.6h.4a.6.6 0 0 0 .6-.6V9.4a.6.6 0 0 1 .6-.6h2.8a.6.6 0 0 0 .6-.6V1h-4.6v11.4c0 3.1-2.5 5.6-5.6 5.6H4c-3.1 0-5.6-2.5-5.6-5.6v-4c0-3.1 2.5-5.6 5.6-5.6h.5" />
    </svg>
  ),
  youtube: (
    // Line art screen with filled play button
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
      <rect x="3" y="5" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <polygon points="10 9 16 12 10 15 10 9" fill="currentColor" stroke="none" />
    </svg>
  ),
  x: (
    // FINAL CORRECTED: Line art of the stylized X logo (matches screenshot)
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
      <path d="M10 3L14 21M4 4L20 20" />
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
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
};

const SOCIAL_CONFIG = [
  { key: 'instagram', label: 'Instagram', short: 'IG' },
  { key: 'facebook', label: 'Facebook', short: 'Fb' },
  { key: 'tiktok', label: 'TikTok', short: 'TT' },
  { key: 'youtube', label: 'YouTube', short: 'YT' },
  { key: 'x', label: 'X', short: 'X' },
  { key: 'website', label: 'Website', short: 'WWW' },
];

// base URLs for locking prefixes
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
      return 'https://';
    default:
      return '';
  }
};

export default function NewLinks() {
  const router = useRouter();
  const { token } = router.query;

  const [links, setLinks] = useState([
    { id: 1, label: 'Shop my latest pieces', url: '' },
    { id: 2, label: 'Join my email list', url: '' },
  ]);

  const [socialUrls, setSocialUrls] = useState({
    instagram: '',
    facebook: '',
    tiktok: '',
    youtube: '',
    x: '',
    website: '',
  });

  const [activeSocialKey, setActiveSocialKey] = useState('instagram');
  const [saving, setSaving] = useState(false);
  const draggingIdRef = useRef(null);

  // count only complete socials (more than base URL)
  const usedSocialCount = Object.entries(socialUrls).filter(([key, url]) => {
    const base = getSocialBaseUrl(key);
    return !!url && url !== base;
  }).length;

  const handleLinkChange = (id, field, value) => {
    setLinks((prev) =>
      prev.map((link) =>
        link.id === id ? { ...link, [field]: value } : link
      )
    );
  };

  const handleRemoveLink = (id) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddRow = () => {
    setLinks((prev) => {
      if (prev.length >= 6) return prev;
      const nextId = prev.length ? Math.max(...prev.map((l) => l.id)) + 1 : 1;
      return [...prev, { id: nextId, label: '', url: '' }];
    });
  };

  const goToEditor = () => {
    if (saving) return;
    setSaving(true);

    // TODO: POST socials + links later
    if (token) {
      window.location.href = `/dashboard/${token}`;
    } else {
      window.location.href = `/dashboard`;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    goToEditor();
  };

  const handleSkip = (e) => {
    e.preventDefault();
    goToEditor();
  };

  // --- SOCIAL ICONS ---

  const handleSocialIconClick = (key) => {
    const baseUrl = getSocialBaseUrl(key);
    const url = socialUrls[key] || '';
    const isActive = !!url && url !== baseUrl;

    // enforce 4-complete-icons max
    if (!isActive && usedSocialCount >= 4) return;

    setActiveSocialKey(key);

    // prefill base if empty
    if (!socialUrls[key]) {
      setSocialUrls((prev) => ({
        ...prev,
        [key]: baseUrl,
      }));
    }
  };

  // lock prefix so user can only edit after it
  const handleActiveSocialUrlChange = (e) => {
    if (!activeSocialKey) return;
    const base = getSocialBaseUrl(activeSocialKey);
    const raw = e.target.value ?? '';

    let suffix = '';
    if (raw.length <= base.length) {
      // they tried to backspace into the prefix area – keep base only
      suffix = '';
    } else if (raw.startsWith(base)) {
      suffix = raw.slice(base.length);
    } else {
      // if they typed something weird, treat it as suffix and reattach base
      suffix = raw;
    }

    const next = base + suffix;

    setSocialUrls((prev) => ({
      ...prev,
      [activeSocialKey]: next,
    }));
  };

  const handleClearActiveSocial = () => {
    if (!activeSocialKey) return;
    setSocialUrls((prev) => ({
      ...prev,
      [activeSocialKey]: '',
    }));
  };

  const activeSocialUrl = activeSocialKey ? socialUrls[activeSocialKey] || '' : '';

  // --- DRAG & DROP ---

  const handleDragStart = (id) => {
    draggingIdRef.current = id;
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

  const activeSocialPlaceholder = activeSocialKey
    ? getSocialBaseUrl(activeSocialKey) + 'yourname'
    : 'https://...';

  return (
    <main className="onboarding-root">
      <div className="logo-row">
        <img src="/launch6_white.png" alt="Launch6" className="logo" />
      </div>

      <div className="card">
        <div className="card-inner">
          <div className="progress-bar-container">
            <div className="progress-bar-fill" />
          </div>

          <p className="step-label">STEP 2 OF 3</p>
          <h1 className="title">Add links &amp; socials</h1>

          <div className="subtitle-block">
            <p className="subtitle-line">
              Let&apos;s light up your social icons and stack your content buttons.
            </p>
          </div>

          {/* SOCIAL ICONS */}
          <section className="social-section">
            <p className="section-label">YOUR SOCIAL ICONS</p>

            <div className="social-icon-row">
              {SOCIAL_CONFIG.map((net) => {
                const baseUrl = getSocialBaseUrl(net.key);
                const url = socialUrls[net.key] || '';
                const isActive = !!url && url !== baseUrl;
                const isDisabled = !isActive && usedSocialCount >= 4;

                return (
                  <button
                    key={net.key}
                    type="button"
                    className={[
                      'social-icon-column',
                      isActive ? 'social-icon-active' : '',
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
                        {SocialIconMap[net.key] || (
                          <span className="social-icon-fallback">
                            {net.short}
                          </span>
                        )}
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
                  {/* same SVG icon inside the pill */}
                  <span className="social-url-pill-icon-inner">
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
                {activeSocialUrl &&
                  activeSocialUrl !== getSocialBaseUrl(activeSocialKey) && (
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

          {/* LINKS UNDER ART */}
          <form onSubmit={handleSubmit} className="form">
            <section className="links-section">
              <div className="links-header-row">
                <p className="section-label">LINK BUTTONS</p>
                <p className="links-header-helper">
                  Add key links. Drag to reorder.
                </p>
              </div>

              <div className="links-list">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="link-card"
                    draggable
                    onDragStart={() => handleDragStart(link.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropOn(link.id)}
                  >
                    <div className="drag-handle" aria-hidden="true">
                      <span className="drag-dots">⋮⋮</span>
                    </div>

                    <div className="link-inputs-wrapper">
                      <input
                        type="text"
                        className="link-input link-label-input"
                        placeholder="Shop my latest pieces"
                        value={link.label}
                        onChange={(e) =>
                          handleLinkChange(link.id, 'label', e.target.value)
                        }
                      />
                      <input
                        type="text"
                        className="link-input link-url-input"
                        placeholder="https://..."
                        value={link.url}
                        onChange={(e) =>
                          handleLinkChange(link.id, 'url', e.target.value)
                        }
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

              <button
                type="button"
                className="add-link-button"
                onClick={handleAddRow}
              >
                + Add another link
              </button>
            </section>

            <div className="actions-row content-rail">
              <button
                type="submit"
                className="btn btn-primary btn-full-width"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Continue'}
              </button>
            </div>

            <button
              type="button"
              className="skip-link-button"
              onClick={handleSkip}
              disabled={saving}
            >
              Skip for now
            </button>

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

        .progress-bar-container {
          width: 100%;
          max-width: 250px;
          height: 4px;
          background: #252837;
          border-radius: 2px;
          margin: 0 auto 16px;
        }

        .progress-bar-fill {
          width: 66.6%;
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

        /* SOCIALS */

        .social-section {
          width: 100%;
          margin-bottom: 26px;
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
          width: 48px;
          height: 48px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #26293b;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
          transition: all 0.2s ease;
        }

        .social-icon-svg-wrapper {
          color: #c4c7ff;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .social-icon-fallback {
          font-size: 14px;
          font-weight: 600;
        }

        .social-icon-label {
          font-size: 11px;
          color: #d0d2ff;
        }

        .social-icon-active .social-icon-circle {
          background: linear-gradient(45deg, #a855f7, #6366ff);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.14),
            0 6px 16px rgba(80, 60, 200, 0.6);
        }

        .social-icon-active .social-icon-svg-wrapper {
          color: #ffffff;
        }

        .social-icon-disabled .social-icon-circle {
          opacity: 0.3;
        }

        .social-icon-editing .social-icon-circle {
          box-shadow:
            0 0 0 2px rgba(168, 85, 247, 0.5),
            0 6px 16px rgba(80, 60, 200, 0.6);
          transform: scale(1.05);
        }

        .social-helper-text {
          font-size: 12px;
          color: #8b8fa5;
          margin: 4px 0 18px;
          text-align: center;
        }

        .social-url-pill {
          width: 100%;
          border-radius: 999px;
          background: #181a26;
          border: 1px solid #34384f;
          display: flex;
          align-items: center;
          padding: 8px 20px;
          gap: 10px;
        }

        .social-url-pill-icon {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: linear-gradient(90deg, #6366ff, #a855f7);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .social-url-pill-icon-inner {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
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
          padding-right: 8px;
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
          transition: color 0.15s ease;
        }

        .social-url-clear:hover {
          color: #ffffff;
        }

        /* LINKS */

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

        .link-card[draggable='true']:active {
          opacity: 0.8;
          cursor: grabbing;
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
          transition: transform 0.08s ease, box-shadow 0.08s ease,
            background 0.12s ease;
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

        .skip-link-button {
          margin-top: 10px;
          border: none;
          background: transparent;
          color: #8b8fa5;
          font-size: 13px;
          cursor: pointer;
          text-decoration: none;
        }

        .skip-link-button:hover {
          text-decoration: underline;
          color: #ffffff;
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
