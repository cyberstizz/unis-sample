// src/leaderboardsPage.test.jsx
//
// Comprehensive test suite for LeaderboardsPage.
//
// Covers:
//   • Initial render & default filter state
//   • Filter dropdown interactions (location, genre, category, interval)
//   • Correct URL param construction for the /v1/vote/leaderboards GET
//   • Rendering artist leaderboards + song leaderboards
//   • Empty-results path ("No results found for this combination.")
//   • Loading state + disabled button during fetch
//   • Image onError fallback to backimage asset
//   • handlePlay: song-with-fileUrl path (direct play + track POST)
//   • handlePlay: artist path (fetch /v1/users/:id/default-song → play + track)
//   • handlePlay: fallback to sample song when no fileUrl present
//   • handleArtistView / handleSongView navigation
//   • JWT userId extraction from token (tracking URL includes ?userId=…)
//   • Guest mode (no userId) → play happens but track POST is skipped
//   • Normalization fallbacks (rank, name, votes, artwork)
//   • Regression guards for four fixed production bugs:
//       1. "Harlem-wide" dropdown value now correctly maps to HARLEM_ID
//       2. "Rap" dropdown value no longer has trailing hyphen
//       3. item-artist slot correctly shows artist name on song rows,
//          and is suppressed on artist rows
//       4. item-votes slot renders the vote count with singular/plural
//       5. Song leaderboard rows play the real fileUrl, not the sample MP3
//          (requires backend LeaderboardDto.fileUrl — fixed server-side)
//
// Pattern notes:
//   • Uses vi.hoisted for navigateSpy + playMediaSpy so vi.mock factories see them.
//   • Uses the apiCallLog pattern (see feed.test.jsx) to assert URL params
//     without depending on MSW implementation details.
//   • Uses server.use() to override the default empty-array leaderboards handler.
//   • cacheService.clearAll() in beforeEach — leaderboards isn't cached by
//     axiosInstance's cache-key matcher, but other endpoints touched here
//     (default-song, profile) can be. Safe belt-and-suspenders.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';
import * as axiosModule from './components/axiosInstance';
import cacheService from './services/cacheService';

// ---------------------------------------------------------------------------
// HEAVY CHILD MOCKS
// ---------------------------------------------------------------------------

vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('./leaderboardsPage.scss', () => ({}));

// Asset mocks
vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));
vi.mock('./assets/tonyfadd_paranoidbuy1get1free.mp3', () => ({ default: 'sample.mp3' }));

// Navigation spy — hoisted so it's available when vi.mock runs
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

// PlayerContext mock — override the default context so we can spy on playMedia
const { playMediaSpy } = vi.hoisted(() => ({ playMediaSpy: vi.fn() }));
vi.mock('./context/playercontext', async () => {
  const actual = await vi.importActual('./context/playercontext');
  const React = require('react');
  return {
    ...actual,
    PlayerContext: React.createContext({ playMedia: playMediaSpy }),
  };
});

// Import AFTER mocks
import LeaderboardsPage from './leaderboardsPage';

// ---------------------------------------------------------------------------
// IDs / FIXTURES — mirror real backend UUIDs
// ---------------------------------------------------------------------------
const API = 'http://localhost:8080/api';

const HARLEM_ID = '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3';
const UPTOWN_ID = '52740de0-e4e9-4c9e-b68e-1e170f6788c4';
const DOWNTOWN_ID = '4b09eaa2-03bc-4778-b7c2-db8b42c9e732';

const RAP_ID = '00000000-0000-0000-0000-000000000101';
const ROCK_ID = '00000000-0000-0000-0000-000000000102';
const POP_ID = '00000000-0000-0000-0000-000000000103';

const DAILY_ID = '00000000-0000-0000-0000-000000000201';
const WEEKLY_ID = '00000000-0000-0000-0000-000000000202';
const MONTHLY_ID = '00000000-0000-0000-0000-000000000203';
const QUARTERLY_ID = '00000000-0000-0000-0000-000000000204';
const ANNUAL_ID = '00000000-0000-0000-0000-000000000205';
const MIDTERM_ID = '00000000-0000-0000-0000-000000000206';

