// pages/dashboard/new.js

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  marginBottom: 4,
  color: "#9ca3af",
};

export default function NewProfile() {
  const handleCreate = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const name = form.get("name");
    const slug = form.get("slug");
    const description = form.get("description") || "";
    const avatarUrl = form.get("avatarUrl") || "";

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, description, avatarUrl }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Failed to create profile");
      return;
    }

    location.href = `/dashboard/${data.editToken}`;
  };

  return (
    <main
      className="container"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 40,
        paddingBottom: 40,
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 560,
          padding: "28px 24px",
        }}
      >
        {/* Header copy */}
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#9ca3af",
              marginBottom: 6,
            }}
          >
            Step 1 of 2
          </p>
          <h1
            style={{
              fontSize: 28,
              lineHeight: 1.2,
              margin: "0 0 8px",
            }}
          >
            Create your artist profile
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#d1d5db",
              margin: 0,
            }}
          >
            This sets up your public page URL, avatar, and bio. You’ll add drops,
            links, social icons, and email capture from your editor after this
            step.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div>
            <label style={labelStyle}>Display name</label>
            <input
              className="input"
              name="name"
              placeholder="Your name or studio (e.g., Backyards of Key West)"
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Public URL slug</label>
            <input
              className="input"
              name="slug"
              placeholder="e.g., backyardsofkeywest"
              pattern="^[a-z0-9-]{3,40}$"
              title="Lowercase letters, numbers, hyphen. 3–40 characters."
              required
            />
            <p
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              This becomes{" "}
              <code style={{ color: "#e5e7eb" }}>l6.io/your-slug</code>. You can
              connect your own domain later.
            </p>
          </div>

          <div>
            <label style={labelStyle}>
              Avatar image URL{" "}
              <span style={{ textTransform: "none", color: "#6b7280" }}>
                (optional)
              </span>
            </label>
            <input
              className="input"
              name="avatarUrl"
              placeholder="https://…/avatar.jpg"
            />
            <p
              style={{
                marginTop: 4,
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              Paste a direct HTTPS image link (ideally a square image). Upload
              from your phone or computer is coming soon.
            </p>
          </div>

          <div>
            <label style={labelStyle}>
              Short bio{" "}
              <span style={{ textTransform: "none", color: "#6b7280" }}>
                (optional)
              </span>
            </label>
            <textarea
              className="textarea"
              name="description"
              placeholder="Tell collectors what you create and how often you drop new pieces."
              style={{ minHeight: 80 }}
            ></textarea>
          </div>

          <div
            style={{
              marginTop: 8,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button className="button" type="submit">
              Create profile
            </button>
            <p
              style={{
                fontSize: 12,
                color: "#9ca3af",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              After this step you’ll land in your editor to add drops, links,
              social icons, and email capture.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
