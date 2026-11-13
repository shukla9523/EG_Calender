// EG-Calendar Browser-Side Service Worker
// Scope: Offline Application Shell & Static Asset Caching Only
// Compliance: Docs rules strictly forbid custom backend servers; service workers are browser-side only.

const CACHE_NAME = "eg-calendar-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/file.svg",
  "/globe.svg",
  "/window.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Only intercept GET requests for navigation and static assets
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Bypass API routes and Supabase auth calls from offline caching
  if (url.pathname.startsWith("/api") || url.pathname.includes("/auth/")) {
    return;
  }

  // Network-first with cache fallback for HTML navigations; cache-first for static assets
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cached) => cached || caches.match("/"));
      })
    );
    return;
  }

  // Stale-while-revalidate for static files
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

