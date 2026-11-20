// src/jurisdictionPage.test.jsx
//
// Tests for JurisdictionPage (v6) — the identity page for one place.
//
// The page looks the place up by name (apiCall), then reads this week's artist
// and song boards through utils/standings.js. fetchStandings is mocked at the
// module boundary (its own logic is tested in utils/standings.test.js);
// describeBoard stays real. Place context (breadcrumb, neighborhoods) comes
// from /breadcrumb and /children/detailed after the page loads.
//
// Covers:
//   • loading and error states
//   • the lookup request, the two board requests, the place-context requests
//   • hero: name, bio (no stock line), this week's #1 as the cover, the place
//     photo as fallback, crown, statline, Neighborhood/District chip from the
//     children lookup, Your home, breadcrumb
//   • the race: lead, tie, neck and neck, unopposed, empty, last week
//   • number one song: shown when a song has scored; open and play
//   • Play the top 10 goes through requestPlayCollection
//   • neighborhoods inside a district / next door to a neighborhood
//   • "finished" wording when the board shows last week's final
//   • chart boards: rank, movement, points, empty wording, zero-point entries
//     left out
//   • playing a song goes through requestPlay with source "jurisdiction";
//     a song with no file tells the user instead
//   • playing an artist looks up their featured song; the two failure messages
//   • the page never records a play itself
//   • navigation: rows, Vote, Charts, Share, full-chart links
//   • exactly one WinnersTimeline, given the place's id
//   • the ad slot is present

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./jurisdictionPage.scss', () => ({}));
vi.mock('./components/RankMove.scss', () => ({}));
vi.mock('./components/followBar.scss', () => ({}));
// The bar's scroll behavior is the shared hook's job (and jsdom has no
// layout). Kept hidden here, so its buttons stay out of the queries below.
vi.mock('./hooks/useFollowBar', () => ({
  useFollowBar: () => ({
    titleRef: { current: null },
    playRef: { current: null },
    barRef: { current: null },
    shown: false,
    docked: false,
    scrollToTop: () => {},
  }),
}));
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

const { mockNavigate, routeParams, fetchStandings, feedback, auth } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  routeParams: { jurisdiction: 'Uptown Harlem' },
  fetchStandings: vi.fn(),
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  auth: { user: null },
}));

