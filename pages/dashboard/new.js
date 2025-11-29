// pages/dashboard/new.js
import { useState, useMemo } from "react";

export default function NewProfile() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const publicPath = useMemo(
    () => (slug ? `/${slug}` : "/your-name"),
    [slug]
  );

  async function handleCreate(e) {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();

    if (!trimmedName || !trimmedSlug) {
      setError("Please fill in your name and URL slug.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: trimmedSlug,
          description: description || "",
          avatarUrl: avatarUrl || "",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Failed to create profile.");
        return;
      }

      window.location.href = `/dashboard/${data.editToken}`;
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const initials = useMemo(() => {
    if (!name) return "A";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }, [name]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Top nav with logo */}
      <header className="border-b border-neutral-900">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="https://linkinbio-tau-pink.vercel.app/launch6_white.png"
              alt="Launch6"
              className="h-6 w-auto"
            />
            <span className="text-sm font-semibold tracking-wide">
              Launch6
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-10 items-start">
        {/* Left: copy + form */}
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-400 uppercase mb-2">
            Step 1
          </p>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Create your artist profile
          </h1>
          <p className="text-sm text-neutral-300 mb-6">
            This sets up your public page URL, avatar, and bio. You’ll add
            drops, links, social icons, and email capture from your editor
            after this step.
          </p>

          {error ? (
            <div className="mb-4 rounded-lg border border-rose-600/40 bg-rose-900/20 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wide text-neutral-400 mb-1">
                Display name
              </label>
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="Your name or studio (e.g., Backyards of Key West)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wide text-neutral-400 mb-1">
                Public URL slug
              </label>
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="e.g., backyardsofkeywest"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "")
                  )
                }
                pattern="^[a-z0-9-]{3,40}$"
                title="Lowercase letters, numbers, and hyphens only."
                required
              />
              <p className="mt-1 text-xs text-neutral-400">
                This becomes{" "}
                <span className="text-neutral-100">
                  l6.io{publicPath}
                </span>{" "}
                (or your own domain later).
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs uppercase tracking-wide text-neutral-400">
                  Avatar image URL
                </label>
                <span className="text-[10px] text-neutral-500 uppercase">
                  Optional
                </span>
              </div>
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                placeholder="https://…/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
              <p className="mt-1 text-xs text-neutral-400">
                Paste a direct HTTPS image link (JPG/PNG/WebP, ideally &lt;
                2&nbsp;MB). Uploading from your camera roll will be available
                on paid plans.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs uppercase tracking-wide text-neutral-400">
                  Short bio
                </label>
                <span className="text-[10px] text-neutral-500 uppercase">
                  Optional
                </span>
              </div>
              <textarea
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-emerald-500 min-h-[80px]"
                placeholder="Tell collectors what you create and how you drop pieces."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Creating profile…" : "Create profile"}
            </button>

            <p className="text-[11px] text-neutral-500">
              After this, you’ll land in your editor where you can add drops,
              links, social icons, and email capture.
            </p>
          </form>
        </div>

        {/* Right: preview */}
        <div className="hidden md:flex justify-center">
          <div className="w-72 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl px-5 py-6 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center text-xl font-semibold">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div className="text-center space-y-1">
              <div className="text-sm font-semibold">
                {name || "Your display name"}
              </div>
              <div className="text-xs text-neutral-400">
                {description || "Short bio about what you create."}
              </div>
            </div>

            <div className="w-full mt-2 space-y-2">
              <button className="w-full rounded-full bg-neutral-100 text-neutral-900 text-xs font-semibold py-2">
                Primary link
              </button>
              <button className="w-full rounded-full border border-neutral-700 text-xs text-neutral-200 py-2">
                Drop goes here
              </button>
            </div>

            <div className="mt-3 text-[11px] text-neutral-500 text-center">
              Preview of your Launch6 page — you can customize everything
              after you create your profile.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
