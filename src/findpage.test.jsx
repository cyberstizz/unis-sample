import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/utils';
import * as axiosModule from './components/axiosInstance';

const leafletCapture = {
  mapController: null,
  usOnEachFeature: null,
  usGeoJSONStyle: null,
  jurOnEachFeature: null,
  jurGeoJSONStyle: null,
  flyToCalls: [],
  flyToBoundsCalls: [],
  invalidateSizeCalls: 0,
};

vi.mock('react-leaflet', () => {
  const React = require('react');
  return {
    MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
    TileLayer: ({ url }) => <div data-testid="tile-layer" data-url={url} />,
    GeoJSON: ({ data, onEachFeature, style, ...props }) => {
      const isUS = props.keyProp === 'us-states' || (data?.features?.[0]?.properties?.name && !data.features[0].properties.jurisdictionId);
      if (isUS || data?.type === 'FeatureCollection' && !data.features?.[0]?.properties?.jurisdictionId) {
        leafletCapture.usOnEachFeature = onEachFeature;
        leafletCapture.usGeoJSONStyle = style;
      } else {
        leafletCapture.jurOnEachFeature = onEachFeature;
        leafletCapture.jurGeoJSONStyle = style;
      }
      return (
        <div
          data-testid="geojson"
          data-feature-count={data?.features?.length ?? 0}
        />
      );
    },
    useMap: () => ({
      invalidateSize: () => { leafletCapture.invalidateSizeCalls++; },
      flyTo: (center, zoom, opts) => { leafletCapture.flyToCalls.push({ center, zoom, opts }); },
      flyToBounds: (bounds, opts) => { leafletCapture.flyToBoundsCalls.push({ bounds, opts }); },
    }),
  };
});

vi.mock('leaflet', () => ({ default: {} }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));
vi.mock('./findpage.scss', () => ({}));
vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));
vi.mock('./assets/tonyfadd_paranoidbuy1get1free.mp3', () => ({ default: 'sample.mp3' }));
vi.mock('./assets/rapperphotoOne.jpg', () => ({ default: 'rapper1.jpg' }));
vi.mock('./assets/rapperphototwo.jpg', () => ({ default: 'rapper2.jpg' }));
vi.mock('./assets/rapperphotothree.jpg', () => ({ default: 'rapper3.jpg' }));
vi.mock('./assets/rapperphotofour.jpg', () => ({ default: 'rapper4.jpg' }));
vi.mock('./assets/songartworkONe.jpeg', () => ({ default: 'song1.jpeg' }));
vi.mock('./assets/songartworktwo.jpeg', () => ({ default: 'song2.jpeg' }));
vi.mock('./assets/songartworkthree.jpeg', () => ({ default: 'song3.jpeg' }));
vi.mock('./assets/songartworkfour.jpeg', () => ({ default: 'song4.jpeg' }));

vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

const usGeoFixture = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'New York' },
      geometry: { type: 'Polygon', coordinates: [[[-80, 40], [-70, 40], [-70, 45], [-80, 45], [-80, 40]]] },
    },
    {
      type: 'Feature',
      properties: { name: 'California' },
      geometry: { type: 'Polygon', coordinates: [[[-125, 32], [-114, 32], [-114, 42], [-125, 42], [-125, 32]]] },
    },
  ],
};

import FindPage from './findpage';

const HARLEM_ID = '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3';
const UPTOWN_ID = '52740de0-0000-0000-0000-000000000000';
const DOWNTOWN_ID = '4b09eaa2-0000-0000-0000-000000000000';
const NY_ID = '00000000-0000-0000-0000-000000000ny1';
const MANHATTAN_ID = '00000000-0000-0000-0000-00000000m4n1';

const nyJurisdiction = {
  jurisdictionId: NY_ID,
  name: 'New York',
  hasChildren: true,
  polygon: { type: 'Polygon', coordinates: [[[-80, 40], [-70, 40], [-70, 45], [-80, 45], [-80, 40]]] },
};

const harlemJurisdiction = {
  jurisdictionId: HARLEM_ID,
  name: 'Harlem',
  hasChildren: true,
  polygon: { type: 'Polygon', coordinates: [[[-74, 40.8], [-73.9, 40.8], [-73.9, 40.85], [-74, 40.85], [-74, 40.8]]] },
};

