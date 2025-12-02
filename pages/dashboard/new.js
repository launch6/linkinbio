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

  // Define common font stack for consistency
  const fontStack = "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

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

          {/* Subtitles: 16px, split onto two lines, matching input styles */}
          <div className="subtitle-block">
            <p className="subtitle-line">Add your profile image, name, and bio.</p>
            <p className="subtitle-line">You’ll set up links, drops, and email capture in the next steps.</p>
          </div>

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
                  // **REPLACED SVG ICON**
                  <svg
                    className="avatar-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M20 5H4C2.89543 5 2 5.89543 2 7V17C2 18.1046 2.89543 19 4 19H20C21.1046 19 22 18.1046 22 17V7C22 5.89543 21.1046 5 20 5Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8.5 10.5C8.5 9.11929 7.38071 8 6 8C4.61929 8 3.5 9.11929 3.5 10.5C3.5 11.8807 4.61929 13 6 13C7.38071 13 8.5 11.8807 8.5 10.5Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 15L6 11L12 17"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M17.5 12V15"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16 13.5H19"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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
              <div className="field-control content-rail">
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
              <div className="field-control content-rail">
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
            <div className="actions-row content-rail">
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
        /* 1. Global Background Change to #121219 */
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
          /* 2. Narrower Width: Reduced from 620px to 540px (~13% reduction) */
          max-width: 540px;
          background: rgba(9, 9, 18, 0.96);
          border-radius: 32px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
          /* 3. Padding Adjustment: Reduced top padding to 32px to move Step Label higher */
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
          margin-top: 0; /* Ensures it sits high */
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
          margin-bottom: 10px;
        }

        /* 4. Subtitle Typography: 16px, separate lines */
        .subtitle-line {
          font-size: 16px; 
          color: #ffffff;
          margin: 0;
          line-height: 1.5;
          font-weight: 400;
        }

        .form {
          width: 100%;
          margin-top: 26px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .content-rail {
            width: 100%;
            /* Matches new narrower card width minus padding */
            max-width: 100%; 
        }

        .avatar-block {
          text-align: center;
          margin-bottom: 24px;
        }

        .avatar-circle {
          position: relative;
          border-radius: 999px;
          /* **UPDATED STYLING FOR THE CIRCLE/BUTTON** */
          /* Changed border and box-shadow to match the dark, slightly glowing effect */
          border: 1px solid rgba(255, 255, 255, 0.1); 
          box-shadow:
            0 0 0 1px rgba(0, 0, 0, 0.5) inset,
            0 0 10px rgba(0, 0, 0, 0.5) inset; /* Removed larger outer shadow */
          background: #0d0d15; /* Darker background */
          width: 108px;
          height: 108px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          cursor: pointer;
          overflow: hidden;
          
          /* Added filter for subtle white outline glow as seen in the image */
          filter: drop-shadow(0 0 0.5px rgba(255, 255, 255, 0.5));
          
          transition: all 0.2s ease;
        }

        .avatar-circle:hover {
          border-color: rgba(255, 255, 255, 0.2);
          /* Added slight hover effect */
          transform: scale(1.02);
        }
        
        /* **UPDATED STYLING FOR THE ICON** */
        .avatar-icon {
          width: 48px; /* Slightly smaller to match the look */
          height: 48px;
          color: #f5f6ff;
          stroke: #ffffff; /* Explicitly set stroke to white/light */
          stroke-width: 1.5; /* Adjusted stroke width for a thinner line */
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
          z-index: 1;
          
          /* Added subtle drop shadow to match the light glow */
          filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.4));
        }

        .avatar-preview {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background-size: cover;
          background-position: center;
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
          width: 100%;
          display: flex;
          justify-content: center;
          margin-top: 18px;
        }

        /* 5. Input Typography: Matches subtitle (16px, white) */
        .text-input,
        .textarea-input {
          width: 100%;
          box-sizing: border-box; 
          font-family: ${fontStack};
          font-size: 16px; /* Matched to subtitle */
          color: #ffffff;  /* Matched to subtitle */
          border-radius: 999px;
          border: 1px solid #34384f;
          background: #090a12;
          padding: 12px 20px;
          outline: none;
        }

        .text-input::placeholder,
        .textarea-input::placeholder {
          color: #8b8fa5; 
          opacity: 1;
        }

        .text-input:focus,
        .textarea-input:focus {
          border-color: #7e8bff;
          box-shadow: 0 0 0 1px rgba(126, 139, 255, 0.3);
        }

        .textarea-wrap {
          position: relative;
          width: 100%;
        }

        .textarea-input {
          border-radius: 18px;
          min-height: 142px;
          resize: vertical;
          padding-right: 64px; 
          line-height: 1.5;
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