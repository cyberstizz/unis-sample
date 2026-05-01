// src/Header.test.jsx
//
// Unit tests for Header. Covers:
// - Logo: theme-driven asset, click → home, breathe animation gating via sessionStorage
// - Search: desktop SearchBar + mobile overlay (open / close via backdrop / Cancel)
// - Nav items: navigate vs auth-gate (Vote / Earnings) and active highlighting
// - User dropdown: open/close, avatar fallback, Profile, Logout, outside-click close
// - Guest actions: Sign In / Sign Up route to /login

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks (declared before the component import)
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
const mockLocation = { pathname: '/' };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
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

vi.mock('./components/SearchBar', () => ({
  default: ({ onMobileSelect }) => (
    <div data-testid="SearchBar" data-mobile={!!onMobileSelect} />
  ),
}));

vi.mock('./utils/buildUrl', () => ({
  buildUrl: (path) => (path ? `https://cdn.test${path}` : null),
}));

// Stub asset imports — Vitest needs these resolved
vi.mock('./assets/unisLogoThree.svg', () => ({ default: '/logo-blue.svg' }));
vi.mock('./assets/logo-orange.png',   () => ({ default: '/logo-orange.png' }));
vi.mock('./assets/logo-red.png',      () => ({ default: '/logo-red.png' }));
vi.mock('./assets/logo-green.png',    () => ({ default: '/logo-green.png' }));
vi.mock('./assets/logo-purple.png',   () => ({ default: '/logo-purple.png' }));
vi.mock('./assets/logo-gold.png',     () => ({ default: '/logo-gold.png' }));
vi.mock('./assets/logo-dianna.png',   () => ({ default: '/logo-dianna.png' }));
vi.mock('./header.scss', () => ({}));

import Header from './header';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const loggedInUser = {
  id: 'u1',
  username: 'alice',
  photoUrl: null,
};

const setAuth = (overrides = {}) => {
  mockUseAuth.mockReturnValue({
    user: null,
    isGuest: true,
    logout: vi.fn(),
    theme: 'blue',
    ...overrides,
  });
};

