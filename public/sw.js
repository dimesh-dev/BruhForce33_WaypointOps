/*
 * Waypoint service worker.
 * - Navigations and GET /api/* reads: network first, falling back to the last
 *   cached copy, so the app opens and shows the last known route without signal.
 * - Static build assets and images: cache first.
 * - Writes (POST/PATCH) are never cached; the driver app queues them in IndexedDB.
 */
const VERSION = "waypoint-v1";
const SHELL = ["/", "/login", "/favicon.svg", "/images/on-the-road.png", "/images/loading-dock.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "clear") event.waitUntil(caches.delete(VERSION));
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) || (request.mode === "navigate" ? await cache.match("/") : undefined);
    if (cached) return cached;
    if (request.url.includes("/api/"))
      return new Response(JSON.stringify({ error: "You are offline." }), { status: 503, headers: { "content-type": "application/json" } });
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/auth") || url.pathname === "/api/events") return;
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/images/") || url.pathname.startsWith("/_next/image"))
    event.respondWith(cacheFirst(request));
  else if (request.mode === "navigate" || url.pathname.startsWith("/api/")) event.respondWith(networkFirst(request));
});
