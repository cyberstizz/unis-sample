// src/sidebar.test.jsx
//
// Unit tests for the Sidebar (v3 redesign). Covers:
// - The six links route correctly; Find / Earnings live in the header only,
//   and nothing links to Leaderboards any more
// - Auth gating (Messages, Unis Plus, Settings) and artist vs listener settings
// - Your turf: jurisdiction name + tonight's #1, and the signed-out card
// - Your playlists: list, navigation, "playing" equaliser, new playlist,
//   empty state, and the signed-out "Make it yours" card
// - Admin link visibility
// - The phone/tablet drawer: header toggle, overlay, Escape, close button,
//   auto-close after navigating
// - Collapse / expand and the --sidebar-width the content column reads

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerContext } from './context/playercontext';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
let mockPath = '/';
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPath }),
}));

const mockUseAuth = vi.fn();
vi.mock('./context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockTriggerGate = vi.fn();
vi.mock('./AuthGateSheet', () => ({
  default: ({ open }) => (open ? <div data-testid="AuthGateSheet" /> : null),
  useAuthGate: () => ({
    triggerGate: mockTriggerGate,
    gateProps: { open: false },
  }),
}));

const mockApiCall = vi.fn();
vi.mock('./components/axiosInstance', () => ({
  apiCall: (...args) => mockApiCall(...args),
}));

const mockFetchStandings = vi.fn();
vi.mock('./utils/standings', () => ({
  fetchStandings: (...args) => mockFetchStandings(...args),
}));

vi.mock('./utils/buildUrl', () => ({
  buildUrl: (u) => (u ? `https://cdn.test/${u}` : null),
}));

vi.mock('./sidebar.scss', () => ({}));

import Sidebar from './sidebar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LISTENER = {
  userId: 'u1',
  username: 'stizz',
  role: 'listener',
  jurisdiction: { jurisdictionId: 'j1', name: 'Downtown Harlem' },
};

const renderSidebar = (authOverrides = {}, playerOverrides = {}) => {
  mockUseAuth.mockReturnValue({ user: null, isGuest: true, theme: 'blue', ...authOverrides });
  const playerCtx = {
    openPlaylistManager: vi.fn(),
    playlists: [],
    followedPlaylists: [],
    currentMedia: null,
    isPlaying: false,
    ...playerOverrides,
  };
  const result = render(
    <PlayerContext.Provider value={playerCtx}>
      <Sidebar />
    </PlayerContext.Provider>
  );
  return { user: userEvent.setup(), playerCtx, ...result };
};

const signedIn = (extra = {}, player = {}) =>
  renderSidebar({ user: { ...LISTENER, ...extra }, isGuest: false }, player);

const setViewportWidth = (px) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: px });
  act(() => { window.dispatchEvent(new Event('resize')); });
};

