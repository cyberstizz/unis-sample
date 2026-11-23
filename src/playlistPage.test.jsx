// src/playlistPage.test.jsx
//
// Tests for PlaylistPage — /playlist/:playlistId.
//
// The rule this page exists to keep: a playlist is POURED into the queue, it
// never replaces it. Editing the page changes the saved playlist; editing the
// queue never touches the playlist.
//
// Covers:
//   • loading skeleton, "isn't available" state, Go home
//   • hero: kind label, name, description, creator link, song count + total
//     time, followers, visibility pill, cover / 4-up mosaic / empty cover
//   • durations: milliseconds, with older second-based rows still read right
//   • Play, Shuffle and row clicks hand the whole playlist to
//     requestPlayCollection (never a direct play); disabled with nothing playable
//   • once playing from here: Play becomes pause/resume, the current row
//     toggles, another row jumps inside the copy already queued (no re-prompt)
//   • row menu: Add to queue, Go to song, Go to artist; Remove for owners only
//   • owner / isOwner and following / isFollowing dual read (Jackson may drop
//     the "is" prefix)
//   • removal is confirmed in place, optimistic, and rolls back on failure
//   • follow / unfollow: who is offered it, optimistic count, rollback
//   • header menu: Copy link, Edit details, Delete playlist
//   • edit dialog: only changed fields are sent; visibility hidden for
//     community playlists; no-change and failure paths
//   • cover upload: 5 MB cap, POST, failure
//   • delete: confirm, points warning, navigate home, failure
//   • drag reorder: saves the new order, restores the old one on failure
//   • community playlists: tabs, suggestions endpoint, voting outcomes
//     (still pending / voted in / voted off), own suggestion, guests, activity
//
// PlayerContext is supplied directly. useAuth, useFeedback, useNavigate and
// axiosInstance are mocked; DndContext is wrapped so a drop can be fired by
// hand (jsdom has no layout to drag across).

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./playlistPage.scss', () => ({}));
vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));
vi.mock('./components/AdSlot', () => ({
  default: ({ placement }) => <div data-testid="ad-slot" data-placement={placement} />,
}));

const { navigateSpy, authState, feedback, http } = vi.hoisted(() => ({
  navigateSpy: vi.fn(),
  authState: { user: null },
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  http: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useParams: () => ({ playlistId: 'pl-1' }),
  useNavigate: () => navigateSpy,
}));
vi.mock('./context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));
vi.mock('./components/axiosInstance', () => ({
  default: http,
  apiCall: vi.fn(),
}));

let dnd = {};
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    DndContext: (props) => {
      dnd = props;
      return <actual.DndContext {...props} />;
    },
  };
});

import { PlayerContext } from './context/playercontext';
import PlaylistPage from './playlistPage';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ME = { userId: 'user-me', username: 'charles' };
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

const track = (n, overrides = {}) => ({
  playlistItemId: `item-${n}`,
  songId: `song-${n}`,
  title: `Track ${n}`,
  artistName: `Artist ${n}`,
  artistId: `artist-${n}`,
  artworkUrl: `https://cdn.test/art-${n}.jpg`,
  fileUrl: `https://cdn.test/song-${n}.mp3`,
  duration: 180000, // 3:00, in milliseconds
  addedAt: daysAgo(0),
  status: 'active',
  ...overrides,
});

const playlistData = (overrides = {}) => ({
  playlistId: 'pl-1',
  name: 'Late Night',
  description: 'After hours only.',
  type: 'personal',
  visibility: 'public',
  owner: false,
  following: false,
  followerCount: 12,
  creatorId: 'user-99',
  creatorName: 'maya',
  tracks: [track(1), track(2), track(3)],
  ...overrides,
});

const makeContext = (data, overrides = {}) => ({
  loadPlaylistDetails: vi.fn().mockResolvedValue(data),
  requestPlayCollection: vi.fn(),
  playQueueIndex: vi.fn(),
  playLater: vi.fn(),
  queue: [],
  currentMedia: null,
  isPlaying: false,
  togglePlayPause: vi.fn(),
  removeFromPlaylist: vi.fn().mockResolvedValue(undefined),
  reorderPlaylist: vi.fn().mockResolvedValue(undefined),
  updatePlaylist: vi.fn().mockResolvedValue(undefined),
  deletePlaylist: vi.fn().mockResolvedValue(undefined),
  followPlaylist: vi.fn().mockResolvedValue(undefined),
  unfollowPlaylist: vi.fn().mockResolvedValue(undefined),
  voteOnSuggestion: vi.fn().mockResolvedValue({ status: 'pending', upvotes: 1, downvotes: 0 }),
  ...overrides,
});

async function renderPage(data = playlistData(), contextOverrides = {}) {
  const ctx = makeContext(data, contextOverrides);
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PlayerContext.Provider value={ctx}>
        <PlaylistPage />
      </PlayerContext.Provider>
    </MemoryRouter>
  );
  await waitFor(() => expect(document.querySelector('.plp-loading')).toBeNull());
  return { ctx, user };
}

const row = (title) => screen.getByRole('button', { name: new RegExp(`^Play ${title} by`) });
const rowTitles = () => Array.from(document.querySelectorAll('.plp-row .plp-track-title')).map((el) => el.textContent);
const openRowMenu = (user, title) => user.click(screen.getByRole('button', { name: `More options for ${title}` }));
const openHeaderMenu = (user) => user.click(screen.getByRole('button', { name: 'More options' }));
const playButton = () => document.querySelector('.plp-play');

