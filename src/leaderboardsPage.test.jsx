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
//   • handlePlay: song-with-fileUrl path (requestPlay with the real file)
//   • handlePlay: artist path (fetch /v1/users/:id/default-song → requestPlay)
//   • handleView navigation (button, artwork click, info click)
//   • Normalization fallbacks (rank, name, points, artwork)
//   • Accessibility contract (labelled selects, type="button")
//   • Regression guards for fixed production bugs:
//       1. "Harlem-wide" dropdown value correctly maps to HARLEM_ID
//       2. "Rap" dropdown value no longer has trailing hyphen
//       3. item-artist slot shows artist name on song rows only
//       4. item-votes slot renders points with singular/plural
//       5. Song rows play the real fileUrl — the bundled sample MP3
//          fallback has been removed entirely
//       6. NO page-level play-tracking POST fires at click time. Play
//          tracking is owned by the Player (★ PLAY-FLOW, 15s listening
//          gate). The old click-time POST recorded zero-listen plays and
//          won the backend's 30-min cooldown race against the player's
//          legitimate sourced POST. Tracks carry source: 'leaderboards'
//          so the player's POST attributes correctly.
//
// Pattern notes:
//   • Uses vi.hoisted for navigateSpy + requestPlaySpy so vi.mock factories
//     see them.
//   • Uses the apiCallLog pattern (see feed.test.jsx) to assert URL params
//     without depending on MSW implementation details.
//   • Uses server.use() to override the default leaderboards handler.
//   • cacheService.clearAll() in beforeEach — belt-and-suspenders for the
//     default-song endpoint, which axiosInstance can cache.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
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

// Navigation spy — hoisted so it's available when vi.mock runs
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

// PlayerContext mock — the component consumes requestPlay (the PlayChoiceModal
// entry point), never playMedia directly.
const { requestPlaySpy } = vi.hoisted(() => ({ requestPlaySpy: vi.fn() }));
vi.mock('./context/playercontext', async () => {
  const actual = await vi.importActual('./context/playercontext');
  const React = require('react');
  return {
    ...actual,
    PlayerContext: React.createContext({ requestPlay: requestPlaySpy }),
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

// Shape matches backend LeaderboardDto: { rank, name, votes, artwork, artist?, targetId, fileUrl? }
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
function playTrackingCall() {
  return apiCallLog.find(c => c.method === 'post' && c.url && c.url.includes('/play'));
}
// Segmented controls replaced the four native <select> elements. These
// helpers keep the behavioural assertions identical while targeting the
// new markup.
function seg(name, value) {
  return screen.getByTestId(`${name}-${value}`);
}
function activeSeg(name) {
  const group = document.querySelectorAll(`[data-testid^="${name}-"]`);
  return Array.from(group).find(b => b.classList.contains('is-active'));
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
  requestPlaySpy.mockReset();
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
  const btn = screen.getByRole('button', { name: /show standings/i });
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

  it('renders all four segmented control groups', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(document.querySelectorAll('.lb-segmented')).toHaveLength(4);
  });

  it('renders the "Show standings" button enabled on mount', () => {
    renderWithProviders(<LeaderboardsPage />);
    const btn = screen.getByRole('button', { name: /show standings/i });
    expect(btn).toBeEnabled();
  });

  it('shows an inviting empty state before any fetch', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(screen.getByText(/pick a scope/i)).toBeInTheDocument();
    expect(screen.getByText(/then show the standings/i)).toBeInTheDocument();
  });

  it('jurisdiction defaults to Downtown Harlem', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(activeSeg('jurisdiction')).toBe(seg('jurisdiction', 'downtown-harlem'));
  });

  it('category defaults to artist', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(activeSeg('category')).toBe(seg('category', 'artist'));
  });

  it('interval defaults to daily', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(activeSeg('interval')).toBe(seg('interval', 'daily'));
  });

  it('renders all three jurisdiction segments', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(seg('jurisdiction', 'downtown-harlem')).toBeInTheDocument();
    expect(seg('jurisdiction', 'uptown-harlem')).toBeInTheDocument();
    expect(seg('jurisdiction', 'harlem')).toBeInTheDocument();
  });

  it('renders all three genre segments', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(seg('genre', 'rap')).toBeInTheDocument();
    expect(seg('genre', 'rock')).toBeInTheDocument();
    expect(seg('genre', 'pop')).toBeInTheDocument();
  });

  it('renders both category segments (Artist, Song)', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(seg('category', 'artist')).toBeInTheDocument();
    expect(seg('category', 'song')).toBeInTheDocument();
  });

  it('renders all six interval segments ("Half" label for the midterm interval)', () => {
    renderWithProviders(<LeaderboardsPage />);
    ['daily', 'weekly', 'monthly', 'quarterly', 'midterm', 'annual']
      .forEach(v => expect(seg('interval', v)).toBeInTheDocument());
    expect(seg('interval', 'midterm')).toHaveTextContent(/^half$/i);
  });
});

