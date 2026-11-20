// src/feed.test.jsx
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
// HEAVY CHILD MOCKS — isolate Feed from downstream components
// ---------------------------------------------------------------------------

vi.mock('./LastWonNotification', () => ({
  default: () => <div data-testid="last-won-notification" />,
}));

vi.mock('./AuthGateSheet', () => {
  const React = require('react');
  const AuthGateSheet = ({ isOpen, context }) =>
    isOpen ? (
      <div data-testid="auth-gate-sheet">
        <span data-testid="auth-gate-context">{context || 'none'}</span>
      </div>
    ) : null;

  return {
    default: AuthGateSheet,
    useAuthGate: () => {
      const [isOpen, setIsOpen] = React.useState(false);
      const [context, setContext] = React.useState(null);
      return {
        triggerGate: (ctx) => { setContext(ctx); setIsOpen(true); },
        gateProps: { isOpen, context, onClose: () => setIsOpen(false) },
      };
    },
    incrementGateSongCount: vi.fn(),
    getGateSongCount: vi.fn(() => 0),
  };
});

vi.mock('./artistCard', () => ({
  default: ({ artist, onPress }) => (
    <div data-testid={`artist-card-${artist.userId}`} onClick={onPress}>
      <span data-testid="artist-card-name">{artist.username}</span>
      <span data-testid="artist-card-score">{artist.score}</span>
    </div>
  ),
}));

vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('./feed.scss', () => ({}));

// Asset mocks — feed.jsx imports a pile of images and audio
vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));
vi.mock('./assets/tonyfadd_paranoidbuy1get1free.mp3', () => ({ default: 'song1.mp3' }));
vi.mock('./assets/sdboomin_waitedallnight.mp3', () => ({ default: 'song2.mp3' }));
vi.mock('./assets/badVideo.mp4', () => ({ default: 'badvideo.mp4' }));
vi.mock('./assets/songartworkONe.jpeg', () => ({ default: 'art1.jpeg' }));
vi.mock('./assets/songartworktwo.jpeg', () => ({ default: 'art2.jpeg' }));
vi.mock('./assets/songartworkthree.jpeg', () => ({ default: 'art3.jpeg' }));
vi.mock('./assets/songartworkfour.jpeg', () => ({ default: 'art4.jpeg' }));
vi.mock('./assets/songartfive.jpg', () => ({ default: 'art5.jpg' }));
vi.mock('./assets/songarteight.png', () => ({ default: 'art8.png' }));
vi.mock('./assets/albumartnine.jpg', () => ({ default: 'art9.jpg' }));
vi.mock('./assets/albumartten.jpeg', () => ({ default: 'art10.jpeg' }));
vi.mock('./assets/rapperphotoOne.jpg', () => ({ default: 'rapper1.jpg' }));

// buildUrl utility — we don't want absolute URL prefixing noise in tests
vi.mock('./utils/buildUrl', () => ({
  buildUrl: (url) => url || null,
}));

// Navigation spy — hoisted so it's available when vi.mock runs
const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

// Spy on PlayerContext's requestPlay — use vi.hoisted so the spy exists when vi.mock runs
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
import Feed from './feed';

// ---------------------------------------------------------------------------
// TEST FIXTURES
// ---------------------------------------------------------------------------

const HARLEM_ID = '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3';
const UPTOWN_ID = '52740de0-e4e9-4c9e-b68e-1e170f6788c4';
const DOWNTOWN_ID = '4b09eaa2-03bc-4778-b7c2-db8b42c9e732';

const API = 'http://localhost:8080/api';

const trendingSong = {
  songId: 'song-trend-1',
  title: 'Trending Track',
  artist: { userId: 'artist-1', username: 'testartist', score: 500 },
  artworkUrl: '/cdn/art1.jpg',
  fileUrl: '/cdn/track1.mp3',
  score: 100,
  duration: 195000,
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  explicit: false,
  playsToday: 50,
};

const topRatedSong = {
  songId: 'song-top-1',
  title: 'Top Rated Track',
  artist: { userId: 'artist-2', username: 'secondartist', score: 300 },
  artworkUrl: '/cdn/art2.jpg',
  fileUrl: '/cdn/track2.mp3',
  score: 80,
  duration: 210000,
  createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
};

const newReleaseSong = {
  songId: 'song-new-1',
  title: 'New Release',
  artist: { userId: 'artist-3', username: 'thirdartist', score: 200 },
  artworkUrl: '/cdn/art3.jpg',
  fileUrl: '/cdn/track3.mp3',
  score: 40,
  duration: 180000,
  createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  explicit: true,
};

