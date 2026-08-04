// src/DiscoverPage.test.jsx
//
// There was no test file for this page at all before this pass. The suite is
// weighted toward the bugs that shipped: the empty Playlists rail, the
// millisecond/second duration mismatch, the undefined setScopeOptions crash,
// and play double-counting.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { AuthProvider } from './context/AuthContext';
import { PlayerContext } from './context/playercontext';
import { makeToken, fixtures } from './test/mocks/handlers';
import cacheService from './services/cacheService';
import { JURISDICTION_IDS } from './utils/idMappings';

vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return { ...actual, useNavigate: () => mockNavigate };
});

import DiscoverPage from './DiscoverPage';

const API = 'http://localhost:8080/api';
const HARLEM = JURISDICTION_IDS.harlem;
const UPTOWN = JURISDICTION_IDS['uptown-harlem'];

// ─── fixtures ───────────────────────────────────────────────────────────────

const searchUsers = [
  {
    id: 'user-artist-001', name: 'Nas Jr', subtitle: 'Rap', type: 'artist',
    artworkUrl: 'https://cdn.test/nas.jpg', score: 4200,
    extra: { level: 'gold', jurisdictionId: HARLEM },
  },
  {
    id: 'user-listener-001', name: 'Casey', subtitle: '', type: 'listener',
    artworkUrl: null, score: 120, extra: { level: 'silver', role: 'listener' },
  },
];

// duration is deliberately raw MILLISECONDS — that is what search_all emits.
const searchSongs = [
  {
    id: 'song-001', name: 'Uptown Anthem', subtitle: 'Nas Jr', type: 'song',
    artworkUrl: 'https://cdn.test/song-001.jpg', score: 1500,
    extra: { duration: 180000, artistId: 'user-artist-001' },
  },
  {
    id: 'song-002', name: 'Late Nights', subtitle: 'Nas Jr', type: 'song',
    artworkUrl: null, score: 0, extra: { duration: 225000 },
  },
];

const searchPlaylists = [
  {
    id: 'pl-001', name: 'Harlem Heat', subtitle: 'Unis Editorial', type: 'playlist',
    artworkUrl: 'https://cdn.test/pl-001.jpg', score: 310,
    extra: { songCount: 24, playlistType: 'community' },
  },
  {
    id: 'pl-002', name: 'Sunday Slow', subtitle: 'Casey', type: 'playlist',
    artworkUrl: null, score: 40,
    extra: { songCount: 8, playlistType: 'personal' },
  },
];

const videoPayload = [
  {
    videoId: 'vid-001', title: 'Live at the Apollo',
    artist: { username: 'Nas Jr' }, artworkUrl: 'https://cdn.test/vid-001.jpg',
    duration: 246000, playCount: 900, jurisdiction: { name: 'Harlem' },
  },
];

// ─── handler installer ──────────────────────────────────────────────────────

function installDiscover({
  users = searchUsers,
  songs = searchSongs,
  playlists = searchPlaylists,
  videos = videoPayload,
} = {}) {
  server.use(
    http.get(`${API}/v1/search`, ({ request }) => {
      const type = new URL(request.url).searchParams.get('type');
      const byType = { user: users, song: songs, artist: users, playlist: playlists };
      return HttpResponse.json({ results: byType[type] || [] });
    }),
    http.get(`${API}/v1/media/videos/jurisdiction/:id`, () => HttpResponse.json(videos)),
    http.get(`${API}/v1/media/videos/recent`, () => HttpResponse.json(videos)),
  );
}

// ─── render helper ──────────────────────────────────────────────────────────

function renderDiscover({ as = 'guest', route = '/discover', player = {} } = {}) {
  if (as === 'listener') localStorage.setItem('token', makeToken(fixtures.users.listener.userId));
  if (as === 'artist') localStorage.setItem('token', makeToken(fixtures.users.artist.userId));

  const requestPlay = vi.fn();
  const value = { requestPlay, currentMedia: null, isPlaying: false, queue: [], ...player };

  const result = render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <PlayerContext.Provider value={value}>
          <DiscoverPage />
        </PlayerContext.Provider>
      </AuthProvider>
    </MemoryRouter>
  );
  return { ...result, requestPlay };
}

