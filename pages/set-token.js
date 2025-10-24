// pages/set-token.js
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function SetTokenPage() {
  const router = useRouter();

  useEffect(() => {
    // Wait until the router has the query populated
    if (!router.isReady) return;

    const { editToken = "", to = "/pricing" } = router.query || {};

    try {
      if (editToken) {
        // Persist for the Pricing page and dashboard
        localStorage.setItem("editToken", String(editToken));
      }
    } catch {
      // ignore storage errors
    }

    // Always redirect with the token in the URL as well
    const next = `${to}?editToken=${encodeURIComponent(String(editToken || ""))}`;
    router.replace(next);
  }, [router.isReady, router.query, router]);

  // Return a valid element so Next.js recognizes this as a page component
  return <div style={{ display: "none" }}>setting token…</div>;
}
