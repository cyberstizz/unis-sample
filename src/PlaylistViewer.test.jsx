// src/PlaylistViewer.test.jsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

vi.mock('./playlistViewer.scss', () => ({}));

vi.mock('./utils/buildUrl', () => ({
  buildUrl: (url) => url || '',
}));

vi.mock('./components/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Import the real context object shape from the same path PlaylistViewer uses.
// We do not mock the module because we can provide the value with Provider.
import { PlayerContext } from './context/playercontext';
import axiosInstance from './components/axiosInstance';

// Import AFTER mocks.
import PlaylistViewer from './PlaylistViewer';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

const activeTrackOne = {
  id: 'song-1',
  songId: 'song-1',
  playlistItemId: 'item-1',
  title: 'Song One',
  artistName: 'Artist One',
  artworkUrl: '/art/song-one.jpg',
  fileUrl: '/media/song-one.mp3',
  duration: 191410,
  status: 'active',
};

const activeTrackTwo = {
  id: 'song-2',
  songId: 'song-2',
  playlistItemId: 'item-2',
  title: 'Song Two',
  artistName: 'Artist Two',
  artworkUrl: '/art/song-two.jpg',
  fileUrl: '/media/song-two.mp3',
  duration: 120000,
  status: 'active',
};

const pendingTrack = {
  id: 'song-3',
  songId: 'song-3',
  playlistItemId: 'item-3',
  title: 'Pending Song',
  artistName: 'Pending Artist',
  artworkUrl: '/art/pending.jpg',
  fileUrl: '/media/pending.mp3',
  duration: 90000,
  status: 'pending',
  upvotes: 2,
  downvotes: 1,
  addedByUsername: 'testuser',
};

function makePlaylist(overrides = {}) {
  return {
    id: 'playlist-1',
    playlistId: 'playlist-1',
    name: 'My Playlist',
    description: 'A great playlist',
    type: 'user',
    visibility: 'public',
    creatorName: 'Charles',
    followerCount: 3,
    owner: true,
    following: false,
    coverImageUrl: null,
    tracks: [activeTrackOne, activeTrackTwo],
    ...overrides,
  };
}

function makeCommunityPlaylist(overrides = {}) {
  return makePlaylist({
    name: 'Community Playlist',
    type: 'community',
    visibility: 'public',
    tracks: [activeTrackOne, pendingTrack],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// MOCK CONTEXT FACTORY
// ---------------------------------------------------------------------------

function makePlayerContext(overrides = {}) {
  return {
    removeFromPlaylist: vi.fn().mockResolvedValue(undefined),
    reorderPlaylist: vi.fn().mockResolvedValue(undefined),
    updatePlaylist: vi.fn().mockResolvedValue(undefined),
    deletePlaylist: vi.fn().mockResolvedValue(undefined),
    playMedia: vi.fn(),
    playNext: vi.fn(),
    playLater: vi.fn(),
    loadPlaylistDetails: vi.fn().mockResolvedValue(makePlaylist()),
    followPlaylist: vi.fn().mockResolvedValue(undefined),
    unfollowPlaylist: vi.fn().mockResolvedValue(undefined),
    voteOnSuggestion: vi.fn().mockResolvedValue({
      upvotes: 3,
      downvotes: 1,
      status: 'pending',
    }),
    ...overrides,
  };
}

async function renderPlaylistViewer({
  playlistId = 'playlist-1',
  onClose = vi.fn(),
  contextOverrides = {},
} = {}) {
  const contextValue = makePlayerContext(contextOverrides);

  const result = render(
    <PlayerContext.Provider value={contextValue}>
      <PlaylistViewer playlistId={playlistId} onClose={onClose} />
    </PlayerContext.Provider>
  );

  return {
    ...result,
    contextValue,
    onClose,
  };
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// LOADING / INITIAL RENDER
// ===========================================================================

describe('PlaylistViewer — loading and initial render', () => {
  it('shows a loading state while playlist details are being fetched', async () => {
    const loadPlaylistDetails = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(makePlaylist()), 100);
        })
    );

    renderPlaylistViewer({
      contextOverrides: { loadPlaylistDetails },
    });

    expect(screen.getByText(/loading playlist/i)).toBeInTheDocument();
  });

  it('loads playlist details for the given playlistId', async () => {
    const { contextValue } = await renderPlaylistViewer();

    await screen.findByText('My Playlist');

    expect(contextValue.loadPlaylistDetails).toHaveBeenCalledTimes(1);
    expect(contextValue.loadPlaylistDetails).toHaveBeenCalledWith('playlist-1');
  });

  it('renders playlist metadata and active tracks', async () => {
    await renderPlaylistViewer();

    expect(await screen.findByText('My Playlist')).toBeInTheDocument();
    expect(screen.getByText('A great playlist')).toBeInTheDocument();
    expect(screen.getByText('Charles')).toBeInTheDocument();
    expect(screen.getByText('2 songs')).toBeInTheDocument();
    expect(screen.getByText('3 followers')).toBeInTheDocument();

    expect(screen.getByText('Song One')).toBeInTheDocument();
    expect(screen.getByText('Artist One')).toBeInTheDocument();
    expect(screen.getByText('Song Two')).toBeInTheDocument();
    expect(screen.getByText('Artist Two')).toBeInTheDocument();
  });

  it('formats millisecond durations correctly', async () => {
    await renderPlaylistViewer();

    await screen.findByText('Song One');

    // 191410ms should display as 3:11, not 3190:10.
    expect(screen.getByText('3:11')).toBeInTheDocument();
    expect(screen.getByText('2:00')).toBeInTheDocument();
  });

  it('renders an empty state when the playlist has no tracks', async () => {
    await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(
          makePlaylist({
            tracks: [],
            followerCount: 0,
          })
        ),
      },
    });

    expect(await screen.findByText(/no tracks yet/i)).toBeInTheDocument();
    expect(screen.getByText(/add songs from the player/i)).toBeInTheDocument();
  });

  it('returns null when loadPlaylistDetails returns no data', async () => {
    const { container } = await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(null),
      },
    });

    await waitFor(() => {
      expect(screen.queryByText(/loading playlist/i)).not.toBeInTheDocument();
    });

    expect(container.textContent).toBe('');
  });
});

