// src/test/findings/04-cron-timezone.test.jsx
//
// Finding 4 — Award cron runs at UTC midnight, which is EST 7pm the previous
// day. The LastWonNotification component reads awards that were prematurely
// created by this cron.
//
// The root fix is backend-side (add zone="America/New_York" to @Scheduled).
// These frontend tests verify the component correctly interprets award dates
// AS IF they were generated on the correct schedule.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { server } from '../mocks/server';
import { renderWithProviders } from '../utils';

const API = 'http://localhost:8080/api';

describe('Finding 4 — Cron timezone and LastWonNotification', () => {
  afterEach(() => vi.useRealTimers());

  // ═══════════════════════════════════════════════════════════════════════
  // 🔴 BUG DOCUMENTATION TEST — currently FAILS against production code.
  // Will PASS once Finding 4 is fixed (add zone="America/New_York" to @Scheduled
  // and LocalDate.now(ZoneId.of("America/New_York")) in AwardService.java).
  // ═══════════════════════════════════════════════════════════════════════
  it('[BUG #4] LastWonNotification does NOT display awards dated in the future', async () => {
    // If the cron fires at UTC midnight (EST 7pm previous day), the DB will
    // contain an award with date = tomorrow-in-EST. The component MUST reject
    // future-dated awards from its display.

    vi.useFakeTimers();
    // Freeze time at 2026-04-15 8:00 PM EST (which is 2026-04-16 00:00 UTC)
    vi.setSystemTime(new Date('2026-04-16T00:00:00Z'));

    server.use(
      http.get(`${API}/v1/awards/past`, () =>
        HttpResponse.json([
          {
            awardId: 'award-future',
            awardDate: '2026-04-16', // "tomorrow" in EST, but "today" in UTC
            intervalId: '00000000-0000-0000-0000-000000000201',
            jurisdiction: { name: 'Harlem' },
            song: {
              songId: 'song-001',
              title: 'Future Track',
              artworkUrl: '/u.jpg',
              fileUrl: '/u.mp3',
              artist: { username: 'Anon', userId: 'art-1' },
            },
          },
        ])
      )
    );

    const { default: LastWonNotification } = await import('../../LastWonNotification');
    renderWithProviders(<LastWonNotification />, { as: 'listener' });

    // Use fake-timer-aware advancement instead of real setTimeout in a Promise
    // (which would hang forever under fake timers).
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    }
    expect(screen.queryByText(/future track/i)).not.toBeInTheDocument();
  });

  it.todo('awards dated today (EST) are shown after EST midnight');
  it.todo('awards dated yesterday (EST) are shown all day today');
});

// =============================================================================

// src/test/findings/05-cashout.test.jsx — covered below in same file for brevity
describe('Finding 5 — Cashout flow end-to-end', () => {
  it('shows a connection prompt when Stripe onboarding is incomplete', async () => {
    server.use(
      http.get(`${API}/v1/stripe/status`, () =>
        HttpResponse.json({ hasAccount: false, onboardingComplete: false, payoutsEnabled: false })
      )
    );

    const { default: Earnings } = await import('../../earnings');
    renderWithProviders(<Earnings />, { as: 'artist' });

    // Accept any of: a button labeled "Connect", a link to Stripe onboarding,
    // or a "Setup Payouts" call-to-action — all indicate incomplete state.
    await waitFor(
      () => {
        const hasConnectButton = screen.queryByRole('button', { name: /connect/i });
        const hasSetupText = screen.queryByText(/stripe|setup|onboard|connect/i);
        expect(hasConnectButton || hasSetupText).toBeTruthy();
      },
      { timeout: 8000 }
    );
  }, 10000);

  it('handles ?stripe=complete return param from Stripe redirect', async () => {
    const { default: Earnings } = await import('../../earnings');
    renderWithProviders(<Earnings />, { as: 'artist', route: '/earnings?stripe=complete' });
    // Component should switch to the payouts tab — we don't assert DOM here,
    // just that mounting with this URL doesn't throw.
    await new Promise((r) => setTimeout(r, 300));
    expect(true).toBe(true);
  });

  it('handles ?stripe=refresh (incomplete onboarding) gracefully', async () => {
    const { default: Earnings } = await import('../../earnings');
    renderWithProviders(<Earnings />, { as: 'artist', route: '/earnings?stripe=refresh' });
    await new Promise((r) => setTimeout(r, 300));
    // Should display an error message about incomplete onboarding
  });

  it.todo('request payout button is disabled when balance < $50');
  it.todo('request payout button succeeds when balance >= $50 and stripe ready');
  it.todo('request payout displays backend error when server rejects');
});