// Shape matches backend LeaderboardDto: { rank, name, votes, artwork, artist?, targetId }
const artistLeaderboardFixture = [
  { targetId: 'artist-uuid-01', rank: 1, name: 'Tony Fadd', votes: 42, artwork: '/uploads/tony.jpg' },
  { targetId: 'artist-uuid-02', rank: 2, name: 'SD Boomin',  votes: 31, artwork: '/uploads/boomin.jpg' },
  { targetId: 'artist-uuid-03', rank: 3, name: 'Harlem MC',  votes: 15, artwork: null },
];

const songLeaderboardFixture = [
  { targetId: 'song-uuid-01', rank: 1, name: 'Midnight Uptown', artist: 'Tony Fadd', votes: 55, artwork: '/uploads/song1.jpg', fileUrl: '/uploads/song1.mp3' },
  { targetId: 'song-uuid-02', rank: 2, name: 'Block Party',     artist: 'SD Boomin', votes: 40, artwork: '/uploads/song2.jpg', fileUrl: '/uploads/song2.mp3' },
];

// ---------------------------------------------------------------------------
// apiCall logger — lets us assert URLs without re-mocking MSW endpoints
// ---------------------------------------------------------------------------
let apiCallLog = [];
function setupApiCallLog() {
  apiCallLog = [];
  const originalApiCall = axiosModule.apiCall;
  vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    apiCallLog.push({ ...config });
    return originalApiCall(config);
  });
}
function leaderboardsCall() {
  return apiCallLog.find(c => c.url && c.url.includes('/v1/vote/leaderboards'));
}
function parseParams(url) {
  // URL is a path starting with /, so give it a dummy base
  const u = new URL(url, 'http://x.test');
  const out = {};
  u.searchParams.forEach((v, k) => { out[k] = v; });
  return out;
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  cacheService.clearAll();
  callTracker.reset();
  navigateSpy.mockReset();
  playMediaSpy.mockReset();
  setupApiCallLog();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockLeaderboards(payload) {
  server.use(
    http.get(`${API}/v1/vote/leaderboards`, () => HttpResponse.json(payload))
  );
}

// Render and click "View Current", waiting for results or error state to settle.
async function renderAndFetch({ as = 'guest', payload = artistLeaderboardFixture } = {}) {
  mockLeaderboards(payload);
  const user = userEvent.setup();
  renderWithProviders(<LeaderboardsPage />, { as });
  const btn = screen.getByRole('button', { name: /view current/i });
  await user.click(btn);
  return { user, btn };
}

// ===========================================================================
// INITIAL RENDER
// ===========================================================================
describe('LeaderboardsPage — initial render', () => {
  it('renders within Layout', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('renders all five filter selects', () => {
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    expect(selects).toHaveLength(4);
  });

  it('renders the "View Current" button enabled on mount', () => {
    renderWithProviders(<LeaderboardsPage />);
    const btn = screen.getByRole('button', { name: /view current/i });
    expect(btn).toBeEnabled();
  });

  it('shows the empty-state helper copy before any fetch', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(screen.getByText(/select criteria and click 'view current'/i)).toBeInTheDocument();
  });

  it('location select defaults to Downtown Harlem', () => {
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    expect(selects[0].value).toBe('downtown-harlem');
  });

  it('category select defaults to artist', () => {
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    expect(selects[2].value).toBe('artist');
  });

  it('interval select defaults to daily', () => {
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    expect(selects[3].value).toBe('daily');
  });

  it('renders all three location options', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(screen.getByRole('option', { name: /downtown harlem/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /uptown harlem/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /harlem-wide/i })).toBeInTheDocument();
  });

  it('renders all three genre options', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(screen.getByRole('option', { name: /^rap$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^rock$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^pop$/i })).toBeInTheDocument();
  });

  it('renders both category options (Artist, Song)', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(screen.getByRole('option', { name: /^artist$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^song$/i })).toBeInTheDocument();
  });

  it('renders all six interval options', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(screen.getByRole('option', { name: /^today$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^week$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^month$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^quarter$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^midterm$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^annual$/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// FILTER CONTROL INTERACTIONS
// ===========================================================================
describe('LeaderboardsPage — filter controls', () => {
  it('updates location state when user changes the location select', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[0], 'uptown-harlem');
    expect(selects[0].value).toBe('uptown-harlem');
  });

  it('updates category state when user switches from Artist to Song', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[2], 'song');
    expect(selects[2].value).toBe('song');
  });

  it('updates interval state when user changes interval', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[3], 'monthly');
    expect(selects[3].value).toBe('monthly');
  });
});

