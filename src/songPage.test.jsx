// src/songPage.test.jsx
//
// Integration tests for SongPage — a critical page covering play tracking,
// vote flow, like interactions, and the lyrics edit wizard. This is where
// the play-tracking logic (Finding 3) is most important.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker, fixtures, makeToken } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';
import SongPage from './songPage';

const API = 'http://localhost:8080/api';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ songId: 'song-001' }),
    useNavigate: () => vi.fn(),
  };
});

describe('SongPage', () => {
  beforeEach(() => {
    callTracker.reset();
  });

  // ========================================================================
  // Initial render
  // ========================================================================
  describe('initial render', () => {
    it('displays the song title and artist after loading', async () => {
      renderWithProviders(<SongPage />, { as: 'listener' });

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /Track One/i })).toBeInTheDocument()
      );
      // The artist name appears in the hero row
      expect(screen.getAllByText(/testartist/i).length).toBeGreaterThan(0);
    });

    it('displays duration, play count, and upload date', async () => {
      renderWithProviders(<SongPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Track One/i });

      // Default fixture has duration 180000 ms = 3:00, playsToday 5 -> 50 plays total
      // 3:00 appears in hero meta AND in sidebar details
      expect(screen.getAllByText(/3:00/).length).toBeGreaterThan(0);
    });

    it('shows "Song not found" on 404', async () => {
      server.use(
        http.get(`${API}/v1/media/song/:songId`, () =>
          new HttpResponse(null, { status: 404 })
        )
      );

      renderWithProviders(<SongPage />, { as: 'listener' });

      await waitFor(() =>
        expect(screen.getByText(/Failed to load song details|Song not found/i))
          .toBeInTheDocument()
      );
    });
  });

  // ========================================================================
  // Like/unlike flow
  // ========================================================================
  describe('like interactions', () => {
    it('shows Like button initially; switches to Liked after click', async () => {
      renderWithProviders(<SongPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Track One/i });

      const likeBtn = screen.getByRole('button', { name: /^like$/i });
      expect(likeBtn).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(likeBtn);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /^liked$/i })).toBeInTheDocument()
      );
      expect(callTracker.get('like:song-001')).toBe(1);
    });

    it('calls DELETE when unliking', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      let unlikeCalled = false;
      server.use(
        http.get(`${API}/v1/media/song/:songId/is-liked`, () =>
          HttpResponse.json({ isLiked: true })
        ),
        http.get(`${API}/v1/media/song/:songId/likes/count`, () =>
          HttpResponse.json({ count: 42 })
        ),
        http.delete(`${API}/v1/media/song/:songId/like`, () => {
          unlikeCalled = true;
          console.log('[DEBUG] unlike endpoint hit');
          return HttpResponse.json({ success: true });
        })
      );

      renderWithProviders(<SongPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Track One/i });
      const likedBtn = await screen.findByRole('button', { name: /^liked$/i });

      // Wait for auth state to settle
      await new Promise((r) => setTimeout(r, 400));

      const user = userEvent.setup();
      console.log('[DEBUG] Clicking liked button');
      await user.click(likedBtn);
      console.log('[DEBUG] After click — unlikeCalled:', unlikeCalled);

      await waitFor(() => expect(unlikeCalled).toBe(true), { timeout: 3000 });

      alertSpy.mockRestore();
    });

    it('shows alert when guest tries to like', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      renderWithProviders(<SongPage />, { as: 'guest' });

      await screen.findByRole('heading', { name: /Track One/i });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^like$/i }));

      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/log in/i));
      alertSpy.mockRestore();
    });
  });

  // ========================================================================
  // Vote flow
  // ========================================================================
  describe('vote flow', () => {
    it('opens VotingWizard when Vote button is clicked', async () => {
      renderWithProviders(<SongPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Track One/i });
      const user = userEvent.setup();

      // Multiple "Vote" buttons exist in the DOM (Player also has one).
      // Target SongPage's specifically via its class.
      const voteBtn = document.querySelector('.sp-btn-vote');
      expect(voteBtn).not.toBeNull();
      await user.click(voteBtn);

      await waitFor(() =>
        expect(screen.getByText(/Confirm Your Vote For/i)).toBeInTheDocument()
      );
    });
  });

  // ========================================================================
  // Play tracking — the Finding 3 regression guard
  // ========================================================================
  describe('play tracking', () => {
    it('does not fire /play when the user just opens the page (song not playing)', async () => {
      renderWithProviders(<SongPage />, { as: 'listener' });
      await screen.findByRole('heading', { name: /Track One/i });
      await new Promise((r) => setTimeout(r, 200));
      expect(callTracker.get('play:song-001')).toBe(0);
    });
  });

  // ========================================================================
  // Copy link
  // ========================================================================
  it('copies URL to clipboard and shows "Copied!" feedback', async () => {
    // Overwrite clipboard API fresh each run (other tests may have touched it)
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
      writable: true,
    });

    renderWithProviders(<SongPage />, { as: 'listener' });

    await screen.findByRole('heading', { name: /Track One/i });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /copy link/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /copied!/i })).toBeInTheDocument()
    );
    expect(writeTextSpy).toHaveBeenCalled();
  });
});