// ===========================================================================
// CLOSE BEHAVIOR
// ===========================================================================

describe('PlaylistViewer — close behavior', () => {
  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    await renderPlaylistViewer({ onClose });

    await screen.findByText('My Playlist');

    await user.click(screen.getByTitle(/close/i));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the overlay backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = await renderPlaylistViewer({ onClose });

    await screen.findByText('My Playlist');

    const overlay = container.querySelector('.pv-overlay');
    await user.click(overlay);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the inner container is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = await renderPlaylistViewer({ onClose });

    await screen.findByText('My Playlist');

    const inner = container.querySelector('.pv-container');
    await user.click(inner);

    expect(onClose).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// PLAYBACK / QUEUE ACTIONS
// ===========================================================================

describe('PlaylistViewer — playback and queue actions', () => {
  it('clicking a track calls playMedia with that track and the playlist queue', async () => {
    const user = userEvent.setup();
    const { contextValue } = await renderPlaylistViewer();

    await screen.findByText('Song Two');

    await user.click(screen.getByText('Song Two'));

    expect(contextValue.playMedia).toHaveBeenCalledTimes(1);

    const [track, queue, source] = contextValue.playMedia.mock.calls[0];

    expect(track.title).toBe('Song Two');
    expect(queue).toHaveLength(2);
    expect(source).toBe('My Playlist');
  });

  it('Play All starts playback from the first track with the full local queue', async () => {
    const user = userEvent.setup();
    const { contextValue } = await renderPlaylistViewer();

    await screen.findByText('My Playlist');

    await user.click(screen.getByRole('button', { name: /play all/i }));

    expect(contextValue.playMedia).toHaveBeenCalledTimes(1);

    const [track, queue, source] = contextValue.playMedia.mock.calls[0];

    expect(track.title).toBe('Song One');
    expect(queue.map((t) => t.title)).toEqual(['Song One', 'Song Two']);
    expect(source).toBe('My Playlist');
    expect(screen.getByText(/playing all tracks/i)).toBeInTheDocument();
  });

  it('Play All is disabled when the playlist has no tracks', async () => {
    await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(
          makePlaylist({
            tracks: [],
            followerCount: 0,
          })
        ),
      },
    });

    const button = await screen.findByRole('button', { name: /play all/i });

    expect(button).toBeDisabled();
  });

  it('Play Next adds tracks in reverse order so the original order plays next', async () => {
    const user = userEvent.setup();
    const { contextValue } = await renderPlaylistViewer();

    await screen.findByText('My Playlist');

    await user.click(screen.getByRole('button', { name: /play next/i }));

    expect(contextValue.playNext).toHaveBeenCalledTimes(2);
    expect(contextValue.playNext.mock.calls[0][0].title).toBe('Song Two');
    expect(contextValue.playNext.mock.calls[1][0].title).toBe('Song One');
    expect(screen.getByText(/added to play next/i)).toBeInTheDocument();
  });

  it('Add to Queue appends each track in playlist order', async () => {
    const user = userEvent.setup();
    const { contextValue } = await renderPlaylistViewer();

    await screen.findByText('My Playlist');

    await user.click(screen.getByRole('button', { name: /add to queue/i }));

    expect(contextValue.playLater).toHaveBeenCalledTimes(2);
    expect(contextValue.playLater.mock.calls[0][0].title).toBe('Song One');
    expect(contextValue.playLater.mock.calls[1][0].title).toBe('Song Two');
    expect(screen.getByText(/added to queue/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// OWNER ACTIONS — REMOVE TRACK / SETTINGS / DELETE
// ===========================================================================

describe('PlaylistViewer — owner actions', () => {
  it('shows Settings and remove buttons for the playlist owner', async () => {
    await renderPlaylistViewer();

    expect(await screen.findByRole('button', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getAllByTitle(/remove from playlist/i)).toHaveLength(2);
  });

  it('does not show Settings or remove buttons for non-owners', async () => {
    await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(
          makePlaylist({
            owner: false,
            isOwner: false,
            following: false,
            isFollowing: false,
            visibility: 'public',
          })
        ),
      },
    });

    await screen.findByText('My Playlist');

    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.queryAllByTitle(/remove from playlist/i)).toHaveLength(0);
  });

  it('removes a track after confirmation', async () => {
    const user = userEvent.setup();
    const { contextValue } = await renderPlaylistViewer();

    await screen.findByText('Song One');

    await user.click(screen.getAllByTitle(/remove from playlist/i)[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Remove "Song One"')
    );

    await waitFor(() => {
      expect(contextValue.removeFromPlaylist).toHaveBeenCalledWith(
        'playlist-1',
        'item-1'
      );
    });

    expect(screen.queryByText('Song One')).not.toBeInTheDocument();
    expect(screen.getByText(/removed "song one"/i)).toBeInTheDocument();
  });

  it('does not remove a track when the confirmation is cancelled', async () => {
    const user = userEvent.setup();

    window.confirm.mockReturnValueOnce(false);

    const { contextValue } = await renderPlaylistViewer();

    await screen.findByText('Song One');

    await user.click(screen.getAllByTitle(/remove from playlist/i)[0]);

    expect(contextValue.removeFromPlaylist).not.toHaveBeenCalled();
    expect(screen.getByText('Song One')).toBeInTheDocument();
  });

  it('opens settings, saves changed name/description/visibility, and calls updatePlaylist', async () => {
    const user = userEvent.setup();
    const { contextValue, container } = await renderPlaylistViewer();

    await screen.findByText('My Playlist');

    await user.click(screen.getByRole('button', { name: /settings/i }));

    expect(screen.getByText(/playlist settings/i)).toBeInTheDocument();

    const settingsPanel = container.querySelector('.pv-settings-panel');

    const nameInput = within(settingsPanel).getByDisplayValue('My Playlist');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Playlist');

    const descriptionInput = within(settingsPanel).getByDisplayValue('A great playlist');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Better description');

    await user.click(within(settingsPanel).getByText('Private'));

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(contextValue.updatePlaylist).toHaveBeenCalledWith('playlist-1', {
        name: 'Updated Playlist',
        description: 'Better description',
        visibility: 'private',
      });
    });

    expect(screen.getByText(/settings saved/i)).toBeInTheDocument();
    expect(screen.queryByText(/playlist settings/i)).not.toBeInTheDocument();
  });

  it('does not call updatePlaylist when settings are saved without changes', async () => {
    const user = userEvent.setup();
    const { contextValue } = await renderPlaylistViewer();

    await screen.findByText('My Playlist');

    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.queryByText(/playlist settings/i)).not.toBeInTheDocument();
    });

    expect(contextValue.updatePlaylist).not.toHaveBeenCalled();
    expect(screen.getByText(/settings saved/i)).toBeInTheDocument();
  });

  it('deletes the playlist after confirmation and calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { contextValue } = await renderPlaylistViewer({ onClose });

    await screen.findByText('My Playlist');

    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /delete this playlist/i }));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Delete playlist "My Playlist"?')
    );

    await waitFor(() => {
      expect(contextValue.deletePlaylist).toHaveBeenCalledWith('playlist-1');
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not delete the playlist when confirmation is cancelled', async () => {
    const user = userEvent.setup();

    window.confirm.mockReturnValueOnce(false);

    const { contextValue, onClose } = await renderPlaylistViewer();

    await screen.findByText('My Playlist');

    await user.click(screen.getByRole('button', { name: /settings/i }));
    await user.click(screen.getByRole('button', { name: /delete this playlist/i }));

    expect(contextValue.deletePlaylist).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// FOLLOW / UNFOLLOW
// ===========================================================================

describe('PlaylistViewer — follow and unfollow', () => {
  it('shows Follow for a non-owner public playlist', async () => {
    await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(
          makePlaylist({
            owner: false,
            isOwner: false,
            following: false,
            isFollowing: false,
            visibility: 'public',
          })
        ),
      },
    });

    expect(await screen.findByRole('button', { name: /follow/i })).toBeInTheDocument();
  });

  it('follows a non-owner public playlist', async () => {
    const user = userEvent.setup();

    const { contextValue } = await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(
          makePlaylist({
            owner: false,
            isOwner: false,
            following: false,
            isFollowing: false,
            visibility: 'public',
            followerCount: 0,
          })
        ),
      },
    });

    await screen.findByText('My Playlist');

    await user.click(screen.getByRole('button', { name: /follow/i }));

    await waitFor(() => {
      expect(contextValue.followPlaylist).toHaveBeenCalledWith('playlist-1');
    });

    expect(screen.getByRole('button', { name: /following/i })).toBeInTheDocument();
  });

  it('unfollows a followed playlist', async () => {
    const user = userEvent.setup();

    const { contextValue } = await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(
          makePlaylist({
            owner: false,
            isOwner: false,
            following: true,
            isFollowing: true,
            visibility: 'public',
            followerCount: 4,
          })
        ),
      },
    });

    await screen.findByText('My Playlist');

    await user.click(screen.getByRole('button', { name: /following/i }));

    await waitFor(() => {
      expect(contextValue.unfollowPlaylist).toHaveBeenCalledWith('playlist-1');
    });

    expect(screen.getByRole('button', { name: /follow/i })).toBeInTheDocument();
    expect(screen.getByText(/unfollowed/i)).toBeInTheDocument();
  });

  it('does not show Follow for a private playlist', async () => {
    await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(
          makePlaylist({
            owner: false,
            isOwner: false,
            visibility: 'private',
          })
        ),
      },
    });

    await screen.findByText('My Playlist');

    expect(screen.queryByRole('button', { name: /follow/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// COMMUNITY PLAYLISTS
// ===========================================================================

describe('PlaylistViewer — community playlists', () => {
  it('renders community section tabs with active and pending counts', async () => {
    await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(makeCommunityPlaylist()),
      },
    });

    expect(await screen.findByText(/community playlist/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /tracks 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pending 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument();
  });

  it('shows pending suggestions in the Pending tab', async () => {
    const user = userEvent.setup();

    await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(makeCommunityPlaylist()),
      },
    });

    await screen.findByText(/community playlist/i);

    await user.click(screen.getByRole('button', { name: /pending 1/i }));

    expect(screen.getByText('Pending Song')).toBeInTheDocument();
    expect(screen.getByText(/suggested by testuser/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('votes on a pending suggestion', async () => {
    const user = userEvent.setup();

    const { contextValue } = await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(makeCommunityPlaylist()),
        voteOnSuggestion: vi.fn().mockResolvedValue({
          upvotes: 3,
          downvotes: 1,
          status: 'pending',
        }),
      },
    });

    await screen.findByText(/community playlist/i);

    await user.click(screen.getByRole('button', { name: /pending 1/i }));

    const pendingItem = screen.getByText('Pending Song').closest('.pv-item');
    const upvoteButton = pendingItem.querySelector('.pv-vote-up');

    await user.click(upvoteButton);

    await waitFor(() => {
      expect(contextValue.voteOnSuggestion).toHaveBeenCalledWith(
        'playlist-1',
        'item-3',
        'up'
      );
    });
  });

  it('loads activity when the Activity tab is selected', async () => {
    const user = userEvent.setup();

    axiosInstance.get.mockResolvedValueOnce({
      data: [
        {
          activityId: 'activity-1',
          username: 'Charles',
          actionType: 'voted_up',
          songTitle: 'Song One',
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
    });

    await renderPlaylistViewer({
      contextOverrides: {
        loadPlaylistDetails: vi.fn().mockResolvedValue(makeCommunityPlaylist()),
      },
    });

    await screen.findByText(/community playlist/i);

    await user.click(screen.getByRole('button', { name: /activity/i }));

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith(
        '/v1/playlists/playlist-1/activity?page=0&size=30'
      );
    });

    expect(await screen.findByText('Charles')).toBeInTheDocument();
    expect(screen.getByText(/voted up/i)).toBeInTheDocument();
    expect(screen.getByText(/song one/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// COVER UPLOAD
// ===========================================================================

describe('PlaylistViewer — cover upload', () => {
  it('uploads a cover image for the owner', async () => {
    const user = userEvent.setup();

    axiosInstance.post.mockResolvedValueOnce({
      data: {
        coverImageUrl: '/covers/new-cover.jpg',
      },
    });

    await renderPlaylistViewer();

    await screen.findByText('My Playlist');

    const fileInput = document.querySelector('input[type="file"]');

    const file = new File(['cover'], 'cover.png', {
      type: 'image/png',
    });

    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    });

    const [url, formData] = axiosInstance.post.mock.calls[0];

    expect(url).toBe('/v1/playlists/playlist-1/cover');
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('cover')).toBe(file);
  });

  it('rejects cover images larger than 5MB', async () => {
    const user = userEvent.setup();

    await renderPlaylistViewer();

    await screen.findByText('My Playlist');

    const fileInput = document.querySelector('input[type="file"]');

    const largeFile = new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'huge.png', {
      type: 'image/png',
    });

    await user.upload(fileInput, largeFile);

    expect(window.alert).toHaveBeenCalledWith('Cover image must be under 5MB');
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });
});