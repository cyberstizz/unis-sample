// src/leaderboardsPage.test.jsx
//
// Tests for LeaderboardsPage — the live standings board.
//
// The page reads its data through utils/standings.js (GET /v1/awards/standings,
// the same formula that decides awards). That module's own request and
// normalising logic is tested in utils/standings.test.js; here fetchStandings
// and playEntry are mocked at the module boundary and describeBoard stays real.
//
// Covers:
//   • first render: masthead, default scope, "Pick a scope" prompt
//   • the four segmented controls and the request each choice produces
//   • loading state, error state, nothing-scored state
//   • status line for a live board, a finished period, a period still closing
//   • leader plate: title, points, margin wording, leader word
//   • chase rows: rank, points, bar measured against the leader, movement
//   • entries with no points never reach the board
//   • Listen hands the entry to playEntry with source "leaderboards"
//   • no play-tracking request is ever made from this page
//   • open artist / open song navigation, and the full-chart link
//   • artwork fallback when an image is missing or fails to load

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));
vi.mock('./leaderboardsPage.scss', () => ({}));
vi.mock('./components/RankMove.scss', () => ({}));
vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));

const { navigateSpy, fetchStandings, playEntry } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  fetchStandings: vi.fn(),
  playEntry: vi.fn(),
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

import { PlayerContext } from './context/playercontext';
import * as axiosModule from './components/axiosInstance';
import LeaderboardsPage from './leaderboardsPage';

// ---------------------------------------------------------------------------
// FIXTURES — the shape utils/standings.normalizeBoard returns
// ---------------------------------------------------------------------------
const HARLEM_ID = '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3';
const UPTOWN_ID = '52740de0-e4e9-4c9e-b68e-1e170f6788c4';
const DOWNTOWN_ID = '4b09eaa2-03bc-4778-b7c2-db8b42c9e732';

const entry = (overrides) => ({
  id: 'id-x', type: 'artist', rank: 1, name: 'Someone', artistName: '', artistId: null,
  artwork: null, fileUrl: null, points: 0, votes: 0, plays: 0, likes: 0,
  winner: false, movement: null, isNew: false,
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
  entry({ id: 'artist-01', rank: 1, name: 'Tony Fadd', points: 1200, artwork: 'https://cdn.test/tony.jpg' }),
  entry({ id: 'artist-02', rank: 2, name: 'SD Boomin', points: 900, artwork: 'https://cdn.test/boomin.jpg', movement: 2 }),
  entry({ id: 'artist-03', rank: 3, name: 'Harlem MC', points: 12, movement: -1 }),
];

const SONGS = [
  entry({ id: 'song-01', type: 'song', rank: 1, name: 'Midnight Uptown', artistName: 'Tony Fadd', artistId: 'artist-01', points: 55, artwork: 'https://cdn.test/s1.jpg', fileUrl: 'https://cdn.test/s1.mp3' }),
  entry({ id: 'song-02', type: 'song', rank: 2, name: 'Block Party', artistName: 'SD Boomin', artistId: 'artist-02', points: 40, artwork: 'https://cdn.test/s2.jpg', fileUrl: 'https://cdn.test/s2.mp3', isNew: true }),
];

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const requestPlay = vi.fn();

function renderPage() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PlayerContext.Provider value={{ requestPlay }}>
        <LeaderboardsPage />
      </PlayerContext.Provider>
    </MemoryRouter>
  );
  return { user };
}

const seg = (name, value) => screen.getByTestId(`${name}-${value}`);
const show = (user) => user.click(screen.getByRole('button', { name: /show standings/i }));

async function renderAndShow(result = board(ARTISTS)) {
  fetchStandings.mockResolvedValue(result);
  const utils = renderPage();
  await show(utils.user);
  await waitFor(() => expect(screen.getByRole('button', { name: /show standings/i })).toBeEnabled());
  return utils;
}

