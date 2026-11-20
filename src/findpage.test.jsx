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

// Rows as GET /v1/awards/standings returns them. Two rap rows and one rock
// row per board, so genre filtering is observable; `genreId` here is only for
// the mock handler below, which filters by the genreId in the request the way
// the backend does.
const standingsFixture = {
  artist: [
    { targetId: 'a1', targetType: 'artist', rank: 1, name: 'RapArtistOne', totalPoints: 90, artworkUrl: '/uploads/a1.jpg', genreId: RAP, movement: 1 },
    { targetId: 'a2', targetType: 'artist', rank: 2, name: 'RapArtistTwo', totalPoints: 80, artworkUrl: null, genreId: RAP },
    { targetId: 'a3', targetType: 'artist', rank: 1, name: 'RockArtistOne', totalPoints: 70, artworkUrl: '/uploads/a3.jpg', genreId: ROCK },
    { targetId: 'a4', targetType: 'artist', rank: 3, name: 'RapArtistNoPoints', totalPoints: 0, artworkUrl: null, genreId: RAP },
  ],
  song: [
    { targetId: 's1', targetType: 'song', rank: 1, name: 'Rap Song One', totalPoints: 95, artistName: 'RapArtistOne', artistId: 'a1', fileUrl: '/uploads/s1.mp3', artworkUrl: '/uploads/s1.jpg', genreId: RAP },
    { targetId: 's2', targetType: 'song', rank: 2, name: 'Rap Song Two', totalPoints: 85, artistName: 'RapArtistTwo', artistId: 'a2', fileUrl: '/uploads/s2.mp3', artworkUrl: null, genreId: RAP },
    { targetId: 's3', targetType: 'song', rank: 1, name: 'Rock Song One', totalPoints: 75, artistName: 'RockArtistOne', artistId: 'a3', fileUrl: '/uploads/s3.mp3', artworkUrl: '/uploads/s3.jpg', genreId: ROCK },
  ],
};

let boardState = 'LIVE';

function standingsResponse(url) {
  const params = new URL(url, 'http://x.test').searchParams;
  const type = params.get('type');
  const genreId = params.get('genreId');
  const entries = standingsFixture[type].filter((e) => !genreId || e.genreId === genreId);
  return { data: { type, state: boardState, interval: 'Weekly', total: entries.length, entries } };
}

const STANDINGS = /^\/v1\/awards\/standings\?/;
const standingsParams = () =>
  callsTo(STANDINGS).map((c) => Object.fromEntries(new URL(c.url, 'http://x.test').searchParams));

let apiSpy;

// What the backend says is open (voting_enabled): Harlem and Uptown Harlem,
// each with its chain from the top down.
const openFixture = [
  {
    jurisdictionId: HARLEM_ID, name: 'Harlem',
    chain: [
      { jurisdictionId: NY_ID, name: 'New York' },
      { jurisdictionId: MANHATTAN_ID, name: 'Manhattan' },
      { jurisdictionId: HARLEM_ID, name: 'Harlem' },
    ],
  },
  {
    jurisdictionId: UPTOWN_ID, name: 'Uptown Harlem',
    chain: [
      { jurisdictionId: NY_ID, name: 'New York' },
      { jurisdictionId: MANHATTAN_ID, name: 'Manhattan' },
      { jurisdictionId: HARLEM_ID, name: 'Harlem' },
      { jurisdictionId: UPTOWN_ID, name: 'Uptown Harlem' },
    ],
  },
];

function defaultApiHandler(config) {
  const { url, method = 'get' } = config;

  if (url === '/v1/jurisdictions/open') return { data: openFixture };

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
  if (STANDINGS.test(url)) return standingsResponse(url);
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
  boardState = 'LIVE';
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (cfg) => defaultApiHandler(cfg));
});

afterEach(() => { vi.restoreAllMocks(); });

