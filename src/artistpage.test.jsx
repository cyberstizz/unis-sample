// src/artistpage.test.jsx
//
// Tests for ArtistPage — an artist's public page (and the artist's own view),
// v4 redesign (Nov 2026): clear hero photo, one action row (Follow · Vote ·
// Support · Message · Share · Shuffle · Play), Music / Photos / About tabs,
// Play and Shuffle use the whole catalog, awards on a shelf, Standing with
// Week | Day, and a ⋮ menu on every song row.
//
// The signed-in user comes from a stubbed useAuth, so each test states exactly
// who is looking. apiCall is spied; Layout, VotingWizard, MessageButton,
// DownloadModal, SongMenu, AdSlot and the sign-up gate are stubbed — each has,
// or will have, its own suite.
//
// The bar that follows you on scroll is not tested here: whether it shows
// depends on real layout measurements, which jsdom does not have. Queries are
// scoped to the main action row so the bar's copies of Vote / Follow / Play
// never get in the way.
//
// Covers:
//   • loading, not-found, and the requests the page makes
//   • a signed-in viewer asks whether they follow; a guest and the artist don't
//   • hero: name, area chip, rank chip, stats line, Back, Share
//   • the action row for a visitor, and for the artist on their own page
//   • follow / unfollow: optimistic count, request, toast, rollback, guest
//   • playing: Play all, Shuffle, a row, the Fans pick — the whole catalog,
//     most played first, through requestPlayCollection; the page never
//     records a play itself; a guest's plays count toward the sign-up prompt
//   • Popular list: order, plays, "See all" / "Show less", "No songs yet"
//   • the ⋮ menu on a song row
//   • Vote (action row and the phone vote card) opens the wizard
//   • Support: the sheet, first pick, a switch, already supporting, failure
//   • Buy songs: the shop sheet, prices, the download hand-off
//   • Standing: Week | Day, still calculating, the /standing fallback
//   • awards shelf and the photo strip
//   • Photos tab and the full-screen viewer
//   • About tab: stats, tags, bio, Connect links, the artist's bio editor

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./artistpage.scss', () => ({}));
vi.mock('./assets/theQuiet.jpg', () => ({ default: 'theQuiet.jpg' }));
vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));
vi.mock('./components/AdSlot', () => ({
  default: ({ placement }) => <div data-testid="ad-slot" data-placement={placement} />,
}));
vi.mock('./MessageButton', () => ({
  default: ({ recipientId, recipientName }) => (
    <button data-testid="message-button" data-recipient={recipientId}>{`Message ${recipientName}`}</button>
  ),
}));
vi.mock('./DownloadModal', () => ({
  default: ({ isOpen, song }) => (isOpen ? (
    <div data-testid="download-modal" data-policy={song.downloadPolicy} data-file={song.fileName}>{song.title}</div>
  ) : null),
}));
vi.mock('./votingWizard', () => ({
  default: (props) => (props.show ? (
    <div data-testid="voting-wizard">
      <span data-testid="vw-nominee">{JSON.stringify(props.nominee)}</span>
      <span data-testid="vw-filters">{JSON.stringify(props.filters)}</span>
      <button onClick={props.onClose}>vw-close</button>
      <button onClick={() => props.onVoteSuccess()}>vw-confirm</button>
    </div>
  ) : null),
}));

const {
  navigateSpy, authState, feedback, incrementGateSongCount, triggerGate, songMenu,
} = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  authState: { user: null, isGuest: true, refreshUser: vi.fn() },
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  incrementGateSongCount: vi.fn(),
  triggerGate: vi.fn(),
  songMenu: { props: null },
}));

vi.mock('./SongMenu', () => ({
  default: (props) => {
    songMenu.props = props;
    return (
      <div data-testid="song-menu" data-song={props.song.id}>
        <button onClick={() => props.onPlayNow(props.song)}>menu-play</button>
        <button onClick={props.onRequireAccount}>menu-needs-account</button>
        <button onClick={props.onClose}>menu-close</button>
      </div>
    );
  },
  KebabIcon: () => null,
  anchorFromEvent: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => ({ artistId: 'artist-1' }),
  useNavigate: () => navigateSpy,
}));
vi.mock('./context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));
vi.mock('./AuthGateSheet', () => ({
  default: () => null,
  incrementGateSongCount,
  useAuthGate: () => ({ triggerGate, gateProps: {} }),
}));

import { PlayerContext } from './context/playercontext';
import * as axiosModule from './components/axiosInstance';
import ArtistPage from './artistpage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ARTIST = {
  userId: 'artist-1',
  username: 'testartist',
  role: 'artist',
  bio: 'Original bio text',
  photoUrl: 'https://cdn.test/artist.jpg',
  totalPlays: 5000,
  score: 250,
  jurisdiction: { jurisdictionId: 'jur-harlem', name: 'Harlem' },
  genre: { genreId: 'genre-rap', name: 'Rap' },
  instagramUrl: 'https://instagram.com/testartist',
};

// The songs endpoint returns raw Song rows, whose play column is playCount.
const SONGS = [
  { songId: 's1', title: 'Second Track', score: 50, playCount: 500, artworkUrl: 'https://cdn.test/art1.jpg', fileUrl: 'https://cdn.test/s1.mp3' },
  { songId: 's2', title: 'Top Hit', score: 100, playCount: 1000, artworkUrl: 'https://cdn.test/art2.jpg', fileUrl: 'https://cdn.test/s2.mp3' },
];

const song = (n, extra = {}) => ({
  songId: `s${n}`, title: `Song ${n}`, score: n, playCount: n * 10,
  artworkUrl: `https://cdn.test/a${n}.jpg`, fileUrl: `https://cdn.test/s${n}.mp3`, ...extra,
});