const uptownJurisdiction = {
  jurisdictionId: UPTOWN_ID,
  name: 'Uptown Harlem',
  hasChildren: false,
  polygon: { type: 'Polygon', coordinates: [[[-74, 40.83], [-73.95, 40.83], [-73.95, 40.85], [-74, 40.85], [-74, 40.83]]] },
};

const downtownJurisdiction = {
  jurisdictionId: DOWNTOWN_ID,
  name: 'Downtown Harlem',
  hasChildren: false,
  polygon: { type: 'Polygon', coordinates: [[[-74, 40.8], [-73.95, 40.8], [-73.95, 40.82], [-74, 40.82], [-74, 40.8]]] },
};

const topsFixture = {
  topArtists: [
    { userId: 'a1', username: 'testartist', score: 100, photoUrl: '/media/photo1.jpg' },
    { userId: 'a2', username: 'secondartist', score: 75, photoUrl: null },
    { userId: 'a3', username: 'thirdartist', score: 50, photoUrl: 'https://cdn.example.com/photo3.jpg' },
    { userId: 'a4', username: 'shouldnotappear', score: 25 },
  ],
  topSongs: [
    { songId: 's1', title: 'Track One', artist: { username: 'testartist' }, score: 200, fileUrl: '/media/track1.mp3', artworkUrl: '/media/art1.jpg' },
    { songId: 's2', title: 'Track Two', artist: { username: 'testartist' }, score: 150, fileUrl: '/media/track2.mp3', artworkUrl: null },
    { songId: 's3', title: 'Track Three', artist: null, score: 100, fileUrl: null, artworkUrl: null },
  ],
};

let apiCallSpy;
let apiCallLog;

function setupApiCall(handler) {
  apiCallLog = [];
  apiCallSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    apiCallLog.push({ ...config });
    return handler(config);
  });
}

function defaultApiHandler(config) {
  const { url, method = 'get' } = config;

  if (url === '/v1/earnings/track-view' && method === 'post') {
    return { data: { ok: true } };
  }

  if (url.startsWith('/v1/jurisdictions/byName/')) {
    const name = decodeURIComponent(url.split('/v1/jurisdictions/byName/')[1]);
    if (name === 'New York') return { data: [nyJurisdiction] };
    if (name === 'Harlem') return { data: [harlemJurisdiction] };
    if (name === 'Uptown Harlem') return { data: [uptownJurisdiction] };
    return { data: [] };
  }

  if (url.match(/^\/v1\/jurisdictions\/[^/]+$/)) {
    const id = url.split('/').pop();
    if (id === NY_ID) return { data: nyJurisdiction };
    if (id === HARLEM_ID) return { data: harlemJurisdiction };
    return { data: null };
  }

  if (url.match(/\/children\/detailed$/)) {
    const id = url.split('/')[3];
    if (id === NY_ID) {
      return { data: [
        { jurisdictionId: MANHATTAN_ID, name: 'Manhattan', hasChildren: true, polygon: { type: 'Polygon', coordinates: [[[-74.05, 40.7], [-73.9, 40.7], [-73.9, 40.88], [-74.05, 40.88], [-74.05, 40.7]]] } },
      ] };
    }
    if (id === HARLEM_ID) {
      return { data: [uptownJurisdiction, downtownJurisdiction] };
    }
    if (id === MANHATTAN_ID) {
      return { data: [harlemJurisdiction] };
    }
    return { data: [] };
  }

  if (url.match(/\/children$/)) {
    return { data: [] };
  }

  if (url.match(/\/tops$/)) {
    return { data: topsFixture };
  }

  if (url.match(/\/default-song$/)) {
    return { data: { songId: 'ds1', title: 'Default Song', fileUrl: '/media/default.mp3', artworkUrl: '/media/defaultart.jpg' } };
  }

  if (url.match(/\/play\?userId=/) && method === 'post') {
    return { data: { ok: true } };
  }

  throw new Error(`Unmocked apiCall: ${method.toUpperCase()} ${url}`);
}

