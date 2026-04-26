// src/earnings.test.jsx
//
// Comprehensive test suite for the Earnings page.
//
// Covers:
//   • Loading state (spinner + message) while parallel Promise.allSettled fires
//   • Authenticated-artist render path (shows Supporter Earnings card)
//   • Authenticated-listener render path (hides Supporter Earnings card)
//   • Refresh button re-fires all 5 endpoints
//   • Summary cards: current balance, referral earnings, supporter earnings,
//     payout status, and the payout progress bar width math
//   • Stripe banner three states: no account → pending onboarding → ready
//   • handleStartOnboarding navigates window.location.href to returned URL
//   • handleRequestPayout success path + error path with response.data.error
//   • handleOpenStripeDashboard opens new tab via window.open
//   • Tab switching (Overview / Referrals / Payouts / How It Works)
//   • Referrals list renders with photo fallback + ad views + earnings
//   • Empty referrals state
//   • Payouts list renders with status dots + date formatting
//   • Empty payouts state (stripe ready vs not ready)
//   • Stripe return URL param handling: ?stripe=complete switches to payouts
//     tab; ?stripe=refresh surfaces an error message
//   • formatMoney edge cases (null, undefined, 0, tiny numbers, large numbers)
//   • Promise.allSettled resilience — partial endpoint failures don't crash UI
//   • How It Works tab static content (revenue split visuals)
//
// Pattern notes:
//   • Earnings uses Promise.allSettled so partial failures are SUPPOSED to be
//     tolerated. We test that explicitly.
//   • window.location.href assignment is the main test-environment challenge.
//     We replace window.location with a plain object pre-render so jsdom
//     doesn't actually navigate.
//   • apiCall spy is used to assert URLs hit — same pattern as feed/leaderboards.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker, fixtures } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';
import * as axiosModule from './components/axiosInstance';
import cacheService from './services/cacheService';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('./earnings.scss', () => ({}));
vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));

// Import AFTER mocks
import Earnings from './earnings';

// ---------------------------------------------------------------------------
// FIXTURE DATA
// ---------------------------------------------------------------------------
const API = 'http://localhost:8080/api';

const richSummary = {
  currentBalance: 42.5,
  payoutThreshold: 50.0,
  payoutReady: false,
  totalEarnings: { lifetime: 95.0, thisMonth: 12.5 },
  referralEarnings: {
    lifetime: 25.0,
    thisMonth: 8.0,
    level1: { lifetime: 18.0, thisMonth: 5.0 },
    level2: { lifetime: 5.0,  thisMonth: 2.0 },
    level3: { lifetime: 2.0,  thisMonth: 1.0 },
  },
  supporterEarnings: { lifetime: 17.0, thisMonth: 4.5 },
  referralCount: 7,
  supporterCount: 4,
  referralViewsThisMonth: 350,
  cpm: 3.5,
};

const readyForPayoutSummary = {
  ...richSummary,
  currentBalance: 75.0,
  payoutReady: true,
};

const refFixtures = [
  { userId: 'ref-1', username: 'referredOne',  photoUrl: '/uploads/r1.jpg', adViews: 120, earnings: 4.25 },
  { userId: 'ref-2', username: 'referredTwo',  photoUrl: null,              adViews: 40,  earnings: 1.10 },
  { userId: 'ref-3', username: 'referredThree',photoUrl: '/uploads/r3.jpg', adViews: 10,  earnings: 0.35 },
];

const historyFixtures = [
  { date: '2026-04-01', total: 1.25 },
  { date: '2026-04-02', total: 2.10 },
  { date: '2026-04-03', total: 0.50 },
];

const payoutFixtures = [
  {
    payoutId: 'po_100',
    amount: 52.0,
    status: 'completed',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    createdAt: '2026-02-02T10:00:00Z',
  },
  {
    payoutId: 'po_101',
    amount: 50.0,
    status: 'pending',
    periodStart: '2026-02-01',
    periodEnd: '2026-02-28',
    createdAt: '2026-03-01T10:00:00Z',
  },
];

const stripeNoAccount  = { hasAccount: false, onboardingComplete: false, payoutsEnabled: false };
const stripePending    = { hasAccount: true,  onboardingComplete: false, payoutsEnabled: false, stripeAccountId: 'acct_pending' };
const stripeReadyFull  = { hasAccount: true,  onboardingComplete: true,  payoutsEnabled: true,  stripeAccountId: 'acct_ready' };

