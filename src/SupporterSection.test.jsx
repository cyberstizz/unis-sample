// src/SupporterSection.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig();
  return { ...actual, useNavigate: () => mockNavigate };
});

import SupporterSection from './SupporterSection';

const API = 'http://localhost:8080/api';

const SUPPORTERS = {
  supportersCount: 12,
  topSupporter: { userId: 'fan-1', username: 'BigFan', photoUrl: null, plays: 50, since: '2025-01-01' },
  recentSupporters: [
    { userId: 'fan-2', username: 'Casey', photoUrl: null, since: '2025-02-01' },
    { userId: 'fan-3', username: 'Drew', photoUrl: null, since: '2025-03-01' },
  ],
  supporterGrowth: [],
};

function installSupporters(data = SUPPORTERS) {
  server.use(
    http.get(`${API}/v1/artist-analytics/artist/:id/supporters`, () => HttpResponse.json(data)),
    http.post(`${API}/v1/messages/broadcast`, () => HttpResponse.json({ sent: 12, skipped: 0, total: 12 })),
  );
}

const renderSection = () =>
  renderWithProviders(<SupporterSection artistId="artist-1" />, { as: 'artist' });

describe('SupporterSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    cacheService.clearAll();
    server.resetHandlers();
    installSupporters();
  });
  afterEach(() => { cleanup(); cacheService.clearAll(); });

  it('renders supporters once loaded', async () => {
    renderSection();
    expect(await screen.findByText('BigFan')).toBeInTheDocument();
    expect(screen.getByText('Casey')).toBeInTheDocument();
    expect(screen.getByText('Drew')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('shows the empty state when there are no supporters', async () => {
    installSupporters({ supportersCount: 0, topSupporter: null, recentSupporters: [], supporterGrowth: [] });
    renderSection();
    expect(await screen.findByText(/No supporters yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Broadcast/i })).not.toBeInTheDocument();
  });

  it('shows an error with retry when the fetch fails', async () => {
    server.use(http.get(`${API}/v1/artist-analytics/artist/:id/supporters`, () =>
      HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderSection();
    expect(await screen.findByText(/Could not load your supporters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('navigates to messages with compose state from a supporter message button', async () => {
    renderSection();
    await screen.findByText('BigFan');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Message BigFan/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/messages', {
      state: { compose: { userId: 'fan-1', username: 'BigFan', photoUrl: null } },
    });
  });

  it('broadcasts a message to all supporters', async () => {
    let payload = null;
    server.use(http.post(`${API}/v1/messages/broadcast`, async ({ request }) => {
      payload = await request.json();
      return HttpResponse.json({ sent: 12, skipped: 0, total: 12 });
    }));
    renderSection();
    await screen.findByText('BigFan');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Broadcast/i }));
    const box = await screen.findByPlaceholderText(/Share a new drop/i);
    await user.type(box, 'New single out now!');
    await user.click(screen.getByRole('button', { name: /Send to all supporters/i }));
    await waitFor(() => expect(payload).toEqual({ body: 'New single out now!' }));
    expect(await screen.findByText(/Sent to 12 supporters/i)).toBeInTheDocument();
  });

  it('disables the broadcast send button until a message is typed', async () => {
    renderSection();
    await screen.findByText('BigFan');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Broadcast/i }));
    await screen.findByPlaceholderText(/Share a new drop/i);
    expect(screen.getByRole('button', { name: /Send to all supporters/i })).toBeDisabled();
  });

  it('surfaces an error if the broadcast fails', async () => {
    server.use(http.post(`${API}/v1/messages/broadcast`, () =>
      HttpResponse.json({}, { status: 500 })));
    renderSection();
    await screen.findByText('BigFan');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Broadcast/i }));
    const box = await screen.findByPlaceholderText(/Share a new drop/i);
    await user.type(box, 'Hi everyone');
    await user.click(screen.getByRole('button', { name: /Send to all supporters/i }));
    expect(await screen.findByText(/Could not send the broadcast/i)).toBeInTheDocument();
  });

  it('renders the growth sparkline and supporter photos and plays', async () => {
    installSupporters({
      supportersCount: 5,
      topSupporter: { userId: 'fan-1', username: 'BigFan', photoUrl: '/uploads/f.jpg', plays: 50, since: '2025-01-01' },
      recentSupporters: [{ userId: 'fan-2', username: 'Casey', photoUrl: '/uploads/c.jpg', since: '2025-02-01' }],
      supporterGrowth: [{ day: '2025-03-01', count: 2 }, { day: '2025-03-02', count: 5 }],
    });
    renderSection();
    expect(await screen.findByText('BigFan')).toBeInTheDocument();
    expect(screen.getByText(/New supporters/i)).toBeInTheDocument();
    expect(screen.getByText(/50 plays/i)).toBeInTheDocument();
  });

  // ★ item 2: growth block is a real chart, not a uniform block
  it('growth chart has axis labels, a period total, and true-zero days', async () => {
    installSupporters({
      ...SUPPORTERS,
      supporterGrowth: [
        { day: '2025-03-01', count: 0 },
        { day: '2025-03-02', count: 3 },
        { day: '2025-03-03', count: 6 },
      ],
    });
    const { container } = renderSection();
    await screen.findByText('BigFan');
    // period total (+9) in the header
    expect(screen.getByText('+9')).toBeInTheDocument();
    // y-axis: peak and zero labels
    const yAxis = container.querySelector('.sup__chart-y');
    expect(yAxis.textContent).toContain('6');
    expect(yAxis.textContent).toContain('0');
    // x-axis: first and last day labels
    const xAxis = container.querySelector('.sup__chart-x');
    expect(xAxis.textContent).toContain('Mar 1');
    expect(xAxis.textContent).toContain('Mar 3');
    // zero-count day renders as a zero-class stub, not a padded fake bar
    const bars = container.querySelectorAll('.sup__bar');
    expect(bars).toHaveLength(3);
    expect(bars[0].className).toContain('sup__bar--zero');
    expect(bars[0].style.height).toBe('0%');
    expect(bars[2].style.height).toBe('100%');
  });

});