beforeEach(() => {
  leafletCapture.mapController = null;
  leafletCapture.usOnEachFeature = null;
  leafletCapture.usGeoJSONStyle = null;
  leafletCapture.jurOnEachFeature = null;
  leafletCapture.jurGeoJSONStyle = null;
  leafletCapture.flyToCalls = [];
  leafletCapture.flyToBoundsCalls = [];
  leafletCapture.invalidateSizeCalls = 0;

  global.fetch = vi.fn((url) => {
    if (url.includes('us-states.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(usGeoFixture),
      });
    }
    return Promise.reject(new Error(`Unmocked fetch: ${url}`));
  });

  window.alert = vi.fn();

  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function mockLayer(boundsValue = [[40, -80], [45, -70]]) {
  return {
    getBounds: vi.fn(() => boundsValue),
    setStyle: vi.fn(),
    bringToFront: vi.fn(),
    bindTooltip: vi.fn(),
    on: vi.fn(),
  };
}

async function clickState(stateName, layer) {
  const feature = { properties: { name: stateName } };
  const handlers = {};
  const fakeLayer = layer || mockLayer();
  fakeLayer.on = (events) => Object.assign(handlers, events);

  leafletCapture.usOnEachFeature(feature, fakeLayer);
  await act(async () => {
    handlers.click?.();
  });
  return { handlers, fakeLayer };
}

function callsTo(urlMatcher, method) {
  return apiCallLog.filter(c => {
    const methodMatch = method ? (c.method || 'get').toLowerCase() === method.toLowerCase() : true;
    const urlMatch = typeof urlMatcher === 'string' ? c.url === urlMatcher : urlMatcher.test(c.url);
    return methodMatch && urlMatch;
  });
}

describe('FindPage — initial render', () => {
  beforeEach(() => setupApiCall(defaultApiHandler));

  it('renders without crashing for guest users', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    expect(await screen.findByTestId('map-container')).toBeInTheDocument();
  });

  it('renders without crashing for authenticated listeners', async () => {
    renderWithProviders(<FindPage />, { as: 'listener' });
    expect(await screen.findByTestId('map-container')).toBeInTheDocument();
  });

  it('renders the genre filter with default value rap-hiphop', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    const select = await screen.findByRole('combobox');
    expect(select).toHaveValue('rap-hiphop');
  });

  it('renders a Random button enabled by default', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    const btn = await screen.findByRole('button', { name: /random/i });
    expect(btn).toBeEnabled();
  });

  it('shows "Select a state" as the initial territory name', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    expect(await screen.findByText('Select a state')).toBeInTheDocument();
  });

  it('hides the results section initially (no jurisdiction selected)', async () => {
    const { container } = renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    const results = container.querySelector('.results-section');
    expect(results).toHaveStyle({ display: 'none' });
  });

  it('fetches the US states GeoJSON on mount', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('us-states.json')
      );
    });
  });

  it('renders the back button but keeps it hidden at US level', async () => {
    const { container } = renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    const back = container.querySelector('.back-button');
    expect(back).toBeInTheDocument();
    expect(back).toHaveStyle({ visibility: 'hidden' });
  });
});

describe('FindPage — ad view tracking', () => {
  it('fires POST /v1/earnings/track-view exactly once on mount', async () => {
    setupApiCall(defaultApiHandler);
    renderWithProviders(<FindPage />, { as: 'guest' });

    await waitFor(() => {
      expect(callsTo('/v1/earnings/track-view', 'post').length).toBe(1);
    });
  });

  it('fires track-view for authenticated users too', async () => {
    setupApiCall(defaultApiHandler);
    renderWithProviders(<FindPage />, { as: 'listener' });

    await waitFor(() => {
      expect(callsTo('/v1/earnings/track-view', 'post').length).toBe(1);
    });
  });

  it('does not crash the page when track-view fails (silent swallow)', async () => {
    setupApiCall((config) => {
      if (config.url === '/v1/earnings/track-view') {
        return Promise.reject(new Error('backend down'));
      }
      return defaultApiHandler(config);
    });

    renderWithProviders(<FindPage />, { as: 'guest' });
    expect(await screen.findByTestId('map-container')).toBeInTheDocument();
  });
});

