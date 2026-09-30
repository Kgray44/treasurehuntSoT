/* Landfall web foundation: cache only versioned, public application shell assets.
   Player data, drafts, map tiles, media, and API responses are never cached here. */
const SHELL = "landfall-shell-v1";
const MAX_ASSETS = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("landfall-shell-") && name !== SHELL) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith("/_next/static/"))
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL);
      const saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        for (const stale of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(stale);
      }
      return response;
    })(),
  );
});
