// src/winnersTimeline.test.jsx
//
// Integration tests for WinnersTimeline v2 — now backed by the real
// /v1/awards/past endpoint instead of the mock generator.
//
// Covers the wiring that matters:
//   • correct interval UUID + date window per interval pill
//   • one winner PER PERIOD (the endpoint returns one per genre; we keep the
//     top-voted row per award_date)
//   • interval/category switches refetch
//   • deleted targets (award row with no song/user) are dropped, not crashed
//   • play tracking is effect-based and never fires for guests
//   • loading / error+retry / empty states

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker } from './test/mocks/handlers';
import { renderWithProviders, flushPromises } from './test/utils';
import cacheService from './services/cacheService';
import WinnersTimeline from './winnersTimeline';

const API = 'http://localhost:8080/api';
const JUR_ID = 'jur-uptown-001';

const WEEKLY = '00000000-0000-0000-0000-000000000202';
const MONTHLY = '00000000-0000-0000-0000-000000000203';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ─── Award fixtures (shape mirrors the Java Award entity JSON) ───────────────

const songAward = (overrides = {}) => ({
  awardId: 'aw-1',
  targetType: 'song',
  targetId: 's1',
  awardDate: '2026-03-14',
  votesCount: 152,
  determinationMethod: 'WEIGHTED_VOTES',
  song: {
    songId: 's1',
    title: 'no more heroes',
    fileUrl: '/uploads/s1.mp3',
    artworkUrl: '/uploads/s1.jpg',
    artist: { userId: 'a1', username: 'stizz' },
  },
  ...overrides,
});

const artistAward = (overrides = {}) => ({
  awardId: 'aw-a1',
  targetType: 'artist',
  targetId: 'a1',
  awardDate: '2026-03-14',
  votesCount: 210,
  user: { userId: 'a1', username: 'rockle_gend', photoUrl: '/uploads/a1.jpg' },
  ...overrides,
});

/** Capture the query params of every /awards/past request. */
function trackAwards(respond) {
  const seen = [];
  server.use(
    http.get(`${API}/v1/awards/past`, ({ request }) => {
      const url = new URL(request.url);
      seen.push(Object.fromEntries(url.searchParams));
      return HttpResponse.json(respond(url));
    })
  );
  return seen;
}

const renderTimeline = (props = {}, options = { as: 'listener' }) =>
  renderWithProviders(
    <WinnersTimeline jurisdiction="Uptown Harlem" jurisdictionId={JUR_ID} {...props} />,
    options
  );

