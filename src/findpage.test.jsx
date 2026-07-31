import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from './test/utils';
import * as axiosModule from './components/axiosInstance';
import { GENRE_IDS } from './utils/idMappings';

// The leaflet / react-leaflet / react-simple-maps mocks are gone along with the
// libraries. UnisMap is stubbed instead: it renders a button per state and per
// territory so selection can be driven without a real SVG hit test, and echoes
// its props so the camera contract can be asserted directly.
vi.mock('./map/UnisMap', () => ({
  default: ({ mode, focusState, territories = [], selectedId, onStateSelect, onTerritorySelect }) => (
    <div
      data-testid="unis-map"
      data-mode={mode}
      data-focus-state={focusState || ''}
      data-selected-id={selectedId || ''}
      data-territory-count={territories.length}
    >
      <button type="button" onClick={() => onStateSelect?.('New York')}>map:New York</button>
      <button type="button" onClick={() => onStateSelect?.('California')}>map:California</button>
      <button type="button" onClick={() => onStateSelect?.('Wyoming')}>map:Wyoming</button>
      {territories.map((t) => (
        <button key={t.jurisdictionId} type="button" onClick={() => onTerritorySelect?.(t)}>
          map:{t.name}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('./findpage.scss', () => ({}));
vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));
vi.mock('./assets/tonyfadd_paranoidbuy1get1free.mp3', () => ({ default: 'sample.mp3' }));
vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

import FindPage from './findpage';

const NY_ID = 'f110d18f-15de-494f-8543-6bea758c8c60';
const CA_ID = 'ce93bd94-0553-5fbf-a4ea-939a577d04ce';
const HARLEM_ID = '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3';
const MANHATTAN_ID = '6ef67b11-6e10-4fc1-b540-083b172dbbbc';
const UPTOWN_ID = '52740de0-e4e9-4c9e-b68e-1e170f6788c4';

const RAP = GENRE_IDS.rap;
const ROCK = GENRE_IDS.rock;

const poly = { type: 'Polygon', coordinates: [[[-74, 40.7], [-73.9, 40.7], [-73.9, 40.9], [-74, 40.9], [-74, 40.7]]] };

const nyJurisdiction = { jurisdictionId: NY_ID, name: 'New York', hasChildren: true, polygon: poly };
const caJurisdiction = { jurisdictionId: CA_ID, name: 'California', hasChildren: true, polygon: poly };
const manhattan = { jurisdictionId: MANHATTAN_ID, name: 'Manhattan', hasChildren: true, polygon: poly };
const harlem = { jurisdictionId: HARLEM_ID, name: 'Harlem', hasChildren: true, polygon: poly };
const uptown = { jurisdictionId: UPTOWN_ID, name: 'Uptown Harlem', hasChildren: false, polygon: poly };
const socal = { jurisdictionId: 'ca-1', name: 'Southern California', hasChildren: true, polygon: poly };

// Two rap rows and one rock row per column, so genre filtering is observable.
const topsFixture = {
  topArtists: [
    { userId: 'a1', username: 'RapArtistOne', score: 90, genre: { genreId: RAP }, photoUrl: '/uploads/a1.jpg' },
    { userId: 'a2', username: 'RapArtistTwo', score: 80, genre: { genreId: RAP }, photoUrl: null },
    { userId: 'a3', username: 'RockArtistOne', score: 70, genre: { genreId: ROCK }, photoUrl: '/uploads/a3.jpg' },
  ],
  topSongs: [
    { songId: 's1', title: 'Rap Song One', score: 95, genre: { genreId: RAP }, artist: { userId: 'a1', username: 'RapArtistOne' }, fileUrl: '/uploads/s1.mp3', artworkUrl: '/uploads/s1.jpg' },
    { songId: 's2', title: 'Rap Song Two', score: 85, genre: { genreId: RAP }, artist: { userId: 'a2', username: 'RapArtistTwo' }, fileUrl: '/uploads/s2.mp3', artworkUrl: null },
    { songId: 's3', title: 'Rock Song One', score: 75, genre: { genreId: ROCK }, artist: { userId: 'a3', username: 'RockArtistOne' }, fileUrl: '/uploads/s3.mp3', artworkUrl: '/uploads/s3.jpg' },
  ],
};

let apiSpy;

function defaultApiHandler(config) {
  const { url, method = 'get' } = config;
  if (url === '/v1/earnings/track-view' && method === 'post') return { data: { ok: true } };

  if (url.startsWith('/v1/jurisdictions/byName/')) {
    const name = decodeURIComponent(url.split('/v1/jurisdictions/byName/')[1]);
    if (name === 'New York') return { data: [nyJurisdiction] };
    if (name === 'California') return { data: [caJurisdiction] };
    if (name === 'Harlem') return { data: [harlem] };
    return { data: [] };
  }
  if (url.match(/\/children\/detailed$/)) {
    const id = url.split('/')[3];
    if (id === NY_ID) return { data: [manhattan] };
    if (id === CA_ID) return { data: [socal] };
    if (id === MANHATTAN_ID) return { data: [harlem] };
    if (id === HARLEM_ID) return { data: [uptown] };
    return { data: [] };
  }
  if (url.match(/\/children$/)) return { data: [] };
  if (url.match(/\/tops$/)) return { data: topsFixture };
  if (url.match(/^\/v1\/jurisdictions\/[^/]+$/)) {
    const id = url.split('/').pop();
    if (id === NY_ID) return { data: nyJurisdiction };
    if (id === MANHATTAN_ID) return { data: manhattan };
    return { data: null };
  }
  if (url.match(/\/default-song$/)) {
    return { data: { songId: 'ds1', title: 'Default Song', fileUrl: '/uploads/d.mp3', artworkUrl: '/uploads/d.jpg' } };
  }
  if (url.match(/\/play\?userId=/) && method === 'post') return { data: { ok: true } };
  throw new Error(`Unmocked apiCall: ${String(method).toUpperCase()} ${url}`);
}

const callsTo = (matcher) =>
  apiSpy.mock.calls
    .map((c) => c[0])
    .filter((c) => (typeof matcher === 'string' ? c.url === matcher : matcher.test(c.url)));

beforeEach(() => {
  localStorage.clear();
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (cfg) => defaultApiHandler(cfg));
});

afterEach(() => { vi.restoreAllMocks(); });

const enterNewYork = async () => {
  fireEvent.click(screen.getByText('map:New York'));
  await waitFor(() => expect(screen.getByTestId('unis-map')).toHaveAttribute('data-mode', 'STATE'));
};

describe('FindPage — initial render', () => {
  it('renders for guests without crashing', async () => {
    renderWithProviders(<FindPage />);
    expect(await screen.findByTestId('unis-map')).toBeInTheDocument();
  });

  it('starts at the national level', async () => {
    renderWithProviders(<FindPage />);
    expect(await screen.findByTestId('unis-map')).toHaveAttribute('data-mode', 'US');
  });

  it('shows the root crumb name as the hero before any selection', async () => {
    renderWithProviders(<FindPage />);
    // Not 'Select a state' — navigationStack always carries the root crumb, so
    // that fallback in displayTerritory is unreachable.
    expect(await screen.findByRole('heading', { level: 1 }).catch(() => null) ||
           document.querySelector('.territory-name')).toHaveTextContent('United States');
  });

  it('defaults to the canonical rap genre, not the legacy rap-hiphop alias', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    expect(document.querySelector('.genre-seg-native').value).toBe('rap');
  });

  it('renders exactly the three canonical genre pills', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    const group = screen.getByRole('group', { name: 'Genre' });
    expect(within(group).getAllByRole('button').map((p) => p.textContent)).toEqual(['Rap', 'Rock', 'Pop']);
  });

  it('never fetches state geometry over the network (it is baked into the bundle)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    expect(fetchSpy.mock.calls.filter(([u]) => String(u).includes('us-states'))).toHaveLength(0);
    fetchSpy.mockRestore();
  });
});

describe('FindPage — ad view tracking is auth-gated', () => {
  it('does NOT call track-view for guests (SecurityConfig requires auth: guaranteed 403)', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await new Promise((r) => setTimeout(r, 30));
    expect(callsTo('/v1/earnings/track-view')).toHaveLength(0);
  });

  it('calls track-view once for authenticated users', async () => {
    renderWithProviders(<FindPage />, { as: 'listener' });
    await screen.findByTestId('unis-map');
    await waitFor(() => expect(callsTo('/v1/earnings/track-view')).toHaveLength(1));
  });
});

