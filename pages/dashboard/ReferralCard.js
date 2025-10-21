// pages/dashboard/ReferralCard.js
import { useState } from "react";

export default function ReferralCard({ username }) {
  const [copied, setCopied] = useState(false);

  const inviteLink = `https://launch6.com/invite/${username}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1f1f1f, #292929)",
        color: "white",
        padding: "24px",
        borderRadius: "16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        marginBottom: "24px",
      }}
    >
      <h2 style={{ margin: "0 0 10px", fontSize: "1.6rem" }}>
        🎁 Give 6 Months Free
      </h2>
      <p style={{ margin: "0 0 16px", color: "#bbb" }}>
        Your friends get 6 months free of Starter — you earn referral rewards.
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "#333",
          borderRadius: "8px",
          padding: "8px 12px",
          marginBottom: "12px",
        }}
      >
        <input
          type="text"
          readOnly
          value={inviteLink}
          style={{
            background: "transparent",
            border: "none",
            color: "white",
            flexGrow: 1,
            fontSize: "0.9rem",
          }}
        />
        <button
          onClick={handleCopy}
          style={{
            background: copied ? "#2ecc71" : "#6a5acd",
            border: "none",
            padding: "8px 12px",
            borderRadius: "8px",
            color: "white",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <a
          href={`https://www.instagram.com/?url=${encodeURIComponent(inviteLink)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={shareBtn}
        >
          Share on Instagram
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
            "Give 6 months free of Launch6 — join free here: " + inviteLink
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          style={shareBtn}
        >
          Share on X
        </a>
        <a
          href={`mailto:?subject=Free%206%20Months%20of%20Launch6&body=Hey!%20You%20can%20get%206%20months%20free%20of%20Launch6%20here:%20${inviteLink}`}
          style={shareBtn}
        >
          Share via Email
        </a>
      </div>

      <p style={{ marginTop: "16px", color: "#888", fontSize: "0.9rem" }}>
        🎉 Invite your first 5 friends this week to unlock Pro perks!
      </p>
    </div>
  );
}

const shareBtn = {
  background: "#444",
  color: "white",
  padding: "8px 12px",
  borderRadius: "8px",
  textDecoration: "none",
  fontSize: "0.85rem",
};