const leaderPlate = () => screen.getByRole('region', { name: /current leader/i });
const chaseRows = () => within(screen.getByRole('region', { name: /the chase/i })).getAllByRole('listitem');

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
describe('LeaderboardsPage — first render', () => {
  it('renders inside Layout with the masthead', () => {
    renderPage();
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Leaderboards' })).toBeInTheDocument();
    expect(screen.getByText(/who's ahead right now/i)).toBeInTheDocument();
  });

  it('asks the user to pick a scope and loads nothing on its own', () => {
    renderPage();
    expect(screen.getByText('Pick a scope')).toBeInTheDocument();
    expect(fetchStandings).not.toHaveBeenCalled();
  });

  it('defaults to Downtown, Rap, Artist, Today', () => {
    renderPage();
    [['jurisdiction', 'downtown-harlem'], ['genre', 'rap'], ['category', 'artist'], ['interval', 'daily']]
      .forEach(([name, value]) => {
        expect(seg(name, value)).toHaveAttribute('aria-pressed', 'true');
        expect(seg(name, value)).toHaveClass('is-active');
      });
  });

  it('labels each control group for screen readers', () => {
    renderPage();
    ['Jurisdiction', 'Genre', 'Category', 'Time period'].forEach((label) => {
      expect(screen.getByRole('group', { name: label })).toBeInTheDocument();
    });
  });

  it('every control is type="button"', () => {
    renderPage();
    screen.getAllByRole('button').forEach((btn) => expect(btn).toHaveAttribute('type', 'button'));
  });
});

// ===========================================================================
describe('LeaderboardsPage — controls and the request', () => {
  it('only one option per group is pressed at a time', async () => {
    const { user } = renderPage();
    await user.click(seg('genre', 'rock'));
    expect(seg('genre', 'rock')).toHaveAttribute('aria-pressed', 'true');
    expect(seg('genre', 'rap')).toHaveAttribute('aria-pressed', 'false');
    expect(seg('genre', 'pop')).toHaveAttribute('aria-pressed', 'false');
  });

  it('changing a control does not fetch until Show standings is pressed', async () => {
    const { user } = renderPage();
    await user.click(seg('genre', 'pop'));
    await user.click(seg('interval', 'monthly'));
    expect(fetchStandings).not.toHaveBeenCalled();
  });

  it('asks for the default scope', async () => {
    await renderAndShow();
    expect(fetchStandings).toHaveBeenCalledTimes(1);
    expect(fetchStandings).toHaveBeenCalledWith({
      type: 'artist',
      jurisdictionId: DOWNTOWN_ID,
      genre: 'rap',
      period: 'daily',
      limit: 50,
    });
  });

  it.each([
    ['uptown-harlem', UPTOWN_ID],
    ['harlem', HARLEM_ID],
    ['downtown-harlem', DOWNTOWN_ID],
  ])('jurisdiction %s sends its own id', async (value, id) => {
    fetchStandings.mockResolvedValue(board(ARTISTS));
    const { user } = renderPage();
    await user.click(seg('jurisdiction', value));
    await show(user);
    expect(fetchStandings).toHaveBeenCalledWith(expect.objectContaining({ jurisdictionId: id }));
  });

  it.each(['rap', 'rock', 'pop'])('genre %s is sent as chosen', async (genre) => {
    fetchStandings.mockResolvedValue(board(ARTISTS));
    const { user } = renderPage();
    await user.click(seg('genre', genre));
    await show(user);
    expect(fetchStandings).toHaveBeenCalledWith(expect.objectContaining({ genre }));
  });

  it.each(['daily', 'weekly', 'monthly', 'quarterly', 'midterm', 'annual'])(
    'period %s is sent as chosen', async (period) => {
      fetchStandings.mockResolvedValue(board(ARTISTS));
      const { user } = renderPage();
      await user.click(seg('interval', period));
      await show(user);
      expect(fetchStandings).toHaveBeenCalledWith(expect.objectContaining({ period }));
    });

  it('Song sends type "song"', async () => {
    fetchStandings.mockResolvedValue(board(SONGS));
    const { user } = renderPage();
    await user.click(seg('category', 'song'));
    await show(user);
    expect(fetchStandings).toHaveBeenCalledWith(expect.objectContaining({ type: 'song' }));
  });
});

// ===========================================================================
describe('LeaderboardsPage — loading, errors and empty boards', () => {
  it('shows a loading message and disables the button while fetching', async () => {
    let finish;
    fetchStandings.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user } = renderPage();
    await show(user);

    expect(screen.getByText(/counting the votes and plays/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading' })).toBeDisabled();

    finish(board(ARTISTS));
    expect(await screen.findByRole('heading', { level: 2, name: 'Tony Fadd' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show standings/i })).toBeEnabled();
  });

  it('tells the user when the standings cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchStandings.mockRejectedValue(new Error('Network Error'));
    const { user } = renderPage();
    await show(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn't load the standings/i);
    expect(console.error).toHaveBeenCalledWith('Leaderboards fetch error:', expect.any(Error));
    expect(screen.getByRole('button', { name: /show standings/i })).toBeEnabled();
  });

  it('says nothing has scored when the board is empty', async () => {
    await renderAndShow(board([]));
    expect(screen.getByRole('alert')).toHaveTextContent(/nothing has scored in this scope yet/i);
    expect(screen.queryByRole('region', { name: /current leader/i })).not.toBeInTheDocument();
  });

  it('treats a board where everyone has zero points as empty', async () => {
    await renderAndShow(board([
      entry({ id: 'a', name: 'Quiet One', points: 0 }),
      entry({ id: 'b', rank: 2, name: 'Quiet Two', points: 0 }),
    ]));
    expect(screen.getByRole('alert')).toHaveTextContent(/nothing has scored/i);
    expect(screen.queryByText('Quiet One')).not.toBeInTheDocument();
  });

  it('a new search clears the previous error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchStandings.mockRejectedValueOnce(new Error('down'));
    const { user } = renderPage();
    await show(user);
    await screen.findByRole('alert');

    fetchStandings.mockResolvedValue(board(ARTISTS));
    await show(user);
    expect(await screen.findByRole('heading', { level: 2, name: 'Tony Fadd' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('LeaderboardsPage — status line', () => {
  it('a live board says "Live today"', async () => {
    await renderAndShow(board(ARTISTS));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Live today.');
    expect(status).toHaveClass('lb-status--live');
  });

  it('a board showing the finished period says so', async () => {
    await renderAndShow(board(ARTISTS, { state: 'PREVIOUS_FINAL', periodKey: 'weekly' }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent("Last week's final.");
    expect(status).toHaveTextContent(/new week starts with the first play, like or vote/i);
    expect(status).toHaveClass('lb-status--final');
  });

  it('a period still open in another timezone says where', async () => {
    await renderAndShow(board(ARTISTS, {
      state: 'PREVIOUS_CLOSING',
      stillOpenIn: ['America/Los_Angeles'],
    }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Yesterday, still open in Pacific time.');
    expect(status).toHaveClass('lb-status--closing');
  });

  it('the status line still shows above an empty board', async () => {
    await renderAndShow(board([], { state: 'PREVIOUS_FINAL' }));
    expect(screen.getByRole('status')).toHaveTextContent("Yesterday's final.");
  });
});

// ===========================================================================
describe('LeaderboardsPage — leader plate', () => {
  it('shows the leader, the scope and the points', async () => {
    await renderAndShow();
    const plate = leaderPlate();
    expect(within(plate).getByRole('heading', { level: 2, name: 'Tony Fadd' })).toBeInTheDocument();
    expect(plate.querySelector('.lb-leader-eyebrow')).toHaveTextContent('Leading · Downtown · Rap');
    expect(plate.querySelector('.lb-leader-figure')).toHaveTextContent('1,200');
  });

  it('gives the lead over second place', async () => {
    await renderAndShow();
    expect(leaderPlate().querySelector('.lb-leader-margin')).toHaveTextContent('Ahead by 300 points');
  });

  it('says "point" for a one-point lead', async () => {
    await renderAndShow(board([
      entry({ id: 'a', name: 'First', points: 11 }),
      entry({ id: 'b', rank: 2, name: 'Second', points: 10 }),
    ]));
    expect(leaderPlate().querySelector('.lb-leader-margin')).toHaveTextContent('Ahead by 1 point');
  });

  it('names the runner-up when the points are tied', async () => {
    await renderAndShow(board([
      entry({ id: 'a', name: 'First', points: 10 }),
      entry({ id: 'b', rank: 2, name: 'Second', points: 10 }),
    ]));
    expect(leaderPlate().querySelector('.lb-leader-margin'))
      .toHaveTextContent('Tied with Second, ahead on the tiebreak');
  });

  it('says "Uncontested so far" when nobody else has scored', async () => {
    await renderAndShow(board([ARTISTS[0]]));
    expect(leaderPlate().querySelector('.lb-leader-margin')).toHaveTextContent('Uncontested so far');
    expect(screen.queryByRole('region', { name: /the chase/i })).not.toBeInTheDocument();
  });

  it('a finished period reads "Won" and "Finished by" for the award winner', async () => {
    await renderAndShow(board(
      [{ ...ARTISTS[0], winner: true }, ARTISTS[1]],
      { state: 'PREVIOUS_FINAL' }
    ));
    const plate = leaderPlate();
    expect(plate.querySelector('.lb-leader-eyebrow')).toHaveTextContent(/^Won ·/);
    expect(plate.querySelector('.lb-leader-margin')).toHaveTextContent('Finished by 300 points');
  });

  it('a finished period without an award reads "Finished first"', async () => {
    await renderAndShow(board([ARTISTS[0]], { state: 'PREVIOUS_FINAL' }));
    const plate = leaderPlate();
    expect(plate.querySelector('.lb-leader-eyebrow')).toHaveTextContent(/^Finished first ·/);
    expect(plate.querySelector('.lb-leader-margin')).toHaveTextContent(/^Uncontested$/);
  });

  it('a period still closing reads "Leading, still counting"', async () => {
    await renderAndShow(board(ARTISTS, { state: 'PREVIOUS_CLOSING' }));
    expect(leaderPlate().querySelector('.lb-leader-eyebrow')).toHaveTextContent(/^Leading, still counting ·/);
  });

  it('a song leader shows its artist and "View song"', async () => {
    await renderAndShow(board(SONGS));
    const plate = leaderPlate();
    expect(plate.querySelector('.lb-leader-artist')).toHaveTextContent('Tony Fadd');
    expect(within(plate).getByRole('button', { name: 'View song' })).toBeInTheDocument();
    expect(within(plate).getByAltText('Midnight Uptown artwork')).toBeInTheDocument();
  });

  it('an artist leader shows "View artist" and no artist line', async () => {
    await renderAndShow();
    const plate = leaderPlate();
    expect(plate.querySelector('.lb-leader-artist')).toBeNull();
    expect(within(plate).getByRole('button', { name: 'View artist' })).toBeInTheDocument();
    expect(within(plate).getByAltText('Tony Fadd photo')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('LeaderboardsPage — the chase', () => {
  it('lists everyone after the leader, in order', async () => {
    await renderAndShow();
    const rows = chaseRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.lb-chase-title')).toHaveTextContent('SD Boomin');
    expect(rows[1].querySelector('.lb-chase-title')).toHaveTextContent('Harlem MC');
  });

  it('shows each row\'s rank and points', async () => {
    await renderAndShow();
    const [second] = chaseRows();
    expect(second.querySelector('.lb-chase-rank')).toHaveTextContent('2');
    expect(second.querySelector('.lb-chase-points')).toHaveTextContent('900pts');
  });

  it('measures each bar against the leader, never under 2%', async () => {
    await renderAndShow();
    const [second, third] = chaseRows();
    expect(second.querySelector('.lb-chase-fill')).toHaveStyle({ width: '75%' }); // 900 / 1200
    expect(third.querySelector('.lb-chase-fill')).toHaveStyle({ width: '2%' });   // 12 / 1200 → floor of 2
  });

  it('shows how far a row moved since the last period', async () => {
    await renderAndShow();
    const [second, third] = chaseRows();
    expect(within(second).getByLabelText('Up 2 places')).toBeInTheDocument();
    expect(within(third).getByLabelText('Down 1 place')).toBeInTheDocument();
  });

  it('marks an entry that did not chart last period as New', async () => {
    await renderAndShow(board(SONGS));
    expect(within(chaseRows()[0]).getByText('New')).toBeInTheDocument();
  });

  it('song rows show the artist; artist rows do not repeat the name', async () => {
    await renderAndShow(board(SONGS));
    expect(chaseRows()[0].querySelector('.lb-chase-artist')).toHaveTextContent('SD Boomin');
  });

  it('artist rows have no artist line', async () => {
    await renderAndShow();
    expect(chaseRows()[0].querySelector('.lb-chase-artist')).toBeNull();
  });

  it('leaves entries with no points off the board', async () => {
    await renderAndShow(board([
      ...ARTISTS,
      entry({ id: 'artist-04', rank: 4, name: 'No Score Yet', points: 0 }),
    ]));
    expect(chaseRows()).toHaveLength(2);
    expect(screen.queryByText('No Score Yet')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('LeaderboardsPage — artwork', () => {
  it('uses the placeholder when an entry has no artwork', async () => {
    await renderAndShow();
    expect(chaseRows()[1].querySelector('img')).toHaveAttribute('src', 'randomrapper.jpeg');
  });

  it('swaps in the placeholder when the leader image fails to load', async () => {
    await renderAndShow();
    const img = within(leaderPlate()).getByAltText('Tony Fadd photo');
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', 'randomrapper.jpeg');
  });

  it('swaps in the placeholder when a chase image fails to load', async () => {
    await renderAndShow();
    const img = chaseRows()[0].querySelector('img');
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', 'randomrapper.jpeg');
  });
});

// ===========================================================================
describe('LeaderboardsPage — listening', () => {
  it('Listen on a song hands it to playEntry with source "leaderboards"', async () => {
    const { user } = await renderAndShow(board(SONGS));
    await user.click(within(leaderPlate()).getByRole('button', { name: 'Listen' }));

    expect(playEntry).toHaveBeenCalledTimes(1);
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
      'leaderboards'
    );
  });

  it('Listen on an artist passes the artist so their default song can be found', async () => {
    const { user } = await renderAndShow();
    await user.click(within(leaderPlate()).getByRole('button', { name: 'Listen' }));
    expect(playEntry).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'artist', id: 'artist-01', name: 'Tony Fadd', artistName: 'Tony Fadd' }),
      requestPlay,
      'leaderboards'
    );
  });

  it('a chase row\'s play button plays that row', async () => {
    const { user } = await renderAndShow(board(SONGS));
    await user.click(screen.getByRole('button', { name: 'Listen to Block Party' }));
    expect(playEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'song-02', fileUrl: 'https://cdn.test/s2.mp3' }),
      requestPlay,
      'leaderboards'
    );
  });

  it('never passes the placeholder image on as artwork', async () => {
    const { user } = await renderAndShow();
    await user.click(screen.getByRole('button', { name: 'Listen to Harlem MC' }));
    expect(playEntry.mock.calls[0][0].artwork).toBeNull();
  });

  it('makes no request of its own when Listen is pressed (the Player counts plays)', async () => {
    const apiSpy = vi.spyOn(axiosModule, 'apiCall');
    const { user } = await renderAndShow(board(SONGS));
    await user.click(within(leaderPlate()).getByRole('button', { name: 'Listen' }));
    await user.click(screen.getByRole('button', { name: 'Listen to Block Party' }));
    expect(apiSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('LeaderboardsPage — navigation', () => {
  it('View artist opens the artist page', async () => {
    const { user } = await renderAndShow();
    await user.click(screen.getByRole('button', { name: 'View artist' }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-01');
  });

  it('View song opens the song page', async () => {
    const { user } = await renderAndShow(board(SONGS));
    await user.click(screen.getByRole('button', { name: 'View song' }));
    expect(navigateSpy).toHaveBeenCalledWith('/song/song-01');
  });

  it('a chase row opens its own page', async () => {
    const { user } = await renderAndShow();
    await user.click(screen.getByRole('button', { name: 'Open SD Boomin' }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-02');
  });

  it('a song chase row opens the song page', async () => {
    const { user } = await renderAndShow(board(SONGS));
    await user.click(screen.getByRole('button', { name: 'Open Block Party' }));
    expect(navigateSpy).toHaveBeenCalledWith('/song/song-02');
  });

  it('"See the full chart" carries the scope to the charts page', async () => {
    const { user } = await renderAndShow();
    await user.click(screen.getByRole('button', { name: /see the full chart/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/charts?type=artist&period=daily&genre=rap&place=downtown-harlem');
  });

  it('the full-chart link uses the period the board is actually showing', async () => {
    // Asked for today; nobody has scored yet, so the board shows last week's final.
    const { user } = await renderAndShow(board(ARTISTS, { state: 'PREVIOUS_FINAL', periodKey: 'weekly' }));
    await user.click(screen.getByRole('button', { name: /see the full chart/i }));
    expect(navigateSpy).toHaveBeenCalledWith(expect.stringContaining('period=weekly'));
  });
});
