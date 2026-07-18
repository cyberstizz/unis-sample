// src/videoPage.test.jsx
//
// Integration tests for VideoPage — the YouTube-style watch page. Covers
// initial render, error states, the like flow, one-play-per-visit tracking
// (fired from the <video> element's play event), guest behavior, the
// expandable description, copy link, and mutual exclusion with the global
// audio player.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';
import VideoPage from './videoPage';

const API = 'http://localhost:8080/api';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ videoId: 'video-001' }),
    useNavigate: () => vi.fn(),
  };
});

describe('VideoPage', () => {
  beforeEach(() => {
    callTracker.reset();
    // Same cache-pollution guard as songPage.test: clear apiCall cache so
    // server.use() overrides aren't bypassed by cached is-liked responses.
    cacheService.clearAll();
  });

  // ========================================================================
  // Initial render
  // ========================================================================
  describe('initial render', () => {
    it('displays the video title and artist after loading', async () => {
      renderWithProviders(<VideoPage />, { as: 'listener' });

      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /Video One/i })).toBeInTheDocument()
      );
      expect(screen.getAllByText(/testartist/i).length).toBeGreaterThan(0);
    });

    it('renders the video element with the media source', async () => {
      renderWithProviders(<VideoPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Video One/i });

      const videoEl = screen.getByTestId('vp-video');
      expect(videoEl).toBeInTheDocument();
      expect(videoEl).toHaveAttribute('src', expect.stringContaining('video-001.mp4'));
      expect(videoEl).toHaveAttribute('controls');
      expect(videoEl).toHaveAttribute('playsinline');
    });

    it('displays plays, upload date, and duration in the description card', async () => {
      renderWithProviders(<VideoPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Video One/i });

      // Fixture: playsToday 4 -> playCount 40; duration 120000 ms = 2:00
      expect(screen.getAllByText(/40 plays/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/2:00/)).toBeInTheDocument();
    });

    it('shows the error state on 404', async () => {
      server.use(
        http.get(`${API}/v1/media/video/:videoId`, () =>
          new HttpResponse(null, { status: 404 })
        )
      );

      renderWithProviders(<VideoPage />, { as: 'listener' });

      await waitFor(() =>
        expect(screen.getByText(/Failed to load video details|Video not found/i))
          .toBeInTheDocument()
      );
    });

    it('does not render a Vote action (videos are not votable)', async () => {
      renderWithProviders(<VideoPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Video One/i });

      // Scoped to the page's action chips — the app sidebar has its own
      // "Vote" nav item, which is unrelated to this page's actions.
      const chips = document.querySelector('.vp-action-chips');
      expect(chips).not.toBeNull();
      expect(within(chips).queryByRole('button', { name: /vote/i })).not.toBeInTheDocument();
      // And the voting wizard is not mounted at all
      expect(document.querySelector('.voting-wizard')).toBeNull();
    });
  });

  // ========================================================================
  // Like flow
  // ========================================================================
  describe('like flow', () => {
    it('likes the video and bumps the count optimistically', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Video One/i });

      // The like chip starts at 0 (fixture count)
      const likeChip = document.querySelector('.vp-chip-like');
      expect(likeChip).not.toBeNull();
      await user.click(likeChip);

      await waitFor(() => expect(callTracker.get('video-like:video-001')).toBe(1));
      expect(likeChip.classList.contains('liked')).toBe(true);
    });

    it('unlikes when already liked', async () => {
      server.use(
        http.get(`${API}/v1/media/video/:videoId/is-liked`, () =>
          HttpResponse.json({ isLiked: true })
        ),
        http.get(`${API}/v1/media/video/:videoId/likes/count`, () =>
          HttpResponse.json({ count: 3 })
        )
      );

      const user = userEvent.setup();
      renderWithProviders(<VideoPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Video One/i });

      const likeChip = document.querySelector('.vp-chip-like');
      await waitFor(() => expect(likeChip.classList.contains('liked')).toBe(true));

      await user.click(likeChip);
      await waitFor(() => expect(callTracker.get('video-unlike:video-001')).toBe(1));
    });

    it('prompts guests to log in instead of calling the API', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const user = userEvent.setup();
      renderWithProviders(<VideoPage />, { as: 'guest' });

      await screen.findByRole('heading', { name: /Video One/i });

      await user.click(document.querySelector('.vp-chip-like'));

      expect(alertSpy).toHaveBeenCalledWith('Please log in to like videos');
      expect(callTracker.get('video-like:video-001')).toBe(0);
      alertSpy.mockRestore();
    });
  });

  // ========================================================================
  // Play tracking — one tracked play per page visit
  // ========================================================================
  describe('play tracking', () => {
    it('tracks a play once when the video starts', async () => {
      renderWithProviders(<VideoPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Video One/i });

      const videoEl = screen.getByTestId('vp-video');
      fireEvent.play(videoEl);

      await waitFor(() => expect(callTracker.get('video-play:video-001')).toBe(1));

      // Pausing and playing again must NOT double-count
      fireEvent.pause(videoEl);
      fireEvent.play(videoEl);
      await new Promise((r) => setTimeout(r, 50));
      expect(callTracker.get('video-play:video-001')).toBe(1);
    });

    it('does not track plays for guests (backend requires a user)', async () => {
      renderWithProviders(<VideoPage />, { as: 'guest' });

      await screen.findByRole('heading', { name: /Video One/i });

      fireEvent.play(screen.getByTestId('vp-video'));

      await new Promise((r) => setTimeout(r, 50));
      expect(callTracker.get('video-play:video-001')).toBe(0);
    });
  });

  // ========================================================================
  // Description expand/collapse
  // ========================================================================
  describe('description card', () => {
    it('expands with "...more" and collapses with "Show less"', async () => {
      const user = userEvent.setup();
      renderWithProviders(<VideoPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Video One/i });

      const toggle = screen.getByRole('button', { name: /more/i });
      await user.click(toggle);

      expect(screen.getByRole('button', { name: /Show less/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Show less/i }));
      expect(screen.getByRole('button', { name: /more/i })).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Copy link
  // ========================================================================
  describe('copy link', () => {
    it('copies the current URL and shows confirmation', async () => {
      // userEvent.setup() installs its own clipboard stub, so the spy must
      // be defined AFTER setup (navigator.clipboard is getter-only in jsdom).
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue();
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });
      renderWithProviders(<VideoPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Video One/i });

      await user.click(screen.getByRole('button', { name: /Copy Link/i }));

      await waitFor(() => expect(screen.getByText(/Copied!/i)).toBeInTheDocument());
      expect(writeText).toHaveBeenCalledWith(window.location.href);
    });
  });

  // ========================================================================
  // Comments
  // ========================================================================
  describe('comments', () => {
    it('renders the comment section wired to the video endpoints', async () => {
      let commentsRequested = false;
      server.use(
        http.get(`${API}/v1/comments/video/:videoId`, ({ params }) => {
          if (params.videoId === 'video-001') commentsRequested = true;
          return HttpResponse.json([]);
        })
      );

      renderWithProviders(<VideoPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Video One/i });
      await waitFor(() => expect(commentsRequested).toBe(true));
    });
  });

  // ========================================================================
  // Mutual exclusion with the global player
  // ========================================================================
  describe('mutual exclusion', () => {
    it('starting the inline video does not throw when the global player is idle', async () => {
      renderWithProviders(<VideoPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Video One/i });

      // Global player idle (nothing queued in tests): the play handler runs
      // the exclusion branch without a player to pause and must not throw.
      expect(() => fireEvent.play(screen.getByTestId('vp-video'))).not.toThrow();
    });
  });
});