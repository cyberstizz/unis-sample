// sw.js — Unis Service Worker (v3)
//
// What it does, and only this:
//   • Pages (navigations): always from the network. The last good copy of the
//     app's page is kept so Unis still opens when the connection drops.
//   • /assets/* (the built JavaScript, CSS, images and fonts, whose names
//     change whenever their content does): from this cache first, so a
//     returning visitor doesn't download them again. At most MAX_ASSETS files
//     are kept; the oldest go first.
//   • Everything else (the API, songs and videos, other sites, the manifest,
//     icons) is left to the browser and its normal HTTP caching.
//
// v2 kept every file it ever saw, forever: each deploy's files piled up, every
// page address got its own copy, and when a file from an older deploy was
// asked for, Netlify answered with the app's page and that page was saved
// under the script's name. Moving to v3 deletes the v2 cache.
const SHELL_CACHE = 'unis-shell-v3';
const ASSET_CACHE = 'unis-assets-v3';
const MAX_ASSETS = 80;
const SHELL_URL = '/';

// Only real build files go in the asset cache, never an HTML page.
const CACHEABLE_TYPE = /javascript|css|image\/|font\/|woff|wasm/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add(SHELL_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Keeps the worker running until a cache write finishes. If the browser won't
// extend the event at that point, the write still runs in the background.
function inBackground(event, promise) {
  const settled = promise.catch(() => {});
  try {
    event.waitUntil(settled);
  } catch {
    /* already finished responding; the write carries on regardless */
  }
}

// Deletes the oldest entries once the cache holds more than `max`.
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys(); // oldest first
  for (let i = 0; i < keys.length - max; i++) {
    await cache.delete(keys[i]);
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Files from other sites (Google Fonts, Stripe, the CDN, the API, ads) are
  // left to the browser. A fetch made in here would be checked against the
  // security policy's connect-src list instead of the page's own font, script
  // and image lists, and the enforced policy would block it.
  if (url.origin !== self.location.origin) return;

  // Pages: network first; fall back to the last good copy when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const type = response.headers.get('content-type') || '';
          if (response.status === 200 && type.includes('text/html')) {
            const copy = response.clone();
            inBackground(event, caches.open(SHELL_CACHE).then((c) => c.put(SHELL_URL, copy)));
          }
          return response;
        })
        .catch(() =>
          caches.match(SHELL_URL, { cacheName: SHELL_CACHE }).then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // Built files only. Audio and video stream in pieces (range requests),
  // which the cache can't store, so the browser handles them.
  if (!url.pathname.startsWith('/assets/')) return;
  if (request.destination === 'audio' || request.destination === 'video') return;
  if (request.headers.has('range')) return;

  event.respondWith(
    caches.match(request, { cacheName: ASSET_CACHE }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const type = response.headers.get('content-type') || '';
        if (response.status === 200 && CACHEABLE_TYPE.test(type)) {
          const copy = response.clone();
          inBackground(
            event,
            caches
              .open(ASSET_CACHE)
              .then((c) => c.put(request, copy))
              .then(() => trim(ASSET_CACHE, MAX_ASSETS))
          );
        }
        return response;
      });
    })
  );
});
