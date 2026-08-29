"use client";

import dynamic from "next/dynamic";

// Willow is a client-rendered SPA (offline-first; Dexie is the local source of
// truth). This catch-all serves the SPA for every non-/api path, so deep links
// and hard refreshes (e.g. /entries/123) work — the SPA's react-router handles
// the actual routing client-side. /api/* Route Handlers take precedence over
// this catch-all. The service worker is auto-registered by @serwist/next.
//
// The SPA is browser-only (Dexie, IndexedDB, localStorage, livekit, etc. don't
// exist on the server), so we load it with `dynamic(..., { ssr: false })` —
// this reliably mounts it only on the client, avoiding SSR of browser-only
// modules and the `useEffect`-gated "mounted" hydration race.
const App = dynamic(() => import("../../App").then((m) => m.App), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-dvh items-center justify-center text-muted">
      Willow…
    </div>
  ),
});

export default function Page() {
  return <App />;
}


