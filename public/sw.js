/**
 * Waypoint Service Worker - Offline-First Driver Operation & PWA Support
 * Tech-Triathlon 2026 Resilient Offline Operation
 */

const CACHE_NAME = "waypoint-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/favicon.svg",
  "/manifest.json",
  "/apple-touch-icon.png",
  "/images/waypoint-team-sketch.png",
  "/images/dispatch-studio.png",
  "/images/loading-dock.png",
  "/images/on-the-road.png",
  "/images/neighborhood-store.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Some assets failed to precache in service worker:", err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Handle API requests with Network-First, Cache-Fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return new Response(
              JSON.stringify({
                offline: true,
                message: "Offline mode active. Request served from local fallback.",
              }),
              { headers: { "Content-Type": "application/json" } }
            );
          });
        })
    );
    return;
  }

  // Handle Static files with Cache-First, Network-Fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((response) => {
          if (response.ok && request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
      );
    })
  );
});