const renderHeader = (authOverrides = {}, pathname = '/') => {
  mockLocation.pathname = pathname;
  setAuth(authOverrides);
  return { user: userEvent.setup(), ...render(<Header />) };
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Header', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  // =========================================================================
  // Logo
  // =========================================================================
  describe('logo', () => {
    it('renders the blue logo by default', () => {
      renderHeader({ theme: 'blue' });
      expect(screen.getByAltText('UNIS').getAttribute('src')).toBe('/logo-blue.svg');
    });

    it.each([
      ['orange', '/logo-orange.png'],
      ['red',    '/logo-red.png'],
      ['green',  '/logo-green.png'],
      ['purple', '/logo-purple.png'],
      ['yellow', '/logo-gold.png'],
      ['dianna', '/logo-dianna.png'],
    ])('renders the %s logo when theme=%s', (theme, expectedSrc) => {
      renderHeader({ theme });
      expect(screen.getByAltText('UNIS').getAttribute('src')).toBe(expectedSrc);
    });

    it('falls back to the blue logo when theme is unknown', () => {
      renderHeader({ theme: 'puce' });
      expect(screen.getByAltText('UNIS').getAttribute('src')).toBe('/logo-blue.svg');
    });

    it('navigates to / when the logo is clicked from a non-home page', async () => {
      const { user } = renderHeader({}, '/song/abc');
      await user.click(screen.getByLabelText(/go to unis home/i));
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('does NOT navigate when the logo is clicked while already on /', async () => {
      const { user } = renderHeader({}, '/');
      await user.click(screen.getByLabelText(/go to unis home/i));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Breathe animation (sessionStorage gated)
  // =========================================================================
  describe('breathe animation', () => {
    it('applies logo-breathe on first render of the session', () => {
      renderHeader();
      expect(screen.getByAltText('UNIS').className).toMatch(/logo-breathe/);
    });

    it('sets sessionStorage flag after first render', () => {
      renderHeader();
      expect(sessionStorage.getItem('unis-logo-breathed')).toBe('true');
    });

    it('does NOT apply logo-breathe if the flag is already set', () => {
      sessionStorage.setItem('unis-logo-breathed', 'true');
      renderHeader();
      expect(screen.getByAltText('UNIS').className).not.toMatch(/logo-breathe/);
    });

    it('does not throw when sessionStorage is unavailable', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError: storage disabled');
      });
      expect(() => renderHeader()).not.toThrow();
      spy.mockRestore();
    });
  });

  // =========================================================================
  // Search
  // =========================================================================
  describe('search', () => {
    it('renders the desktop SearchBar in the header center', () => {
      renderHeader();
      // The desktop bar is rendered without an onMobileSelect prop
      const bars = screen.getAllByTestId('SearchBar');
      expect(bars.some((b) => b.dataset.mobile === 'false')).toBe(true);
    });

    it('does not show the mobile overlay until the trigger is clicked', () => {
      renderHeader();
      expect(document.querySelector('.mobile-search-overlay')).toBeNull();
    });

    it('opens the mobile search overlay when the trigger is clicked', async () => {
      const { user } = renderHeader();
      await user.click(screen.getByLabelText(/^search$/i));
      expect(document.querySelector('.mobile-search-overlay')).toBeInTheDocument();
    });

    it('closes the mobile overlay when Cancel is clicked', async () => {
      const { user } = renderHeader();
      await user.click(screen.getByLabelText(/^search$/i));
      await user.click(screen.getByLabelText(/close search/i));
      expect(document.querySelector('.mobile-search-overlay')).toBeNull();
    });

    it('closes the mobile overlay when the backdrop is clicked', async () => {
      const { user } = renderHeader();
      await user.click(screen.getByLabelText(/^search$/i));
      await user.click(document.querySelector('.mobile-search-overlay'));
      expect(document.querySelector('.mobile-search-overlay')).toBeNull();
    });

    it('does NOT close the overlay when the inner container is clicked', async () => {
      const { user } = renderHeader();
      await user.click(screen.getByLabelText(/^search$/i));
      await user.click(document.querySelector('.mobile-search-container'));
      expect(document.querySelector('.mobile-search-overlay')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Nav items — navigation vs auth gating
  // =========================================================================
  describe('nav items', () => {
    it('renders all four nav items', () => {
      renderHeader();
      expect(screen.getByRole('button', { name: /vote/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /awards/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /find/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /earnings/i })).toBeInTheDocument();
    });

    describe('Vote', () => {
      it('navigates to /voteawards for a logged-in user', async () => {
        const { user } = renderHeader({ user: loggedInUser, isGuest: false });
        await user.click(screen.getByRole('button', { name: /vote/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/voteawards');
        expect(mockTriggerGate).not.toHaveBeenCalled();
      });

      it('triggers the auth gate for a guest', async () => {
        const { user } = renderHeader({ user: null, isGuest: true });
        await user.click(screen.getByRole('button', { name: /vote/i }));
        expect(mockTriggerGate).toHaveBeenCalledWith('vote');
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    describe('Earnings', () => {
      it('navigates to /earnings for a logged-in user', async () => {
        const { user } = renderHeader({ user: loggedInUser, isGuest: false });
        await user.click(screen.getByRole('button', { name: /earnings/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/earnings');
        expect(mockTriggerGate).not.toHaveBeenCalled();
      });

      it('triggers the auth gate for a guest', async () => {
        const { user } = renderHeader({ user: null, isGuest: true });
        await user.click(screen.getByRole('button', { name: /earnings/i }));
        expect(mockTriggerGate).toHaveBeenCalledWith('earnings');
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    describe('Awards & Find (no auth required)', () => {
      it('Awards navigates to /milestones even for guests', async () => {
        const { user } = renderHeader({ isGuest: true });
        await user.click(screen.getByRole('button', { name: /awards/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/milestones');
        expect(mockTriggerGate).not.toHaveBeenCalled();
      });

      it('Find navigates to /findpage even for guests', async () => {
        const { user } = renderHeader({ isGuest: true });
        await user.click(screen.getByRole('button', { name: /find/i }));
        expect(mockNavigate).toHaveBeenCalledWith('/findpage');
        expect(mockTriggerGate).not.toHaveBeenCalled();
      });
    });

    describe('active highlighting', () => {
      it.each([
        ['/voteawards', /vote/i],
        ['/milestones', /awards/i],
        ['/findpage',   /find/i],
        ['/earnings',   /earnings/i],
      ])('marks the matching nav item active when pathname=%s', (path, label) => {
        renderHeader({}, path);
        expect(screen.getByRole('button', { name: label }).className)
          .toMatch(/active/);
      });

      it('does not mark any nav item active on /', () => {
        renderHeader({}, '/');
        ['vote', 'awards', 'find', 'earnings'].forEach((name) => {
          const btn = screen.getByRole('button', { name: new RegExp(name, 'i') });
          expect(btn.className).not.toMatch(/active/);
        });
      });
    });
  });

  // =========================================================================
  // User dropdown (logged in)
  // =========================================================================
  describe('user dropdown (logged in)', () => {
    it('shows the user avatar', () => {
      renderHeader({ user: loggedInUser, isGuest: false });
      expect(screen.getByLabelText(/user menu/i)).toBeInTheDocument();
    });

    it('shows the username initial when there is no photoUrl', () => {
      renderHeader({ user: { ...loggedInUser, username: 'alice' }, isGuest: false });
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('falls back to "U" when the user has no username', () => {
      renderHeader({ user: { ...loggedInUser, username: null }, isGuest: false });
      expect(screen.getByText('U')).toBeInTheDocument();
    });

    it('renders the avatar image when photoUrl is present', () => {
      renderHeader(
        { user: { ...loggedInUser, photoUrl: '/photo.jpg' }, isGuest: false }
      );
      const img = screen.getByAltText(/user avatar/i);
      expect(img.getAttribute('src')).toBe('https://cdn.test/photo.jpg');
    });

    it('does not show the dropdown by default', () => {
      renderHeader({ user: loggedInUser, isGuest: false });
      expect(screen.queryByText(/log out/i)).toBeNull();
    });

    it('opens the dropdown when the avatar is clicked', async () => {
      const { user } = renderHeader({ user: loggedInUser, isGuest: false });
      await user.click(screen.getByLabelText(/user menu/i));
      expect(screen.getByText(/log out/i)).toBeInTheDocument();
      expect(screen.getByText(/profile/i)).toBeInTheDocument();
    });

    it('shows the username in the dropdown header', async () => {
      const { user } = renderHeader({ user: loggedInUser, isGuest: false });
      await user.click(screen.getByLabelText(/user menu/i));
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    it('navigates to /profile and closes the dropdown when Profile is clicked', async () => {
      const { user } = renderHeader({ user: loggedInUser, isGuest: false });
      await user.click(screen.getByLabelText(/user menu/i));
      await user.click(screen.getByRole('button', { name: /profile/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/profile');
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: /log out/i })).toBeNull()
      );
    });

    it('calls logout when Log out is clicked', async () => {
      const logout = vi.fn();
      const { user } = renderHeader({ user: loggedInUser, isGuest: false, logout });
      await user.click(screen.getByLabelText(/user menu/i));
      await user.click(screen.getByRole('button', { name: /log out/i }));
      expect(logout).toHaveBeenCalled();
    });

    it('closes the dropdown when clicking outside', async () => {
      const { user } = renderHeader({ user: loggedInUser, isGuest: false });
      await user.click(screen.getByLabelText(/user menu/i));
      expect(screen.getByText(/log out/i)).toBeInTheDocument();
      // Click the body, outside the menuRef
      await user.click(document.body);
      await waitFor(() => expect(screen.queryByText(/log out/i)).toBeNull());
    });

    it('does not render the guest sign-in/sign-up buttons', () => {
      renderHeader({ user: loggedInUser, isGuest: false });
      expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /sign up/i })).toBeNull();
    });
  });

  // =========================================================================
  // Guest actions
  // =========================================================================
  describe('guest actions', () => {
    it('renders Sign In and Sign Up buttons', () => {
      renderHeader({ user: null, isGuest: true });
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
    });

    it('does not render the user avatar', () => {
      renderHeader({ user: null, isGuest: true });
      expect(screen.queryByLabelText(/user menu/i)).toBeNull();
    });

    it('navigates to /login when Sign In is clicked', async () => {
      const { user } = renderHeader({ user: null, isGuest: true });
      await user.click(screen.getByRole('button', { name: /sign in/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('navigates to /login when Sign Up is clicked', async () => {
      const { user } = renderHeader({ user: null, isGuest: true });
      await user.click(screen.getByRole('button', { name: /sign up/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });
});