describe('WinnersTimeline', () => {
  beforeEach(() => {
    callTracker.reset();
    mockNavigate.mockReset();
    cacheService.clearAll();
  });

  // ══════════════════════════════════════════════════════════════════════
  // Backend wiring
  // ══════════════════════════════════════════════════════════════════════
  describe('data fetching', () => {
    it('requests the weekly interval for the given jurisdiction by default', async () => {
      const seen = trackAwards(() => [songAward()]);

      renderTimeline();
      await screen.findByText('no more heroes');

      expect(seen[0]).toMatchObject({
        type: 'song',
        jurisdictionId: JUR_ID,
        intervalId: WEEKLY,
      });
      // A real window, not a placeholder
      expect(seen[0].startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(seen[0].endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(seen[0].startDate < seen[0].endDate).toBe(true);
    });

    it('renders the real winner, not mock pool data', async () => {
      trackAwards(() => [songAward()]);

      renderTimeline();

      expect(await screen.findByText('no more heroes')).toBeInTheDocument();
      expect(screen.getByText('stizz')).toBeInTheDocument();
      expect(screen.getByText(/152 votes/)).toBeInTheDocument();
    });

    it('keeps only the top-voted winner per period (one row per genre comes back)', async () => {
      trackAwards(() => [
        // Same award_date, three genres — ordered votes DESC by the backend
        songAward({ awardId: 'aw-rap', votesCount: 152 }),
        songAward({
          awardId: 'aw-rock',
          votesCount: 88,
          song: { songId: 's9', title: 'rock also won', artist: { userId: 'a9', username: 'rocker' } },
        }),
        songAward({
          awardId: 'aw-prev',
          awardDate: '2026-03-07',
          votesCount: 140,
          song: { songId: 's2', title: 'Big booty sells', artist: { userId: 'a2', username: 'Lyricalqueen' } },
        }),
      ]);

      renderTimeline();

      await screen.findByText('no more heroes');
      // The lower-voted same-period row is collapsed away
      expect(screen.queryByText('rock also won')).not.toBeInTheDocument();
      // The earlier period still gets its own entry
      expect(screen.getByText('Big booty sells')).toBeInTheDocument();
    });

    it('resolves the jurisdiction by name when no UUID is supplied', async () => {
      server.use(
        http.get(`${API}/v1/jurisdictions/byName/:name`, () =>
          HttpResponse.json([{ jurisdictionId: 'looked-up-id', name: 'Uptown Harlem' }])
        )
      );
      const seen = trackAwards(() => [songAward()]);

      renderWithProviders(<WinnersTimeline jurisdiction="Uptown Harlem" />, { as: 'listener' });
      await screen.findByText('no more heroes');

      expect(seen[0].jurisdictionId).toBe('looked-up-id');
    });

    it('drops award rows whose target no longer exists', async () => {
      trackAwards(() => [
        { awardId: 'aw-dead', targetType: 'song', targetId: 'gone', awardDate: '2026-03-14', votesCount: 10 },
        songAward({ awardId: 'aw-live', awardDate: '2026-03-07' }),
      ]);

      renderTimeline();

      expect(await screen.findByText('no more heroes')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^View / })).toHaveLength(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Filters
  // ══════════════════════════════════════════════════════════════════════
  describe('interval and category filters', () => {
    it('refetches with the monthly interval UUID when Month is picked', async () => {
      const seen = trackAwards(() => [songAward()]);
      const user = userEvent.setup();

      renderTimeline();
      await screen.findByText('no more heroes');

      await user.click(screen.getByRole('button', { name: 'Month' }));

      await waitFor(() => expect(seen.length).toBeGreaterThan(1));
      expect(seen[seen.length - 1].intervalId).toBe(MONTHLY);
    });

    it('switching to Artist refetches with type=artist and renders artist winners', async () => {
      const seen = trackAwards((url) =>
        url.searchParams.get('type') === 'artist' ? [artistAward()] : [songAward()]
      );
      const user = userEvent.setup();

      renderTimeline();
      await screen.findByText('no more heroes');

      await user.click(screen.getByRole('button', { name: 'Artist' }));

      expect(await screen.findByText('rockle_gend')).toBeInTheDocument();
      expect(seen[seen.length - 1].type).toBe('artist');
    });

    it('uses a wider date window for longer intervals', async () => {
      const seen = trackAwards(() => [songAward()]);
      const user = userEvent.setup();

      renderTimeline();
      await screen.findByText('no more heroes');

      await user.click(screen.getByRole('button', { name: 'Year' }));
      await waitFor(() => expect(seen.length).toBeGreaterThan(1));

      const span = (q) => new Date(q.endDate) - new Date(q.startDate);
      expect(span(seen[seen.length - 1])).toBeGreaterThan(span(seen[0]));
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Playback
  // ══════════════════════════════════════════════════════════════════════
  describe('playback', () => {
    it('plays a winning track and credits the play once it becomes current', async () => {
      trackAwards(() => [songAward()]);
      const user = userEvent.setup();

      renderTimeline({}, { as: 'listener' });
      await screen.findByText('no more heroes');

      await user.click(screen.getByRole('button', { name: 'Play no more heroes' }));

      await waitFor(() => expect(callTracker.get('play:s1')).toBe(1));
    });

    it('never tracks plays for guests', async () => {
      trackAwards(() => [songAward()]);
      const user = userEvent.setup();

      renderTimeline({}, { as: 'guest' });
      await screen.findByText('no more heroes');

      await user.click(screen.getByRole('button', { name: 'Play no more heroes' }));
      await flushPromises();

      expect(callTracker.get('play:s1')).toBe(0);
    });

    it('hides the play button when the winning track has no file', async () => {
      trackAwards(() => [
        songAward({
          song: { songId: 's1', title: 'no more heroes', fileUrl: null, artist: { userId: 'a1', username: 'stizz' } },
        }),
      ]);

      renderTimeline();
      await screen.findByText('no more heroes');

      expect(screen.queryByRole('button', { name: /^Play / })).not.toBeInTheDocument();
    });

    it('artist winners navigate to the artist page', async () => {
      trackAwards(() => [artistAward()]);
      const user = userEvent.setup();

      renderTimeline({ initialCategory: 'artist' });
      await screen.findByText('rockle_gend');

      await user.click(screen.getByRole('button', { name: 'View rockle_gend' }));
      expect(mockNavigate).toHaveBeenCalledWith('/artist/a1');
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // States + load more
  // ══════════════════════════════════════════════════════════════════════
  describe('states', () => {
    it('shows an honest empty state when the archive has no winners', async () => {
      trackAwards(() => []);

      renderTimeline();

      expect(await screen.findByText(/No winners on record for this interval yet/i)).toBeInTheDocument();
    });

    it('shows an error with a working retry when the request fails', async () => {
      let attempts = 0;
      server.use(
        http.get(`${API}/v1/awards/past`, () => {
          attempts += 1;
          if (attempts === 1) return new HttpResponse(null, { status: 500 });
          return HttpResponse.json([songAward()]);
        })
      );
      const user = userEvent.setup();

      renderTimeline();

      expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn’t load past winners/i);

      await user.click(screen.getByRole('button', { name: /Retry/i }));

      expect(await screen.findByText('no more heroes')).toBeInTheDocument();
    });

    it('embedded variant sends "See full archive" to the archive route', async () => {
      trackAwards(() => [songAward()]);
      const user = userEvent.setup();

      renderTimeline({ variant: 'embedded' });
      await screen.findByText('no more heroes');

      await user.click(screen.getByRole('button', { name: /See full archive/i }));

      expect(mockNavigate).toHaveBeenCalledWith(
        '/jurisdiction/Uptown%20Harlem/winners?interval=week&category=song'
      );
    });

    it('full variant reveals more winners in place', async () => {
      trackAwards(() =>
        Array.from({ length: 8 }, (_, i) =>
          songAward({
            awardId: `aw-${i}`,
            awardDate: `2026-03-${String(14 - i).padStart(2, '0')}`,
            song: { songId: `s${i}`, title: `Winner ${i}`, artist: { userId: 'a1', username: 'stizz' } },
          })
        )
      );
      const user = userEvent.setup();

      renderTimeline({ variant: 'full', initialCount: 5, pageSize: 5 });
      await screen.findByText('Winner 0');

      expect(screen.queryByText('Winner 6')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Load more winners/i }));

      expect(await screen.findByText('Winner 6')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});