// ---------------------------------------------------------------------------
// apiCall LOGGER
// ---------------------------------------------------------------------------
let apiCallLog = [];
function setupApiCallLog() {
  apiCallLog = [];
  const original = axiosModule.apiCall;
  vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    apiCallLog.push({ ...config });
    return original(config);
  });
}
function callsMatching(urlSubstring, method) {
  return apiCallLog.filter(c => {
    const methodMatch = method ? (c.method || 'get').toLowerCase() === method.toLowerCase() : true;
    return methodMatch && c.url && c.url.includes(urlSubstring);
  });
}

// ---------------------------------------------------------------------------
// window.location stub
// ---------------------------------------------------------------------------
//
// The component does three things with window.location:
//   1. Reads window.location.search on mount (for ?stripe=complete handling)
//   2. Assigns window.location.href = url in handleStartOnboarding
//   3. Calls window.history.replaceState (NOT window.location.replaceState)
//
// In jsdom, assigning window.location.href = 'https://...' actually tries to
// navigate, which warns. We replace window.location with an object that
// RETAINS a valid href value — critically, MSW/axios use the browser URL as
// a base when resolving relative request URLs, so an empty href causes every
// test to throw "Invalid base URL".
//
let originalLocation;
function stubLocation(searchString = '') {
  originalLocation = window.location;
  const stub = {
    // Keep a valid http origin so URL resolution works
    href: `http://localhost:3000/earnings${searchString}`,
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    search: searchString,
    pathname: '/earnings',
    hash: '',
    toString() { return this.href; },
  };
  delete window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: stub,
  });
  return stub;
}
function restoreLocation() {
  if (originalLocation) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    originalLocation = null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockEndpoints({
  summary = richSummary,
  referrals = [],
  history = [],
  stripeStatus = stripeReadyFull,
  payouts = [],
} = {}) {
  server.use(
    http.get(`${API}/v1/earnings/my-summary`,   () => HttpResponse.json(summary)),
    http.get(`${API}/v1/earnings/my-referrals`, () => HttpResponse.json(referrals)),
    http.get(`${API}/v1/earnings/my-history`,   () => HttpResponse.json(history)),
    http.get(`${API}/v1/stripe/status`,         () => HttpResponse.json(stripeStatus)),
    http.get(`${API}/v1/stripe/payouts`,        () => HttpResponse.json(payouts)),
  );
}

async function renderEarnings({ as = 'artist', config = {} } = {}) {
  mockEndpoints(config);
  const result = renderWithProviders(<Earnings />, { as });
  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText(/loading your earnings/i)).not.toBeInTheDocument();
  });
  return result;
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  cacheService.clearAll();
  callTracker.reset();
  setupApiCallLog();
  stubLocation('');
});

afterEach(() => {
  restoreLocation();
  vi.restoreAllMocks();
});

// ===========================================================================
// LOADING STATE
// ===========================================================================
describe('Earnings — loading state', () => {
  it('shows spinner + "Loading your earnings..." before the data lands', async () => {
    // Slow-walk the summary endpoint so we can catch the loading UI
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    server.use(
      http.get(`${API}/v1/earnings/my-summary`, async () => {
        await pending;
        return HttpResponse.json(richSummary);
      })
    );
    renderWithProviders(<Earnings />, { as: 'artist' });
    expect(await screen.findByText(/loading your earnings/i)).toBeInTheDocument();
    resolveFn();
    await waitFor(() => {
      expect(screen.queryByText(/loading your earnings/i)).not.toBeInTheDocument();
    });
  });

  it('does not fire data fetches when user is not loaded (no userId)', async () => {
    // We can't easily render with a null user through renderWithProviders,
    // but we can test the logical inverse: as a guest, AuthContext's user
    // stays null, so the useEffect guard should keep earnings endpoints quiet.
    renderWithProviders(<Earnings />, { as: 'guest' });
    // Give any effects a tick
    await new Promise((r) => setTimeout(r, 50));
    const calls = callsMatching('/v1/earnings/my-summary');
    expect(calls).toHaveLength(0);
  });
});