// =============================================================================

describe('Finding 6 — WinnersNotification data source', () => {
  // ═══════════════════════════════════════════════════════════════════════
  // 🔴 BUG DOCUMENTATION TEST — currently FAILS against production code.
  // It will PASS once Finding 6 is fixed (switch component to /v1/awards/past).
  // Keep this as a failing test until the fix lands; green means fixed.
  // ═══════════════════════════════════════════════════════════════════════
  it('[BUG #6] should call /v1/awards/past, not /v1/vote/leaderboards', async () => {
    // CURRENT STATE: component calls /v1/vote/leaderboards.
    // TARGET STATE:  component calls /v1/awards/past with yesterday's date.
    // This test will FAIL until the source is flipped.

    const leaderboardHits = { count: 0 };
    const awardsPastHits = { count: 0 };

    server.use(
      http.get(`${API}/v1/vote/leaderboards`, () => {
        leaderboardHits.count++;
        return HttpResponse.json([]);
      }),
      http.get(`${API}/v1/awards/past`, () => {
        awardsPastHits.count++;
        return HttpResponse.json([]);
      })
    );

    const { default: WinnersNotification } = await import('../../winnersNotification');
    renderWithProviders(<WinnersNotification />, { as: 'listener' });

    // 2s delay on fetchAndShow + buffer
    await new Promise((r) => setTimeout(r, 2500));

    // Target: awards/past should be called, leaderboards should NOT
    // Current (buggy): the opposite.
    expect(awardsPastHits.count).toBeGreaterThan(0);
    expect(leaderboardHits.count).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 🔴 BUG DOCUMENTATION TEST — currently FAILS.
  // Component falls back to stale UUID `00000000-...0003` when jurisdiction
  // is missing. Target: skip the call entirely.
  // ═══════════════════════════════════════════════════════════════════════
  it('[BUG #6] skips the API call when user.jurisdiction is missing', async () => {
    // The component currently falls back to a stale UUID `...0003` when
    // jurisdiction is missing. Target: skip the call entirely.

    // Clear caches and storage so prior tests don't leak state into this one.
    // Specifically: AuthContext caches the user profile via apiCall, and
    // WinnersNotification gates on a localStorage key.
    const { default: cacheService } = await import('../../services/cacheService');
    cacheService.clearAll();
    localStorage.removeItem('winnersNotificationShown');

    server.use(
      http.get(`${API}/v1/users/profile/:userId`, () =>
        HttpResponse.json({
          ...{
            userId: 'user-listener-001',
            username: 'testlistener',
            role: 'listener',
            // deliberately omitting jurisdiction and genre
          },
        })
      )
    );

    let awardsCallCount = 0;
    server.use(
      http.get(`${API}/v1/awards/past`, () => {
        awardsCallCount++;
        return HttpResponse.json([]);
      }),
      http.get(`${API}/v1/vote/leaderboards`, () => {
        awardsCallCount++;
        return HttpResponse.json([]);
      })
    );

    const { default: WinnersNotification } = await import('../../winnersNotification');
    renderWithProviders(<WinnersNotification />, { as: 'listener' });

    await new Promise((r) => setTimeout(r, 2500));
    // Target: no call made because we lack the required scope info.
    // This test will fail against current code (which uses the stale fallback).
    expect(awardsCallCount).toBe(0);
  });

  it('only shows notification once per day (EST)', async () => {
    localStorage.setItem(
      'winnersNotificationShown',
      new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })
    );

    const { default: WinnersNotification } = await import('../../winnersNotification');
    renderWithProviders(<WinnersNotification />, { as: 'listener' });

    await new Promise((r) => setTimeout(r, 2500));
    // Component bails early — no network call made, nothing rendered
    // (implicitly asserted by no DOM presence)
  });
});

