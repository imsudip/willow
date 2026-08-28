// Vercel Routing Middleware (Edge runtime).
//
// vercel.json can't read environment variables, so the Neon function URL is
// injected here instead: set WILLOW_API_URL in the Vercel project, and /api/*
// requests are forwarded to the Neon function at the edge. Without
// WILLOW_API_URL (local `vercel dev`, or a bare static deploy) requests fall
// back to the same origin, matching the Vite dev proxy.
export const config = {
  matcher: ["/api/:path*"],
};

export default function middleware(request: Request) {
  const url = new URL(request.url);
  const apiBase = process.env.WILLOW_API_URL;
  if (!apiBase) return; // same-origin (dev / fallback)

  const target = new URL(apiBase);
  target.pathname = url.pathname;
  target.search = url.search;
  return fetch(new Request(target, request));
}
