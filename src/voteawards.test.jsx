// src/voteawards.test.jsx
//
// Tests for VoteAwards — the nominee page for the active poll.
//
// Nominees come from utils/standings.js (GET /v1/awards/standings — the same
// ranking that decides the award). fetchStandings and playEntry are mocked at
// the module boundary; that module's own logic is tested in
// utils/standings.test.js. The "current winner" card reads /v1/awards/past
// through apiCall, which is spied here.
//
// Covers:
//   • first render: filters, hero headline, countdown, LIVE badge
//   • the request each filter produces, and a refetch on every change
//   • guests can see nominees; guest Vote prompts a log-in instead of opening
//     the wizard
//   • loading, error and empty states
//   • status line for a live board and for a board showing the last period
//   • nominee cards: rank, movement, points, vote badge, jurisdiction
//   • "Show more nominees" paging, without duplicates
//   • search: toggle, filter, case-insensitive, no-match, close clears
//   • Listen (song and artist) goes through playEntry with source "voteawards"
//   • the page never records a play or an ad view itself
//   • Vote opens the wizard with the nominee and the current filters; a
//     successful vote closes it and reloads the nominees
//   • current-winner card: request window, newest award wins, navigation,
//     pending wording
//   • card click navigation

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./voteawards.scss', () => ({}));
vi.mock('./components/RankMove.scss', () => ({}));
vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));
vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

// VotingWizard has its own suites. This stub exposes the props worth asserting.
vi.mock('./votingWizard', () => ({
  default: (props) => (props.show ? (
    <div data-testid="voting-wizard">
      <span data-testid="vw-nominee-id">{props.nominee?.id || ''}</span>
      <span data-testid="vw-nominee-name">{props.nominee?.name || ''}</span>
      <span data-testid="vw-user">{props.userId || ''}</span>
      <span data-testid="vw-filters">{JSON.stringify(props.filters)}</span>
      <button onClick={props.onClose}>vw-close</button>
      <button onClick={() => props.onVoteSuccess(props.nominee?.id)}>vw-confirm</button>
    </div>
  ) : null),
}));

const { navigateSpy, fetchStandings, playEntry, feedback } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  fetchStandings: vi.fn(),
  playEntry: vi.fn(),
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateSpy,
}));

vi.mock('./utils/standings', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStandings,
  playEntry,
}));

vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));

import { PlayerContext } from './context/playercontext';
import * as axiosModule from './components/axiosInstance';
import { makeToken } from './test/mocks/handlers';
import VoteAwards from './voteawards';

// ---------------------------------------------------------------------------
// CONSTANTS / FIXTURES
// ---------------------------------------------------------------------------
const RAP_ID = '00000000-0000-0000-0000-000000000101';
const DAILY_ID = '00000000-0000-0000-0000-000000000201';
const HARLEM_ID = '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3';
const UPTOWN_ID = '52740de0-e4e9-4c9e-b68e-1e170f6788c4';
const DOWNTOWN_ID = '4b09eaa2-03bc-4778-b7c2-db8b42c9e732';

const entry = (overrides) => ({
  id: 'id-x', type: 'artist', rank: 1, name: 'Someone', artistName: '', artistId: null,
  artwork: null, fileUrl: null, homeJurisdictionId: UPTOWN_ID, homeJurisdictionName: 'Uptown Harlem',
  points: 0, votes: 0, plays: 0, likes: 0, winner: false, movement: null, isNew: false,
  ...overrides,
});

const board = (entries, overrides = {}) => ({
  type: entries[0]?.type || 'artist',
  state: 'LIVE',
  periodKey: 'daily',
  closesAt: null,
  stillOpenIn: [],
  total: entries.length,
  offset: 0,
  entries,
  ...overrides,
});

const ARTISTS = [
  entry({ id: 'artist-01', rank: 1, name: 'Tony Fadd', points: 1200, votes: 7, artwork: 'https://cdn.test/tony.jpg', movement: 1 }),
  entry({ id: 'artist-02', rank: 2, name: 'SD Boomin', points: 900, votes: 1, homeJurisdictionName: 'Downtown Harlem', isNew: true }),
  entry({ id: 'artist-03', rank: 3, name: 'Harlem MC', points: 0, votes: 0 }),
];

