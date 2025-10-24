// pages/_app.js
import { useEffect } from "react";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // On every page load, capture ?editToken=... from the URL and persist it
    try {
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get("editToken");
      if (tokenFromUrl) {
        localStorage.setItem("editToken", tokenFromUrl);
      }
    } catch {
      // no-op
    }
  }, []);

  return <Component {...pageProps} />;
}
