// pages/dashboard/new.js
import { useEffect, useState } from "react";

export default function NewProfile() {
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://l6.io");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin || "https://l6.io");
    }
  }, []);

  const publicUrl = `${baseUrl}/${slug || "your-name"}`;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    try {
      const payload = {
        name: displayName,
        slug,
        description: bio,
        avatarUrl,
      };

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data?.editToken) {
        alert(data?.error || "Failed to create profile");
        setSubmitting(false);
        return;
      }

      window.location.href = `/dashboard/${data.editToken}`;
    } catch (err) {
      console.error(err);
      alert("Something went wrong creating your profile.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm tracking-[0.2em] uppercase text-neutral-500 mb-1">
              Launch6
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">
              Create your artist profile
            </h1>
            <p className="text-sm md:text-base text-neutral-400 mt-2 max-w-xl">
              This sets up your public page URL, avatar, and bio. You can add
              drops, links, social icons, and email capture in the next step.
            </p>
          </div>
          <div className="text-xs text-neutral-500 hidden sm:block">
            Step 1 of 2
          </div>
        </header>

        {/* Layout */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left: form */}
          <form
            onSubmit={handleCreate}
            className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 space-y-5 shadow-lg shadow-black/40"
          >
            {/* Display name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Display name
              </label>
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                placeholder="Your name or studio (e.g., Backyards of Key West)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Public URL slug
              </label>
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                placeholder="e.g., backyardsofkeywest"
                pattern="^[a-z0-9-]{3,40}$"
                title="Use 3–40 characters: lowercase letters, numbers, and hyphens only."
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                required
              />
              <p className="mt-1 text-xs text-neutral-500">
                This becomes{" "}
                <span className="font-mono text-neutral-300">{publicUrl}</span>.
                You can change it later in your editor.
              </p>
            </div>

            {/* Avatar */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Avatar image URL <span className="text-neutral-500">(optional)</span>
              </label>
              <input
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                placeholder="https://…/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
              <p className="mt-1 text-xs text-neutral-500">
                Paste a direct HTTPS image link. You can swap this later in your editor.
              </p>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
                Short bio <span className="text-neutral-500">(optional)</span>
              </label>
              <textarea
                className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 min-h-[80px]"
                placeholder="Tell collectors what you create and how you drop your pieces…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold shadow-md shadow-indigo-500/40 transition-colors w-full md:w-auto"
              >
                {submitting ? "Creating profile…" : "Create profile & continue"}
              </button>
              <p className="mt-2 text-xs text-neutral-500">
                After this you’ll land in your editor to add drops, links, socials, and
                email capture.
              </p>
            </div>
          </form>

          {/* Right: live preview card */}
          <div className="hidden md:flex items-center justify-center">
            <div className="w-full max-w-xs rounded-3xl bg-gradient-to-b from-neutral-800 to-neutral-950 border border-neutral-700/70 shadow-[0_0_60px_rgba(0,0,0,0.7)] p-5 space-y-4">
              {/* avatar */}
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="h-16 w-16 rounded-full bg-neutral-700 overflow-hidden flex items-center justify-center text-sm font-medium">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Avatar preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-neutral-300">
                      {displayName
                        ? displayName
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "A"}
                    </span>
                  )}
                </div>
                <div>
                  <div className="font-semibold">
                    {displayName || "Your name"}
                  </div>
                  <div className="text-xs text-neutral-400 break-all">
                    {publicUrl}
                  </div>
                </div>
              </div>

              {/* bio */}
              <p className="text-xs text-neutral-300 text-center min-h-[40px]">
                {bio ||
                  "“Limited drops, real collectors. I release a few pieces at a time so everything feels special.”"}
              </p>

              {/* sample buttons */}
              <div className="space-y-2">
                <button className="w-full rounded-xl bg-white/95 text-neutral-900 text-xs font-semibold py-2">
                  New drop — “Sunset Study”
                </button>
                <button className="w-full rounded-xl bg-neutral-800 text-neutral-100 text-xs py-2 border border-neutral-700">
                  Instagram
                </button>
                <button className="w-full rounded-xl bg-neutral-800 text-neutral-100 text-xs py-2 border border-neutral-700">
                  Shop all prints
                </button>
              </div>

              <p className="text-[10px] text-neutral-500 text-center pt-1">
                Preview of how your Launch6 page might feel. You’ll customize
                everything in the next step.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
