// pages/editor.js
import { useEffect, useState } from "react";

export default function EditorPage() {
  const [editToken, setEditToken] = useState("");
  const [state, setState] = useState({ loading: true, error: "", profile: null });

  // Read editToken from URL on client
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    const t = u.searchParams.get("editToken") || "";
    setEditToken(t);
    if (t) {
      fetch(`/api/profile/get?editToken=${encodeURIComponent(t)}`)
        .then(r => r.json())
        .then(j => {
          if (!j?.ok) throw new Error(j?.error || "Failed to load profile");
          setState({ loading: false, error: "", profile: j.profile });
          // persist for later
          window.localStorage.setItem("editToken", t);
        })
        .catch(e => setState({ loading: false, error: e.message || "Failed to load", profile: null }));
    } else {
      setState({ loading: false, error: "Missing editToken in URL", profile: null });
    }
  }, []);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
        <div className="opacity-80">Loading editor…</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-xl border border-red-600/40 bg-red-900/20 p-4">
          <div className="font-semibold mb-1">Can’t open editor</div>
          <div className="text-sm opacity-80">{state.error}</div>
        </div>
      </div>
    );
  }

  const p = state.profile;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Launch6 — Editor</h1>
          <code className="text-xs opacity-70">editToken: {editToken}</code>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 rounded-2xl border border-neutral-800 p-6">
            <div className="text-xl font-semibold mb-2">Profile</div>
            <div className="space-y-2 text-sm">
              <div><span className="opacity-60">Display name:</span> {p.displayName || p.name || "New Creator"}</div>
              <div><span className="opacity-60">Public slug:</span> {p.publicSlug || p.slug || "(not set)"}</div>
              <div><span className="opacity-60">Plan:</span> {p.plan}</div>
              <div><span className="opacity-60">Status:</span> {String(p.status ?? "active")}</div>
              <div><span className="opacity-60">Links:</span> {p.links?.length || 0}</div>
              <div><span className="opacity-60">Products:</span> {p.products?.length || 0}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 p-6">
            <div className="text-xl font-semibold mb-2">Next steps</div>
            <ol className="list-decimal list-inside text-sm space-y-2 opacity-90">
              <li>Add a link</li>
              <li>Add a product</li>
              <li>Connect Klaviyo (optional)</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