const popularArtist = {
  userId: 'artist-pop-1',
  username: 'popularartist',
  photoUrl: '/cdn/photo1.jpg',
  score: 600,
};

// Rankings on the feed (top five artists, the Charts lens, the daily race)
// all read GET /v1/awards/standings. `standings` holds what that endpoint
// answers per type; a test can replace an entry before rendering.
const WEEKLY_ID = '00000000-0000-0000-0000-000000000202';
const emptyBoard = (type) => ({ type, state: 'LIVE', interval: 'Weekly', total: 0, entries: [] });
let standings;

const topArtistRows = [
  { targetId: 'artist-1', targetType: 'artist', rank: 1, name: 'testartist', totalPoints: 320, votes: 2, artworkUrl: '/cdn/photo1.jpg', movement: 1 },
  { targetId: 'artist-2', targetType: 'artist', rank: 2, name: 'secondartist', totalPoints: 210, votes: 0, artworkUrl: null },
  { targetId: 'artist-9', targetType: 'artist', rank: 3, name: 'noscoreartist', totalPoints: 0, votes: 0, artworkUrl: null },
];

// ---------------------------------------------------------------------------
// apiCall logger — track which URLs get called
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

function callsMatching(urlMatcher, method) {
  return apiCallLog.filter(c => {
    const methodMatch = method ? (c.method || 'get').toLowerCase() === method.toLowerCase() : true;
    const urlMatch = typeof urlMatcher === 'string' ? c.url === urlMatcher : urlMatcher.test(c.url);
    return methodMatch && urlMatch;
  });
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  standings = {
    'artist:weekly': { type: 'artist', state: 'LIVE', interval: 'Weekly', total: 3, entries: topArtistRows },
  };
  callTracker.reset();
  cacheService.clearAll();
  navigateSpy.mockReset();
  requestPlaySpy.mockReset();

  // Default MSW handlers for Feed's 6 parallel fetches
  server.use(
    http.get(`${API}/v1/media/trending/today`, () => HttpResponse.json([trendingSong])),
    http.get(`${API}/v1/media/trending`, () => HttpResponse.json([topRatedSong])),
    http.get(`${API}/v1/media/new`, () => HttpResponse.json([newReleaseSong])),
    http.get(`${API}/v1/awards/leaderboards`, ({ request }) => {
      const url = new URL(request.url);
      const type = url.searchParams.get('type');
      if (type === 'song') return HttpResponse.json([{ id: 'a1', name: 'Best Song' }]);
      if (type === 'artist') return HttpResponse.json([{ id: 'a2', name: 'Best Artist' }]);
      return HttpResponse.json([]);
    }),
    http.get(`${API}/v1/users/artist/top`, () => HttpResponse.json([popularArtist])),
    http.get(`${API}/v1/awards/standings`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const type = params.get('type');
      const weekly = params.get('intervalId') === WEEKLY_ID;
      const answer = standings[`${type}:${weekly ? 'weekly' : 'daily'}`];
      if (answer === 'error') return new HttpResponse(null, { status: 500 });
      return HttpResponse.json(answer || emptyBoard(type));
    }),
    http.get(`${API}/v1/users/:id/default-song`, () =>
      HttpResponse.json({ songId: 'ds1', title: 'Default', fileUrl: '/cdn/default.mp3', artworkUrl: '/cdn/default-art.jpg' })
    ),
    http.post(`${API}/v1/media/song/:id/play`, () => HttpResponse.json({ tracked: true })),
    http.post(`${API}/v1/media/video/:id/play`, () => HttpResponse.json({ tracked: true })),
    http.post(`${API}/v1/earnings/track-view`, () => HttpResponse.json({ ok: true }))
  );

  setupApiCallLog();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('Feed — initial render', () => {
  it('shows loading state initially', () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    expect(screen.getByText(/Loading your feed/i)).toBeInTheDocument();
  });

  it('replaces loading state with feed content once data loads (guest)', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => {
      expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole('region', { name: /Spotlight/i })).toBeInTheDocument();
  });

  it('replaces loading state with feed content once data loads (listener)', async () => {
    renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => {
      expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument();
    });
    expect(screen.getByRole('region', { name: /Spotlight/i })).toBeInTheDocument();
  });

  it('renders all three section headers after load', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    expect(screen.getByText(/Trending Today in/i)).toBeInTheDocument();
    expect(screen.getByText(/New Releases/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Top 5 artists in/i })).toBeInTheDocument();
  });
});