describe('FindPage — entering a live state', () => {
  it('flies to the state and loads its children', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    const map = screen.getByTestId('unis-map');
    expect(map).toHaveAttribute('data-focus-state', 'New York');
    expect(map).toHaveAttribute('data-territory-count', '1');
    expect(await screen.findByText('map:Manhattan')).toBeInTheDocument();
  });

  it('fetches tops for a live state', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await waitFor(() => expect(callsTo(/\/tops$/).length).toBeGreaterThan(0));
  });

  it('resolves the state by name exactly once, not once per render', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    expect(callsTo(/byName\/New%20York$/)).toHaveLength(1);
  });

  it('ignores a repeat click on the state already in focus', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    const before = apiSpy.mock.calls.length;
    fireEvent.click(screen.getByText('map:New York'));
    await new Promise((r) => setTimeout(r, 20));
    expect(apiSpy.mock.calls.length).toBe(before);
  });
});

describe('FindPage — dormant states are enterable, one level deep', () => {
  it('flies into a dormant state and draws its regions', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    fireEvent.click(screen.getByText('map:California'));
    await waitFor(() => {
      const map = screen.getByTestId('unis-map');
      expect(map).toHaveAttribute('data-focus-state', 'California');
      expect(map).toHaveAttribute('data-territory-count', '1');
    });
    expect(screen.getByText('map:Southern California')).toBeInTheDocument();
  });

  it('does NOT request tops for a dormant state — there is nothing to rank', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    fireEvent.click(screen.getByText('map:California'));
    await waitFor(() => expect(screen.getByTestId('unis-map')).toHaveAttribute('data-focus-state', 'California'));
    expect(callsTo(/\/tops$/)).toHaveLength(0);
  });

  it('shows the waitlist panel rather than charts', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    fireEvent.click(screen.getByText('map:California'));
    await waitFor(() => expect(screen.getAllByText(/Join the waitlist/i).length).toBeGreaterThan(0));
  });

  it('stops at one level — tapping a region inside a dormant state does not descend', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    fireEvent.click(screen.getByText('map:California'));
    await screen.findByText('map:Southern California');
    fireEvent.click(screen.getByText('map:Southern California'));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId('unis-map')).toHaveAttribute('data-mode', 'STATE');
  });
});

