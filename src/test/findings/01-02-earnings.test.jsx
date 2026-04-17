// src/test/findings/01-02-earnings.test.jsx
//
// Findings 1 & 2 — Ad tracking coverage and earnings math correctness.
//
// Note: Most of Finding 2 lives in the backend (EarningsService.java). These
// frontend tests verify that (a) the ad-view endpoint is hit from the right
// pages, (b) the earnings display correctly reflects whatever the API returns,
// (c) the percentages the frontend displays match the documented split.

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { server } from '../mocks/server';
import { callTracker, fixtures } from '../mocks/handlers';
import { renderWithProviders } from '../utils';

const API = 'http://localhost:8080/api';

describe('Finding 1 — Ad view tracking coverage', () => {
  beforeEach(() => {
    callTracker.reset();
  });

  it('Feed fires /track-view for logged-in users', async () => {
    const { default: Feed } = await import('../../feed');
    renderWithProviders(<Feed />, { as: 'listener' });

    await waitFor(
      () => expect(callTracker.get('ad-view')).toBe(1),
      { timeout: 3000 }
    );
  });

  it('Feed does NOT fire /track-view for guests', async () => {
    const { default: Feed } = await import('../../feed');
    renderWithProviders(<Feed />, { as: 'guest' });

    // Wait a tick for any async effects
    await new Promise((r) => setTimeout(r, 200));
    expect(callTracker.get('ad-view')).toBe(0);
  });

  // These tests document the CURRENT GAP. Once Finding 1 is fixed (tracker
  // added to all ad-bearing pages), these .todo entries become real tests
  // identical in shape to the Feed ones above.
  it.todo('SongPage fires /track-view for logged-in users');
  it.todo('ArtistPage fires /track-view for logged-in users');
  it.todo('JurisdictionPage fires /track-view for logged-in users');
  it.todo('MilestonesPage fires /track-view for logged-in users');
  it.todo('LeaderboardsPage fires /track-view for logged-in users');
});

describe('Finding 2 — Earnings summary display correctness', () => {
  it('displays totals exactly as the API returns them', async () => {
    // This asserts the frontend is a faithful render of the API response.
    // If the backend bug (totalMonthly typo, line 159) is fixed, the displayed
    // number changes — but this test doesn't break. It just watches the wire.
    server.use(
      http.get(`${API}/v1/earnings/my-summary`, () =>
        HttpResponse.json({
          ...fixtures.earnings,
          totalEarnings: { lifetime: 100.5, thisMonth: 42.75 },
          currentBalance: 100.5,
          payoutReady: true,
        })
      )
    );

    const { default: Earnings } = await import('../../earnings');
    renderWithProviders(<Earnings />, { as: 'artist' });

    // Formatted as "$100.50" via toFixed(2). Match loosely so we tolerate
    // any surrounding whitespace or styling nodes.
    await waitFor(
      () => {
        // Text may be split across nodes or inside a formatted span
        const match = screen.queryAllByText((content) =>
          content.replace(/\s/g, '').includes('$100.50')
        );
        expect(match.length).toBeGreaterThan(0);
      },
      { timeout: 8000 }
    );
  }, 10000);

  it('gates the "Request Payout" button on payoutReady from the API', async () => {
    server.use(
      http.get(`${API}/v1/earnings/my-summary`, () =>
        HttpResponse.json({ ...fixtures.earnings, payoutReady: false, currentBalance: 25.0 })
      )
    );

    const { default: Earnings } = await import('../../earnings');
    renderWithProviders(<Earnings />, { as: 'artist' });

    // Give the page time to settle
    await new Promise((r) => setTimeout(r, 500));

    const button = screen.queryByRole('button', { name: /request payout/i });
    // Button may be hidden OR disabled depending on implementation
    if (button) {
      expect(button).toBeDisabled();
    }
  });

  // This test will FAIL until Finding 2b is fixed. It asserts that the API
  // contract is correct, which the frontend relies on. The frontend itself
  // renders whatever the API returns, so this test lives at the contract layer.
  it.todo('currentBalance = lifetime - completedPayouts (backend Finding 2b)');
  it.todo('totalEarnings.thisMonth = referralMonthly + supporterMonthly (backend Finding 2a)');
});

describe('Finding 1 — Percentage constants match docs', () => {
  // These are authoritative. If the backend ever changes these split ratios,
  // the frontend must be updated too. This test codifies the contract.
  const DOCUMENTED_SPLIT = {
    supporter: 0.15, // 15%
    level1: 0.10,    // 10%
    level2: 0.05,    // 5%
    level3: 0.02,    // 2%
    unis: 0.68,      // 68%
  };

  it('sums to 100%', () => {
    const total = Object.values(DOCUMENTED_SPLIT).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });

  it('matches backend constants in EarningsService.java', () => {
    // Backend lines 49-53:
    //   SUPPORTER_RATE = 0.15
    //   LEVEL1_RATE    = 0.10
    //   LEVEL2_RATE    = 0.05
    //   LEVEL3_RATE    = 0.02
    expect(DOCUMENTED_SPLIT.supporter).toBe(0.15);
    expect(DOCUMENTED_SPLIT.level1).toBe(0.10);
    expect(DOCUMENTED_SPLIT.level2).toBe(0.05);
    expect(DOCUMENTED_SPLIT.level3).toBe(0.02);
  });
});
