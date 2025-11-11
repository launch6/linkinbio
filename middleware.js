// middleware.js
import { NextResponse } from "next/server";

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // 1) Skip assets & static files (let Vercel cache these)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    /\.(?:js|css|png|jpg|jpeg|gif|webp|svg|ico|txt|map)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2) Always pass API routes through (API handlers set their own headers)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 3) For all other HTML routes (/, /pricing, /public, /editor, /dashboard, /[slug], etc.)
  //    force no-store at both browser and Vercel CDN layers
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Vercel-CDN-Cache-Control", "no-store");
  return res;
}

// Match everything; we filter inside middleware
export const config = {
  matcher: ["/:path*"],
};
