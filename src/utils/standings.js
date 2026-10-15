// ─────────────────────────────────────────────────────────────────────────────
// standings.js — one way to read rankings on the web app.
//
// Every board that shows a rank (Charts, feed, voting, leaderboards,
// jurisdiction and find pages) reads GET /v1/awards/standings, which ranks
// with the same formula that decides award winners:
//
//   total points = weighted vote points + plays + 5 x likes
//   ties → vote points → plays → likes → score → seniority
//
// The backend also applies the midnight rule: until anyone scores in a new
// period, a board shows the period that just ended (state PREVIOUS_FINAL, or
// PREVIOUS_CLOSING while it is still open in another timezone). describeBoard
// turns that into the words a page shows.
//
// Pages never record plays. requestPlay hands the song to the Player, which
// counts it after real listening (see player.jsx, ★ PLAY-FLOW).
// ─────────────────────────────────────────────────────────────────────────────

import { apiCall } from '../components/axiosInstance';
import { buildUrl } from './buildUrl';
import { GENRE_IDS, INTERVAL_IDS } from './idMappings';

/** Periods in the order they appear in controls. `key` matches INTERVAL_IDS. */
export const PERIODS = [
  { key: 'daily',     label: 'Today',   current: 'today',          previous: 'Yesterday' },
  { key: 'weekly',    label: 'Week',    current: 'this week',      previous: 'Last week' },
  { key: 'monthly',   label: 'Month',   current: 'this month',     previous: 'Last month' },
  { key: 'quarterly', label: 'Quarter', current: 'this quarter',   previous: 'Last quarter' },
  { key: 'midterm',   label: 'Half',    current: 'this half-year', previous: 'Last half-year' },
  { key: 'annual',    label: 'Year',    current: 'this year',      previous: 'Last year' },
];

export const periodByKey = (key) => PERIODS.find((p) => p.key === key) || PERIODS[1];

const INTERVAL_KEY_BY_NAME = {
  Daily: 'daily', Weekly: 'weekly', Monthly: 'monthly',
  Quarterly: 'quarterly', Midterm: 'midterm', Annual: 'annual',
};

/**
 * Fetch one page of a board.
 *   type          'artist' | 'song'
 *   jurisdictionId
 *   genre         'rap' | 'rock' | 'pop' | 'all' (all = every genre)
 *   period        a PERIODS key
 */
export async function fetchStandings({ type, jurisdictionId, genre = 'all', period = 'weekly', limit = 50, offset = 0 }) {
  const params = new URLSearchParams();
  params.set('type', type);
  params.set('jurisdictionId', jurisdictionId);
  const genreId = genre && genre !== 'all' ? GENRE_IDS[genre] : null;
  if (genreId) params.set('genreId', genreId);
  params.set('intervalId', INTERVAL_IDS[period] || INTERVAL_IDS.weekly);
  params.set('limit', String(limit));
  params.set('offset', String(offset));

  const res = await apiCall({ method: 'get', url: `/v1/awards/standings?${params.toString()}` });
  return normalizeBoard(res.data);
}

/** Board → the shape pages render. Image and audio paths are made absolute here. */
export function normalizeBoard(data) {
  const d = data || {};
  return {
    type: d.type || 'song',
    state: d.state || 'LIVE',
    periodKey: INTERVAL_KEY_BY_NAME[d.interval] || 'weekly',
    periodStart: d.periodStart || null,
    periodEnd: d.periodEnd || null,
    closesAt: d.closesAt || null,
    stillOpenIn: d.stillOpenIn || [],
    total: d.total || 0,
    offset: d.offset || 0,
    entries: (d.entries || []).map((e) => ({
      id: e.targetId,
      type: e.targetType || d.type || 'song',
      rank: e.rank,
      name: e.name || (e.targetType === 'artist' ? 'Unknown artist' : 'Untitled'),
      artistName: e.artistName || '',
      artistId: e.artistId || null,
      artwork: e.artworkUrl ? buildUrl(e.artworkUrl) : null,
      fileUrl: e.fileUrl ? buildUrl(e.fileUrl) : null,
      homeJurisdictionId: e.homeJurisdictionId || null,
      homeJurisdictionName: e.homeJurisdictionName || '',
      points: e.totalPoints || 0,
      votes: e.votes || 0,
      plays: e.plays || 0,
      likes: e.likes || 0,
      winner: !!e.winner,
      movement: typeof e.movement === 'number' ? e.movement : null,
      isNew: !!e.newEntry,
    })),
  };
}

