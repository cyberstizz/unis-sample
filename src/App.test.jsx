// src/App.test.jsx
//
// Structural / routing tests for App and its AppLayout helper.
//
// Strategy: render AppLayout (not the full App) inside a MemoryRouter so we
// can control the initial URL, and mock useAuth to control auth state.
// Every page-level component is stubbed to a single div so tests stay fast
// and don't pull in their own dependency trees.
 
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
 
// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that pull these in
// ---------------------------------------------------------------------------
 
// Auth context
vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => <>{children}</>,
  useAuth: vi.fn(),
}));
 
// Player context
vi.mock('./context/playercontext', () => ({
  PlayerProvider: ({ children }) => <>{children}</>,
}));
 
// Activity tracker — side-effect hook, no UI
vi.mock('./hooks/useActivityTracker', () => ({ default: vi.fn() }));
 
// Route guards — keep them thin so we can test the real AuthRequiredRoute
vi.mock('./components/PrivateRoute', () => ({
  default: () => {
    const { Outlet } = require('react-router-dom');
    return <Outlet />;
  },
}));
 
vi.mock('./AdminRoute', () => ({
  default: () => null, // admin routes not under test here
}));
 
// Stub every page/component so they don't pull in their own deps
const stub = (name) => () => <div data-testid={name} />;
 
vi.mock('./player',              () => ({ default: stub('Player') }));
vi.mock('./sidebar',             () => ({ default: stub('Sidebar') }));
vi.mock('./feed',                () => ({ default: stub('Feed') }));
vi.mock('./artistpage',          () => ({ default: stub('ArtistPage') }));
vi.mock('./songPage',            () => ({ default: stub('SongPage') }));
vi.mock('./voteawards',          () => ({ default: stub('VoteAwards') }));
vi.mock('./profile',             () => ({ default: stub('Profile') }));
vi.mock('./milestonesPage',      () => ({ default: stub('MilestonesPage') }));
vi.mock('./leaderboardsPage',    () => ({ default: stub('Leaderboards') }));
vi.mock('./earnings',            () => ({ default: stub('Earnings') }));
vi.mock('./findpage',            () => ({ default: stub('FindPage') }));
vi.mock('./privacyPolicy',       () => ({ default: stub('PrivacyPolicy') }));
vi.mock('./termsOfService',      () => ({ default: stub('TermsOfService') }));
vi.mock('./cookiePolicy',        () => ({ default: stub('CookiePolicy') }));
vi.mock('./reportInfringement',  () => ({ default: stub('ReportInfringement') }));
vi.mock('./songNotification',    () => ({ default: stub('SongNotification') }));
vi.mock('./artistDashboard',     () => ({ default: stub('ArtistDashboard') }));
vi.mock('./jurisdictionPage',    () => ({ default: stub('JurisdictionPage') }));
vi.mock('./pages/Login',         () => ({ default: stub('Login') }));
vi.mock('./pages/ResetPassword', () => ({ default: stub('ResetPassword') }));
vi.mock('./winnersNotification', () => ({ default: stub('WinnersNotification') }));
vi.mock('./WaitlistPage',        () => ({ default: stub('WaitlistPage') }));
vi.mock('./pages/SearchResultsPage', () => ({ default: stub('SearchResultsPage') }));
vi.mock('./PlayChoiceModal',     () => ({ default: stub('PlayChoiceModal') }));
vi.mock('./admin/AdminDashboard',    () => ({ default: stub('AdminDashboard') }));
vi.mock('./admin/ModerationQueue',   () => ({ default: stub('ModerationQueue') }));
vi.mock('./admin/DmcaClaimDetail',   () => ({ default: stub('DmcaClaimDetail') }));
vi.mock('./admin/UserManagement',    () => ({ default: stub('UserManagement') }));
vi.mock('./admin/UserDetail',        () => ({ default: stub('UserDetail') }));
vi.mock('./admin/AnalyticsPage',     () => ({ default: stub('AnalyticsPage') }));
vi.mock('./admin/AuditLog',          () => ({ default: stub('AuditLog') }));
vi.mock('./admin/RoleManagement',    () => ({ default: stub('RoleManagement') }));
vi.mock('./admin/AdminPlaylistPage', () => ({ default: stub('AdminPlaylistPage') }));
vi.mock('./theme.scss', () => ({}));
 
// ---------------------------------------------------------------------------
// Now import the component under test (after mocks are set up)
// ---------------------------------------------------------------------------
import { useAuth } from './context/AuthContext';
 
// We test AppLayout directly; it must be exported. If it's not exported yet,
// the simplest fix is to add `export` in front of `const AppLayout` in App.jsx.
// Alternatively, import the default App and wrap it — see the note at the end.
import App from './App';
 
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
 
/** Render the full App tree navigated to `path`. */
const renderAt = (path, authOverrides = {}) => {
  useAuth.mockReturnValue({
    user: null,
    authLoaded: true,
    ...authOverrides,
  });
 
  // App already contains its own Router; we can't wrap it in MemoryRouter.
  // Instead we render App and let BrowserRouter start at '/'. For specific
  // routes we use window.history.pushState to set the URL before rendering.
  window.history.pushState({}, '', path);
  return render(<App />);
};
 
