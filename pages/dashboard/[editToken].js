// pages/dashboard/[editToken].js
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function DashboardEditTokenRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady) return;
    const { editToken } = router.query;
    if (editToken) {
      router.replace(`/editor?editToken=${encodeURIComponent(editToken)}`);
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-6 py-4 text-sm">
        Redirecting you to your Launch6 editor…
      </div>
    </main>
  );
}
