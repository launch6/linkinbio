// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep this minimal so Next builds serverless functions for /pages/api/*
  reactStrictMode: true,

  // IMPORTANT: do NOT set output: 'export' or anything that turns this
  // into a static export, or API routes will 404 on Vercel.
  // output: undefined,

  // If you had custom headers/rewrites before, leave them out for now.
  // We'll add back only what's necessary once /api routes work.
};

module.exports = nextConfig;
