import { useState, useMemo } from "react";

export default function NewProfile() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const baseHost = useMemo(() => {
    if (typeof window === "undefined") return "l6.io";
    return window.location.host.replace(/^(www\.)/, "");
  }, []);

  const publicPreview = slug ? `https://${baseHost}/${slug}` : `https://${baseHost}/your-name`;

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const trimmedSlug = slug.trim();
      if (!/^[a-z0-9-]{3,40}$/.test(trimmedSlug)) {
        setError(
          "Slug must be 3–40 characters and only use lowercase letters, numbers, and dashes."
        );
        setSubmitting(false);
        return;
      }

      const payload = {
        name: name.trim(),
        slug: trimmedSlug,
        description: description.trim(),
        avatarUrl: avatarUrl.trim(),
      };

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.editToken) {
        setError(data?.error || "Failed to create profile. Please try again.");
        setSubmitting(false);
        return;
      }

      // Send the artist into the dashboard/editor for this profile
      window.location.href = `/dashboard/${data.editToken}`;
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 md:p-8 shadow-xl">
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-1">
            Launch6
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold mb-1">
            Create your artist profile
          </h1>
          <p className="text-sm text-neutral-400">
            This sets up your public page URL, avatar, and bio. You can add drops,
            links, and email capture after this step.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-600/40 bg-rose-900/30 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleCreate}>
          {/* Display name */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Display name
            </label>
            <input
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-neutral-400"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name or studio (e.g., Backyards of Key West)"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Public URL slug
            </label>
            <input
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-neutral-400"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="e.g., backyardsofkeywest"
              pattern="^[a-z0-9-]{3,40}$"
              title="Lowercase letters, numbers, hyphen; 3–40 characters."
              required
            />
            <p className="mt-1 text-xs text-neutral-500">
              This will become{" "}
              <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-[11px]">
                {publicPreview}
              </code>
              .
            </p>
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Avatar image URL <span className="text-neutral-500">(optional)</span>
            </label>
            <input
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-neutral-400"
              name="avatarUrl"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…/avatar.jpg"
            />
            <p className="mt-1 text-xs text-neutral-500">
              You can paste a direct HTTPS image link now, or add/change this later in
              your editor.
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1">
              Short bio <span className="text-neutral-500">(optional)</span>
            </label>
            <textarea
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm outline-none focus:border-neutral-400 min-h-[80px]"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell collectors what you create and how your drops work."
            />
          </div>

          <button
            className="mt-2 w-full rounded-lg bg-white text-neutral-900 text-sm font-medium px-4 py-2.5 hover:bg-neutral-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Creating profile…" : "Create profile"}
          </button>

          <p className="mt-2 text-[11px] text-neutral-500 text-center">
            After this step you’ll land in your editor, where you can add drops, links,
            social icons, and email capture.
          </p>
        </form>
      </div>
    </main>
  );
}