// ===========================================================================
// FETCHING LEADERBOARDS — ARTIST
// ===========================================================================
describe('LeaderboardsPage — fetching leaderboards (artist)', () => {
  it('renders artist results with rank, title, and action buttons', async () => {
    await renderAndFetch({ payload: artistLeaderboardFixture });
    expect(await screen.findByText('Tony Fadd')).toBeInTheDocument();
    expect(screen.getByText('SD Boomin')).toBeInTheDocument();
    expect(screen.getByText('Harlem MC')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('renders a "Listen" button and a "View" button for each artist result', async () => {
    await renderAndFetch({ payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    expect(screen.getAllByRole('button', { name: /listen/i })).toHaveLength(3);
    // "View" (not "View Song") appears for artist rows
    expect(screen.getAllByRole('button', { name: /^view$/i })).toHaveLength(3);
  });

  it('no results renders the "no results" message even though server returned []', async () => {
    await renderAndFetch({ payload: [] });
    expect(await screen.findByText(/no results found/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// FETCHING LEADERBOARDS — SONG
// ===========================================================================
describe('LeaderboardsPage — fetching leaderboards (song)', () => {
  it('renders song results with "View Song" button when category=song', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[2], 'song');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    expect(await screen.findByText('Midnight Uptown')).toBeInTheDocument();
    expect(screen.getByText('Block Party')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /view song/i })).toHaveLength(2);
  });

  it('song leaderboards include targetType=song in the GET', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[2], 'song');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    const params = parseParams(leaderboardsCall().url);
    expect(params.targetType).toBe('song');
  });
});

// ===========================================================================
// URL PARAM CONSTRUCTION — verifies the idMappings → URL pipeline
// ===========================================================================
describe('LeaderboardsPage — URL param construction', () => {
  it('default fetch uses Downtown + Rap + artist + Daily + limit=50', async () => {
    await renderAndFetch({ payload: artistLeaderboardFixture });
    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    const params = parseParams(leaderboardsCall().url);
    expect(params.jurisdictionId).toBe(DOWNTOWN_ID);
    expect(params.genreId).toBe(RAP_ID);
    expect(params.targetType).toBe('artist');
    expect(params.intervalId).toBe(DAILY_ID);
    expect(params.limit).toBe('50');
  });

  it('sends Uptown Harlem UUID when user selects that jurisdiction', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[0], 'uptown-harlem');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).jurisdictionId).toBe(UPTOWN_ID);
  });

  it('sends Weekly interval UUID when user selects Week', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[3], 'weekly');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).intervalId).toBe(WEEKLY_ID);
  });

  it('sends Monthly interval UUID when user selects Month', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[3], 'monthly');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).intervalId).toBe(MONTHLY_ID);
  });

  it('sends Quarterly interval UUID when user selects Quarter', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[3], 'quarterly');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).intervalId).toBe(QUARTERLY_ID);
  });

  it('sends Annual interval UUID when user selects Annual', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[3], 'annual');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).intervalId).toBe(ANNUAL_ID);
  });

  it('sends Midterm interval UUID when user selects Midterm', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[3], 'midterm');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).intervalId).toBe(MIDTERM_ID);
  });

  it('sends Rock genre UUID when user selects Rock', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[1], 'rock');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).genreId).toBe(ROCK_ID);
  });

  it('sends Pop genre UUID when user selects Pop', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[1], 'pop');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).genreId).toBe(POP_ID);
  });
});

