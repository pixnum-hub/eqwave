// EQWave Service Worker
// Caches the app shell so it installs and runs offline.
// Bump CACHE_NAME on every release to invalidate old caches.

const CACHE_NAME = 'eqwave-cache-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './favicon.ico'
];

// ── Install: pre-cache the app shell ──────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old cache versions ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app shell, network-first for everything else ──
// User-loaded audio/video files are blob: URLs and never touch the network,
// so they are naturally excluded from this strategy.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Don't try to cache blob: or data: URLs (local file playback)
  if (req.url.startsWith('blob:') || req.url.startsWith('data:')) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Serve from cache, but refresh in background (stale-while-revalidate)
        const fetchPromise = fetch(req)
          .then((networkResp) => {
            if (networkResp && networkResp.status === 200) {
              const respClone = networkResp.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
            }
            return networkResp;
          })
          .catch(() => cached); // offline — fall back to cache silently
        return cached;
      }
      // Not cached yet — try network, then cache it for next time
      return fetch(req)
        .then((networkResp) => {
          if (networkResp && networkResp.status === 200) {
            const respClone = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
          }
          return networkResp;
        })
        .catch(() => {
          // Offline and not cached — fall back to index.html for navigations
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
    })
  );
});
