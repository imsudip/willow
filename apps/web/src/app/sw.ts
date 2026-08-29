import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Serwist replaces workbox + vite-plugin-pwa. This is the App Router SW entry
// compiled to public/sw.js by @serwist/next at build time.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// ---- Push notifications (unchanged from the Vite SW) ----
self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data ? JSON.parse(event.data.text()) : {};
  } catch {
    /* malformed payload */
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Willow", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/favicon.png",
      data: { url: data.url ?? "/" },
    } as NotificationOptions),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client && client.url.includes(self.location.origin)) {
            return client.navigate(url).then(() => client.focus());
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});
