// middleware.js
import { NextResponse } from 'next/server';

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow these routes to pass straight through (no auth/bot checks)
  if (
    pathname.startsWith('/api/stripe-webhook') ||
    pathname.startsWith('/api/klaviyo-capture') ||
    pathname.startsWith('/api/ping') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Everything else: just continue (you can add logic later)
  return NextResponse.next();
}

// Limit where middleware runs (avoid static assets/_next)
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
