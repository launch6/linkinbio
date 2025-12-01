// pages/dashboard/new.js
import { useState } from 'react';

const MAX_BIO_CHARS = 160;
const MAX_AVATAR_BYTES = 1024 * 1024; // 1 MB for now

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'artist';
}

export default function NewProfile() {
  const [creating, setCreating] = useState(false);
  const [bio, setBio] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarData, setAvatarData] = useState(null); // temporary storage; later can move to S3

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      alert('Please use an image up to 1 MB for now.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string') {
        setAvatarPreview(dataUrl);
        setAvatarData(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (creating) return;

    const form = new FormData(e.currentTarget);
    const displayName = (form.get('displayName') || '').toString().trim();
    const description = bio.trim();

    if (!displayName) {
      alert('Please add a display name.');
      return;
    }

    const name = displayName;
    const slug = slugify(displayName);

    setCreating(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description,
          avatarUrl: avatarData || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create profile');
      } else {
        location.href = `/dashboard/${data.editToken}`;
      }
    } catch (err) {
      console.error(err);
      alert('Something went wrong creating your profile.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main
      className="container"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#0f1117',
          borderRadius: 24,
          padding: 28,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Logo row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}
        >
          <img
            src="/launch6_white.png"
            alt="Launch6"
            style={{
              height: 26, // ~20% smaller than previous
              width: 'auto',
              opacity: 0.9,
            }}
          />
        </div>

        {/* Step label */}
        <p
          style={{
            fontSize: 12,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#a0a3c0',
            marginBottom: 4,
            textAlign: 'center',
          }}
        >
          Step 1 of 3
        </p>

        {/* Title + helper */}
        <h1
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: '#f9fafb',
            textAlign: 'center',
            marginBottom: 6,
          }}
        >
          Add profile details
        </h1>
        <p
          style={{
            fontSize: 14,
            color: '#c1c3d6',
            textAlign: 'center',
            marginBottom: 20,
          }}
        >
          Add your profile image, name, and bio. You&rsquo;ll set up links, drops, and email
          capture in the next steps.
        </p>

        <form onSubmit={handleCreate}>
          {/* Avatar */}
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#8b8fb0',
                marginBottom: 12,
              }}
            >
              Profile image (optional)
            </label>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 140,
                height: 140,
                borderRadius: '50%',
                background: '#191b24',
                border: '2px solid #2a2d3f',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Profile preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <span
                  style={{
                    fontSize: 34,
                    color: '#e5e7ff',
                    fontWeight: 300,
                  }}
                >
                  +
                </span>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </label>

            <p
              style={{
                fontSize: 12,
                color: '#8f93b3',
                marginTop: 10,
              }}
            >
              Tap to upload &bull; JPG/PNG up to 1&nbsp;MB
            </p>
          </div>

          {/* Display name */}
          <div style={{ marginTop: 20 }}>
            <label
              htmlFor="displayName"
              style={{
                display: 'block',
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#8b8fb0',
                marginBottom: 6,
              }}
            >
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              className="input"
              placeholder="@yourname or studio"
              required
              style={{
                width: '100%',
              }}
            />
          </div>

          {/* Bio with character counter */}
          <div style={{ marginTop: 18 }}>
            <label
              htmlFor="bio"
              style={{
                display: 'block',
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#8b8fb0',
                marginBottom: 6,
              }}
            >
              Short bio (optional)
            </label>

            <div style={{ position: 'relative' }}>
              <textarea
                id="bio"
                name="bio"
                className="textarea"
                rows={4}
                maxLength={MAX_BIO_CHARS}
                placeholder="Tell collectors what you create and how often you drop new pieces."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={{
                  width: '100%',
                  paddingRight: 70,
                  resize: 'vertical',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 12,
                  bottom: 10,
                  fontSize: 11,
                  color: '#7c80a0',
                }}
              >
                {bio.length}/{MAX_BIO_CHARS}
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            className="button"
            type="submit"
            disabled={creating}
            style={{
              width: '100%',
              marginTop: 24,
            }}
          >
            {creating ? 'Creating…' : 'Continue'}
          </button>

          <p
            style={{
              fontSize: 12,
              color: '#8f93b3',
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            After this step you&rsquo;ll land in your editor to add links, social icons, drops,
            and email capture.
          </p>
        </form>
      </div>
    </main>
  );
}
