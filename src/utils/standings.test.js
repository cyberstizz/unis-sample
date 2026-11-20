// src/utils/standings.test.js
//
// utils/standings.js is the ONE place the web app reads rankings from:
// GET /v1/awards/standings, ranked by the same formula that decides awards.
// Leaderboards, the vote page, jurisdiction pages, the feed, Find and Charts
// all go through it, and their own suites mock it — so this file is where its
// request, its normalising and its wording are actually checked.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as axiosModule from '../components/axiosInstance';
import { GENRE_IDS, INTERVAL_IDS } from './idMappings';
import {
  PERIODS,
  periodByKey,
  fetchStandings,
  normalizeBoard,
  describeBoard,
  formatCloseTime,
  formatCount,
  playEntry,
} from './standings';

let apiSpy;

const paramsOfLastCall = () => {
  const { url } = apiSpy.mock.calls.at(-1)[0];
  return Object.fromEntries(new URL(url, 'http://x.test').searchParams);
};

beforeEach(() => {
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: { entries: [] } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===========================================================================
describe('standings — periods', () => {
  it('lists the six periods in the order controls show them', () => {
    expect(PERIODS.map((p) => p.key)).toEqual(['daily', 'weekly', 'monthly', 'quarterly', 'midterm', 'annual']);
  });

  it('every period has an interval id to send', () => {
    PERIODS.forEach((p) => expect(INTERVAL_IDS[p.key]).toBeTruthy());
  });

  it('looks a period up by key, falling back to weekly', () => {
    expect(periodByKey('monthly').label).toBe('Month');
    expect(periodByKey('nonsense').key).toBe('weekly');
    expect(periodByKey(undefined).key).toBe('weekly');
  });
});

// ===========================================================================
describe('standings — the request', () => {
  it('GETs /v1/awards/standings', async () => {
    await fetchStandings({ type: 'artist', jurisdictionId: 'jur-1' });
    const { method, url } = apiSpy.mock.calls[0][0];
    expect(method).toBe('get');
    expect(url.startsWith('/v1/awards/standings?')).toBe(true);
  });

  it('sends type, place, period, limit and offset', async () => {
    await fetchStandings({ type: 'song', jurisdictionId: 'jur-1', period: 'monthly', limit: 10, offset: 20 });
    expect(paramsOfLastCall()).toEqual({
      type: 'song',
      jurisdictionId: 'jur-1',
      intervalId: INTERVAL_IDS.monthly,
      limit: '10',
      offset: '20',
    });
  });

  it('defaults to this week, all genres, the first 50', async () => {
    await fetchStandings({ type: 'artist', jurisdictionId: 'jur-1' });
    const params = paramsOfLastCall();
    expect(params.intervalId).toBe(INTERVAL_IDS.weekly);
    expect(params.limit).toBe('50');
    expect(params.offset).toBe('0');
    expect(params.genreId).toBeUndefined();
  });

  it.each(['rap', 'rock', 'pop'])('sends the %s genre id', async (genre) => {
    await fetchStandings({ type: 'artist', jurisdictionId: 'jur-1', genre });
    expect(paramsOfLastCall().genreId).toBe(GENRE_IDS[genre]);
  });

  it('"all" sends no genre, so every genre is ranked together', async () => {
    await fetchStandings({ type: 'artist', jurisdictionId: 'jur-1', genre: 'all' });
    expect(paramsOfLastCall().genreId).toBeUndefined();
  });

  it('an unknown genre sends no genre rather than a bad id', async () => {
    await fetchStandings({ type: 'artist', jurisdictionId: 'jur-1', genre: 'jazz' });
    expect(paramsOfLastCall().genreId).toBeUndefined();
  });

  it.each(PERIODS.map((p) => p.key))('period %s sends its own interval id', async (period) => {
    await fetchStandings({ type: 'artist', jurisdictionId: 'jur-1', period });
    expect(paramsOfLastCall().intervalId).toBe(INTERVAL_IDS[period]);
  });

  it('an unknown period falls back to weekly', async () => {
    await fetchStandings({ type: 'artist', jurisdictionId: 'jur-1', period: 'fortnightly' });
    expect(paramsOfLastCall().intervalId).toBe(INTERVAL_IDS.weekly);
  });

  it('returns the normalised board', async () => {
    apiSpy.mockResolvedValue({
      data: { type: 'artist', state: 'LIVE', interval: 'Daily', total: 1, entries: [{ targetId: 'a1', name: 'Tony', totalPoints: 5, rank: 1 }] },
    });
    const board = await fetchStandings({ type: 'artist', jurisdictionId: 'jur-1', period: 'daily' });
    expect(board.periodKey).toBe('daily');
    expect(board.entries[0]).toMatchObject({ id: 'a1', name: 'Tony', points: 5, rank: 1 });
  });

  it('lets a failure reach the page that asked', async () => {
    apiSpy.mockRejectedValue(new Error('down'));
    await expect(fetchStandings({ type: 'artist', jurisdictionId: 'jur-1' })).rejects.toThrow('down');
  });
});

// ===========================================================================
describe('standings — normalising a board', () => {
  it.each([null, undefined, {}])('an empty answer (%p) becomes an empty live weekly board', (data) => {
    expect(normalizeBoard(data)).toEqual({
      type: 'song', state: 'LIVE', periodKey: 'weekly',
      periodStart: null, periodEnd: null, closesAt: null, stillOpenIn: [],
      total: 0, offset: 0, entries: [],
    });
  });

  it.each([
    ['Daily', 'daily'], ['Weekly', 'weekly'], ['Monthly', 'monthly'],
    ['Quarterly', 'quarterly'], ['Midterm', 'midterm'], ['Annual', 'annual'],
  ])('interval "%s" → period "%s"', (interval, key) => {
    expect(normalizeBoard({ interval }).periodKey).toBe(key);
  });

  it('carries the board\'s state, window and totals through', () => {
    const board = normalizeBoard({
      type: 'artist', state: 'PREVIOUS_CLOSING', interval: 'Daily',
      periodStart: '2026-11-16', periodEnd: '2026-11-16', closesAt: '2026-11-17T08:00:00Z',
      stillOpenIn: ['America/Los_Angeles'], total: 120, offset: 50,
    });
    expect(board).toMatchObject({
      type: 'artist', state: 'PREVIOUS_CLOSING', periodKey: 'daily',
      periodStart: '2026-11-16', periodEnd: '2026-11-16', closesAt: '2026-11-17T08:00:00Z',
      stillOpenIn: ['America/Los_Angeles'], total: 120, offset: 50,
    });
  });

  it('maps an entry to the shape pages render', () => {
    const [entry] = normalizeBoard({
      type: 'song',
      entries: [{
        targetId: 's1', targetType: 'song', rank: 3, name: 'Midnight Uptown',
        artistName: 'Tony Fadd', artistId: 'a1',
        artworkUrl: 'https://cdn.unismusic.com/uploads/s1.jpg', fileUrl: 'https://cdn.unismusic.com/uploads/s1.mp3',
        homeJurisdictionId: 'jur-1', homeJurisdictionName: 'Uptown Harlem',
        totalPoints: 152, votes: 4, plays: 90, likes: 12,
        winner: true, movement: -2, newEntry: false,
      }],
    }).entries;
    expect(entry).toEqual({
      id: 's1', type: 'song', rank: 3, name: 'Midnight Uptown',
      artistName: 'Tony Fadd', artistId: 'a1',
      artwork: 'https://cdn.unismusic.com/uploads/s1.jpg', fileUrl: 'https://cdn.unismusic.com/uploads/s1.mp3',
      homeJurisdictionId: 'jur-1', homeJurisdictionName: 'Uptown Harlem',
      points: 152, votes: 4, plays: 90, likes: 12,
      winner: true, movement: -2, isNew: false,
    });
  });

  it('keeps the API\'s order — the frontend never re-sorts a ranking', () => {
    const board = normalizeBoard({
      entries: [
        { targetId: 'b', rank: 1, name: 'B', totalPoints: 1 },
        { targetId: 'c', rank: 2, name: 'C', totalPoints: 99 },
        { targetId: 'a', rank: 3, name: 'A', totalPoints: 50 },
      ],
    });
    expect(board.entries.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('makes image and audio paths loadable', () => {
    const [entry] = normalizeBoard({
      entries: [{ targetId: 's1', artworkUrl: '/uploads/a b.jpg', fileUrl: 'https://x.r2.cloudflarestorage.com/unis-media/uploads/s1.mp3' }],
    }).entries;
    expect(entry.artwork).toMatch(/\/uploads\/a%20b\.jpg$/);
    expect(entry.fileUrl).toBe('https://cdn.unismusic.com/uploads/s1.mp3');
  });

  it('fills the gaps in a sparse entry', () => {
    const [entry] = normalizeBoard({ type: 'artist', entries: [{ targetId: 'a1' }] }).entries;
    expect(entry).toMatchObject({
      type: 'artist', artistName: '', artistId: null, artwork: null, fileUrl: null,
      homeJurisdictionId: null, homeJurisdictionName: '',
      points: 0, votes: 0, plays: 0, likes: 0, winner: false, movement: null, isNew: false,
    });
  });

  it('names a nameless artist "Unknown artist" and a nameless song "Untitled"', () => {
    const { entries } = normalizeBoard({
      entries: [{ targetId: 'a1', targetType: 'artist' }, { targetId: 's1', targetType: 'song' }],
    });
    expect(entries[0].name).toBe('Unknown artist');
    expect(entries[1].name).toBe('Untitled');
  });

  it('tells "did not move" (0) apart from "no movement known" (null)', () => {
    const { entries } = normalizeBoard({
      entries: [{ targetId: 'a', movement: 0 }, { targetId: 'b' }, { targetId: 'c', movement: null }, { targetId: 'd', movement: '3' }],
    });
    expect(entries.map((e) => e.movement)).toEqual([0, null, null, null]);
  });

  it('reads newEntry as isNew', () => {
    const { entries } = normalizeBoard({ entries: [{ targetId: 'a', newEntry: true }, { targetId: 'b' }] });
    expect(entries.map((e) => e.isNew)).toEqual([true, false]);
  });
});

// ===========================================================================
describe('standings — the status line', () => {
  it.each([
    ['daily', 'Live today'],
    ['weekly', 'Live this week'],
    ['monthly', 'Live this month'],
    ['quarterly', 'Live this quarter'],
    ['midterm', 'Live this half-year'],
    ['annual', 'Live this year'],
  ])('a live %s board reads "%s"', (periodKey, title) => {
    expect(describeBoard({ state: 'LIVE', periodKey })).toEqual({ tone: 'live', title, detail: '' });
  });

  it('a live board says when results become final, when it knows', () => {
    const { detail } = describeBoard({ state: 'LIVE', periodKey: 'daily', closesAt: new Date(Date.now() + 3600000).toISOString() });
    expect(detail).toMatch(/^Results are final at .+\.$/);
  });

  it.each([
    ['daily', "Yesterday's final", 'The new day starts with the first play, like or vote.'],
    ['weekly', "Last week's final", 'The new week starts with the first play, like or vote.'],
    ['monthly', "Last month's final", 'The new month starts with the first play, like or vote.'],
    ['annual', "Last year's final", 'The new year starts with the first play, like or vote.'],
  ])('before anyone scores in a new %s period it shows the last one\'s final', (periodKey, title, detail) => {
    expect(describeBoard({ state: 'PREVIOUS_FINAL', periodKey })).toEqual({ tone: 'final', title, detail });
  });

  it('a period still open somewhere names the timezone', () => {
    expect(describeBoard({ state: 'PREVIOUS_CLOSING', periodKey: 'daily', stillOpenIn: ['America/Los_Angeles'] }))
      .toMatchObject({ tone: 'closing', title: 'Yesterday, still open in Pacific time', detail: 'Results are final soon.' });
  });

  it('joins several timezones, once each', () => {
    const { title } = describeBoard({
      state: 'PREVIOUS_CLOSING', periodKey: 'weekly',
      stillOpenIn: ['America/Chicago', 'America/Denver', 'America/Boise', 'America/Los_Angeles'],
    });
    expect(title).toBe('Last week, still open in Central, Mountain and Pacific time');
  });

  it('falls back to the city for a timezone it has no name for', () => {
    const { title } = describeBoard({ state: 'PREVIOUS_CLOSING', periodKey: 'daily', stillOpenIn: ['America/Sao_Paulo'] });
    expect(title).toBe('Yesterday, still open in Sao Paulo time');
  });

  it('says just "still open" when no timezone is given', () => {
    const { title } = describeBoard({ state: 'PREVIOUS_CLOSING', periodKey: 'daily', stillOpenIn: [] });
    expect(title).toBe('Yesterday, still open');
  });

  it('a closing board says when it becomes final, when it knows', () => {
    const { detail } = describeBoard({
      state: 'PREVIOUS_CLOSING', periodKey: 'daily', stillOpenIn: ['America/Los_Angeles'],
      closesAt: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(detail).toMatch(/^Results are final at .+\.$/);
  });

  it.each([null, undefined, {}])('treats a missing board (%p) as live this week', (board) => {
    expect(describeBoard(board)).toEqual({ tone: 'live', title: 'Live this week', detail: '' });
  });
});

// ===========================================================================
describe('standings — close time and counts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T15:00:00Z'));
  });

  it('shows just the time when it is less than a day away', () => {
    const text = formatCloseTime('2026-11-18T05:00:00Z');
    expect(text).toMatch(/\d{1,2}:\d{2}/);
    expect(text).not.toMatch(/day/i);
  });

  it('adds the weekday and date when it is further off', () => {
    expect(formatCloseTime('2026-11-23T05:00:00Z')).toMatch(/day/i);
  });

  it.each([null, undefined, '', 'not a date'])('is empty for %p', (value) => {
    expect(formatCloseTime(value)).toBe('');
  });

  it.each([
    [0, '0'], [999, '999'], [1280, '1,280'], [1234567, '1,234,567'], [null, '0'], ['abc', '0'], ['42', '42'],
  ])('formats %p as %s', (n, text) => {
    expect(formatCount(n)).toBe(text);
  });
});

// ===========================================================================
describe('standings — playing an entry', () => {
  const requestPlay = vi.fn();
  beforeEach(() => requestPlay.mockClear());

  const SONG = {
    type: 'song', id: 's1', name: 'Midnight Uptown', artistName: 'Tony Fadd', artistId: 'a1',
    fileUrl: 'https://cdn.unismusic.com/uploads/s1.mp3', artwork: 'https://cdn.unismusic.com/uploads/s1.jpg',
  };
  const ARTIST = { type: 'artist', id: 'a1', name: 'Tony Fadd', artwork: 'https://cdn.unismusic.com/uploads/tony.jpg' };

  it('a song is handed to the play/queue prompt with where it was played from', async () => {
    expect(await playEntry(SONG, requestPlay, 'leaderboards')).toBe(true);
    expect(requestPlay).toHaveBeenCalledWith({
      type: 'song', id: 's1', songId: 's1',
      url: SONG.fileUrl, fileUrl: SONG.fileUrl,
      title: 'Midnight Uptown', artist: 'Tony Fadd', artistId: 'a1',
      artwork: SONG.artwork, artworkUrl: SONG.artwork,
      source: 'leaderboards',
    });
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it('a song with no file plays nothing', async () => {
    expect(await playEntry({ ...SONG, fileUrl: null }, requestPlay, 'x')).toBe(false);
    expect(requestPlay).not.toHaveBeenCalled();
  });

  it('an artist plays their featured song', async () => {
    apiSpy.mockResolvedValue({ data: { songId: 'ds1', title: 'Featured Cut', fileUrl: '/uploads/ds1.mp3', artworkUrl: '/uploads/ds1.jpg' } });
    expect(await playEntry(ARTIST, requestPlay, 'voteawards')).toBe(true);

    expect(apiSpy).toHaveBeenCalledWith({ method: 'get', url: '/v1/users/a1/default-song' });
    const played = requestPlay.mock.calls[0][0];
    expect(played).toMatchObject({
      type: 'song', id: 'ds1', songId: 'ds1', title: 'Featured Cut',
      artist: 'Tony Fadd', artistId: 'a1', source: 'voteawards',
    });
    expect(played.url).toMatch(/\/uploads\/ds1\.mp3$/);
    expect(played.url).toBe(played.fileUrl);
    expect(played.artwork).toMatch(/\/uploads\/ds1\.jpg$/);
  });

  it('falls back to the artist\'s photo when the featured song has no artwork', async () => {
    apiSpy.mockResolvedValue({ data: { songId: 'ds1', title: 'Featured Cut', fileUrl: '/uploads/ds1.mp3' } });
    await playEntry(ARTIST, requestPlay, 'x');
    expect(requestPlay.mock.calls[0][0].artwork).toBe(ARTIST.artwork);
  });

  it.each([null, {}, { songId: 'ds1', title: 'No file' }])(
    'an artist with no playable featured song (%p) plays nothing', async (data) => {
      apiSpy.mockResolvedValue({ data });
      expect(await playEntry(ARTIST, requestPlay, 'x')).toBe(false);
      expect(requestPlay).not.toHaveBeenCalled();
    });

  it('a failed lookup plays nothing and is logged, not thrown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    apiSpy.mockRejectedValue(new Error('down'));
    await expect(playEntry(ARTIST, requestPlay, 'x')).resolves.toBe(false);
    expect(console.error).toHaveBeenCalledWith('[standings] default song fetch failed:', 'down');
  });

  it.each([null, undefined, { type: 'artist' }, { type: 'video', id: 'v1' }])(
    'nothing to play for %p', async (entry) => {
      expect(await playEntry(entry, requestPlay, 'x')).toBe(false);
      expect(requestPlay).not.toHaveBeenCalled();
    });

  it('never records a play itself — the Player does that after real listening', async () => {
    await playEntry(SONG, requestPlay, 'x');
    apiSpy.mockResolvedValue({ data: { songId: 'ds1', fileUrl: '/uploads/ds1.mp3' } });
    await playEntry(ARTIST, requestPlay, 'x');
    const writes = apiSpy.mock.calls.map(([c]) => c).filter((c) => c.method !== 'get');
    expect(writes).toHaveLength(0);
  });
});
