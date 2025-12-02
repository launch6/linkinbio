import { useState, useRef } from 'react';

function slugify(input) {
  const base = (input || '').toLowerCase().trim();
  const core = base
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return core || `artist-${Date.now()}`;
}

export default function NewProfile() {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const bioMax = 160;
  const bioCount = bio.length;

  const handleAvatarClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = 1 * 1024 * 1024; // 1MB
    if (file.size > maxBytes) {
      alert('Image is too large. Please upload a JPG/PNG up to 1MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result;
      if (typeof result === 'string') {
        setAvatarDataUrl(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const createProfile = async (skip = false) => {
    if (saving) return;
    setSaving(true);

    let name = displayName.trim();
    let description = bio.trim();

    if (skip && !name) {
      name = 'New artist';
    }

    const slug = slugify(name || 'artist');

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description,
          avatarUrl: avatarDataUrl || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create profile');
        setSaving(false);
        return;
      }

      window.location.href = `/dashboard/${data.editToken}`;
    } catch (err) {
      console.error(err);
      alert('Something went wrong creating your profile.');
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createProfile(false);
  };

  const handleSkip = (e) => {
    e.preventDefault();
    createProfile(true);
  };

  return (
    <main className="onboarding-root">
      <div className="logo-row">
        <img
          src="/launch6_white.png"
          alt="Launch6"
          className="logo"
        />
      </div>

      <div className="card">
        <div className="card-inner">
          <p className="step-label">STEP 1 OF 3</p>
          <h1 className="title">Add profile details</h1>

          <p className="subtitle-strong">
            Add your profile image, name, and bio.
          </p>
          <p className="subtitle-strong">
            You’ll set up links, drops, and email capture in the next steps.
          </p>

          <form onSubmit={handleSubmit} className="form">
            {/* Avatar upload */}
            <div className="avatar-block">
              <div 
                className="avatar-circle"
                onClick={handleAvatarClick}
                role="button"
                aria-label="Upload profile image"
              >
                {avatarDataUrl ? (
                  <span
                    className="avatar-preview"
                    style={{ backgroundImage: `url(${avatarDataUrl})` }}
                  />
                ) : (
                  <>
                    <svg
                      className="avatar-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {/* Simple Camera Icon */}
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    
                    {/* The Plus Badge overlay */}
                    <div className="plus-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                    </div>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden-file-input"
                onChange={handleFileChange}
              />

              <p className="helper-text">
                Drag &amp; drop or tap to upload image
              </p>
              <p className="helper-text helper-text-sub">
                (JPG/PNG, up to 1MB).
              </p>
            </div>

            {/* Display name */}
            <div className="field">
              <div className="field-control">
                <input
                  id="displayName"
                  aria-label="Display name"
                  className="text-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="@yourname or Studio Name"
                />
              </div>
            </div>

            {/* Short bio */}
            <div className="field">
              <div className="field-control">
                <div className="textarea-wrap">
                  <textarea
                    id="bio"
                    aria-label="Short bio"
                    className="textarea-input"
                    value={bio}
                    onChange={(e) => {
                      const next = e.target.value.slice(0, bioMax);
                      setBio(next);
                    }}
                    placeholder="Fill in your bio or tell collectors about your newest art drop"
                    maxLength={bioMax}
                  />
                  <span className="char-count">
                    {bioCount}/{bioMax}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="actions-row">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? 'Creating…' : 'Continue'}
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
              After this step you’ll land in your editor to add links, social icons, drops, and email capture.
            </p>
          </form>
        </div>
      </div>

      <style jsx>{`
        .onboarding-root {
          min-height: 100vh;
          /* UPDATED: Radial gradient to create the top purple glow */
          background: radial-gradient(circle at 50% -20%, #2e2855 0%, #05050b 50%, #05050b 100%);
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 16px 40px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text',
            'Inter', sans-serif;
        }

        .logo-row {
          margin-top: 4px;
          margin-bottom: 10px;
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
          max-width: 620px;
          /* UPDATED: Slightly more transparent background to let glow show through subtly */
          background: rgba(9, 9, 18, 0.85);
          backdrop-filter: blur(20px);
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.6);
          padding: 40px 40px 32px;
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
        }

        .title {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 10px;
          text-align: center;
        }

        .subtitle-strong {
          font-size: 14px;
          color: #ffffff;
          text-align: center;
          margin: 0;
        }

        .subtitle-strong + .subtitle-strong {
          margin-top: 2px;
        }

        .form {
          width: 100%;
          max-width: 520px;
          margin-top: 26px;
          margin-left: auto;
          margin-right: auto;
          padding: 0;
          box-sizing: border-box;
        }

        .avatar-block {
          text-align: center;
          margin-bottom: 24px;
        }

        /* Avatar Circle */
        .avatar-circle {
          position: relative;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.15);
          /* UPDATED: Darker interior, subtle gradient */
          background: linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%);
          width: 108px;
          height: 108px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          cursor: pointer;
          overflow: visible; /* Changed to visible so badge can overlap if needed, though positioned inside here */
        }

        .avatar-circle:hover {
          border-color: rgba(255, 255, 255, 0.32);
        }

        .avatar-preview {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background-size: cover;
          background-position: center;
          overflow: hidden;
        }

        .avatar-icon {
          width: 36px;
          height: 36px;
          color: #a1a4c0;
          opacity: 0.8;
          z-index: 1;
        }

        /* NEW: The Plus Badge Styling */
        .plus-badge {
          position: absolute;
          bottom: 6px;
          right: 6px;
          width: 26px;
          height: 26px;
          background: rgba(255, 255, 255, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(4px);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          z-index: 2;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }

        .hidden-file-input {
          display: none;
        }

        .helper-text {
          font-size: 12px;
          color: #8b8fa5;
          margin: 0;
        }

        .helper-text-sub {
          margin-top: 2px;
        }

        .field {
          margin-top: 18px;
        }

        .field-control {
          width: 100%;
          max-width: 520px;
          margin-left: auto;
          margin-right: auto;
        }

        /* Inputs */
        .text-input,
        .textarea-input {
          width: 100%;
          font-size: 14px;
          color: #ffffff;
          border-radius: 999px;
          /* UPDATED: More transparent border and background */
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.03); 
          padding: 12px 20px;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }

        .text-input::placeholder,
        .textarea-input::placeholder {
          color: rgba(255, 255, 255, 0.7); /* Brighter placeholder */
        }

        .text-input:focus,
        .textarea-input:focus {
          border-color: #7e8bff;
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 1px rgba(126, 139, 255, 0.3);
        }

        .textarea-wrap {
          position: relative;
        }

        .textarea-input {
          border-radius: 18px;
          min-height: 142px;
          resize: vertical;
          padding-right: 64px;
          padding-top: 14px;
          line-height: 1.5;
        }

        .char-count {
          position: absolute;
          right: 16px;
          bottom: 12px;
          font-size: 11px;
          color: #6b6f85;
        }

        .actions-row {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          max-width: 520px;
          margin-left: auto;
          margin-right: auto;
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
          font-size: 15px;
          font-weight: 500;
          padding: 12px 16px;
          cursor: pointer;
          transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease;
        }

        .btn-primary {
          /* UPDATED: Gradient to match design 1 closer */
          background: linear-gradient(90deg, #7c4dff, #b55aff);
          color: #ffffff;
          box-shadow: 0 8px 24px rgba(124, 77, 255, 0.4);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: default;
          box-shadow: none;
        }

        .btn-primary:not(:disabled):active {
          transform: translateY(1px);
          box-shadow: 0 4px 14px rgba(124, 77, 255, 0.3);
        }

        .btn-secondary {
          background: transparent;
          color: #e5e7ff;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .btn-secondary:disabled {
          opacity: 0.7;
          cursor: default;
        }

        .btn-secondary:not(:disabled):active {
          transform: translateY(1px);
        }

        .footer-note {
          margin-top: 16px;
          font-size: 12px;
          color: #6b6f85;
          text-align: center;
          line-height: 1.4;
        }

        :global(html),
        :global(body) {
          background-color: #05050b;
        }
      `}</style>
    </main>
  );
}