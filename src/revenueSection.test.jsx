// src/revenueSection.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';

// CashoutPanel has its own spec — mock it and expose its props/handlers.
vi.mock('./CashoutPanel', () => ({
  default: ({ balance, stripeConnected, onRequestPayout, onConnectStripe }) => (
    <div data-testid="cashout">
      <span>balance:{balance}</span>
      <span>{stripeConnected ? 'connected' : 'not-connected'}</span>
      <button onClick={onConnectStripe}>do-connect</button>
      <button onClick={() => onRequestPayout()}>do-payout</button>
    </div>
  ),
}));

import RevenueSection from './revenueSection';

const API = 'http://localhost:8080/api';

const EARNINGS = {
  currentBalance: '50.00',
  payoutThreshold: '50.00',
  referralEarnings: { lifetime: 12, thisMonth: 3, level1: {}, level2: {}, level3: {} },
  referralCount: 4,
  referralViewsThisMonth: 100,
  supporterEarnings: { lifetime: 40, thisMonth: 10 },
  supporterCount: 6,
};

function installRevenue({ salesTotal = { copies: 3, grossCents: 3000, netCents: 2700 }, onboardResp = {}, payoutResp = { success: true } } = {}) {
  server.use(
    http.get(`${API}/v1/artist-analytics/artist/:id/sales-total`, () => HttpResponse.json(salesTotal)),
    http.post(`${API}/v1/stripe/onboard`, () => HttpResponse.json(onboardResp)),
    http.post(`${API}/v1/stripe/payout`, () => HttpResponse.json(payoutResp)),
  );
}

const renderRevenue = (props = {}) =>
  renderWithProviders(
    <RevenueSection artistId="artist-1" earningsSummary={EARNINGS} isStripeReady={false} {...props} />,
    { as: 'artist' },
  );

describe('RevenueSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    cacheService.clearAll();
    server.resetHandlers();
    installRevenue();
  });
  afterEach(() => { cleanup(); cacheService.clearAll(); });

  it('renders the three income streams with amounts', async () => {
    renderRevenue();
    expect(await screen.findByText('$27.00')).toBeInTheDocument(); // sales net
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Referrals')).toBeInTheDocument();
    expect(screen.getByText('Supporters')).toBeInTheDocument();
    expect(screen.getByText('$12.00')).toBeInTheDocument();        // referrals lifetime
    expect(screen.getByText('$40.00')).toBeInTheDocument();        // supporters lifetime
    expect(screen.getByText(/3 copies sold/i)).toBeInTheDocument();
    expect(screen.getByText(/4 referrals/i)).toBeInTheDocument();
    expect(screen.getByText(/6 supporters/i)).toBeInTheDocument();
  });

  it('shows "No sales yet" when there are no sales', async () => {
    installRevenue({ salesTotal: { copies: 0, grossCents: 0, netCents: 0 } });
    renderRevenue();
    expect(await screen.findByText(/No sales yet/i)).toBeInTheDocument();
  });

  it('expands the sales stream to show the breakdown, and collapses again', async () => {
    renderRevenue();
    const user = userEvent.setup();
    const salesBtn = await screen.findByRole('button', { name: /Sales/i });
    await user.click(salesBtn);
    expect(await screen.findByText('Copies sold')).toBeInTheDocument();
    expect(screen.getByText(/Gross sales/i)).toBeInTheDocument();
    expect(screen.getByText('$30.00')).toBeInTheDocument();         // gross
    expect(screen.getByText(/Your cut/i)).toBeInTheDocument();
    await user.click(salesBtn);
    expect(screen.queryByText('Copies sold')).not.toBeInTheDocument();
  });

  it('shows "Setup needed" when Stripe is not ready', async () => {
    renderRevenue({ isStripeReady: false });
    expect(await screen.findByText(/Setup needed/i)).toBeInTheDocument();
  });

  it('shows "Payout ready" when Stripe is ready', async () => {
    renderRevenue({ isStripeReady: true });
    expect(await screen.findByText(/Payout ready/i)).toBeInTheDocument();
  });

  it('passes balance (in cents) and connection state to CashoutPanel', async () => {
    renderRevenue({ isStripeReady: true });
    await screen.findByTestId('cashout');
    expect(screen.getByText('balance:5000')).toBeInTheDocument();
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('starts Stripe onboarding when connect is triggered', async () => {
    let onboarded = false;
    server.use(http.post(`${API}/v1/stripe/onboard`, () => { onboarded = true; return HttpResponse.json({}); }));
    renderRevenue();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'do-connect' }));
    await waitFor(() => expect(onboarded).toBe(true));
  });

  it('requests a payout and refreshes the parent on success', async () => {
    const onPayoutSuccess = vi.fn();
    renderRevenue({ isStripeReady: true, onPayoutSuccess });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'do-payout' }));
    await waitFor(() => expect(onPayoutSuccess).toHaveBeenCalled());
  });

  it('expands the referrals and supporters streams', async () => {
    renderRevenue();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Referrals/i }));
    expect(await screen.findByText('This month')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Supporters/i }));
    expect(await screen.findByText('Backed by')).toBeInTheDocument();
  });

});