// src/milestonesPage.test.jsx
//
// Rewritten for the segmented-control UI. The controls are no longer <select>
// elements, so `selectOptions` and `getByRole('combobox')` no longer apply —
// each option is a button carrying data-testid="{group}-{value}", e.g.
// `interval-annual`, `category-artist`, `jurisdiction-harlem`. The submit
// button reads "Show winner".
//
// Time is frozen at Tue 28 Jul 2026 21:30 local. The evening hour is
// deliberate: it is the window in which Date#toISOString() rolls the date
// forward in New York, which is the drift the page used to have.

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import MilestonesPage from './milestonesPage';

const API = 'http://localhost:8080/api';
const NOW = new Date(2026, 6, 28, 21, 30);

let lastQuery = null;

const pick = (testId) => screen.getByTestId(testId);
const showWinner = () => screen.getByRole('button', { name: /show winner/i });

/**
 * The winner appears twice by design — once on the plate and again as rank 1 in
 * the tally — so any query for winner text must say which one it means.
 */
const plate = () => within(document.querySelector('.ms-plate'));

const entry = (over = {}) => ({
  rank: 1,
  targetId: 'song-001',
  targetType: 'song',
  title: 'Midnight on Lenox',
  artist: 'Jay Prince',
  artwork: 'https://cdn.unismusic.com/art/1.jpg',
  fileUrl: 'https://cdn.unismusic.com/audio/1.mp3',
  artistId: 'artist-001',
  votes: 312,
  weightedPoints: 1284,
  playsCount: 8901,
  likesCount: 442,
  isWinner: true,
  determinationMethod: null,
  tiedCandidatesCount: 0,
  ...over,
});

const leaderboard = (rows, totalVotes = 3120) =>
  HttpResponse.json({ winner: rows[0], leaderboard: rows, totalVotes });

/** Select a closed period through the picker for the given interval. */
const choosePeriod = async (user, interval) => {
  await user.click(pick(`interval-${interval}`));
  if (interval === 'daily') return; // already defaults to yesterday
  await user.click(screen.getByRole('button', { name: /^(Week|Month|Quarter|Half year|Year):/i }));
  const panel = screen.getByRole('dialog');
  const options = within(panel)
    .getAllByRole('button')
    .filter((b) => !b.disabled && !/^[←→]$/.test(b.textContent.trim()));
  await user.click(options[options.length - 1]);
};