const LISTENER = { userId: 'listener-1', username: 'fan', supportedArtistId: null };
const ARTIST_SELF = { userId: 'artist-1', username: 'testartist', role: 'artist' };

let apiSpy;
let backend;
let player;

const signInAs = (user) => {
  authState.user = user;
  authState.isGuest = !user;
};

const calls = (method, url) =>
  apiSpy.mock.calls.map(([c]) => c).filter((c) => c.method === method && (url instanceof RegExp ? url.test(c.url) : c.url === url));

function renderPage(props = {}) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PlayerContext.Provider value={player}>
        <ArtistPage {...props} />
      </PlayerContext.Provider>
    </MemoryRouter>
  );
  return { user };
}

async function renderLoaded(props) {
  const utils = renderPage(props);
  await screen.findByRole('heading', { level: 1, name: 'testartist' });
  return utils;
}

const actions = () => within(document.querySelector('.ap3-actions'));
const followButton = () => actions().queryByRole('button', { name: /^follow(ing)?$/i });
const statLine = () => document.querySelector('.ap3-statline');
const tab = (name) => within(screen.getByRole('tablist', { name: 'testartist' })).getByRole('tab', { name: new RegExp(`^${name}`) });
const trackTitles = () => Array.from(document.querySelectorAll('.ap3-track__title')).map((t) => t.textContent);
const lastCollection = () => player.requestPlayCollection.mock.calls.at(-1)[0];

beforeEach(() => {
  vi.clearAllMocks();
  songMenu.props = null;
  signInAs(LISTENER);
  authState.refreshUser = vi.fn();
  player = {
    requestPlayCollection: vi.fn(), currentMedia: null, isPlaying: false, togglePlayPause: vi.fn(),
  };
  // jsdom has no scrollIntoView; the tabs call it.
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  vi.spyOn(console, 'log').mockImplementation(() => {});

  backend = {
    artist: ARTIST,
    followers: 42,
    songs: SONGS,
    isFollowing: false,
    awards: [],
    standing: null,
    photos: [],
    territory: null,
    supported: { status: 'immediate' },
    fail: {},
  };

  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async ({ method, url }) => {
    const key = `${method} ${url}`;
    if (backend.fail[key]) throw backend.fail[key];

    if (method === 'get') {
      if (url === '/v1/users/profile/artist-1') return { data: backend.artist };
      if (url === '/v1/users/artist-1/followers/count') return { data: { count: backend.followers } };
      if (url === '/v1/media/songs/artist/artist-1') return { data: backend.songs };
      if (url === '/v1/users/artist-1/is-following') return { data: { isFollowing: backend.isFollowing } };
      if (url === '/v1/users/artist-1/awards') return { data: backend.awards };
      if (url === '/v1/users/artist-1/standing') return { data: backend.standing };
      if (url === '/v1/users/artist-1/photos') return { data: { photos: backend.photos, max: 6 } };
      if (url === '/v1/users/artist-1/territory-rank') return { data: backend.territory };
    }
    if (url === '/v1/users/artist-1/follow') return { data: {} };
    if (method === 'put' && url === '/v1/users/profile/artist-1/bio') return { data: { success: true } };
    if (method === 'put' && /\/supported-artist$/.test(url)) return { data: backend.supported };
    return { data: null };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
describe('ArtistPage — loading', () => {
  it('shows the loader first', () => {
    apiSpy.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading artist...');
  });

  it('says "Artist not found" when the profile cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.fail = { 'get /v1/users/profile/artist-1': new Error('404') };
    renderPage();
    expect(await screen.findByText('Artist not found')).toBeInTheDocument();
  });

  it('asks for the profile, followers, songs, awards, standing, photos, rank and releases', async () => {
    signInAs(null);
    await renderLoaded();
    const urls = apiSpy.mock.calls.map(([c]) => c.url).sort();
    expect(urls).toEqual([
      '/v1/media/songs/artist/artist-1',
      '/v1/releases/artist/artist-1',
      '/v1/users/artist-1/awards',
      '/v1/users/artist-1/followers/count',
      '/v1/users/artist-1/photos',
      '/v1/users/artist-1/standing',
      '/v1/users/artist-1/territory-rank',
      '/v1/users/profile/artist-1',
    ]);
  });

  it('a signed-in viewer also asks whether they follow the artist', async () => {
    await renderLoaded();
    expect(calls('get', '/v1/users/artist-1/is-following')).toHaveLength(1);
  });

  it.each([
    ['a guest', null],
    ['the artist looking at their own page', ARTIST_SELF],
  ])('%s does not ask', async (_label, who) => {
    signInAs(who);
    await renderLoaded();
    expect(calls('get', '/v1/users/artist-1/is-following')).toHaveLength(0);
  });

  it('still renders when every optional request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.fail = Object.fromEntries([
      '/v1/users/artist-1/followers/count', '/v1/media/songs/artist/artist-1', '/v1/users/artist-1/is-following',
      '/v1/users/artist-1/awards', '/v1/users/artist-1/standing', '/v1/users/artist-1/photos', '/v1/users/artist-1/territory-rank',
    ].map((u) => [`get ${u}`, new Error('500')]));
    await renderLoaded();
    expect(statLine()).toHaveTextContent('0 followers');
    expect(screen.getByText('No songs yet')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('ArtistPage — hero', () => {
  it('shows the name and the stats line', async () => {
    await renderLoaded();
    expect(statLine()).toHaveTextContent('5,000 plays · 42 followers · 250 score');
  });

  it('says "follower" for one', async () => {
    backend.followers = 1;
    await renderLoaded();
    expect(statLine()).toHaveTextContent('1 follower ·');
  });

  it('the area chip opens that area', async () => {
    const { user } = await renderLoaded();
    await user.click(within(document.querySelector('.ap3-hero')).getByRole('button', { name: 'Harlem' }));
    expect(navigateSpy).toHaveBeenCalledWith('/jurisdiction/Harlem');
  });

  it('shows this week\'s rank in a chip, with how far it climbed', async () => {
    backend.standing = { rank: 3, genreName: 'Rap', jurisdictionName: 'Harlem', deltaSpots: 2 };
    await renderLoaded();
    const chip = document.querySelector('.ap3-chip--rank');
    expect(chip).toHaveTextContent('#3 in Rap');
    expect(within(chip).getByLabelText('up 2')).toBeInTheDocument();
  });

  it('has no rank chip without a rank', async () => {
    await renderLoaded();
    expect(document.querySelector('.ap3-chip--rank')).toBeNull();
  });

  it('Back goes back', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigateSpy).toHaveBeenCalledWith(-1);
  });

  it('Share copies the artist link when the device has no share sheet', async () => {
    const { user } = await renderLoaded();
    const write = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(within(document.querySelector('.ap3-hero')).getByRole('button', { name: 'Share testartist' }));
    expect(write).toHaveBeenCalledWith(`${window.location.origin}/artist/artist-1`);
    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Link copied'));
  });

  it('Share uses the device share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    try {
      const { user } = await renderLoaded();
      await user.click(within(document.querySelector('.ap3-hero')).getByRole('button', { name: 'Share testartist' }));
      expect(share).toHaveBeenCalledWith({
        title: 'testartist', text: 'testartist on Unis', url: `${window.location.origin}/artist/artist-1`,
      });
      expect(feedback.success).not.toHaveBeenCalled();
    } finally {
      delete navigator.share;
    }
  });
});