// ===========================================================================
// ACCESSIBILITY CONTRACT
// ===========================================================================
describe('LeaderboardsPage — accessibility', () => {
  it('every segmented control group has an accessible name', () => {
    renderWithProviders(<LeaderboardsPage />);
    expect(screen.getByRole('group', { name: /jurisdiction/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /genre/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /category/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /time period/i })).toBeInTheDocument();
  });

  it('every button carries type="button" (no implicit submit behavior)', async () => {
    await renderAndFetch({ payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(b => expect(b.getAttribute('type')).toBe('button'));
  });

  it('the loading state is announced via role="status"', async () => {
    server.use(
      http.get(`${API}/v1/vote/leaderboards`, async () => {
        await new Promise(r => setTimeout(r, 60));
        return HttpResponse.json([]);
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    await user.click(screen.getByRole('button', { name: /show standings/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/counting the votes and plays/i);
  });

  it('the error state is announced via role="alert"', async () => {
    await renderAndFetch({ payload: [] });
    expect(await screen.findByRole('alert')).toHaveTextContent(/nothing has scored in this scope yet/i);
  });
});

// ===========================================================================
// FILTER CONTROL INTERACTIONS
// ===========================================================================
describe('LeaderboardsPage — filter controls', () => {
  it('updates jurisdiction state when user picks another jurisdiction', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('jurisdiction', 'uptown-harlem'));
    expect(activeSeg('jurisdiction')).toBe(seg('jurisdiction', 'uptown-harlem'));
    expect(seg('jurisdiction', 'uptown-harlem')).toHaveAttribute('aria-pressed', 'true');
  });

  it('updates category state when user switches from Artist to Song', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('category', 'song'));
    expect(activeSeg('category')).toBe(seg('category', 'song'));
  });

  it('updates interval state when user changes interval', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('interval', 'monthly'));
    expect(activeSeg('interval')).toBe(seg('interval', 'monthly'));
  });
});

// ===========================================================================
// FETCHING LEADERBOARDS — ARTIST
// ===========================================================================
describe('LeaderboardsPage — fetching leaderboards (artist)', () => {
  it('promotes rank 1 to the leader plate and puts the rest in the chase rail', async () => {
    await renderAndFetch({ payload: artistLeaderboardFixture });
    // Leader
    expect(await screen.findByRole('heading', { name: 'Tony Fadd' })).toBeInTheDocument();
    expect(document.querySelector('.lb-leader-figure').textContent).toBe('42');
    // Chase — 2 rows for a 3-item payload
    const rows = document.querySelectorAll('.lb-chase-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.lb-chase-title').textContent).toBe('SD Boomin');
    expect(rows[1].querySelector('.lb-chase-title').textContent).toBe('Harlem MC');
    // Ranks continue from 2
    expect(rows[0].querySelector('.lb-chase-rank').textContent).toBe('2');
    expect(rows[1].querySelector('.lb-chase-rank').textContent).toBe('3');
  });

  it('states the leader\'s margin over the runner-up', async () => {
    await renderAndFetch({ payload: artistLeaderboardFixture });
    await screen.findByRole('heading', { name: 'Tony Fadd' });
    // 42 - 31 = 11
    expect(screen.getByText(/ahead by 11 points/i)).toBeInTheDocument();
  });

  it('uses singular "point" when the margin is exactly 1', async () => {
    await renderAndFetch({
      payload: [
        { targetId: 'a1', rank: 1, name: 'Leader', votes: 10, artwork: null },
        { targetId: 'a2', rank: 2, name: 'Chaser', votes: 9,  artwork: null },
      ],
    });
    await screen.findByRole('heading', { name: 'Leader' });
    expect(screen.getByText(/ahead by 1 point\b/i)).toBeInTheDocument();
  });

  it('names the tie when leader and runner-up are level', async () => {
    await renderAndFetch({
      payload: [
        { targetId: 'a1', rank: 1, name: 'Leader', votes: 20, artwork: null },
        { targetId: 'a2', rank: 2, name: 'Chaser', votes: 20, artwork: null },
      ],
    });
    await screen.findByRole('heading', { name: 'Leader' });
    expect(screen.getByText(/tied with chaser/i)).toBeInTheDocument();
  });

  it('a lone entry reads as uncontested and renders no chase rail', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, name: 'OnlyOne', votes: 7, artwork: null }],
    });
    await screen.findByRole('heading', { name: 'OnlyOne' });
    expect(screen.getByText(/uncontested so far/i)).toBeInTheDocument();
    expect(document.querySelector('.lb-chase')).toBeNull();
  });

  it('gives the leader Listen + View artist, and every chase row a play control', async () => {
    await renderAndFetch({ payload: artistLeaderboardFixture });
    await screen.findByRole('heading', { name: 'Tony Fadd' });
    expect(screen.getByRole('button', { name: /^listen$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view artist/i })).toBeInTheDocument();
    // Chase rows carry an icon play button, labelled per entry
    expect(screen.getByRole('button', { name: /listen to SD Boomin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /listen to Harlem MC/i })).toBeInTheDocument();
  });

  it('an empty payload renders direction, not a bare error', async () => {
    await renderAndFetch({ payload: [] });
    expect(await screen.findByText(/no standings yet/i)).toBeInTheDocument();
    expect(screen.getByText(/try a wider jurisdiction or a longer period/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// FETCHING LEADERBOARDS — SONG
// ===========================================================================
describe('LeaderboardsPage — fetching leaderboards (song)', () => {
  it('renders song results with a "View song" action when category=song', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('category', 'song'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    expect(await screen.findByRole('heading', { name: 'Midnight Uptown' })).toBeInTheDocument();
    expect(screen.getByText('Block Party')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view song/i })).toBeInTheDocument();
  });

  it('song leaderboards include targetType=song in the GET', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('category', 'song'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

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
    await user.click(seg('jurisdiction', 'uptown-harlem'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).jurisdictionId).toBe(UPTOWN_ID);
  });

  it('sends Weekly interval UUID when user selects Week', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('interval', 'weekly'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).intervalId).toBe(WEEKLY_ID);
  });

  it('sends Monthly interval UUID when user selects Month', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('interval', 'monthly'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).intervalId).toBe(MONTHLY_ID);
  });

  it('sends Quarterly interval UUID when user selects Quarter', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('interval', 'quarterly'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).intervalId).toBe(QUARTERLY_ID);
  });

  it('sends Annual interval UUID when user selects Annual', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('interval', 'annual'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).intervalId).toBe(ANNUAL_ID);
  });

  it('sends Midterm interval UUID when user selects Half', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('interval', 'midterm'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).intervalId).toBe(MIDTERM_ID);
  });

  it('sends Rock genre UUID when user selects Rock', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('genre', 'rock'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).genreId).toBe(ROCK_ID);
  });

  it('sends Pop genre UUID when user selects Pop', async () => {
    const user = userEvent.setup();
    mockLeaderboards(artistLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('genre', 'pop'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).genreId).toBe(POP_ID);
  });
});

