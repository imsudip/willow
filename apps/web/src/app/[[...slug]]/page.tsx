"use client";

import { useEffect, useState } from "react";
import { App } from "../../App";

// Willow is a client-rendered SPA (offline-first; Dexie is the local source of
// truth). This catch-all serves the SPA for every non-/api path, so deep links
// and hard refreshes (e.g. /entries/123) work — the SPA's react-router handles
// the actual routing client-side. /api/* Route Handlers take precedence over
// this catch-all. The service worker is auto-registered by @serwist/next.
//
// The SPA is browser-only: Dexie, IndexedDB, localStorage, etc. don't exist on
// the server, so we never SSR it — render a bare placeholder until the client
// mounts, then mount the SPA. This is the canonical "client-only SPA in Next"
// pattern.
export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Willow…
      </div>
    );
  }
  return <App />;
}


