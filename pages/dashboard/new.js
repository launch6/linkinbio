// pages/dashboard/new.js
import { useRef, useState } from 'react';

function slugify(input) {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/^@+/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'profile'
  );
}

export default function NewProfile() {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [bioLength, setBioLength] = useState(0);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = 1024 * 1024; // 1 MB
    if (file.size > maxBytes) {
      alert('Please upload an image up to 1 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setAvatarPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const name = displayName.trim();
    if (!name) {
      alert('Please add a display name or tap Skip.');
      return;
    }

    setIsSubmitting(true);
    try {
      const slug = slugify(name);
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          description: bio.trim(),
          avatarUrl: avatarPreview || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create profile');
        setIsSubmitting(false);
        return;
      }

      window.location.href = `/dashboard/${data.editToken}`;
    } catch (err) {
      console.error(err);
      alert('Something went wrong while creating your profile.');
      setIsSubmitting(false);
    }
  };

  const handleSkip = (e) => {
    e.preventDefault();
    // Empty profile shell. Name is required by the API, so give a neutral default.
    const fallbackName = 'New profile';
    const slug = slugify(fallbackName);

    setIsSubmitting(true);
    fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fallbackName,
        slug,
        description: '',
        avatarUrl: '',
      }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || 'Failed to create profile');
          setIsSubmitting(false);
          return;
        }
        window.location.href = `/dashboard/${data.editToken}`;
      })
      .catch((err) => {
        console.error(err);
        alert('Something went wrong while creating your profile.');
        setIsSubmitting(false);
      });
  };

  const handleBioChange = (e) => {
    const value = e.target.value.slice(0, 160);
    setBio(value);
    setBioLength(value.length);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#05020f] via-[#050316] to-[#020008] text-white flex flex-col items-center px-4 pb-16">
      {/* Logo */}
      <header className="pt-6 pb-4">
        <img
          src="/launch6_white.png"
          alt="Launch6"
          className="mx-auto h-10 w-auto"
        />
      </header>

      {/* Card */}
      <section className="relative w-full max-w-2xl rounded-3xl border border-white/5 bg-[#05040e]/95 shadow-[0_30px_80px_rgba(0,0,0,0.85)] backdrop-blur-xl px-8 sm:px-10 py-10 sm:py-12">
        {/* Step */}
        <p className="text-center text-xs tracking-[0.22em] text-white/55 mb-4 uppercase">
          STEP 1 OF 3
        </p>

        {/* Heading */}
        <h1 className="text-center text-2xl font-semibold mb-2">
          Add profile details
        </h1>

        {/* Subcopy (same size as name/bio placeholders visually) */}
        <p className="text-center text-[15px] leading-relaxed text-white mb-1">
          Add your profile image, name, and bio.
        </p>
        <p className="text-center text-[15px] leading-relaxed text-white mb-8">
          You’ll set up links, drops, and email capture in the next steps.
        </p>

        {/* Avatar uploader */}
        <div className="flex flex-col items-center mb-8">
          <button
            type="button"
            onClick={handleAvatarClick}
            className="group relative flex h-32 w-32 items-center justify-center rounded-full border border-white/18 bg-gradient-to-b from-[#141325] via-[#080716] to-[#05040e] shadow-[0_12px_30px_rgba(0,0,0,0.75)] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70"
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Profile preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 text-white">
                <span className="text-2xl leading-none">📷</span>
                <span className="text-lg leading-none">+</span>
              </div>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleAvatarChange}
          />

          <p className="mt-4 text-xs text-white/65">
            Drag &amp; drop or tap to upload image
          </p>
          <p className="text-xs text-white/45">(JPG/PNG, up to 1MB)</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Display name */}
          <div>
            <label className="sr-only" htmlFor="displayName">
              Display name
            </label>
            <div className="rounded-full border border-white/14 bg-black/30 px-5 py-3 text-[15px] focus-within:border-purple-400/80 focus-within:bg-black/50 transition-colors">
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="@yourname or Studio Name"
                className="w-full bg-transparent text-[15px] text-white placeholder:text-white/60 outline-none"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="sr-only" htmlFor="bio">
              Short bio
            </label>
            <div className="relative rounded-2xl border border-white/14 bg-black/30 px-5 pt-3 pb-8 focus-within:border-purple-400/80 focus-within:bg-black/50 transition-colors">
              <textarea
                id="bio"
                value={bio}
                onChange={handleBioChange}
                placeholder="Fill in your bio or tell collectors about your newest art drop"
                className="min-h-[120px] w-full resize-none bg-transparent text-[15px] text-white placeholder:text-white/60 outline-none"
              />
              <span className="pointer-events-none absolute bottom-2 right-4 text-xs text-white/45">
                {bioLength}/160
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-full bg-gradient-to-r from-[#6f4bff] via-[#7f5dff] to-[#4db5ff] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,0.7)] disabled:opacity-60"
            >
              {isSubmitting ? 'Saving…' : 'Continue'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="flex-1 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white/85 hover:bg-white/8 disabled:opacity-60"
            >
              Skip
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-white/50">
            After this step you’ll land in your editor to add links, social
            icons, drops, and email capture.
          </p>
        </form>
      </section>
    </main>
  );
}