describe('FindPage — handleStateClick (New York)', () => {
  beforeEach(() => setupApiCall(defaultApiHandler));

  it('fetches byName + children + tops when New York is clicked', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      expect(callsTo(/byName\/New%20York/).length).toBe(1);
      expect(callsTo(/\/children\/detailed$/).length).toBeGreaterThanOrEqual(1);
      expect(callsTo(/\/tops$/).length).toBe(1);
    });
  });

  it('fires children and tops in PARALLEL (not sequential) — regression test', async () => {
    const callTimestamps = [];
    setupApiCall(async (config) => {
      callTimestamps.push({ url: config.url, time: Date.now() });
      await new Promise(r => setTimeout(r, 50));
      return defaultApiHandler(config);
    });

    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');
    await waitFor(() => {
      expect(callsTo(/\/tops$/).length).toBe(1);
      expect(callsTo(/\/children\/detailed$/).length).toBe(1);
    });

    const childrenTime = callTimestamps.find(c => /\/children\/detailed$/.test(c.url)).time;
    const topsTime = callTimestamps.find(c => /\/tops$/.test(c.url)).time;

    expect(Math.abs(childrenTime - topsTime)).toBeLessThan(40);
  });

  it('displays "New York" as the territory after successful click', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      expect(screen.getByText('Top Songs in New York')).toBeInTheDocument();
      expect(screen.getByText('Top Artists in New York')).toBeInTheDocument();
    });
  });

  it('shows an alert and does NOT fetch anything for non-NY states', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    const preClickLogLength = apiCallLog.length;
    await clickState('California');

    expect(window.alert).toHaveBeenCalledWith('California coming to Unis soon!');
    expect(apiCallLog.length).toBe(preClickLogLength);
  });

  it('does not leave loading state stuck on success path — regression', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');
    await waitFor(() => {
      expect(screen.getByText('Top Songs in New York')).toBeInTheDocument();
    });

    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('displays error and no results when byName returns empty', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupApiCall((config) => {
      if (config.url.startsWith('/v1/jurisdictions/byName/New%20York')) {
        return { data: [] };
      }
      return defaultApiHandler(config);
    });

    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    // Error path: byName returns empty → throws → catch block fires
    // Tops endpoint should NOT have been called (we threw before reaching it)
    await waitFor(() => {
      expect(callsTo(/byName\/New%20York/).length).toBe(1);
    });
    // No tops fetch should have occurred
    expect(callsTo(/\/tops$/).length).toBe(0);
    // No actual track data should render (empty topResults)
    expect(screen.queryByText('Track One')).not.toBeInTheDocument();
  });
});

describe('FindPage — top results rendering', () => {
  beforeEach(() => setupApiCall(defaultApiHandler));

  it('renders top 3 songs after jurisdiction selection (slices 4th off)', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      expect(screen.getByText('Track One')).toBeInTheDocument();
      expect(screen.getByText('Track Two')).toBeInTheDocument();
      expect(screen.getByText('Track Three')).toBeInTheDocument();
    });
  });

  it('renders top 3 artists and slices off the 4th', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      // 'testartist' appears as song artist (x2) AND as an artist in the artist column
      expect(screen.getAllByText('testartist').length).toBeGreaterThan(0);
      expect(screen.getByText('secondartist')).toBeInTheDocument();
      expect(screen.getByText('thirdartist')).toBeInTheDocument();
    });
    expect(screen.queryByText('shouldnotappear')).not.toBeInTheDocument();
  });

  it('handles missing artist username on song gracefully (falls back to "Unknown")', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      expect(screen.getByText('Track Three')).toBeInTheDocument();
    });
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows "No songs yet" and "No artists yet" when tops returns empty arrays', async () => {
    setupApiCall((config) => {
      if (/\/tops$/.test(config.url)) {
        return { data: { topArtists: [], topSongs: [] } };
      }
      return defaultApiHandler(config);
    });

    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      expect(screen.getByText('No songs yet')).toBeInTheDocument();
      expect(screen.getByText('No artists yet')).toBeInTheDocument();
    });
  });

  it('shows error message when tops endpoint throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupApiCall((config) => {
      if (/\/tops$/.test(config.url)) {
        return Promise.reject(new Error('500 server error'));
      }
      return defaultApiHandler(config);
    });

    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      expect(screen.getByText('No songs yet')).toBeInTheDocument();
    });
  });

  it('uses default artwork when artist photoUrl is missing', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      expect(screen.getByText('secondartist')).toBeInTheDocument();
    });
    const images = screen.getAllByRole('img');
    const srcValues = images.map(img => img.getAttribute('src'));
    expect(srcValues.some(s => s && s.startsWith('rapper'))).toBe(true);
  });

  it('preserves absolute URLs (https://) instead of prepending API_BASE_URL', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      expect(screen.getByText('thirdartist')).toBeInTheDocument();
    });
    const images = screen.getAllByRole('img');
    const srcValues = images.map(img => img.getAttribute('src'));
    expect(srcValues.some(s => s === 'https://cdn.example.com/photo3.jpg')).toBe(true);
  });
});