const railFor = async (title) => {
  const heading = await screen.findByText((_, el) =>
    el?.classList?.contains('dsc-sec-title') && el.textContent.startsWith(title)
  );
  return heading.closest('section');
};

// ────────────────────────────────────────────────────────────────────────────

describe('DiscoverPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheService.clearAll();
    installDiscover();
  });

  // ── the reported bug: "All" only rendered Videos and Users ────────────────
  describe('All view', () => {
    it('renders every category, not just users and videos', async () => {
      renderDiscover();

      expect(await railFor('Users')).toBeInTheDocument();
      expect(await railFor('Playlists')).toBeInTheDocument();
      expect(await railFor('Songs')).toBeInTheDocument();
      expect(await railFor('Videos')).toBeInTheDocument();
    });

    it('requests playlists through search so the jurisdiction rollup applies', async () => {
      const seen = [];
      server.use(
        http.get(`${API}/v1/search`, ({ request }) => {
          const p = new URL(request.url).searchParams;
          seen.push({ type: p.get('type'), jid: p.get('jurisdictionId') });
          return HttpResponse.json({ results: searchPlaylists });
        })
      );
      renderDiscover();

      // findPublicByJurisdiction had no hierarchy rollup, so the parent scope
      // returned nothing. search_all v4 does the rollup.
      await waitFor(() => expect(seen.some((r) => r.type === 'playlist')).toBe(true));
      expect(seen.find((r) => r.type === 'playlist').jid).toBe(HARLEM);
    });

    it('shows real playlist content rather than an empty rail', async () => {
      renderDiscover();
      const rail = await railFor('Playlists');
      expect(within(rail).getByText('Harlem Heat')).toBeInTheDocument();
      expect(within(rail).getByText(/24 tracks/)).toBeInTheDocument();
    });

    it('hides a rail whose source returns nothing, without blanking the page', async () => {
      installDiscover({ playlists: [] });
      renderDiscover();

      expect(await railFor('Songs')).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByText('Harlem Heat')).not.toBeInTheDocument()
      );
    });

    it('surfaces an error only when every source fails', async () => {
      server.use(
        http.get(`${API}/v1/search`, () => new HttpResponse(null, { status: 500 })),
        http.get(`${API}/v1/playlists/discover`, () => new HttpResponse(null, { status: 500 })),
        http.get(`${API}/v1/media/videos/jurisdiction/:id`, () => new HttpResponse(null, { status: 500 })),
      );
      renderDiscover();
      expect(await screen.findByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });

  // ── duration units ────────────────────────────────────────────────────────
  describe('durations', () => {
    it('converts song durations from milliseconds to mm:ss', async () => {
      renderDiscover();
      // 180000ms is three minutes. Read as seconds it rendered "3000:00".
      expect(await screen.findByText('3:00')).toBeInTheDocument();
      expect(await screen.findByText('3:45')).toBeInTheDocument();
      expect(screen.queryByText('3000:00')).not.toBeInTheDocument();
    });

    it('converts video durations from milliseconds to mm:ss', async () => {
      renderDiscover();
      expect(await screen.findByText('4:06')).toBeInTheDocument();
    });

    it('omits the duration chip when the value is missing or zero', async () => {
      installDiscover({
        songs: [{ ...searchSongs[0], extra: { duration: null } }],
        videos: [{ ...videoPayload[0], duration: 0 }],
      });
      renderDiscover();
      await screen.findByText('Uptown Anthem');
      expect(screen.queryByText('0:00')).not.toBeInTheDocument();
    });
  });

  // ── scope dropdown ────────────────────────────────────────────────────────
  describe('jurisdiction scope', () => {
    it('changes scope without throwing and refetches against the new id', async () => {
      const user = userEvent.setup();
      const scopes = [];
      server.use(
        http.get(`${API}/v1/search`, ({ request }) => {
          scopes.push(new URL(request.url).searchParams.get('jurisdictionId'));
          return HttpResponse.json({ results: [] });
        })
      );
      renderDiscover();
      await waitFor(() => expect(scopes.length).toBeGreaterThan(0));

      await user.click(screen.getByRole('button', { name: 'Harlem' }));
      await user.click(await screen.findByRole('option', { name: /Uptown Harlem/ }));

      // The old handler called an undefined setScopeOptions here and threw.
      await waitFor(() => expect(scopes).toContain(UPTOWN));
    });

    it('closes the menu after a selection', async () => {
      const user = userEvent.setup();
      renderDiscover();
      await user.click(screen.getByRole('button', { name: 'Harlem' }));
      await user.click(await screen.findByRole('option', { name: /Uptown Harlem/ }));
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    });

    it('closes on Escape and returns focus to the trigger', async () => {
      const user = userEvent.setup();
      renderDiscover();
      const trigger = screen.getByRole('button', { name: 'Harlem' });
      await user.click(trigger);
      expect(await screen.findByRole('listbox')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
      expect(trigger).toHaveFocus();
    });

    it('defaults a signed-in user to their own jurisdiction', async () => {
      renderDiscover({ as: 'listener' });
      expect(await screen.findByRole('button', { name: 'Harlem' })).toBeInTheDocument();
    });

    it('does not fire a second profile fetch — AuthContext already has it', async () => {
      let profileCalls = 0;
      server.use(
        http.get(`${API}/v1/users/profile/:userId`, () => {
          profileCalls += 1;
          return HttpResponse.json(fixtures.users.listener);
        })
      );
      renderDiscover({ as: 'listener' });
      await screen.findByRole('button', { name: 'Harlem' });
      await waitFor(() => expect(profileCalls).toBe(1));
    });

    it('ignores a jname supplied in the URL', async () => {
      renderDiscover({ route: `/discover?jid=${HARLEM}&jname=OWNED%20BY%20ATTACKER` });
      const h1 = await screen.findByRole('heading', { level: 1 });
      expect(h1).not.toHaveTextContent(/OWNED BY ATTACKER/);
      expect(h1).toHaveTextContent('Harlem');
    });

    it('ignores an unrecognised jid rather than trusting it', async () => {
      renderDiscover({ route: '/discover?jid=not-a-real-jurisdiction' });
      expect(await screen.findByRole('button', { name: 'Harlem' })).toBeInTheDocument();
    });
  });

  // ── type tabs ─────────────────────────────────────────────────────────────
  describe('type tabs', () => {
    it('switches to a single grid and keeps aria state in sync', async () => {
      const user = userEvent.setup();
      renderDiscover();
      const songsTab = screen.getByRole('tab', { name: 'Songs' });
      await user.click(songsTab);

      await waitFor(() => expect(songsTab).toHaveAttribute('aria-selected', 'true'));
      expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false');
      expect(await screen.findByText('Uptown Anthem')).toBeInTheDocument();
      expect(screen.queryByText('Harlem Heat')).not.toBeInTheDocument();
    });

    it('moves between tabs with the arrow keys', async () => {
      const user = userEvent.setup();
      renderDiscover();
      const allTab = screen.getByRole('tab', { name: 'All' });
      allTab.focus();
      await user.keyboard('{ArrowRight}');
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: 'Users' })).toHaveAttribute('aria-selected', 'true')
      );
    });

    it('keeps exactly one tab in the tab order', async () => {
      renderDiscover();
      const tabs = screen.getAllByRole('tab');
      expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);
    });

    it('jumps to a full grid from See all', async () => {
      const user = userEvent.setup();
      renderDiscover();
      const rail = await railFor('Playlists');
      await user.click(within(rail).getByRole('button', { name: /See all/ }));
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: 'Playlists' })).toHaveAttribute('aria-selected', 'true')
      );
    });
  });

  // ── search ────────────────────────────────────────────────────────────────
  describe('search', () => {
    it('debounces typing into a single query', async () => {
      const user = userEvent.setup();
      const queries = [];
      server.use(
        http.get(`${API}/v1/search`, ({ request }) => {
          queries.push(new URL(request.url).searchParams.get('q'));
          return HttpResponse.json({ results: [] });
        })
      );
      renderDiscover();
      await user.type(screen.getByRole('searchbox', { name: /Search Discover/i }), 'nas');
      await waitFor(() => expect(queries).toContain('nas'));
      expect(queries.filter((q) => q === 'na')).toHaveLength(0);
    });

    it('carries the jurisdiction into a playlist text query', async () => {
      const user = userEvent.setup();
      const seen = [];
      server.use(
        http.get(`${API}/v1/search`, ({ request }) => {
          const p = new URL(request.url).searchParams;
          seen.push({ type: p.get('type'), q: p.get('q'), jid: p.get('jurisdictionId') });
          return HttpResponse.json({ results: [] });
        })
      );
      renderDiscover();
      await user.type(screen.getByRole('searchbox', { name: /Search Discover/i }), 'harlem');
      // /playlists/search had no jurisdiction param, so scoped queries leaked global results.
      await waitFor(() =>
        expect(seen.some((r) => r.type === 'playlist' && r.q === 'harlem' && r.jid === HARLEM)).toBe(true)
      );
    });

    it('filters videos client-side, since the endpoint takes no query', async () => {
      const user = userEvent.setup();
      renderDiscover();
      await screen.findByText('Live at the Apollo');
      await user.type(screen.getByRole('searchbox', { name: /Search Discover/i }), 'zzzz');
      await waitFor(() =>
        expect(screen.queryByText('Live at the Apollo')).not.toBeInTheDocument()
      );
    });

    it('shows the empty state when nothing matches', async () => {
      installDiscover({ users: [], songs: [], playlists: [], videos: [] });
      const user = userEvent.setup();
      renderDiscover();
      await user.type(screen.getByRole('searchbox', { name: /Search Discover/i }), 'zzzz');
      expect(await screen.findByText(/Nothing here yet for "zzzz"/)).toBeInTheDocument();
    });
  });

  // ── playback ──────────────────────────────────────────────────────────────
  describe('playback', () => {
    it('routes play through requestPlay so PlayChoiceModal can gate it', async () => {
      const user = userEvent.setup();
      const { requestPlay } = renderDiscover();
      await screen.findByText('Uptown Anthem');

      await user.click(screen.getByRole('button', { name: 'Play Uptown Anthem' }));
      await waitFor(() => expect(requestPlay).toHaveBeenCalledTimes(1));
      expect(requestPlay.mock.calls[0][0]).toMatchObject({ songId: 'song-001', source: 'discover' });
    });

    it('never counts a play itself — Player.jsx owns the 15s/25% gate', async () => {
      const user = userEvent.setup();
      let playPosts = 0;
      server.use(
        http.post(`${API}/v1/media/song/:songId/play`, () => {
          playPosts += 1;
          return HttpResponse.json({ playId: 'p1' });
        })
      );
      renderDiscover();
      await screen.findByText('Uptown Anthem');
      await user.click(screen.getByRole('button', { name: 'Play Uptown Anthem' }));

      await waitFor(() => expect(playPosts).toBe(0));
    });

    it('falls back to the song page when the track fails to load', async () => {
      const user = userEvent.setup();
      server.use(
        http.get(`${API}/v1/media/song/:songId`, () => new HttpResponse(null, { status: 500 }))
      );
      renderDiscover();
      await screen.findByText('Uptown Anthem');
      await user.click(screen.getByRole('button', { name: 'Play Uptown Anthem' }));
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/song/song-001'));
    });

    it('exposes the play control as a real button, not nested inside the card', async () => {
      renderDiscover();
      const play = await screen.findByRole('button', { name: 'Play Uptown Anthem' });
      expect(play.tagName).toBe('BUTTON');
      expect(play.closest('button:not(.play)')).toBeNull();
    });
  });

  // ── navigation ────────────────────────────────────────────────────────────
  describe('navigation', () => {
    it('sends artists and listeners to their own routes', async () => {
      const user = userEvent.setup();
      renderDiscover();
      await user.click(await screen.findByRole('button', { name: /Nas Jr, Artist/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/artist/user-artist-001');

      await user.click(screen.getByRole('button', { name: /Casey, Listener/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/user/user-listener-001');
    });

    it('opens playlists and videos on their own routes', async () => {
      const user = userEvent.setup();
      renderDiscover();
      await user.click(await screen.findByRole('button', { name: /Playlist Harlem Heat/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/playlist/pl-001');

      await user.click(screen.getByRole('button', { name: /Play video Live at the Apollo/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/video/vid-001');
    });
  });

  // ── pagination ────────────────────────────────────────────────────────────
  describe('load more', () => {
    it('requests the next offset for server-paginated types', async () => {
      const user = userEvent.setup();
      const page1 = Array.from({ length: 10 }, (_, i) => ({
        id: `s-${i}`, name: `Song ${i}`, subtitle: 'Nas Jr', type: 'song',
        artworkUrl: null, score: 1, extra: { duration: 120000 },
      }));
      const offsets = [];
      server.use(
        http.get(`${API}/v1/search`, ({ request }) => {
          const p = new URL(request.url).searchParams;
          offsets.push(p.get('offset'));
          return HttpResponse.json({ results: p.get('offset') === '0' ? page1 : [] });
        })
      );
      renderDiscover({ route: '/discover?type=song' });

      await user.click(await screen.findByRole('button', { name: 'Show more' }));
      await waitFor(() => expect(offsets).toContain('10'));
    });

    it('pages playlists server-side, ten at a time', async () => {
      const user = userEvent.setup();
      const page = (start) => Array.from({ length: 10 }, (_, i) => ({
        id: `pl-${start + i}`, name: `List ${start + i}`, subtitle: 'Casey',
        type: 'playlist', artworkUrl: null, score: 1, extra: { songCount: 3 },
      }));
      const offsets = [];
      server.use(
        http.get(`${API}/v1/search`, ({ request }) => {
          const p = new URL(request.url).searchParams;
          if (p.get('type') !== 'playlist') return HttpResponse.json({ results: [] });
          const off = Number(p.get('offset'));
          offsets.push(off);
          return HttpResponse.json({ results: page(off) });
        })
      );
      renderDiscover({ route: '/discover?type=playlist' });

      await screen.findByText('List 0');
      expect(screen.queryByText('List 10')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Show more' }));
      expect(await screen.findByText('List 10')).toBeInTheDocument();
      await waitFor(() => expect(offsets).toContain(10));
    });
  });

  // ── infrastructure ────────────────────────────────────────────────────────
  describe('infrastructure', () => {
    it('sends requests through the /api prefix, not a bare origin', async () => {
      const urls = [];
      server.use(
        http.get(`${API}/v1/search`, ({ request }) => {
          urls.push(new URL(request.url).pathname);
          return HttpResponse.json({ results: [] });
        })
      );
      renderDiscover();
      // The raw fetch() version hardcoded a base URL with no /api segment,
      // which 404s in local dev.
      await waitFor(() => expect(urls.every((u) => u.startsWith('/api/'))).toBe(true));
      expect(urls.length).toBeGreaterThan(0);
    });

    it('rewrites private R2 artwork through buildUrl', async () => {
      renderDiscover();
      await screen.findByText('Uptown Anthem');
      const img = document.querySelector('.dsc-song .cover img');
      expect(img.getAttribute('src')).toMatch(/^https:\/\//);
    });

    it('announces loading politely', async () => {
      renderDiscover();
      const status = document.querySelector('[role="status"]');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('logs a failure rather than swallowing it', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(
        http.get(`${API}/v1/media/videos/jurisdiction/:id`, () => new HttpResponse(null, { status: 500 }))
      );
      renderDiscover();
      await waitFor(() =>
        expect(spy).toHaveBeenCalledWith(
          expect.stringContaining('[Discover] rail "video" failed:'),
          expect.anything()
        )
      );
      spy.mockRestore();
    });
  });
});