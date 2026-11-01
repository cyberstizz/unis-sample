// src/test/utils.jsx
// Custom render helper that wraps components in the providers they expect.

import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { PlayerProvider } from '../context/playercontext';
import { makeToken, fixtures } from './mocks/handlers';

/**
 * Render a component inside the full Unis provider tree.
 *
 * @param {ReactNode} ui — component to render
 * @param {Object} options
 * @param {string} [options.route='/'] — initial route for MemoryRouter
 * @param {'guest'|'listener'|'artist'} [options.as='guest'] — auth state
 *
 * FeedbackProvider is part of the tree (as it is in App.jsx), so a test can
 * assert what the user is told: `await screen.findByText(/liked/i)` finds the
 * toast, which renders into document.body.
 */
export function renderWithProviders(ui, { route = '/', as = 'guest', ...rest } = {}) {
  if (as === 'listener') {
    localStorage.setItem('token', makeToken(fixtures.users.listener.userId));
  } else if (as === 'artist') {
    localStorage.setItem('token', makeToken(fixtures.users.artist.userId));
  }

  return render(
    <MemoryRouter initialEntries={[route]}>
      <FeedbackProvider>
        <AuthProvider>
          <PlayerProvider>{ui}</PlayerProvider>
        </AuthProvider>
      </FeedbackProvider>
    </MemoryRouter>,
    rest
  );
}

/**
 * Wait for all pending promises to resolve. Useful after mounting components
 * that fire async effects (AuthContext profile fetch, etc.).
 */
export const flushPromises = () => new Promise((r) => setTimeout(r, 0));