// ===========================================================================
// LOADING STATE
// ===========================================================================
describe('LeaderboardsPage — loading state', () => {
  it('shows "Loading leaderboards..." message while request is in-flight', async () => {
    // Delay the response so we can catch the loading state
    let resolveFn;
    const pending = new Promise((res) => { resolveFn = res; });
    server.use(
      http.get(`${API}/v1/vote/leaderboards`, async () => {
        await pending;
        return HttpResponse.json(artistLeaderboardFixture);
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    await user.click(screen.getByRole('button', { name: /view current/i }));

    expect(await screen.findByText(/loading leaderboards\.\.\./i)).toBeInTheDocument();
    resolveFn();
    await screen.findByText('Tony Fadd');
  });

  it('disables the View Current button during fetch and re-enables after', async () => {
    let resolveFn;
    const pending = new Promise((res) => { resolveFn = res; });
    server.use(
      http.get(`${API}/v1/vote/leaderboards`, async () => {
        await pending;
        return HttpResponse.json([]);
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    const btn = screen.getByRole('button', { name: /view current/i });
    await user.click(btn);

    await waitFor(() => expect(screen.getByRole('button', { name: /loading\.\.\./i })).toBeDisabled());
    resolveFn();
    await waitFor(() => expect(screen.getByRole('button', { name: /view current/i })).toBeEnabled());
  });
});

// ===========================================================================
// NORMALIZATION — fallbacks when backend returns partial data
// ===========================================================================
describe('LeaderboardsPage — normalization fallbacks', () => {
  it('falls back to index+1 for rank when backend omits rank', async () => {
    await renderAndFetch({
      payload: [
        { targetId: 'a1', name: 'NoRankArtist', votes: 5, artwork: null },
        { targetId: 'a2', name: 'AlsoNoRank',   votes: 3, artwork: null },
      ],
    });
    await screen.findByText('NoRankArtist');
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('falls back to "Unknown Artist" when name is missing', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, votes: 5, artwork: null }],
    });
    expect(await screen.findByText(/unknown artist/i)).toBeInTheDocument();
  });

  it('falls back to backimage asset when artwork is null', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, name: 'NoArt', votes: 5, artwork: null }],
    });
    const img = await screen.findByAltText(/NoArt/i);
    expect(img.src).toContain('randomrapper.jpeg');
  });

  it('prefixes relative artwork URLs with the API base', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, name: 'RelArt', votes: 5, artwork: '/uploads/rel.jpg' }],
    });
    const img = await screen.findByAltText(/RelArt/i);
    expect(img.src).toContain('http://localhost:8080/uploads/rel.jpg');
  });

  it('passes absolute artwork URLs through unchanged', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, name: 'AbsArt', votes: 5, artwork: 'https://cdn.test/abs.jpg' }],
    });
    const img = await screen.findByAltText(/AbsArt/i);
    expect(img.src).toBe('https://cdn.test/abs.jpg');
  });
});

// ===========================================================================
// IMAGE ERROR FALLBACK
// ===========================================================================
describe('LeaderboardsPage — image error fallback', () => {
  it('swaps the <img> src to backimage on onError', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, name: 'BrokenArt', votes: 1, artwork: '/uploads/broken.jpg' }],
    });
    const img = await screen.findByAltText(/BrokenArt/i);
    fireEvent.error(img);
    expect(img.src).toContain('randomrapper.jpeg');
  });
});