// ===========================================================================
describe('ArtistPage — the action row', () => {
  it('a visitor gets Follow, Vote, Support, Message, Share, Shuffle and Play', async () => {
    await renderLoaded();
    expect(followButton()).toHaveTextContent('Follow');
    expect(actions().getByRole('button', { name: 'Vote' })).toBeInTheDocument();
    expect(actions().getByRole('button', { name: 'Support testartist' })).toBeInTheDocument();
    expect(actions().getByTestId('message-button')).toHaveAttribute('data-recipient', 'artist-1');
    expect(actions().getByRole('button', { name: 'Share testartist' })).toBeInTheDocument();
    expect(actions().getByRole('button', { name: "Shuffle all of testartist's songs" })).toBeEnabled();
    expect(actions().getByRole('button', { name: "Play all of testartist's songs" })).toBeEnabled();
  });

  it('a visitor on a phone gets a full-width vote card naming the area', async () => {
    await renderLoaded();
    const card = document.querySelector('.ap3-votecard');
    expect(card).toHaveTextContent('Vote for testartist');
    expect(card).toHaveTextContent('Moves them up the Harlem rankings');
  });

  it.each([
    ['with the isOwnProfile prop', { isOwnProfile: true }],
    ['without it, when the signed-in user is the artist', {}],
  ])('the artist on their own page (%s) gets only Share, Shuffle and Play', async (_label, props) => {
    signInAs(ARTIST_SELF);
    await renderLoaded(props);
    expect(followButton()).not.toBeInTheDocument();
    expect(actions().queryByRole('button', { name: 'Vote' })).not.toBeInTheDocument();
    expect(actions().queryByRole('button', { name: /support/i })).not.toBeInTheDocument();
    expect(actions().queryByTestId('message-button')).not.toBeInTheDocument();
    expect(actions().getByRole('button', { name: 'Share testartist' })).toBeInTheDocument();
    expect(actions().getByRole('button', { name: "Play all of testartist's songs" })).toBeInTheDocument();
    expect(document.querySelector('.ap3-votecard')).toBeNull();
    expect(document.querySelector('.ap3-support')).toBeNull();
  });
});

