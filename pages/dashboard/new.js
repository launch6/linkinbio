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
              <button
                type="button"
                className="avatar-circle"
                onClick={handleAvatarClick}
                aria-label="Upload profile image"
              >
                {avatarDataUrl ? (
                  <span
                    className="avatar-preview"
                    style={{ backgroundImage: `url(${avatarDataUrl})` }}
                  />
                ) : (
                  <svg
                    className="avatar-icon"
                    viewBox="0 0 64 64"
                    aria-hidden="true"
                  >
                    {/* Camera body */}
                    <rect
                      x="16"
                      y="22"
                      width="32"
                      height="22"
                      rx="8"
                    />
                    {/* Top hump */}
                    <path d="M24 22l3-5h10l3 5" />
                    {/* Lens */}
                    <circle cx="32" cy="33" r="7" />
                    {/* Plus in lower-right corner of camera */}
                    <path d="M41 34v7" />
                    <path d="M37.5 37.5h7" />
                  </svg>
                )}
              </button>

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
          background: radial-gradient(circle at top, #15162a 0, #05050b 55%, #020208 100%);
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

        /* 20% narrower card + more visible white outline */
        .card-inner {
          width: 100%;
          max-width: 620px; /* was 780px */
          background: rgba(9, 9, 18, 0.96);
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.16); /* brighter white line */
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
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
          margin-top: 26px;
        }

        .avatar-block {
          text-align: center;
          margin-bottom: 24px;
        }

        /* 30% smaller avatar circle */
        .avatar-circle {
          position: relative;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.7) inset,
            0 18px 50px rgba(0, 0, 0, 0.75);
          background: radial-gradient(circle at top, #262b43 0, #161827 55%, #101221 100%);
          width: 108px;  /* was 152px */
          height: 108px; /* was 152px */
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          cursor: pointer;
          overflow: hidden;
        }

        .avatar-circle:hover {
          border-color: rgba(255, 255, 255, 0.32);
        }

        .avatar-preview {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background-size: cover;
          background-position: center;
        }

        .avatar-icon {
          width: 52px;
          height: 52px;
          color: #f5f6ff;
          stroke: currentColor;
          stroke-width: 2.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
          z-index: 1;
        }

        .hidden-file-input {
          display: none;
        }

        .helper-text {
          font-size: 12px;
          color: #a1a4c0;
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
          max-width: 640px;
          margin: 0 auto;
        }

        .text-input,
        .textarea-input {
          width: 100%;
          font-size: 14px;
          color: #ffffff;
          border-radius: 999px;
          border: 1px solid #34384f;
          background: #090a12;
          padding: 10px 18px;
          outline: none;
        }

        .text-input::placeholder,
        .textarea-input::placeholder {
          color: #f5f5ff;
        }

        .text-input:focus,
        .textarea-input:focus {
          border-color: #7e8bff;
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
          padding-top: 12px;
          line-height: 1.45;
        }

        .char-count {
          position: absolute;
          right: 16px;
          bottom: 10px;
          font-size: 11px;
          color: #8b8fa5;
        }

        .actions-row {
          margin-top: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          width: 100%;
          max-width: 640px;
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

        .footer-note {
          margin-top: 14px;
          font-size: 12px;
          color: #8b8fa5;
          text-align: center;
        }
      `}</style>
    </main>
  );
}