describe('FindPage — genre filtering', () => {
  it('shows only rap rows under the default rap pill', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    expect(await screen.findByText('Rap Song One')).toBeInTheDocument();
    expect(screen.getByText('Rap Song Two')).toBeInTheDocument();
    expect(screen.queryByText('Rock Song One')).not.toBeInTheDocument();
  });

  it('switching to Rock swaps the visible rows', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    fireEvent.click(screen.getByRole('button', { name: 'Rock' }));
    expect(await screen.findByText('Rock Song One')).toBeInTheDocument();
    expect(screen.queryByText('Rap Song One')).not.toBeInTheDocument();
    expect(screen.getAllByText('RockArtistOne').length).toBeGreaterThan(0);
  });

  it('switching genre costs no extra API calls — filtering is client-side', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    const before = apiSpy.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Rock' }));
    await screen.findByText('Rock Song One');
    expect(apiSpy.mock.calls.length).toBe(before);
  });

  it('reports an empty genre honestly instead of showing another genre', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    fireEvent.click(screen.getByRole('button', { name: 'Pop' }));
    expect(await screen.findByText(/No Pop songs charted here yet/i)).toBeInTheDocument();
    expect(screen.queryByText('Rap Song One')).not.toBeInTheDocument();
  });
});

describe('FindPage — artwork', () => {
  it('routes every artwork URL through the shared buildUrl', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    const imgs = document.querySelectorAll('img.item-artwork');
    expect(imgs.length).toBeGreaterThan(0);
    imgs.forEach((img) => expect(img.getAttribute('src')).toMatch(/^https?:\/\//));
  });

  it('renders a monogram, never stock photography, when artwork is absent', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song Two');
    expect(document.querySelectorAll('.item-artwork--none').length).toBeGreaterThan(0);
    expect(document.body.innerHTML).not.toMatch(/rapperphoto|songartwork|picsum/i);
  });

  it('falls back to a monogram when an image fails to load', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    const before = document.querySelectorAll('.item-artwork--none').length;
    fireEvent.error(document.querySelector('img.item-artwork'));
    await waitFor(() => expect(document.querySelectorAll('.item-artwork--none').length).toBe(before + 1));
  });
});

