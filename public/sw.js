/* DARKNOTE GAMING ARENA — service worker
 *
 * - Precaches the app shell (start page + manifest + icons) for reliable,
 *   offline-capable loading.
 * - Runtime: network-first for navigations (falls back to the cached shell),
 *   stale-while-revalidate for hashed static assets, and NEVER caches
 *   /api traffic or dynamic user data.
 * - Versioned cache + activate cleanup + skipWaiting/clientsClaim so a new
 *   deploy never leaves users stuck on an old version.
 */
const VERSION = "v1.0.0";
const CACHE = `darknote-${VERSION}`;
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {}) // shell cache is best-effort; app still works online
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch 3rd-party/CDN requests

  // Never cache API traffic or dynamic data (chat, games, auth, leaderboards).
  if (url.pathname.startsWith("/api/")) return;

  // App navigations: network first, fall back to the cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || caches.match(req)))
    );
    return;
  }

  // Hashed/static assets: stale-while-revalidate keeps the app snappy while
  // still picking up new deploys on the next visit.
  const isStatic = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
