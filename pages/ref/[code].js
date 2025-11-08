// pages/ref/[code].js
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function RefLanding() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const { code = "" } = router.query || {};
    try {
      if (code) localStorage.setItem("refCode", String(code));
    } catch {}
    router.replace(`/pricing?refCode=${encodeURIComponent(String(code || ""))}`);
  }, [router.isReady, router.query, router]);

  return <div style={{ display: "none" }} />;
}
