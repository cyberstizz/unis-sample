// src/utils/lyricsCache.js
// A song's lyrics for this visit (GET /v1/media/song/:id/lyrics), so the
// player's lyrics view opens instantly the second time. The lyrics wizard
// calls forgetLyrics() after a save so the new version shows right away.
import { apiCall } from '../components/axiosInstance';

const cache = new Map();

export function fetchLyrics(songId) {
  if (!songId) return Promise.resolve(null);
  if (cache.has(songId)) return Promise.resolve(cache.get(songId));
  return apiCall({ method: 'get', url: `/v1/media/song/${songId}/lyrics`, useCache: false })
    .then((res) => {
      const d = res?.data || {};
      const value = { lyrics: d.lyrics || '', syncedLyrics: d.syncedLyrics || '' };
      cache.set(songId, value);
      return value;
    })
    .catch(() => ({ lyrics: '', syncedLyrics: '' }));
}

export function forgetLyrics(songId) {
  cache.delete(songId);
}