describe('MilestonesPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    lastQuery = null;
    server.use(
      http.get(`${API}/v1/awards/period-leaderboard`, ({ request }) => {
        lastQuery = Object.fromEntries(new URL(request.url).searchParams);
        return leaderboard([entry()]);
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    server.resetHandlers();
  });

  // ── Initial render ────────────────────────────────────────────────────────
  describe('initial render', () => {
    it('renders every filter group with the expected defaults selected', () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      expect(pick('jurisdiction-downtown-harlem')).toHaveAttribute('aria-pressed', 'true');
      expect(pick('genre-rap')).toHaveAttribute('aria-pressed', 'true');
      expect(pick('category-song')).toHaveAttribute('aria-pressed', 'true');
      expect(pick('interval-daily')).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders the Show winner button', () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      expect(showWinner()).toBeInTheDocument();
    });

    it('defaults the date to yesterday, not today', () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      // Daily renders a themed calendar toggle, not <input type="date"> — the
      // native panel could not be themed.
      expect(document.querySelector('input[type="date"]')).toBeNull();
      expect(screen.getByRole('button', { name: /^Date: 2026-07-27$/i })).toBeInTheDocument();
    });

    it('shows no result before Show winner is pressed', () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      expect(screen.queryByText(/of the day/i)).not.toBeInTheDocument();
      expect(screen.getByText(/pick a jurisdiction, genre and period/i)).toBeInTheDocument();
    });
  });

  // ── The period guard ──────────────────────────────────────────────────────
  // The reason this page exists in its current form. Requesting an open period
  // makes the backend persist a winner computed from partial data.
  describe('open-period guard', () => {
    it('never offers the current year when switching to annual', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(pick('interval-annual'));
      await user.click(screen.getByRole('button', { name: /^Year:/i }));
      const panel = screen.getByRole('dialog');
      expect(within(panel).queryByRole('button', { name: '2026' })).not.toBeInTheDocument();
    });

    it('re-anchors a daily selection when the interval changes', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(pick('interval-monthly'));
      await user.click(showWinner());
      await waitFor(() => expect(lastQuery).not.toBeNull());
      // 2026-07-27 must not have carried across into an unfinished July.
      expect(lastQuery.startDate).toBe('2026-06-01');
      expect(lastQuery.endDate).toBe('2026-06-30');
    });

    it('disables the current month in the monthly picker', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(pick('interval-monthly'));
      await user.click(screen.getByRole('button', { name: /^Month:/i }));
      const panel = screen.getByRole('dialog');
      expect(within(panel).getByRole('button', { name: /July 2026/i })).toBeDisabled();
      expect(within(panel).getByRole('button', { name: /June 2026/i })).not.toBeDisabled();
    });
  });

  // ── Request shape ─────────────────────────────────────────────────────────
  describe('API call parameters', () => {
    it('sends daily as a single day', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(lastQuery).not.toBeNull());
      expect(lastQuery.startDate).toBe('2026-07-27');
      expect(lastQuery.endDate).toBe('2026-07-27');
      expect(lastQuery.type).toBe('song');
    });

    it.each([
      ['weekly', '2026-07-20', '2026-07-26'],
      ['monthly', '2026-06-01', '2026-06-30'],
      ['quarterly', '2026-04-01', '2026-06-30'],
      ['midterm', '2026-01-01', '2026-06-30'],
      ['annual', '2025-01-01', '2025-12-31'],
    ])('sends %s as the last closed period', async (interval, start, end) => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(pick(`interval-${interval}`));
      await user.click(showWinner());
      await waitFor(() => expect(lastQuery).not.toBeNull());
      expect(lastQuery.startDate).toBe(start);
      expect(lastQuery.endDate).toBe(end);
    });

    it('includes jurisdiction, genre and interval ids', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(lastQuery).not.toBeNull());
      expect(lastQuery.jurisdictionId).toBeTruthy();
      expect(lastQuery.genreId).toBeTruthy();
      expect(lastQuery.intervalId).toBeTruthy();
    });

    it('switches to type=artist when Artists is chosen', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(pick('category-artist'));
      await user.click(showWinner());
      await waitFor(() => expect(lastQuery).not.toBeNull());
      expect(lastQuery.type).toBe('artist');
    });

    it('does not call the API when only filters change', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(pick('genre-rock'));
      await user.click(pick('jurisdiction-harlem'));
      await user.click(pick('category-artist'));
      expect(lastQuery).toBeNull();
    });
  });

  // ── Winner plate ──────────────────────────────────────────────────────────
  describe('winner plate', () => {
    it('renders the winner with title, artist and figures', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(document.querySelector('.ms-plate')).not.toBeNull());
      expect(plate().getByText('Midnight on Lenox')).toBeInTheDocument();
      expect(plate().getByText('Jay Prince')).toBeInTheDocument();
      expect(plate().getByText('1,284')).toBeInTheDocument();
      expect(plate().getByText('312')).toBeInTheDocument();
      expect(plate().getByText('8,901')).toBeInTheDocument();
      expect(plate().getByText('442')).toBeInTheDocument();
    });

    it('also lists the winner as rank 1 in the tally', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(document.querySelector('.ms-tally-row')).not.toBeNull());
      expect(screen.getAllByText('Midnight on Lenox')).toHaveLength(2);
      expect(document.querySelector('.ms-tally-row')).toHaveClass('is-winner');
    });

    it('names the period and jurisdiction in the headline', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(screen.getByText(/song of the day/i)).toBeInTheDocument());
      expect(screen.getByText(/monday, july 27, 2026/i)).toBeInTheDocument();
      expect(screen.getByText(/downtown harlem/i)).toBeInTheDocument();
    });

    it('freezes the headline to the fetched period, not the live selection', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(screen.getByText(/song of the day/i)).toBeInTheDocument());
      await user.click(pick('interval-annual'));
      expect(screen.getByText(/song of the day/i)).toBeInTheDocument();
      expect(screen.queryByText(/song of the year/i)).not.toBeInTheDocument();
    });

    it('reports the tiebreaker when one was applied', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          leaderboard([entry({ determinationMethod: 'PLAYS', tiedCandidatesCount: 3 })])
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(screen.getByText(/tie broken on plays between 3/i)).toBeInTheDocument());
    });
  });

  // ── Zero-value handling ───────────────────────────────────────────────────
  describe('zero-value figures', () => {
    it('omits a figure whose value is zero', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          leaderboard([entry({ votes: 0, likesCount: 0, playsCount: 41, weightedPoints: 41 })], 0)
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(screen.getByText('Points')).toBeInTheDocument());
      expect(screen.getByText('Plays')).toBeInTheDocument();
      expect(screen.queryByText('Votes')).not.toBeInTheDocument();
      expect(screen.queryByText('Likes')).not.toBeInTheDocument();
    });

    it('replaces the figures entirely when nothing scored', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          leaderboard(
            [entry({
              votes: 0, likesCount: 0, playsCount: 0, weightedPoints: 0,
              determinationMethod: 'FALLBACK',
            })],
            0
          )
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(document.querySelector('.ms-plate')).not.toBeNull());
      expect(plate().getByText('Midnight on Lenox')).toBeInTheDocument();
      expect(screen.queryByText('Points')).not.toBeInTheDocument();
      expect(document.querySelector('.ms-figures')).toBeNull();
      expect(plate().getByText(/decided on engagement — no votes cast/i)).toBeInTheDocument();
      // and only once — the small-print note must not duplicate it
      expect(plate().getAllByText(/decided on engagement — no votes cast/i)).toHaveLength(1);
      expect(document.querySelector('.ms-plate-note')).toBeNull();
    });

    it('leaves the tally points cell blank rather than printing 0', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          leaderboard(
            [
              entry({ weightedPoints: 90 }),
              entry({ rank: 2, targetId: 'song-002', title: 'Cold Water', weightedPoints: 0 }),
            ],
            90
          )
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(screen.getByText('Cold Water')).toBeInTheDocument());
      const rows = document.querySelectorAll('.ms-tally-row');
      expect(rows[0].querySelector('.ms-tally-points').textContent).toMatch(/90/);
      expect(rows[1].querySelector('.ms-tally-points').textContent.trim()).toBe('');
    });

    it('drops the rail when no entry scored at all', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          leaderboard(
            [
              entry({ weightedPoints: 0 }),
              entry({ rank: 2, targetId: 'song-002', title: 'Cold Water', weightedPoints: 0 }),
            ],
            0
          )
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(screen.getByText('Cold Water')).toBeInTheDocument());
      expect(document.querySelectorAll('.ms-tally-bar')).toHaveLength(0);
    });
  });

  // ── Tally ─────────────────────────────────────────────────────────────────
  describe('tally', () => {
    it('renders runners-up beneath the winner in rank order', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          leaderboard([
            entry(),
            entry({ rank: 2, targetId: 'song-002', title: 'Cold Water', weightedPoints: 712 }),
            entry({ rank: 3, targetId: 'song-003', title: 'Sugar Hill', weightedPoints: 455 }),
          ])
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(screen.getByText('Sugar Hill')).toBeInTheDocument());
      const rows = document.querySelectorAll('.ms-tally-row');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveClass('is-winner');
      expect(rows[1].textContent).toMatch(/Cold Water/);
    });

    it('scales bar width by share of the period total', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          leaderboard([
            entry({ weightedPoints: 1000 }),
            entry({ rank: 2, targetId: 'song-002', title: 'Cold Water', weightedPoints: 500 }),
          ])
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(screen.getByText('Cold Water')).toBeInTheDocument());
      const fills = document.querySelectorAll('.ms-tally-fill');
      expect(fills[0].style.width).toBe('100%');
      expect(fills[1].style.width).toBe('50%');
    });

    it('offers a play control only when the row carries a file url', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          leaderboard([
            entry(),
            entry({ rank: 2, targetId: 'song-002', title: 'Cold Water', fileUrl: null }),
          ])
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(screen.getByText('Cold Water')).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /play midnight on lenox/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /play cold water/i })).not.toBeInTheDocument();
    });
  });

  // ── Empty and error states ────────────────────────────────────────────────
  describe('empty and error states', () => {
    it('names the period when nothing was awarded', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          HttpResponse.json({ winner: null, leaderboard: [], totalVotes: 0 })
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => expect(screen.getByText(/no award was recorded/i)).toBeInTheDocument());
      expect(screen.getByText(/monday, july 27, 2026/i)).toBeInTheDocument();
    });

    it('surfaces a server error without apologising', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          HttpResponse.json({ message: 'boom' }, { status: 500 })
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert.textContent).toMatch(/archive did not respond/i);
      });
    });

    it('reports a 404 as nothing awarded', async () => {
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, () =>
          HttpResponse.json({ message: 'nope' }, { status: 404 })
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toMatch(/nothing was awarded/i)
      );
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────
  describe('accessibility', () => {
    it('exposes each filter group with a label and pressed state', () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      expect(screen.getByRole('group', { name: /jurisdiction/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /genre/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /category/i })).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /interval/i })).toBeInTheDocument();
      expect(pick('genre-rock')).toHaveAttribute('aria-pressed', 'false');
    });

    it('gives every button on the page an explicit type', () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      // Scoped to .ms-page. Layout's own chrome (mobile-search-trigger, the
      // nav-item buttons) is outside this page's remit — it does omit type,
      // which is worth fixing when Layout gets its own QA pass, but it is not
      // this suite's business to assert on.
      const buttons = document.querySelectorAll('.ms-page button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach((b) => {
        expect(b.getAttribute('type')).toBe('button');
      });
    });

    it('announces loading politely', async () => {
      // The response must be held open. Left ungated, msw resolves inside
      // `await user.click(...)` and the skeleton is gone before we can look.
      let release;
      server.use(
        http.get(`${API}/v1/awards/period-leaderboard`, async () => {
          await new Promise((r) => { release = r; });
          return leaderboard([entry()]);
        })
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      await user.click(showWinner());

      const status = document.querySelector('.ms-skeleton[aria-live="polite"]');
      expect(status).not.toBeNull();
      expect(status.getAttribute('role')).toBe('status');
      expect(within(status).getByText(/loading the archive/i)).toBeInTheDocument();

      // The submit relabels to "Loading" while in flight, so query the element
      // rather than the name.
      const submit = document.querySelector('.ms-submit');
      expect(submit).toBeDisabled();
      expect(submit.textContent).toMatch(/loading/i);

      release();
      await waitFor(() => expect(document.querySelector('.ms-skeleton')).toBeNull());
      expect(showWinner()).not.toBeDisabled();
    });
  });
});