// New York is live with one way down, so entering it walks the map itself
// down to Harlem (New York → Manhattan → Harlem). Wait for it to land.
const enterNewYork = async () => {
  fireEvent.click(screen.getByText('map:New York'));
  await waitFor(
    () => expect(screen.getByTestId('unis-map')).toHaveAttribute('data-selected-id', HARLEM_ID),
    { timeout: 3000 }
  );
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

describe('FindPage — no ad-view tracking', () => {
  // Earnings follow listening through the monthly Community Share; no page
  // reports ad views any more.
  it('never calls track-view, signed in or not', async () => {
    renderWithProviders(<FindPage />, { as: 'listener' });
    await screen.findByTestId('unis-map');
    await new Promise((r) => setTimeout(r, 30));
    expect(callsTo('/v1/earnings/track-view')).toHaveLength(0);
  });
});

describe('FindPage — entering a live state', () => {
  it('asks the backend which places are open (nothing hardcoded)', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await waitFor(() => expect(callsTo('/v1/jurisdictions/open')).toHaveLength(1));
  });

  it('walks itself down from New York to Harlem, the one open neighborhood', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    const map = screen.getByTestId('unis-map');
    expect(map).toHaveAttribute('data-focus-state', 'New York');
    expect(map).toHaveAttribute('data-mode', 'TERRITORY');
    expect(document.querySelector('.crumbs .here')).toHaveTextContent('Harlem');
    // Harlem's own regions are on screen when it lands.
    expect(screen.getByText('map:Uptown Harlem')).toBeInTheDocument();
  });

  it('does not drill down again when going back up to New York with the crumb', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    fireEvent.click(within(document.querySelector('.crumbs')).getByRole('button', { name: 'New York' }));
    await waitFor(() => expect(screen.getByTestId('unis-map')).toHaveAttribute('data-mode', 'STATE'));
    await new Promise((r) => setTimeout(r, 900));
    expect(screen.getByTestId('unis-map')).toHaveAttribute('data-mode', 'STATE');
    expect(screen.getByText('map:Manhattan')).toBeInTheDocument();
  });

  it('reads this week\'s top three artists and songs for the place it lands on', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');

    const forHarlem = standingsParams().filter((p) => p.jurisdictionId === HARLEM_ID);
    expect(forHarlem.map((p) => p.type).sort()).toEqual(['artist', 'song']);
    forHarlem.forEach((p) => {
      expect(p).toMatchObject({
        genreId: RAP,
        intervalId: '00000000-0000-0000-0000-000000000202', // weekly
        limit: '3',
        offset: '0',
      });
    });
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

  it('does NOT request standings for a dormant state — there is nothing to rank', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    fireEvent.click(screen.getByText('map:California'));
    await waitFor(() => expect(screen.getByTestId('unis-map')).toHaveAttribute('data-focus-state', 'California'));
    expect(callsTo(STANDINGS)).toHaveLength(0);
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

  it('switching genre reloads the same place in the new genre — the backend ranks per genre', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    const before = callsTo(STANDINGS).length;
    fireEvent.click(screen.getByRole('button', { name: 'Rock' }));
    await screen.findByText('Rock Song One');

    const fresh = standingsParams().slice(before);
    expect(fresh).toHaveLength(2);
    fresh.forEach((p) => expect(p).toMatchObject({ jurisdictionId: HARLEM_ID, genreId: ROCK }));
  });

  it('switching genre asks for nothing else — no place lookups are repeated', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    const before = apiSpy.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Rock' }));
    await screen.findByText('Rock Song One');
    const added = apiSpy.mock.calls.slice(before).map(([c]) => c.url);
    expect(added.every((url) => STANDINGS.test(url))).toBe(true);
  });

  it('leaves entries with no points off the list', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    expect(screen.queryByText('RapArtistNoPoints')).not.toBeInTheDocument();
  });

  it('says "this week" on a live board and "last week" before anyone scores in the new one', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    expect(screen.getByText(/top songs this week in harlem/i)).toBeInTheDocument();

    boardState = 'PREVIOUS_FINAL';
    fireEvent.click(screen.getByRole('button', { name: 'Rock' }));
    await screen.findByText('Rock Song One');
    expect(screen.getByText(/top songs last week in harlem/i)).toBeInTheDocument();
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
    // Entering New York walks down to Harlem; step back up to the state first.
    fireEvent.click(within(document.querySelector('.crumbs')).getByRole('button', { name: 'New York' }));
    fireEvent.click(await screen.findByText('map:Manhattan'));
    await waitFor(() => expect(screen.getByTestId('unis-map')).toHaveAttribute('data-mode', 'TERRITORY'));
    expect(await screen.findByText('map:Harlem')).toBeInTheDocument();
  });

  it('Back goes up one level at a time', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    await waitFor(() => expect(document.querySelector('.crumbs .here')).toHaveTextContent('Manhattan'));
  });

  it('the root crumb returns to the national view and clears results', async () => {
    renderWithProviders(<FindPage />);
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    fireEvent.click(within(document.querySelector('.crumbs')).getByRole('button', { name: 'United States' }));
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
    expect(await screen.findByText(/Regions in Harlem/i)).toBeInTheDocument();
    const rail = screen.getByText(/Regions in Harlem/i).parentElement;
    expect(within(rail).getByRole('button', { name: /^Uptown Harlem/ })).toBeInTheDocument();
  });
});

describe('FindPage — playback', () => {
  it('does not POST /play itself for a signed-in user (the Player counts plays)', async () => {
    renderWithProviders(<FindPage />, { as: 'listener' });
    await screen.findByTestId('unis-map');
    await enterNewYork();
    await screen.findByText('Rap Song One');
    fireEvent.click(screen.getByRole('button', { name: 'Play Rap Song One' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(callsTo(/\/media\/song\/.+\/play/)).toHaveLength(0);
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
  it('surfaces an error when the standings fail, without blanking the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    apiSpy.mockImplementation(async (cfg) => {
      if (STANDINGS.test(cfg.url)) throw new Error('boom');
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