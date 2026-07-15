// src/context/AuthContext.stale-session.test.jsx
//
// Regression coverage for the "logged in everywhere but Profile/Dashboard says
// sign in" bug. Root cause: the JWT has a 24h `exp` (backend
// spring.jwt.expiration = 86400000ms) that the client never checked. A day
// after login the token was dead, `user` stayed in memory (avatar still showed),
// and only Profile/Artist Dashboard — the pages that make a fresh authenticated
// GET on entry — surfaced the 401.
//
// These tests lock in the fix: an already-expired token is treated as no
// session at all, and a 401 mid-session tears the session down in-app.

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { makeToken, fixtures } from '../test/mocks/handlers';
import { renderWithProviders } from '../test/utils';

const API = 'http://localhost:8080/api';

// A tiny probe component that surfaces the auth state to the DOM.
import { useAuth } from './AuthContext';
function AuthProbe() {
  const { user, isGuest, authLoaded } = useAuth();
  return (
    <div>
      <span data-testid="loaded">{String(authLoaded)}</span>
      <span data-testid="guest">{String(isGuest)}</span>
      <span data-testid="user">{user ? user.userId : 'none'}</span>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('AuthContext — stale/expired session', () => {
  it('treats an already-expired token as guest (no profile fetch)', async () => {
    // token that expired 60s ago
    localStorage.setItem(
      'token',
      makeToken(fixtures.users.listener.userId, { expSecondsFromNow: -60 })
    );

    let profileFetched = false;
    server.use(
      http.get(`${API}/v1/users/profile/:id`, () => {
        profileFetched = true;
        return HttpResponse.json(fixtures.users.listener);
      })
    );

    renderWithProviders(<AuthProbe />, { as: 'guest' }); // don't overwrite our token

    await waitFor(() =>
      expect(screen.getByTestId('loaded')).toHaveTextContent('true')
    );

    expect(screen.getByTestId('guest')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    // The doomed request must never fire for an already-expired token.
    expect(profileFetched).toBe(false);
    // And the dead token should be cleared.
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('keeps a valid (future-exp) token and loads the user', async () => {
    localStorage.setItem(
      'token',
      makeToken(fixtures.users.listener.userId, { expSecondsFromNow: 3600 })
    );

    server.use(
      http.get(`${API}/v1/users/profile/:id`, () =>
        HttpResponse.json(fixtures.users.listener)
      ),
      http.get(`${API}/v1/admin/roles`, () => HttpResponse.json([]))
    );

    renderWithProviders(<AuthProbe />, { as: 'guest' });

    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent(
        fixtures.users.listener.userId
      )
    );
    expect(screen.getByTestId('guest')).toHaveTextContent('false');
  });

  it('clears the session in-app when a session-expired event fires', async () => {
    localStorage.setItem(
      'token',
      makeToken(fixtures.users.listener.userId, { expSecondsFromNow: 3600 })
    );
    server.use(
      http.get(`${API}/v1/users/profile/:id`, () =>
        HttpResponse.json(fixtures.users.listener)
      ),
      http.get(`${API}/v1/admin/roles`, () => HttpResponse.json([]))
    );

    renderWithProviders(<AuthProbe />, { as: 'guest' });
    await waitFor(() =>
      expect(screen.getByTestId('user')).toHaveTextContent(
        fixtures.users.listener.userId
      )
    );

    // Simulate the interceptor's 401 signal (expired mid-session).
    act(() => {
      window.dispatchEvent(new CustomEvent('unis:session-expired'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('guest')).toHaveTextContent('true')
    );
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(localStorage.getItem('token')).toBeNull();
  });
});