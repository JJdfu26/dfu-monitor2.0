/*
 * DFU Monitor — Service Worker (Fixed)
 * Supabase requests are NEVER intercepted — always go directly to network.
 */

const CACHE_NAME = 'dfu-monitor-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// ── Install ──────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // ALWAYS bypass service worker for these — go straight to network
  if (
    url.includes('supabase.co') ||
    url.includes('supabase.io') ||
    url.includes('googleapis.com') ||
    url.includes('groq.com') ||
    url.includes('generativelanguage') ||
    event.request.method !== 'GET'
  ) {
    // Do NOT call event.respondWith() — browser handles it normally
    return;
  }

  // For Google Fonts only — cache with network fallback
  if (url.includes('fonts.gstatic.com') || url.includes('fonts.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // For app files — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
