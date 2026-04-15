// sw.js — Unis Service Worker (v2)
const CACHE_NAME = 'unis-shell-v2';

const SHELL_ASSETS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only cache GET requests — everything else passes through untouched
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never touch API calls, media, or external services
  if (
    url.pathname.startsWith('/v1/') ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('r2.dev') ||
    url.hostname.includes('cloudflare') ||
    url.hostname.includes('railway.app') ||
    request.destination === 'audio' ||
    request.destination === 'video'
  ) {
    return;
  }

  // Navigation: network-first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          try {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
          } catch (_) {}
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache-first, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          try {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
          } catch (_) {}
        }
        return response;
      });
    })
  );
});