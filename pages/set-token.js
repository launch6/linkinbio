// pages/set-token.js
import { useEffect } from "react";

export default function SetToken() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const editToken = url.searchParams.get("editToken") || "";
      const to = url.searchParams.get("to") || "/pricing";

      if (editToken) {
        try {
          localStorage.setItem("editToken", editToken);
        } catch {}
      }

      // Always redirect with the token in the URL too
      const next = `${to}?editToken=${encodeURIComponent(editToken)}`;
      window.location.replace(next);
    } catch {
      // If something odd happens, just go to pricing
      window.location.replace("/pricing");
    }
  }, []);

  return null;
}
