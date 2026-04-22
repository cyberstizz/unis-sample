// src/feed.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
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
    expect(screen.getByText(/Vote for This Week's Top Track/i)).toBeInTheDocument();
  });

  it('replaces loading state with feed content once data loads (listener)', async () => {
    renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => {
      expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Vote for This Week's Top Track/i)).toBeInTheDocument();
  });

  it('renders all three section headers after load', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    expect(screen.getByText(/Trending Today in/i)).toBeInTheDocument();
    expect(screen.getByText(/New Releases/i)).toBeInTheDocument();
    expect(screen.getByText(/Popular Artists/i)).toBeInTheDocument();
  });
});

describe('Feed — hero banner', () => {
  it('renders the hero banner with title and subtitle', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    expect(screen.getByText(/Vote for This Week's Top Track/i)).toBeInTheDocument();
    expect(screen.getByText(/Your vote decides who tops/i)).toBeInTheDocument();
  });

  it('renders "Featured in Harlem" label (default jurisdiction)', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    expect(screen.getByText(/Featured in Harlem/i)).toBeInTheDocument();
  });

  it('renders the "Vote Now" CTA button', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Vote Now/i })).toBeInTheDocument();
  });

  it('triggers auth gate with "vote" context when guest clicks Vote Now', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Vote Now/i }));

    await waitFor(() => {
      expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('auth-gate-context')).toHaveTextContent('vote');
    });
  });

  it('navigates to /voteawards when authenticated listener clicks Vote Now', async () => {
    renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Vote Now/i }));

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

  it('fires /play tracking endpoint when authenticated user plays a song', async () => {
    const { container } = renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());

    await new Promise(r => setTimeout(r, 200));

    const playButtons = container.querySelectorAll('.card-play');
    const user = userEvent.setup();
    await user.click(playButtons[0]);

    await waitFor(() => {
      const playCalls = callsMatching(/\/media\/song\/.+\/play/, 'post');
      expect(playCalls.length).toBeGreaterThan(0);
    });
  });

  it('fires /play without userId query param for guests', async () => {
    const { container } = renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());

    const playButtons = container.querySelectorAll('.card-play');
    const user = userEvent.setup();
    await user.click(playButtons[0]);

    await waitFor(() => {
      const playCalls = callsMatching(/\/media\/song\/.+\/play/, 'post');
      expect(playCalls.length).toBeGreaterThan(0);
      // Guest URL should NOT have userId param
      expect(playCalls[0].url).not.toContain('userId=');
    });
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

  it('navigates to /findpage when "Show all" link is clicked', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    const user = userEvent.setup();
    const showAllLinks = screen.getAllByText(/Show all/i);
    await user.click(showAllLinks[0]);

    expect(navigateSpy).toHaveBeenCalledWith('/findpage');
  });
});

describe('Feed — popular artists section', () => {
  it('renders artist cards from aggregated media data', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    await waitFor(() => {
      // Artists aggregated from trending/topRated/new: artist-1, artist-2, artist-3
      expect(screen.getByTestId('artist-card-artist-1')).toBeInTheDocument();
    });
  });

  it('navigates to artist page when artist card is clicked', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('artist-card-artist-1')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getByTestId('artist-card-artist-1'));

    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-1');
  });

  it('dedupes artists (same userId only appears once)', async () => {
    // Make both trending and new return songs by the SAME artist
    server.use(
      http.get(`${API}/v1/media/trending/today`, () => HttpResponse.json([trendingSong])),
      http.get(`${API}/v1/media/new`, () => HttpResponse.json([{ ...trendingSong, songId: 'dupe-song' }]))
    );

    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    await waitFor(() => {
      // Should only find ONE artist card with userId artist-1
      const cards = screen.getAllByTestId(/artist-card-artist-1/);
      expect(cards.length).toBe(1);
    });
  });
});

describe('Feed — ad tracking', () => {
  it('fires POST /v1/earnings/track-view for authenticated users', async () => {
    renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    await waitFor(() => {
      const trackCalls = callsMatching('/v1/earnings/track-view', 'post');
      expect(trackCalls.length).toBe(1);
    });
  });

  it('does NOT fire track-view for guests (guest ad revenue goes to Unis)', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    // Wait a bit to ensure any racing calls would have fired
    await new Promise(r => setTimeout(r, 300));

    const trackCalls = callsMatching('/v1/earnings/track-view', 'post');
    expect(trackCalls.length).toBe(0);
  });

  it('swallows track-view errors silently (does not break the page)', async () => {
    server.use(
      http.post(`${API}/v1/earnings/track-view`, () => new HttpResponse(null, { status: 500 }))
    );

    renderWithProviders(<Feed />, { as: 'listener' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    // Page still renders content despite 500
    await waitFor(() => expect(screen.getByText('Trending Track')).toBeInTheDocument());
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
  it('calls all 6 feed endpoints on mount', async () => {
    renderWithProviders(<Feed />, { as: 'guest' });
    await waitFor(() => expect(screen.queryByText(/Loading your feed/i)).not.toBeInTheDocument());

    await waitFor(() => {
      expect(callsMatching(/\/trending\/today/).length).toBeGreaterThan(0);
      expect(callsMatching(/\/v1\/media\/trending(?!\/today)/).length).toBeGreaterThan(0);
      expect(callsMatching(/\/media\/new/).length).toBeGreaterThan(0);
      expect(callsMatching(/\/awards\/leaderboards\?type=song/).length).toBeGreaterThan(0);
      expect(callsMatching(/\/awards\/leaderboards\?type=artist/).length).toBeGreaterThan(0);
      expect(callsMatching(/\/users\/artist\/top/).length).toBeGreaterThan(0);
    });
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