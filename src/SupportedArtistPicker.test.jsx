// src/SupportedArtistPicker.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';
import SupportedArtistPicker from './SupportedArtistPicker';

const API = 'http://localhost:8080/api';

const DEFAULT_BREADCRUMB = [
  { jurisdictionId: 'jur-unis', name: 'Unis' },
  { jurisdictionId: 'jur-ny', name: 'New York' },
  { jurisdictionId: 'jur-harlem', name: 'Harlem' },
];
const DEFAULT_TRENDING = [
  ['art-1', 'Nyla Reign', 120, '/uploads/n.jpg'],
  ['art-2', 'Kojin', 90, null],
  ['self-user', 'Me Myself', 80, null], // should be filtered out (== userId)
];

function installPicker({ breadcrumb, trending, roots, putResponse, putStatus } = {}) {
  server.use(
    http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, () =>
      HttpResponse.json(breadcrumb ?? DEFAULT_BREADCRUMB)),
    http.get(`${API}/v1/jurisdictions/roots`, () =>
      HttpResponse.json(roots ?? [{ jurisdictionId: 'jur-unis', name: 'Unis' }])),
    http.get(`${API}/v1/jurisdictions/:id/trending`, () =>
      HttpResponse.json(trending ?? DEFAULT_TRENDING)),
    http.put(`${API}/v1/users/:id/supported-artist`, () =>
      HttpResponse.json(putResponse ?? { status: putStatus ?? 'immediate' })),
  );
}

const baseProps = () => ({
  show: true,
  onClose: vi.fn(),
  userId: 'self-user',
  currentArtistId: null,
  userJurisdictionId: 'jur-harlem',
  userJurisdictionName: 'Harlem',
  onSuccess: vi.fn(),
});

const renderPicker = (props = {}) =>
  renderWithProviders(<SupportedArtistPicker {...baseProps()} {...props} />, { as: 'artist' });

// pick the area, then wait for its artists to load
async function openHarlem(user) {
  await screen.findByRole('button', { name: /Harlem/i });
  await user.click(screen.getByRole('button', { name: /Harlem/i }));
  await screen.findByText('Nyla Reign');
}

describe('SupportedArtistPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    cacheService.clearAll();
    server.resetHandlers();
    installPicker();
  });
  afterEach(() => {
    cleanup();
    cacheService.clearAll();
  });

  it('renders nothing when show is false', () => {
    renderPicker({ show: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists the areas from the breadcrumb, most-local first', async () => {
    renderPicker();
    expect(await screen.findByRole('button', { name: /Harlem/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New York/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unis/i })).toBeInTheDocument();
  });

  it('shows first-pick header copy', async () => {
    renderPicker();
    expect(await screen.findByRole('heading', { name: /Choose your artist/i })).toBeInTheDocument();
    expect(screen.getByText(/Pick an area, then back one of its top artists/i)).toBeInTheDocument();
  });

  it('shows change-mode header copy when an artist is already supported', async () => {
    renderPicker({ currentArtistId: 'art-2' });
    expect(await screen.findByRole('heading', { name: /Change who you support/i })).toBeInTheDocument();
  });

  it('loads an area\u2019s top artists and excludes the current user', async () => {
    renderPicker();
    const user = userEvent.setup();
    await openHarlem(user);
    expect(screen.getByText('Nyla Reign')).toBeInTheDocument();
    expect(screen.getByText('Kojin')).toBeInTheDocument();
    expect(screen.queryByText('Me Myself')).not.toBeInTheDocument();
    expect(screen.getByText(/Top artists in Harlem/i)).toBeInTheDocument();
  });

  it('marks the current artist with a Current tag', async () => {
    renderPicker({ currentArtistId: 'art-2' });
    const user = userEvent.setup();
    await openHarlem(user);
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('submits a first pick and shows the immediate success state', async () => {
    let payload = null;
    server.use(
      http.put(`${API}/v1/users/:id/supported-artist`, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json({ status: 'immediate' });
      }),
    );
    const props = baseProps();
    renderWithProviders(<SupportedArtistPicker {...props} />, { as: 'artist' });
    const user = userEvent.setup();
    await openHarlem(user);
    await user.click(screen.getByRole('option', { name: /Nyla Reign/i }));
    await user.click(screen.getByRole('button', { name: /Support this artist/i }));
    await waitFor(() => expect(payload).toEqual({ artistId: 'art-1' }));
    expect(await screen.findByText(/now supporting them/i)).toBeInTheDocument();
    expect(props.onSuccess).toHaveBeenCalled();
  });

  it('queues a change and shows the pending success state', async () => {
    server.use(
      http.put(`${API}/v1/users/:id/supported-artist`, () =>
        HttpResponse.json({ status: 'pending' })),
    );
    renderPicker({ currentArtistId: 'art-2' });
    const user = userEvent.setup();
    await openHarlem(user);
    await user.click(screen.getByRole('option', { name: /Nyla Reign/i }));
    await user.click(screen.getByRole('button', { name: /Queue change/i }));
    expect(await screen.findByText(/Change queued/i)).toBeInTheDocument();
  });

  it('disables submit when the selected artist is the current one', async () => {
    renderPicker({ currentArtistId: 'art-1' });
    const user = userEvent.setup();
    await openHarlem(user);
    await user.click(screen.getByRole('option', { name: /Nyla Reign/i }));
    expect(screen.getByRole('button', { name: /Already supported/i })).toBeDisabled();
  });

  it('goes back to the area list from the artist list', async () => {
    renderPicker();
    const user = userEvent.setup();
    await openHarlem(user);
    await user.click(screen.getByRole('button', { name: /All areas/i }));
    expect(await screen.findByRole('button', { name: /Harlem/i })).toBeInTheDocument();
    expect(screen.queryByText('Nyla Reign')).not.toBeInTheDocument();
  });

  it('shows an empty state when an area has no artists', async () => {
    server.use(http.get(`${API}/v1/jurisdictions/:id/trending`, () => HttpResponse.json([])));
    renderPicker();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Harlem/i });
    await user.click(screen.getByRole('button', { name: /Harlem/i }));
    expect(await screen.findByText(/No artists here yet/i)).toBeInTheDocument();
  });

  it('shows an error when the area list fails to load', async () => {
    server.use(http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, () =>
      HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderPicker();
    expect(await screen.findByText(/Could not load your areas/i)).toBeInTheDocument();
  });

  it('shows an error when the top artists fail to load', async () => {
    server.use(http.get(`${API}/v1/jurisdictions/:id/trending`, () =>
      HttpResponse.json({ error: 'boom' }, { status: 500 })));
    renderPicker();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Harlem/i });
    await user.click(screen.getByRole('button', { name: /Harlem/i }));
    expect(await screen.findByText(/Could not load top artists/i)).toBeInTheDocument();
  });

  it('calls onClose from the close button', async () => {
    const props = baseProps();
    renderWithProviders(<SupportedArtistPicker {...props} />, { as: 'artist' });
    await screen.findByRole('button', { name: /Harlem/i });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Close/i }));
    expect(props.onClose).toHaveBeenCalled();
  });
});