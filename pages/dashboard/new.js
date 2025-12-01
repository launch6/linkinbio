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

          <form onSubmit={handleSubmit}>
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
                  <span className="avatar-icon">
                    <span className="camera-body" />
                    <span className="camera-lens" />
                    <span className="camera-plus">+</span>
                  </span>
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
                Drag &amp; Drop or Tap to Upload image
              </p>
              <p className="helper-text helper-sub">
                (JPG/PNG, up to 1MB)
              </p>
            </div>

            {/* Display name */}
            <div className="field">
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

            {/* Short bio */}
            <div className="field">
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
        }

        .logo-row {
          margin-top: 4px;
          margin-bottom: 8px;
        }

        .logo {
          height: 62px; /* larger logo, closer to your mock */
          width: auto;
        }

        .card {
          width: 100%;
          max-width: 760px;
          background: rgba(12, 12, 21, 0.96);
          border-radius: 28px;
          box-shadow: 0 22px 70px rgba(0, 0, 0, 0.65);
          padding: 28px 24px 26px;
          display: flex;
          justify-content: center;
        }

        @media (min-width: 768px) {
          .card {
            padding: 32px 40px 30px;
          }
        }

        /* Inner content width so fields/buttons/bio are inset like design 1 */
        .card-inner {
          width: 100%;
          max-width: 640px;
          margin: 0 auto;
          text-align: center;
        }

        .step-label {
          font-size: 12px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #8b8fa5;
          margin: 4px 0 14px;
        }

        .title {
          font-size: 26px;
          font-weight: 700;
          margin: 0 0 10px;
        }

        .subtitle-strong {
          font-size: 15px;
          color: #ffffff;
          margin: 0;
        }

        .subtitle-strong + .subtitle-strong {
          margin-top: 4px;
        }

        form {
          width: 100%;
          margin-top: 26px;
          text-align: left;
        }

        .avatar-block {
          text-align: center;
          margin-bottom: 26px;
        }

        .avatar-circle {
          position: relative;
          border-radius: 999px;
          border: 2px solid rgba(130, 135, 170, 0.7);
          background: radial-gradient(circle at top, #29304a 0, #181a2f 55%, #101221 100%);
          width: 148px;
          height: 148px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          cursor: pointer;
          overflow: hidden;
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.6);
        }

        .avatar-circle:hover {
          border-color: #9ea8ff;
        }

        .avatar-preview {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background-size: cover;
          background-position: center;
        }

        .avatar-icon {
          position: relative;
          width: 44px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .camera-body {
          position: absolute;
          top: 6px;
          width: 34px;
          height: 22px;
          border-radius: 8px;
          border: 2px solid rgba(245, 246, 255, 0.95);
        }

        .camera-lens {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 10px;
          height: 10px;
          border-radius: 999px;
          border: 2px solid rgba(245, 246, 255, 0.95);
        }

        .camera-plus {
          position: absolute;
          right: -4px;
          bottom: -4px;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #ffffff;
          color: #111322;
          font-size: 12px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .hidden-file-input {
          display: none;
        }

        .helper-text {
          font-size: 13px;
          color: #8b8fa5;
          margin: 0;
        }

        .helper-sub {
          margin-top: 2px;
          font-size: 12px;
        }

        .field {
          margin-top: 20px;
        }

        .text-input,
        .textarea-input {
          width: 100%;
          border-radius: 999px;
          border: 1px solid #34384f;
          background: #090a12;
          padding: 13px 18px;
          font-size: 15px;
          color: #ffffff;
          outline: none;
        }

        .text-input::placeholder,
        .textarea-input::placeholder {
          color: #f5f5ff;
        }

        .text-input:focus,
        .textarea-input:focus {
          border-color: #7e8bff;
          box-shadow: 0 0 0 1px rgba(126, 139, 255, 0.35);
        }

        .textarea-wrap {
          position: relative;
          width: 100%;
        }

        .textarea-input {
          border-radius: 18px;
          min-height: 132px;
          resize: vertical;
          padding-right: 70px;
          padding-top: 14px;
        }

        .char-count {
          position: absolute;
          right: 16px;
          bottom: 12px;
          font-size: 11px;
          color: #8b8fa5;
        }

        .actions-row {
          margin-top: 26px;
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
          font-size: 15px;
          font-weight: 500;
          padding: 13px 18px;
          cursor: pointer;
          transition: transform 0.08s ease, box-shadow 0.08s ease, background 0.12s ease;
        }

        .btn-primary {
          background: linear-gradient(90deg, #6366ff, #a855f7);
          color: #ffffff;
          box-shadow: 0 10px 30px rgba(88, 92, 255, 0.7);
        }

        .btn-primary:disabled {
          opacity: 0.7;
          cursor: default;
          box-shadow: none;
        }

        .btn-primary:not(:disabled):active {
          transform: translateY(1px);
          box-shadow: 0 5px 18px rgba(88, 92, 255, 0.5);
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