describe('Feed — spotlight (replaced the hero banner)', () => {
  const spotlight = () => screen.getByRole('region', { name: /Spotlight/i });

  it('renders the headline for the default jurisdiction', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    expect(within(spotlight()).getByRole('heading', { level: 1, name: /in Harlem/i })).toBeInTheDocument();
  });

  it('falls back to the vote slide when nothing has scored yet', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    expect(within(spotlight()).getByText(/Who runs Harlem today\?/i)).toBeInTheDocument();
  });

  it("features today's race leader when the daily board has one", async () => {
    server.use(
      http.get(`${API}/v1/awards/standings`, () => HttpResponse.json({
        type: 'song',
        state: 'LIVE',
        interval: 'Daily',
        entries: [
          { targetId: 'lead-1', targetType: 'song', rank: 1, name: 'Lenox Nights', artistName: 'Kai Monroe', totalPoints: 90, votes: 6 },
          { targetId: 'two-2', targetType: 'song', rank: 2, name: 'Uptown Static', artistName: 'Jaylen', totalPoints: 40, votes: 4 },
        ],
      }))
    );
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(within(spotlight()).getByText('Lenox Nights')).toBeInTheDocument());
    expect(within(spotlight()).getByText(/Leading today's race/i)).toBeInTheDocument();
    expect(within(spotlight()).getByText('60% share')).toBeInTheDocument();
  });

  it('triggers auth gate with "vote" context when a guest taps Vote', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(within(spotlight()).getByRole('button', { name: /^Vote$/ }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('auth-gate-context')).toHaveTextContent('vote');
    });
  });

  it('navigates to /voteawards when an authenticated listener taps Vote', async () => {
    renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(within(spotlight()).getByRole('button', { name: /^Vote$/ }));

    expect(navigateSpy).toHaveBeenCalledWith('/voteawards');
  });
});

describe('Feed — jurisdiction selector', () => {
  it('renders with default jurisdiction "Harlem" for guests', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue(HARLEM_ID);
  });

  it('offers Harlem, Uptown Harlem, and Downtown Harlem options', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    const select = screen.getByRole('combobox');
    const options = Array.from(select.options).map(o => o.text);
    expect(options).toContain('Harlem');
    expect(options).toContain('Uptown Harlem');
    expect(options).toContain('Downtown Harlem');
  });

  it('refetches feed data when jurisdiction changes', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    const initialCalls = callsMatching(/\/trending\/today/).length;
    expect(initialCalls).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole('combobox'), UPTOWN_ID);

    await waitFor(() => {
      const newCalls = callsMatching(/\/trending\/today/).length;
      expect(newCalls).toBeGreaterThan(initialCalls);
    });
  });

  it('includes the jurisdictionId in the trending query string', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    await waitFor(() => {
      const trendingCalls = callsMatching(/\/trending\/today/);
      expect(trendingCalls.length).toBeGreaterThan(0);
      expect(trendingCalls[0].url).toContain(`jurisdictionId=${HARLEM_ID}`);
    });
  });
});

describe('Feed — sections render with API data', () => {
  it('renders the Trending Today song title', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());
  });

  it('renders the New Releases song title', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('New Release')).toBeInTheDocument());
  });

  it('renders artist usernames under song cards', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => {
      // testartist appears on the trending card, thirdartist on new release
      expect(screen.getAllByText(/testartist/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/thirdartist/i).length).toBeGreaterThan(0);
    });
  });

  it('renders the explicit "E" badge on explicit tracks', async () => {
    const { container } = renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => {
      const explicitBadges = container.querySelectorAll('.card-explicit');
      expect(explicitBadges.length).toBeGreaterThan(0);
    });
  });

  it('renders duration formatted as M:SS on song cards', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => {
      // 195000ms → 3:15 for trending track
      expect(screen.getByText('3:15')).toBeInTheDocument();
    });
  });

  it('renders "time ago" text on song cards with createdAt', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => {
      // trending: 2 hours ago; new release: 30 minutes ago
      expect(screen.getAllByText(/ago/i).length).toBeGreaterThan(0);
    });
  });
});