// ===========================================================================
describe('ArtistPage — follow and unfollow', () => {
  it('starts as Following when the viewer already follows', async () => {
    backend.isFollowing = true;
    await renderLoaded();
    expect(followButton()).toHaveTextContent('Following');
    expect(followButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it('Follow updates at once, POSTs, and confirms', async () => {
    const { user } = await renderLoaded();
    await user.click(followButton());

    expect(followButton()).toHaveTextContent('Following');
    expect(statLine()).toHaveTextContent('43 followers');
    expect(calls('post', '/v1/users/artist-1/follow')).toHaveLength(1);
    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Following testartist', { id: 'artist-follow' }));
  });

  it('Unfollow sends DELETE and lowers the count', async () => {
    backend.isFollowing = true;
    const { user } = await renderLoaded();
    await user.click(followButton());

    expect(followButton()).toHaveTextContent('Follow');
    expect(statLine()).toHaveTextContent('41 followers');
    expect(calls('delete', '/v1/users/artist-1/follow')).toHaveLength(1);
    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Unfollowed testartist', { id: 'artist-follow' }));
  });

  it.each([
    ['follow', false, 'post', "Couldn't follow testartist. Try again."],
    ['unfollow', true, 'delete', "Couldn't unfollow testartist. Try again."],
  ])('a failed %s puts the button and the count back and tells the user', async (_label, following, method, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.isFollowing = following;
    backend.fail = { [`${method} /v1/users/artist-1/follow`]: new Error('500') };
    const { user } = await renderLoaded();
    await user.click(followButton());

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith(message));
    expect(followButton()).toHaveTextContent(following ? 'Following' : 'Follow');
    expect(statLine()).toHaveTextContent('42 followers');
  });

  it('a guest is asked to log in and nothing is sent', async () => {
    signInAs(null);
    const { user } = await renderLoaded();
    await user.click(followButton());

    expect(feedback.info).toHaveBeenCalledWith('Log in to follow artists', expect.objectContaining({ action: expect.any(Object) }));
    feedback.info.mock.calls[0][1].action.onClick();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
    expect(calls('post', '/v1/users/artist-1/follow')).toHaveLength(0);
  });
});

// ===========================================================================
describe('ArtistPage — playing', () => {
  it('Play plays the whole catalog, most played first, from the top', async () => {
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: "Play all of testartist's songs" }));

    expect(player.requestPlayCollection).toHaveBeenCalledTimes(1);
    const { tracks, ...rest } = lastCollection();
    expect(rest).toEqual({ startIndex: 0, shuffle: false, title: 'testartist' });
    expect(tracks.map((t) => t.songId)).toEqual(['s2', 's1']);
    expect(tracks[0]).toEqual({
      type: 'song', id: 's2', songId: 's2',
      url: 'https://cdn.test/s2.mp3', fileUrl: 'https://cdn.test/s2.mp3',
      title: 'Top Hit', artist: 'testartist', artistId: 'artist-1',
      artwork: 'https://cdn.test/art2.jpg', artworkUrl: 'https://cdn.test/art2.jpg',
    });
  });

  it('Shuffle plays the same catalog shuffled', async () => {
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: "Shuffle all of testartist's songs" }));
    expect(lastCollection()).toMatchObject({ startIndex: 0, shuffle: true, title: 'testartist' });
    expect(lastCollection().tracks).toHaveLength(2);
  });

  it('tapping a Popular row plays the catalog from that song', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Play Second Track' }));
    expect(lastCollection()).toMatchObject({ startIndex: 1, shuffle: false });
  });

  it('the Fans pick plays the catalog from the top-scoring song', async () => {
    backend.songs = [
      song(1, { score: 900, playCount: 5 }), // fans pick, fewest plays → last in the catalog
      song(2, { score: 1, playCount: 50 }),
    ];
    const { user } = await renderLoaded();
    const pick = document.querySelector('.ap3-pick');
    await user.click(within(pick).getAllByRole('button', { name: 'Play Song 1' })[1]);
    expect(lastCollection()).toMatchObject({ startIndex: 1 });
    expect(lastCollection().tracks.map((t) => t.songId)).toEqual(['s2', 's1']);
  });

  it('songs with no audio file are left out of the catalog', async () => {
    backend.songs = [...SONGS, song(9, { title: 'No File', fileUrl: null, playCount: 99999 })];
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: "Play all of testartist's songs" }));
    expect(lastCollection().tracks.map((t) => t.songId)).toEqual(['s2', 's1']);

    await user.click(screen.getByRole('button', { name: 'Play No File' }));
    expect(player.requestPlayCollection).toHaveBeenCalledTimes(1);
  });

  it('Play and Shuffle are off for an artist with nothing to play', async () => {
    backend.songs = [];
    await renderLoaded();
    expect(actions().getByRole('button', { name: "Play all of testartist's songs" })).toBeDisabled();
    expect(actions().getByRole('button', { name: "Shuffle all of testartist's songs" })).toBeDisabled();
  });

  it('falls back to the artist photo when a song has no artwork', async () => {
    backend.songs = [song(1, { artworkUrl: null })];
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: "Play all of testartist's songs" }));
    expect(lastCollection().tracks[0].artwork).toBe('https://cdn.test/artist.jpg');
  });

  it('a member\'s plays are not counted toward the sign-up prompt', async () => {
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: "Play all of testartist's songs" }));
    expect(incrementGateSongCount).not.toHaveBeenCalled();
  });

  it('counts a guest\'s plays toward the sign-up prompt', async () => {
    signInAs(null);
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: "Play all of testartist's songs" }));
    await user.click(screen.getByRole('button', { name: 'Play Second Track' }));
    expect(incrementGateSongCount).toHaveBeenCalledTimes(2);
  });

  it('the page records no play of its own — the Player does that after real listening', async () => {
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: "Play all of testartist's songs" }));
    await user.click(screen.getByRole('button', { name: 'Play Second Track' }));
    const writes = apiSpy.mock.calls.map(([c]) => c).filter((c) => c.method !== 'get');
    expect(writes).toEqual([]);
  });
});

