// src/test/utils.jsx
// Custom render helper that wraps components in the providers they expect.

import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { PlayerProvider } from '../context/playercontext';
import { makeToken, fixtures } from './mocks/handlers';

/**
 * Render a component inside the full Unis provider tree.
 *
 * @param {ReactNode} ui — component to render
 * @param {Object} options
 * @param {string} [options.route='/'] — initial route for MemoryRouter
 * @param {'guest'|'listener'|'artist'} [options.as='guest'] — auth state
 */
export function renderWithProviders(ui, { route = '/', as = 'guest', ...rest } = {}) {
  if (as === 'listener') {
    localStorage.setItem('token', makeToken(fixtures.users.listener.userId));
  } else if (as === 'artist') {
    localStorage.setItem('token', makeToken(fixtures.users.artist.userId));
  }

  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <PlayerProvider>{ui}</PlayerProvider>
      </AuthProvider>
    </MemoryRouter>,
    rest
  );
}

/**
 * Wait for all pending promises to resolve. Useful after mounting components
 * that fire async effects (AuthContext profile fetch, etc.).
 */
export const flushPromises = () => new Promise((r) => setTimeout(r, 0));