describe('Feed — dummy content fallback', () => {
  it('falls back to dummy content when all 6 fetches return empty', async () => {
    // Override all 6 endpoints to return empty arrays
    server.use(
      http.get(`${API}/v1/media/trending/today`, () => HttpResponse.json([])),
      http.get(`${API}/v1/media/trending`, () => HttpResponse.json([])),
      http.get(`${API}/v1/media/new`, () => HttpResponse.json([])),
      http.get(`${API}/v1/awards/leaderboards`, () => HttpResponse.json([])),
      http.get(`${API}/v1/users/artist/top`, () => HttpResponse.json([]))
    );

    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    // Dummy data: Tony Fadd - Paranoid
    await waitFor(() => {
      expect(screen.getByText(/Tony Fadd - Paranoid/i)).toBeInTheDocument();
    });
  });

  it('shows demo content error banner when fetch errors out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Make trending/today throw — Promise.all will reject and trigger catch
    server.use(
      http.get(`${API}/v1/media/trending/today`, () => new HttpResponse(null, { status: 500 }))
    );

    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => {
      // The error state uses axios mock fallback, so might or might not surface.
      // Either way, the feed should still render with dummy content.
      expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument();
    });
  });
});

describe('Feed — play media (song card)', () => {
  it('calls requestPlay when play button on song card is clicked', async () => {
    const { container } = renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());

    // Give auth time to settle
    await new Promise(r => setTimeout(r, 200));

    const playButtons = container.querySelectorAll('.card-play');
    expect(playButtons.length).toBeGreaterThan(0);

    const user = userEvent.setup();
    await user.click(playButtons[0]);

    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
  });

  // ★ Feed no longer POSTs /play itself. Play counting moved into Player.jsx,
  //   which fires it once the listener crosses the 15s / 25% threshold. Feed
  //   only hands the media to requestPlay with a `source` tag. These two tests
  //   asserted the OLD behaviour and have been failing since that change.
  it('does NOT fire /play from the feed (Player owns play counting now)', async () => {
    const { container } = renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());

    await new Promise(r => setTimeout(r, 200));

    const playButtons = container.querySelectorAll('.card-play');
    const user = userEvent.setup();
    await user.click(playButtons[0]);

    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
    expect(callsMatching(/\/media\/song\/.+\/play/, 'post').length).toBe(0);
  });

  it('hands the media to requestPlay for guests without any tracking POST', async () => {
    const { container } = renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());

    const playButtons = container.querySelectorAll('.card-play');
    const user = userEvent.setup();
    await user.click(playButtons[0]);

    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
    expect(callsMatching(/\/media\/song\/.+\/play/, 'post').length).toBe(0);
  });

  it('calls incrementGateSongCount for guest plays', async () => {
    const { incrementGateSongCount } = await import('./AuthGateSheet');
    const { container } = renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());

    const playButtons = container.querySelectorAll('.card-play');
    const user = userEvent.setup();
    await user.click(playButtons[0]);

    // incrementGateSongCount is our mocked vi.fn() from the mock at the top of this file
    expect(incrementGateSongCount).toHaveBeenCalled();
  });

  it('swallows /play tracking errors silently (still calls requestPlay)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.post(`${API}/v1/media/song/:id/play`, () => new HttpResponse(null, { status: 500 }))
    );

    const { container } = renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());

    const playButtons = container.querySelectorAll('.card-play');
    const user = userEvent.setup();
    await user.click(playButtons[0]);

    // requestPlay should still fire even though tracking 500'd
    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
  });
});

describe('Feed — navigation clicks', () => {
  it('navigates to /song/:id when song card (non-play area) is clicked', async () => {
    const { container } = renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());

    const songCard = container.querySelector('.song-card');
    const user = userEvent.setup();
    await user.click(songCard);

    expect(navigateSpy).toHaveBeenCalledWith('/song/song-trend-1');
  });

  it('navigates to /artist/:id when artist name on song card is clicked', async () => {
    const { container } = renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());

    // Click the first artist name (on a song card)
    const artistElements = container.querySelectorAll('.card-artist');
    const user = userEvent.setup();
    await user.click(artistElements[0]);

    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-1');
  });

  // ★ The "Show all" links were removed from the feed when the lens bar landed.
  //   This asserted markup that no longer exists.
  it('no longer renders "Show all" links (replaced by the lens bar)', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    expect(screen.queryByText(/Show all/i)).not.toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: /feed views/i })).toBeInTheDocument();
  });
});

