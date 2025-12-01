// pages/dashboard/new.js
import { useState } from "react";

export default function NewProfile() {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const publicUrl = slug ? `l6.io/${slug}` : "l6.io/your-name";

  const handleCreate = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const body = {
      name: displayName,
      slug,
      description: bio || "",
      avatarUrl: avatarUrl || "",
    };

    try {
      setSubmitting(true);
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create profile");
        return;
      }

      window.location.href = `/dashboard/${data.editToken}`;
    } catch (err) {
      alert(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Top bar */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img
              src="/launch6_white.png"
              alt="Launch6"
              className="h-8 w-auto md:h-9"
            />
            <span className="text-xs uppercase tracking-[0.28em] text-neutral-400 hidden sm:inline">
              Link-in-bio drops for artists
            </span>
          </div>
        </header>

        {/* Main card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 md:p-8 grid md:grid-cols-2 gap-8 items-start">
          {/* Left: form */}
          <section>
            <div className="text-xs font-medium tracking-[0.22em] uppercase text-neutral-400 mb-2">
              Step 1
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold mb-2">
              Create your artist profile
            </h1>
            <p className="text-sm text-neutral-300 mb-6">
              This sets up your public page URL, avatar, and bio. You’ll add
              drops, links, social icons, and email capture from your editor
              after this step.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Display name */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Display name
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-0"
                  placeholder="Your name or studio (e.g., Backyards of Key West)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Public URL slug
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-0"
                  placeholder="e.g., backyardsofkeywest"
                  pattern="^[a-z0-9-]{3,40}$"
                  title="Use 3–40 characters: lowercase letters, numbers, and dashes."
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-neutral-400">
                  This becomes <span className="font-mono">{publicUrl}</span>{" "}
                  on l6.io or your own domain later.
                </p>
              </div>

              {/* Avatar URL */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Avatar image URL <span className="text-neutral-500">(optional)</span>
                </label>
                <input
                  type="url"
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-0"
                  placeholder="https://…/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                />
                <p className="mt-1 text-xs text-neutral-400">
                  Use a direct HTTPS image link; aim for around 800×800px,
                  under ~2&nbsp;MB. Uploading from your device lives in the
                  editor roadmap.
                </p>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Short bio <span className="text-neutral-500">(optional)</span>
                </label>
                <textarea
                  className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-0 min-h-[80px]"
                  placeholder="Tell collectors what you create and how your drops work."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-lg bg-violet-500 hover:bg-violet-400 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed w-full md:w-auto"
                >
                  {submitting ? "Creating profile…" : "Create profile"}
                </button>
                <p className="mt-2 text-xs text-neutral-500">
                  After this step you land in your editor where you can add
                  drops, links, social icons, and email capture.
                </p>
              </div>
            </form>
          </section>

          {/* Right: live preview */}
          <section className="hidden md:flex justify-center">
            <div className="w-64 rounded-3xl border border-neutral-700 bg-gradient-to-b from-neutral-900 to-neutral-950 px-4 py-5 shadow-[0_0_40px_rgba(0,0,0,0.65)]">
              <div className="flex flex-col items-center mb-4">
                <div className="h-16 w-16 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden mb-3">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Avatar preview"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="text-sm font-semibold">
                  {displayName || "Your name"}
                </div>
                <div className="text-[11px] text-neutral-400 truncate max-w-full">
                  {bio || "Short line about your work and drops."}
                </div>
              </div>

              <div className="space-y-2">
                <div className="h-9 rounded-xl bg-neutral-800/80 border border-neutral-700/80 flex items-center justify-center text-[11px] text-neutral-200">
                  Example drop link
                </div>
                <div className="h-9 rounded-xl bg-neutral-800/60 border border-neutral-700/60 flex items-center justify-center text-[11px] text-neutral-300/80">
                  Another link
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-800 text-[10px] text-neutral-500 text-center">
                Preview of{" "}
                <span className="font-mono text-neutral-300">{publicUrl}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