// A song from this playlist that is playing right now.
const playingFromHere = (itemId = 'item-2') => ({
  playlistItemId: itemId,
  origin: { type: 'playlist', playlistId: 'pl-1', batchId: 'batch-A' },
});

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = ME;
  dnd = {};
  http.get.mockResolvedValue({ data: [] });
  http.post.mockResolvedValue({ data: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
describe('PlaylistPage — loading and availability', () => {
  it('shows a skeleton while loading', () => {
    const ctx = makeContext(null, { loadPlaylistDetails: vi.fn(() => new Promise(() => {})) });
    render(
      <MemoryRouter>
        <PlayerContext.Provider value={ctx}><PlaylistPage /></PlayerContext.Provider>
      </MemoryRouter>
    );
    expect(document.querySelector('.plp-loading')).toHaveAttribute('aria-busy', 'true');
    expect(ctx.loadPlaylistDetails).toHaveBeenCalledWith('pl-1');
  });

  it('says the playlist isn\'t available when nothing comes back', async () => {
    const { user } = await renderPage(null);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('This playlist isn’t available');
    expect(screen.getByText('It may be private, or it may have been deleted.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to your library' }));
    expect(navigateSpy).toHaveBeenCalledWith('/playlists');
  });

  it('has the playlist ad slot', async () => {
    await renderPage();
    expect(screen.getByTestId('ad-slot')).toHaveAttribute('data-placement', 'playlist');
  });
});

// ===========================================================================
describe('PlaylistPage — hero', () => {
  it('shows the name, description and kind', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Late Night' })).toBeInTheDocument();
    expect(screen.getByText('After hours only.')).toBeInTheDocument();
    expect(document.querySelector('.plp-chip-type')).toHaveTextContent(/^Playlist$/);
  });

  it.each([
    ['community', 'Community playlist'],
    ['official', 'Official playlist'],
  ])('labels a %s playlist', async (type, label) => {
    await renderPage(playlistData({ type }));
    expect(document.querySelector('.plp-chip-type')).toHaveTextContent(label);
  });

  it('links to the creator\'s profile', async () => {
    await renderPage();
    const link = screen.getByRole('link', { name: /maya/ });
    expect(link).toHaveAttribute('href', '/user/user-99');
    expect(link.querySelector('.plp-creator-initial')).toHaveTextContent('M');
  });

  it('counts songs and totals their time', async () => {
    await renderPage();
    expect(screen.getByText('3 songs, 9 min')).toBeInTheDocument();
  });

  it('says "1 song"', async () => {
    await renderPage(playlistData({ tracks: [track(1)] }));
    expect(screen.getByText('1 song, 3 min')).toBeInTheDocument();
  });

  it('shows hours for a long playlist', async () => {
    await renderPage(playlistData({ tracks: [track(1, { duration: 3_900_000 }), track(2, { duration: 300_000 })] }));
    expect(screen.getByText('2 songs, 1 hr 10 min')).toBeInTheDocument();
  });

  // Followers show as "saves" (people who saved it to their library).
  it('shows how many people saved it, singular and plural', async () => {
    await renderPage();
    expect(screen.getByText('12 saves')).toBeInTheDocument();
  });

  it('says "1 save"', async () => {
    await renderPage(playlistData({ followerCount: 1 }));
    expect(screen.getByText('1 save')).toBeInTheDocument();
  });

  it('hides the save count at zero', async () => {
    await renderPage(playlistData({ followerCount: 0 }));
    expect(screen.queryByText(/\bsaves?\b/)).not.toBeInTheDocument();
  });

  it('only counts and lists active songs', async () => {
    await renderPage(playlistData({ tracks: [track(1), track(2, { status: 'pending' }), track(3, { status: 'removed' })] }));
    expect(rowTitles()).toEqual(['Track 1']);
    expect(screen.getByText('1 song, 3 min')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('PlaylistPage — cover', () => {
  it('uses the playlist\'s own cover when it has one', async () => {
    await renderPage(playlistData({ coverImageUrl: 'https://cdn.test/cover.jpg' }));
    expect(document.querySelector('.plp-cover > img')).toHaveAttribute('src', 'https://cdn.test/cover.jpg');
    expect(document.querySelector('.plp-mosaic')).toBeNull();
  });

  it('builds a four-up mosaic from the first four different artworks', async () => {
    await renderPage(playlistData({
      tracks: [track(1), track(2, { artworkUrl: 'https://cdn.test/art-1.jpg' }), track(3), track(4), track(5), track(6)],
    }));
    const srcs = Array.from(document.querySelectorAll('.plp-mosaic img')).map((img) => img.getAttribute('src'));
    expect(srcs).toEqual([
      'https://cdn.test/art-1.jpg', 'https://cdn.test/art-3.jpg',
      'https://cdn.test/art-4.jpg', 'https://cdn.test/art-5.jpg',
    ]);
  });

  it('uses a single artwork when there are fewer than four', async () => {
    await renderPage();
    expect(document.querySelector('.plp-mosaic')).toBeNull();
    expect(document.querySelector('.plp-cover > img')).toHaveAttribute('src', 'https://cdn.test/art-1.jpg');
  });

  it('shows an empty cover for an empty playlist', async () => {
    await renderPage(playlistData({ tracks: [] }));
    expect(document.querySelector('.plp-cover-empty')).not.toBeNull();
  });

  it('falls back to the mosaic when the cover image fails to load', async () => {
    await renderPage(playlistData({ coverImageUrl: 'https://cdn.test/broken.jpg' }));
    fireEvent.error(document.querySelector('.plp-cover > img'));
    expect(document.querySelector('.plp-cover > img')).toHaveAttribute('src', 'https://cdn.test/art-1.jpg');
  });
});

// ===========================================================================
describe('PlaylistPage — track list', () => {
  it('lists each song with its number, artist, time and when it was added', async () => {
    await renderPage(playlistData({
      tracks: [track(1), track(2, { addedAt: daysAgo(1) }), track(3, { addedAt: daysAgo(10) })],
    }));
    const first = row('Track 1');
    expect(first.querySelector('.plp-index-num')).toHaveTextContent('1');
    expect(within(first).getByRole('button', { name: 'Artist 1' })).toBeInTheDocument();
    expect(first.querySelector('.plp-col-time')).toHaveTextContent('3:00');
    expect(first.querySelector('.plp-col-added')).toHaveTextContent('Today');
    expect(row('Track 2').querySelector('.plp-col-added')).toHaveTextContent('Yesterday');
    expect(row('Track 3').querySelector('.plp-col-added')).toHaveTextContent('1 week ago');
  });

  it('reads durations in milliseconds, and older rows stored in seconds', async () => {
    await renderPage(playlistData({
      tracks: [track(1, { duration: 185000 }), track(2, { duration: 185 }), track(3, { duration: 0 })],
    }));
    expect(row('Track 1').querySelector('.plp-col-time')).toHaveTextContent('3:05');
    expect(row('Track 2').querySelector('.plp-col-time')).toHaveTextContent('3:05');
    expect(row('Track 3').querySelector('.plp-col-time')).toHaveTextContent(/^$/);
  });

  it('fills in a missing title and artist', async () => {
    await renderPage(playlistData({ tracks: [{ playlistItemId: 'item-x', songId: 'song-x', fileUrl: 'https://cdn.test/x.mp3' }] }));
    expect(screen.getByRole('button', { name: 'Play Untitled by Unknown Artist' })).toBeInTheDocument();
  });

  it('says "No songs yet" to a visitor and explains how to add songs to the owner', async () => {
    await renderPage(playlistData({ tracks: [] }));
    expect(screen.getByText('No songs yet')).toBeInTheDocument();
  });

  it('tells the owner how to add songs to an empty playlist', async () => {
    await renderPage(playlistData({ tracks: [], owner: true }));
    expect(screen.getByText('Your playlist is empty')).toBeInTheDocument();
    expect(screen.getByText(/choose Save to playlist/i)).toBeInTheDocument();
  });

  it('the artist name opens the artist page without playing the row', async () => {
    const { ctx, user } = await renderPage();
    await user.click(within(row('Track 2')).getByRole('button', { name: 'Artist 2' }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-2');
    expect(ctx.requestPlayCollection).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('PlaylistPage — playing pours the playlist into the queue', () => {
  const expectedRef = { playlistId: 'pl-1', name: 'Late Night', coverUrl: 'https://cdn.test/art-1.jpg' };

  it('Play hands the whole playlist to the play/queue prompt', async () => {
    const { ctx, user } = await renderPage();
    await user.click(playButton());

    expect(ctx.requestPlayCollection).toHaveBeenCalledTimes(1);
    const arg = ctx.requestPlayCollection.mock.calls[0][0];
    expect(arg.tracks.map((t) => t.songId)).toEqual(['song-1', 'song-2', 'song-3']);
    expect(arg.playlist).toEqual(expectedRef);
    expect(arg.shuffle).toBeUndefined();
  });

  it('Shuffle asks for the same thing, shuffled', async () => {
    const { ctx, user } = await renderPage();
    await user.click(screen.getByRole('button', { name: 'Shuffle play' }));
    expect(ctx.requestPlayCollection).toHaveBeenCalledWith(expect.objectContaining({ shuffle: true, playlist: expectedRef }));
  });

  it('clicking a row starts the playlist from that song', async () => {
    const { ctx, user } = await renderPage();
    await user.click(row('Track 3'));
    expect(ctx.requestPlayCollection).toHaveBeenCalledWith(expect.objectContaining({ startIndex: 2, playlist: expectedRef }));
  });

  it('Enter on a focused row does the same', async () => {
    const { ctx } = await renderPage();
    fireEvent.keyDown(row('Track 2'), { key: 'Enter' });
    expect(ctx.requestPlayCollection).toHaveBeenCalledWith(expect.objectContaining({ startIndex: 1 }));
  });

  it('songs with no file are left out, and positions follow the playable list', async () => {
    const { ctx, user } = await renderPage(playlistData({
      tracks: [track(1), track(2, { fileUrl: null }), track(3)],
    }));
    await user.click(row('Track 3'));
    const arg = ctx.requestPlayCollection.mock.calls[0][0];
    expect(arg.tracks.map((t) => t.songId)).toEqual(['song-1', 'song-3']);
    expect(arg.startIndex).toBe(1);
  });

  it('clicking a song with no file says it is unavailable', async () => {
    const { ctx, user } = await renderPage(playlistData({
      tracks: [track(1), track(2, { fileUrl: null })],
    }));
    await user.click(row('Track 2'));
    expect(feedback.info).toHaveBeenCalledWith('This song is unavailable right now');
    expect(ctx.requestPlayCollection).not.toHaveBeenCalled();
  });

  it('Play and Shuffle are disabled when nothing is playable', async () => {
    await renderPage(playlistData({ tracks: [track(1, { fileUrl: null })] }));
    expect(playButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Shuffle play' })).toBeDisabled();
  });

  it('the page itself never starts playback or touches the queue directly', async () => {
    const { ctx, user } = await renderPage();
    await user.click(playButton());
    await user.click(row('Track 2'));
    expect(ctx.playQueueIndex).not.toHaveBeenCalled();
    expect(ctx.togglePlayPause).not.toHaveBeenCalled();
    expect(ctx.playLater).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('PlaylistPage — while a song from this playlist is playing', () => {
  const live = (extra = {}) => ({
    currentMedia: playingFromHere('item-2'),
    isPlaying: true,
    queue: [
      { qid: 'q0', songId: 'other' },
      { qid: 'q1', playlistItemId: 'item-1', origin: { batchId: 'batch-A' } },
      { qid: 'q2', playlistItemId: 'item-2', origin: { batchId: 'batch-A' } },
      { qid: 'q3', playlistItemId: 'item-3', origin: { batchId: 'batch-A' } },
    ],
    ...extra,
  });

  it('says it is playing from this playlist and marks the row', async () => {
    await renderPage(playlistData(), live());
    expect(screen.getByText('Now playing · Track 2')).toBeInTheDocument();
    expect(row('Track 2')).toHaveClass('plp-row-current');
    expect(within(row('Track 2')).getByLabelText('Now playing')).toBeInTheDocument();
    expect(row('Track 1')).not.toHaveClass('plp-row-current');
  });

  it('Play becomes Pause and toggles playback instead of re-prompting', async () => {
    const { ctx, user } = await renderPage(playlistData(), live());
    expect(playButton()).toHaveAccessibleName('Pause');
    await user.click(playButton());
    expect(ctx.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(ctx.requestPlayCollection).not.toHaveBeenCalled();
  });

  it('reads Play again while paused, and still resumes', async () => {
    const { ctx, user } = await renderPage(playlistData(), live({ isPlaying: false }));
    expect(playButton()).toHaveAccessibleName('Play');
    await user.click(playButton());
    expect(ctx.togglePlayPause).toHaveBeenCalledTimes(1);
  });

  it('clicking the current row pauses or resumes it', async () => {
    const { ctx, user } = await renderPage(playlistData(), live());
    await user.click(row('Track 2'));
    expect(ctx.togglePlayPause).toHaveBeenCalledTimes(1);
    expect(ctx.requestPlayCollection).not.toHaveBeenCalled();
  });

  it('clicking another row jumps to that song in the copy already queued', async () => {
    const { ctx, user } = await renderPage(playlistData(), live());
    await user.click(row('Track 3'));
    expect(ctx.playQueueIndex).toHaveBeenCalledWith(3);
    expect(ctx.requestPlayCollection).not.toHaveBeenCalled();
  });

  it('a song removed from the queue since then starts the playlist again from it', async () => {
    const ctxOverrides = live();
    ctxOverrides.queue = ctxOverrides.queue.filter((q) => q.playlistItemId !== 'item-3');
    const { ctx, user } = await renderPage(playlistData(), ctxOverrides);
    await user.click(row('Track 3'));
    expect(ctx.playQueueIndex).not.toHaveBeenCalled();
    expect(ctx.requestPlayCollection).toHaveBeenCalledWith(expect.objectContaining({ startIndex: 2 }));
  });

  it('a song playing from a different playlist is not treated as playing from here', async () => {
    await renderPage(playlistData(), {
      currentMedia: { playlistItemId: 'item-2', origin: { type: 'playlist', playlistId: 'pl-other' } },
      isPlaying: true,
    });
    expect(screen.queryByText(/^Now playing ·/)).not.toBeInTheDocument();
    expect(playButton()).toHaveAccessibleName('Play');
  });
});

// ===========================================================================
describe('PlaylistPage — row menu', () => {
  it('offers Add to queue, Go to song and Go to artist', async () => {
    const { user } = await renderPage();
    await openRowMenu(user, 'Track 2');
    const menu = screen.getByRole('menu');
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent.trim()))
      .toEqual(['Add to queue', 'Go to song', 'Go to artist']);
  });

  it('Add to queue queues that one song, tagged with the playlist it came from', async () => {
    const { ctx, user } = await renderPage();
    await openRowMenu(user, 'Track 2');
    await user.click(screen.getByRole('menuitem', { name: /add to queue/i }));

    expect(ctx.playLater).toHaveBeenCalledTimes(1);
    const [queued, origin] = ctx.playLater.mock.calls[0];
    expect(queued.songId).toBe('song-2');
    expect(origin).toMatchObject({ type: 'playlist', playlistId: 'pl-1', name: 'Late Night' });
    expect(origin.batchId).toMatch(/^single-item-2-\d+$/);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(ctx.requestPlayCollection).not.toHaveBeenCalled();
  });

  it('Go to song and Go to artist navigate', async () => {
    const { user } = await renderPage();
    await openRowMenu(user, 'Track 2');
    await user.click(screen.getByRole('menuitem', { name: /go to song/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/song/song-2');

    await user.click(screen.getByRole('menuitem', { name: /go to artist/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/artist-2');
  });

  it('leaves out Go to artist when the song has no artist id', async () => {
    const { user } = await renderPage(playlistData({ tracks: [track(1, { artistId: null })] }));
    await openRowMenu(user, 'Track 1');
    expect(screen.queryByRole('menuitem', { name: /go to artist/i })).not.toBeInTheDocument();
  });

  it('opening one row\'s menu closes another\'s; Escape closes it', async () => {
    const { user } = await renderPage();
    await openRowMenu(user, 'Track 1');
    await openRowMenu(user, 'Track 2');
    expect(screen.getAllByRole('menu')).toHaveLength(1);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('a visitor is not offered Remove or a reorder grip', async () => {
    const { user } = await renderPage();
    await openRowMenu(user, 'Track 1');
    expect(screen.queryByRole('menuitem', { name: /remove from playlist/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reorder/ })).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('PlaylistPage — who owns it (Jackson may send owner or isOwner)', () => {
  it.each([
    ['owner: true', { owner: true }],
    ['isOwner: true', { isOwner: true }],
  ])('treats %s as the owner', async (_label, flags) => {
    const { user } = await renderPage(playlistData(flags));
    expect(screen.getAllByRole('button', { name: /^Reorder/ })).toHaveLength(3);
    expect(screen.getByRole('button', { name: /choose photo/i })).toBeInTheDocument();
    await openHeaderMenu(user);
    expect(screen.getByRole('menuitem', { name: /edit details/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /delete playlist/i })).toBeInTheDocument();
  });

  it('a non-owner only gets Copy link in the header menu', async () => {
    const { user } = await renderPage();
    await openHeaderMenu(user);
    expect(within(screen.getByRole('menu')).getAllByRole('menuitem').map((i) => i.textContent.trim()))
      .toEqual(['Copy link']);
  });

  it('shows the owner their playlist\'s visibility', async () => {
    await renderPage(playlistData({ owner: true, visibility: 'unlisted' }));
    expect(screen.getByText('Unlisted')).toBeInTheDocument();
  });

  it('does not show the visibility to visitors', async () => {
    await renderPage();
    expect(screen.queryByText(/^(Public|Unlisted|Private)$/)).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('PlaylistPage — removing a song (owner)', () => {
  const owned = () => playlistData({ owner: true, songCount: 3 });
  const askRemove = async (user, title) => {
    await openRowMenu(user, title);
    await user.click(screen.getByRole('menuitem', { name: /remove from playlist/i }));
  };

  it('asks first — nothing is removed on the first tap', async () => {
    const { ctx, user } = await renderPage(owned());
    await askRemove(user, 'Track 2');
    expect(screen.getByText('Remove from playlist?')).toBeInTheDocument();
    expect(ctx.removeFromPlaylist).not.toHaveBeenCalled();
    expect(rowTitles()).toHaveLength(3);
  });

  it('Remove takes the song off the saved playlist and confirms', async () => {
    const { ctx, user } = await renderPage(owned());
    await askRemove(user, 'Track 2');
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(rowTitles()).toEqual(['Track 1', 'Track 3']);
    await waitFor(() => expect(ctx.removeFromPlaylist).toHaveBeenCalledWith('pl-1', 'item-2'));
    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Removed “Track 2” from this playlist'));
    expect(screen.getByText('2 songs, 6 min')).toBeInTheDocument();
  });

  it('Cancel and Escape keep the song', async () => {
    const { ctx, user } = await renderPage(owned());
    await askRemove(user, 'Track 2');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Remove from playlist?')).not.toBeInTheDocument();

    await askRemove(user, 'Track 2');
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Remove from playlist?')).not.toBeInTheDocument();
    expect(ctx.removeFromPlaylist).not.toHaveBeenCalled();
  });

  it('clicking the row while it is confirming does not play it', async () => {
    const { ctx, user } = await renderPage(owned());
    await askRemove(user, 'Track 2');
    await user.click(row('Track 2'));
    expect(ctx.requestPlayCollection).not.toHaveBeenCalled();
  });

  it('a failed removal puts the song back and tells the owner', async () => {
    const { user } = await renderPage(owned(), {
      removeFromPlaylist: vi.fn().mockRejectedValue(new Error('down')),
    });
    await askRemove(user, 'Track 2');
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith("Couldn't remove that song. Try again."));
    expect(rowTitles()).toEqual(['Track 1', 'Track 2', 'Track 3']);
  });

  it('removing a song never touches the queue', async () => {
    const { ctx, user } = await renderPage(owned());
    await askRemove(user, 'Track 2');
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(ctx.removeFromPlaylist).toHaveBeenCalled());
    expect(ctx.playQueueIndex).not.toHaveBeenCalled();
    expect(ctx.playLater).not.toHaveBeenCalled();
    expect(ctx.requestPlayCollection).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('PlaylistPage — follow and unfollow', () => {
  // Follow is the heart in the action row: "Save to your library".
  const followButton = () => screen.queryByRole('button', { name: /(save to|remove from) your library/i });

  it('offers Follow to a signed-in visitor on a public playlist', async () => {
    await renderPage();
    expect(followButton()).toHaveAccessibleName('Save to your library');
    expect(followButton()).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers Follow on an unlisted playlist too', async () => {
    await renderPage(playlistData({ visibility: 'unlisted' }));
    expect(followButton()).not.toBeNull();
  });

  it.each([
    ['a private playlist', playlistData({ visibility: 'private' }), ME],
    ['the owner', playlistData({ owner: true }), ME],
    ['a guest', playlistData(), null],
  ])('does not offer Follow to/for %s', async (_label, data, user) => {
    authState.user = user;
    await renderPage(data);
    expect(followButton()).toBeNull();
  });

  it.each([
    ['following: true', { following: true }],
    ['isFollowing: true', { isFollowing: true }],
  ])('starts as Following for %s', async (_label, flags) => {
    await renderPage(playlistData(flags));
    expect(followButton()).toHaveAccessibleName('Remove from your library');
    expect(followButton()).toHaveAttribute('aria-pressed', 'true');
  });

  it('Follow updates at once, calls followPlaylist and confirms', async () => {
    const { ctx, user } = await renderPage();
    await user.click(followButton());

    expect(followButton()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('13 saves')).toBeInTheDocument();
    await waitFor(() => expect(ctx.followPlaylist).toHaveBeenCalledWith('pl-1'));
    expect(ctx.unfollowPlaylist).not.toHaveBeenCalled();
    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Added “Late Night” to your library'));
  });

  it('Unfollow calls unfollowPlaylist and lowers the count', async () => {
    const { ctx, user } = await renderPage(playlistData({ following: true }));
    await user.click(followButton());

    expect(followButton()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('11 saves')).toBeInTheDocument();
    await waitFor(() => expect(ctx.unfollowPlaylist).toHaveBeenCalledWith('pl-1'));
    expect(ctx.followPlaylist).not.toHaveBeenCalled();
    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Removed “Late Night” from your library'));
  });

  it('a failed follow puts the button and the count back', async () => {
    const { user } = await renderPage(playlistData(), {
      followPlaylist: vi.fn().mockRejectedValue(new Error('down')),
    });
    await user.click(followButton());

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith("Couldn't add it to your library. Try again."));
    expect(followButton()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('12 saves')).toBeInTheDocument();
  });

  it('a failed unfollow rolls back too', async () => {
    const { user } = await renderPage(playlistData({ following: true }), {
      unfollowPlaylist: vi.fn().mockRejectedValue(new Error('down')),
    });
    await user.click(followButton());

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith("Couldn't remove it from your library. Try again."));
    expect(followButton()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('12 saves')).toBeInTheDocument();
  });
});

// ===========================================================================
describe('PlaylistPage — copy link', () => {
  it('copies the playlist address', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { user } = await renderPage();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /copy link/i }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/playlist/pl-1`);
    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Link copied'));
  });

  it('shows the link to copy by hand when the clipboard refuses', async () => {
    const { user } = await renderPage();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true,
    });
    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /copy link/i }));
    await waitFor(() =>
      expect(feedback.info).toHaveBeenCalledWith(`Copy this link: ${window.location.origin}/playlist/pl-1`));
  });
});

// ===========================================================================
describe('PlaylistPage — edit details (owner)', () => {
  const owned = (extra = {}) => playlistData({ owner: true, visibility: 'private', ...extra });
  const openEdit = async (user) => {
    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /edit details/i }));
    return screen.getByRole('dialog', { name: 'Edit details' });
  };

  it('opens filled in with the current details', async () => {
    const { user } = await renderPage(owned());
    const dialog = await openEdit(user);
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Late Night');
    expect(within(dialog).getByLabelText('Description')).toHaveValue('After hours only.');
    expect(within(dialog).getByRole('button', { name: /private/i })).toHaveAttribute('aria-pressed', 'true');
    expect(within(dialog).getByText('Only you can open it.')).toBeInTheDocument();
  });

  it('explains each visibility choice', async () => {
    const { user } = await renderPage(owned());
    const dialog = await openEdit(user);
    await user.click(within(dialog).getByRole('button', { name: /unlisted/i }));
    expect(within(dialog).getByText(/anyone with the link can open it/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /public/i }));
    expect(within(dialog).getByText(/shows up in search and on discover/i)).toBeInTheDocument();
  });

  it('sends only what changed, then shows it on the page', async () => {
    const { ctx, user } = await renderPage(owned());
    const dialog = await openEdit(user);
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, '  Early Morning  ');
    await user.click(within(dialog).getByRole('button', { name: /public/i }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(ctx.updatePlaylist).toHaveBeenCalledWith('pl-1', {
      name: 'Early Morning',
      visibility: 'public',
    }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Early Morning' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(feedback.success).toHaveBeenCalledWith('Playlist details saved');
  });

  it('a description can be cleared', async () => {
    const { ctx, user } = await renderPage(owned());
    const dialog = await openEdit(user);
    await user.clear(within(dialog).getByLabelText('Description'));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(ctx.updatePlaylist).toHaveBeenCalledWith('pl-1', { description: '' }));
  });

  it('Save with nothing changed closes without a request', async () => {
    const { ctx, user } = await renderPage(owned());
    const dialog = await openEdit(user);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(ctx.updatePlaylist).not.toHaveBeenCalled();
    expect(feedback.info).toHaveBeenCalledWith('No changes to save');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Save is disabled with an empty name', async () => {
    const { user } = await renderPage(owned());
    const dialog = await openEdit(user);
    await user.clear(within(dialog).getByLabelText('Name'));
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('a community playlist has no visibility choice', async () => {
    const { user } = await renderPage(owned({ type: 'community' }));
    const dialog = await openEdit(user);
    expect(within(dialog).queryByText('Who can see it')).not.toBeInTheDocument();
  });

  it('a failed save keeps the dialog open with what was typed', async () => {
    const { user } = await renderPage(owned(), {
      updatePlaylist: vi.fn().mockRejectedValue(new Error('down')),
    });
    const dialog = await openEdit(user);
    await user.type(within(dialog).getByLabelText('Name'), ' II');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith("Couldn't save your changes. Try again."));
    expect(screen.getByRole('dialog', { name: 'Edit details' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Late Night II');
    expect(screen.getByRole('heading', { level: 1, name: 'Late Night' })).toBeInTheDocument();
  });

  it('Cancel closes without saving', async () => {
    const { ctx, user } = await renderPage(owned());
    const dialog = await openEdit(user);
    await user.type(within(dialog).getByLabelText('Name'), ' II');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(ctx.updatePlaylist).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('PlaylistPage — cover upload (owner)', () => {
  const image = (sizeMB) => {
    const file = new File(['x'], 'cover.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: sizeMB * 1024 * 1024 });
    return file;
  };
  const coverInput = () => document.querySelector('.plp-cover input[type="file"]');

  it('uploads the image and shows the new cover', async () => {
    http.post.mockResolvedValue({ data: { coverImageUrl: 'https://cdn.test/new-cover.jpg' } });
    await renderPage(playlistData({ owner: true }));
    fireEvent.change(coverInput(), { target: { files: [image(1)] } });

    await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
    const [url, body] = http.post.mock.calls[0];
    expect(url).toBe('/v1/playlists/pl-1/cover');
    expect(body.get('cover').name).toBe('cover.jpg');
    await waitFor(() =>
      expect(document.querySelector('.plp-cover > img')).toHaveAttribute('src', 'https://cdn.test/new-cover.jpg'));
    expect(feedback.success).toHaveBeenCalledWith('Cover updated');
  });

  it('refuses an image over 5 MB without uploading', async () => {
    await renderPage(playlistData({ owner: true }));
    fireEvent.change(coverInput(), { target: { files: [image(6)] } });
    expect(feedback.error).toHaveBeenCalledWith('Cover images must be under 5 MB. Pick a smaller one.');
    expect(http.post).not.toHaveBeenCalled();
  });

  it('tells the owner when the upload fails', async () => {
    http.post.mockRejectedValue(new Error('down'));
    await renderPage(playlistData({ owner: true }));
    fireEvent.change(coverInput(), { target: { files: [image(1)] } });
    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith("Couldn't upload that image. Try again."));
    expect(screen.getByRole('button', { name: /choose photo/i })).toBeEnabled();
  });
});

// ===========================================================================
describe('PlaylistPage — delete (owner)', () => {
  const openDelete = async (user) => {
    await openHeaderMenu(user);
    await user.click(screen.getByRole('menuitem', { name: /delete playlist/i }));
    return screen.getByRole('alertdialog', { name: 'Delete this playlist?' });
  };

  it('asks first, and says queued songs keep playing', async () => {
    const { ctx, user } = await renderPage(playlistData({ owner: true }));
    const dialog = await openDelete(user);
    expect(dialog).toHaveTextContent('“Late Night” will be removed from your library.');
    expect(dialog).toHaveTextContent('Songs already in your queue will keep playing.');
    expect(ctx.deletePlaylist).not.toHaveBeenCalled();
  });

  it('warns about the points the playlist earned', async () => {
    const { user } = await renderPage(playlistData({ owner: true, ownerPointsEarned: 40 }));
    const dialog = await openDelete(user);
    expect(dialog).toHaveTextContent('You’ll also lose the 40 points this playlist earned you.');
  });

  it('says nothing about points when it earned none', async () => {
    const { user } = await renderPage(playlistData({ owner: true }));
    const dialog = await openDelete(user);
    expect(dialog).not.toHaveTextContent(/points/);
  });

  it('Delete removes the playlist and goes back to the library', async () => {
    const { ctx, user } = await renderPage(playlistData({ owner: true }));
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(ctx.deletePlaylist).toHaveBeenCalledWith('pl-1'));
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/playlists', { replace: true }));
    expect(feedback.success).toHaveBeenCalledWith('Deleted “Late Night”');
  });

  it('Cancel keeps it', async () => {
    const { ctx, user } = await renderPage(playlistData({ owner: true }));
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(ctx.deletePlaylist).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('a failed delete stays on the page and tells the owner', async () => {
    const { user } = await renderPage(playlistData({ owner: true }), {
      deletePlaylist: vi.fn().mockRejectedValue(new Error('down')),
    });
    const dialog = await openDelete(user);
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith("Couldn't delete the playlist. Try again."));
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('PlaylistPage — drag to reorder (owner)', () => {
  it('saves the new order and confirms', async () => {
    const { ctx } = await renderPage(playlistData({ owner: true }));
    await act(async () => { await dnd.onDragEnd({ active: { id: 'item-3' }, over: { id: 'item-1' } }); });

    expect(rowTitles()).toEqual(['Track 3', 'Track 1', 'Track 2']);
    expect(ctx.reorderPlaylist).toHaveBeenCalledTimes(1);
    const [pid, order] = ctx.reorderPlaylist.mock.calls[0];
    expect(pid).toBe('pl-1');
    expect(order.map((t) => t.playlistItemId)).toEqual(['item-3', 'item-1', 'item-2']);
    expect(feedback.success).toHaveBeenCalledWith('Order saved');
  });

  it('puts the old order back when the save fails', async () => {
    await renderPage(playlistData({ owner: true }), {
      reorderPlaylist: vi.fn().mockRejectedValue(new Error('down')),
    });
    await act(async () => { await dnd.onDragEnd({ active: { id: 'item-3' }, over: { id: 'item-1' } }); });

    expect(rowTitles()).toEqual(['Track 1', 'Track 2', 'Track 3']);
    expect(feedback.error).toHaveBeenCalledWith("Couldn't save the new order. Try again.");
  });

  it('a drop in the same place, or outside the list, saves nothing', async () => {
    const { ctx } = await renderPage(playlistData({ owner: true }));
    await act(async () => { await dnd.onDragEnd({ active: { id: 'item-2' }, over: { id: 'item-2' } }); });
    await act(async () => { await dnd.onDragEnd({ active: { id: 'item-2' }, over: null }); });
    expect(ctx.reorderPlaylist).not.toHaveBeenCalled();
  });

  it('reordering the playlist never touches the queue', async () => {
    const { ctx } = await renderPage(playlistData({ owner: true }));
    await act(async () => { await dnd.onDragEnd({ active: { id: 'item-3' }, over: { id: 'item-1' } }); });
    expect(ctx.playQueueIndex).not.toHaveBeenCalled();
    expect(ctx.requestPlayCollection).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('PlaylistPage — community playlists', () => {
  const community = (extra = {}) => playlistData({ type: 'community', jurisdictionName: 'Harlem', ...extra });
  const SUGGESTED = [
    track(7, { status: 'pending', upvotes: 2, downvotes: 1, addedByUsername: 'maya', addedById: 'user-99' }),
    track(8, { status: 'pending', upvotes: 0, downvotes: 0, addedByUsername: 'charles', addedById: 'user-me' }),
  ];

  const openSuggestions = async (user) => {
    await user.click(screen.getByRole('tab', { name: /suggestions/i }));
  };

  beforeEach(() => {
    http.get.mockImplementation(async (url) => {
      if (/\/pending$/.test(url)) return { data: SUGGESTED };
      if (/\/activity/.test(url)) return { data: [] };
      return { data: [] };
    });
  });

  it('a personal playlist has no tabs and loads no suggestions', async () => {
    await renderPage();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(http.get).not.toHaveBeenCalled();
  });

  it('shows Songs / Suggestions / Activity tabs and where it belongs', async () => {
    await renderPage(community());
    expect(screen.getByRole('tab', { name: /songs/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument();
    expect(screen.getByText('Harlem')).toBeInTheDocument();
  });

  it('loads suggestions from their own endpoint and counts them on the tab', async () => {
    await renderPage(community());
    expect(http.get).toHaveBeenCalledWith('/v1/playlists/pl-1/pending');
    await waitFor(() => expect(screen.getByRole('tab', { name: /suggestions/i })).toHaveTextContent(/^Suggestions\s*2$/));
  });

  it('lists each suggestion with who suggested it and its votes', async () => {
    const { user } = await renderPage(community());
    await openSuggestions(user);
    const first = (await screen.findByText('Track 7')).closest('.plp-suggestion');
    expect(first).toHaveTextContent('Artist 7 · from maya');
    expect(within(first).getByRole('button', { name: 'Vote to add' })).toHaveTextContent('2');
    expect(within(first).getByRole('button', { name: 'Vote against' })).toHaveTextContent('1');
  });

  it('nobody votes on their own suggestion', async () => {
    const { user } = await renderPage(community());
    await openSuggestions(user);
    const mine = (await screen.findByText('Track 8')).closest('.plp-suggestion');
    expect(within(mine).getByText('Your suggestion')).toBeInTheDocument();
    expect(within(mine).queryByRole('button')).not.toBeInTheDocument();
    expect(within(mine).getByLabelText('0 up, 0 down')).toBeInTheDocument();
  });

  it('says so when there is nothing to vote on', async () => {
    http.get.mockResolvedValue({ data: [] });
    const { user } = await renderPage(community());
    await openSuggestions(user);
    expect(screen.getByText('No suggestions waiting')).toBeInTheDocument();
  });

  it('a vote that leaves the song pending updates the tally and marks the vote', async () => {
    const { ctx, user } = await renderPage(community(), {
      voteOnSuggestion: vi.fn().mockResolvedValue({ status: 'pending', upvotes: 3, downvotes: 1 }),
    });
    await openSuggestions(user);
    await user.click(await screen.findByRole('button', { name: 'Vote to add' }));

    await waitFor(() => expect(ctx.voteOnSuggestion).toHaveBeenCalledWith('pl-1', 'item-7', 'up'));
    const voted = await screen.findByRole('button', { name: 'You voted to add' });
    expect(voted).toHaveAttribute('aria-pressed', 'true');
    expect(voted).toHaveTextContent('3');
    expect(feedback.success).toHaveBeenCalledWith('Voted for “Track 7”');
  });

  it('voting the same way twice is not sent again', async () => {
    const { ctx, user } = await renderPage(community(), {
      voteOnSuggestion: vi.fn().mockResolvedValue({ status: 'pending', upvotes: 3, downvotes: 1 }),
    });
    await openSuggestions(user);
    await user.click(await screen.findByRole('button', { name: 'Vote to add' }));
    await user.click(await screen.findByRole('button', { name: 'You voted to add' }));

    expect(ctx.voteOnSuggestion).toHaveBeenCalledTimes(1);
    expect(feedback.info).toHaveBeenCalledWith('You already voted for “Track 7”');
  });

  it('a deciding vote moves the song into the playlist', async () => {
    const { user } = await renderPage(community(), {
      voteOnSuggestion: vi.fn().mockResolvedValue({ status: 'active', upvotes: 3, downvotes: 1 }),
    });
    await openSuggestions(user);
    await user.click(await screen.findByRole('button', { name: 'Vote to add' }));

    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Your vote put “Track 7” in the playlist'));
    expect(screen.queryByText('Track 7')).not.toBeInTheDocument(); // gone from suggestions
    expect(screen.getByRole('tab', { name: /suggestions/i })).toHaveTextContent(/^Suggestions\s*1$/);

    await user.click(screen.getByRole('tab', { name: /songs/i }));
    expect(rowTitles()).toEqual(['Track 1', 'Track 2', 'Track 3', 'Track 7']);
  });

  it('a deciding vote against takes the song off the suggestions', async () => {
    const { user } = await renderPage(community(), {
      voteOnSuggestion: vi.fn().mockResolvedValue({ status: 'removed' }),
    });
    await openSuggestions(user);
    await user.click(await screen.findByRole('button', { name: 'Vote against' }));

    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Your vote took “Track 7” off the suggestions'));
    expect(screen.queryByText('Track 7')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /songs/i }));
    expect(rowTitles()).toEqual(['Track 1', 'Track 2', 'Track 3']);
  });

  it('a guest is asked to sign in and no vote is sent', async () => {
    authState.user = null;
    const { ctx, user } = await renderPage(community());
    await openSuggestions(user);
    await user.click((await screen.findAllByRole('button', { name: 'Vote to add' }))[0]);
    expect(feedback.info).toHaveBeenCalledWith('Sign in to vote on suggestions');
    expect(ctx.voteOnSuggestion).not.toHaveBeenCalled();
  });

  it('a failed vote tells the user and changes nothing', async () => {
    const { user } = await renderPage(community(), {
      voteOnSuggestion: vi.fn().mockRejectedValue(new Error('down')),
    });
    await openSuggestions(user);
    await user.click(await screen.findByRole('button', { name: 'Vote to add' }));
    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith("Couldn't record your vote. Try again."));
    expect(screen.getByRole('button', { name: 'Vote to add' })).toHaveTextContent('2');
  });

  it('a failed suggestions load leaves the songs showing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    http.get.mockRejectedValue(new Error('down'));
    await renderPage(community());
    expect(rowTitles()).toEqual(['Track 1', 'Track 2', 'Track 3']);
    expect(screen.getByRole('tab', { name: /suggestions/i })).toHaveTextContent(/^Suggestions\s*0$/);
  });

  it('Activity loads once, on first open, and reads like a sentence', async () => {
    http.get.mockImplementation(async (url) => {
      if (/\/activity/.test(url)) {
        return { data: [{ activityId: 'a1', username: 'maya', actionType: 'suggested_song', songTitle: 'Track 7', createdAt: new Date(Date.now() - 5 * 60000).toISOString() }] };
      }
      return { data: [] };
    });
    const { user } = await renderPage(community());
    const activityCalls = () => http.get.mock.calls.filter(([url]) => /\/activity/.test(url));
    expect(activityCalls()).toHaveLength(0);

    await user.click(screen.getByRole('tab', { name: /activity/i }));
    await waitFor(() => expect(document.querySelector('.plp-activity-item')).not.toBeNull());
    const item = document.querySelector('.plp-activity-item');
    expect(item).toHaveTextContent('maya suggested song “Track 7”');
    expect(item.querySelector('.plp-activity-time')).toHaveTextContent('5m ago');
    expect(activityCalls()[0][0]).toBe('/v1/playlists/pl-1/activity?page=0&size=30');

    await user.click(screen.getByRole('tab', { name: /songs/i }));
    await user.click(screen.getByRole('tab', { name: /activity/i }));
    expect(activityCalls()).toHaveLength(1);
  });

  it('says so when there is no activity', async () => {
    const { user } = await renderPage(community());
    await user.click(screen.getByRole('tab', { name: /activity/i }));
    expect(await screen.findByText('No activity yet')).toBeInTheDocument();
  });
});
