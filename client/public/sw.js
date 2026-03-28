const CACHE = "swingstudio-v2";

// App shell — always available offline
const PRECACHE = ["/", "/manifest.json", "/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Never intercept API calls, WebSocket upgrades, or cross-origin requests
  if (url.pathname.startsWith("/api/") || request.mode === "websocket" || url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests — network first, fall back to cached "/"
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets (JS, CSS, fonts, images) — cache first, update in background
  e.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      });
      return cached || network;
    })
  );
});
