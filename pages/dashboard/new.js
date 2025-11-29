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

  const previewSlug = slug.trim() || "your-name";
  const publicPreview = `https://${baseHost}/${previewSlug}`;

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
        description: (description || "").trim(),
        avatarUrl: (avatarUrl || "").trim(),
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

      // Go to the dashboard/editor for this profile
      window.location.href = `/dashboard/${data.editToken}`;
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <main className="container">
      <div className="card">
        <h1>Create your artist profile</h1>
        <p className="small">
          This sets up your public page URL, avatar, and bio. You can add drops,
          links, and email capture after this step.
        </p>

        {error && (
          <div className="alert error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} style={{ marginTop: 16 }}>
          {/* Display name */}
          <label>Display name</label>
          <input
            className="input"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name or studio (e.g., Backyards of Key West)"
            required
          />

          {/* Slug */}
          <label style={{ marginTop: 12 }}>Public URL slug</label>
          <input
            className="input"
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="e.g., backyardsofkeywest"
            pattern="^[a-z0-9-]{3,40}$"
            title="Lowercase letters, numbers, hyphen; 3–40 characters."
            required
          />
          <div className="small" style={{ marginTop: 4 }}>
            This will become{" "}
            <code>{publicPreview}</code>.
          </div>

          {/* Avatar URL */}
          <label style={{ marginTop: 16 }}>
            Avatar image URL <span className="small">(optional)</span>
          </label>
          <input
            className="input"
            name="avatarUrl"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…/avatar.jpg"
          />
          <div className="small" style={{ marginTop: 4 }}>
            Paste a direct HTTPS image link now, or change this later in your editor.
          </div>

          {/* Bio */}
          <label style={{ marginTop: 16 }}>
            Short bio <span className="small">(optional)</span>
          </label>
          <textarea
            className="textarea"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell collectors what you create and how your drops work."
          />

          <button
            className="button"
            type="submit"
            disabled={submitting}
            style={{ marginTop: 16 }}
          >
            {submitting ? "Creating profile…" : "Create profile"}
          </button>

          <p className="small" style={{ marginTop: 8 }}>
            After this step you’ll land in your editor, where you can add drops, links,
            social icons, and email capture.
          </p>
        </form>
      </div>
    </main>
  );
}
