// src/jurisdictionPage.test.jsx
//
// Tests for JurisdictionPage — the identity page for one place.
//
// The page looks the place up by name (apiCall), then reads this week's artist
// and song boards through utils/standings.js. fetchStandings is mocked at the
// module boundary (its own logic is tested in utils/standings.test.js);
// describeBoard stays real.
//
// Covers:
//   • loading and error states
//   • the lookup request and the two board requests
//   • hero: name, bio or fallback line, Neighborhood/District pill, stats
//   • "finished" wording when the board shows last week's final
//   • song of the week: shown only when a song has scored; open and play
//   • chart boards: rank, movement, points, empty wording, zero-point entries
//     left out
//   • playing a song goes through requestPlay with source "jurisdiction";
//     a song with no file tells the user instead
//   • playing an artist looks up their featured song; the two failure messages
//   • the page never records a play itself
//   • navigation: rows, Vote now, Explore tracks, full-chart links
//   • exactly one WinnersTimeline, given the place's id
//   • the ad slot is present

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./jurisdictionPage.scss', () => ({}));
vi.mock('./components/RankMove.scss', () => ({}));
vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));
vi.mock('./components/AdSlot', () => ({
  default: ({ placement }) => <div data-testid="ad-slot" data-placement={placement} />,
}));
vi.mock('./winnersTimeline', () => ({
  default: (props) => (
    <div
      data-testid="winners-timeline"
      data-jurisdiction={props.jurisdiction}
      data-jurisdiction-id={props.jurisdictionId}
      data-variant={props.variant}
      data-interval={props.initialInterval}
      data-category={props.initialCategory}
    />
  ),
}));

const { mockNavigate, routeParams, fetchStandings, feedback } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  routeParams: { jurisdiction: 'Uptown Harlem' },
  fetchStandings: vi.fn(),
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => routeParams,
  useNavigate: () => mockNavigate,
}));

vi.mock('./utils/standings', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStandings,
}));

vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));

import { PlayerContext } from './context/playercontext';
import * as axiosModule from './components/axiosInstance';
import JurisdictionPage from './jurisdictionPage';

// ─── Fixtures ───────────────────────────────────────────────────────────────
const JUR_ID = 'jur-uptown-001';

const JUR = {
  jurisdictionId: JUR_ID,
  name: 'Uptown Harlem',
  hasChildren: false,
  bio: 'North of 130th Street — Sugar Hill, Hamilton Heights, and Strivers Row.',
};

const entry = (overrides) => ({
  id: 'id-x', type: 'artist', rank: 1, name: 'Someone', artistName: '', artistId: null,
  artwork: null, fileUrl: null, homeJurisdictionName: '', points: 0,
  winner: false, movement: null, isNew: false,
  ...overrides,
});

const board = (entries, overrides = {}) => ({
  type: entries[0]?.type || 'artist',
  state: 'LIVE',
  periodKey: 'weekly',
  closesAt: null,
  stillOpenIn: [],
  total: entries.length,
  entries,
  ...overrides,
});

const ARTISTS = [
  entry({ id: 'a1', rank: 1, name: 'rockle_gend', points: 320, homeJurisdictionName: 'Sugar Hill', artwork: 'https://cdn.test/a1.jpg', movement: 2 }),
  entry({ id: 'a2', rank: 2, name: 'stizz', points: 1210, isNew: true }),
  entry({ id: 'a3', rank: 3, name: 'quiet_one', points: 0 }),
];

const SONGS = [
  entry({ id: 's1', type: 'song', rank: 1, name: 'rock baby', artistName: 'rockle_gend', artistId: 'a1', points: 152, artwork: 'https://cdn.test/s1.jpg', fileUrl: 'https://cdn.test/s1.mp3' }),
  entry({ id: 's2', type: 'song', rank: 2, name: 'no more heroes', artistName: '', artistId: 'a2', points: 140, movement: -1 }),
  entry({ id: 's3', type: 'song', rank: 3, name: 'unheard', points: 0 }),
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const requestPlay = vi.fn();
let apiSpy;
let jurResponse;
let defaultSong;
let boards;

function renderPage(props = {}) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PlayerContext.Provider value={{ requestPlay }}>
        <JurisdictionPage {...props} />
      </PlayerContext.Provider>
    </MemoryRouter>
  );
  return { user };
}

