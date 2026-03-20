/*
 * DFU Monitor — Service Worker
 * Enables PWA installation and basic offline support
 */

const CACHE_NAME = 'dfu-monitor-v1';

// Files to cache for offline use
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// ── Install: cache static assets ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Take over immediately without waiting
  self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache, fall back to network ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always fetch Supabase API calls from network (never cache)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For Google Fonts — network first, fall back to cache
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For everything else — cache first, fall back to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