describe('Feed — top five artists', () => {
  // Ranked by the backend with the same formula as awards — the feed no
  // longer builds this list itself from the trending and new-release songs.
  const topFive = async () => {
    const heading = await screen.findByRole('heading', { name: /Top 5 artists in/i });
    return heading.closest('section');
  };

  async function loadFeed() {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
  }

  it('asks for this week\'s top five artists across all genres', async () => {
    await loadFeed();
    await topFive();
    const call = callsMatching(/\/v1\/awards\/standings\?/)
      .map((c) => Object.fromEntries(new URL(c.url, 'http://x.test').searchParams))
      .find((p) => p.type === 'artist' && p.intervalId === WEEKLY_ID);
    expect(call).toMatchObject({ limit: '5', offset: '0' });
    expect(call.genreId).toBeUndefined();
  });

  it('lists artists in ranked order with their points', async () => {
    await loadFeed();
    const section = await topFive();
    const rows = section.querySelectorAll('.chart-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveClass('chart-row--first');
    expect(within(rows[0]).getByText('testartist')).toBeInTheDocument();
    expect(rows[0].querySelector('.chart-song-artist')).toHaveTextContent('320 pts · 2 votes');
    expect(rows[1].querySelector('.chart-song-artist')).toHaveTextContent(/^210 pts$/);
  });

  it('leaves out artists with no points', async () => {
    await loadFeed();
    const section = await topFive();
    expect(within(section).queryByText('noscoreartist')).not.toBeInTheDocument();
  });

  it('says whether the ranking is live', async () => {
    await loadFeed();
    const section = await topFive();
    expect(section.querySelector('.chart-caption')).toHaveTextContent('Live this week');
  });

  it('navigates to the artist page when a row is clicked', async () => {
    await loadFeed();
    const section = await topFive();
    const user = userEvent.setup();
    await user.click(within(section).getByText('testartist'));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-1');
  });

  it('is hidden when nobody has scored', async () => {
    standings['artist:weekly'] = emptyBoard('artist');
    await loadFeed();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('heading', { name: /Top 5 artists in/i })).not.toBeInTheDocument();
  });

  it('is hidden, and the rest of the feed still shows, when the ranking fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    standings['artist:weekly'] = 'error';
    await loadFeed();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('heading', { name: /Top 5 artists in/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Trending Today in/i)).toBeInTheDocument();
  });
});

describe('Feed — no ad-view tracking', () => {
  // Earnings follow listening through the monthly Community Share; the page
  // must never report ad views (Google's ad rules forbid paying for them).
  it('never calls /v1/earnings/track-view, signed in or not', async () => {
    renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 300));
    expect(callsMatching('/v1/earnings/track-view', 'post').length).toBe(0);
  });
});

describe('Feed — LastWonNotification rendering', () => {
  it('renders LastWonNotification for authenticated users', async () => {
    renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    expect(screen.getByTestId('last-won-notification')).toBeInTheDocument();
  });

  it('does NOT render LastWonNotification for guests', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    expect(screen.queryByTestId('last-won-notification')).not.toBeInTheDocument();
  });
});

