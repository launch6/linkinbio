// middleware.js
import { NextResponse } from "next/server";

/**
 * Allow-list middleware:
 * - Always allow API routes
 * - Always allow webhook + health endpoints
 * - Allow pricing and our set-token helper
 * - Everything else continues normally
 */
export function middleware(req) {
  const { pathname } = req.nextUrl;

  // 1) Always allow API
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 2) Explicit allow-list (add more paths here as needed)
  const allowed = new Set([
    "/",
    "/pricing",
    "/set-token",
    "/dashboard", // dashboard root
  ]);

  // allow /dashboard/<editToken>
  if (pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // allow explicit paths
  if (allowed.has(pathname)) {
    return NextResponse.next();
  }

  // 3) Webhook/health (in case you referenced without /api/)
  if (
    pathname === "/api/stripe-webhook" ||
    pathname === "/api/klaviyo-capture" ||
    pathname === "/api/ping"
  ) {
    return NextResponse.next();
  }

  // Default: continue (don’t rewrite or block)
  return NextResponse.next();
}

/**
 * Match all routes so we can allow-list what we need.
 * (You can narrow this if you prefer.)
 */
export const config = {
  matcher: ["/:path*"],
};
