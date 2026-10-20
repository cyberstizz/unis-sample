// ─────────────────────────────────────────────────────────────────────────────
// Unis Plus status, shared by every ad slot and the Plus page.
//
// GET /api/v1/plus/status answers for guests too (never Plus). The answer is
// kept for five minutes per signed-in account (keyed on the session token, so
// signing in or out asks again), and every ad slot on a page shares one
// request. After checkout the Plus page calls refreshPlusStatus() until the
// webhook has turned Plus on, and every slot hears about it at once.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { apiCall } from '../components/axiosInstance';

const TTL_MS = 5 * 60 * 1000;
const RETRY_MS = 30 * 1000;

export const DEFAULT_PLUS_STATUS = Object.freeze({
  available: false,
  priceCents: null,
  plus: false,
  status: null,
  paidThrough: null,
  cancelAtPeriodEnd: false,
});

let cache = null;     // { key, data, at, ttl }
let inflight = null;  // { key, promise }
const listeners = new Set();

const sessionKey = () => {
  try {
    return localStorage.getItem('token') || 'guest';
  } catch {
    return 'guest';
  }
};

const normalize = (data) =>
  data && typeof data === 'object' && 'plus' in data ? { ...DEFAULT_PLUS_STATUS, ...data } : DEFAULT_PLUS_STATUS;

const emit = (data) => listeners.forEach((fn) => fn(data));

/** The status for whoever is signed in. Cached; pass { force: true } to ask the server again. */
export function fetchPlusStatus({ force = false } = {}) {
  const key = sessionKey();
  if (!force && cache && cache.key === key && Date.now() - cache.at < cache.ttl) {
    return Promise.resolve(cache.data);
  }
  if (!force && inflight && inflight.key === key) return inflight.promise;

  const promise = apiCall({ method: 'get', url: '/v1/plus/status', useCache: false })
    .then((res) => {
      const data = normalize(res?.data);
      cache = { key, data, at: Date.now(), ttl: TTL_MS };
      emit(data);
      return data;
    })
    .catch((err) => {
      console.warn('[Plus] status failed:', err?.response?.status, err?.message);
      // Show ads rather than nothing; ask again soon.
      const data = cache && cache.key === key ? cache.data : DEFAULT_PLUS_STATUS;
      cache = { key, data, at: Date.now(), ttl: RETRY_MS };
      return data;
    })
    .finally(() => {
      if (inflight && inflight.promise === promise) inflight = null;
    });
  inflight = { key, promise };
  return promise;
}

export const refreshPlusStatus = () => fetchPlusStatus({ force: true });

/** Cached status for this session right now, or null if it hasn't been fetched. */
export function peekPlusStatus() {
  return cache && cache.key === sessionKey() ? cache.data : null;
}

/**
 * React hook: { status, loaded }. Re-asks when `userKey` changes (pass the
 * signed-in user's id, so signing in or out updates every slot).
 */
export function usePlusStatus(userKey) {
  const [status, setStatus] = useState(() => peekPlusStatus());

  useEffect(() => {
    let alive = true;
    const onChange = (data) => { if (alive) setStatus(data); };
    listeners.add(onChange);
    fetchPlusStatus().then(onChange);
    return () => {
      alive = false;
      listeners.delete(onChange);
    };
  }, [userKey]);

  return { status: status || DEFAULT_PLUS_STATUS, loaded: status !== null };
}

/** For tests. */
export function __resetPlusStatusCache() {
  cache = null;
  inflight = null;
  listeners.clear();
}