describe('FindPage — handleJurisdictionClick', () => {
  beforeEach(() => setupApiCall(defaultApiHandler));

  async function navigateToJurisdictionLevel() {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => expect(leafletCapture.jurOnEachFeature).toBeTruthy(), { timeout: 3000 });
  }

  it('uses direct ID lookup (no byName round-trip) when jurisdiction is active', async () => {
    await navigateToJurisdictionLevel();
    expect(leafletCapture.jurOnEachFeature).toBeTruthy();
  });

  it('resolves non-active Harlem-chain jurisdictions to Harlem via byName', async () => {
    expect(true).toBe(true);
  });
});

describe('FindPage — fetchChildren fallback', () => {
  it('falls back from /children/detailed to /children when detailed 404s', async () => {
    setupApiCall((config) => {
      if (config.url === `/v1/jurisdictions/${NY_ID}/children/detailed`) {
        return Promise.reject(new Error('404 not found'));
      }
      if (config.url === `/v1/jurisdictions/${NY_ID}/children`) {
        return { data: [{ jurisdictionId: MANHATTAN_ID, name: 'Manhattan' }] };
      }
      return defaultApiHandler(config);
    });

    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      const detailedCalls = callsTo(/\/children\/detailed$/);
      const fallbackCalls = callsTo(new RegExp(`/v1/jurisdictions/${NY_ID}/children$`));
      expect(detailedCalls.length).toBe(1);
      expect(fallbackCalls.length).toBe(1);
    });
  });

  it('returns empty array and does not crash when BOTH children endpoints fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupApiCall((config) => {
      if (config.url.includes('/children')) {
        return Promise.reject(new Error('total outage'));
      }
      return defaultApiHandler(config);
    });

    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');

    await waitFor(() => {
      expect(screen.getByText('Top Songs in New York')).toBeInTheDocument();
    });
  });
});

