/* Versioned public shell only. Authenticated responses, media and external tiles never enter CacheStorage.
   Released private map bytes and delivery evidence live in the session-bound encrypted IndexedDB store. */
const SHELL = "landfall-shell-v2";
const OFFLINE = "/player/offline-landfall";
const MAX_ASSETS = 120;
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const offlineClients = new Set();
self.addEventListener("message", (event) => {
  if (event.data?.type !== "LANDFALL_CONNECTIVITY" || !event.source?.id) return;
  if (event.data.offline === true) offlineClients.add(event.source.id);
  else offlineClients.delete(event.source.id);
  while (offlineClients.size > 256) offlineClients.delete(offlineClients.values().next().value);
});
async function rememberPublic(cache, request, response) {
  if (!response.ok || response.type !== "basic" || Number(response.headers.get("content-length")) > MAX_ASSET_BYTES)
    return;
  const reader = response.clone().body?.getReader();
  if (!reader) return;
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_ASSET_BYTES) {
      void reader.cancel();
      return;
    }
  }
  await cache.put(request, response.clone());
  const keys = await cache.keys();
  const assets = keys.filter((key) => new URL(key.url).pathname.startsWith("/_next/static/"));
  for (const stale of assets.slice(0, Math.max(0, assets.length - MAX_ASSETS))) await cache.delete(stale);
}
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      const response = await fetch(OFFLINE, { cache: "reload" });
      if (!response.ok) throw new Error("Offline shell unavailable");
      const html = await response.clone().text();
      await cache.put(OFFLINE, response);
      const paths = [
        ...new Set(
          [...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map((match) =>
            match[1].replaceAll("&amp;", "&"),
          ),
        ),
      ].slice(0, MAX_ASSETS);
      await Promise.all(
        paths.map(async (path) => {
          const url = new URL(path, self.location.origin);
          if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
            await rememberPublic(cache, url.href, await fetch(url.href));
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith("landfall-shell-") && name !== SHELL) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const journal = /^\/player\/playthroughs\/([^/]+)\/journal$/.exec(url.pathname);
  if (request.mode === "navigate" && (journal || url.pathname === OFFLINE)) {
    event.respondWith(
      (async () => {
        try {
          if (
            !self.navigator.onLine ||
            offlineClients.has(event.clientId) ||
            offlineClients.has(event.replacesClientId)
          )
            throw new Error("Offline navigation");
          return await fetch(request, { cache: "no-store" });
        } catch {
          const cache = await caches.open(SHELL);
          const saved = await cache.match(OFFLINE);
          if (!saved)
            return new Response("Offline shell is unavailable. Reconnect to open your Journal.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            });
          if (journal)
            return Response.redirect(
              new URL(`${OFFLINE}?session=${encodeURIComponent(journal[1])}`, self.location.origin),
              302,
            );
          return saved;
        }
      })(),
    );
    return;
  }
  if (!url.pathname.startsWith("/_next/static/")) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL);
      const saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      await rememberPublic(cache, request, response);
      return response;
    })(),
  );
});