const SONGS = [
  entry({ id: 'song-01', type: 'song', rank: 1, name: 'Midnight Uptown', artistName: 'Tony Fadd', artistId: 'artist-01', points: 55, votes: 3, artwork: 'https://cdn.test/s1.jpg', fileUrl: 'https://cdn.test/s1.mp3' }),
  entry({ id: 'song-02', type: 'song', rank: 2, name: 'No File Yet', artistName: '', points: 5 }),
];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const requestPlay = vi.fn();
let apiSpy;
let pastAwards = [];

const pastCalls = () => apiSpy.mock.calls.map(([c]) => c).filter((c) => c.url.startsWith('/v1/awards/past'));
const paramsOf = (url) => Object.fromEntries(new URL(url, 'http://x.test').searchParams);

function renderPage({ loggedIn = false } = {}) {
  if (loggedIn) localStorage.setItem('token', makeToken('user-listener-001'));
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PlayerContext.Provider value={{ requestPlay }}>
        <VoteAwards />
      </PlayerContext.Provider>
    </MemoryRouter>
  );
  return { user };
}

async function renderLoaded(options = {}) {
  const utils = renderPage(options);
  await waitFor(() => expect(screen.queryByText(/loading nominees/i)).not.toBeInTheDocument());
  return utils;
}

const selects = () => screen.getAllByRole('combobox');
const [genreSelect, typeSelect, intervalSelect, jurisdictionSelect] =
  [0, 1, 2, 3].map((i) => () => selects()[i]);

// The headline breaks onto a second line with a <br>, so there is no space
// in the text between the period and "in".
const expectHeadline = (text) => {
  const [poll, place] = text.split(' in ');
  const h1 = screen.getByRole('heading', { level: 1 });
  expect(h1).toHaveTextContent(poll);
  expect(h1).toHaveTextContent(new RegExp(`in ${place}$`));
};

const cardOf = (name) => screen.getByRole('heading', { level: 3, name }).closest('.va-card');
const lastStandingsArgs = () => fetchStandings.mock.calls.at(-1)[0];

beforeEach(() => {
  vi.clearAllMocks();
  pastAwards = [];
  fetchStandings.mockResolvedValue(board(ARTISTS));
  playEntry.mockResolvedValue(true);
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    if (config.url.startsWith('/v1/awards/past')) return { data: pastAwards };
    throw new Error(`Unexpected request: ${config.method} ${config.url}`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
describe('VoteAwards — first render', () => {
  it('renders inside Layout with the four filters and the search toggle', async () => {
    await renderLoaded();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(selects()).toHaveLength(4);
    expect(screen.getByRole('button', { name: /toggle search/i })).toBeInTheDocument();
  });

  it('defaults to Rap, Artist, Day, Harlem', async () => {
    await renderLoaded();
    expect(genreSelect()).toHaveValue('rap');
    expect(typeSelect()).toHaveValue('artist');
    expect(intervalSelect()).toHaveValue('daily');
    expect(jurisdictionSelect()).toHaveValue('harlem');
  });

  it('shows the active poll headline for the default scope', async () => {
    await renderLoaded();
    expect(screen.getByText('Active poll')).toBeInTheDocument();
    expectHeadline('Rap Artist of the Day in Harlem');
  });

  it('shows the LIVE badge and a HH:MM:SS countdown', async () => {
    await renderLoaded();
    expect(screen.getByText('LIVE')).toBeInTheDocument();
    expect(document.querySelector('.va-countdown-time').textContent).toMatch(/\d{2}:\d{2}:\d{2}$/);
  });

  it('adds a day count to the countdown for longer polls', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-03-10T15:00:00Z')); // months left in the year
    const { user } = await renderLoaded();
    await user.selectOptions(intervalSelect(), 'annual');
    expect(document.querySelector('.va-countdown-days')).toHaveTextContent(/^\d+D/);
  });
});

// ===========================================================================
describe('VoteAwards — headline follows the filters', () => {
  it.each([
    [2, 'monthly', 'Rap Artist of the Month in Harlem'],
    [1, 'song', 'Rap Song of the Day in Harlem'],
    [0, 'rock', 'Rock Artist of the Day in Harlem'],
    [3, 'uptown-harlem', 'Rap Artist of the Day in Uptown Harlem'],
  ])('filter %i → %s', async (index, value, headline) => {
    const { user } = await renderLoaded();
    await user.selectOptions(selects()[index], value);
    expectHeadline(headline);
  });
});

// ===========================================================================
describe('VoteAwards — nominee request', () => {
  it('asks for the default scope, 48 at a time', async () => {
    await renderLoaded();
    expect(lastStandingsArgs()).toEqual({
      type: 'artist',
      jurisdictionId: HARLEM_ID,
      genre: 'rap',
      period: 'daily',
      limit: 48,
      offset: 0,
    });
  });

  it.each([
    [0, 'rock', { genre: 'rock' }],
    [0, 'pop', { genre: 'pop' }],
    [1, 'song', { type: 'song' }],
    [2, 'weekly', { period: 'weekly' }],
    [2, 'annual', { period: 'annual' }],
    [3, 'uptown-harlem', { jurisdictionId: UPTOWN_ID }],
    [3, 'downtown-harlem', { jurisdictionId: DOWNTOWN_ID }],
  ])('filter %i = %s is sent', async (index, value, expected) => {
    const { user } = await renderLoaded();
    await user.selectOptions(selects()[index], value);
    await waitFor(() => expect(lastStandingsArgs()).toMatchObject(expected));
  });

  it('every filter change loads a fresh board', async () => {
    const { user } = await renderLoaded();
    const before = fetchStandings.mock.calls.length;
    await user.selectOptions(genreSelect(), 'rock');
    await user.selectOptions(intervalSelect(), 'weekly');
    await waitFor(() => expect(fetchStandings.mock.calls.length).toBe(before + 2));
  });

  it('guests get nominees too', async () => {
    await renderLoaded();
    expect(fetchStandings).toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 3, name: 'Tony Fadd' })).toBeInTheDocument();
  });
});