// ===========================================================================
describe('ArtistPage — Music tab', () => {
  it('opens on Music', async () => {
    await renderLoaded();
    expect(tab('Music')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'ap3-panel-music');
  });

  it('features the highest-scoring song as the Fans pick', async () => {
    await renderLoaded();
    const pick = document.querySelector('.ap3-pick');
    expect(pick).toHaveTextContent('Fans pick');
    expect(pick.querySelector('.ap3-pick__title')).toHaveTextContent('Top Hit');
    expect(pick.querySelector('.ap3-pick__meta')).toHaveTextContent('Song · 1,000 plays · Rap');
  });

  it('lists the songs under Popular, most played first, numbered, with their plays', async () => {
    await renderLoaded();
    expect(trackTitles()).toEqual(['Top Hit', 'Second Track']);
    const first = document.querySelector('.ap3-track');
    expect(first.querySelector('.ap3-track__num')).toHaveTextContent('1');
    expect(first.querySelector('.ap3-track__plays')).toHaveTextContent('1,000 plays');
  });

  it('still reads plays from a "plays" field when that is what the server sends', async () => {
    backend.songs = [{ ...song(1), playCount: undefined, plays: 77 }];
    await renderLoaded();
    expect(document.querySelector('.ap3-track__plays')).toHaveTextContent('77 plays');
  });

  it('shows five songs, with "See all" for the rest and "Show less" to fold', async () => {
    backend.songs = [1, 2, 3, 4, 5, 6, 7].map((n) => song(n));
    const { user } = await renderLoaded();
    expect(trackTitles()).toHaveLength(5);
    expect(trackTitles()[0]).toBe('Song 7');

    await user.click(screen.getByRole('button', { name: 'See all 7' }));
    expect(trackTitles()).toHaveLength(7);
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(trackTitles()).toHaveLength(5);
  });

  it('has no "See all" for five songs or fewer', async () => {
    backend.songs = [1, 2, 3, 4, 5].map((n) => song(n));
    await renderLoaded();
    expect(screen.queryByRole('button', { name: /see all/i })).not.toBeInTheDocument();
  });

  it('says "No songs yet" and shows no Fans pick for an artist with no songs', async () => {
    backend.songs = [];
    await renderLoaded();
    expect(screen.getByText('No songs yet')).toBeInTheDocument();
    expect(document.querySelector('.ap3-pick')).toBeNull();
  });

  it('shows the bio in a card beside the music, with Read more opening About', async () => {
    const { user } = await renderLoaded();
    const card = document.querySelector('.ap3-aboutcard');
    expect(card).toHaveTextContent('Original bio text');
    await user.click(within(card).getByRole('button', { name: 'Read more' }));
    expect(tab('About')).toHaveAttribute('aria-selected', 'true');
  });

  it('the phone bio teaser\'s link opens About', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'more about testartist' }));
    expect(tab('About')).toHaveAttribute('aria-selected', 'true');
  });

  it('has no bio card or teaser when there is no bio', async () => {
    backend.artist = { ...ARTIST, bio: '' };
    await renderLoaded();
    expect(document.querySelector('.ap3-aboutcard')).toBeNull();
    expect(document.querySelector('.ap3-teaser')).toBeNull();
  });

  it('has the artist ad slot', async () => {
    await renderLoaded();
    expect(screen.getByTestId('ad-slot')).toHaveAttribute('data-placement', 'artist');
  });

  it('shows the featured video when there is one', async () => {
    backend.artist = { ...ARTIST, featuredVideoUrl: 'https://cdn.test/v.mp4' };
    await renderLoaded();
    const video = screen.getByRole('region', { name: 'Featured video' }).querySelector('video');
    expect(video).toHaveAttribute('src', 'https://cdn.test/v.mp4');
  });
});