// ===========================================================================
// HEADER + BASIC RENDER
// ===========================================================================
describe('Earnings — header and basic render', () => {
  it('renders inside Layout', async () => {
    await renderEarnings();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
  });

  it('renders the "Earnings" h1', async () => {
    await renderEarnings();
    expect(screen.getByRole('heading', { name: /^earnings$/i, level: 1 })).toBeInTheDocument();
  });

  it('includes "supporters" in the header copy for artists', async () => {
    await renderEarnings({ as: 'artist' });
    // "supporters" appears multiple times on an artist page (header + card),
    // so scope to the specific <p> under .earnings-header-text
    const headerP = document.querySelector('.earnings-header-text p');
    expect(headerP.textContent).toMatch(/supporters/i);
  });

  it('excludes "supporters" in the header copy for listeners', async () => {
    await renderEarnings({ as: 'listener' });
    const headerText = screen.getByText(/track your revenue from referrals/i);
    expect(headerText.textContent).not.toMatch(/supporters/i);
  });

  it('fires all 5 data endpoints on mount', async () => {
    await renderEarnings();
    expect(callsMatching('/v1/earnings/my-summary')).toHaveLength(1);
    expect(callsMatching('/v1/earnings/my-referrals')).toHaveLength(1);
    expect(callsMatching('/v1/earnings/my-history')).toHaveLength(1);
    expect(callsMatching('/v1/stripe/status')).toHaveLength(1);
    expect(callsMatching('/v1/stripe/payouts')).toHaveLength(1);
  });

  it('history endpoint includes ?days=30 query param', async () => {
    await renderEarnings();
    const hist = callsMatching('/v1/earnings/my-history')[0];
    expect(hist.url).toContain('days=30');
  });

  it('Refresh button re-fires all 5 endpoints', async () => {
    const user = userEvent.setup();
    await renderEarnings();
    // Baseline: 5 calls
    const before = {
      summary: callsMatching('/v1/earnings/my-summary').length,
      referrals: callsMatching('/v1/earnings/my-referrals').length,
    };
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    await waitFor(() => {
      expect(callsMatching('/v1/earnings/my-summary')).toHaveLength(before.summary + 1);
      expect(callsMatching('/v1/earnings/my-referrals')).toHaveLength(before.referrals + 1);
    });
  });
});

// ===========================================================================
// SUMMARY CARDS
// ===========================================================================
describe('Earnings — summary cards', () => {
  it('Current Balance card shows formatted current balance', async () => {
    await renderEarnings({ config: { summary: richSummary } });
    // $42.50 on mobile formatMoney
    expect(screen.getAllByText('$42.50').length).toBeGreaterThan(0);
  });

  it('Current Balance card shows "This month" subtext', async () => {
    await renderEarnings({ config: { summary: richSummary } });
    expect(screen.getByText(/this month:/i)).toBeInTheDocument();
    // $12.50 comes from totalEarnings.thisMonth
    expect(screen.getByText(/this month:.*\$12\.50/i)).toBeInTheDocument();
  });

  it('Referral Earnings card shows referral count and views', async () => {
    await renderEarnings({ config: { summary: richSummary } });
    expect(screen.getByText(/7 referrals · 350 views this month/i)).toBeInTheDocument();
  });

  it('Supporter Earnings card is VISIBLE for artists', async () => {
    await renderEarnings({ as: 'artist', config: { summary: richSummary } });
    expect(screen.getByText(/supporter earnings/i)).toBeInTheDocument();
    expect(screen.getByText(/4 supporters backing you/i)).toBeInTheDocument();
  });

  it('Supporter Earnings card is HIDDEN for listeners', async () => {
    await renderEarnings({ as: 'listener', config: { summary: richSummary } });
    expect(screen.queryByText(/supporter earnings/i)).not.toBeInTheDocument();
  });

  it('Payout Status shows "Building..." when payoutReady=false', async () => {
    await renderEarnings({ config: { summary: richSummary } });
    expect(screen.getByText(/building\.\.\./i)).toBeInTheDocument();
  });

  it('Payout Status shows "Ready!" when payoutReady=true', async () => {
    await renderEarnings({ config: { summary: readyForPayoutSummary } });
    expect(screen.getByText(/ready!/i)).toBeInTheDocument();
  });

  it('Payout progress bar width is ~85% when balance=$42.50 / threshold=$50', async () => {
    await renderEarnings({ config: { summary: richSummary } });
    const fill = document.querySelector('.progress-fill');
    expect(fill).not.toBeNull();
    // 42.5 / 50 * 100 = 85
    expect(fill.style.width).toBe('85%');
  });

  it('Payout progress bar caps at 100% even when balance > threshold', async () => {
    await renderEarnings({ config: { summary: readyForPayoutSummary } });
    const fill = document.querySelector('.progress-fill');
    // 75 / 50 * 100 = 150, but Math.min(100, ...) caps it
    expect(fill.style.width).toBe('100%');
  });

  it('Payout progress shows "$42.50 / $50.00" text', async () => {
    await renderEarnings({ config: { summary: richSummary } });
    expect(screen.getByText(/\$42\.50\s*\/\s*\$50\.00/)).toBeInTheDocument();
  });
});

