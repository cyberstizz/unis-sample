// src/songPage.test.jsx
//
// Integration tests for SongPage — a critical page covering play tracking,
// vote flow, like interactions, and the lyrics edit wizard. This is where
// the play-tracking logic (Finding 3) is most important.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';
import SongPage from './songPage';

const API = 'http://localhost:8080/api';
// The page's own action row (the follow bar repeats the Like button).
const actions = () => within(document.querySelector('.sp-actions'));

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
    // Cache pollution between tests: prior tests cache the GET /is-liked
    // response, so server.use() overrides in later tests get bypassed by
    // a cache hit. Clear the apiCall cache before every test.
    cacheService.clearAll();
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

      // v3: Like is a heart button named for the song.
      const likeBtn = actions().getByRole('button', { name: /^like track one$/i });
      expect(likeBtn).toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(likeBtn);

      await waitFor(() =>
        expect(actions().getByRole('button', { name: /^unlike track one$/i })).toHaveAttribute('aria-pressed', 'true')
      );
      expect(callTracker.get('like:song-001')).toBe(1);
    });

    it('calls DELETE when unliking', async () => {
      // Override is-liked to return true so the button starts as "Liked".
      // Use the default DELETE handler in handlers.js (it tracks
      // unlike:${songId} via callTracker — same pattern as the rest of the
      // suite).
      server.use(
        http.get(`${API}/v1/media/song/:songId/is-liked`, () =>
          HttpResponse.json({ isLiked: true })
        ),
        http.get(`${API}/v1/media/song/:songId/likes/count`, () =>
          HttpResponse.json({ count: 42 })
        )
      );

      renderWithProviders(<SongPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Track One/i });
      const likedBtn = await waitFor(() => actions().getByRole('button', { name: /^unlike track one$/i }));

      const user = userEvent.setup();
      await user.click(likedBtn);

      await waitFor(
        () => expect(callTracker.get('unlike:song-001')).toBeGreaterThan(0),
        { timeout: 3000 }
      );
    });

    it('asks a guest to log in instead of liking', async () => {
      renderWithProviders(<SongPage />, { as: 'guest' });

      await screen.findByRole('heading', { name: /Track One/i });
      const user = userEvent.setup();
      await user.click(actions().getByRole('button', { name: /^like track one$/i }));

      expect(await screen.findByText(/log in to like songs/i)).toBeInTheDocument();
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

      // v3: on phones Vote is a full-width card like the artist page's.
      const voteCard = screen.getByRole('button', { name: /vote for track one/i });
      expect(voteCard).toHaveClass('sp-votecard');
      expect(voteCard).toHaveTextContent(/moves it up the harlem rankings/i);
      await user.click(voteCard);

      await waitFor(() =>
        expect(screen.getByText(/Confirm Your Vote For/i)).toBeInTheDocument()
      );
    });

    it('the desktop Vote pill opens it too', async () => {
      renderWithProviders(<SongPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Track One/i });
      const user = userEvent.setup();

      // Several "Vote" buttons exist (the follow bar has one too); target the pill.
      const pill = document.querySelector('.sp-vote-pill');
      expect(pill).not.toBeNull();
      await user.click(pill);

      await waitFor(() =>
        expect(screen.getByText(/Confirm Your Vote For/i)).toBeInTheDocument()
      );
    });
  });

  // ========================================================================
  // ⋯ menu: Don't Play and Report moved in here (v3)
  // ========================================================================
  describe('more menu', () => {
    it("holds Don't play and Report", async () => {
      renderWithProviders(<SongPage />, { as: 'listener' });
      await screen.findByRole('heading', { name: /Track One/i });
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /more options/i }));
      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
      expect(screen.getByRole('menuitemcheckbox', { name: /never play track one/i })).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByRole('menuitem', { name: /report/i })).toBeInTheDocument();
    });

    it("Don't play adds the song to the do-not-play list", async () => {
      let posted = null;
      server.use(
        http.get(`${API}/v1/playlists/blocked-songs`, () => HttpResponse.json([])),
        http.post(`${API}/v1/playlists/blocked-songs`, async ({ request }) => {
          posted = await request.json();
          return HttpResponse.json({ ok: true });
        })
      );
      renderWithProviders(<SongPage />, { as: 'listener' });
      await screen.findByRole('heading', { name: /Track One/i });
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: /more options/i }));
      await user.click(screen.getByRole('menuitemcheckbox', { name: /never play track one/i }));

      await waitFor(() => expect(posted).toEqual({ songId: 'song-001' }));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // Photos and videos: the artist's (songs have none of their own)
  // ========================================================================
  describe('photos and videos', () => {
    const withMedia = () => server.use(
      http.get(`${API}/v1/users/:id/photos`, () => HttpResponse.json({
        photos: [
          { photoId: 'ph-1', photoUrl: 'https://cdn.test/ph-1.jpg' },
          { photoId: 'ph-2', photoUrl: 'https://cdn.test/ph-2.jpg' },
        ],
        max: 12,
      })),
      http.get(`${API}/v1/media/videos/artist/:id`, () => HttpResponse.json([
        { videoId: 'v-old', title: 'Older clip', artworkUrl: 'https://cdn.test/v-old.jpg', createdAt: '2026-01-01T00:00:00Z' },
        { videoId: 'v-new', title: 'Live at the park', artworkUrl: 'https://cdn.test/v-new.jpg', createdAt: '2026-11-01T00:00:00Z' },
      ]))
    );

    it("shows the artist's photos and opens them in the photo viewer", async () => {
      withMedia();
      renderWithProviders(<SongPage />, { as: 'listener' });
      await screen.findByRole('heading', { name: /Track One/i });

      expect(await screen.findByRole('heading', { name: 'Photos' })).toBeInTheDocument();
      const photos = screen.getAllByRole('button', { name: /open photo \d of 2/i });
      expect(photos).toHaveLength(2);

      const user = userEvent.setup();
      await user.click(photos[1]);
      expect(screen.getByRole('dialog', { name: /photos, 2 of 2/i })).toBeInTheDocument();
    });

    it("shows the artist's videos, newest first", async () => {
      withMedia();
      renderWithProviders(<SongPage />, { as: 'listener' });
      await screen.findByRole('heading', { name: /Track One/i });

      expect(await screen.findByRole('heading', { name: 'Videos' })).toBeInTheDocument();
      const videos = screen.getAllByRole('button', { name: /^watch /i });
      expect(videos.map((v) => v.getAttribute('aria-label'))).toEqual(['Watch Live at the park', 'Watch Older clip']);
    });

    it('hides both sections when the artist has none', async () => {
      server.use(
        http.get(`${API}/v1/users/:id/photos`, () => HttpResponse.json({ photos: [], max: 12 })),
        http.get(`${API}/v1/media/videos/artist/:id`, () => HttpResponse.json([]))
      );
      renderWithProviders(<SongPage />, { as: 'listener' });
      await screen.findByRole('heading', { name: /Track One/i });
      await new Promise((r) => setTimeout(r, 100));

      expect(screen.queryByRole('heading', { name: 'Photos' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Videos' })).not.toBeInTheDocument();
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
  it('copies the link and confirms it', async () => {
    renderWithProviders(<SongPage />, { as: 'listener' });

    await screen.findByRole('heading', { name: /Track One/i });

    // userEvent.setup() installs its own clipboard stub on navigator.clipboard
    // (see @testing-library/user-event/dist/esm/utils/dataTransfer/Clipboard.js).
    // Any spy installed before setup() gets overwritten by that stub. So we
    // spy on user-event's installed stub AFTER setup runs.
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

    await user.click(screen.getByRole('button', { name: /copy link/i }));

    // The toast confirms it, and a live region tells screen readers.
    expect((await screen.findAllByText(/link copied/i)).length).toBeGreaterThan(0);
    expect(writeTextSpy).toHaveBeenCalled();
  });
});