describe('FindPage — navigation', () => {
  it('descends into a live territory that has children', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    fireEvent.click(screen.getByText('map:Manhattan'));
    await waitFor(() => expect(screen.getByTestId('unis-map')).toHaveAttribute('data-mode', 'TERRITORY'));
    expect(await screen.findByText('map:Harlem')).toBeInTheDocument();
  });

  it('back returns to the national view and clears results', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    await waitFor(() => expect(screen.getByTestId('unis-map')).toHaveAttribute('data-mode', 'US'));
    expect(document.querySelector('.territory-name')).toHaveTextContent('United States');
    expect(screen.queryByText('Rap Song One')).not.toBeInTheDocument();
  });

  it('exposes a breadcrumb trail', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    const nav = screen.getByRole('navigation', { name: /Territory path/i });
    expect(within(nav).getByText('United States')).toBeInTheDocument();
  });

  it('lists regions in a keyboard-reachable rail, not only on the map', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    expect(await screen.findByText(/Regions in New York/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Manhattan/ })).toBeInTheDocument();
  });
});

describe('FindPage — playback', () => {
  it('tracks a play for an authenticated user', async () => {
    renderWithProviders(<FindPage />, { as: 'listener' });
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    fireEvent.click(screen.getByRole('button', { name: 'Play Rap Song One' }));
    await waitFor(() => expect(callsTo(/\/play\?userId=/).length).toBe(1));
  });

  it('does not attempt play tracking for guests', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    fireEvent.click(screen.getByRole('button', { name: 'Play Rap Song One' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(callsTo(/\/play\?userId=/)).toHaveLength(0);
  });

  it('resolves an artist default song before playing', async () => {
    renderWithProviders(<FindPage />, { as: 'listener' });
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByRole('button', { name: 'Play RapArtistOne' });
    fireEvent.click(screen.getByRole('button', { name: 'Play RapArtistOne' }));
    await waitFor(() => expect(callsTo(/\/default-song$/).length).toBe(1));
  });
});

describe('FindPage — failure handling', () => {
  it('surfaces an error when tops fails, without blanking the page', async () => {
    apiSpy.mockImplementation(async (cfg) => {
      if (/\/tops$/.test(cfg.url)) throw new Error('boom');
      return defaultApiHandler(cfg);
    });
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/i);
    expect(screen.getByTestId('unis-map')).toBeInTheDocument();
  });

  it('falls back to /children when /children/detailed fails', async () => {
    apiSpy.mockImplementation(async (cfg) => {
      if (/\/children\/detailed$/.test(cfg.url)) throw new Error('detailed down');
      if (/\/children$/.test(cfg.url)) return { data: [manhattan] };
      return defaultApiHandler(cfg);
    });
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    expect(await screen.findByText('map:Manhattan')).toBeInTheDocument();
  });
});