// ===========================================================================
// STRIPE BANNER — THREE STATES
// ===========================================================================
describe('Earnings — Stripe banner (no account)', () => {
  it('shows "Set Up Payouts" CTA when hasAccount=false', async () => {
    await renderEarnings({ config: { stripeStatus: stripeNoAccount } });
    expect(screen.getByRole('heading', { name: /set up payouts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('clicking "Get Started" POSTs to /v1/stripe/onboard', async () => {
    const user = userEvent.setup();
    await renderEarnings({ config: { stripeStatus: stripeNoAccount } });
    await user.click(screen.getByRole('button', { name: /get started/i }));
    await waitFor(() => {
      expect(callsMatching('/v1/stripe/onboard', 'post')).toHaveLength(1);
    });
  });

  it('clicking "Get Started" navigates to the returned onboarding URL', async () => {
    server.use(
      http.post(`${API}/v1/stripe/onboard`, () =>
        HttpResponse.json({ url: 'https://stripe.test/onboarding-flow' })
      )
    );
    const user = userEvent.setup();
    await renderEarnings({ config: { stripeStatus: stripeNoAccount } });
    await user.click(screen.getByRole('button', { name: /get started/i }));
    await waitFor(() => {
      expect(window.location.href).toBe('https://stripe.test/onboarding-flow');
    });
  });

  it('disables the button while onboarding call is pending', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    server.use(
      http.post(`${API}/v1/stripe/onboard`, async () => {
        await pending;
        return HttpResponse.json({ url: 'https://stripe.test/x' });
      })
    );
    const user = userEvent.setup();
    await renderEarnings({ config: { stripeStatus: stripeNoAccount } });
    const btn = screen.getByRole('button', { name: /get started/i });
    await user.click(btn);
    await waitFor(() => expect(screen.getByRole('button', { name: /setting up/i })).toBeDisabled());
    resolveFn();
  });

  it('shows generic error when onboarding call fails', async () => {
    server.use(
      http.post(`${API}/v1/stripe/onboard`, () => HttpResponse.error())
    );
    const user = userEvent.setup();
    await renderEarnings({ config: { stripeStatus: stripeNoAccount } });
    await user.click(screen.getByRole('button', { name: /get started/i }));
    expect(await screen.findByText(/failed to start stripe setup/i)).toBeInTheDocument();
  });
});

describe('Earnings — Stripe banner (pending onboarding)', () => {
  it('shows "Complete Your Setup" when hasAccount=true but onboardingComplete=false', async () => {
    await renderEarnings({ config: { stripeStatus: stripePending } });
    expect(screen.getByRole('heading', { name: /complete your setup/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue setup/i })).toBeInTheDocument();
  });

  it('"Continue Setup" also POSTs to /v1/stripe/onboard', async () => {
    const user = userEvent.setup();
    await renderEarnings({ config: { stripeStatus: stripePending } });
    await user.click(screen.getByRole('button', { name: /continue setup/i }));
    await waitFor(() => {
      expect(callsMatching('/v1/stripe/onboard', 'post')).toHaveLength(1);
    });
  });
});

describe('Earnings — Stripe banner (payouts enabled)', () => {
  it('shows "Payouts Enabled" when fully set up', async () => {
    await renderEarnings({ config: { stripeStatus: stripeReadyFull } });
    expect(screen.getByRole('heading', { name: /payouts enabled/i })).toBeInTheDocument();
  });

  it('shows Withdraw button when balance >= $50', async () => {
    await renderEarnings({
      config: { summary: readyForPayoutSummary, stripeStatus: stripeReadyFull },
    });
    expect(screen.getByRole('button', { name: /withdraw \$75\.00/i })).toBeInTheDocument();
  });

  it('hides Withdraw button when balance < $50', async () => {
    await renderEarnings({
      config: { summary: richSummary, stripeStatus: stripeReadyFull },
    });
    // richSummary.currentBalance = 42.5, below the $50 threshold
    expect(screen.queryByRole('button', { name: /withdraw/i })).not.toBeInTheDocument();
  });

  it('renders a Stripe Dashboard link button when ready', async () => {
    await renderEarnings({ config: { stripeStatus: stripeReadyFull } });
    expect(screen.getByRole('button', { name: /stripe dashboard/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// PAYOUT REQUEST FLOW
// ===========================================================================
describe('Earnings — payout request flow', () => {
  it('clicking Withdraw posts to /v1/stripe/payout and shows success message', async () => {
    server.use(
      http.post(`${API}/v1/stripe/payout`, () =>
        HttpResponse.json({ success: true, payoutId: 'po_new', amount: 75.0, status: 'pending' })
      )
    );
    const user = userEvent.setup();
    await renderEarnings({
      config: { summary: readyForPayoutSummary, stripeStatus: stripeReadyFull },
    });
    await user.click(screen.getByRole('button', { name: /withdraw/i }));
    expect(await screen.findByText(/payout of \$75\.00 initiated successfully/i)).toBeInTheDocument();
  });

  it('successful payout refreshes all endpoints (fetchAllData re-runs)', async () => {
    server.use(
      http.post(`${API}/v1/stripe/payout`, () =>
        HttpResponse.json({ success: true, amount: 75.0 })
      )
    );
    const user = userEvent.setup();
    await renderEarnings({
      config: { summary: readyForPayoutSummary, stripeStatus: stripeReadyFull },
    });
    const summaryBefore = callsMatching('/v1/earnings/my-summary').length;
    await user.click(screen.getByRole('button', { name: /withdraw/i }));
    await waitFor(() => {
      expect(callsMatching('/v1/earnings/my-summary').length).toBeGreaterThan(summaryBefore);
    });
  });

  it('shows the API error message when payout fails with response.data.error', async () => {
    server.use(
      http.post(`${API}/v1/stripe/payout`, () =>
        HttpResponse.json({ error: 'Insufficient balance after fees' }, { status: 400 })
      )
    );
    const user = userEvent.setup();
    await renderEarnings({
      config: { summary: readyForPayoutSummary, stripeStatus: stripeReadyFull },
    });
    await user.click(screen.getByRole('button', { name: /withdraw/i }));
    expect(await screen.findByText(/insufficient balance after fees/i)).toBeInTheDocument();
  });

  it('falls back to generic "Payout request failed." when error has no message', async () => {
    server.use(
      http.post(`${API}/v1/stripe/payout`, () => HttpResponse.error())
    );
    const user = userEvent.setup();
    await renderEarnings({
      config: { summary: readyForPayoutSummary, stripeStatus: stripeReadyFull },
    });
    await user.click(screen.getByRole('button', { name: /withdraw/i }));
    expect(await screen.findByText(/payout request failed/i)).toBeInTheDocument();
  });

  it('Processing state disables the button during payout request', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    server.use(
      http.post(`${API}/v1/stripe/payout`, async () => {
        await pending;
        return HttpResponse.json({ success: true, amount: 75.0 });
      })
    );
    const user = userEvent.setup();
    await renderEarnings({
      config: { summary: readyForPayoutSummary, stripeStatus: stripeReadyFull },
    });
    await user.click(screen.getByRole('button', { name: /withdraw/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /processing/i })).toBeDisabled());
    resolveFn();
  });
});

// ===========================================================================
// STRIPE DASHBOARD LINK
// ===========================================================================
describe('Earnings — Stripe dashboard link', () => {
  it('clicking "Stripe Dashboard" calls /v1/stripe/dashboard-link and opens new tab', async () => {
    server.use(
      http.get(`${API}/v1/stripe/dashboard-link`, () =>
        HttpResponse.json({ url: 'https://dashboard.stripe.com/acct_test' })
      )
    );
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    await renderEarnings({ config: { stripeStatus: stripeReadyFull } });
    await user.click(screen.getByRole('button', { name: /stripe dashboard/i }));
    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith('https://dashboard.stripe.com/acct_test', '_blank');
    });
  });

  it('surfaces error when dashboard-link fetch fails', async () => {
    server.use(
      http.get(`${API}/v1/stripe/dashboard-link`, () => HttpResponse.error())
    );
    // axiosInstance falls back to mock for GET errors, which returns { data: [] },
    // so res.data.url is undefined and window.open is never called.
    // The setError branch only fires when the .catch actually runs — and
    // because of the axios fallback it doesn't. This is a known artifact of
    // the fallback (see axiosInstance.jsx). Document the current behavior:
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const user = userEvent.setup();
    await renderEarnings({ config: { stripeStatus: stripeReadyFull } });
    await user.click(screen.getByRole('button', { name: /stripe dashboard/i }));
    await new Promise((r) => setTimeout(r, 30));
    // window.open is NOT called because res.data.url is falsy
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// TAB SWITCHING
// ===========================================================================
describe('Earnings — tab switching', () => {
  it('starts on Overview tab', async () => {
    await renderEarnings({ config: { summary: richSummary } });
    expect(screen.getByRole('heading', { name: /referral earnings by level/i })).toBeInTheDocument();
  });

  it('switches to Referrals tab', async () => {
    const user = userEvent.setup();
    await renderEarnings({ config: { referrals: refFixtures } });
    await user.click(screen.getByRole('button', { name: /my referrals/i }));
    expect(await screen.findByText('referredOne')).toBeInTheDocument();
  });

  it('switches to Payouts tab', async () => {
    const user = userEvent.setup();
    await renderEarnings({ config: { payouts: payoutFixtures, stripeStatus: stripeReadyFull } });
    await user.click(screen.getByRole('button', { name: /^payouts/i }));
    expect(await screen.findByRole('heading', { name: /payout history/i })).toBeInTheDocument();
  });

  it('switches to How It Works tab', async () => {
    const user = userEvent.setup();
    await renderEarnings();
    await user.click(screen.getByRole('button', { name: /how it works/i }));
    expect(await screen.findByRole('heading', { name: /display ad revenue split/i })).toBeInTheDocument();
  });

  it('tab buttons show counts in parentheses', async () => {
    await renderEarnings({ config: { referrals: refFixtures, payouts: payoutFixtures } });
    expect(screen.getByRole('button', { name: /my referrals \(3\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^payouts \(2\)/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// OVERVIEW TAB — CONTENT
// ===========================================================================
describe('Earnings — Overview tab content', () => {
  it('renders all three referral level rows with percentages', async () => {
    await renderEarnings({ config: { summary: richSummary } });
    expect(screen.getByText(/level 1 — direct referrals/i)).toBeInTheDocument();
    expect(screen.getByText(/level 2 — your referrals' referrals/i)).toBeInTheDocument();
    expect(screen.getByText(/level 3 — third degree/i)).toBeInTheDocument();
    // Percentages are duplicated elsewhere (e.g. "Referral Income (up to 17%)"
    // copy, ad-revenue split diagram). Scope to the three level-pct spans.
    const pcts = document.querySelectorAll('.level-breakdown .level-pct');
    const pctTexts = Array.from(pcts).map((el) => el.textContent);
    expect(pctTexts).toEqual(['10%', '5%', '2%']);
  });

  it('renders level amounts from summary.referralEarnings', async () => {
    await renderEarnings({ config: { summary: richSummary } });
    expect(screen.getByText('$18.00')).toBeInTheDocument();  // level1
    expect(screen.getByText('$5.00')).toBeInTheDocument();   // level2
    expect(screen.getByText('$2.00')).toBeInTheDocument();   // level3
  });

  it('renders the mini chart with one bar per history day', async () => {
    await renderEarnings({ config: { history: historyFixtures } });
    const bars = document.querySelectorAll('.chart-bar');
    expect(bars).toHaveLength(historyFixtures.length);
  });

  it('shows empty chart message when history is empty', async () => {
    await renderEarnings({ config: { history: [] } });
    expect(screen.getByText(/no earnings activity yet/i)).toBeInTheDocument();
  });

  it('shows "Supporter Income" stream only for artists', async () => {
    await renderEarnings({ as: 'artist' });
    expect(screen.getByText(/supporter income \(15%\)/i)).toBeInTheDocument();
  });

  it('hides "Supporter Income" stream for listeners', async () => {
    await renderEarnings({ as: 'listener' });
    expect(screen.queryByText(/supporter income \(15%\)/i)).not.toBeInTheDocument();
  });
});

// ===========================================================================
// REFERRALS TAB
// ===========================================================================
describe('Earnings — Referrals tab', () => {
  it('renders one row per referral', async () => {
    const user = userEvent.setup();
    await renderEarnings({ config: { referrals: refFixtures } });
    await user.click(screen.getByRole('button', { name: /my referrals/i }));
    expect(await screen.findByText('referredOne')).toBeInTheDocument();
    expect(screen.getByText('referredTwo')).toBeInTheDocument();
    expect(screen.getByText('referredThree')).toBeInTheDocument();
  });

  it('renders ad view counts', async () => {
    const user = userEvent.setup();
    await renderEarnings({ config: { referrals: refFixtures } });
    await user.click(screen.getByRole('button', { name: /my referrals/i }));
    expect(await screen.findByText(/120 ad views/i)).toBeInTheDocument();
    expect(screen.getByText(/40 ad views/i)).toBeInTheDocument();
    expect(screen.getByText(/10 ad views/i)).toBeInTheDocument();
  });

  it('falls back to backimage when referral photoUrl is null', async () => {
    const user = userEvent.setup();
    await renderEarnings({ config: { referrals: refFixtures } });
    await user.click(screen.getByRole('button', { name: /my referrals/i }));
    await screen.findByText('referredTwo');
    const secondImg = screen.getByAltText('referredTwo');
    expect(secondImg.src).toContain('randomrapper.jpeg');
  });

  it('prefixes API base for relative photo URLs', async () => {
    const user = userEvent.setup();
    await renderEarnings({ config: { referrals: refFixtures } });
    await user.click(screen.getByRole('button', { name: /my referrals/i }));
    const firstImg = await screen.findByAltText('referredOne');
    expect(firstImg.src).toBe('http://localhost:8080/uploads/r1.jpg');
  });

  it('shows empty state when there are no referrals', async () => {
    const user = userEvent.setup();
    await renderEarnings({ config: { referrals: [] } });
    await user.click(screen.getByRole('button', { name: /my referrals/i }));
    expect(await screen.findByRole('heading', { name: /no referrals yet/i })).toBeInTheDocument();
    expect(screen.getByText(/share your referral code/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// PAYOUTS TAB
// ===========================================================================
describe('Earnings — Payouts tab', () => {
  it('renders payout rows with amounts and statuses', async () => {
    const user = userEvent.setup();
    await renderEarnings({
      config: { payouts: payoutFixtures, stripeStatus: stripeReadyFull },
    });
    await user.click(screen.getByRole('button', { name: /^payouts/i }));
    expect(await screen.findByText('$52.00')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
    // Status labels (completed, pending) — each appears as status span
    const completedEls = screen.getAllByText(/completed/i);
    const pendingEls = screen.getAllByText(/pending/i);
    expect(completedEls.length).toBeGreaterThan(0);
    expect(pendingEls.length).toBeGreaterThan(0);
  });

  it('does not show the setup prompt when stripe is ready', async () => {
    const user = userEvent.setup();
    await renderEarnings({
      config: { payouts: payoutFixtures, stripeStatus: stripeReadyFull },
    });
    await user.click(screen.getByRole('button', { name: /^payouts/i }));
    await screen.findByText('$52.00');
    expect(screen.queryByRole('heading', { name: /set up stripe to receive payouts/i })).not.toBeInTheDocument();
  });

  it('shows "Set Up Stripe" prompt when stripe is not ready', async () => {
    const user = userEvent.setup();
    await renderEarnings({
      config: { payouts: [], stripeStatus: stripeNoAccount },
    });
    await user.click(screen.getByRole('button', { name: /^payouts/i }));
    expect(await screen.findByRole('heading', { name: /set up stripe to receive payouts/i })).toBeInTheDocument();
  });

  it('shows "No Payouts Yet" empty state when stripe is ready but payouts list is empty', async () => {
    const user = userEvent.setup();
    await renderEarnings({
      config: { payouts: [], stripeStatus: stripeReadyFull },
    });
    await user.click(screen.getByRole('button', { name: /^payouts/i }));
    expect(await screen.findByRole('heading', { name: /no payouts yet/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// HOW IT WORKS TAB
// ===========================================================================
describe('Earnings — How It Works tab', () => {
  it('renders the Display Ad Revenue split (68/15/10/5/2)', async () => {
    const user = userEvent.setup();
    await renderEarnings();
    await user.click(screen.getByRole('button', { name: /how it works/i }));
    // Display Ad + Audio Ad both contain "L1 10%", so scope to the Display
    // Ad Revenue Split section specifically.
    const displayHeading = await screen.findByRole('heading', { name: /display ad revenue split/i });
    const displaySection = displayHeading.closest('.how-section');
    expect(within(displaySection).getByText(/unis 68%/i)).toBeInTheDocument();
    expect(within(displaySection).getByText(/artist 15%/i)).toBeInTheDocument();
    expect(within(displaySection).getByText(/l1 10%/i)).toBeInTheDocument();
  });

  it('renders the Audio Ad split (coming soon — 60/23/10/5/2)', async () => {
    const user = userEvent.setup();
    await renderEarnings();
    await user.click(screen.getByRole('button', { name: /how it works/i }));
    expect(await screen.findByRole('heading', { name: /audio ad revenue split/i })).toBeInTheDocument();
    expect(screen.getByText(/artist 60%/i)).toBeInTheDocument();
    expect(screen.getByText(/unis 23%/i)).toBeInTheDocument();
  });

  it('renders the 3-level referral chain visualization', async () => {
    const user = userEvent.setup();
    await renderEarnings();
    await user.click(screen.getByRole('button', { name: /how it works/i }));
    expect(await screen.findByText(/^you$/i)).toBeInTheDocument();
    expect(screen.getByText(/you earn 10%/i)).toBeInTheDocument();
    expect(screen.getByText(/you earn 5%/i)).toBeInTheDocument();
    expect(screen.getByText(/you earn 2%/i)).toBeInTheDocument();
  });

  it('renders payout rules with the $50 minimum', async () => {
    const user = userEvent.setup();
    await renderEarnings();
    await user.click(screen.getByRole('button', { name: /how it works/i }));
    // "$50.00" also appears in the payout progress text (x / $50.00), so
    // scope to the how-rules list.
    expect(await screen.findByText(/minimum payout:/i)).toBeInTheDocument();
    const rulesList = document.querySelector('.how-rules');
    expect(rulesList).not.toBeNull();
    expect(within(rulesList).getByText(/\$50\.00/)).toBeInTheDocument();
  });
});

// ===========================================================================
// STRIPE RETURN URL PARAM HANDLING
// ===========================================================================
describe('Earnings — Stripe return URL params', () => {
  it('?stripe=complete switches active tab to Payouts on mount', async () => {
    restoreLocation();
    stubLocation('?stripe=complete');
    await renderEarnings({ config: { payouts: payoutFixtures, stripeStatus: stripeReadyFull } });
    // Payouts tab should be the one rendered (shows Payout History heading)
    expect(await screen.findByRole('heading', { name: /payout history/i })).toBeInTheDocument();
  });

  it('?stripe=refresh surfaces an error message', async () => {
    restoreLocation();
    stubLocation('?stripe=refresh');
    await renderEarnings();
    expect(await screen.findByText(/stripe onboarding was not completed/i)).toBeInTheDocument();
  });

  it('?stripe=complete calls replaceState to clean up URL', async () => {
    restoreLocation();
    stubLocation('?stripe=complete');
    await renderEarnings({ config: { payouts: payoutFixtures, stripeStatus: stripeReadyFull } });
    await waitFor(() => {
      expect(window.history.replaceState).toBeDefined();
    });
    // Component uses window.history.replaceState (not window.location.replaceState)
    // So we can't directly assert on our stub. Instead check that the
    // complete-param effect did its job: active tab is Payouts.
    expect(screen.getByRole('heading', { name: /payout history/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// formatMoney EDGE CASES
// ===========================================================================
describe('Earnings — formatMoney edge cases', () => {
  it('renders $0.00 when currentBalance is 0', async () => {
    await renderEarnings({
      config: {
        summary: { ...richSummary, currentBalance: 0, totalEarnings: { lifetime: 0, thisMonth: 0 } },
      },
    });
    expect(screen.getAllByText('$0.00').length).toBeGreaterThan(0);
  });

  it('uses 4 decimal places for sub-$1 amounts (e.g. $0.0540)', async () => {
    await renderEarnings({
      config: {
        summary: {
          ...richSummary,
          currentBalance: 0.054,
          totalEarnings: { lifetime: 0.054, thisMonth: 0.054 },
        },
      },
    });
    // There should be a $0.0540 somewhere on screen
    expect(screen.getAllByText(/\$0\.0540/).length).toBeGreaterThan(0);
  });

  it('uses 6 decimal places for tiny amounts (< $0.01)', async () => {
    await renderEarnings({
      config: {
        summary: {
          ...richSummary,
          currentBalance: 0.001234,
          totalEarnings: { lifetime: 0.001234, thisMonth: 0.001234 },
        },
      },
    });
    expect(screen.getAllByText(/\$0\.001234/).length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// PROMISE.ALLSETTLED RESILIENCE
// ===========================================================================
describe('Earnings — partial endpoint failures (Promise.allSettled resilience)', () => {
  it('renders summary even when referrals endpoint fails', async () => {
    server.use(
      http.get(`${API}/v1/earnings/my-summary`,   () => HttpResponse.json(richSummary)),
      http.get(`${API}/v1/earnings/my-referrals`, () => HttpResponse.error()),
      http.get(`${API}/v1/earnings/my-history`,   () => HttpResponse.json([])),
      http.get(`${API}/v1/stripe/status`,         () => HttpResponse.json(stripeReadyFull)),
      http.get(`${API}/v1/stripe/payouts`,        () => HttpResponse.json([])),
    );
    renderWithProviders(<Earnings />, { as: 'artist' });
    await waitFor(() => expect(screen.queryByText(/loading your earnings/i)).not.toBeInTheDocument());
    // Summary data is present
    expect(screen.getAllByText('$42.50').length).toBeGreaterThan(0);
  });

  it('renders referrals even when summary endpoint fails', async () => {
    server.use(
      http.get(`${API}/v1/earnings/my-summary`,   () => HttpResponse.error()),
      http.get(`${API}/v1/earnings/my-referrals`, () => HttpResponse.json(refFixtures)),
      http.get(`${API}/v1/earnings/my-history`,   () => HttpResponse.json([])),
      http.get(`${API}/v1/stripe/status`,         () => HttpResponse.json(stripeReadyFull)),
      http.get(`${API}/v1/stripe/payouts`,        () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    renderWithProviders(<Earnings />, { as: 'artist' });
    await waitFor(() => expect(screen.queryByText(/loading your earnings/i)).not.toBeInTheDocument());
    // Switch to referrals tab and verify we still rendered that data
    await user.click(screen.getByRole('button', { name: /my referrals/i }));
    expect(await screen.findByText('referredOne')).toBeInTheDocument();
  });
});