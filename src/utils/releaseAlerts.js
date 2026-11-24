// src/utils/releaseAlerts.js — release alerts: new music from artists you follow.
//
// The backend (ReleaseAlertController) keeps one alert per artist per day and
// works out who sees it from the follows table. This file is the web app's
// one way in: reads, writes, the words, and a "changed" event so the header
// badge, the Messages row and Home all update together.

import { apiCall } from '../components/axiosInstance';

export const ALERTS_CHANGED = 'unis:release-alerts-changed';

export const announceAlertsChanged = () => {
  try {
    window.dispatchEvent(new Event(ALERTS_CHANGED));
  } catch {
    // no window (tests): nothing to tell
  }
};

const get = (url) => apiCall({ url, method: 'get', useCache: false }).then((r) => r.data);

/** { unseen, seenAt, inApp, email, preview: [item, item, item] } */
export const fetchAlertSummary = () => get('/v1/release-alerts/summary');

/** Newest first, the last 90 days. */
export const fetchAlerts = () => get('/v1/release-alerts').then((d) => (Array.isArray(d) ? d : []));

export const markAlertsSeen = () =>
  apiCall({ url: '/v1/release-alerts/seen', method: 'post' }).then(() => announceAlertsChanged());

/** { inApp, email } */
export const fetchAlertSettings = () => get('/v1/release-alerts/settings');

export const saveAlertSettings = (patch) =>
  apiCall({ url: '/v1/release-alerts/settings', method: 'put', data: patch }).then((r) => {
    announceAlertsChanged();
    return r.data;
  });

/** { following, level } for one artist. */
export const fetchFollowLevel = (artistId) => get(`/v1/release-alerts/follow/${artistId}`);

export const saveFollowLevel = (artistId, level) =>
  apiCall({ url: `/v1/release-alerts/follow/${artistId}`, method: 'put', data: { level } }).then((r) => {
    announceAlertsChanged();
    return r.data;
  });

/** Followed artists with their bell: [{ artistId, name, photoUrl, level }] */
export const fetchFollowedArtists = () => get('/v1/release-alerts/follows').then((d) => (Array.isArray(d) ? d : []));

/** The artist's latest alert (dashboard), or null. */
export const fetchReach = () => get('/v1/release-alerts/reach').then((d) => d || null);

// ── Words ────────────────────────────────────────────────────────────────────

export const ALERT_LEVELS = [
  { key: 'ALL', label: 'Every release', sub: 'Singles, EPs, mixtapes and albums' },
  { key: 'MAJOR', label: 'Big releases only', sub: 'Albums, EPs and mixtapes' },
  { key: 'OFF', label: 'Off', sub: 'Stay following, no alerts' },
];

export const levelLabel = (key) => (ALERT_LEVELS.find((l) => l.key === key) || ALERT_LEVELS[0]).label;

const RELEASE_WORD = { ALBUM: 'an album', EP: 'an EP', MIXTAPE: 'a mixtape', SINGLE: 'a single' };

/** "dropped an EP", "dropped a new song", "dropped an album and 2 new songs". Same words as the email. */
export const alertVerb = (item) => {
  if (!item) return '';
  const n = Number(item.songCount || 0);
  if (item.kind === 'RELEASE') {
    const what = RELEASE_WORD[item.releaseType] || 'a single';
    if (n === 1) return `dropped ${what} and a new song`;
    if (n > 1) return `dropped ${what} and ${n} new songs`;
    return `dropped ${what}`;
  }
  return n > 1 ? `dropped ${n} new songs` : 'dropped a new song';
};

/** Where an alert goes: the release page or the song page. */
export const alertPath = (item) =>
  item?.kind === 'RELEASE' ? `/release/${item.releaseId}` : `/song/${item.songId}`;

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today", "Yesterday", "Mon", "Nov 18". */
export const alertWhen = (iso, now = new Date()) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const days = Math.round((startOfDay(now) - startOfDay(new Date(t))) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return new Date(t).toLocaleDateString('en-US', { weekday: 'short' });
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** "This week" / "Earlier" sections for the list. */
export const alertGroup = (iso, now = new Date()) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'Earlier';
  return startOfDay(now) - startOfDay(new Date(t)) < 7 * DAY ? 'This week' : 'Earlier';
};

/** "Nia Brooks and 1 other dropped music" for the Messages row (names from the summary). */
export const alertRowLine = (namesIn) => {
  const names = (namesIn || []).filter(Boolean);
  if (names.length === 0) return 'From artists you follow';
  const others = names.length - 1;
  const who = others === 0 ? names[0] : `${names[0]} and ${others} other${others === 1 ? '' : 's'}`;
  return `${who} dropped music`;
};