// ===========================================================================
// LOADING STATE
// ===========================================================================
describe('LeaderboardsPage — loading state', () => {
  it('shows the counting message while the request is in flight', async () => {
    server.use(
      http.get(`${API}/v1/vote/leaderboards`, async () => {
        await new Promise(r => setTimeout(r, 80));
        return HttpResponse.json(artistLeaderboardFixture);
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    expect(await screen.findByText(/counting the votes and plays/i)).toBeInTheDocument();
    // And it resolves into results
    expect(await screen.findByRole('heading', { name: 'Tony Fadd' })).toBeInTheDocument();
  });

  it('disables the View Current button during fetch and re-enables after', async () => {
    server.use(
      http.get(`${API}/v1/vote/leaderboards`, async () => {
        await new Promise(r => setTimeout(r, 80));
        return HttpResponse.json(artistLeaderboardFixture);
      })
    );
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    const btn = screen.getByRole('button', { name: /show standings/i });
    await user.click(btn);

    await waitFor(() => expect(screen.getByRole('button', { name: /^loading$/i })).toBeDisabled());
    await screen.findByRole('heading', { name: 'Tony Fadd' });
    expect(screen.getByRole('button', { name: /show standings/i })).toBeEnabled();
  });
});

// ===========================================================================
// NORMALIZATION FALLBACKS
// ===========================================================================
describe('LeaderboardsPage — normalization fallbacks', () => {
  it('falls back to index+1 for rank when backend omits rank', async () => {
    await renderAndFetch({
      payload: [
        { targetId: 'a1', name: 'NoRankArtist', votes: 5, artwork: null },
        { targetId: 'a2', name: 'AlsoNoRank',   votes: 3, artwork: null },
        { targetId: 'a3', name: 'ThirdPlace',   votes: 1, artwork: null },
      ],
    });
    await screen.findByRole('heading', { name: 'NoRankArtist' });
    const ranks = Array.from(document.querySelectorAll('.lb-chase-rank')).map(n => n.textContent);
    expect(ranks).toEqual(['2', '3']);
  });

  it('falls back to "Unknown Artist" when name is missing', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, votes: 5, artwork: null }],
    });
    expect(await screen.findByRole('heading', { name: /unknown artist/i })).toBeInTheDocument();
  });

  it('falls back to backimage asset when artwork is null', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, name: 'NoArt', votes: 5, artwork: null }],
    });
    const img = await screen.findByAltText(/NoArt/i);
    expect(img.src).toContain('randomrapper.jpeg');
  });

  it('prefixes relative artwork URLs with the media base (shared buildUrl)', async () => {
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
// PLAY INTERACTIONS — the Player owns tracking; this page only requests play
// ===========================================================================
describe('LeaderboardsPage — play interactions (artist row)', () => {
  it("fetches the artist's default song and hands it to requestPlay", async () => {
    const { user } = await renderAndFetch({ as: 'listener', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    const listenBtns = screen.getAllByRole('button', { name: /listen/i });
    await user.click(listenBtns[0]);

    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
    const [track] = requestPlaySpy.mock.calls[0];
    // Default /v1/users/:id/default-song handler → { songId: 'song-001', fileUrl: '/uploads/test.mp3' }
    expect(track.type).toBe('song');
    expect(track.songId).toBe('song-001');
    expect(track.url).toContain('/uploads/test.mp3');
    expect(track.artist).toBe('Tony Fadd');
    expect(track.artistId).toBe('artist-uuid-01');
  });

  it("tracks carry source: 'leaderboards' so the player's play POST attributes correctly", async () => {
    const { user } = await renderAndFetch({ as: 'listener', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    await user.click(screen.getAllByRole('button', { name: /listen/i })[0]);

    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
    expect(requestPlaySpy.mock.calls[0][0].source).toBe('leaderboards');
  });

  it('REGRESSION GUARD: no page-level play-tracking POST fires at click time (listener)', async () => {
    // The old implementation POSTed /play immediately on click — before the
    // PlayChoiceModal resolved and before a single second was listened —
    // minting zero-listen plays and pre-empting the Player's gated POST via
    // the backend's 30-minute cooldown. Tracking now belongs to the Player.
    const { user } = await renderAndFetch({ as: 'listener', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    await user.click(screen.getAllByRole('button', { name: /listen/i })[0]);

    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 30));
    expect(playTrackingCall()).toBeUndefined();
  });

  it('guest user: requestPlay is still called (Player handles guest gating)', async () => {
    const { user } = await renderAndFetch({ as: 'guest', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    await user.click(screen.getAllByRole('button', { name: /listen/i })[0]);

    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 20));
    expect(playTrackingCall()).toBeUndefined();
  });

  it('gracefully handles default-song fetch failure (no play request, no crash)', async () => {
    server.use(
      http.get(`${API}/v1/users/:id/default-song`, () => HttpResponse.error())
    );
    const { user } = await renderAndFetch({ as: 'listener', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    await user.click(screen.getAllByRole('button', { name: /listen/i })[0]);

    await new Promise(r => setTimeout(r, 30));
    expect(requestPlaySpy).not.toHaveBeenCalled();
  });

  it('artist with no default song: requestPlay is not called (no sample fallback)', async () => {
    server.use(
      http.get(`${API}/v1/users/:id/default-song`, () => HttpResponse.json({ songId: null, fileUrl: null }))
    );
    const { user } = await renderAndFetch({ as: 'listener', payload: artistLeaderboardFixture });
    await screen.findByText('Tony Fadd');
    await user.click(screen.getAllByRole('button', { name: /listen/i })[0]);

    await new Promise(r => setTimeout(r, 30));
    expect(requestPlaySpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// NAVIGATION
// ===========================================================================
describe('LeaderboardsPage — navigation', () => {
  it('clicking "View artist" on the leader plate navigates to /artist/:targetId', async () => {
    const { user } = await renderAndFetch({ payload: artistLeaderboardFixture });
    await screen.findByRole('heading', { name: 'Tony Fadd' });
    await user.click(screen.getByRole('button', { name: /view artist/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-uuid-01');
  });

  it('clicking "View song" on the leader plate navigates to /song/:targetId', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('category', 'song'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await screen.findByRole('heading', { name: 'Midnight Uptown' });
    await user.click(screen.getByRole('button', { name: /view song/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/song/song-uuid-01');
  });

  it('clicking a chase row opens that entry', async () => {
    const { user } = await renderAndFetch({ payload: artistLeaderboardFixture });
    await screen.findByRole('heading', { name: 'Tony Fadd' });
    await user.click(screen.getByRole('button', { name: /open SD Boomin/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-uuid-02');
  });

  it('chase rows for songs open the song page', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('category', 'song'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await screen.findByRole('heading', { name: 'Midnight Uptown' });
    await user.click(screen.getByRole('button', { name: /open Block Party/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/song/song-uuid-02');
  });
});

// ===========================================================================
// RE-FETCH BEHAVIOR
// ===========================================================================
describe('LeaderboardsPage — re-fetch behavior', () => {
  it('clears previous results when Show standings is clicked again', async () => {
    // First fetch returns 3 items
    mockLeaderboards(artistLeaderboardFixture);
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    await user.click(screen.getByRole('button', { name: /show standings/i }));
    await screen.findByRole('heading', { name: 'Tony Fadd' });

    // Second fetch returns nothing
    mockLeaderboards([]);
    await user.click(screen.getByRole('button', { name: /show standings/i }));
    await waitFor(() => {
      expect(screen.queryByText('Tony Fadd')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/no standings yet/i)).toBeInTheDocument();
  });

  it('replaces previous results with new ones on subsequent fetches', async () => {
    mockLeaderboards(artistLeaderboardFixture);
    const user = userEvent.setup();
    renderWithProviders(<LeaderboardsPage />);
    await user.click(screen.getByRole('button', { name: /show standings/i }));
    await screen.findByText('Harlem MC');


    mockLeaderboards(songLeaderboardFixture);
    await user.click(seg('category', 'song'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await screen.findByRole('heading', { name: 'Midnight Uptown' });
    // "Harlem MC" is only in the artist fixture (not the artist-of-any-song
    // in the song fixture), so its absence is a clean signal that the
    // previous results have been cleared.
    expect(screen.queryByText('Harlem MC')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// FIXED BEHAVIOR — regression guards.
// If any of these fail, a fix has been reverted.
// ===========================================================================
describe('LeaderboardsPage — fixed behaviors (regression guards)', () => {
  it('"Harlem-wide" option maps to the Harlem jurisdiction UUID', async () => {
    const user = userEvent.setup();
    mockLeaderboards([]);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('jurisdiction', 'harlem'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).jurisdictionId).toBe(HARLEM_ID);
  });

  it('selecting "Rap" sends the correct rap genre UUID (no trailing-hyphen mismatch)', async () => {
    const user = userEvent.setup();
    mockLeaderboards([]);
    renderWithProviders(<LeaderboardsPage />);
    // Switch away from rap, then back — this would previously send `rap-`
    await user.click(seg('genre', 'rock'));
    await user.click(seg('genre', 'rap'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await waitFor(() => expect(leaderboardsCall()).toBeTruthy());
    expect(parseParams(leaderboardsCall().url).genreId).toBe(RAP_ID);
  });

  it('song entries render the artist name on both the plate and the chase rail', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />);
    await user.click(seg('category', 'song'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await screen.findByRole('heading', { name: 'Midnight Uptown' });
    expect(document.querySelector('.lb-leader-artist').textContent).toBe('Tony Fadd');
    expect(document.querySelector('.lb-chase-artist').textContent).toBe('SD Boomin');
  });

  it('artist entries do not render an artist subtitle (no redundant duplicate of the title)', async () => {
    await renderAndFetch({ payload: artistLeaderboardFixture });
    await screen.findByRole('heading', { name: 'Tony Fadd' });
    expect(document.querySelector('.lb-leader-artist')).toBeNull();
    expect(document.querySelector('.lb-chase-artist')).toBeNull();
  });

  it('labels the score "points" (votes+plays — the old "votes" label was inaccurate)', async () => {
    await renderAndFetch({ payload: artistLeaderboardFixture });
    await screen.findByRole('heading', { name: 'Tony Fadd' });
    expect(document.querySelector('.lb-leader-figure').textContent).toBe('42');
    expect(document.querySelector('.lb-leader-unit').textContent).toMatch(/points/i);
    expect(document.querySelector('.lb-chase-unit').textContent).toMatch(/pts/i);
  });

  it('thousands separators are applied to large scores', async () => {
    await renderAndFetch({
      payload: [{ targetId: 'a1', rank: 1, name: 'BigNumbers', votes: 12345, artwork: null }],
    });
    await screen.findByRole('heading', { name: 'BigNumbers' });
    expect(document.querySelector('.lb-leader-figure').textContent).toBe('12,345');
  });

  it('a zero-point chase entry shows a blank cell, not a "0"', async () => {
    await renderAndFetch({
      payload: [
        { targetId: 'a1', rank: 1, name: 'Leader', votes: 8, artwork: null },
        { targetId: 'a2', rank: 2, name: 'Nothing', votes: 0, artwork: null },
      ],
    });
    await screen.findByRole('heading', { name: 'Leader' });
    const row = document.querySelectorAll('.lb-chase-row')[0];
    expect(row.querySelector('.lb-chase-points').textContent.trim()).toBe('');
    // and no bar fill is drawn
    expect(row.querySelector('.lb-chase-fill')).toBeNull();
  });

  it('SIGNATURE: chase bars are measured against the leader, not the total', async () => {
    await renderAndFetch({
      payload: [
        { targetId: 'a1', rank: 1, name: 'Leader', votes: 100, artwork: null },
        { targetId: 'a2', rank: 2, name: 'Close',  votes: 90,  artwork: null },
        { targetId: 'a3', rank: 3, name: 'Distant', votes: 20, artwork: null },
      ],
    });
    await screen.findByRole('heading', { name: 'Leader' });
    const fills = document.querySelectorAll('.lb-chase-fill');
    // share-of-leader: 90/100 and 20/100. Share-of-total would be 90/210 = 43%.
    expect(fills[0].style.width).toBe('90%');
    expect(fills[1].style.width).toBe('20%');
  });

  it('clicking Listen on a song row plays the real song fileUrl (sample MP3 fallback removed)', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />, { as: 'listener' });
    await user.click(seg('category', 'song'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await screen.findByText('Midnight Uptown');
    const listenBtns = screen.getAllByRole('button', { name: /listen/i });
    await user.click(listenBtns[0]);

    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
    const [track] = requestPlaySpy.mock.calls[0];
    expect(track.type).toBe('song');
    expect(track.id).toBe('song-uuid-01');
    expect(track.url).toBe('http://localhost:8080/uploads/song1.mp3');
    expect(track.url).not.toContain('sample.mp3');
    expect(track.source).toBe('leaderboards');
  });

  it('REGRESSION GUARD: song-row Listen does not fetch default-song and does not POST /play', async () => {
    const user = userEvent.setup();
    mockLeaderboards(songLeaderboardFixture);
    renderWithProviders(<LeaderboardsPage />, { as: 'listener' });
    await user.click(seg('category', 'song'));
    await user.click(screen.getByRole('button', { name: /show standings/i }));

    await screen.findByText('Midnight Uptown');
    await user.click(screen.getAllByRole('button', { name: /listen/i })[0]);

    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 30));
    // Song rows have a fileUrl — no default-song lookup should occur
    expect(apiCallLog.find(c => c.url && c.url.includes('default-song'))).toBeUndefined();
    // And no page-level tracking POST — the Player owns tracking
    expect(playTrackingCall()).toBeUndefined();
  });
});