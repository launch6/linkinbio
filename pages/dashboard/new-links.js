import { useState } from 'react';

const fontStack =
  "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

// Recognized social providers for header icons
const PROVIDERS = ['instagram', 'facebook', 'tiktok', 'youtube', 'x', 'website'];

function createEmptyLink(order) {
  return {
    id: `link-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label: '',
    url: '',
    provider: null, // 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'x' | 'website' | null
    kind: 'link', // future-proof if you want "drop" links etc.
    showAsIcon: false,
    showAsButton: true,
    order,
  };
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Infer provider from the URL
function detectProvider(url) {
  if (!url) return null;
  const value = url.toLowerCase();

  if (value.includes('instagram.com')) return 'instagram';
  if (value.includes('facebook.com')) return 'facebook';
  if (value.includes('tiktok.com')) return 'tiktok';
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube';
  if (value.includes('x.com') || value.includes('twitter.com')) return 'x';

  // Treat everything else as "website" if it looks like a valid URL
  if (isValidUrl(url)) return 'website';

  return null;
}

// Simple icon glyph per provider (you can replace with SVGs later)
function providerGlyph(provider) {
  switch (provider) {
    case 'instagram':
      return 'IG';
    case 'facebook':
      return 'f';
    case 'tiktok':
      return '𝄞';
    case 'youtube':
      return '▶';
    case 'x':
      return 'X';
    case 'website':
      return 'www';
    default:
      return '?';
  }
}

export default function NewLinks() {
  const [links, setLinks] = useState(() => [createEmptyLink(0), createEmptyLink(1)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [invalidIds, setInvalidIds] = useState([]);

  const iconLinks = links
    .filter(
      (link) =>
        link.showAsIcon &&
        link.provider &&
        PROVIDERS.includes(link.provider) &&
        link.url
    )
    .sort((a, b) => a.order - b.order)
    .slice(0, 4);

  const handleChangeLabel = (id, value) => {
    setLinks((prev) =>
      prev.map((link) =>
        link.id === id ? { ...link, label: value } : link
      )
    );
  };

  const handleChangeUrl = (id, value) => {
    setLinks((prev) =>
      prev.map((link) => {
        if (link.id !== id) return link;
        const provider = detectProvider(value);
        return {
          ...link,
          url: value,
          provider,
          // Keep showAsIcon if still a valid provider, otherwise reset
          showAsIcon:
            provider && PROVIDERS.includes(provider) ? link.showAsIcon : false,
        };
      })
    );
  };

  const handleToggleIcon = (id) => {
    setLinks((prev) => {
      const current = prev.find((l) => l.id === id);
      if (!current) return prev;

      // If turning on, enforce max 4 icons
      const alreadyOn = prev.filter(
        (l) =>
          l.id !== id &&
          l.showAsIcon &&
          l.provider &&
          PROVIDERS.includes(l.provider)
      ).length;

      // If this toggle would exceed 4, keep state and surface a message
      if (!current.showAsIcon && alreadyOn >= 4) {
        alert('You can highlight up to 4 social icons at the top.');
        return prev;
      }

      return prev.map((link) =>
        link.id === id ? { ...link, showAsIcon: !link.showAsIcon } : link
      );
    });
  };

  const handleAddLink = () => {
    setLinks((prev) => {
      const nextOrder = prev.length ? prev[prev.length - 1].order + 1 : 0;
      return [...prev, createEmptyLink(nextOrder)];
    });
  };

  const handleRemoveLink = (id) => {
    setLinks((prev) => prev.filter((link) => link.id !== id));
  };

  const validateLinks = () => {
    const invalid = [];

    links.forEach((link) => {
      if (!link.url) return; // empty is allowed
      if (!isValidUrl(link.url)) invalid.push(link.id);
    });

    setInvalidIds(invalid);

    if (invalid.length) {
      setError('Please enter valid URLs (include https://) for the highlighted links.');
      return false;
    }

    setError('');
    return true;
  };

  const handleContinue = async (e) => {
    e.preventDefault();
    if (saving) return;

    const ok = validateLinks();
    if (!ok) return;

    setSaving(true);

    // Clean payload
    const payload = links
      .filter((l) => l.label.trim() || l.url.trim())
      .map((link, index) => ({
        id: link.id,
        label: link.label.trim(),
        url: link.url.trim(),
        provider: link.provider,
        kind: link.provider ? 'social' : 'link',
        showAsIcon:
          !!link.provider &&
          PROVIDERS.includes(link.provider) &&
          link.showAsIcon &&
          index < 4,
        showAsButton: true,
        order: index,
      }));

    // For now we log; wiring to backend can be a separate step
    console.log('Onboarding links payload:', payload);

    // Temporary progression target. Adjust when Step 3 route exists.
    window.location.href = '/dashboard';
  };

  const handleSkip = (e) => {
    e.preventDefault();
    if (saving) return;
    console.log('Onboarding links skipped; links = []');
    window.location.href = '/dashboard';
  };

  const isInvalid = (id) => invalidIds.includes(id);

  return (
    <main className="onboarding-root">
      <div className="logo-row">
        <img src="/launch6_white.png" alt="Launch6" className="logo" />
      </div>

      <div className="card">
        <div className="card-inner">
          <p className="step-label">STEP 2 OF 3</p>
          <h1 className="title">Add links and socials</h1>

          <div className="subtitle-block">
            <p className="subtitle-line">Add your main links.</p>
            <p className="subtitle-line">
              Social links show as icons under your name and buttons on your page.
            </p>
          </div>

          {/* Social icon preview */}
          <div className="icon-preview">
            {iconLinks.length === 0 ? (
              <p className="icon-preview-placeholder">
                Turn on “Show as icon” for up to four socials to feature them here.
              </p>
            ) : (
              iconLinks.map((link) => (
                <div key={link.id} className="icon-pill" title={link.label || link.provider}>
                  <span className="icon-glyph">
                    {providerGlyph(link.provider)}
                  </span>
                </div>
              ))
            )}
          </div>

          <form className="form" onSubmit={handleContinue}>
            {error && <p className="error-text">{error}</p>}

            <div className="links-list">
              {links.map((link, index) => {
                const provider = link.provider;
                const isSocial =
                  !!provider && PROVIDERS.includes(provider);

                return (
                  <div key={link.id} className="link-row content-rail">
                    <div className="link-row-header">
                      <span className="link-row-label">
                        Link {index + 1}
                      </span>
                      {links.length > 1 && (
                        <button
                          type="button"
                          className="link-remove"
                          onClick={() => handleRemoveLink(link.id)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="link-inputs">
                      <input
                        type="text"
                        className="text-input link-label-input"
                        placeholder="Link title (e.g., Shop, Portfolio, Newsletter)"
                        value={link.label}
                        onChange={(e) =>
                          handleChangeLabel(link.id, e.target.value)
                        }
                      />

                      <input
                        type="url"
                        className={`text-input link-url-input ${
                          isInvalid(link.id) ? 'input-error' : ''
                        }`}
                        placeholder="https://example.com/your-link"
                        value={link.url}
                        onChange={(e) =>
                          handleChangeUrl(link.id, e.target.value)
                        }
                      />
                    </div>

                    <div className="link-meta-row">
                      {isSocial ? (
                        <span className="provider-chip">
                          {provider === 'website'
                            ? 'Website'
                            : provider.charAt(0).toUpperCase() +
                              provider.slice(1)}
                        </span>
                      ) : (
                        <span className="provider-chip provider-chip-muted">
                          Regular link
                        </span>
                      )}

                      {isSocial && (
                        <label className="toggle-label">
                          <input
                            type="checkbox"
                            checked={link.showAsIcon}
                            onChange={() => handleToggleIcon(link.id)}
                          />
                          <span>Show as icon</span>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="add-link-row content-rail">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleAddLink}
              >
                + Add another link
              </button>
            </div>

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
                Skip
              </button>
            </div>

            <p className="footer-note">
              You can reorder and style these links from your editor after onboarding.
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
          padding: 20px 16px 40px;
          font-family: ${fontStack};
        }

        .logo-row {
          margin-bottom: 20px;
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
          margin-bottom: 18px;
        }

        .subtitle-line {
          font-size: 16px;
          color: #ffffff;
          margin: 0;
          line-height: 1.5;
          font-weight: 400;
        }

        .icon-preview {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 18px;
          min-height: 40px;
        }

        .icon-preview-placeholder {
          font-size: 12px;
          color: #8b8fa5;
          text-align: center;
        }

        .icon-pill {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at top, #262b43 0, #15172a 60%, #101221 100%);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
        }

        .icon-glyph {
          font-size: 13px;
          font-weight: 600;
        }

        .form {
          width: 100%;
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .content-rail {
          width: 100%;
          max-width: 100%;
        }

        .error-text {
          width: 100%;
          text-align: left;
          font-size: 12px;
          color: #f97373;
          margin: 0 0 8px;
        }

        .links-list {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 18px;
          margin-top: 6px;
        }

        .link-row {
          background: rgba(5, 5, 14, 0.9);
          border-radius: 18px;
          padding: 12px 14px 10px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .link-row-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .link-row-label {
          font-size: 13px;
          color: #a1a4c0;
        }

        .link-remove {
          border: none;
          background: transparent;
          color: #8b8fa5;
          font-size: 12px;
          cursor: pointer;
        }

        .link-remove:hover {
          color: #f97373;
        }

        .link-inputs {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .text-input {
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

        .text-input::placeholder {
          color: #8b8fa5;
          opacity: 1;
        }

        .text-input:focus {
          border-color: #7e8bff;
          box-shadow: 0 0 0 1px rgba(126, 139, 255, 0.3);
        }

        .input-error {
          border-color: #f97373;
        }

        .link-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
          gap: 12px;
        }

        .provider-chip {
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          font-size: 11px;
          color: #e5e7ff;
        }

        .provider-chip-muted {
          opacity: 0.7;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #e5e7ff;
        }

        .toggle-label input {
          accent-color: #7e8bff;
        }

        .add-link-row {
          margin-top: 14px;
        }

        .actions-row {
          margin-top: 22px;
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
          padding: 11px 16px;
          cursor: pointer;
          transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease;
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

        .btn-ghost {
          width: 100%;
          border-radius: 999px;
          border: 1px dashed #3a3f5a;
          background: transparent;
          color: #e5e7ff;
          font-size: 13px;
          padding: 9px 12px;
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