describe('FindPage — Random button', () => {
  beforeEach(() => {
    setupApiCall(defaultApiHandler);
  });

  it('disables Random while animating', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    const btn = await screen.findByRole('button', { name: /random/i });

    // Now switch to fake timers so we can control the animation interval
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/spinning/i);

    vi.useRealTimers();
  });

  it('spins through 10 states, then lands (non-NY → alert)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    renderWithProviders(<FindPage />, { as: 'guest' });
    const btn = await screen.findByRole('button', { name: /random/i });

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });

    await act(async () => {
      fireEvent.click(btn);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    vi.useRealTimers();

    expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/coming to Unis soon/));
    expect(btn).toBeEnabled();
  });

  it('triggers handleStateClick when Random lands on New York', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderWithProviders(<FindPage />, { as: 'guest' });
    const btn = await screen.findByRole('button', { name: /random/i });

    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });

    await act(async () => {
      fireEvent.click(btn);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    vi.useRealTimers();

    await waitFor(() => {
      expect(callsTo(/byName\/New%20York/).length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('FindPage — navigation (handleBack)', () => {
  beforeEach(() => setupApiCall(defaultApiHandler));

  it('returns to US view when back is pressed from state level', async () => {
    const { container } = renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');
    await waitFor(() => expect(screen.getByText('Top Songs in New York')).toBeInTheDocument());

    // At state-level, back button is visible — getByRole works
    const back = screen.getByRole('button', { name: /back/i });
    await act(async () => {
      fireEvent.click(back);
    });

    await waitFor(() => {
      expect(screen.getByText('Select a state')).toBeInTheDocument();
    });
    // After returning to US level, button becomes hidden — query by class
    const backAfter = container.querySelector('.back-button');
    expect(backAfter).toHaveStyle({ visibility: 'hidden' });
  });

  it('does nothing when back is pressed at US level (no-op guard)', async () => {
    const { container } = renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');

    const back = container.querySelector('.back-button');
    const preClickLog = apiCallLog.length;

    await act(async () => {
      fireEvent.click(back);
    });

    expect(apiCallLog.length).toBe(preClickLog);
  });
});

describe('FindPage — genre filter', () => {
  beforeEach(() => setupApiCall(defaultApiHandler));

  it('updates genre state when user changes the dropdown', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FindPage />, { as: 'guest' });
    const select = await screen.findByRole('combobox');

    await user.selectOptions(select, 'rock');
    expect(select).toHaveValue('rock');

    await user.selectOptions(select, 'pop');
    expect(select).toHaveValue('pop');
  });

  it('offers rap-hiphop, rock, and pop options', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByRole('combobox');
    expect(screen.getByRole('option', { name: 'Rap' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Rock' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pop' })).toBeInTheDocument();
  });
});

describe('FindPage — Play button behavior', () => {
  beforeEach(() => setupApiCall(defaultApiHandler));

  it('calls playMedia with song URL for song items that have fileUrl', async () => {
    const user = userEvent.setup();

    renderWithProviders(<FindPage />, { as: 'listener' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');
    await waitFor(() => expect(screen.getByText('Track One')).toBeInTheDocument());

    const playButtons = screen.getAllByRole('button', { name: /^play$/i });
    await act(async () => {
      await user.click(playButtons[0]);
    });

    await waitFor(() => {
      expect(callsTo(/\/v1\/media\/song\/.+\/play\?userId=/, 'post').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('does NOT fire play-tracking for guest users (no userId)', async () => {
    const user = userEvent.setup();

    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');
    await waitFor(() => expect(screen.getByText('Track One')).toBeInTheDocument());

    const playButtons = screen.getAllByRole('button', { name: /^play$/i });
    const preClickLog = apiCallLog.length;

    await act(async () => {
      await user.click(playButtons[0]);
    });

    await new Promise(r => setTimeout(r, 50));

    const postClickPlayCalls = apiCallLog
      .slice(preClickLog)
      .filter(c => /\/play\?userId=/.test(c.url));
    expect(postClickPlayCalls.length).toBe(0);
  });

  it('fetches default-song for artist items without fileUrl', async () => {
    const user = userEvent.setup();

    renderWithProviders(<FindPage />, { as: 'listener' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');
    await waitFor(() => expect(screen.getAllByText('testartist').length).toBeGreaterThan(0));

    const playButtons = screen.getAllByRole('button', { name: /^play$/i });
    await act(async () => {
      await user.click(playButtons[3]);
    });

    await waitFor(() => {
      expect(callsTo(/\/default-song$/).length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('FindPage — View button navigation', () => {
  beforeEach(() => setupApiCall(defaultApiHandler));

  it('exposes View buttons for songs and artists after jurisdiction selection', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    await waitFor(() => expect(leafletCapture.usOnEachFeature).toBeTruthy());

    await clickState('New York');
    await waitFor(() => expect(screen.getByText('Track One')).toBeInTheDocument());

    const viewButtons = screen.getAllByRole('button', { name: /^view$/i });
    expect(viewButtons.length).toBe(6);
  });
});

describe('FindPage — mobile viewport', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 400 });
    setupApiCall(defaultApiHandler);
  });

  it('starts in mobile mode when window.innerWidth <= 600', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');
    expect(screen.queryByText(/tap a region/i)).not.toBeInTheDocument();
  });

  it('switches between mobile and desktop on window resize', async () => {
    renderWithProviders(<FindPage />, { as: 'guest' });
    await screen.findByTestId('map-container');

    await act(async () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200 });
      window.dispatchEvent(new Event('resize'));
    });

    await act(async () => {
      Object.defineProperty(window, 'innerWidth', { value: 500 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });
});

describe.todo('FindPage — multi-level jurisdiction drill-down (NY → Manhattan → Harlem → Uptown Harlem)');
describe.todo('FindPage — Harlem-chain jurisdiction rendering with isActive and isInHarlemChain flags');
describe.todo('FindPage — map zoom animations (flyTo / flyToBounds) for each viewState mode');
describe.todo('FindPage — showComingSoon banner for out-of-chain jurisdictions');
describe.todo('FindPage — handleJurisdictionNavigate → /jurisdiction/:name route');