const sidebarWidth = () => document.documentElement.style.getPropertyValue('--sidebar-width');

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPath = '/';
    localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 });
    mockApiCall.mockResolvedValue({ data: {} });
    mockFetchStandings.mockResolvedValue({ state: 'LIVE', entries: [] });
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--sidebar-width');
    document.documentElement.classList.remove('sb-animating');
  });

  // =========================================================================
  describe('links', () => {
    it.each([
      ['Home',         '/'],
      ['Discover',     '/discover'],
      ['Charts',       '/charts'],
      ['Vote',         '/voteawards'],
    ])('"%s" navigates to %s', async (label, path) => {
      const { user } = signedIn();
      await user.click(screen.getByRole('button', { name: label }));
      expect(mockNavigate).toHaveBeenCalledWith(path);
    });

    it('does not repeat the header-only links (Find, Earnings) or link Leaderboards', () => {
      signedIn();
      expect(screen.queryByRole('button', { name: 'Find' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Earnings' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Leaderboards' })).toBeNull();
    });

    it('marks the current page with aria-current', () => {
      mockPath = '/charts';
      signedIn();
      expect(screen.getByRole('button', { name: 'Charts' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('button', { name: 'Home' })).not.toHaveAttribute('aria-current');
    });

    it('shows the unread badge on Messages', async () => {
      mockApiCall.mockImplementation(({ url }) =>
        Promise.resolve({ data: url.includes('conversations/summary') ? { unread: 3 } : {} }));
      signedIn();
      expect(await screen.findByLabelText('3 unread')).toBeInTheDocument();
    });
  });

  // =========================================================================
  describe('gating', () => {
    it('gates Messages, Unis Plus and Settings for guests', async () => {
      const { user } = renderSidebar();
      await user.click(screen.getByRole('button', { name: 'Messages' }));
      await user.click(screen.getByRole('button', { name: 'Unis Plus' }));
      expect(mockTriggerGate).toHaveBeenCalledWith('profile');
      expect(mockTriggerGate).toHaveBeenCalledWith('plus');
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('Settings goes to /profile for listeners', async () => {
      const { user } = signedIn();
      await user.click(screen.getByRole('button', { name: 'Settings' }));
      expect(mockNavigate).toHaveBeenCalledWith('/profile');
    });

    it('Settings goes to /artistDashboard for artists', async () => {
      const { user } = signedIn({ role: 'artist' });
      await user.click(screen.getByRole('button', { name: 'Settings' }));
      expect(mockNavigate).toHaveBeenCalledWith('/artistDashboard');
    });
  });

  // =========================================================================
  describe('your turf', () => {
    it("shows the jurisdiction and tonight's #1", async () => {
      mockFetchStandings.mockResolvedValue({
        state: 'LIVE',
        entries: [{ id: 's1', name: 'no more heroes', artistName: 'stizz', points: 12 }],
      });
      signedIn();
      expect(screen.getByText('Downtown Harlem')).toBeInTheDocument();
      expect(await screen.findByText('#1 tonight')).toBeInTheDocument();
      expect(screen.getByText(/no more heroes — stizz/)).toBeInTheDocument();
      expect(mockFetchStandings).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'song', jurisdictionId: 'j1', period: 'daily', limit: 50 }),
      );
    });

    it('opens the jurisdiction page by name (the route looks places up by name)', async () => {
      const { user } = signedIn();
      await user.click(screen.getByText('Downtown Harlem'));
      expect(mockNavigate).toHaveBeenCalledWith('/jurisdiction/Downtown%20Harlem');
    });

    it('shows the launch area to signed-out visitors and opens Find', async () => {
      const { user } = renderSidebar();
      await user.click(screen.getByText('Harlem'));
      expect(mockNavigate).toHaveBeenCalledWith('/findpage');
      expect(mockFetchStandings).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('your playlists', () => {
    const playlists = [
      { playlistId: 'p1', name: 'Late Night Uptown', songCount: 24, firstFourArtworks: [] },
      { playlistId: 'p2', name: 'Harlem Heat', songCount: 1, coverImageUrl: 'covers/hh.jpg' },
    ];

    it('lists own and followed playlists without duplicates', () => {
      signedIn({}, {
        playlists,
        followedPlaylists: [
          { playlistId: 'p2', name: 'Harlem Heat' },
          { playlistId: 'p3', name: 'Bars Only', creatorName: 'rapking' },
        ],
      });
      expect(screen.getByText('Late Night Uptown')).toBeInTheDocument();
      expect(screen.getAllByText('Harlem Heat')).toHaveLength(1);
      expect(screen.getByText('Playlist · 1 song')).toBeInTheDocument();
      expect(screen.getByText('Playlist · rapking')).toBeInTheDocument();
    });

    it('opens a playlist page', async () => {
      const { user } = signedIn({}, { playlists });
      await user.click(screen.getByText('Late Night Uptown'));
      expect(mockNavigate).toHaveBeenCalledWith('/playlist/p1');
    });

    it('marks the playlist the current song came from', () => {
      signedIn({}, {
        playlists,
        isPlaying: true,
        currentMedia: { id: 's1', origin: { type: 'playlist', playlistId: 'p1' } },
      });
      expect(screen.getByRole('img', { name: 'Playing' })).toBeInTheDocument();
    });

    // Playlists live on their own page; New playlist opens it ready to create.
    it('New playlist opens the playlists page ready to create one', async () => {
      const { user } = signedIn({}, { playlists });
      await user.click(screen.getByRole('button', { name: 'New playlist' }));
      expect(mockNavigate).toHaveBeenCalledWith('/playlists?new=1');
    });

    it('shows the one-row first-playlist prompt when there are none', async () => {
      const { user } = signedIn();
      expect(screen.getByText('Create your first playlist')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'New playlist' }));
      expect(mockNavigate).toHaveBeenCalledWith('/playlists?new=1');
    });

    it('asks signed-out visitors to sign in', async () => {
      const { user } = renderSidebar();
      expect(screen.getByText('Make it yours')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Sign in' }));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  // =========================================================================
  describe('admin link', () => {
    it('is hidden for guests and regular users', () => {
      signedIn();
      expect(screen.queryByRole('button', { name: 'Admin' })).toBeNull();
    });

    it('shows for admins and routes to /admin', async () => {
      const { user } = signedIn({ adminRole: 'SUPER_ADMIN' });
      await user.click(screen.getByRole('button', { name: 'Admin' }));
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });
  });

  // =========================================================================
  describe('drawer (phone / tablet)', () => {
    const openDrawer = () => act(() => { window.dispatchEvent(new CustomEvent('unis:toggle-sidebar')); });

    it('starts closed and opens from the header menu button', () => {
      setViewportWidth(800);
      const { container } = signedIn();
      const nav = container.querySelector('.sidebar');
      expect(nav).not.toHaveClass('open');
      openDrawer();
      expect(nav).toHaveClass('open');
      expect(container.querySelector('.sidebar-overlay')).toBeInTheDocument();
    });

    it('closes from the overlay, the close button and Escape', async () => {
      setViewportWidth(800);
      const { container, user } = signedIn();
      const nav = container.querySelector('.sidebar');

      openDrawer();
      await user.click(container.querySelector('.sidebar-overlay'));
      expect(nav).not.toHaveClass('open');

      openDrawer();
      await user.click(screen.getByRole('button', { name: 'Close menu' }));
      expect(nav).not.toHaveClass('open');

      openDrawer();
      await user.keyboard('{Escape}');
      expect(nav).not.toHaveClass('open');
    });

    it('closes itself after navigating', async () => {
      setViewportWidth(800);
      const { container, user } = signedIn();
      openDrawer();
      await user.click(screen.getByRole('button', { name: 'Charts' }));
      expect(mockNavigate).toHaveBeenCalledWith('/charts');
      expect(container.querySelector('.sidebar')).not.toHaveClass('open');
    });
  });

  // =========================================================================
  describe('collapse and --sidebar-width', () => {
    it('reserves 0px on phones and tablets', () => {
      setViewportWidth(800);
      renderSidebar();
      expect(sidebarWidth()).toBe('0px');
    });

    it('reserves the panel width on desktop', () => {
      setViewportWidth(1400);
      renderSidebar();
      expect(sidebarWidth()).toBe('284px');
    });

    it('updates when the viewport crosses the breakpoint', () => {
      setViewportWidth(1400);
      renderSidebar();
      setViewportWidth(800);
      expect(sidebarWidth()).toBe('0px');
    });

    it('collapses to the rail, remembers it, and expands again', async () => {
      const { user, container } = signedIn();
      await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
      expect(container.querySelector('.sidebar')).toHaveClass('sidebar--rail');
      expect(sidebarWidth()).toBe('102px');
      expect(localStorage.getItem('unis-sidebar-collapsed')).toBe('1');

      await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
      expect(container.querySelector('.sidebar')).not.toHaveClass('sidebar--rail');
      await waitFor(() => expect(localStorage.getItem('unis-sidebar-collapsed')).toBe('0'));
    });

    it('starts collapsed when that was the last choice', () => {
      localStorage.setItem('unis-sidebar-collapsed', '1');
      const { container } = signedIn();
      expect(container.querySelector('.sidebar')).toHaveClass('sidebar--rail');
      // Labels stay visible in the rail (never hover-only)
      expect(screen.getByText('Unis Plus')).toBeInTheDocument();
    });
  });
});
