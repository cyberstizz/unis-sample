// src/TerritoryRankSection.test.jsx
// ★ Rewritten: the previous file under this name was a byte-for-byte duplicate
//   of artistDashboard.test.jsx (it mocked TerritoryRankSection into a stub and
//   re-ran the dashboard suite). The component itself had zero unit coverage.
//   This is the real spec. Dashboard coverage is untouched in artistDashboard.test.jsx.
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';

import TerritoryRankSection from './TerritoryRankSection';

const API = 'http://localhost:8080/api';
const ARTIST_ID = 'artist-1';

const row = (name, overall, genre = null, depth = 0) => ({
  jurisdictionId: `jur-${name.toLowerCase()}`,
  jurisdictionName: name,
  depth,
  overallRank: overall,
  overallTotal: 100,
  genreRank: genre,
  genreTotal: 40,
});

const payload = (overrides = {}) => ({
  status: 'ok',
  computedAt: '2026-07-05T00:30:00Z',
  defaultPeriod: 'year',
  genreId: 'g-rap',
  genreName: 'Rap',
  periods: {
    today: [row('Harlem', 3, 1), row('Manhattan', 12, 4, 1)], // ★ item 5: yesterday's ranks
    week: [row('Harlem', 2, 1), row('Manhattan', 9, 3, 1)],
    month: [row('Harlem', 4, 2), row('Manhattan', 15, 5, 1)],
    quarter: [row('Harlem', 5, 2)],
    year: [row('Harlem', 1, 1), row('Manhattan', 7, 2, 1)],
    all: [row('Harlem', 6, 3)],
  },
  ...overrides,
});

const install = (body = payload(), status = 200) => {
  server.use(
    http.get(`${API}/v1/artist-analytics/artist/:id/territory-rank`, () =>
      status === 200 ? HttpResponse.json(body) : HttpResponse.json({}, { status })),
  );
};

const renderSection = () =>
  renderWithProviders(<TerritoryRankSection artistId={ARTIST_ID} />, { as: 'artist' });

const reset = () => {
  localStorage.clear();
  sessionStorage.clear();
  cacheService.clearAll();
  server.resetHandlers();
};

describe('TerritoryRankSection', () => {
  beforeEach(reset);
  afterEach(() => { cleanup(); cacheService.clearAll(); });

  it('shows the loading state, then the default-period headline', async () => {
    install();
    renderSection();
    expect(screen.getByText(/Loading your rank/i)).toBeInTheDocument();
    // defaultPeriod=year → Harlem #1
    expect(await screen.findByText('#1')).toBeInTheDocument();
    expect(screen.getByText(/in Harlem/i)).toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    install(undefined, 500);
    const user = userEvent.setup();
    renderSection();
    expect(await screen.findByText(/Could not load territory rank/i)).toBeInTheDocument();
    install(); // next request succeeds
    await user.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByText('#1')).toBeInTheDocument();
  });

  it('shows the calculating cold-start state', async () => {
    install({ status: 'calculating', periods: {} });
    renderSection();
    expect(await screen.findByText(/Ranks are calculating/i)).toBeInTheDocument();
  });

  it('renders Day, Week, Month, and Year tabs', async () => { // ★ item 5
    install();
    renderSection();
    await screen.findByText('#1');
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Day', 'Week', 'Month', 'Year']);
  });

  it("Day tab shows yesterday's ranks and switches the caption copy", async () => { // ★ items 4+5
    install();
    const user = userEvent.setup();
    renderSection();
    await screen.findByText('#1');
    await user.click(screen.getByRole('tab', { name: 'Day' }));
    expect(screen.getByText('#3')).toBeInTheDocument(); // today-period Harlem rank
    expect(screen.getByText(/Yesterday's standing/i)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Day' })).toHaveAttribute('aria-selected', 'true');
  });

  it('switching to Week shows that period without refetching', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/v1/artist-analytics/artist/:id/territory-rank`, () => {
        calls += 1;
        return HttpResponse.json(payload());
      }),
    );
    const user = userEvent.setup();
    renderSection();
    await screen.findByText('#1');
    await user.click(screen.getByRole('tab', { name: 'Week' }));
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(calls).toBe(1); // all periods arrive in one response — no per-tab API calls
  });

  it('shows the genre rank line for the home row', async () => {
    install();
    renderSection();
    await screen.findByText('#1');
    expect(screen.getByText(/#1 · Rap/i)).toBeInTheDocument();
  });

  it('shows the computed-at timestamp chip', async () => { // ★ item 6
    install();
    renderSection();
    await screen.findByText('#1');
    expect(screen.getByText(/Jul 5/i)).toBeInTheDocument();
  });

  it('shows the empty state when a period has no rows', async () => {
    install(payload({ periods: { today: [], week: [], month: [], quarter: [], year: [], all: [] } }));
    renderSection();
    expect(await screen.findByText(/No ranking yet for this period/i)).toBeInTheDocument();
  });

  it('renders nothing without an artistId', () => {
    install();
    const { container } = renderWithProviders(<TerritoryRankSection artistId={null} />, { as: 'artist' });
    // stays in the loading shell (no fetch fires); must not crash
    expect(container.querySelector('.territory-rank')).toBeInTheDocument();
  });
});