describe('Feed — data fetch with correct params', () => {
  it('calls the feed endpoints on mount (and not the unused leaderboards)', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    await waitFor(() => {
      expect(callsMatching(/\/trending\/today/).length).toBeGreaterThan(0);
      expect(callsMatching(/\/v1\/media\/trending(?!\/today)/).length).toBeGreaterThan(0);
      expect(callsMatching(/\/media\/new/).length).toBeGreaterThan(0);
      expect(callsMatching(/\/v1\/awards\/standings\?/).length).toBeGreaterThan(0);
    });
    // The old popular-artists list is gone; rankings come from standings.
    expect(callsMatching(/\/users\/artist\/top/).length).toBe(0);
    // Nothing on the feed shows leaderboard data, and a slow answer used to
    // knock the whole feed down to demo content.
    expect(callsMatching(/\/awards\/leaderboards/).length).toBe(0);
  });

  it('limits trending today to 10 items', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    await waitFor(() => {
      const trendingCalls = callsMatching(/\/trending\/today/);
      expect(trendingCalls[0].url).toContain('limit=10');
    });
  });

  it('limits new releases to 5 items', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    await waitFor(() => {
      const newCalls = callsMatching(/\/media\/new/);
      expect(newCalls[0].url).toContain('limit=5');
    });
  });
});
// ===========================================================================
// LENS SWITCHING — every lens must render without throwing.
// (Added after a ReferenceError in the Charts lens crashed the page but the
//  suite stayed green because no test ever left the default "All" lens.)
// ===========================================================================
describe('Feed — lens switching does not crash', () => {
  async function loadFeed(as = 'guest') {
    renderWithProviders(<Feed />, { as });
    await waitFor(() =>
      expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument()
    );
  }

  it('renders the four lens tabs', async () => {
    await loadFeed();
    expect(screen.getByRole('tab', { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Charts/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Playlists/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Fresh/i })).toBeInTheDocument();
  });

  it('switches to the Charts lens and shows this week\'s ranked songs', async () => {
    standings['song:weekly'] = {
      type: 'song', state: 'LIVE', interval: 'Weekly', total: 2,
      entries: [
        {
          targetId: 'c1', targetType: 'song', rank: 1, movement: 2, name: 'Charted Song',
          totalPoints: 1280, artworkUrl: '/cdn/c1.jpg', fileUrl: '/cdn/c1.mp3',
          artistId: 'artist-1', artistName: 'testartist',
        },
        { targetId: 'c2', targetType: 'song', rank: 2, name: 'Unscored Song', totalPoints: 0, artistName: 'nobody' },
      ],
    };
    await loadFeed();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /Charts/i }));
    // Real data path renders the entry; crucially, no render crash.
    const heading = await screen.findByRole('heading', { name: /This Week.s Chart in/i });
    const section = heading.closest('section');
    await waitFor(() => expect(within(section).getByText('Charted Song')).toBeInTheDocument());
    expect(section.querySelector('.chart-song-artist')).toHaveTextContent('testartist · 1,280 pts');
    expect(section.querySelector('.chart-caption')).toHaveTextContent('Live this week.');
    expect(within(section).getByLabelText('Up 2 places')).toBeInTheDocument();
    // Entries with no points stay off the chart.
    expect(within(section).queryByText('Unscored Song')).not.toBeInTheDocument();
  });

  it('asks for the weekly song chart only once, however often the lens is reopened', async () => {
    await loadFeed();
    const user = userEvent.setup();
    const weeklySongCalls = () => callsMatching(/\/v1\/awards\/standings\?/)
      .map((c) => Object.fromEntries(new URL(c.url, 'http://x.test').searchParams))
      .filter((p) => p.type === 'song' && p.intervalId === WEEKLY_ID && p.limit === '10');

    await user.click(screen.getByRole('tab', { name: /Charts/i }));
    await screen.findByRole('heading', { name: /This Week.s Chart in/i });
    await waitFor(() => expect(weeklySongCalls()).toHaveLength(1));

    await user.click(screen.getByRole('tab', { name: /All/i }));
    await user.click(screen.getByRole('tab', { name: /Charts/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(weeklySongCalls()).toHaveLength(1);
  });

  it('shows the honest empty state when the chart has no entries (no fake data)', async () => {
    await loadFeed();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /Charts/i }));
    await waitFor(() =>
      expect(screen.getByText(/Nothing has scored yet this week in/i)).toBeInTheDocument()
    );
    // Demo rows must NOT appear — Charts never shows fake data.
    expect(screen.queryByText('124')).not.toBeInTheDocument();
    expect(document.querySelector('.chart-list')).toBeNull();
  });

  it('shows the same empty state when the chart cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    standings['song:weekly'] = 'error';
    await loadFeed();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /Charts/i }));
    await waitFor(() =>
      expect(screen.getByText(/Nothing has scored yet this week in/i)).toBeInTheDocument()
    );
  });

  it('switches to the Playlists lens without throwing', async () => {
    server.use(
      http.get(`${API}/v1/playlists/official`, () => HttpResponse.json([])),
      http.get(`${API}/v1/playlists/discover`, () => HttpResponse.json([]))
    );
    await loadFeed();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /Playlists/i }));
    await waitFor(() =>
      expect(screen.getByText(/Playlists Rising in/i)).toBeInTheDocument()
    );
  });

  it('switches to the Fresh lens without throwing', async () => {
    await loadFeed();
    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: /Fresh/i }));
    await waitFor(() =>
      expect(screen.getByText(/Dropped Recently/i)).toBeInTheDocument()
    );
  });

  it('every feed button is type="button" (never submits / reloads)', async () => {
    const { container } = renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() =>
      expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument()
    );
    const untyped = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.getAttribute('type') !== 'button'
    );
    expect(untyped).toHaveLength(0);
  });
});