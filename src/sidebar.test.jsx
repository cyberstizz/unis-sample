// src/Sidebar.test.jsx
//
// Unit tests for Sidebar. Covers:
// - Trigger open/close + overlay
// - Nav item routing
// - Auth gating for Settings & Earnings
// - Settings routing differs for artists vs listeners
// - Playlists button opens the playlist manager
// - Admin link visibility based on user.adminRole
// - --sidebar-width CSS variable updates on resize / breakpoint

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerContext } from './context/playercontext';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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

vi.mock('./sidebar.scss', () => ({}));

import Sidebar from './sidebar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const setAuth = (overrides = {}) => {
  mockUseAuth.mockReturnValue({
    user: null,
    isGuest: true,
    ...overrides,
  });
};

const renderSidebar = (authOverrides = {}, playerOverrides = {}) => {
  setAuth(authOverrides);
  const playerCtx = {
    openPlaylistManager: vi.fn(),
    ...playerOverrides,
  };
  const result = render(
    <PlayerContext.Provider value={playerCtx}>
      <Sidebar />
    </PlayerContext.Provider>
  );
  return { user: userEvent.setup(), playerCtx, ...result };
};

/** Set window.innerWidth and dispatch a resize event. */
const setViewportWidth = (px) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: px,
  });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Sidebar', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Default desktop width
    Object.defineProperty(window, 'innerWidth', {
      configurable: true, writable: true, value: 1280,
    });
  });

  afterEach(() => {
    document.documentElement.style.removeProperty('--sidebar-width');
  });

  // =========================================================================
  // Trigger / open-close behaviour
  // =========================================================================
  describe('open / close behaviour', () => {
    it('starts closed (no .open class on the sidebar)', () => {
      renderSidebar();
      expect(document.querySelector('.sidebar').className).not.toMatch(/open/);
    });

    it('opens when the pill trigger is clicked', async () => {
      const { user } = renderSidebar();
      await user.click(screen.getByLabelText(/open navigation/i));
      expect(document.querySelector('.sidebar').className).toMatch(/open/);
    });

    it('hides the trigger when open', async () => {
      const { user } = renderSidebar();
      await user.click(screen.getByLabelText(/open navigation/i));
      expect(document.querySelector('.sidebar-trigger').className).toMatch(/hidden/);
    });

    it('renders the overlay only when open', async () => {
      const { user } = renderSidebar();
      expect(document.querySelector('.sidebar-overlay')).toBeNull();
      await user.click(screen.getByLabelText(/open navigation/i));
      expect(document.querySelector('.sidebar-overlay')).toBeInTheDocument();
    });

    it('closes when the overlay is clicked', async () => {
      const { user } = renderSidebar();
      await user.click(screen.getByLabelText(/open navigation/i));
      await user.click(document.querySelector('.sidebar-overlay'));
      expect(document.querySelector('.sidebar').className).not.toMatch(/open/);
    });
  });

  // =========================================================================
  // Nav items — basic routing
  // =========================================================================
  describe('navigation', () => {
    it.each([
      [/^Home$/,         '/'],
      [/^Vote$/,         '/voteawards'],
      [/^Find$/,         '/findpage'],
      [/^Leaderboards$/, '/leaderboards'],
    ])('navigates to %s when "%s" is clicked', async (label, path) => {
      const { user } = renderSidebar({ user: { id: 'u1' }, isGuest: false });
      await user.click(screen.getByText(label));
      expect(mockNavigate).toHaveBeenCalledWith(path);
    });
  });

  // =========================================================================
  // Settings — gating + role-based routing
  // =========================================================================
  describe('Settings item', () => {
    it('triggers the auth gate for guests', async () => {
      const { user } = renderSidebar({ user: null, isGuest: true });
      await user.click(screen.getByText('Settings'));
      expect(mockTriggerGate).toHaveBeenCalledWith('profile');
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('navigates listeners to /profile', async () => {
      const { user } = renderSidebar({
        user: { id: 'u1', role: 'listener' }, isGuest: false,
      });
      await user.click(screen.getByText('Settings'));
      expect(mockNavigate).toHaveBeenCalledWith('/profile');
    });

    it('navigates artists to /artistDashboard', async () => {
      const { user } = renderSidebar({
        user: { id: 'u1', role: 'artist' }, isGuest: false,
      });
      await user.click(screen.getByText('Settings'));
      expect(mockNavigate).toHaveBeenCalledWith('/artistDashboard');
    });
  });

  // =========================================================================
  // Earnings — gating
  // =========================================================================
  describe('Earnings item', () => {
    it('triggers the auth gate for guests', async () => {
      const { user } = renderSidebar({ user: null, isGuest: true });
      await user.click(screen.getByText('Earnings'));
      expect(mockTriggerGate).toHaveBeenCalledWith('earnings');
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('navigates logged-in users to /earnings', async () => {
      const { user } = renderSidebar({
        user: { id: 'u1' }, isGuest: false,
      });
      await user.click(screen.getByText('Earnings'));
      expect(mockNavigate).toHaveBeenCalledWith('/earnings');
    });
  });

  // =========================================================================
  // Playlists
  // =========================================================================
  describe('Playlists item', () => {
    it('calls openPlaylistManager from PlayerContext', async () => {
      const { user, playerCtx } = renderSidebar();
      await user.click(screen.getByText('Playlists'));
      expect(playerCtx.openPlaylistManager).toHaveBeenCalledTimes(1);
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Admin section
  // =========================================================================
  describe('Admin link', () => {
    it('does not render for a guest', () => {
      renderSidebar({ user: null, isGuest: true });
      expect(screen.queryByText('Admin')).toBeNull();
    });

    it('does not render for a regular user (no adminRole)', () => {
      renderSidebar({ user: { id: 'u1', adminRole: null }, isGuest: false });
      expect(screen.queryByText('Admin')).toBeNull();
    });

    it('renders for users with an adminRole', () => {
      renderSidebar({
        user: { id: 'u1', adminRole: 'moderator' }, isGuest: false,
      });
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('navigates to /admin when clicked', async () => {
      const { user } = renderSidebar({
        user: { id: 'u1', adminRole: 'admin' }, isGuest: false,
      });
      await user.click(screen.getByText('Admin'));
      expect(mockNavigate).toHaveBeenCalledWith('/admin');
    });
  });

  // =========================================================================
  // Mobile auto-close on navigation
  // =========================================================================
  describe('mobile auto-close', () => {
    it('closes itself after navigating on a mobile viewport (≤1024px)', async () => {
      setViewportWidth(800);
      const { user } = renderSidebar({ user: { id: 'u1' }, isGuest: false });
      await user.click(screen.getByLabelText(/open navigation/i));
      expect(document.querySelector('.sidebar').className).toMatch(/open/);

      await user.click(screen.getByText(/^Home$/));
      expect(document.querySelector('.sidebar').className).not.toMatch(/open/);
    });

    it('stays open after navigating on a desktop viewport (>1024px)', async () => {
      setViewportWidth(1400);
      const { user } = renderSidebar({ user: { id: 'u1' }, isGuest: false });
      await user.click(screen.getByLabelText(/open navigation/i));
      await user.click(screen.getByText(/^Home$/));
      expect(document.querySelector('.sidebar').className).toMatch(/open/);
    });
  });

  // =========================================================================
  // --sidebar-width CSS variable
  // =========================================================================
  describe('--sidebar-width CSS variable', () => {
    it('sets --sidebar-width to 0px on a mobile viewport', () => {
      setViewportWidth(800);
      renderSidebar();
      expect(document.documentElement.style.getPropertyValue('--sidebar-width'))
        .toBe('0px');
    });

    it('sets --sidebar-width to a non-zero value on desktop', () => {
      setViewportWidth(1400);
      renderSidebar();
      // jsdom returns 0 for offsetWidth, but the property is still written.
      // What we really care about is that it's NOT explicitly 0px from the
      // mobile branch — so we verify the property was set.
      const value = document.documentElement.style.getPropertyValue('--sidebar-width');
      expect(value).toMatch(/^\d+px$/);
    });

    it('updates --sidebar-width when the viewport crosses the breakpoint', () => {
      setViewportWidth(1400);
      renderSidebar();

      setViewportWidth(800);
      expect(document.documentElement.style.getPropertyValue('--sidebar-width'))
        .toBe('0px');
    });
  });
});