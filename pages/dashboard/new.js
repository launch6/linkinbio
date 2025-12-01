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

  const bioMax = 160;
  const bioCount = bio.length;

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
        <p className="step-label">STEP 1 OF 3</p>
        <h1 className="title">Add profile details</h1>

        <p className="subtitle">
          Add your profile image, name, and bio.
        </p>
        <p className="subtitle">
          You’ll set up links, drops, and email capture in the next steps.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Avatar upload */}
          <div className="avatar-block">
            <span className="field-label-center">Profile image (optional)</span>
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
                  {/* simple camera + plus icon using characters */}
                  <span className="avatar-camera">📷</span>
                  <span className="avatar-plus">+</span>
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
              Drag &amp; drop or tap to upload image (JPG/PNG, up to 1MB).
            </p>
          </div>

          {/* Display name */}
          <div className="field">
            <label className="field-label" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              className="text-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="@yourname or Studio Name"
            />
          </div>

          {/* Short bio */}
          <div className="field">
            <label className="field-label" htmlFor="bio">
              Short bio
            </label>
            <div className="textarea-wrap">
              <textarea
                id="bio"
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

      <style jsx>{`
        .onboarding-root {
          min-height: 100vh;
          background: radial-gradient(circle at top, #15162a 0, #05050b 55%, #020208 100%);
          color: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 16px 40px;
        }

        .logo-row {
          margin-top: 8px;
          margin-bottom: 12px;
        }

        .logo {
          height: 40px;
          width: auto;
        }

        .card {
          width: 100%;
          max-width: 720px;
          background: rgba(12, 12, 21, 0.96);
          border-radius: 24px;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
          padding: 28px 22px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        @media (min-width: 768px) {
          .card {
            padding: 36px 40px 32px;
          }
        }

        .step-label {
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #8b8fa5;
          margin-bottom: 10px;
        }

        .title {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 10px;
          text-align: center;
        }

        .subtitle {
          font-size: 14px;
          color: #c4c7da;
          text-align: center;
          margin: 0;
        }

        .subtitle + .subtitle {
          margin-top: 2px;
        }

        form {
          width: 100%;
          margin-top: 24px;
        }

        .avatar-block {
          text-align: center;
          margin-bottom: 24px;
        }

        .field-label-center {
          display: block;
          font-size: 13px;
          color: #e5e7ff;
          margin-bottom: 12px;
        }

        .avatar-circle {
          border-radius: 999px;
          border: 1px solid #3a3f5a;
          background: radial-gradient(circle at top, #262b43 0, #15172a 60%, #101221 100%);
          width: 124px;
          height: 124px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 10px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }

        .avatar-circle:hover {
          border-color: #7e8bff;
        }

        .avatar-preview {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background-size: cover;
          background-position: center;
        }

        .avatar-icon {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          font-size: 20px;
          z-index: 1;
        }

        .avatar-camera {
          font-size: 18px;
        }

        .avatar-plus {
          font-size: 16px;
          line-height: 1;
        }

        .hidden-file-input {
          display: none;
        }

        .helper-text {
          font-size: 12px;
          color: #8b8fa5;
          margin: 0;
        }

        .field {
          margin-top: 18px;
        }

        .field-label {
          display: block;
          font-size: 13px;
          color: #e5e7ff;
          margin-bottom: 6px;
        }

        .text-input,
        .textarea-input {
          width: 100%;
          border-radius: 999px;
          border: 1px solid #34384f;
          background: #090a12;
          padding: 10px 14px;
          font-size: 14px;
          color: #ffffff;
          outline: none;
        }

        .text-input::placeholder,
        .textarea-input::placeholder {
          color: #727793;
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
          border-radius: 14px;
          min-height: 110px;
          resize: vertical;
          padding-right: 56px;
        }

        .char-count {
          position: absolute;
          right: 12px;
          bottom: 8px;
          font-size: 11px;
          color: #8b8fa5;
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
          margin-top: 12px;
          font-size: 12px;
          color: #8b8fa5;
          text-align: center;
        }
      `}</style>
    </main>
  );
}