// ===========================================================================
describe('ArtistPage — the ⋮ song menu', () => {
  it('opens the menu for that song, shaped like a feed item', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'More options for Second Track' }));

    expect(screen.getByTestId('song-menu')).toHaveAttribute('data-song', 's1');
    expect(songMenu.props.song).toMatchObject({
      id: 's1', type: 'song', title: 'Second Track', artistData: { userId: 'artist-1', username: 'testartist' },
    });
    expect(songMenu.props.isGuest).toBe(false);
    expect(screen.getByRole('button', { name: 'More options for Second Track' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('Play now from the menu plays just that song', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'More options for Second Track' }));
    await user.click(screen.getByRole('button', { name: 'menu-play' }));
    expect(lastCollection()).toEqual({ tracks: [expect.objectContaining({ songId: 's1' })], title: 'Second Track' });
  });

  it('a guest choosing something that needs an account gets the sign-up prompt', async () => {
    signInAs(null);
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'More options for Second Track' }));
    expect(songMenu.props.isGuest).toBe(true);
    await user.click(screen.getByRole('button', { name: 'menu-needs-account' }));
    expect(triggerGate).toHaveBeenCalledWith('generic');
  });

  it('closes', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'More options for Second Track' }));
    await user.click(screen.getByRole('button', { name: 'menu-close' }));
    expect(screen.queryByTestId('song-menu')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('ArtistPage — vote', () => {
  it.each([
    ['the Vote button', () => actions().getByRole('button', { name: 'Vote' })],
    ['the phone vote card', () => document.querySelector('.ap3-votecard')],
  ])('%s opens the wizard with the artist as the nominee', async (_label, button) => {
    const { user } = await renderLoaded();
    await user.click(button());

    expect(JSON.parse(screen.getByTestId('vw-nominee').textContent)).toEqual({
      id: 'artist-1', name: 'testartist', type: 'artist',
      jurisdiction: ARTIST.jurisdiction, jurisdictionId: 'jur-harlem', genreId: 'genre-rap',
      photoUrl: 'https://cdn.test/artist.jpg',
    });
    expect(JSON.parse(screen.getByTestId('vw-filters').textContent)).toEqual({
      selectedGenre: 'rap', selectedType: 'artist', selectedInterval: 'daily', selectedJurisdiction: 'harlem',
    });
  });

  it('the wizard closes on close and after a successful vote', async () => {
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: 'Vote' }));
    await user.click(screen.getByRole('button', { name: 'vw-close' }));
    expect(screen.queryByTestId('voting-wizard')).not.toBeInTheDocument();

    await user.click(actions().getByRole('button', { name: 'Vote' }));
    await user.click(screen.getByRole('button', { name: 'vw-confirm' }));
    expect(screen.queryByTestId('voting-wizard')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('ArtistPage — support', () => {
  const supportDialog = () => screen.getByRole('dialog', { name: 'Support testartist' });
  const supportCard = () => document.querySelector('.ap3-support');

  it('the support card invites the viewer to back the artist', async () => {
    await renderLoaded();
    expect(supportCard()).toHaveTextContent('Support testartist');
    expect(supportCard()).toHaveTextContent('Make testartist your supported artist and your listening backs them.');
  });

  it('a first pick takes effect at once', async () => {
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: 'Support testartist' }));
    expect(supportDialog()).toHaveTextContent('Make testartist your supported artist?');
    expect(supportDialog()).toHaveTextContent('Your first pick takes effect right away');

    await user.click(within(supportDialog()).getByRole('button', { name: 'Support them' }));
    expect(calls('put', '/v1/users/listener-1/supported-artist')).toEqual([
      { method: 'put', url: '/v1/users/listener-1/supported-artist', data: { artistId: 'artist-1' } },
    ]);
    expect(await within(supportDialog()).findByText('You’re now supporting testartist')).toBeInTheDocument();
    expect(feedback.success).toHaveBeenCalledWith('You now support testartist');
    expect(authState.refreshUser).toHaveBeenCalled();
    expect(actions().getByRole('button', { name: 'Supporting testartist' })).toBeInTheDocument();
  });

  it('switching from another artist waits until the month turns over', async () => {
    signInAs({ ...LISTENER, supportedArtistId: 'someone-else' });
    backend.supported = { status: 'pending', effectiveDate: '2026-12-01T12:00:00Z' };
    const { user } = await renderLoaded();
    await user.click(within(supportCard()).getByRole('button', { name: 'Support' }));
    expect(supportDialog()).toHaveTextContent('You already support another artist.');

    await user.click(within(supportDialog()).getByRole('button', { name: 'Switch to them' }));
    expect(await within(supportDialog()).findByText('Locked in')).toBeInTheDocument();
    expect(supportDialog()).toHaveTextContent('You’ll switch to testartist on December 1.');
    await user.click(within(supportDialog()).getByRole('button', { name: 'Done' }));
    expect(supportCard()).toHaveTextContent('You\'ll switch to testartist on December 1.');
  });

  it('shows "Supporting" when this is already the viewer\'s supported artist', async () => {
    signInAs({ ...LISTENER, supportedArtistId: 'artist-1' });
    const { user } = await renderLoaded();
    expect(within(supportCard()).getByRole('button', { name: 'Supporting' })).toBeInTheDocument();
    expect(supportCard()).toHaveTextContent('Your listening backs testartist every month.');

    await user.click(actions().getByRole('button', { name: 'Supporting testartist' }));
    expect(supportDialog()).toHaveTextContent('testartist is your supported artist');
  });

  it('a failed save keeps the sheet open with the reason', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = apiSpy.getMockImplementation();
    apiSpy.mockImplementation((config) => (config.method === 'put'
      ? Promise.reject({ response: { data: { error: 'Artists cannot support themselves.' } } }) : original(config)));
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: 'Support testartist' }));
    await user.click(within(supportDialog()).getByRole('button', { name: 'Support them' }));

    expect(await within(supportDialog()).findByRole('alert')).toHaveTextContent('Artists cannot support themselves.');
    expect(feedback.error).toHaveBeenCalledWith('Artists cannot support themselves.');
  });

  it('Not now closes the sheet', async () => {
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: 'Support testartist' }));
    await user.click(within(supportDialog()).getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a guest pressing Support is sent to log in', async () => {
    signInAs(null);
    const { user } = await renderLoaded();
    await user.click(actions().getByRole('button', { name: 'Support testartist' }));
    expect(navigateSpy).toHaveBeenCalledWith('/login');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('ArtistPage — buy songs', () => {
  const shop = () => screen.getByRole('dialog', { name: 'testartist shop' });
  const buy = (user) => user.click(within(document.querySelector('.ap3-support')).getByRole('button', { name: 'Buy songs' }));

  it('lists the songs for sale with their price, leaving out the ones that are not', async () => {
    backend.songs = [
      song(1, { title: 'Free One', downloadPolicy: 'free' }),
      song(2, { title: 'Paid One', downloadPolicy: 'paid', downloadPrice: 199 }),
      song(3, { title: 'Not For Sale', downloadPolicy: 'unavailable' }),
    ];
    const { user } = await renderLoaded();
    await buy(user);

    const rows = Array.from(shop().querySelectorAll('.ap2-shopsheet__row'));
    expect(rows.map((r) => [r.querySelector('.ap2-shopsheet__songtitle').textContent, r.querySelector('.ap2-shopsheet__price').textContent]))
      .toEqual([['Free One', 'Free'], ['Paid One', '$1.99']]);
  });

  it('picking a song hands it to the download flow', async () => {
    backend.songs = [song(2, { title: 'Paid One', downloadPolicy: 'paid', downloadPrice: 199 })];
    const { user } = await renderLoaded();
    await buy(user);
    await user.click(within(shop()).getByRole('button', { name: /Paid One/ }));

    expect(screen.queryByRole('dialog', { name: 'testartist shop' })).not.toBeInTheDocument();
    const modal = screen.getByTestId('download-modal');
    expect(modal).toHaveTextContent('Paid One');
    expect(modal).toHaveAttribute('data-policy', 'paid');
    expect(modal).toHaveAttribute('data-file', 'testartist - Paid One.mp3');
  });

  it('says when nothing is for sale', async () => {
    backend.songs = [song(3, { downloadPolicy: 'unavailable' })];
    const { user } = await renderLoaded();
    await buy(user);
    expect(shop()).toHaveTextContent('Nothing for sale yet');
    await user.click(within(shop()).getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a guest is sent to log in', async () => {
    signInAs(null);
    const { user } = await renderLoaded();
    await buy(user);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });
});

// ===========================================================================
describe('ArtistPage — standing', () => {
  const card = () => screen.queryByRole('region', { name: 'testartist standing' });
  const TERRITORY = {
    genreName: 'Rap',
    periods: {
      week: [
        { jurisdictionId: 'j1', jurisdictionName: 'Uptown Harlem', overallRank: 2, genreRank: 1 },
        { jurisdictionId: 'j2', jurisdictionName: 'Harlem', overallRank: 7, genreRank: 3 },
      ],
      today: [],
    },
  };

  it('opens on this week: the home rank first, then the wider areas', async () => {
    backend.territory = TERRITORY;
    backend.standing = { rank: 2, deltaSpots: 3 };
    await renderLoaded();

    await waitFor(() => expect(card()).not.toBeNull());
    expect(card().querySelector('.ap3-standing__headline')).toHaveTextContent('#2in Uptown Harlem');
    expect(card().querySelector('.ap3-standing__move')).toHaveTextContent('Rap · up 3 spots this week');
    const rows = Array.from(card().querySelectorAll('.ap3-standing__row')).map((r) => r.textContent);
    expect(rows).toEqual(['Uptown Harlem#1 in Rap#2', 'Harlem#3 in Rap#7']);
  });

  it('Day shows today, and says when there is no ranking yet', async () => {
    backend.territory = TERRITORY;
    const { user } = await renderLoaded();
    await waitFor(() => expect(card()).not.toBeNull());
    await user.click(within(card()).getByRole('tab', { name: 'Day' }));
    expect(within(card()).getByRole('tab', { name: 'Day' })).toHaveAttribute('aria-selected', 'true');
    expect(card()).toHaveTextContent('No ranking yet for today.');
  });

  it('says ranks are still being worked out', async () => {
    backend.territory = { status: 'calculating', periods: {} };
    await renderLoaded();
    await waitFor(() => expect(card()).not.toBeNull());
    expect(card()).toHaveTextContent('Ranks are worked out every night. testartist’s standing shows up after tonight’s update.');
  });

  it('falls back to the weekly /standing rank when there are no area ranks', async () => {
    backend.standing = { rank: 4, jurisdictionName: 'Harlem', genreName: 'Rap', total: 30, deltaSpots: 1 };
    await renderLoaded();
    await waitFor(() => expect(card()).not.toBeNull());
    expect(card().querySelector('.ap3-standing__headline')).toHaveTextContent('#4in Harlem');
    expect(card().querySelector('.ap3-standing__move')).toHaveTextContent('This week · Rap · of 30 · up 1 spot');
  });

  it('is left out when there is no rank anywhere', async () => {
    await renderLoaded();
    await waitFor(() => expect(calls('get', '/v1/users/artist-1/territory-rank')).toHaveLength(1));
    expect(card()).toBeNull();
  });

  it('is left out when the rank cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.fail = { 'get /v1/users/artist-1/territory-rank': new Error('500') };
    await renderLoaded();
    expect(card()).toBeNull();
  });
});

// ===========================================================================
describe('ArtistPage — awards and the photo strip', () => {
  it('shows a medal for each award won, artist awards first, with a total', async () => {
    backend.awards = [
      { entity: 'song', interval: 'daily', count: 1 },
      { entity: 'artist', interval: 'weekly', count: 3 },
      { entity: 'artist', interval: 'annual', count: 1 },
    ];
    await renderLoaded();
    const shelf = screen.getByRole('region', { name: 'testartist awards' });
    expect(shelf).toHaveTextContent('Awards 5 wins');
    expect(within(shelf).getAllByRole('listitem').map((m) => m.getAttribute('aria-label'))).toEqual([
      'Artist of the Year, won 1 time',
      'Artist of the Week, won 3 times',
      'Song of the Day, won 1 time',
    ]);
  });

  it('also reads awards sent as a plain map', async () => {
    backend.awards = { 'artist-daily': 2 };
    await renderLoaded();
    expect(screen.getByRole('listitem', { name: 'Artist of the Day, won 2 times' })).toBeInTheDocument();
  });

  it('shows no shelf or photo strip when there is nothing to show', async () => {
    await renderLoaded();
    expect(screen.queryByRole('region', { name: 'testartist awards' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Photos' })).not.toBeInTheDocument();
  });

  it('the strip shows up to six photos and "See all" opens the Photos tab', async () => {
    backend.photos = Array.from({ length: 8 }, (_, i) => ({ photoId: `p${i}`, photoUrl: `https://cdn.test/p${i}.jpg` }));
    const { user } = await renderLoaded();
    const strip = screen.getByRole('region', { name: 'Photos' });
    expect(strip.querySelectorAll('.ap3-photostrip__tile')).toHaveLength(6);

    await user.click(within(strip).getByRole('button', { name: 'See all 8' }));
    expect(tab('Photos')).toHaveAttribute('aria-selected', 'true');
  });
});

// ===========================================================================
describe('ArtistPage — Photos tab and viewer', () => {
  const PHOTOS = [1, 2, 3].map((n) => ({ photoId: `p${n}`, photoUrl: `https://cdn.test/p${n}.jpg` }));

  it('the tab carries the photo count and shows them all in a grid', async () => {
    backend.photos = PHOTOS;
    const { user } = await renderLoaded();
    expect(tab('Photos')).toHaveTextContent('Photos3');
    await user.click(tab('Photos'));
    expect(screen.getByText('3 photos · tap one to open it full screen')).toBeInTheDocument();
    expect(document.querySelectorAll('.ap3-photos__tile')).toHaveLength(3);
  });

  it('opens a photo full screen, steps through them with wrap-around, and closes', async () => {
    backend.photos = PHOTOS;
    const { user } = await renderLoaded();
    await user.click(tab('Photos'));
    await user.click(screen.getByRole('button', { name: 'Open photo 2 of 3' }));

    expect(screen.getByRole('dialog', { name: 'testartist photos, 2 of 3' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('dialog', { name: 'testartist photos, 3 of 3' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('dialog', { name: 'testartist photos, 1 of 3' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('dialog', { name: 'testartist photos, 3 of 3' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close photo viewer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('a single photo has no next / previous', async () => {
    backend.photos = [PHOTOS[0]];
    const { user } = await renderLoaded();
    await user.click(tab('Photos'));
    expect(screen.getByText('1 photo · tap one to open it full screen')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open photo 1 of 1' }));
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
  });

  it('with no photos, a visitor is told the artist has none', async () => {
    const { user } = await renderLoaded();
    await user.click(tab('Photos'));
    expect(screen.getByText('testartist hasn’t posted any photos yet.')).toBeInTheDocument();
  });

  it('with no photos, the artist is told where to add some', async () => {
    signInAs(ARTIST_SELF);
    const { user } = await renderLoaded({ isOwnProfile: true });
    await user.click(tab('Photos'));
    expect(screen.getByText('No photos yet. Add some from your artist dashboard.')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('ArtistPage — About tab', () => {
  const openAbout = async (user) => { await user.click(tab('About')); return document.querySelector('.ap3-about'); };

  it('shows plays, followers, score and awards won', async () => {
    backend.awards = [{ entity: 'artist', interval: 'weekly', count: 2 }];
    const { user } = await renderLoaded();
    const about = await openAbout(user);
    expect(Array.from(about.querySelectorAll('.ap3-stat')).map((s) => s.textContent))
      .toEqual(['5,000Plays', '42Followers', '250Score', '2Awards won']);
  });

  it('shows the area (which opens it) and the genre', async () => {
    const { user } = await renderLoaded();
    const about = await openAbout(user);
    expect(about.querySelector('.ap3-about__tags')).toHaveTextContent('Rap');
    await user.click(within(about).getByRole('button', { name: 'Harlem' }));
    expect(navigateSpy).toHaveBeenCalledWith('/jurisdiction/Harlem');
  });

  it('shows the bio to visitors as text, one paragraph per block — not an editor', async () => {
    backend.artist = { ...ARTIST, bio: 'First part.\n\nSecond part.' };
    const { user } = await renderLoaded();
    const about = await openAbout(user);
    expect(Array.from(about.querySelectorAll('.ap3-about__bio p')).map((p) => p.textContent)).toEqual(['First part.', 'Second part.']);
    expect(within(about).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('says when the artist has not written a bio', async () => {
    backend.artist = { ...ARTIST, bio: null };
    const { user } = await renderLoaded();
    await openAbout(user);
    expect(screen.getByText('testartist hasn’t written a bio yet.')).toBeInTheDocument();
  });

  it('links each social account the artist has', async () => {
    backend.artist = { ...ARTIST, tiktokUrl: 'https://tiktok.com/@testartist' };
    const { user } = await renderLoaded();
    await openAbout(user);
    const connect = screen.getByRole('region', { name: 'Connect' });
    const links = within(connect).getAllByRole('link');
    expect(links.map((l) => [l.getAttribute('aria-label'), l.getAttribute('href')])).toEqual([
      ['testartist on Instagram', 'https://instagram.com/testartist'],
      ['testartist on TikTok', 'https://tiktok.com/@testartist'],
    ]);
    links.forEach((l) => {
      expect(l).toHaveAttribute('target', '_blank');
      expect(l).toHaveAttribute('rel', 'noreferrer noopener');
    });
  });

  it('hides Connect when there are no links', async () => {
    backend.artist = { ...ARTIST, instagramUrl: null };
    const { user } = await renderLoaded();
    await openAbout(user);
    expect(screen.queryByRole('region', { name: 'Connect' })).not.toBeInTheDocument();
  });

  describe('the artist\'s own bio', () => {
    beforeEach(() => signInAs(ARTIST_SELF));

    it('shows the bio in an editor with a Save button', async () => {
      const { user } = await renderLoaded({ isOwnProfile: true });
      await openAbout(user);
      expect(screen.getByLabelText('Your bio')).toHaveValue('Original bio text');
      expect(screen.getByRole('button', { name: 'Save bio' })).toBeInTheDocument();
    });

    it('Save bio sends the new text and confirms', async () => {
      const { user } = await renderLoaded({ isOwnProfile: true });
      await openAbout(user);
      await user.clear(screen.getByLabelText('Your bio'));
      await user.type(screen.getByLabelText('Your bio'), 'My new bio');
      await user.click(screen.getByRole('button', { name: 'Save bio' }));

      expect(calls('put', '/v1/users/profile/artist-1/bio')).toEqual([
        { method: 'put', url: '/v1/users/profile/artist-1/bio', data: { bio: 'My new bio' } },
      ]);
      await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Bio saved'));
    });

    it('a failed save tells the artist and keeps what they typed', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      backend.fail = { 'put /v1/users/profile/artist-1/bio': new Error('500') };
      const { user } = await renderLoaded({ isOwnProfile: true });
      await openAbout(user);
      await user.clear(screen.getByLabelText('Your bio'));
      await user.type(screen.getByLabelText('Your bio'), 'Unsaved words');
      await user.click(screen.getByRole('button', { name: 'Save bio' }));

      await waitFor(() => expect(feedback.error).toHaveBeenCalledWith("Couldn't save your bio. Try again."));
      expect(screen.getByLabelText('Your bio')).toHaveValue('Unsaved words');
    });
  });
});