async function renderLoaded(props) {
  const utils = renderPage(props);
  await screen.findByRole('heading', { level: 1 });
  return utils;
}

const stat = (label) => within(screen.getByText(label).closest('.jp-stat')).getByRole('definition');
const boardOf = (title) => screen.getByRole('heading', { level: 3, name: title }).closest('.jp-board');
const apiUrls = () => apiSpy.mock.calls.map(([c]) => `${c.method} ${c.url}`);

beforeEach(() => {
  vi.clearAllMocks();
  routeParams.jurisdiction = 'Uptown Harlem';
  jurResponse = [JUR];
  defaultSong = { songId: 'ds-1', title: 'Featured Cut', fileUrl: 'https://cdn.test/ds1.mp3', artworkUrl: 'https://cdn.test/ds1.jpg' };
  boards = { artist: board(ARTISTS), song: board(SONGS) };

  fetchStandings.mockImplementation(async ({ type }) => boards[type]);
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    if (config.url.startsWith('/v1/jurisdictions/byName/')) return { data: jurResponse };
    if (/\/v1\/users\/.+\/default-song/.test(config.url)) {
      if (defaultSong instanceof Error) throw defaultSong;
      return { data: defaultSong };
    }
    throw new Error(`Unexpected request: ${config.method} ${config.url}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — loading and errors', () => {
  it('shows a loading line with the place name', () => {
    apiSpy.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Loading Uptown Harlem...')).toBeInTheDocument();
  });

  it('shows an error when the lookup finds no such place', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    jurResponse = [];
    renderPage();
    expect(await screen.findByText(/couldn't load uptown harlem/i)).toBeInTheDocument();
    expect(fetchStandings).not.toHaveBeenCalled();
    expect(screen.queryByTestId('winners-timeline')).not.toBeInTheDocument();
  });

  it('shows an error when the lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    apiSpy.mockRejectedValue(new Error('Network Error'));
    renderPage();
    expect(await screen.findByText(/couldn't load uptown harlem/i)).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith('[jurisdiction] fetch error:', 'Network Error');
  });

  it('shows an error when the boards fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchStandings.mockRejectedValue(new Error('down'));
    renderPage();
    expect(await screen.findByText(/couldn't load uptown harlem/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — requests', () => {
  it('looks the place up by its URL-encoded name', async () => {
    await renderLoaded();
    expect(apiSpy).toHaveBeenCalledWith({ method: 'get', url: '/v1/jurisdictions/byName/Uptown%20Harlem' });
  });

  it('accepts a bare object from the lookup as well as an array', async () => {
    jurResponse = JUR;
    await renderLoaded();
    expect(screen.getByRole('heading', { level: 1, name: 'Uptown Harlem' })).toBeInTheDocument();
  });

  it('reads this week\'s artist and song boards for that place, all genres', async () => {
    await renderLoaded();
    expect(fetchStandings).toHaveBeenCalledTimes(2);
    expect(fetchStandings).toHaveBeenCalledWith({ type: 'artist', jurisdictionId: JUR_ID, genre: 'all', period: 'weekly', limit: 25 });
    expect(fetchStandings).toHaveBeenCalledWith({ type: 'song', jurisdictionId: JUR_ID, genre: 'all', period: 'weekly', limit: 10 });
  });

  it('falls back to the jurisdiction prop when the route has no name', async () => {
    routeParams.jurisdiction = undefined;
    await renderLoaded({ jurisdiction: 'Harlem' });
    expect(apiSpy).toHaveBeenCalledWith(expect.objectContaining({ url: '/v1/jurisdictions/byName/Harlem' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Harlem' })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — hero', () => {
  it('shows the name and the place\'s own bio', async () => {
    await renderLoaded();
    expect(screen.getByRole('heading', { level: 1, name: 'Uptown Harlem' })).toBeInTheDocument();
    expect(screen.getByText(/north of 130th street/i)).toBeInTheDocument();
  });

  it('falls back to a generic line when there is no bio', async () => {
    jurResponse = [{ ...JUR, bio: null }];
    await renderLoaded();
    expect(screen.getByText(/the heartbeat of uptown harlem/i)).toBeInTheDocument();
  });

  it('labels a place with no children "Neighborhood"', async () => {
    await renderLoaded();
    expect(screen.getByText('Neighborhood')).toBeInTheDocument();
  });

  it('labels a place with children "District"', async () => {
    jurResponse = [{ ...JUR, hasChildren: true }];
    await renderLoaded();
    expect(screen.getByText('District')).toBeInTheDocument();
  });

  it('prefers the place\'s own image for the backdrop', async () => {
    jurResponse = [{ ...JUR, symbolUrl: 'https://cdn.test/uptown.jpg' }];
    await renderLoaded();
    expect(document.querySelector('.jp-hero-photo').style.backgroundImage).toContain('cdn.test/uptown.jpg');
  });

  it('names the top artist and top track', async () => {
    await renderLoaded();
    expect(stat('Top artist')).toHaveTextContent('rockle_gend');
    expect(stat('Top track')).toHaveTextContent('rock baby');
  });

  it('counts only artists who have scored, and totals their points', async () => {
    await renderLoaded();
    expect(stat('Artists charting')).toHaveTextContent(/^2$/);
    expect(stat('Points this week')).toHaveTextContent('1,530'); // 320 + 1,210
  });

  it('adds a "+" when the board has more artists than the page loaded', async () => {
    const full = Array.from({ length: 25 }, (_, i) => entry({ id: `a${i}`, rank: i + 1, name: `artist ${i}`, points: 100 - i }));
    boards.artist = board(full, { total: 40 });
    await renderLoaded();
    expect(stat('Artists charting')).toHaveTextContent('25+');
  });

  it('says so when nobody has scored yet', async () => {
    boards = { artist: board([]), song: board([]) };
    await renderLoaded();
    expect(stat('Top artist')).toHaveTextContent('No artist yet');
    expect(stat('Top track')).toHaveTextContent('No track yet');
    expect(stat('Artists charting')).toHaveTextContent(/^0$/);
    expect(stat('Points this week')).toHaveTextContent(/^0$/);
  });

  it('Vote now and Explore tracks navigate', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Vote now' }));
    await user.click(screen.getByRole('button', { name: 'Explore tracks' }));
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/voteawards');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/findpage');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — live week vs last week\'s final', () => {
  it('a live board uses "this week" wording', async () => {
    await renderLoaded();
    expect(screen.getByText('Live this week')).toBeInTheDocument();
    expect(screen.getByText('Points this week')).toBeInTheDocument();
    expect(screen.getByText('Number one this week')).toBeInTheDocument();
  });

  it('before anyone scores in a new week, it says the results are last week\'s', async () => {
    boards.artist = board(ARTISTS, { state: 'PREVIOUS_FINAL' });
    await renderLoaded();
    expect(screen.getByText("Last week's final")).toBeInTheDocument();
    expect(screen.getByText('Points last week')).toBeInTheDocument();
    expect(screen.getByText('Last week’s number one')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — song of the week', () => {
  it('features the top-scoring song', async () => {
    await renderLoaded();
    const card = screen.getByRole('button', { name: 'Song of the week: rock baby' });
    expect(within(card).getByRole('heading', { level: 2, name: 'rock baby' })).toBeInTheDocument();
    expect(within(card).getByText('rockle_gend')).toBeInTheDocument();
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/s1.jpg');
  });

  it('is left out when no song has scored', async () => {
    boards.song = board([SONGS[2]]);
    await renderLoaded();
    expect(screen.queryByRole('button', { name: /song of the week/i })).not.toBeInTheDocument();
    expect(document.querySelector('.jp-hero')).toHaveClass('jp-hero--solo');
  });

  it('clicking the card opens the song page', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Song of the week: rock baby' }));
    expect(mockNavigate).toHaveBeenCalledWith('/song/s1');
  });

  it('Enter on the card opens the song page', async () => {
    await renderLoaded();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Song of the week: rock baby' }), { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/song/s1');
  });

  it('"Listen now" plays it without opening the song page', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play song of the week: rock baby' }));
    expect(requestPlay).toHaveBeenCalledWith(expect.objectContaining({
      type: 'song', id: 's1', songId: 's1',
      url: 'https://cdn.test/s1.mp3',
      title: 'rock baby', artist: 'rockle_gend', artistId: 'a1',
      artwork: 'https://cdn.test/s1.jpg',
      source: 'jurisdiction',
    }));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — chart boards', () => {
  it('titles the chart with the place name', async () => {
    await renderLoaded();
    expect(screen.getByRole('heading', { level: 2, name: 'Who Uptown Harlem is backing' })).toBeInTheDocument();
  });

  it('lists scoring artists with rank, home and points', async () => {
    await renderLoaded();
    const rows = boardOf('Top artists').querySelectorAll('.jp-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.jp-row-rank')).toHaveTextContent('01');
    expect(within(rows[0]).getByText('Sugar Hill')).toBeInTheDocument();
    expect(rows[1].querySelector('.jp-row-score')).toHaveTextContent('1,210pts');
  });

  it('labels an artist with no home listed "Local artist"', async () => {
    await renderLoaded();
    expect(within(screen.getByRole('button', { name: 'View stizz' })).getByText('Local artist')).toBeInTheDocument();
  });

  it('lists scoring songs with their artist, falling back to Unknown', async () => {
    await renderLoaded();
    const rows = boardOf('Top tracks').querySelectorAll('.jp-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('rockle_gend')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Unknown')).toBeInTheDocument();
  });

  it('leaves out anyone with no points', async () => {
    await renderLoaded();
    expect(screen.queryByText('quiet_one')).not.toBeInTheDocument();
    expect(screen.queryByText('unheard')).not.toBeInTheDocument();
  });

  it('shows how far each row moved', async () => {
    await renderLoaded();
    expect(within(screen.getByRole('button', { name: 'View rockle_gend' })).getByLabelText('Up 2 places')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'View stizz' })).getByText('New')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: 'View no more heroes' })).getByLabelText('Down 1 place')).toBeInTheDocument();
  });

  it('shows at most ten artists', async () => {
    const many = Array.from({ length: 14 }, (_, i) => entry({ id: `a${i}`, rank: i + 1, name: `artist ${i}`, points: 100 - i }));
    boards.artist = board(many);
    await renderLoaded();
    expect(boardOf('Top artists').querySelectorAll('.jp-row')).toHaveLength(10);
    expect(stat('Artists charting')).toHaveTextContent('14');
  });

  it('explains an empty artist board and an empty track board', async () => {
    boards = { artist: board([]), song: board([]) };
    await renderLoaded();
    expect(screen.getByText(/no artists charting yet in uptown harlem/i)).toBeInTheDocument();
    expect(screen.getByText(/no tracks charting yet in uptown harlem/i)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — playing', () => {
  it('a track row plays through requestPlay with source "jurisdiction"', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play rock baby' }));
    expect(requestPlay).toHaveBeenCalledTimes(1);
    expect(requestPlay).toHaveBeenCalledWith(expect.objectContaining({
      id: 's1', fileUrl: 'https://cdn.test/s1.mp3', source: 'jurisdiction',
    }));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('a track with no file tells the user instead of playing', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play no more heroes' }));
    expect(requestPlay).not.toHaveBeenCalled();
    expect(feedback.info).toHaveBeenCalledWith("This track isn't available right now.");
  });

  it('an artist row plays that artist\'s featured song', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play rockle_gend' }));

    await waitFor(() => expect(requestPlay).toHaveBeenCalledTimes(1));
    expect(apiSpy).toHaveBeenCalledWith({ method: 'get', url: '/v1/users/a1/default-song' });
    expect(requestPlay).toHaveBeenCalledWith(expect.objectContaining({
      type: 'song', id: 'ds-1', songId: 'ds-1',
      url: 'https://cdn.test/ds1.mp3',
      title: 'Featured Cut',
      artist: 'rockle_gend', artistId: 'a1',
      artwork: 'https://cdn.test/ds1.jpg',
      source: 'jurisdiction',
    }));
  });

  it('falls back to the artist photo when the featured song has no artwork', async () => {
    defaultSong = { songId: 'ds-1', title: 'Featured Cut', fileUrl: 'https://cdn.test/ds1.mp3' };
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play rockle_gend' }));
    await waitFor(() => expect(requestPlay).toHaveBeenCalledTimes(1));
    expect(requestPlay.mock.calls[0][0].artwork).toBe('https://cdn.test/a1.jpg');
  });

  it('tells the user when the artist has no featured song', async () => {
    defaultSong = {};
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play stizz' }));
    await waitFor(() => expect(feedback.info).toHaveBeenCalledWith("stizz hasn't set a default song yet."));
    expect(requestPlay).not.toHaveBeenCalled();
  });

  it('tells the user when the featured-song lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    defaultSong = new Error('down');
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play stizz' }));
    await waitFor(() =>
      expect(feedback.info).toHaveBeenCalledWith("Couldn't load stizz's song. Try again in a moment."));
    expect(requestPlay).not.toHaveBeenCalled();
  });

  it('the page never records a play itself (the Player does, after real listening)', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play rock baby' }));
    await user.click(screen.getByRole('button', { name: 'Play song of the week: rock baby' }));
    await user.click(screen.getByRole('button', { name: 'Play rockle_gend' }));
    await waitFor(() => expect(requestPlay).toHaveBeenCalledTimes(3));

    expect(apiUrls().filter((u) => u.startsWith('post'))).toHaveLength(0);
    expect(apiUrls().some((u) => /\/play/.test(u))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — navigation', () => {
  it('an artist row opens the artist page', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'View stizz' }));
    expect(mockNavigate).toHaveBeenCalledWith('/artist/a2');
  });

  it('a track row opens the song page', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'View no more heroes' }));
    expect(mockNavigate).toHaveBeenCalledWith('/song/s2');
  });

  it('rows open from the keyboard with Enter or Space', async () => {
    await renderLoaded();
    fireEvent.keyDown(screen.getByRole('button', { name: 'View stizz' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'View rock baby' }), { key: ' ' });
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/artist/a2');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/song/s1');
  });

  it('the full-chart links carry this place and this week', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'See the full artist chart' }));
    await user.click(screen.getByRole('button', { name: 'See the full song chart' }));
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/charts?type=artist&period=weekly&genre=all&place=uptown-harlem');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/charts?type=song&period=weekly&genre=all&place=uptown-harlem');
  });

  it('a place the charts page does not know falls back to Harlem', async () => {
    routeParams.jurisdiction = 'Sugar Hill';
    jurResponse = [{ ...JUR, name: 'Sugar Hill' }];
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'See the full artist chart' }));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('place=harlem'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — hall of fame and ads', () => {
  it('renders exactly one WinnersTimeline, embedded, for this place', async () => {
    await renderLoaded();
    const timelines = screen.getAllByTestId('winners-timeline');
    expect(timelines).toHaveLength(1);
    expect(timelines[0]).toHaveAttribute('data-jurisdiction', 'Uptown Harlem');
    expect(timelines[0]).toHaveAttribute('data-jurisdiction-id', JUR_ID);
    expect(timelines[0]).toHaveAttribute('data-variant', 'embedded');
    expect(timelines[0]).toHaveAttribute('data-interval', 'week');
    expect(timelines[0]).toHaveAttribute('data-category', 'song');
  });

  it('has the jurisdiction ad slot', async () => {
    await renderLoaded();
    expect(screen.getByTestId('ad-slot')).toHaveAttribute('data-placement', 'jurisdiction');
  });

  it('has none of the old hardcoded hero pills', async () => {
    await renderLoaded();
    expect(screen.queryByText('Invite-Only')).not.toBeInTheDocument();
    expect(screen.queryByText(/active poll: live/i)).not.toBeInTheDocument();
  });
});
