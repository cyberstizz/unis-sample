// src/utils/songAnalysis.js
//
// What the server measured about each song (loudness, true peak, tempo, beats,
// key, intro/outro, waveform), fetched in batches and kept for the session.
// GET /v1/media/songs/analysis?ids=a,b,c  (see PlaybackController.java)
//
// A song the server hasn't measured yet comes back with analyzed=false; it is
// asked about again after two minutes, so a fresh upload picks up its values.

import { apiCall } from '../components/axiosInstance';

const cache = new Map();        // songId -> analysis object (analyzed true/false)
const fetchedAt = new Map();    // songId -> ms
const pending = new Map();      // songId -> Promise
const listeners = new Set();
const RETRY_MS = 120000;

const idOf = (item) => (item && typeof item === 'object' ? (item.id || item.songId) : item) || null;

export function getAnalysis(songOrId) {
  const id = idOf(songOrId);
  if (!id) return null;
  const a = cache.get(id);
  return a && a.analyzed ? a : null;
}

/** The raw record even when not analyzed (has releaseId and duration). */
export function getAnalysisRecord(songOrId) {
  const id = idOf(songOrId);
  return id ? cache.get(id) || null : null;
}

export function subscribeAnalysis(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error('[songAnalysis] listener failed:', e); } });
}

function needsFetch(id, now) {
  if (pending.has(id)) return false;
  const a = cache.get(id);
  if (!a) return true;
  if (a.analyzed) return false;
  return now - (fetchedAt.get(id) || 0) > RETRY_MS;
}

/**
 * Makes sure the given songs' values are loaded. Resolves once they are (or
 * the request failed). Videos and items without an id are ignored.
 */
export function loadAnalysis(items) {
  const now = Date.now();
  const ids = [...new Set((items || [])
    .filter((it) => !it || typeof it !== 'object' || it.type !== 'video')
    .map(idOf)
    .filter(Boolean))];
  const want = ids.filter((id) => needsFetch(id, now));
  const waits = ids.filter((id) => pending.has(id)).map((id) => pending.get(id));
  for (let i = 0; i < want.length; i += 40) {
    const batch = want.slice(i, i + 40);
    const p = apiCall({ method: 'get', url: `/v1/media/songs/analysis?ids=${batch.join(',')}`, useCache: false })
      .then((res) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        const t = Date.now();
        batch.forEach((id) => { fetchedAt.set(id, t); if (!cache.has(id)) cache.set(id, { songId: id, analyzed: false }); });
        rows.forEach((r) => { if (r?.songId) { cache.set(r.songId, r); fetchedAt.set(r.songId, t); } });
        notify();
      })
      .catch((err) => {
        console.warn('[songAnalysis] could not load song measurements:', err?.message || err);
        const t = Date.now();
        batch.forEach((id) => { fetchedAt.set(id, t); if (!cache.has(id)) cache.set(id, { songId: id, analyzed: false }); });
      })
      .finally(() => batch.forEach((id) => pending.delete(id)));
    batch.forEach((id) => pending.set(id, p));
    waits.push(p);
  }
  return Promise.all(waits).then(() => undefined);
}

/** Polls one song until the server has measured it (upload wizard). */
export async function waitForAnalysis(songId, { timeoutMs = 90000, everyMs = 3000, signal } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (signal?.aborted) return null;
    fetchedAt.delete(songId);
    cache.delete(songId);
    await loadAnalysis([songId]);
    const a = getAnalysis(songId);
    if (a) return a;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  return null;
}

/** Waveform peaks 0..1 (Float32Array of 1000), or null. */
const wfCache = new Map();
export function waveformOf(analysis) {
  if (!analysis?.waveform) return null;
  const key = analysis.songId;
  if (wfCache.has(key)) return wfCache.get(key);
  try {
    const bin = atob(analysis.waveform);
    const out = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) / 255;
    wfCache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

/** Peak (0..1) of a waveform between two times in seconds. */
export function peakBetween(wf, durationSec, t0, t1) {
  if (!wf || !durationSec || t1 <= 0 || t0 >= durationSec) return 0;
  const n = wf.length;
  const a = Math.max(0, Math.floor((t0 / durationSec) * n));
  const b = Math.min(n, Math.max(a + 1, Math.ceil((t1 / durationSec) * n)));
  let m = 0;
  for (let i = a; i < b; i++) if (wf[i] > m) m = wf[i];
  return m;
}

export function _resetAnalysisCache() { cache.clear(); fetchedAt.clear(); pending.clear(); wfCache.clear(); }