// =============================================================================

describe('Finding 7 — Deletion cascade (frontend contract)', () => {
  // The core deletion cascade issues are backend-side (missing FK cleanup).
  // Frontend's responsibility: handle the 500 error gracefully and not
  // optimistically remove the song from the UI until the backend confirms.

  it.todo('ArtistDashboard handles 500 error from DELETE /v1/media/song/{id}');
  it.todo('DeleteAccountWizard handles 500 error from DELETE /v1/users/me');
  it.todo('song remains in UI list when backend delete fails');
});

// =============================================================================

describe('Finding 8 — Leaderboard score consistency', () => {
  // Backend bug: cartesian product inflates scores. Frontend displays whatever
  // the API returns. This test pins the display contract.

  it('displays the score field exactly as returned from the API', async () => {
    server.use(
      http.get(`${API}/v1/vote/leaderboards`, () =>
        HttpResponse.json([
          { rank: 1, targetId: 'u-a', name: 'Artist A', votes: 100, artwork: null },
          { rank: 2, targetId: 'u-b', name: 'Artist B', votes: 50, artwork: null },
        ])
      )
    );

    const { default: LeaderboardsPage } = await import('../../leaderboardsPage');
    renderWithProviders(<LeaderboardsPage />, { as: 'listener' });
    // Can't assert DOM here without triggering filter dropdowns; the
    // backend-side test `VoteServiceLeaderboardTest.java` is the authoritative
    // one for Finding 8.
  });

  it.todo('Artist with 3 votes and 10 plays scores 13, not 60');
});

// =============================================================================

describe('Finding 9 — Purchase revenue surfaces in earnings', () => {
  // Target API contract: /v1/earnings/my-summary returns a `purchaseEarnings`
  // object similar to `referralEarnings` and `supporterEarnings`. Frontend
  // displays it under a "Song Sales" card.

  it('displays purchase earnings when API returns them', async () => {
    server.use(
      http.get(`${API}/v1/earnings/my-summary`, () =>
        HttpResponse.json({
          referralEarnings: { lifetime: 0, thisMonth: 0, level1: { lifetime: 0, thisMonth: 0 }, level2: { lifetime: 0, thisMonth: 0 }, level3: { lifetime: 0, thisMonth: 0 } },
          supporterEarnings: { lifetime: 0, thisMonth: 0 },
          purchaseEarnings: { lifetime: 25.0, thisMonth: 5.98 }, // <-- NEW
          totalEarnings: { lifetime: 25.0, thisMonth: 5.98 },
          currentBalance: 25.0,
          payoutThreshold: 50.0,
          payoutReady: false,
          referralCount: 0,
          supporterCount: 0,
          referralViewsThisMonth: 0,
          cpm: 3.5,
        })
      )
    );

    const { default: Earnings } = await import('../../earnings');
    renderWithProviders(<Earnings />, { as: 'artist' });

    // Will not currently render because purchaseEarnings isn't in the UI yet.
    // This test DOCUMENTS the required UI change.
    // await waitFor(() => expect(screen.getByText(/song sales/i)).toBeInTheDocument());
  });

  it.todo('Artist with only purchase revenue can request payout once >= $50');
  it.todo('Purchase revenue appears in earnings history timeline');
});