// ===========================================================================
describe('VoteAwards — loading, error and empty states', () => {
  it('shows "Loading nominees..." while the board is in flight', async () => {
    let finish;
    fetchStandings.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderPage();
    expect(screen.getByText(/loading nominees/i)).toBeInTheDocument();
    finish(board(ARTISTS));
    expect(await screen.findByRole('heading', { level: 3, name: 'Tony Fadd' })).toBeInTheDocument();
  });

  it('shows an error when the board cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchStandings.mockRejectedValue(new Error('down'));
    renderPage();
    expect(await screen.findByText(/failed to load nominees\. please try again/i)).toBeInTheDocument();
    expect(document.querySelector('.va-grid')).toBeNull();
  });

  it('says there is nobody in this scope yet when the board is empty', async () => {
    fetchStandings.mockResolvedValue(board([]));
    await renderLoaded();
    expect(document.querySelector('.va-no-nominees')).toHaveTextContent('No Rap artists in Harlem yet.');
  });

  it('with nobody to vote for, the winner card does not ask for votes', async () => {
    fetchStandings.mockResolvedValue(board([]));
    await renderLoaded();
    await waitFor(() =>
      expect(document.querySelector('.va-last-winner-empty')).toHaveTextContent('No Rap artists in Harlem yet.'));
  });
});

