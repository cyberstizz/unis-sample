// sw.js — Unis Service Worker
// =============================================================================
// Purpose: Cache the app shell (HTML, JS, CSS, static images) so Unis loads
// instantly on repeat visits and feels native. This worker deliberately does
// NOT cache API calls or audio/media files — those must always hit the network
// so play counts, votes, earnings, and auth work correctly.
// =============================================================================

const CACHE_NAME = 'unis-shell-v1';

// Static assets to pre-cache on install.
// Vite hashes filenames on build, so we cache the entry point and let the
// browser's normal HTTP cache handle the hashed chunks. This keeps the
// service worker simple and avoids stale-bundle bugs.
const SHELL_ASSETS = [
  '/',
  '/index.html',
];

// --- Install: pre-cache the app shell ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  // Activate immediately instead of waiting for old tabs to close
  self.skipWaiting();
});

// --- Activate: clean up old caches when a new version deploys ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// --- Fetch: network-first for everything, cache-fallback for navigation ---
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // NEVER intercept these — they must always hit the network:
  //   • API calls (play counts, votes, auth, playlist ops, earnings)
  //   • Audio/media files from R2 or backend
  //   • Analytics, external scripts
  const url = new URL(request.url);

  const isAPI =
    url.pathname.startsWith('/v1/') ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('r2.dev') ||
    url.hostname.includes('cloudflare');

  const isMedia =
    request.destination === 'audio' ||
    request.destination === 'video' ||
    url.pathname.match(/\.(mp3|wav|flac|aac|ogg|m4a|webm)$/i);

  if (isAPI || isMedia) {
    // Pass through to network — no caching, no interference
    return;
  }

  // For navigation requests (page loads): try network first, fall back to cache.
  // This ensures users always get the latest deploy from Netlify, but if they're
  // offline or on a flaky connection, the cached shell still loads.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Update the cache with the fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For static assets (JS, CSS, images, fonts): try cache first, then network.
  // Vite's content-hashed filenames make this safe — a new deploy = new URLs,
  // so stale cache entries are never served for updated code.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful responses for same-origin static assets
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});