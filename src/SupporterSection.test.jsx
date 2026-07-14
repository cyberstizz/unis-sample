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

  it('renders the 30-day trend chip, supporter photos, and plays', async () => {
    installSupporters({
      supportersCount: 5,
      topSupporter: { userId: 'fan-1', username: 'BigFan', photoUrl: '/uploads/f.jpg', plays: 50, since: '2025-01-01' },
      recentSupporters: [{ userId: 'fan-2', username: 'Casey', photoUrl: '/uploads/c.jpg', since: '2025-02-01' }],
      supporterGrowth: [{ day: '2025-03-01', count: 2 }, { day: '2025-03-02', count: 5 }],
    });
    renderSection();
    expect(await screen.findByText('BigFan')).toBeInTheDocument();
    // ★ chart removed — the 30-day delta is now a single trend chip
    expect(screen.getByText('+7')).toBeInTheDocument();
    expect(screen.getByText(/last 30 days/i)).toBeInTheDocument();
    expect(screen.getByText(/50 plays/i)).toBeInTheDocument();
  });

  // ★ The growth bar chart was REMOVED. The backend returns only days that had
  //   activity (not a padded 30-day series), so the "chart" was really N flex-1
  //   bars splitting the full width — unreadable. The same fact is now a chip.
  it('renders no chart, and sums the period into the trend chip', async () => {
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

    // period total surfaced on the count line
    expect(screen.getByText('+9')).toBeInTheDocument();

    // every trace of the old chart is gone
    expect(container.querySelector('.sup__chart')).toBeNull();
    expect(container.querySelector('.sup__chart-y')).toBeNull();
    expect(container.querySelector('.sup__chart-x')).toBeNull();
    expect(container.querySelectorAll('.sup__bar')).toHaveLength(0);
  });

  it('hides the trend chip entirely when there is no 30-day growth', async () => {
    installSupporters({ ...SUPPORTERS, supporterGrowth: [] });
    const { container } = renderSection();
    await screen.findByText('BigFan');
    expect(container.querySelector('.sup__trend')).toBeNull();
  });
});