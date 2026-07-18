/* The Forever Treasure B-1 service worker: immutable assets only; mutable truth remains network-owned. */
const CACHE_VERSION = "forever-treasure-b1-v1";
const SHELL = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/forever-treasure-192.svg",
  "/icons/forever-treasure-512.svg",
];
const SENSITIVE_PREFIXES = ["/api/", "/studio", "/captain", "/player", "/play/", "/quartermaster", "/join/"];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (SENSITIVE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => caches.match("/offline")));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && response.type === "basic")
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
            return response;
          }),
      ),
    );
  }
});
