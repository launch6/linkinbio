// pages/dashboard/new-links.js
import { useState } from 'react';
import { useRouter } from 'next/router';

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

// Social networks available for header icons
const SOCIAL_CONFIG = [
  {
    key: 'instagram',
    hosts: ['instagram.com'],
    label: 'Instagram',
    short: 'IG',
  },
  {
    key: 'facebook',
    hosts: ['facebook.com'],
    label: 'Facebook',
    short: 'Fb',
  },
  {
    key: 'tiktok',
    hosts: ['tiktok.com'],
    label: 'TikTok',
    short: 'TT',
  },
  {
    key: 'youtube',
    hosts: ['youtube.com', 'youtu.be'],
    label: 'YouTube',
    short: 'YT',
  },
  {
    key: 'x',
    hosts: ['twitter.com', 'x.com'],
    label: 'X',
    short: 'X',
  },
  {
    key: 'website',
    hosts: [], // catch-all “site” type
    label: 'Website',
    short: 'WWW',
  },
];

function detectNetwork(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    for (const net of SOCIAL_CONFIG) {
      if (net.hosts.length && net.hosts.some((h) => host.endsWith(h))) {
        return net.key;
      }
    }

    // generic site
    return 'website';
  } catch {
    return null;
  }
}

export default function NewLinks() {
  const router = useRouter();
  const { token } = router.query;

  const [links, setLinks] = useState([
    { id: 1, label: 'Shop my latest pieces', url: '' },
    { id: 2, label: 'Join my email list', url: '' },
    { id: 3, label: '', url: '' },
  ]);

  const [activeSocialKey, setActiveSocialKey] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (id, field, value) => {
    setLinks((prev) =>
      prev.map((link) =>
        link.id === id ? { ...link, [field]: value } : link
      )
    );
  };

  const handleRemove = (id) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleAddRow = () => {
    setLinks((prev) => {
      const nonEmpty = prev.filter((l) => l.label.trim() || l.url.trim());
      // Cap at 5 initial links; they can add more later in the full editor
      if (nonEmpty.length >= 5) return prev;

      const nextId = prev.length ? Math.max(...prev.map((l) => l.id)) + 1 : 1;
      return [...prev, { id: nextId, label: '', url: '' }];
    });
  };

  const goToEditor = () => {
    if (saving) return;
    setSaving(true);

    if (token) {
      window.location.href = `/editor?editToken=${encodeURIComponent(token)}`;
    } else {
      window.location.href = `/editor`;
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

  const getSocialMeta = (network) =>
    SOCIAL_CONFIG.find((n) => n.key === network) ||
    SOCIAL_CONFIG.find((n) => n.key === 'website');

  // Which networks are currently represented by any link URLs? (max 4)
  const activeNetworks = (() => {
    const set = new Set();
    for (const link of links) {
      const net = detectNetwork(link.url);
      if (net) set.add(net);
    }
    return Array.from(set).slice(0, 4);
  })();

  const socialLimit = 4;

  const handleSocialIconClick = (key) => {
    const isActive = activeNetworks.includes(key);

    // Clicking an active icon toggles it into "edit" mode
    if (isActive) {
      setActiveSocialKey((prev) => (prev === key ? null : key));
      return;
    }

    // If it is inactive and the limit is reached, ignore
    if (!isActive && activeNetworks.length >= socialLimit) return;

    // Activate this icon for editing
    setActiveSocialKey(key);

    // If there is no link for this network yet, seed an empty slot with its label
    const existingForNetwork = links.find(
      (l) => detectNetwork(l.url) === key
    );
    if (!existingForNetwork) {
      const empty = links.find((l) => !l.url && !l.label);
      if (empty) {
        const meta = getSocialMeta(key);
        handleChange(empty.id, 'label', meta.label);
      }
    }
  };

  // Link whose URL currently maps to the active social key
  const activeSocialLink =
    activeSocialKey &&
    links.find((link) => detectNetwork(link.url) === activeSocialKey);

  const handleSocialUrlChange = (e) => {
    if (!activeSocialKey) return;

    const url = e.target.value;
    const targetNetwork = activeSocialKey;
    const meta = getSocialMeta(targetNetwork);

    const existingLink = links.find(
      (l) => detectNetwork(l.url) === targetNetwork
    );

    // Clearing the URL removes the network from activeNetworks
    if (!url) {
      if (existingLink) {
        handleChange(existingLink.id, 'url', '');
        // If the label was auto-seeded, clear it too
        if (existingLink.label === meta.label) {
          handleChange(existingLink.id, 'label', '');
        }
      }
      setActiveSocialKey(null);
      return;
    }

    if (existingLink) {
      handleChange(existingLink.id, 'url', url);
      if (!existingLink.label) {
        handleChange(existingLink.id, 'label', meta.label);
      }
    } else {
      // Use empty slot or create a new one if within limit
      const empty = links.find((l) => !l.url && !l.label);
      if (empty) {
        handleChange(empty.id, 'label', meta.label);
        handleChange(empty.id, 'url', url);
      } else {
        // Last resort: append a new link row if under 5
        setLinks((prev) => {
          if (prev.length >= 5) return prev;
          const nextId = prev.length
            ? Math.max(...prev.map((l) => l.id)) + 1
            : 1;
          return [
            ...prev,
            { id: nextId, label: meta.label, url },
          ];
        });
      }
    }
  };

  return (
    <main className="onboarding-root">
      <div className="logo-row">
        <img src="/launch6_white.png" alt="Launch6" className="logo" />
      </div>

      <div className="card">
        <div className="card-inner">
          {/* Progress Bar */}
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

          {/* SOCIAL ICON SECTION */}
          <section className="social-selection-section">
            <p className="section-label">Your social icons</p>
            <p className="social-helper-text">
              Select up to 4 to display in your header.
            </p>

            <div className="social-icon-row">
              {SOCIAL_CONFIG.map((net) => {
                const isActive = activeNetworks.includes(net.key);
                const isDisabled =
                  !isActive && activeNetworks.length >= socialLimit;
                const isEditing = activeSocialKey === net.key;

                return (
                  <button
                    type="button"
                    key={net.key}
                    className={`social-icon-wrapper ${
                      isActive ? 'active' : ''
                    } ${isDisabled ? 'disabled' : ''} ${
                      isEditing ? 'editing' : ''
                    }`}
                    onClick={() =>
                      !isDisabled && handleSocialIconClick(net.key)
                    }
                    aria-label={net.label}
                  >
                    <span className="social-icon-placeholder">
                      {net.short}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeSocialKey && (
              <div className="social-url-input-container">
                <p className="social-input-label">
                  {getSocialMeta(activeSocialKey).label} URL
                </p>
                <input
                  type="text"
                  className="link-input social-link-input"
                  placeholder="Paste URL (https://…)"
                  value={activeSocialLink ? activeSocialLink.url : ''}
                  onChange={handleSocialUrlChange}
                />
              </div>
            )}
          </section>

          <form onSubmit={handleSubmit} className="form">
            {/* LINK BUTTONS SECTION */}
            <section className="links-section">
              <p className="section-label">Link buttons</p>
              <p className="section-helper">
                Add a few key links. Drag to reorder later in your editor.
              </p>

              <div className="links-list">
                {links.map((link) => (
                  <div key={link.id} className="link-card">
                    <div className="drag-handle" aria-hidden="true">
                      <span className="drag-dots">⣿</span>
                    </div>

                    <div className="link-inputs-wrapper">
                      <input
                        type="text"
                        className="link-input link-label-input"
                        placeholder="My portfolio"
                        value={link.label}
                        onChange={(e) =>
                          handleChange(link.id, 'label', e.target.value)
                        }
                      />
                      <input
                        type="text"
                        className="link-input link-url-input"
                        placeholder="https://…"
                        value={link.url}
                        onChange={(e) =>
                          handleChange(link.id, 'url', e.target.value)
                        }
                      />
                    </div>

                    <button
                      type="button"
                      className="link-remove"
                      onClick={() => handleRemove(link.id)}
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

        /* Progress bar */
        .progress-bar-container {
          width: 100%;
          max-width: 400px;
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
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 16px;
          text-align: center;
        }

        .subtitle-block {
          text-align: center;
          width: 100%;
          margin-bottom: 16px;
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

        .section-label {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: #a1a4c0;
          margin: 0 0 6px;
        }

        .section-helper {
          font-size: 13px;
          color: #898daf;
          margin: 0 0 12px;
        }

        /* Social selection */
        .social-selection-section {
          width: 100%;
          margin-bottom: 24px;
        }

        .social-helper-text {
          font-size: 13px;
          color: #898daf;
          margin: 0 0 12px;
        }

        .social-icon-row {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 20px;
        }

        .social-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 2px solid transparent;
          background-color: #212431;
          color: #8b8fa5;
        }

        .social-icon-wrapper.active {
          background: linear-gradient(45deg, #6366ff, #a855f7);
          color: #ffffff;
          border-color: #a855f7;
        }

        .social-icon-wrapper.disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .social-icon-wrapper:hover:not(.active):not(.disabled) {
          background-color: #34384f;
        }

        .social-icon-wrapper.editing {
          box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.4);
        }

        .social-icon-placeholder {
          font-size: 14px;
          font-weight: 600;
        }

        .social-url-input-container {
          width: 100%;
          margin-top: 10px;
          animation: slideIn 0.3s ease-out;
        }

        .social-input-label {
          font-size: 13px;
          color: #a1a4c0;
          margin: 0 0 4px 10px;
        }

        .social-link-input {
          width: 100%;
          box-sizing: border-box;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Link buttons */
        .links-section {
          width: 100%;
          margin-top: 24px;
        }

        .links-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .link-card {
          display: flex;
          align-items: center;
          background: #1c1f2e;
          border-radius: 12px;
          padding: 8px;
          border: 1px solid #2e3247;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
          position: relative;
        }

        .drag-handle {
          width: 24px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: grab;
          color: #5d617d;
          padding: 0 8px;
        }

        .drag-dots {
          font-size: 16px;
          line-height: 1;
        }

        .link-inputs-wrapper {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-right: 12px;
        }

        .link-input {
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          padding: 6px 8px;
          font-size: 14px;
          line-height: 1.4;
          font-family: ${fontStack};
          color: #ffffff;
          outline: none;
        }

        .link-input::placeholder {
          color: #8b8fa5;
        }

        .link-label-input {
          font-weight: 600;
        }

        .link-url-input {
          font-size: 12px;
          color: #b0b4c7;
        }

        .link-input:focus {
          border-color: #3e445b;
          box-shadow: none;
        }

        .link-remove {
          margin-left: auto;
          width: 30px;
          height: 30px;
          border: none;
          background: transparent;
          color: #a1a4c0;
          font-size: 24px;
          cursor: pointer;
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
        }

        .add-link-button:hover {
          text-decoration: underline;
        }

        /* Buttons & footer */
        .actions-row {
          margin-top: 30px;
          display: flex;
          flex-direction: column;
          gap: 10px;
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
          box-shadow: 0 8px 24px rgba(88, 92, 255, 0.55);
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
          text-decoration: underline;
        }

        .skip-link-button:hover {
          color: #ffffff;
        }

        .footer-note {
          margin-top: 24px;
          font-size: 12px;
          color: #8b8fa5;
          text-align: center;
          max-width: 100%;
        }
      `}</style>
    </main>
  );
}
