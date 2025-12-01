import { useState } from "react";

function slugFromName(value) {
  const base = (value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return base.slice(0, 40) || "artist";
}

export default function NewProfile() {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nameVal = form.get("name");
    const description = form.get("description") || "";
    const avatarUrlVal = form.get("avatarUrl") || "";
    const slug = slugFromName(nameVal);

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameVal,
        slug,
        description,
        avatarUrl: avatarUrlVal,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to create profile");
      return;
    }
    location.href = `/dashboard/${data.editToken}`;
  };

  const inferredSlug = slugFromName(name);

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Please choose an image under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050509",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "32px 16px 48px",
        }}
      >
        {/* Logo header */}
        <header
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <img
            src="/launch6_white.png"
            alt="Launch6"
            // 40% larger
            style={{ height: 84, width: "auto" }}
          />
        </header>

        <div
          className="card"
          style={{
            background: "#11121a",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 18px 40px rgba(0,0,0,0.55)",
          }}
        >
          {/* Step label */}
          <p
            className="small"
            style={{
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontSize: 11,
              marginBottom: 8,
              color: "#9ca3af",
              textAlign: "center",
            }}
          >
            Step 1 of 2
          </p>

          {/* Title + intro */}
          <h1
            style={{
              fontSize: 24,
              lineHeight: 1.3,
              fontWeight: 600,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Create your artist profile
          </h1>
          <p
            className="small"
            style={{
              fontSize: 14,
              color: "#b0b3c6",
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            Add your profile image, display name, and a short bio. You will
            connect links, socials, and drops in the next step.
          </p>

          <form onSubmit={handleCreate}>
            {/* PROFILE IMAGE */}
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#9ca3af",
                marginBottom: 8,
              }}
            >
              Profile image (optional)
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  height: 64,
                  width: 64,
                  borderRadius: "999px",
                  background: "#1f2937",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  color: "#e5e7eb",
                  flexShrink: 0,
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar preview"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  "+"
                )}
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ display: "inline-block" }}>
                  <span
                    className="button secondary"
                    style={{
                      padding: "6px 14px",
                      fontSize: 13,
                      marginBottom: 4,
                      cursor: "pointer",
                      display: "inline-block",
                    }}
                  >
                    Upload from device
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    style={{ display: "none" }}
                  />
                </label>
                <p
                  className="small"
                  style={{ fontSize: 12, color: "#9ca3af" }}
                >
                  JPG or PNG up to 2 MB, or paste an image URL below.
                </p>
              </div>
            </div>

            <input
              className="input"
              name="avatarUrl"
              placeholder="https://…/avatar.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              style={{ marginBottom: 20 }}
            />

            {/* DISPLAY NAME */}
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#9ca3af",
                marginBottom: 6,
              }}
            >
              Display name
            </label>
            <input
              className="input"
              name="name"
              placeholder="Your name or studio (e.g., Backyards of Key West)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ marginBottom: 16 }}
            />

            {/* SHORT BIO + COUNTER */}
            <label
              style={{
                display: "block",
                fontSize: 11,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "#9ca3af",
                marginBottom: 6,
              }}
            >
              Short bio (optional)
            </label>

            <div style={{ position: "relative", marginBottom: 24 }}>
              <textarea
                className="textarea"
                name="description"
                placeholder="Tell collectors what you create and how often you drop new pieces."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={160}
                style={{ paddingBottom: 28 }}
              />
              <span
                style={{
                  position: "absolute",
                  right: 12,
                  bottom: 8,
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                {bio.length}/160
              </span>
            </div>

            {/* URL PREVIEW */}
            <p
              className="small"
              style={{
                fontSize: 12,
                color: "#9ca3af",
                marginBottom: 24,
              }}
            >
              Your page URL will be{" "}
              <code
                style={{
                  fontFamily: "SFMono-Regular, ui-monospace, Menlo, monospace",
                }}
              >
                {`l6.io/${inferredSlug || "your-name"}`}
              </code>
              . You can update this later in your editor.
            </p>

            {/* SUBMIT */}
            <button
              className="button"
              type="submit"
              style={{ width: "100%" }}
            >
              Create profile
            </button>

            <p
              className="small"
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "#9ca3af",
              }}
            >
              After this step you will land in your editor to add drops, links,
              social icons, and email capture.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
