// src/admin/CommunityShareAdmin.test.jsx
//
// Admin → Community Share: preview a month, close it (super admin only),
// list closed months, and adjust a balance.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../layout', () => ({ default: ({ children }) => <div data-testid="layout">{children}</div> }));
vi.mock('./metrics/metricsPage.scss', () => ({}));
vi.mock('./communityShareAdmin.scss', () => ({}));

let mockUser = { userId: 'admin-1', adminRole: 'super_admin' };
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

const apiCall = vi.fn();
vi.mock('../components/axiosInstance', () => ({ apiCall: (...args) => apiCall(...args) }));

import CommunityShareAdmin from './CommunityShareAdmin';

const PREVIEW = {
  month: '2026-09',
  adIncome: 1000,
  otherIncome: 0,
  feeIncome: 40.5,
  totalRevenue: 1040.5,
  countedPlays: 52000,
  listeners: 410,
  earners: 120,
  paidToCommunity: 298.12,
  keptByUnis: 742.38,
  byStream: { supporter: 140.2, referral_1: 90.1, referral_2: 50.5, referral_3: 17.32 },
  suggestedFeeIncome: 40.5,
  alreadyClosed: false,
};

function route(config) {
  const { url, method = 'get' } = config;
  if (url.startsWith('/v1/admin/earnings/preview')) return Promise.resolve({ data: PREVIEW });
  if (url === '/v1/admin/earnings/closes') return Promise.resolve({ data: [] });
  if (url === '/v1/admin/earnings/adjustments' && method === 'get') return Promise.resolve({ data: [] });
  if (url === '/v1/admin/earnings/close') return Promise.resolve({ data: { ...PREVIEW } });
  if (url === '/v1/admin/earnings/adjustments') {
    return Promise.resolve({ data: { username: config.data.username, amount: 50 } });
  }
  return Promise.reject(new Error(`unexpected ${method} ${url}`));
}

const renderPage = () => render(<MemoryRouter><CommunityShareAdmin /></MemoryRouter>);

async function preview(user) {
  await user.type(screen.getByLabelText(/ad income received/i), '1000');
  await user.click(screen.getByRole('button', { name: /^preview$/i }));
  return screen.findByText('$1,040.50');
}

beforeEach(() => {
  apiCall.mockReset();
  apiCall.mockImplementation(route);
  mockUser = { userId: 'admin-1', adminRole: 'super_admin' };
});

describe('CommunityShareAdmin', () => {
  it('previews a month without saving, and fills in the suggested fee', async () => {
    const user = userEvent.setup();
    renderPage();
    await preview(user);

    const call = apiCall.mock.calls.find(([c]) => c.url.startsWith('/v1/admin/earnings/preview'))[0];
    expect(call.url).toContain('adIncome=1000');
    expect(call.url).not.toContain('feeIncome');           // left blank → server suggests it
    expect(screen.getByLabelText(/unis fees on sales/i)).toHaveValue('40.5');

    // The preview stays up after the fee box is filled in.
    expect(screen.getByText('52,000')).toBeInTheDocument();
    expect(screen.getByText('$298.12')).toBeInTheDocument();
    expect(screen.getByText('$742.38')).toBeInTheDocument();
    expect(apiCall.mock.calls.some(([c]) => c.url === '/v1/admin/earnings/close')).toBe(false);
  });

  it('hides the preview when a number changes', async () => {
    const user = userEvent.setup();
    renderPage();
    await preview(user);
    await user.type(screen.getByLabelText(/other income/i), '5');
    expect(screen.queryByText('$1,040.50')).not.toBeInTheDocument();
  });

  it('closes the month only after the confirmation box is ticked', async () => {
    const user = userEvent.setup();
    renderPage();
    await preview(user);

    const closeBtn = screen.getByRole('button', { name: /close september 2026/i });
    expect(closeBtn).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    await user.click(closeBtn);

    await waitFor(() => expect(apiCall.mock.calls.some(([c]) => c.url === '/v1/admin/earnings/close')).toBe(true));
    const body = apiCall.mock.calls.find(([c]) => c.url === '/v1/admin/earnings/close')[0].data;
    expect(body).toMatchObject({ month: expect.stringMatching(/^\d{4}-\d{2}$/), adIncome: '1000', otherIncome: '0', feeIncome: '40.5' });
    expect(await screen.findByText(/september 2026 is closed/i)).toBeInTheDocument();
  });

  it('does not offer closing or adjustments to a regular admin', async () => {
    mockUser = { userId: 'admin-2', adminRole: 'admin' };
    const user = userEvent.setup();
    renderPage();
    await preview(user);
    expect(screen.queryByRole('button', { name: /close september/i })).not.toBeInTheDocument();
    expect(screen.getByText(/only a super admin can close a month/i)).toBeInTheDocument();
    expect(screen.getByText(/only a super admin can adjust balances/i)).toBeInTheDocument();
  });

  it('lists closed months', async () => {
    apiCall.mockImplementation((c) => (c.url === '/v1/admin/earnings/closes'
      ? Promise.resolve({ data: [{ closeId: 'c1', month: '2026-08', totalRevenue: 900, countedPlays: 40000,
          paidToCommunity: 250, keptByUnis: 650, earners: 99, closedAt: '2026-09-24T10:00:00', closedBy: 'charles' }] })
      : route(c)));
    renderPage();
    const card = (await screen.findByText('August 2026')).closest('section');
    expect(within(card).getByText('$900.00')).toBeInTheDocument();
    expect(within(card).getByText(/charles/)).toBeInTheDocument();
  });

  it('adds an adjustment after confirming', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await user.type(await screen.findByLabelText(/username/i), 'tester');
    await user.type(screen.getByLabelText(/amount \(\$\)/i), '50');
    await user.type(screen.getByLabelText(/reason/i), 'Live payout test');
    await user.click(screen.getByRole('button', { name: /add adjustment/i }));
    expect(await screen.findByText(/done: \$50\.00 for tester/i)).toBeInTheDocument();
    const post = apiCall.mock.calls.find(([c]) => c.url === '/v1/admin/earnings/adjustments' && c.method === 'post')[0];
    expect(post.data).toEqual({ username: 'tester', amount: '50', note: 'Live payout test' });
  });
});
