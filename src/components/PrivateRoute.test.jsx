// src/components/PrivateRoute.test.jsx
//
// PrivateRoute wraps the browsable part of the app. It does NOT turn guests
// away — guests can browse freely, and each feature (voting, earnings,
// messages…) gates itself. Its one job is to hold the page back until the
// sign-in check has finished, so nobody sees a flash of the wrong state.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const authState = vi.hoisted(() => ({ authLoaded: true, user: null }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));

import PrivateRoute from './PrivateRoute';

const renderAt = (path = '/feed') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PrivateRoute />}>
          <Route path="/feed" element={<div data-testid="page">Feed</div>} />
          <Route path="/artist/:id" element={<div data-testid="page">Artist</div>} />
        </Route>
        <Route path="/login" element={<div data-testid="login">Login</div>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  authState.authLoaded = true;
  authState.user = null;
});

describe('PrivateRoute', () => {
  it('renders nothing while the sign-in check is still running', () => {
    authState.authLoaded = false;
    const { container } = renderAt();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the page for a guest once the check is done — no redirect to login', () => {
    renderAt();
    expect(screen.getByTestId('page')).toHaveTextContent('Feed');
    expect(screen.queryByTestId('login')).not.toBeInTheDocument();
  });

  it('renders the page for a signed-in user', () => {
    authState.user = { userId: 'user-1' };
    renderAt('/artist/abc');
    expect(screen.getByTestId('page')).toHaveTextContent('Artist');
  });

  it('holds back for a signed-in user too until the check is done', () => {
    authState.authLoaded = false;
    authState.user = { userId: 'user-1' };
    const { container } = renderAt();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the page as soon as the check completes', () => {
    authState.authLoaded = false;
    const { rerender, container } = renderAt();
    expect(container).toBeEmptyDOMElement();

    authState.authLoaded = true;
    rerender(
      <MemoryRouter initialEntries={['/feed']}>
        <Routes>
          <Route element={<PrivateRoute />}>
            <Route path="/feed" element={<div data-testid="page">Feed</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId('page')).toBeInTheDocument();
  });
});
