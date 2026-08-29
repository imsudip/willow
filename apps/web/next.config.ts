import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
// Load the repo-root .env.local into process.env before Next reads env
// (Next only auto-loads .env* from the app dir by default).
import "./src/lib/env-load";

// Serwist = the maintained Workbox successor for App Router; replaces
// vite-plugin-pwa. The service worker lives at src/app/sw.ts and produces
// public/sw.js at build time.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Don't auto-generate AGENTS.md/CLAUDE.md in app dirs (the repo already has
  // a canonical AGENTS.md at the root).
  agentRules: false,
};

export default withSerwist(nextConfig);