// ===========================================================================
describe('VoteAwards — status line', () => {
  it('a live board says "Live today"', async () => {
    await renderLoaded();
    const status = document.querySelector('.va-board-status');
    expect(status).toHaveTextContent('Live today.');
    expect(status).not.toHaveTextContent(/nominees are in that order/i);
  });

  it('before anyone scores, it explains the order comes from the last period', async () => {
    fetchStandings.mockResolvedValue(board(ARTISTS, { state: 'PREVIOUS_FINAL' }));
    await renderLoaded();
    const status = document.querySelector('.va-board-status');
    expect(status).toHaveTextContent("Yesterday's final.");
    expect(status).toHaveTextContent('Nominees are in that order until then.');
  });

  it('labels points for the period they belong to', async () => {
    await renderLoaded();
    expect(within(cardOf('Tony Fadd')).getByText('Points today')).toBeInTheDocument();
  });

  it('labels points as the last period\'s when the board is not live', async () => {
    fetchStandings.mockResolvedValue(board(ARTISTS, { state: 'PREVIOUS_FINAL' }));
    await renderLoaded();
    expect(within(cardOf('Tony Fadd')).getByText('Points yesterday')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('VoteAwards — nominee cards', () => {
  it('shows name, home jurisdiction and points', async () => {
    await renderLoaded();
    const card = cardOf('Tony Fadd');
    expect(card.querySelector('.va-card-jurisdiction')).toHaveTextContent('Uptown Harlem');
    expect(card.querySelector('.va-stat-value')).toHaveTextContent('1,200');
  });

  it('shows the rank and how far the nominee moved', async () => {
    await renderLoaded();
    const card = cardOf('Tony Fadd');
    expect(within(card).getByLabelText('Ranked 1')).toHaveTextContent('#1');
    expect(within(card).getByLabelText('Up 1 place')).toBeInTheDocument();
  });

  it('marks a nominee who did not chart last period as New', async () => {
    await renderLoaded();
    expect(within(cardOf('SD Boomin')).getByText('New')).toBeInTheDocument();
  });

  it('gives no rank to a nominee with no points', async () => {
    await renderLoaded();
    expect(cardOf('Harlem MC').querySelector('.va-card-rank')).toBeNull();
  });

  it('shows the vote badge with singular and plural wording', async () => {
    await renderLoaded();
    expect(cardOf('Tony Fadd').querySelector('.va-stat-badge')).toHaveTextContent('7 votes');
    expect(cardOf('SD Boomin').querySelector('.va-stat-badge')).toHaveTextContent('1 vote');
  });

  it('hides the vote badge when there are no votes', async () => {
    await renderLoaded();
    expect(cardOf('Harlem MC').querySelector('.va-stat-badge')).toBeNull();
  });

  it('uses the placeholder image when a nominee has no artwork', async () => {
    await renderLoaded();
    expect(cardOf('SD Boomin').querySelector('.va-card-image').style.backgroundImage).toContain('randomrapper.jpeg');
    expect(cardOf('Tony Fadd').querySelector('.va-card-image').style.backgroundImage).toContain('cdn.test/tony.jpg');
  });

  it('artists get Listen and Vote', async () => {
    await renderLoaded();
    const card = within(cardOf('Tony Fadd'));
    expect(card.getByRole('button', { name: 'Listen' })).toBeInTheDocument();
    expect(card.getByRole('button', { name: 'Vote' })).toBeInTheDocument();
  });

  it('song cards show "by Artist", falling back to Unknown Artist', async () => {
    fetchStandings.mockResolvedValue(board(SONGS));
    const { user } = await renderLoaded();
    await user.selectOptions(typeSelect(), 'song');
    await waitFor(() => expect(cardOf('Midnight Uptown').querySelector('.va-card-artist')).toHaveTextContent('by Tony Fadd'));
    expect(cardOf('No File Yet').querySelector('.va-card-artist')).toHaveTextContent('by Unknown Artist');
  });

  it('a song only gets Listen when it has a file', async () => {
    fetchStandings.mockResolvedValue(board(SONGS));
    await renderLoaded();
    expect(within(cardOf('Midnight Uptown')).getByRole('button', { name: 'Listen' })).toBeInTheDocument();
    expect(within(cardOf('No File Yet')).queryByRole('button', { name: 'Listen' })).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('VoteAwards — show more nominees', () => {
  it('is hidden when the whole board is already showing', async () => {
    await renderLoaded();
    expect(screen.queryByRole('button', { name: /show more nominees/i })).not.toBeInTheDocument();
  });

  it('says how many more there are', async () => {
    fetchStandings.mockResolvedValue(board(ARTISTS, { total: 10 }));
    await renderLoaded();
    expect(screen.getByRole('button', { name: 'Show more nominees (7 more)' })).toBeInTheDocument();
  });

  it('loads the next page from where the list ends and skips repeats', async () => {
    fetchStandings.mockResolvedValue(board(ARTISTS, { total: 5 }));
    const { user } = await renderLoaded();

    fetchStandings.mockResolvedValue(board([
      ARTISTS[2], // a repeat
      entry({ id: 'artist-04', rank: 4, name: 'Fourth Act', points: 3 }),
      entry({ id: 'artist-05', rank: 5, name: 'Fifth Act', points: 1 }),
    ], { total: 5 }));
    await user.click(screen.getByRole('button', { name: /show more nominees/i }));

    expect(await screen.findByRole('heading', { level: 3, name: 'Fifth Act' })).toBeInTheDocument();
    expect(lastStandingsArgs()).toMatchObject({ limit: 48, offset: 3 });
    expect(screen.getAllByRole('heading', { level: 3, name: 'Harlem MC' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /show more nominees/i })).not.toBeInTheDocument();
  });

  it('a failed page leaves the nominees already shown', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchStandings.mockResolvedValue(board(ARTISTS, { total: 10 }));
    const { user } = await renderLoaded();

    fetchStandings.mockRejectedValue(new Error('down'));
    await user.click(screen.getByRole('button', { name: /show more nominees/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /show more nominees/i })).toBeEnabled());
    expect(screen.getByRole('heading', { level: 3, name: 'Tony Fadd' })).toBeInTheDocument();
  });
});

// ===========================================================================
describe('VoteAwards — search', () => {
  const openSearch = (user) => user.click(screen.getByRole('button', { name: /toggle search/i }));

  it('is hidden until the toggle is pressed, then focused', async () => {
    const { user } = await renderLoaded();
    expect(screen.queryByPlaceholderText(/search artists/i)).not.toBeInTheDocument();
    await openSearch(user);
    expect(screen.getByPlaceholderText(/search artists/i)).toHaveFocus();
  });

  it('filters nominees as the user types, ignoring case', async () => {
    const { user } = await renderLoaded();
    await openSearch(user);
    await user.type(screen.getByPlaceholderText(/search artists/i), 'tONY');
    expect(screen.getByRole('heading', { level: 3, name: 'Tony Fadd' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'SD Boomin' })).not.toBeInTheDocument();
  });

  it('says when nothing matches', async () => {
    const { user } = await renderLoaded();
    await openSearch(user);
    await user.type(screen.getByPlaceholderText(/search artists/i), 'zzz');
    expect(screen.getByText('No nominees match your search.')).toBeInTheDocument();
  });

  it('closing search clears the query and brings everyone back', async () => {
    const { user } = await renderLoaded();
    await openSearch(user);
    await user.type(screen.getByPlaceholderText(/search artists/i), 'tony');
    await openSearch(user);

    expect(screen.queryByPlaceholderText(/search artists/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'SD Boomin' })).toBeInTheDocument();
  });

  it('the placeholder follows the type filter', async () => {
    fetchStandings.mockResolvedValue(board(SONGS));
    const { user } = await renderLoaded();
    await user.selectOptions(typeSelect(), 'song');
    await openSearch(user);
    expect(screen.getByPlaceholderText(/search songs/i)).toBeInTheDocument();
  });
});

// ===========================================================================
describe('VoteAwards — listening', () => {
  it('Listen on an artist plays their featured song through playEntry', async () => {
    const { user } = await renderLoaded();
    await user.click(within(cardOf('Tony Fadd')).getByRole('button', { name: 'Listen' }));
    expect(playEntry).toHaveBeenCalledWith(
      { type: 'artist', id: 'artist-01', name: 'Tony Fadd', artwork: 'https://cdn.test/tony.jpg' },
      requestPlay,
      'voteawards'
    );
    expect(feedback.info).not.toHaveBeenCalled();
  });

  it('tells the user when the artist has no featured song', async () => {
    playEntry.mockResolvedValue(false);
    const { user } = await renderLoaded();
    await user.click(within(cardOf('SD Boomin')).getByRole('button', { name: 'Listen' }));
    await waitFor(() =>
      expect(feedback.info).toHaveBeenCalledWith('SD Boomin hasn’t picked a song to feature yet'));
  });

  it('Listen on a song plays its own file', async () => {
    fetchStandings.mockResolvedValue(board(SONGS));
    const { user } = await renderLoaded();
    await user.click(within(cardOf('Midnight Uptown')).getByRole('button', { name: 'Listen' }));
    expect(playEntry).toHaveBeenCalledWith(
      {
        type: 'song',
        id: 'song-01',
        name: 'Midnight Uptown',
        artistName: 'Tony Fadd',
        artistId: 'artist-01',
        fileUrl: 'https://cdn.test/s1.mp3',
        artwork: 'https://cdn.test/s1.jpg',
      },
      requestPlay,
      'voteawards'
    );
  });

  it('the page records no play and no ad view of its own', async () => {
    const { user } = await renderLoaded();
    await user.click(within(cardOf('Tony Fadd')).getByRole('button', { name: 'Listen' }));
    const others = apiSpy.mock.calls.map(([c]) => c).filter((c) => !c.url.startsWith('/v1/awards/past'));
    expect(others).toHaveLength(0);
  });
});

// ===========================================================================
describe('VoteAwards — voting', () => {
  it('a guest pressing Vote is asked to log in and the wizard stays closed', async () => {
    const { user } = await renderLoaded();
    await user.click(within(cardOf('Tony Fadd')).getByRole('button', { name: 'Vote' }));

    expect(screen.queryByTestId('voting-wizard')).not.toBeInTheDocument();
    expect(feedback.info).toHaveBeenCalledWith(
      'Sign up or log in to vote',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Log in' }) })
    );
    feedback.info.mock.calls[0][1].action.onClick();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('a signed-in user pressing Vote opens the wizard for that nominee', async () => {
    const { user } = await renderLoaded({ loggedIn: true });
    await user.click(within(cardOf('SD Boomin')).getByRole('button', { name: 'Vote' }));

    expect(screen.getByTestId('vw-nominee-id')).toHaveTextContent('artist-02');
    expect(screen.getByTestId('vw-nominee-name')).toHaveTextContent('SD Boomin');
    expect(screen.getByTestId('vw-user')).toHaveTextContent('user-listener-001');
    expect(feedback.info).not.toHaveBeenCalled();
  });

  it('passes the current filters to the wizard', async () => {
    const { user } = await renderLoaded({ loggedIn: true });
    await user.selectOptions(genreSelect(), 'pop');
    await user.selectOptions(intervalSelect(), 'weekly');
    await user.selectOptions(jurisdictionSelect(), 'uptown-harlem');
    await waitFor(() => expect(lastStandingsArgs()).toMatchObject({ jurisdictionId: UPTOWN_ID }));

    await user.click(within(cardOf('Tony Fadd')).getByRole('button', { name: 'Vote' }));
    expect(JSON.parse(screen.getByTestId('vw-filters').textContent)).toEqual({
      selectedGenre: 'pop',
      selectedType: 'artist',
      selectedInterval: 'weekly',
      selectedJurisdiction: 'uptown-harlem',
    });
  });

  it('closing the wizard hides it', async () => {
    const { user } = await renderLoaded({ loggedIn: true });
    await user.click(within(cardOf('Tony Fadd')).getByRole('button', { name: 'Vote' }));
    await user.click(screen.getByRole('button', { name: 'vw-close' }));
    expect(screen.queryByTestId('voting-wizard')).not.toBeInTheDocument();
  });

  it('a successful vote closes the wizard and reloads the nominees', async () => {
    const { user } = await renderLoaded({ loggedIn: true });
    const before = fetchStandings.mock.calls.length;
    await user.click(within(cardOf('Tony Fadd')).getByRole('button', { name: 'Vote' }));
    await user.click(screen.getByRole('button', { name: 'vw-confirm' }));

    await waitFor(() => expect(screen.queryByTestId('voting-wizard')).not.toBeInTheDocument());
    await waitFor(() => expect(fetchStandings.mock.calls.length).toBe(before + 1));
  });

  it('a malformed token is treated as signed out', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('token', 'not-a-jwt');
    const { user } = await renderLoaded();
    await user.click(within(cardOf('Tony Fadd')).getByRole('button', { name: 'Vote' }));
    expect(screen.queryByTestId('voting-wizard')).not.toBeInTheDocument();
    expect(feedback.info).toHaveBeenCalledWith('Sign up or log in to vote', expect.anything());
  });
});

// ===========================================================================
describe('VoteAwards — current winner card', () => {
  it('asks for past awards in the selected scope', async () => {
    await renderLoaded();
    await waitFor(() => expect(pastCalls().length).toBeGreaterThan(0));
    const params = paramsOf(pastCalls().at(-1).url);
    expect(params).toMatchObject({
      type: 'artist',
      jurisdictionId: HARLEM_ID,
      intervalId: DAILY_ID,
      genreId: RAP_ID,
    });
    expect(params.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each([
    ['daily', 30],
    ['weekly', 90],
    ['monthly', 400],
    ['quarterly', 500],
    ['annual', 800],
  ])('looks back %s polls over %i days, ending yesterday', async (interval, days) => {
    const { user } = await renderLoaded();
    if (interval !== 'daily') await user.selectOptions(intervalSelect(), interval);
    await waitFor(() => {
      const { startDate, endDate } = paramsOf(pastCalls().at(-1).url);
      const span = Math.round((new Date(endDate) - new Date(startDate)) / 86400000);
      expect(span).toBe(days);
    });
  });

  it('says the first winner is pending when there are no awards', async () => {
    await renderLoaded();
    await waitFor(() =>
      expect(document.querySelector('.va-last-winner-empty'))
        .toHaveTextContent('Vote to crown the first Artist of the Day.'));
    expect(screen.getByText('First winner pending')).toBeInTheDocument();
    expect(document.querySelector('.va-last-winner')).toHaveAttribute('role', 'status');
  });

  it('shows the newest award as the current winner', async () => {
    pastAwards = [
      { awardDate: '2026-11-10', artist: { userId: 'artist-09', username: 'Older Winner' } },
      { awardDate: '2026-11-14', artist: { userId: 'artist-01', username: 'Tony Fadd', photoUrl: 'https://cdn.test/tony.jpg' } },
    ];
    await renderLoaded();
    const card = await screen.findByRole('button', { name: /tony fadd/i });
    expect(within(card).getByText('Current')).toBeInTheDocument();
    expect(within(card).getByText('Won Nov 14, 2026')).toBeInTheDocument();
    expect(within(card).getByAltText('Tony Fadd winner artwork')).toHaveAttribute('src', 'https://cdn.test/tony.jpg');
    expect(screen.queryByText('Older Winner')).not.toBeInTheDocument();
  });

  it('ignores awards with no winner attached', async () => {
    pastAwards = [{ awardDate: '2026-11-14' }];
    await renderLoaded();
    await waitFor(() => expect(screen.getByText('First winner pending')).toBeInTheDocument());
  });

  it('clicking the winner opens the artist page', async () => {
    pastAwards = [{ awardDate: '2026-11-14', artist: { userId: 'artist-01', username: 'Tony Fadd' } }];
    const { user } = await renderLoaded();
    await user.click(await screen.findByRole('button', { name: /tony fadd/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-01');
  });

  it('Enter on the winner card opens it too', async () => {
    pastAwards = [{ awardDate: '2026-11-14', artist: { userId: 'artist-01', username: 'Tony Fadd' } }];
    await renderLoaded();
    fireEvent.keyDown(await screen.findByRole('button', { name: /tony fadd/i }), { key: 'Enter' });
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-01');
  });

  it('a song winner shows its artist and opens the song page', async () => {
    fetchStandings.mockResolvedValue(board(SONGS));
    pastAwards = [{
      awardDate: '2026-11-14',
      song: { songId: 'song-01', title: 'Midnight Uptown', artist: { username: 'Tony Fadd' } },
    }];
    const { user } = await renderLoaded();
    await user.selectOptions(typeSelect(), 'song');

    const card = await screen.findByRole('button', { name: /midnight uptown/i });
    expect(within(card).getByText('by Tony Fadd')).toBeInTheDocument();
    await user.click(card);
    expect(navigateSpy).toHaveBeenCalledWith('/song/song-01');
  });

  it('a failed winner lookup falls back to pending without breaking the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    apiSpy.mockRejectedValue(new Error('down'));
    await renderLoaded();
    await waitFor(() => expect(screen.getByText('First winner pending')).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 3, name: 'Tony Fadd' })).toBeInTheDocument();
  });
});

// ===========================================================================
describe('VoteAwards — card navigation', () => {
  it('clicking an artist card opens the artist page', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('heading', { level: 3, name: 'Tony Fadd' }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-01');
  });

  it('clicking the card image opens it too', async () => {
    const { user } = await renderLoaded();
    await user.click(cardOf('SD Boomin').querySelector('.va-card-image'));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-02');
  });

  it('clicking a song card opens the song page', async () => {
    fetchStandings.mockResolvedValue(board(SONGS));
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('heading', { level: 3, name: 'Midnight Uptown' }));
    expect(navigateSpy).toHaveBeenCalledWith('/song/song-01');
  });
});
