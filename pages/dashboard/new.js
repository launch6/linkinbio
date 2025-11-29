// pages/dashboard/new.js
import { useState } from "react";

export default function NewProfile() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          description: description || "",
          avatarUrl: avatarUrl || "",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Failed to create profile");
        setSubmitting(false);
        return;
      }

      window.location.href = `/dashboard/${data.editToken}`;
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const previewSlug = slug || "your-name";
  const previewName = name || "Your name";
  const previewBio =
    description || "Tell collectors what you create and how to get it.";

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-2">
            Step 1 of 2
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold">
            Create your artist profile
          </h1>
          <p className="mt-2 text-sm md:text-base text-neutral-300 max-w-2xl">
            This sets up your public page URL, avatar, and bio. You’ll add drops,
            links, social icons, and email capture from your editor after this
            step.
          </p>
        </header>

        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
          {/* Form */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 md:p-7 space-y-5">
            {error ? (
              <div className="rounded-md border border-rose-600/40 bg-rose-900/20 text-rose-100 px-3 py-2 text-sm">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-xs uppercase tracking-wide text-neutral-400 mb-1">
                  Display name
                </label>
                <input
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none text-sm focus:border-neutral-400"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name or studio (e.g., Backyards of Key West)"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-neutral-400 mb-1">
                  Public URL slug
                </label>
                <input
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none text-sm focus:border-neutral-400"
                  name="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g., backyardsofkeywest"
                  pattern="^[a-z0-9-]{3,40}$"
                  title="Lowercase letters, numbers, hyphen. 3–40 characters."
                  required
                />
                <p className="mt-1 text-xs text-neutral-400">
                  This becomes{" "}
                  <code className="text-neutral-200">
                    l6.io/{previewSlug}
                  </code>{" "}
                  (or your own domain later).
                </p>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-neutral-400 mb-1">
                  Avatar image URL <span className="text-neutral-500">(optional)</span>
                </label>
                <input
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none text-sm focus:border-neutral-400"
                  name="avatarUrl"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://…/avatar.jpg"
                />
                <p className="mt-1 text-xs text-neutral-400">
                  Paste a direct HTTPS image link (ideal square image, ~1000×1000px, max
                  ~2&nbsp;MB). Image upload from your computer is coming soon.
                </p>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-neutral-400 mb-1">
                  Short bio <span className="text-neutral-500">(optional)</span>
                </label>
                <textarea
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none text-sm focus:border-neutral-400 min-h-[80px]"
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell collectors what you create and how often you drop new pieces."
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-lg bg-white text-neutral-950 px-4 py-2 text-sm font-medium hover:bg-neutral-200 disabled:opacity-60"
                >
                  {submitting ? "Creating…" : "Create profile"}
                </button>
                <p className="text-xs text-neutral-400">
                  After this step you’ll land in your editor to add drops, links,
                  social icons, and email capture.
                </p>
              </div>
            </form>
          </div>

          {/* Preview */}
          <div className="hidden md:block">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 mb-3">
              Live preview
            </div>
            <div className="rounded-[32px] border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 p-5 w-full max-w-xs mx-auto shadow-xl">
              <div className="flex flex-col items-center mb-4">
                <div className="h-16 w-16 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden flex items-center justify-center text-sm text-neutral-400">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Avatar preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span>{previewName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="mt-3 text-sm font-semibold">{previewName}</div>
                <div className="text-[11px] text-neutral-400">
                  l6.io/{previewSlug}
                </div>
              </div>

              <div className="text-[11px] text-neutral-300 mb-4 line-clamp-3">
                {previewBio}
              </div>

              <div className="space-y-2">
                <div className="h-9 rounded-full bg-neutral-800/80 border border-neutral-700/80 flex items-center justify-center text-[11px] text-neutral-300">
                  Example drop — “Sunset Study”
                </div>
                <div className="h-9 rounded-full bg-neutral-800/60 border border-neutral-700/60 flex items-center justify-center text-[11px] text-neutral-400">
                  Example link — “Shop prints”
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
