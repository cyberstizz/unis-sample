// src/utils/playbackSettings.js
//
// Settings → Playback, saved on this device (localStorage).
//
//   level         'off' | 'quiet' | 'normal' | 'loud'   volume levelling target
//   transitions   'off' | 'crossfade' | 'mix'           how one song becomes the next
//   crossfadeSec  1..12                                  length of a plain crossfade
//   mixReleases   boolean   blend inside albums/EPs/mixtapes too (off: they play gapless)
//   autoplay      boolean   keep going with similar songs when the queue ends
//
// Levelling targets are the three Spotify uses (LUFS, ITU-R BS.1770):
// Quiet -19, Normal -14, Loud -11.

import { useSyncExternalStore } from 'react';

const KEY = 'unis-playback-v1';

export const LEVEL_TARGETS = { off: null, quiet: -19, normal: -14, loud: -11 };
export const LEVEL_LABELS = { off: 'Off', quiet: 'Quiet', normal: 'Normal', loud: 'Loud' };

// New listeners start levelled at Normal, with Unis Mix and Autoplay on.
export const PLAYBACK_DEFAULTS = Object.freeze({
  level: 'normal',
  transitions: 'mix',
  crossfadeSec: 6,
  mixReleases: false,
  autoplay: true,
});

let cache = null;
const listeners = new Set();

function clean(raw) {
  const s = { ...PLAYBACK_DEFAULTS, ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!(s.level in LEVEL_TARGETS)) s.level = PLAYBACK_DEFAULTS.level;
  if (!['off', 'crossfade', 'mix'].includes(s.transitions)) s.transitions = PLAYBACK_DEFAULTS.transitions;
  const xf = Math.round(Number(s.crossfadeSec));
  s.crossfadeSec = Number.isFinite(xf) ? Math.min(12, Math.max(1, xf)) : PLAYBACK_DEFAULTS.crossfadeSec;
  s.mixReleases = Boolean(s.mixReleases);
  s.autoplay = s.autoplay !== false;
  return Object.freeze(s);
}

export function getPlaybackSettings() {
  if (cache) return cache;
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
  cache = clean(raw);
  return cache;
}

export function setPlaybackSettings(patch) {
  const next = clean({ ...getPlaybackSettings(), ...(patch || {}) });
  cache = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private mode: keep in memory */ }
  listeners.forEach((fn) => { try { fn(next); } catch (e) { console.error('[playbackSettings] listener failed:', e); } });
  return next;
}

export function subscribePlaybackSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** [settings, update] — re-renders when any setting changes, on any screen. */
export function usePlaybackSettings() {
  const settings = useSyncExternalStore(subscribePlaybackSettings, getPlaybackSettings, getPlaybackSettings);
  return [settings, setPlaybackSettings];
}

/** For tests. */
export function _resetPlaybackSettingsCache() { cache = null; }
