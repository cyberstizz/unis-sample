// src/chartsPage.test.jsx
//
// Tests for ChartsPage (/charts) — the long ranked list.
//
// Ranking comes from /v1/awards/standings through utils/standings.js, the same
// numbers that decide awards. This page only asks for a board and shows it;
// it never counts a play (requestPlay hands the song to the Player).
//
// Covers:
//   • which board is asked for: defaults, the signed-in user's home area,
//     deep links, and bad values in the address
//   • the filters (Show, Period, Genre, Place) — each changes the address and
//     loads the matching board
//   • loading, a failed load and Try again, an empty board
//   • the status line (live / last period's final)
//   • the #1 feature row: kicker, points, and its lead over #2
//   • the list: rank, movement, the "why" line, Won, entries with no points
//     under a divider
//   • opening songs and artists; Play and Pause
//   • paging: Load more, loading as the end scrolls into view, a failed page,
//     a period that closed between pages, and a late answer to an old filter
//   • Back to top

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import * as axiosModule from './components/axiosInstance';
import { JURISDICTION_IDS } from './utils/idMappings';

vi.mock('./chartsPage.scss', () => ({}));
vi.mock('./components/RankMove.scss', () => ({}));
vi.mock('./layout', () => ({ default: ({ children }) => <div data-testid="layout">{children}</div> }));

const { authState, navigateSpy, standings } = vi.hoisted(() => ({
  authState: { user: null },
  navigateSpy: vi.fn(),
  standings: { fetchStandings: vi.fn(), playEntry: vi.fn() },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateSpy,
}));
vi.mock('./context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('./context/playercontext', async () => {
  const { createContext } = await import('react');
  return { PlayerContext: createContext(null) };
});
vi.mock('./utils/standings', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStandings: standings.fetchStandings,
  playEntry: standings.playEntry,
}));

import ChartsPage from './chartsPage';
import { PlayerContext } from './context/playercontext';

// ---------------------------------------------------------------------------
const song = (rank, extra = {}) => ({
  id: `s-${rank}`, type: 'song', rank, name: `Song ${rank}`, artistName: `Artist ${rank}`, artistId: `a-${rank}`,
  artwork: null, fileUrl: `https://cdn.test/s${rank}.mp3`, points: 1000 - rank * 10,
  votes: 0, plays: 0, likes: 0, winner: false, movement: null, isNew: false, ...extra,
});
const artist = (rank, extra = {}) => ({
  ...song(rank), id: `a-${rank}`, type: 'artist', name: `Artist ${rank}`, artistName: '', artistId: null, ...extra,
});
const board = (entries, extra = {}) => ({
  type: 'song', state: 'LIVE', periodKey: 'weekly', periodStart: '2026-11-16', periodEnd: '2026-11-22',
  closesAt: null, stillOpenIn: [], total: entries.length, offset: 0, entries, ...extra,
});
const range = (from, to, make = song) => Array.from({ length: to - from + 1 }, (_, i) => make(from + i));

let player;
let observers;
let apiSpy;
let location;

const LocationProbe = () => { location = useLocation(); return null; };

function renderPage(path = '/charts') {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <PlayerContext.Provider value={player}>
        <ChartsPage />
        <LocationProbe />
      </PlayerContext.Provider>
    </MemoryRouter>,
  );
  return { user };
}

async function renderLoaded(path) {
  const utils = renderPage(path);
  await waitFor(() => expect(screen.queryByLabelText('Loading the chart')).not.toBeInTheDocument());
  return utils;
}

