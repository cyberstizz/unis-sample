// src/utils/dmThreads.js
// Keeps recently opened threads warm so reopening one is instant, and lets the
// inbox start loading a thread the moment a finger lands on its row.
//
//   getThread(me, id)            → { messages, hasMore } you last saw, or null
//   putThread(me, id, data)      → remember a thread (most-recent 30 kept)
//   fetchLatest(me, id, {maxAgeMs}) → newest page; shares one request between
//                                  the press-down prefetch and the opened thread
//   fetchOlder(id, before)       → the page before a message's createdAt
//   prefetchThread(me, id)       → fire-and-forget fetchLatest
//
// Entries are keyed by the signed-in user, so switching accounts never shows
// someone else's thread. Everything lives in memory for this browser tab only.
import { apiCall } from '../components/axiosInstance';

export const PAGE_SIZE = 40;
const MAX_THREADS = 30;
const FRESH_MS = 4000;

const store = new Map();     // key → { messages, hasMore }
const inflight = new Map();  // key → Promise
const recent = new Map();    // key → { data, at }

const keyOf = (me, id) => `${me}:${id}`;

function page(res) {
  const messages = Array.isArray(res?.data) ? res.data : [];
  return { messages, hasMore: messages.length >= PAGE_SIZE };
}

export function getThread(me, id) {
  if (!me || !id) return null;
  return store.get(keyOf(me, id)) || null;
}

export function putThread(me, id, data) {
  if (!me || !id) return;
  const key = keyOf(me, id);
  store.delete(key);
  store.set(key, data);
  if (store.size > MAX_THREADS) store.delete(store.keys().next().value);
}

export function fetchLatest(me, id, { maxAgeMs = 0 } = {}) {
  const key = keyOf(me, id);
  const hit = recent.get(key);
  if (maxAgeMs > 0 && hit && Date.now() - hit.at < maxAgeMs) return Promise.resolve(hit.data);
  if (inflight.has(key)) return inflight.get(key);

  const request = apiCall({ url: `/v1/conversations/${id}/messages?limit=${PAGE_SIZE}`, useCache: false })
    .then((res) => {
      const data = page(res);
      recent.set(key, { data, at: Date.now() });
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

export function fetchOlder(id, before) {
  return apiCall({
    url: `/v1/conversations/${id}/messages?before=${encodeURIComponent(before)}&limit=${PAGE_SIZE}`,
    useCache: false,
  }).then(page);
}

export function prefetchThread(me, id) {
  if (!me || !id || String(id).startsWith('draft-')) return;
  fetchLatest(me, id, { maxAgeMs: FRESH_MS }).catch((err) => {
    console.error('[Messages] thread prefetch failed (will load on open):', err?.message || err);
  });
}

export const THREAD_FRESH_MS = FRESH_MS;

// Server times are UTC. Newer backends say so ("…Z"); older ones sent no
// zone, which browsers read as local time (4–5 hours off in New York). Treat
// a zone-less date-time as UTC so both read correctly.
const HAS_ZONE = /([zZ]|[+-]\d{2}:?\d{2})$/;
export function parseServerTime(value) {
  if (!value) return new Date(NaN);
  if (value instanceof Date) return value;
  const s = String(value);
  return new Date(HAS_ZONE.test(s) || !s.includes('T') ? s : `${s}Z`);
}

/** The inbox preview the backend would write for this message (MessagingService.buildPreview). */
export function previewFor(message) {
  const body = (message?.body || '').trim();
  if (body) return body;
  if (message?.supportPaymentId != null) return 'Sent support';
  if (message?.sharedSongId != null) return 'Shared a track';
  return '';
}