const loggedInUser = { id: 'u1', username: 'alice', role: 'listener' };
 
// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
 
describe('App', () => {
 
  beforeEach(() => {
    vi.clearAllMocks();
  });
 
  // =========================================================================
  // Smoke test
  // =========================================================================
  it('renders without crashing', () => {
    renderAt('/');
    // Something renders — the Feed stub or the app wrapper
    expect(document.querySelector('.app-wrapper')).toBeInTheDocument();
  });
 
  // =========================================================================
  // Public routes — no auth required
  // =========================================================================
  describe('public routes', () => {
    it.each([
      ['/login',          'Login'],
      ['/reset-password', 'ResetPassword'],
      ['/privacy',        'PrivacyPolicy'],
      ['/terms',          'TermsOfService'],
      ['/cookie',         'CookiePolicy'],
      ['/report',         'ReportInfringement'],
      ['/waitlist',       'WaitlistPage'],
    ])('renders %s without authentication', (path, testId) => {
      renderAt(path);
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });
  });
 
  // =========================================================================
  // Browsable routes — PrivateRoute passes guests through (mocked above)
  // =========================================================================
  describe('browsable routes', () => {
    it.each([
      ['/',           'Feed'],
      ['/milestones', 'MilestonesPage'],
      ['/leaderboards','Leaderboards'],
      ['/findpage',   'FindPage'],
      ['/search',     'SearchResultsPage'],
    ])('renders %s for a guest user', (path, testId) => {
      renderAt(path);
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    });
  });
 
  // =========================================================================
  // AuthRequiredRoute — guest is redirected to /login
  // =========================================================================
  describe('AuthRequiredRoute', () => {
    it.each([
      '/voteawards',
      '/profile',
      '/earnings',
      '/artistDashboard',
    ])('redirects guest from %s to /login', async (path) => {
      renderAt(path, { user: null, authLoaded: true });
      await waitFor(() =>
        expect(screen.getByTestId('Login')).toBeInTheDocument()
      );
    });
 
    it('renders the protected page for a logged-in user', async () => {
      renderAt('/profile', { user: loggedInUser, authLoaded: true });
      await waitFor(() =>
        expect(screen.getByTestId('Profile')).toBeInTheDocument()
      );
    });
 
    it('renders nothing while auth is still loading (authLoaded=false)', () => {
      renderAt('/profile', { user: null, authLoaded: false });
      // AuthRequiredRoute returns null while loading — no redirect yet
      expect(screen.queryByTestId('Login')).toBeNull();
      expect(screen.queryByTestId('Profile')).toBeNull();
    });
  });
 
  // =========================================================================
  // Sidebar visibility
  // =========================================================================
  describe('Sidebar visibility', () => {
    it('renders Sidebar on a normal page', () => {
      renderAt('/', { user: loggedInUser });
      expect(screen.getByTestId('Sidebar')).toBeInTheDocument();
    });
 
    it('hides Sidebar on /login', () => {
      renderAt('/login');
      expect(screen.queryByTestId('Sidebar')).toBeNull();
    });
 
    it('hides Sidebar on /reset-password', () => {
      renderAt('/reset-password');
      expect(screen.queryByTestId('Sidebar')).toBeNull();
    });
  });
 
  // =========================================================================
  // Player / PlayChoiceModal / SongNotification visibility
  // =========================================================================
  describe('Player and modal visibility', () => {
    it('renders Player on a normal page', () => {
      renderAt('/', { user: loggedInUser });
      expect(screen.getByTestId('Player')).toBeInTheDocument();
    });
 
    it('hides Player on /login', () => {
      renderAt('/login');
      expect(screen.queryByTestId('Player')).toBeNull();
    });
 
    it('hides Player on /reset-password', () => {
      renderAt('/reset-password');
      expect(screen.queryByTestId('Player')).toBeNull();
    });
 
    it('renders PlayChoiceModal on a normal page', () => {
      renderAt('/', { user: loggedInUser });
      expect(screen.getByTestId('PlayChoiceModal')).toBeInTheDocument();
    });
 
    it('hides PlayChoiceModal on /login', () => {
      renderAt('/login');
      expect(screen.queryByTestId('PlayChoiceModal')).toBeNull();
    });
 
    it('renders SongNotification on a normal page', () => {
      renderAt('/', { user: loggedInUser });
      expect(screen.getByTestId('SongNotification')).toBeInTheDocument();
    });
 
    it('hides SongNotification on auth pages', () => {
      renderAt('/login');
      expect(screen.queryByTestId('SongNotification')).toBeNull();
    });
  });
 
  // =========================================================================
  // WinnersNotification — only for logged-in users on non-auth pages
  // =========================================================================
  describe('WinnersNotification', () => {
    it('renders for a logged-in user on a normal page', () => {
      renderAt('/', { user: loggedInUser });
      expect(screen.getByTestId('WinnersNotification')).toBeInTheDocument();
    });
 
    it('does not render for a guest', () => {
      renderAt('/', { user: null });
      expect(screen.queryByTestId('WinnersNotification')).toBeNull();
    });
 
    it('does not render on /login even when user is set', () => {
      renderAt('/login', { user: loggedInUser });
      expect(screen.queryByTestId('WinnersNotification')).toBeNull();
    });
  });
});
