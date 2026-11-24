// src/utils/releases.js — shared helpers for albums, EPs, mixtapes and singles.

export const RELEASE_TYPES = ['ALBUM', 'EP', 'MIXTAPE', 'SINGLE'];

export const RELEASE_TYPE_LABEL = {
  ALBUM: 'Album',
  EP: 'EP',
  MIXTAPE: 'Mixtape',
  SINGLE: 'Single',
};

// Plural chip labels on the artist page.
export const RELEASE_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'ALBUM', label: 'Albums' },
  { key: 'EP', label: 'EPs' },
  { key: 'MIXTAPE', label: 'Mixtapes' },
  { key: 'SINGLE', label: 'Singles' },
];

// Song durations arrive in milliseconds; older rows may be in seconds.
export const toSeconds = (d) => {
  let sec = Number(d);
  if (!d || Number.isNaN(sec)) return 0;
  if (sec > 3600) sec /= 1000;
  return sec;
};

// "38 min", "1 hr 4 min" from a total in milliseconds.
export const formatReleaseLength = (ms) => {
  const total = Math.round((Number(ms) || 0) / 1000);
  if (!total) return '';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${Math.max(m, 1)} min`;
};

// The type the stores would give this length: 1–3 songs single, 4–6 songs
// under 30 minutes EP, 7+ or over 30 minutes album. The artist can override
// (and pick Mixtape, which the stores don't have).
export const suggestReleaseType = (songCount, totalSeconds) => {
  if (!songCount) return 'SINGLE';
  if (songCount >= 7 || totalSeconds > 30 * 60) return 'ALBUM';
  if (songCount >= 4) return 'EP';
  return 'SINGLE';
};

// Shown as NEW on the artist page for a week after release.
export const isNewRelease = (iso) => {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
};
