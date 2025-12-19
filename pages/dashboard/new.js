// pages/dashboard/new.js
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";

function slugify(input) {
  const base = (input || "").toLowerCase().trim();
  const core = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return core || `artist-${Date.now()}`;
}

export default function NewProfile() {
  const router = useRouter();
  const { token } = router.query;

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  const fileInputRef = useRef(null);
  const hydratedOnceRef = useRef(false);

  const bioMax = 160;
  const bioCount = bio.length;

  const fontStack =
    "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

  // Hydrate Step 1 from DB so Back works (including avatarUrl).
  useEffect(() => {
    if (!router.isReady) return;

    const t = Array.isArray(token) ? token[0] : token;
    if (!t) return;

    if (hydratedOnceRef.current) return;
    hydratedOnceRef.current = true;

    (async () => {
      try {
        const r = await fetch(`/api/profile/get?editToken=${encodeURIComponent(t)}`, {
          cache: "no-store",
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j?.ok || !j?.profile) return;

        const prof = j.profile || {};

        const name = prof.displayName ?? prof.name ?? "";
        const slug = prof.publicSlug ?? prof.slug ?? "";
        const desc = prof.bio ?? prof.description ?? "";
        const avatar = prof.avatarUrl ?? "";

        setDisplayName(String(name || ""));
        setUsername(String(slug || ""));
        setBio(String(desc || ""));
        setAvatarDataUrl(String(avatar || ""));
      } catch (err) {
        console.error("[new] Failed to hydrate Step 1 from DB", err);
      }
    })();
  }, [router.isReady, token]);

  const handleAvatarClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const processImageFile = (file) => {
    if (!file) return;

    const maxBytes = 1 * 1024 * 1024; // 1MB
    if (file.size > maxBytes) {
      alert("Image is too large. Please upload a JPG/PNG up to 1MB.");
      return;
    }

    // Block SVG explicitly even if someone renames it.
    if (file.type === "image/svg+xml") {
      alert("SVG is not allowed. Please upload a JPG/PNG.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result;
      if (typeof result === "string") setAvatarDataUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
    e.target.value = "";
  };

  const handleAvatarDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleAvatarDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const goToStep2 = (editToken) => {
    const t = Array.isArray(editToken) ? editToken[0] : editToken;
    window.location.href = `/dashboard/new-links?token=${encodeURIComponent(String(t))}`;
  };

  const saveStep1 = async () => {
    if (saving) return;
    setSaving(true);
    setUsernameError("");

    const rawName = displayName.trim();
    let slugSource = username.trim();
    const nextBio = bio.trim();

    if (!slugSource) {
      setUsernameError("Choose your username (you can change it later).");
      setSaving(false);
      return;
    }

    if (slugSource.startsWith("@")) {
      slugSource = slugSource.slice(1).trim();
      if (!slugSource) {
        setUsernameError("Choose your username (you can change it later).");
        setSaving(false);
        return;
      }
    }

    const nextSlug = slugify(slugSource);
    const finalName = rawName || slugSource;

    const t = Array.isArray(token) ? token[0] : token;

    try {
      // EDIT MODE: token exists -> update existing profile
      if (t) {
        const resp = await fetch("/api/profile/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editToken: t,
            displayName: finalName,
            publicSlug: nextSlug,
            bio: nextBio,
            avatarUrl: avatarDataUrl || "",
          }),
        });

        const j = await resp.json().catch(() => ({}));
        if (!resp.ok || !j?.ok) {
          const msg =
            j?.message ||
            (j?.error === "slug_taken"
              ? "That URL is already taken. Try another username."
              : "Failed to save profile.");
          setUsernameError(msg);
          setSaving(false);
          return;
        }

        goToStep2(t);
        return;
      }

      // CREATE MODE: no token -> create new profile
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          slug: nextSlug,
          description: nextBio, // legacy field used by /api/profile create
          avatarUrl: avatarDataUrl || "",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.editToken) {
        const rawError = data && typeof data.error === "string" ? data.error : "";

        if (res.status === 409 || (rawError && rawError.toLowerCase().includes("slug"))) {
          setUsernameError("That URL is already taken. Try another username.");
        } else {
          setUsernameError(rawError || "Failed to create profile");
        }

        setSaving(false);
        return;
      }

      goToStep2(data.editToken);
    } catch (err) {
      console.error(err);
      setUsernameError("Network error saving profile.");
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    saveStep1();
  };

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

          <p className="step-label">STEP 1 OF 4</p>
          <h1 className="title">Add profile details</h1>

          <div className="subtitle-block">
            <p className="subtitle-line">Add your profile image, name, and bio.</p>
            <p className="subtitle-line">Next you’ll add links, socials, and drops.</p>
          </div>

          <form onSubmit={handleSubmit} className="form">
            <div className="avatar-block" onDragOver={handleAvatarDragOver} onDrop={handleAvatarDrop}>
              <button
                type="button"
                className="avatar-circle"
                onClick={handleAvatarClick}
                onDragOver={handleAvatarDragOver}
                onDrop={handleAvatarDrop}
                aria-label="Upload profile image"
              >
                {avatarDataUrl ? (
                  <span className="avatar-preview" style={{ backgroundImage: `url(${avatarDataUrl})` }} />
                ) : (
                  <svg
                    className="avatar-icon"
                    viewBox="0 0 50 50"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M40.625 15.625H9.375C7.30058 15.625 5.625 17.3006 5.625 19.375V34.375C5.625 36.4494 7.30058 38.125 9.375 38.125H40.625C42.6994 38.125 44.375 36.4494 44.375 34.375V19.375C44.375 17.3006 42.6994 15.625 40.625 15.625Z"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="25"
                      cy="28.125"
                      r="6.875"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M33.75 15.625L36.25 10.625H29.375L31.875 15.625"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M39 31V35.5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M36.75 33.25H41.25"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden-file-input"
                onChange={handleFileChange}
              />

              <p className="helper-text">Drag &amp; drop or tap to upload image</p>
              <p className="helper-text helper-text-sub">(JPG/PNG, up to 1MB).</p>
            </div>

            <div className="field">
              <div className="field-control content-rail">
                <input
                  id="displayName"
                  aria-label="Display Name"
                  className="text-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Name or studio name"
                />
              </div>
            </div>

            <div className="field">
              <div className="field-control content-rail">
                <div className="slug-row">
                  <span className="slug-prefix">l6.io/</span>
                  <input
                    id="username"
                    aria-label="Username"
                    className="slug-input"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (usernameError) setUsernameError("");
                    }}
                    placeholder="username"
                  />
                </div>

                {usernameError && <p className="field-error">{usernameError}</p>}
              </div>
            </div>

            <div className="field">
              <div className="field-control content-rail">
                <div className="textarea-wrap">
                  <textarea
                    id="bio"
                    aria-label="Short bio"
                    className="textarea-input"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, bioMax))}
                    placeholder="Fill in your bio or tell collectors about your newest art drop"
                    maxLength={bioMax}
                  />
                  <span className="char-count">
                    {bioCount}/{bioMax}
                  </span>
                </div>
              </div>
            </div>

            <div className="actions-row content-rail">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Continue"}
              </button>
            </div>

            <p className="footer-note">
              After this step you’ll move on to add links, social icons, and drops.
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
          max-width: 260px;
          height: 4px;
          background: #252837;
          border-radius: 2px;
          margin: 0 auto 16px;
        }

        .progress-bar-fill {
          width: 25%;
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
          margin-bottom: 10px;
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
          margin-top: 26px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .content-rail {
          width: 100%;
          max-width: 100%;
        }

        .avatar-block {
          text-align: center;
          margin-bottom: 24px;
        }

        .avatar-circle {
          position: relative;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5) inset, 0 0 10px rgba(0, 0, 0, 0.5) inset;
          background: #0d0d15;
          width: 108px;
          height: 108px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
          cursor: pointer;
          overflow: hidden;
          filter: drop-shadow(0 0 0.5px rgba(255, 255, 255, 0.5));
          transition: all 0.2s ease;
        }

        .avatar-circle:hover {
          border-color: rgba(255, 255, 255, 0.2);
          transform: scale(1.02);
        }

        .avatar-icon {
          width: 60px;
          height: 60px;
          color: #f5f6ff;
          stroke: #ffffff;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          fill: none;
          z-index: 1;
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

        .text-input,
        .textarea-input {
          width: 100%;
          box-sizing: border-box;
          font-family: ${fontStack};
          font-size: 16px;
          color: #ffffff;
          border-radius: 999px;
          border: 1px solid #34384f;
          background: #090a12;
          padding: 12px 20px;
          outline: none;
        }

        .slug-row {
          display: flex;
          align-items: center;
          width: 100%;
          border-radius: 999px;
          border: 1px solid #34384f;
          background: #090a12;
          overflow: hidden;
          padding: 0 0 0 20px;
        }

        .slug-prefix {
          font-size: 16px;
          color: #e5e7eb;
          white-space: nowrap;
          margin-right: 8px;
        }

        .slug-input {
          flex: 1;
          min-width: 0;
          box-sizing: border-box;
          border: none;
          background: transparent;
          padding: 12px 20px 12px 0;
          color: #ffffff;
          font-size: 16px;
          outline: none;
          font-family: ${fontStack};
        }

        .slug-input::placeholder {
          color: #8b8fa5;
        }

        .slug-row:focus-within {
          border-color: #7e8bff;
          box-shadow: 0 0 0 1px rgba(126, 139, 255, 0.3);
        }

        .textarea-input {
          border-radius: 18px;
          min-height: 142px;
          resize: vertical;
          padding-right: 64px;
          line-height: 1.5;
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

        .char-count {
          position: absolute;
          right: 16px;
          bottom: 10px;
          font-size: 11px;
          color: #8b8fa5;
        }

        .field-error {
          margin-top: 6px;
          font-size: 12px;
          color: #ff9bbf;
          text-align: left;
        }

        .actions-row {
          margin-top: 24px;
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
