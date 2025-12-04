import { useState } from 'react';
import { useRouter } from 'next/router';

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

// Social network detection by URL host
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

    // If it is a normal https link that does not match any known host
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
      // Cap at 5 initial links; they can add more in the full editor
      if (nonEmpty.length >= 5) return prev;

      const nextId = prev.length ? Math.max(...prev.map((l) => l.id)) + 1 : 1;
      return [...prev, { id: nextId, label: '', url: '' }];
    });
  };

 const goToEditor = () => {
    if (saving) return;
    setSaving(true);

    if (token) {
      // go to your existing editor
      window.location.href = `/editor?editToken=${encodeURIComponent(token)}`;
    } else {
      // ultra-rare fallback, but keeps it safe
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

  // Compute social preview (up to 4 icons) based on URLs entered
  const socialPreview = (() => {
    const items = [];
    for (const link of links) {
      const network = detectNetwork(link.url);
      if (!network) continue;
      const existing = items.find((i) => i.network === network);
      if (!existing) {
        items.push({ network, url: link.url });
      }
    }
    return items.slice(0, 4);
  })();

  const getSocialMeta = (network) =>
    SOCIAL_CONFIG.find((n) => n.key === network) ||
    SOCIAL_CONFIG.find((n) => n.key === 'website');

  return (
    <main className="onboarding-root">
      <div className="logo-row">
        <img src="/launch6_white.png" alt="Launch6" className="logo" />
      </div>

      <div className="card">
        <div className="card-inner">
          <p className="step-label">STEP 2 OF 3</p>
          <h1 className="title">Add links & socials</h1>

          <div className="subtitle-block">
            <p className="subtitle-line">
              Drop in the links you want under your art.
            </p>
            <p className="subtitle-line">
              We’ll show up to 4 social icons at the top of your page.
            </p>
          </div>

          {/* Social preview row */}
          <section className="social-section">
            <p className="section-label">Social icon preview</p>
            <div className="social-preview">
              {socialPreview.length === 0 ? (
                <p className="social-preview-empty">
                  Paste Instagram, TikTok, YouTube, X, Facebook, or your site,
                  and your icons will appear here.
                </p>
              ) : (
                socialPreview.map((item, idx) => {
                  const meta = getSocialMeta(item.network);
                  return (
                    <div
                      key={`${item.network}-${idx}`}
                      className={`social-pill social-pill-${item.network}`}
                    >
                      <span className="social-pill-short">{meta.short}</span>
                      <span className="social-pill-label">{meta.label}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <form onSubmit={handleSubmit} className="form">
            <section className="links-section">
              <p className="section-label">Links under your art</p>
              <p className="section-helper">
                Add a few key links. You can reorder and add more later in your
                editor.
              </p>

              <div className="links-list">
                {links.map((link) => (
                  <div key={link.id} className="link-row">
                    <input
                      type="text"
                      className="link-input link-label-input"
                      placeholder="Link title (e.g. Backyards of Key West shop)"
                      value={link.label}
                      onChange={(e) =>
                        handleChange(link.id, 'label', e.target.value)
                      }
                    />
                    <input
                      type="text"
                      className="link-input link-url-input"
                      placeholder="Paste URL (https://…)"
                      value={link.url}
                      onChange={(e) =>
                        handleChange(link.id, 'url', e.target.value)
                      }
                    />
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
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Continue'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSkip}
                disabled={saving}
              >
                Skip for now
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

        .social-section {
          width: 100%;
          margin-bottom: 18px;
        }

        .social-preview {
          min-height: 52px;
          border-radius: 999px;
          border: 1px dashed rgba(255, 255, 255, 0.14);
          background: #0b0b14;
          display: flex;
          align-items: center;
          padding: 8px 14px;
          gap: 8px;
        }

        .social-preview-empty {
          font-size: 12px;
          color: #8b8fa5;
          margin: 0;
        }

        .social-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.14);
        }

        .social-pill-short {
          font-weight: 600;
        }

        .social-pill-label {
          opacity: 0.9;
        }

        .links-section {
          width: 100%;
          margin-top: 10px;
        }

        .links-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .link-row {
          display: grid;
          grid-template-columns: 1.2fr 1.6fr auto;
          gap: 8px;
          align-items: center;
        }

        @media (max-width: 640px) {
          .link-row {
            grid-template-columns: 1fr;
          }
        }

        .link-input {
          width: 100%;
          box-sizing: border-box;
          font-family: ${fontStack};
          font-size: 14px;
          color: #ffffff;
          border-radius: 999px;
          border: 1px solid #34384f;
          background: #090a12;
          padding: 10px 16px;
          outline: none;
        }

        .link-input::placeholder {
          color: #8b8fa5;
        }

        .link-input:focus {
          border-color: #7e8bff;
          box-shadow: 0 0 0 1px rgba(126, 139, 255, 0.3);
        }

        .link-remove {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 1px solid #34384f;
          background: transparent;
          color: #a1a4c0;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .link-remove:hover {
          border-color: #ff4b81;
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

        .actions-row {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        @media (min-width: 600px) {
          .actions-row {
            flex-direction: row;
          }
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

        .btn-secondary {
          background: transparent;
          color: #e5e7ff;
          border: 1px solid #3a3f5a;
        }

        .btn-secondary:disabled {
          opacity: 0.7;
          cursor: default;
        }

        .btn-secondary:not(:disabled):active {
          transform: translateY(1px);
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