vi.mock('./context/AuthContext', () => ({
  useAuth: () => auth,
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
  bio: 'North of 130th Street — Sugar Hill, Hamilton Heights, and Strivers Row.',
};

// Root (Unis) → New York → Manhattan → Harlem → Uptown Harlem
const CHAIN = [
  { jurisdictionId: 'root', name: 'Unis', parentJurisdictionId: null },
  { jurisdictionId: 'ny', name: 'New York', parentJurisdictionId: 'root' },
  { jurisdictionId: 'man', name: 'Manhattan', parentJurisdictionId: 'ny' },
  { jurisdictionId: 'harlem', name: 'Harlem', parentJurisdictionId: 'man' },
  { jurisdictionId: JUR_ID, name: 'Uptown Harlem', parentJurisdictionId: 'harlem' },
];

const kid = (id, name, extra = {}) => ({ jurisdictionId: id, name, hasChildren: false, isActive: true, ...extra });

const HARLEM_KIDS = [
  kid(JUR_ID, 'Uptown Harlem'),
  kid('down', 'Downtown Harlem'),
  kid('east', 'East Harlem', { isActive: false }),
];

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
  entry({ id: 'a1', rank: 1, name: 'rockle_gend', points: 1210, homeJurisdictionName: 'Sugar Hill', artwork: 'https://cdn.test/a1.jpg', movement: 2 }),
  entry({ id: 'a2', rank: 2, name: 'stizz', points: 320, isNew: true }),
  entry({ id: 'a3', rank: 3, name: 'quiet_one', points: 0 }),
];

const SONGS = [
  entry({ id: 's1', type: 'song', rank: 1, name: 'rock baby', artistName: 'rockle_gend', artistId: 'a1', points: 152, artwork: 'https://cdn.test/s1.jpg', fileUrl: 'https://cdn.test/s1.mp3' }),
  entry({ id: 's2', type: 'song', rank: 2, name: 'no more heroes', artistName: '', artistId: 'a2', points: 140, movement: -1 }),
  entry({ id: 's3', type: 'song', rank: 3, name: 'unheard', points: 0 }),
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const requestPlay = vi.fn();
const requestPlayCollection = vi.fn();
const togglePlayPause = vi.fn();
let apiSpy;
let jurResponse;
let defaultSong;
let boards;
let chain;
let kids;

function renderPage(props = {}) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PlayerContext.Provider value={{ requestPlay, requestPlayCollection, togglePlayPause, currentMedia: null, isPlaying: false }}>
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

const statline = () => document.querySelector('.jp-statline');
const chips = () => document.querySelector('.jp-chips');
const raceLine = () => document.querySelector('.jp-race__line');
const boardOf = (title) => screen.getByRole('heading', { level: 3, name: title }).closest('.jp-board');
const apiUrls = () => apiSpy.mock.calls.map(([c]) => `${c.method} ${c.url}`);

beforeEach(() => {
  vi.clearAllMocks();
  routeParams.jurisdiction = 'Uptown Harlem';
  auth.user = null;
  jurResponse = [JUR];
  chain = CHAIN;
  kids = { [JUR_ID]: [], harlem: HARLEM_KIDS };
  defaultSong = { songId: 'ds-1', title: 'Featured Cut', fileUrl: 'https://cdn.test/ds1.mp3', artworkUrl: 'https://cdn.test/ds1.jpg' };
  boards = { artist: board(ARTISTS), song: board(SONGS) };

  fetchStandings.mockImplementation(async ({ type }) => boards[type]);
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    if (config.url.startsWith('/v1/jurisdictions/byName/')) return { data: jurResponse };
    if (/\/breadcrumb$/.test(config.url)) {
      if (chain instanceof Error) throw chain;
      return { data: chain };
    }
    const kidsMatch = config.url.match(/^\/v1\/jurisdictions\/(.+)\/children\/detailed$/);
    if (kidsMatch) {
      const list = kids[kidsMatch[1]];
      if (list instanceof Error) throw list;
      return { data: list || [] };
    }
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

  it('then reads the breadcrumb and the neighborhoods, and the parent\'s for a neighborhood', async () => {
    await renderLoaded();
    await waitFor(() => expect(apiUrls()).toContain('get /v1/jurisdictions/harlem/children/detailed'));
    expect(apiUrls()).toContain(`get /v1/jurisdictions/${JUR_ID}/breadcrumb`);
    expect(apiUrls()).toContain(`get /v1/jurisdictions/${JUR_ID}/children/detailed`);
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

  it('shows no stock line when there is no bio', async () => {
    jurResponse = [{ ...JUR, bio: null }];
    await renderLoaded();
    expect(screen.queryByText(/heartbeat/i)).not.toBeInTheDocument();
    expect(document.querySelector('.jp-bio')).toBeNull();
  });

  it('uses this week\'s #1 artist as the cover, named in the alt text', async () => {
    await renderLoaded();
    const img = document.querySelector('.jp-hero__img');
    expect(img).toHaveAttribute('src', 'https://cdn.test/a1.jpg');
    expect(img).toHaveAttribute('alt', 'rockle_gend, this week’s number one in Uptown Harlem');
  });

  it('falls back to the place\'s own image when the #1 has no photo', async () => {
    boards.artist = board([{ ...ARTISTS[0], artwork: null }, ARTISTS[1]]);
    jurResponse = [{ ...JUR, symbolUrl: 'https://cdn.test/uptown.jpg' }];
    await renderLoaded();
    expect(document.querySelector('.jp-hero__img')).toHaveAttribute('src', 'https://cdn.test/uptown.jpg');
    expect(document.querySelector('.jp-hero')).toHaveClass('jp-hero--place');
  });

  it('the crown names the #1 and opens their page', async () => {
    const { user } = await renderLoaded();
    const crowns = screen.getAllByRole('button', { name: '#1 in Uptown Harlem this week: rockle_gend' });
    expect(crowns).toHaveLength(2); // desktop corner + phone row; CSS shows one
    await user.click(crowns[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/artist/a1');
  });

  it('counts only artists who have scored, totals their points, and gives the close time', async () => {
    boards.artist = board(ARTISTS, { closesAt: '2026-11-23T04:59:00Z' });
    await renderLoaded();
    expect(statline()).toHaveTextContent(/2 artists charting/);
    expect(statline()).toHaveTextContent(/1,530 points this week/);
    expect(statline()).toHaveTextContent(/final/);
  });

  it('adds a "+" when the board has more artists than the page loaded', async () => {
    const full = Array.from({ length: 25 }, (_, i) => entry({ id: `a${i}`, rank: i + 1, name: `artist ${i}`, points: 100 - i }));
    boards.artist = board(full, { total: 40 });
    await renderLoaded();
    expect(statline()).toHaveTextContent(/25\+ artists charting/);
  });

  it('says so when nobody has scored yet, and shows no crown', async () => {
    boards = { artist: board([]), song: board([]) };
    await renderLoaded();
    expect(statline()).toHaveTextContent('Nobody on the board yet. The first play, like or vote starts it.');
    expect(screen.queryByRole('button', { name: /^#1 in / })).not.toBeInTheDocument();
    expect(document.querySelector('.jp-hero')).toHaveClass('jp-hero--solo');
  });

  it('labels a place with no children "Neighborhood" once the lookup answers', async () => {
    await renderLoaded();
    expect(await within(chips()).findByText('Neighborhood')).toBeInTheDocument();
  });

  it('labels a place with children "District" and counts them', async () => {
    kids[JUR_ID] = [kid('k1', 'North End'), kid('k2', 'South End')];
    await renderLoaded();
    expect(await within(chips()).findByText('District · 2 neighborhoods')).toBeInTheDocument();
  });

  it('shows no tier at all when the children lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    kids[JUR_ID] = new Error('down');
    await renderLoaded();
    await waitFor(() => expect(apiUrls()).toContain(`get /v1/jurisdictions/${JUR_ID}/children/detailed`));
    expect(within(chips()).queryByText(/Neighborhood|District/)).not.toBeInTheDocument();
  });

  it('marks the user\'s own place "Your home"', async () => {
    auth.user = { jurisdiction: { jurisdictionId: JUR_ID, name: 'Uptown Harlem' } };
    await renderLoaded();
    expect(within(chips()).getByText('Your home')).toBeInTheDocument();
  });

  it('does not say "Your home" on someone else\'s place', async () => {
    auth.user = { jurisdiction: { jurisdictionId: 'elsewhere', name: 'Downtown Harlem' } };
    await renderLoaded();
    expect(within(chips()).queryByText('Your home')).not.toBeInTheDocument();
  });

  it('shows where the place sits — without the root — and each level opens', async () => {
    const { user } = await renderLoaded();
    const crumbs = await screen.findByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('button', { name: 'New York' })).toBeInTheDocument();
    expect(within(crumbs).getByRole('button', { name: 'Harlem' })).toBeInTheDocument();
    expect(within(crumbs).queryByText('Unis')).not.toBeInTheDocument();
    expect(crumbs.querySelector('[aria-current="page"]')).toHaveTextContent('Uptown Harlem');
    await user.click(within(crumbs).getByRole('button', { name: 'Manhattan' }));
    expect(mockNavigate).toHaveBeenCalledWith('/jurisdiction/Manhattan');
  });

  it('phones get a single "up" button to the parent', async () => {
    const { user } = await renderLoaded();
    await user.click(await screen.findByRole('button', { name: 'Up to Harlem' }));
    expect(mockNavigate).toHaveBeenCalledWith('/jurisdiction/Harlem');
  });

  it('Vote and Charts navigate', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Vote in Uptown Harlem' }));
    await user.click(screen.getByRole('button', { name: 'Charts for Uptown Harlem' }));
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/voteawards');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/charts?type=song&period=weekly&genre=all&place=uptown-harlem');
  });

  it('Share copies the page link and says so', async () => {
    const { user } = await renderLoaded();
    // user-event installs its own clipboard on setup; spy on that one.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getAllByRole('button', { name: 'Share Uptown Harlem' })[0]);
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(feedback.success).toHaveBeenCalledWith('Link copied', { id: 'copy-link' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — the race', () => {
  it('shows #1 against #2 and the gap', async () => {
    await renderLoaded();
    expect(screen.getByRole('button', { name: 'Open rockle_gend, first with 1,210 points' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open stizz, second with 320 points' })).toBeInTheDocument();
    expect(raceLine()).toHaveTextContent('rockle_gend leads by 890 points.');
    expect(screen.getByRole('img', { name: /rockle_gend has 79 percent/ })).toBeInTheDocument();
  });

  it('names third place and how far behind', async () => {
    boards.artist = board([
      ...ARTISTS.slice(0, 2),
      entry({ id: 'a4', rank: 3, name: 'third_one', points: 300 }),
    ]);
    await renderLoaded();
    expect(raceLine()).toHaveTextContent('third_one is third, 20 behind stizz.');
  });

  it('calls a close race "Neck and neck"', async () => {
    boards.artist = board([
      entry({ id: 'a1', rank: 1, name: 'rockle_gend', points: 1210 }),
      entry({ id: 'a2', rank: 2, name: 'stizz', points: 1198 }),
    ]);
    await renderLoaded();
    expect(screen.getByText('Neck and neck')).toBeInTheDocument();
    expect(raceLine()).toHaveTextContent('rockle_gend leads by just 12 points.');
  });

  it('explains a tie', async () => {
    boards.artist = board([
      entry({ id: 'a1', rank: 1, name: 'rockle_gend', points: 500 }),
      entry({ id: 'a2', rank: 2, name: 'stizz', points: 500 }),
    ]);
    await renderLoaded();
    expect(raceLine()).toHaveTextContent('rockle_gend and stizz are tied on 500 points.');
  });

  it('says so when one artist is unopposed', async () => {
    boards.artist = board([ARTISTS[0]]);
    await renderLoaded();
    expect(screen.getByText('Open spot')).toBeInTheDocument();
    expect(raceLine()).toHaveTextContent('rockle_gend is the only artist on the board in Uptown Harlem this week.');
  });

  it('an empty board invites the first play', async () => {
    boards = { artist: board([]), song: board([]) };
    const { user } = await renderLoaded();
    expect(screen.getByText('Not started')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Find music from Uptown Harlem' }));
    expect(mockNavigate).toHaveBeenCalledWith('/findpage');
  });

  it('links to how the race works', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'How the race works' }));
    expect(mockNavigate).toHaveBeenCalledWith('/help#awards-winner');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — live week vs last week\'s final', () => {
  it('a live board uses "this week" wording', async () => {
    await renderLoaded();
    expect(within(chips()).getByText('Live this week')).toBeInTheDocument();
    expect(statline()).toHaveTextContent(/points this week/);
    expect(screen.getByText('Number one song · this week')).toBeInTheDocument();
  });

  it('before anyone scores in a new week, it says the results are last week\'s', async () => {
    boards.artist = board(ARTISTS, { state: 'PREVIOUS_FINAL' });
    await renderLoaded();
    expect(within(chips()).getByText("Last week's final")).toBeInTheDocument();
    expect(statline()).toHaveTextContent(/1,530 points last week/);
    expect(screen.getByRole('heading', { level: 2, name: 'Last week’s race' })).toBeInTheDocument();
    expect(raceLine()).toHaveTextContent('rockle_gend won last week by 890 points.');
    expect(screen.getAllByRole('button', { name: 'Last week’s #1: rockle_gend' })).toHaveLength(2);
    expect(screen.getByText('Last week’s number one song')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — number one song', () => {
  it('features the top-scoring song', async () => {
    await renderLoaded();
    const card = document.querySelector('.jp-song1');
    expect(within(card).getByRole('heading', { level: 2, name: 'rock baby' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'rockle_gend' })).toBeInTheDocument();
    expect(card.querySelector('.jp-song1__art')).toHaveAttribute('src', 'https://cdn.test/s1.jpg');
  });

  it('says so when no song has scored', async () => {
    boards.song = board([SONGS[2]]);
    await renderLoaded();
    expect(screen.getByText('No song has scored here this week yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /number one song/i })).not.toBeInTheDocument();
  });

  it('the title opens the song page and the artist opens theirs', async () => {
    const { user } = await renderLoaded();
    const card = document.querySelector('.jp-song1');
    await user.click(within(card).getByRole('button', { name: 'rock baby' }));
    await user.click(within(card).getByRole('button', { name: 'rockle_gend' }));
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/song/s1');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/artist/a1');
  });

  it('Listen plays it without opening the song page', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Listen to the number one song, rock baby' }));
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
describe('JurisdictionPage — play the top 10', () => {
  it('queues this week\'s playable top tracks as one collection', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play Uptown Harlem’s top 1 this week' }));
    expect(requestPlayCollection).toHaveBeenCalledTimes(1);
    const { tracks, title } = requestPlayCollection.mock.calls[0][0];
    expect(title).toBe('Uptown Harlem · top 1');
    expect(tracks).toHaveLength(1); // "no more heroes" has no file
    expect(tracks[0]).toEqual(expect.objectContaining({ id: 's1', url: 'https://cdn.test/s1.mp3', source: 'jurisdiction' }));
    expect(requestPlay).not.toHaveBeenCalled();
  });

  it('is disabled when nothing is playable', async () => {
    boards.song = board([SONGS[1]]); // scored, but no file
    await renderLoaded();
    expect(document.querySelector('.jp-play')).toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('JurisdictionPage — neighborhoods', () => {
  it('a neighborhood shows its parent and the places next door; closed ones are not links', async () => {
    const { user } = await renderLoaded();
    const strip = (await screen.findByRole('heading', { level: 2, name: 'Part of Harlem · next door' })).closest('section');
    expect(within(strip).getByRole('button', { name: /Harlem\s*District/ })).toBeInTheDocument();
    expect(within(strip).getByText('Opening soon')).toBeInTheDocument();
    expect(within(strip).queryByRole('button', { name: /East Harlem/ })).not.toBeInTheDocument();
    expect(within(strip).queryByRole('button', { name: /Uptown Harlem/ })).not.toBeInTheDocument();
    await user.click(within(strip).getByRole('button', { name: /Downtown Harlem/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/jurisdiction/Downtown%20Harlem');
  });

  it('a district lists the places inside it', async () => {
    kids[JUR_ID] = [kid('k1', 'North End'), kid('k2', 'South End', { isActive: false })];
    await renderLoaded();
    const strip = (await screen.findByRole('heading', { level: 2, name: 'Inside Uptown Harlem' })).closest('section');
    expect(within(strip).getByRole('button', { name: /North End/ })).toBeInTheDocument();
    expect(within(strip).getByText('Opening soon')).toBeInTheDocument();
  });

  it('a failed breadcrumb just hides the breadcrumb and the strip', async () => {
    chain = new Error('down');
    await renderLoaded();
    await waitFor(() => expect(apiUrls()).toContain(`get /v1/jurisdictions/${JUR_ID}/breadcrumb`));
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Uptown Harlem' })).toBeInTheDocument();
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
    expect(rows[0].querySelector('.jp-row-score')).toHaveTextContent('1,210pts');
    expect(rows[1].querySelector('.jp-row-score')).toHaveTextContent('320pts');
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
    expect(statline()).toHaveTextContent(/14 artists charting/);
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
    await user.click(screen.getByRole('button', { name: 'Listen to the number one song, rock baby' }));
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

  it('has none of the old hardcoded hero pills or stock lines', async () => {
    await renderLoaded();
    expect(screen.queryByText('Invite-Only')).not.toBeInTheDocument();
    expect(screen.queryByText(/active poll: live/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/heartbeat of/i)).not.toBeInTheDocument();
  });
});