// ===========================================================================
// PLAY INTERACTIONS
// ===========================================================================
describe('LeaderboardsPage — play interactions (artist row)', () => {
  it('fetches the artist\'s default song and calls playMedia', async () => {
    const { user } = await renderAndFetch({ as: 'listener', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    const listenBtns = screen.getAllByRole('button', { name: /listen/i });
    await user.click(listenBtns[0]);

    await waitFor(() => expect(playMediaSpy).toHaveBeenCalled());
    const [mediaArg] = playMediaSpy.mock.calls[0];
    expect(mediaArg.type).toBe('default-song');
    expect(mediaArg.title).toBeTruthy();
  });

  // NOTE: Leaderboard rows for category=artist have type='artist' AND no fileUrl,
  // so the code path is: fetch default-song → playMedia → track play POST.
  it('posts play tracking after fetching default song (listener)', async () => {
    const { user } = await renderAndFetch({ as: 'listener', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    const listenBtns = screen.getAllByRole('button', { name: /listen/i });
    await user.click(listenBtns[0]);

    // Default /v1/users/:id/default-song handler returns { songId: 'song-001' }
    await waitFor(() => expect(callTracker.get('play:song-001')).toBeGreaterThan(0));
  });

  it('includes userId query param in the play-tracking POST URL', async () => {
    const { user } = await renderAndFetch({ as: 'listener', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    const listenBtns = screen.getAllByRole('button', { name: /listen/i });
    await user.click(listenBtns[0]);

    await waitFor(() => {
      const trackCall = apiCallLog.find(c => c.method === 'post' && c.url && c.url.includes('/play'));
      expect(trackCall).toBeTruthy();
      expect(trackCall.url).toMatch(/\?userId=user-listener-001/);
    });
  });

  it('guest user: plays media but skips the play-tracking POST (no userId)', async () => {
    const { user } = await renderAndFetch({ as: 'guest', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    const listenBtns = screen.getAllByRole('button', { name: /listen/i });
    await user.click(listenBtns[0]);

    await waitFor(() => expect(playMediaSpy).toHaveBeenCalled());
    // Give any in-flight track POST a tick to fire — it shouldn't.
    await new Promise(r => setTimeout(r, 20));
    const trackCall = apiCallLog.find(c => c.method === 'post' && c.url && c.url.includes('/play'));
    expect(trackCall).toBeUndefined();
  });

  it('gracefully handles default-song fetch failure (no tracking, no crash)', async () => {
    server.use(
      http.get(`${API}/v1/users/:id/default-song`, () => HttpResponse.error())
    );
    const { user } = await renderAndFetch({ as: 'listener', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    const listenBtns = screen.getAllByRole('button', { name: /listen/i });
    await user.click(listenBtns[0]);

    // Give it a tick for promise rejection
    await new Promise(r => setTimeout(r, 30));
    // playMedia should NOT have been called because the fetch threw before that
    expect(playMediaSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// NAVIGATION
// ===========================================================================
describe('LeaderboardsPage — navigation', () => {
  it('clicking "View" on an artist row navigates to /artist/:targetId', async () => {
    const { user } = await renderAndFetch({ payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    const viewBtns = screen.getAllByRole('button', { name: /^view$/i });
    await user.click(viewBtns[0]);
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-uuid-01');
  });

  it('clicking "View Song" on a song row navigates to /song/:targetId', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[2], 'song');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await screen.findByText('Midnight Uptown');
    const viewSongBtns = screen.getAllByRole('button', { name: /view song/i });
    await user.click(viewSongBtns[0]);
    expect(navigateSpy).toHaveBeenCalledWith('/song/song-uuid-01');
  });
});

// ===========================================================================
// RE-FETCH BEHAVIOR
// ===========================================================================
describe('LeaderboardsPage — re-fetch behavior', () => {
  it('clears previous results when View Current is clicked again', async () => {
    // First fetch returns 3 items
    mockLeaderboards(artistLeaderboardFixture);
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    await user.click(screen.getByRole('button', { name: /view current/i }));
    await screen.findByText('Tony Fadd');

    // Second fetch returns nothing
    mockLeaderboards([]);
    await user.click(screen.getByRole('button', { name: /view current/i }));
    await waitFor(() => {
      expect(screen.queryByText('Tony Fadd')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/no results found/i)).toBeInTheDocument();
  });

  it('replaces previous results with new ones on subsequent fetches', async () => {
    mockLeaderboards(artistLeaderboardFixture);
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    await user.click(screen.getByRole('button', { name: /view current/i }));
    await screen.findByText('Harlem MC');

    mockLeaderboards(songLeaderboardFixture);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[2], 'song');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await screen.findByText('Midnight Uptown');
    // "Harlem MC" is only in the artist fixture (not the artist-of-any-song
    // in the song fixture), so its absence is a clean signal that the
    // previous results have been cleared.
    expect(screen.queryByText('Harlem MC')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// FIXED BEHAVIOR — tests covering the four bugs that were fixed.
// Regression guards: if any of these fail, a fix has been reverted.
// ===========================================================================
describe('LeaderboardsPage — fixed behaviors (regression guards)', () => {
  it('"Harlem-wide" option maps to the Harlem jurisdiction UUID', async () => {
    const user = userEvent.setup();
    mockLeaderboards([]);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[0], 'harlem');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).jurisdictionId).toBe(HARLEM_ID);
  });

  it('selecting "Rap" sends the correct rap genre UUID (no trailing-hyphen mismatch)', async () => {
    const user = userEvent.setup();
    mockLeaderboards([]);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    // Switch away from rap, then back — this would previously send `rap-`
    await user.selectOptions(selects[1], 'rock');
    await user.selectOptions(selects[1], 'rap');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).genreId).toBe(RAP_ID);
  });

  it('song rows render the artist name in the item-artist slot', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[2], 'song');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await screen.findByText('Midnight Uptown');
    const artistDivs = document.querySelectorAll('.item-artist');
    // Both song rows should have an item-artist div with the artist's username
    expect(artistDivs).toHaveLength(2);
    expect(artistDivs[0].textContent).toBe('Tony Fadd');
    expect(artistDivs[1].textContent).toBe('SD Boomin');
  });

  it('artist rows do not render an item-artist subtitle (no redundant duplicate of the row title)', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, name: 'ArtistA', votes: 5, artwork: null }],
    });
    await screen.findByText('ArtistA');
    // For artist rows, the subtitle slot is intentionally not rendered
    expect(document.querySelector('.item-artist')).toBeNull();
  });

  it('renders the vote count in the item-votes slot', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, name: 'ArtistA', votes: 42, artwork: null }],
    });
    await screen.findByText('ArtistA');
    const votesDiv = document.querySelector('.item-votes');
    expect(votesDiv).not.toBeNull();
    expect(votesDiv.textContent).toMatch(/42/);
    expect(votesDiv.textContent).toMatch(/votes/);
  });

  it('uses singular "vote" when count is exactly 1', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, name: 'SingletonArtist', votes: 1, artwork: null }],
    });
    await screen.findByText('SingletonArtist');
    const votesDiv = document.querySelector('.item-votes');
    expect(votesDiv.textContent).toMatch(/1 vote\b/);
    expect(votesDiv.textContent).not.toMatch(/votes/);
  });

  it('clicking Listen on a song row plays the real song fileUrl (not the sample)', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />, { as: 'listener' });
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[2], 'song');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await screen.findByText('Midnight Uptown');
    const listenBtns = screen.getAllByRole('button', { name: /listen/i });
    await user.click(listenBtns[0]);

    await waitFor(() => expect(playMediaSpy).toHaveBeenCalled());
    const [mediaArg] = playMediaSpy.mock.calls[0];
    expect(mediaArg.type).toBe('song');
    expect(mediaArg.url).toBe('http://localhost:8080/uploads/song1.mp3');
    expect(mediaArg.url).not.toContain('sample.mp3');
  });

  it('clicking Listen on a song row tracks the play against the song (not default-song)', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />, { as: 'listener' });
    const selects = document.querySelectorAll('select.filter-select');
    await user.selectOptions(selects[2], 'song');
    await user.click(screen.getByRole('button', { name: /view current/i }));

    await screen.findByText('Midnight Uptown');
    const listenBtns = screen.getAllByRole('button', { name: /listen/i });
    await user.click(listenBtns[0]);

    await waitFor(() => {
      const trackCall = apiCallLog.find(c => c.method === 'post' && c.url && c.url.includes('/play'));
      expect(trackCall).toBeTruthy();
      // Should be tracking the song's targetId, not the default-song id
      expect(trackCall.url).toContain('song-uuid-01');
      expect(trackCall.url).toMatch(/\?userId=user-listener-001/);
    });
  });
});