const requests = () => standings.fetchStandings.mock.calls.map(([q]) => q);
const lastRequest = () => requests().at(-1);
const rowOf = (name) => screen.getByRole('button', { name: new RegExp(`^${name}( Won)?$`) }).closest('.ch-row');
const rowNames = () => Array.from(document.querySelectorAll('.ch-row .ch-name')).map((n) => n.firstChild.textContent);
const lead = () => document.querySelector('.ch-lead');
const group = (label) => screen.getByRole('group', { name: label });
const scrollIntoView = async () => {
  const live = observers.filter((o) => !o.dead).at(-1);
  await act(async () => { live.callback([{ isIntersecting: true }]); });
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = null;
  player = { requestPlay: vi.fn(), currentMedia: null, isPlaying: false, togglePlayPause: vi.fn() };
  standings.fetchStandings.mockResolvedValue(board(range(1, 3)));
  standings.playEntry.mockResolvedValue(true);
  apiSpy = vi.spyOn(axiosModule, 'apiCall');
  vi.spyOn(console, 'error').mockImplementation(() => {});

  observers = [];
  window.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this); }
    observe() {}
    disconnect() { this.dead = true; }
  };
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  window.scrollTo = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
describe('ChartsPage — which board is asked for', () => {
  it('by default: songs, this week, all genres, Harlem — 50 at a time from the top', async () => {
    await renderLoaded();
    expect(requests()).toEqual([{
      type: 'song', jurisdictionId: JURISDICTION_IDS.harlem, genre: 'all', period: 'weekly', limit: 50, offset: 0,
    }]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Harlem charts');
  });

  it('starts on the signed-in user\'s home area', async () => {
    authState.user = { userId: 'u-1', jurisdiction: { jurisdictionId: JURISDICTION_IDS['uptown-harlem'] } };
    await renderLoaded();
    expect(lastRequest().jurisdictionId).toBe(JURISDICTION_IDS['uptown-harlem']);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Uptown Harlem charts');
  });

  it('a home area the charts do not cover falls back to Harlem', async () => {
    authState.user = { userId: 'u-1', jurisdiction: { jurisdictionId: 'somewhere-else' } };
    await renderLoaded();
    expect(lastRequest().jurisdictionId).toBe(JURISDICTION_IDS.harlem);
  });

  it('a deep link picks the board', async () => {
    authState.user = { userId: 'u-1', jurisdiction: { jurisdictionId: JURISDICTION_IDS['uptown-harlem'] } };
    await renderLoaded('/charts?type=artist&period=daily&genre=rap&place=downtown-harlem');

    expect(lastRequest()).toEqual({
      type: 'artist', jurisdictionId: JURISDICTION_IDS['downtown-harlem'], genre: 'rap', period: 'daily', limit: 50, offset: 0,
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Downtown Harlem charts');
    expect(within(group('Show')).getByRole('button', { name: 'Artists' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group('Period')).getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group('Genre')).getByRole('button', { name: 'Rap' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Place')).toHaveValue('downtown-harlem');
  });

  it('values it does not recognise are ignored rather than sent to the server', async () => {
    await renderLoaded('/charts?type=album&period=hourly&genre=jazz&place=queens');
    expect(lastRequest()).toEqual({
      type: 'song', jurisdictionId: JURISDICTION_IDS.harlem, genre: 'all', period: 'weekly', limit: 50, offset: 0,
    });
  });

  it('asks the standings only — the page itself reports nothing', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play Song 2' }));
    expect(apiSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('ChartsPage — filters', () => {
  it('offers Songs and Artists, the six periods, the genres and the open areas', async () => {
    await renderLoaded();
    const labels = (name) => within(group(name)).getAllByRole('button').map((b) => b.textContent);
    expect(labels('Show')).toEqual(['Songs', 'Artists']);
    expect(labels('Period')).toEqual(['Today', 'Week', 'Month', 'Quarter', 'Half', 'Year']);
    expect(labels('Genre')).toEqual(['All genres', 'Rap', 'Rock', 'Pop']);
    expect(within(screen.getByLabelText('Place')).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Harlem', 'Uptown Harlem', 'Downtown Harlem']);
  });

  it.each([
    ['Show', 'Artists', 'type', 'artist'],
    ['Period', 'Month', 'period', 'monthly'],
    ['Period', 'Half', 'period', 'midterm'],
    ['Genre', 'Rock', 'genre', 'rock'],
  ])('%s → %s loads that board and puts it in the address', async (label, option, key, value) => {
    const { user } = await renderLoaded();
    await user.click(within(group(label)).getByRole('button', { name: option }));

    await waitFor(() => expect(lastRequest()[key]).toBe(value));
    expect(lastRequest().offset).toBe(0);
    expect(new URLSearchParams(location.search).get(key)).toBe(value);
    expect(within(group(label)).getByRole('button', { name: option })).toHaveAttribute('aria-pressed', 'true');
  });

  it('choosing a place loads that area and renames the page', async () => {
    const { user } = await renderLoaded();
    await user.selectOptions(screen.getByLabelText('Place'), 'uptown-harlem');

    await waitFor(() => expect(lastRequest().jurisdictionId).toBe(JURISDICTION_IDS['uptown-harlem']));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Uptown Harlem charts');
    expect(new URLSearchParams(location.search).get('place')).toBe('uptown-harlem');
  });

  it('changing one filter keeps the others', async () => {
    const { user } = await renderLoaded('/charts?type=artist&genre=rap');
    await user.click(within(group('Period')).getByRole('button', { name: 'Year' }));

    await waitFor(() => expect(lastRequest()).toMatchObject({ type: 'artist', genre: 'rap', period: 'annual' }));
    expect(location.search).toContain('type=artist');
    expect(location.search).toContain('genre=rap');
  });

  it('the filters stay on screen while loading, on error and when empty', async () => {
    standings.fetchStandings.mockRejectedValue(new Error('down'));
    await renderLoaded();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(group('Show')).toBeInTheDocument();
    expect(group('Period')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('ChartsPage — loading, errors and empty boards', () => {
  it('shows placeholder rows while the chart loads', async () => {
    let finish;
    standings.fetchStandings.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderPage();
    const loading = screen.getByLabelText('Loading the chart');
    expect(loading).toHaveAttribute('aria-busy', 'true');
    expect(loading.querySelectorAll('.is-skeleton')).toHaveLength(8);

    await act(async () => { finish(board(range(1, 3))); });
    expect(screen.queryByLabelText('Loading the chart')).not.toBeInTheDocument();
  });

  it('says so when the chart does not load, and Try again reloads it', async () => {
    standings.fetchStandings.mockRejectedValueOnce(new Error('down'));
    const { user } = await renderLoaded();
    expect(screen.getByRole('alert')).toHaveTextContent("The chart didn't load. Check your connection and try again.");

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Song 2' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(requests()).toHaveLength(2);
  });

  it('an empty board says there are none yet and points to Discover', async () => {
    standings.fetchStandings.mockResolvedValue(board([]));
    const { user } = await renderLoaded();
    expect(screen.getByText('No songs in Harlem yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Explore Discover' }));
    expect(navigateSpy).toHaveBeenCalledWith('/discover');
  });

  it('the empty line names the genre, the kind and the place being looked at', async () => {
    standings.fetchStandings.mockResolvedValue(board([], { type: 'artist' }));
    await renderLoaded('/charts?type=artist&genre=rap&place=uptown-harlem');
    expect(screen.getByText('No Rap artists in Uptown Harlem yet.')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('ChartsPage — status line', () => {
  it('a live board says so', async () => {
    await renderLoaded();
    expect(screen.getByRole('status')).toHaveTextContent('Live this week.');
    expect(screen.getByRole('status')).toHaveClass('ch-status--live');
  });

  it('before the new period has any activity it shows last period\'s final', async () => {
    standings.fetchStandings.mockResolvedValue(board(range(1, 3), { state: 'PREVIOUS_FINAL' }));
    await renderLoaded();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent("Last week's final.");
    expect(status).toHaveTextContent('The new week starts with the first play, like or vote.');
    expect(status).toHaveClass('ch-status--final');
  });

  it('uses the period the server answered with, not the one asked for', async () => {
    standings.fetchStandings.mockResolvedValue(board(range(1, 3), { periodKey: 'daily' }));
    await renderLoaded();
    expect(screen.getByRole('status')).toHaveTextContent('Live today.');
  });

  it('there is no status line until a board has loaded', async () => {
    standings.fetchStandings.mockRejectedValue(new Error('down'));
    await renderLoaded();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('ChartsPage — the #1 feature row', () => {
  it('features the leader with its points and what earned them', async () => {
    standings.fetchStandings.mockResolvedValue(board([
      song(1, { points: 1234, votes: 12, plays: 340, likes: 4, movement: 2 }), song(2, { points: 900 }),
    ]));
    await renderLoaded();

    const hero = screen.getByRole('region', { name: 'Number one: Song 1' });
    expect(hero.querySelector('.ch-lead-num')).toHaveTextContent('1');
    expect(within(hero).getByText('Number one right now')).toBeInTheDocument();
    expect(hero.querySelector('.ch-lead-points')).toHaveTextContent('1,234points');
    expect(hero.querySelector('.ch-lead-meta')).toHaveTextContent('12 votes · 340 plays · 4 likes');
    expect(within(hero).getByLabelText('Up 2 places')).toBeInTheDocument();
  });

  it('the leader is not repeated in the list below', async () => {
    await renderLoaded();
    expect(rowNames()).toEqual(['Song 2', 'Song 3']);
  });

  it.each([
    ['a clear lead', [song(1, { points: 500 }), song(2, { points: 350 })], 'Ahead by 150 points'],
    ['a one-point lead', [song(1, { points: 500 }), song(2, { points: 499 })], 'Ahead by 1 point'],
    ['a big lead', [song(1, { points: 5000 }), song(2, { points: 1500 })], 'Ahead by 3,500 points'],
    ['a tie', [song(1, { points: 500 }), song(2, { points: 500 })], 'Tied with Song 2, ahead on the tiebreak'],
    ['nobody else scoring', [song(1, { points: 500 }), song(2, { points: 0 })], 'Nobody else has scored yet'],
    ['being alone on the board', [song(1, { points: 500 })], 'Nobody else has scored yet'],
  ])('with %s it reads the gap correctly', async (_label, entries, line) => {
    standings.fetchStandings.mockResolvedValue(board(entries));
    await renderLoaded();
    expect(lead().querySelector('.ch-lead-gap')).toHaveTextContent(line);
  });

  it.each([
    ['LIVE', false, 'Number one right now'],
    ['PREVIOUS_CLOSING', false, 'Leading, still counting'],
    ['PREVIOUS_FINAL', true, 'Won'],
    ['PREVIOUS_FINAL', false, 'Finished first'],
  ])('board %s (winner: %s) is headed "%s"', async (state, winner, kicker) => {
    standings.fetchStandings.mockResolvedValue(board([song(1, { winner }), song(2)], { state }));
    await renderLoaded();
    expect(lead().querySelector('.ch-lead-kicker')).toHaveTextContent(kicker);
  });

  it('there is no feature row when nothing has scored — the list says why', async () => {
    standings.fetchStandings.mockResolvedValue(board([song(1, { points: 0 }), song(2, { points: 0 })]));
    await renderLoaded();

    expect(lead()).toBeNull();
    expect(screen.getByText('Nothing has scored this week yet. Everyone below is listed by all-time points.')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Song 1', 'Song 2']);
    expect(document.querySelector('.ch-divider')).toBeNull();
  });

  it('that note names the period shown', async () => {
    standings.fetchStandings.mockResolvedValue(board([song(1, { points: 0 })], { state: 'PREVIOUS_FINAL', periodKey: 'monthly' }));
    await renderLoaded('/charts?period=monthly');
    expect(screen.getByText('Nothing has scored last month yet. Everyone below is listed by all-time points.')).toBeInTheDocument();
  });

  it('opens the song from its name or artwork, and the artist from the artist name', async () => {
    const { user } = await renderLoaded();
    await user.click(within(lead()).getByRole('button', { name: 'Song 1' }));
    await user.click(within(lead()).getByRole('button', { name: 'Open Song 1' }));
    await user.click(within(lead()).getByRole('button', { name: 'Artist 1' }));
    expect(navigateSpy.mock.calls).toEqual([['/song/s-1'], ['/song/s-1'], ['/artist/a-1']]);
  });

  it('shows the artwork when there is one, and the first letter when there is not', async () => {
    standings.fetchStandings.mockResolvedValue(board([song(1, { artwork: 'https://cdn.test/1.jpg' }), song(2, { name: 'zebra' })]));
    await renderLoaded();
    expect(lead().querySelector('img.ch-lead-art')).toHaveAttribute('src', 'https://cdn.test/1.jpg');
    expect(rowOf('zebra').querySelector('.ch-art--none')).toHaveTextContent('Z');

    fireEvent.error(lead().querySelector('img.ch-lead-art'));
    expect(lead().querySelector('.ch-art--none')).toHaveTextContent('S');
  });
});

// ===========================================================================
describe('ChartsPage — the list', () => {
  it('each row shows rank, name, artist and points', async () => {
    standings.fetchStandings.mockResolvedValue(board([song(1), song(2, { points: 12345 }), song(3)]));
    await renderLoaded();
    const row = rowOf('Song 2');
    expect(row.querySelector('.ch-rank-num')).toHaveTextContent('2');
    expect(within(row).getByRole('button', { name: 'Artist 2' })).toBeInTheDocument();
    expect(row.querySelector('.ch-points')).toHaveTextContent('12,345pts');
  });

  it('marks the top three', async () => {
    standings.fetchStandings.mockResolvedValue(board(range(1, 5)));
    await renderLoaded();
    expect(rowOf('Song 2')).toHaveClass('is-top');
    expect(rowOf('Song 3')).toHaveClass('is-top');
    expect(rowOf('Song 4')).not.toHaveClass('is-top');
  });

  it.each([
    [{ votes: 12, plays: 340, likes: 4 }, '12 votes · 340 plays · 4 likes'],
    [{ votes: 1, plays: 1, likes: 1 }, '1 vote · 1 play · 1 like'],
    [{ votes: 0, plays: 1234, likes: 0 }, '1,234 plays'],
    [{ votes: 3, plays: 0, likes: 2 }, '3 votes · 2 likes'],
  ])('says why an entry is there: %j', async (counts, line) => {
    standings.fetchStandings.mockResolvedValue(board([song(1), song(2, counts)]));
    await renderLoaded();
    expect(rowOf('Song 2').querySelector('.ch-reason')).toHaveTextContent(line);
  });

  it('shows how each entry moved since the period before', async () => {
    standings.fetchStandings.mockResolvedValue(board([
      song(1), song(2, { movement: 3 }), song(3, { movement: -1 }), song(4, { movement: 0 }), song(5, { isNew: true }), song(6),
    ]));
    await renderLoaded();
    expect(within(rowOf('Song 2')).getByLabelText('Up 3 places')).toBeInTheDocument();
    expect(within(rowOf('Song 3')).getByLabelText('Down 1 place')).toBeInTheDocument();
    expect(within(rowOf('Song 4')).getByLabelText('Same place as last period')).toBeInTheDocument();
    expect(within(rowOf('Song 5')).getByText('New')).toBeInTheDocument();
    expect(rowOf('Song 6').querySelector('.rk-move')).toBeNull();
  });

  it('marks a past winner', async () => {
    standings.fetchStandings.mockResolvedValue(board([song(1), song(2, { winner: true }), song(3)], { state: 'PREVIOUS_FINAL' }));
    await renderLoaded();
    expect(rowOf('Song 2').querySelector('.ch-won')).toHaveTextContent('Won');
    expect(rowOf('Song 3').querySelector('.ch-won')).toBeNull();
  });

  it('entries with no points this period sit under a divider, undecorated', async () => {
    standings.fetchStandings.mockResolvedValue(board([
      song(1), song(2), song(3, { points: 0, movement: 4, votes: 9 }), song(4, { points: 0 }),
    ]));
    await renderLoaded();

    const items = Array.from(document.querySelectorAll('ol.ch-list > li'));
    expect(items.map((li) => (li.classList.contains('ch-divider') ? 'divider' : li.querySelector('.ch-name').textContent)))
      .toEqual(['Song 2', 'divider', 'Song 3', 'Song 4']);
    expect(document.querySelector('.ch-divider')).toHaveTextContent('No points this week yet, listed by all-time points');

    const unscored = rowOf('Song 3');
    expect(unscored).toHaveClass('is-unscored');
    expect(unscored.querySelector('.ch-points')).toHaveTextContent('—');
    expect(unscored.querySelector('.ch-reason')).toBeNull();
    expect(unscored.querySelector('.rk-move')).toBeNull();
  });

  it('the divider names last period when that is what is shown', async () => {
    standings.fetchStandings.mockResolvedValue(board([song(1), song(2, { points: 0 })], { state: 'PREVIOUS_FINAL', periodKey: 'daily' }));
    await renderLoaded('/charts?period=daily');
    expect(document.querySelector('.ch-divider')).toHaveTextContent('No points yesterday yet, listed by all-time points');
  });

  it('a song opens its page; its artist name opens the artist', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Song 2' }));
    await user.click(within(rowOf('Song 2')).getByRole('button', { name: 'Artist 2' }));
    expect(navigateSpy.mock.calls).toEqual([['/song/s-2'], ['/artist/a-2']]);
  });

  it('on the artists chart a row opens the artist, with no second artist line', async () => {
    standings.fetchStandings.mockResolvedValue(board(range(1, 3, artist), { type: 'artist' }));
    const { user } = await renderLoaded('/charts?type=artist');
    await user.click(screen.getByRole('button', { name: 'Artist 2' }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/a-2');
    expect(rowOf('Artist 2').querySelector('.ch-artist')).toBeNull();
  });

  it('says how much of the chart is showing', async () => {
    await renderLoaded();
    expect(document.querySelector('.ch-foot')).toHaveTextContent('Showing 3 of 3 songs');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it.each([
    [[song(1)], {}, '/charts', 'Showing 1 of 1 song'],
    [range(1, 2, artist), { type: 'artist' }, '/charts?type=artist', 'Showing 2 of 2 artists'],
    [range(1, 50), { total: 1240 }, '/charts', 'Showing 50 of 1,240 songs'],
  ])('counts in the right words', async (entries, extra, path, line) => {
    standings.fetchStandings.mockResolvedValue(board(entries, extra));
    await renderLoaded(path);
    expect(document.querySelector('.ch-foot')).toHaveTextContent(line);
  });
});

// ===========================================================================
describe('ChartsPage — playing', () => {
  it('Play hands the entry to the play chooser, tagged as coming from the charts', async () => {
    const entries = range(1, 3);
    standings.fetchStandings.mockResolvedValue(board(entries));
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play Song 2' }));

    expect(standings.playEntry).toHaveBeenCalledTimes(1);
    expect(standings.playEntry).toHaveBeenCalledWith(entries[1], player.requestPlay, 'charts');
    expect(player.togglePlayPause).not.toHaveBeenCalled();
  });

  it('the #1 row has its own Play button', async () => {
    const { user } = await renderLoaded();
    const button = within(lead()).getByRole('button', { name: 'Play Song 1' });
    expect(button).toHaveTextContent('Play');
    await user.click(button);
    expect(standings.playEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 's-1' }), player.requestPlay, 'charts');
  });

  it('the song that is playing lights up and its button pauses instead of restarting', async () => {
    player.currentMedia = { songId: 's-2' };
    player.isPlaying = true;
    const { user } = await renderLoaded();

    expect(rowOf('Song 2')).toHaveClass('is-current');
    expect(rowOf('Song 3')).not.toHaveClass('is-current');
    await user.click(screen.getByRole('button', { name: 'Pause Song 2' }));

    expect(player.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(standings.playEntry).not.toHaveBeenCalled();
  });

  it('a paused current song offers Play, which resumes it', async () => {
    player.currentMedia = { id: 's-2' };
    player.isPlaying = false;
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play Song 2' }));

    expect(player.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(standings.playEntry).not.toHaveBeenCalled();
  });

  it('when the #1 is playing its big button reads Pause', async () => {
    player.currentMedia = { songId: 's-1' };
    player.isPlaying = true;
    await renderLoaded();
    expect(within(lead()).getByRole('button', { name: 'Pause Song 1' })).toHaveTextContent('Pause');
  });

  it('on the artists chart, the artist whose song is playing lights up', async () => {
    player.currentMedia = { songId: 's-77', artistId: 'a-2' };
    player.isPlaying = true;
    standings.fetchStandings.mockResolvedValue(board(range(1, 3, artist), { type: 'artist' }));
    await renderLoaded('/charts?type=artist');
    expect(rowOf('Artist 2')).toHaveClass('is-current');
    expect(screen.getByRole('button', { name: 'Pause Artist 2' })).toBeInTheDocument();
  });

  it('nothing is lit when nothing is playing', async () => {
    await renderLoaded();
    expect(document.querySelector('.is-current')).toBeNull();
  });
});

// ===========================================================================
describe('ChartsPage — paging', () => {
  const firstPage = () => board(range(1, 50), { total: 120 });
  const page = (from, to, extra = {}) => board(range(from, to), { total: 120, offset: from - 1, ...extra });

  it('Load more asks for the next 50 and adds them to the list', async () => {
    standings.fetchStandings.mockResolvedValueOnce(firstPage()).mockResolvedValueOnce(page(51, 100));
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('button', { name: 'Song 100' })).toBeInTheDocument();
    expect(requests()[1]).toEqual({
      type: 'song', jurisdictionId: JURISDICTION_IDS.harlem, genre: 'all', period: 'weekly', limit: 50, offset: 50,
    });
    expect(document.querySelector('.ch-foot')).toHaveTextContent('Showing 100 of 120 songs');
    expect(rowNames()).toHaveLength(99);
  });

  it('keeps loading as the end of the list comes into view', async () => {
    standings.fetchStandings
      .mockResolvedValueOnce(firstPage()).mockResolvedValueOnce(page(51, 100)).mockResolvedValueOnce(page(101, 120));
    await renderLoaded();

    await scrollIntoView();
    await screen.findByRole('button', { name: 'Song 100' });
    await scrollIntoView();
    await screen.findByRole('button', { name: 'Song 120' });

    expect(requests().map((q) => q.offset)).toEqual([0, 50, 100]);
    expect(document.querySelector('.ch-foot')).toHaveTextContent('Showing 120 of 120 songs');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('stops asking once everything is loaded', async () => {
    await renderLoaded();
    await scrollIntoView();
    expect(requests()).toHaveLength(1);
  });

  it('starts loading well before the end is reached', async () => {
    await renderLoaded();
    expect(observers.at(-1).options).toEqual({ rootMargin: '800px 0px' });
  });

  it('the button shows Loading… and cannot be pressed twice', async () => {
    standings.fetchStandings.mockResolvedValueOnce(firstPage()).mockReturnValueOnce(new Promise(() => {}));
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
    await scrollIntoView();
    expect(requests()).toHaveLength(2);
  });

  it('an entry that slid onto the next page is not listed twice', async () => {
    standings.fetchStandings.mockResolvedValueOnce(firstPage())
      .mockResolvedValueOnce(board([song(50), ...range(51, 99)], { total: 120, offset: 50 }));
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    await screen.findByRole('button', { name: 'Song 99' });
    expect(rowNames().filter((n) => n === 'Song 50')).toHaveLength(1);
  });

  it('follows the server when the total changes between pages', async () => {
    standings.fetchStandings.mockResolvedValueOnce(firstPage())
      .mockResolvedValueOnce(board(range(51, 100), { total: 100, offset: 50 }));
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    await screen.findByRole('button', { name: 'Song 100' });
    expect(document.querySelector('.ch-foot')).toHaveTextContent('Showing 100 of 100 songs');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('a page that fails keeps the list, stops auto-loading, and offers a retry', async () => {
    standings.fetchStandings.mockResolvedValueOnce(firstPage())
      .mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(page(51, 100));
    const { user } = await renderLoaded();
    await scrollIntoView();

    const retry = await screen.findByRole('button', { name: 'Try loading more again' });
    expect(rowNames()).toHaveLength(49);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await scrollIntoView();
    expect(requests()).toHaveLength(2);

    await user.click(retry);
    expect(await screen.findByRole('button', { name: 'Song 100' })).toBeInTheDocument();
    expect(requests().map((q) => q.offset)).toEqual([0, 50, 50]);
  });

  it.each([
    ['a new period started', { periodStart: '2026-11-23' }],
    ['the board went from live to final', { state: 'PREVIOUS_FINAL' }],
  ])('when %s between pages, the chart starts again from the top', async (_label, change) => {
    standings.fetchStandings
      .mockResolvedValueOnce(firstPage())
      .mockResolvedValueOnce(page(51, 100, change))
      .mockResolvedValueOnce(board([song(1, { name: 'Fresh Leader' }), song(2)], change));
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('region', { name: 'Number one: Fresh Leader' })).toBeInTheDocument();
    expect(requests().map((q) => q.offset)).toEqual([0, 50, 0]);
    expect(rowNames()).toEqual(['Song 2']);
  });

  it('a late answer for a filter the user has moved off is thrown away', async () => {
    let finishSongs;
    standings.fetchStandings
      .mockReturnValueOnce(new Promise((resolve) => { finishSongs = resolve; }))
      .mockResolvedValueOnce(board(range(1, 3, artist), { type: 'artist' }));
    const { user } = renderPage();
    await user.click(within(group('Show')).getByRole('button', { name: 'Artists' }));
    await screen.findByRole('button', { name: 'Artist 2' });

    await act(async () => { finishSongs(board(range(1, 3))); });
    expect(rowNames()).toEqual(['Artist 2', 'Artist 3']);
    expect(screen.queryByRole('button', { name: 'Song 2' })).not.toBeInTheDocument();
  });

  it('a late next page for the old filter is thrown away too', async () => {
    let finishPage;
    standings.fetchStandings
      .mockResolvedValueOnce(firstPage())
      .mockReturnValueOnce(new Promise((resolve) => { finishPage = resolve; }))
      .mockResolvedValueOnce(board(range(1, 3, artist), { type: 'artist' }));
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await user.click(within(group('Show')).getByRole('button', { name: 'Artists' }));
    await screen.findByRole('button', { name: 'Artist 2' });

    await act(async () => { finishPage(page(51, 100)); });
    expect(rowNames()).toEqual(['Artist 2', 'Artist 3']);
  });
});

// ===========================================================================
describe('ChartsPage — Back to top', () => {
  const backToTop = () => document.querySelector('.ch-top');

  it('is hidden and out of the tab order near the top of the page', async () => {
    await renderLoaded();
    expect(backToTop()).not.toHaveClass('is-visible');
    expect(backToTop()).toHaveAttribute('aria-hidden', 'true');
    expect(backToTop()).toHaveAttribute('tabindex', '-1');
  });

  it('appears after scrolling a long way down, and scrolls smoothly to the top', async () => {
    const { user } = await renderLoaded();
    window.scrollY = 1500;
    fireEvent.scroll(window);

    expect(backToTop()).toHaveClass('is-visible');
    expect(backToTop()).toHaveAttribute('tabindex', '0');
    await user.click(screen.getByRole('button', { name: 'Back to top' }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('hides again on the way back up', async () => {
    await renderLoaded();
    window.scrollY = 1500;
    fireEvent.scroll(window);
    window.scrollY = 300;
    fireEvent.scroll(window);
    expect(backToTop()).not.toHaveClass('is-visible');
  });
});