// ── Words ───────────────────────────────────────────────────────────────────

const ZONE_NAMES = {
  'America/New_York': 'Eastern', 'America/Detroit': 'Eastern',
  'America/Indiana/Indianapolis': 'Eastern', 'America/Kentucky/Louisville': 'Eastern',
  'America/Chicago': 'Central',
  'America/Denver': 'Mountain', 'America/Boise': 'Mountain', 'America/Phoenix': 'Mountain',
  'America/Los_Angeles': 'Pacific',
  'America/Anchorage': 'Alaska',
  'Pacific/Honolulu': 'Hawaii',
  'America/Puerto_Rico': 'Atlantic',
};

const zoneName = (tz) => ZONE_NAMES[tz] || (tz || '').split('/').pop().replace(/_/g, ' ');

const joinZones = (zones) => {
  const names = [...new Set((zones || []).map(zoneName))];
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

/** "12:00 AM", or "Monday 12:00 AM" when it's more than a day away — in the viewer's own time. */
export function formatCloseTime(iso) {
  if (!iso) return '';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const soon = when.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  return new Intl.DateTimeFormat(undefined, soon
    ? { hour: 'numeric', minute: '2-digit' }
    : { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  ).format(when);
}

/**
 * The status line for a board.
 *   tone   'live' | 'final' | 'closing'
 *   title  short, e.g. "Live this week" / "Last week's final"
 *   detail one sentence of context
 */
export function describeBoard(board) {
  const period = periodByKey(board?.periodKey);
  const state = board?.state || 'LIVE';

  if (state === 'PREVIOUS_FINAL') {
    return {
      tone: 'final',
      title: `${period.previous}'s final`,
      detail: `The ${period.current === 'today' ? 'new day' : period.current.replace('this ', 'new ')} starts with the first play, like or vote.`,
    };
  }
  if (state === 'PREVIOUS_CLOSING') {
    const zones = joinZones(board.stillOpenIn);
    return {
      tone: 'closing',
      title: `${period.previous}, still open${zones ? ` in ${zones} time` : ''}`,
      detail: board.closesAt ? `Results are final at ${formatCloseTime(board.closesAt)}.` : 'Results are final soon.',
    };
  }
  return {
    tone: 'live',
    title: `Live ${period.current}`,
    detail: board?.closesAt ? `Results are final at ${formatCloseTime(board.closesAt)}.` : '',
  };
}

export const formatCount = (n) => (Number(n) || 0).toLocaleString('en-US');

// ── Playing ─────────────────────────────────────────────────────────────────

/**
 * Play a board entry through the PlayChoiceModal. Songs play directly; an
 * artist plays their default song. Returns false when there is nothing to play.
 */
export async function playEntry(entry, requestPlay, source) {
  if (!entry) return false;

  if (entry.type === 'song' && entry.fileUrl) {
    requestPlay({
      type: 'song',
      id: entry.id,
      songId: entry.id,
      url: entry.fileUrl,
      fileUrl: entry.fileUrl,
      title: entry.name,
      artist: entry.artistName,
      artistId: entry.artistId,
      artwork: entry.artwork,
      artworkUrl: entry.artwork,
      source,
    });
    return true;
  }

  if (entry.type === 'artist' && entry.id) {
    try {
      const res = await apiCall({ method: 'get', url: `/v1/users/${entry.id}/default-song` });
      const song = res.data;
      if (!song?.fileUrl) return false;
      const url = buildUrl(song.fileUrl);
      const artwork = buildUrl(song.artworkUrl) || entry.artwork;
      requestPlay({
        type: 'song',
        id: song.songId,
        songId: song.songId,
        url,
        fileUrl: url,
        title: song.title,
        artist: entry.name,
        artistId: entry.id,
        artwork,
        artworkUrl: artwork,
        source,
      });
      return true;
    } catch (err) {
      console.error('[standings] default song fetch failed:', err?.message || err);
      return false;
    }
  }
  return false;
}
