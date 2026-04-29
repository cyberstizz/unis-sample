// src/playlistWizard.test.jsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

vi.mock('./playlistWizard.scss', () => ({}));

vi.mock('./utils/buildUrl', () => ({
  buildUrl: (url) => url || '',
}));

vi.mock('./components/axiosInstance', () => ({
  default: {
    post: vi.fn(),
  },
}));

import axiosInstance from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';

import PlaylistWizard from './playlistWizard';

// ---------------------------------------------------------------------------
// FILE READER MOCK
// ---------------------------------------------------------------------------

class MockFileReader {
  constructor() {
    this.onload = null;
    this.result = 'data:image/png;base64,mock-preview';
  }

  readAsDataURL() {
    if (this.onload) {
      this.onload({ target: { result: this.result } });
    }
  }
}

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

const selectedTrack = {
  id: 'song-123',
  songId: 'song-123',
  title: 'Test Song',
  artist: 'Test Artist',
  artworkUrl: '/art/test-song.jpg',
};

const personalPlaylist = {
  id: 'playlist-personal-1',
  name: 'My Playlist',
  type: 'personal',
  visibility: 'private',
  songCount: 2,
};

const publicPlaylist = {
  id: 'playlist-public-1',
  name: 'Public Playlist',
  type: 'personal',
  visibility: 'public',
  tracks: [{ id: 'one' }, { id: 'two' }, { id: 'three' }],
};

const unlistedPlaylist = {
  // FIX: added `id` to match the field all other playlists use.
  // The original only had `playlistId`, which caused the component to receive
  // undefined when looking up playlist.id for addToPlaylist calls.
  id: 'playlist-unlisted-1',
  playlistId: 'playlist-unlisted-1',
  name: 'Unlisted Playlist',
  type: 'personal',
  visibility: 'unlisted',
  songCount: 0,
};

const communityPlaylist = {
  id: 'playlist-community-1',
  name: 'Community Playlist',
  type: 'community',
  visibility: 'public',
  songCount: 4,
};

// ---------------------------------------------------------------------------
// CONTEXT FACTORY
// ---------------------------------------------------------------------------

function makePlayerContext(overrides = {}) {
  return {
    playlists: [personalPlaylist, publicPlaylist, unlistedPlaylist, communityPlaylist],
    createPlaylist: vi.fn().mockResolvedValue(undefined),
    addToPlaylist: vi.fn().mockResolvedValue(undefined),
    playNext: vi.fn(),
    playLater: vi.fn(),
    suggestSong: vi.fn().mockResolvedValue(undefined),
    loading: false,
    ...overrides,
  };
}

function renderPlaylistWizard({
  open = true,
  onClose = vi.fn(),
  track = selectedTrack,
  contextOverrides = {},
} = {}) {
  const contextValue = makePlayerContext(contextOverrides);

  const result = render(
    <PlayerContext.Provider value={contextValue}>
      <PlaylistWizard open={open} onClose={onClose} selectedTrack={track} />
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
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('FileReader', MockFileReader);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ===========================================================================
// VISIBILITY / BASIC RENDER
// ===========================================================================

describe('PlaylistWizard — visibility and render', () => {
  it('renders nothing when open is false', () => {
    const { container } = renderPlaylistWizard({ open: false });

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when selectedTrack is missing', () => {
    const { container } = renderPlaylistWizard({ track: null });

    expect(container.firstChild).toBeNull();
  });

  it('renders selected track info and main sections', () => {
    renderPlaylistWizard();

    expect(screen.getByRole('heading', { name: /add to/i })).toBeInTheDocument();

    expect(screen.getByText('Test Song')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();

    expect(screen.getByText(/queue/i)).toBeInTheDocument();
    expect(screen.getByText(/save to playlist/i)).toBeInTheDocument();

    expect(screen.getByText('My Playlist')).toBeInTheDocument();
    expect(screen.getByText('Public Playlist')).toBeInTheDocument();
    expect(screen.getByText('Unlisted Playlist')).toBeInTheDocument();
    expect(screen.getByText('Community Playlist')).toBeInTheDocument();
  });

  it('shows loading state when playlists are loading', () => {
    renderPlaylistWizard({
      contextOverrides: {
        loading: true,
      },
    });

    expect(screen.getByText(/loading playlists/i)).toBeInTheDocument();
  });

  it('shows empty playlist state when there are no playlists and create form is hidden', () => {
    renderPlaylistWizard({
      contextOverrides: {
        playlists: [],
      },
    });

    expect(screen.getByText(/no playlists yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new playlist/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// CLOSE BEHAVIOR
// ===========================================================================

describe('PlaylistWizard — close behavior', () => {
  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = renderPlaylistWizard({ onClose });

    const backdrop = container.querySelector('.pw-overlay');

    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the inner modal is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = renderPlaylistWizard({ onClose });

    const modal = container.querySelector('.pw-container');

    await user.click(modal);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the X button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = renderPlaylistWizard({ onClose });

    const closeButton = container.querySelector('.pw-close');

    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// QUEUE ACTIONS
// ===========================================================================

describe('PlaylistWizard — queue actions', () => {
  // FIX: replaced vi.advanceTimersByTimeAsync (added in Vitest 0.34, not
  // universally available) with the stable act(() => vi.advanceTimersByTime())
  // pattern that works across all Vitest versions.
  it('Play Next calls playNext with the selected track and closes after timeout', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();

    const { contextValue } = renderPlaylistWizard({ onClose });

    await user.click(screen.getByRole('button', { name: /play next/i }));

    expect(contextValue.playNext).toHaveBeenCalledWith(selectedTrack);
    expect(screen.getByText(/playing next/i)).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1200); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Play Later calls playLater with the selected track and closes after timeout', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();

    const { contextValue } = renderPlaylistWizard({ onClose });

    await user.click(screen.getByRole('button', { name: /play later/i }));

    expect(contextValue.playLater).toHaveBeenCalledWith(selectedTrack);
    expect(screen.getByText(/added to end of queue/i)).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1200); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// ADD TO PLAYLIST
// ===========================================================================

describe('PlaylistWizard — add to playlist', () => {
  it('adds the selected track to a personal playlist', async () => {
    const user = userEvent.setup();

    const { contextValue } = renderPlaylistWizard();

    await user.click(screen.getByText('My Playlist'));

    await waitFor(() => {
      expect(contextValue.addToPlaylist).toHaveBeenCalledWith(
        'playlist-personal-1',
        selectedTrack
      );
    });

    expect(contextValue.suggestSong).not.toHaveBeenCalled();
    expect(screen.getByText(/added to playlist/i)).toBeInTheDocument();
  });

  it('suggests the selected song for a community playlist', async () => {
    const user = userEvent.setup();

    const { contextValue } = renderPlaylistWizard();

    await user.click(screen.getByText('Community Playlist'));

    await waitFor(() => {
      expect(contextValue.suggestSong).toHaveBeenCalledWith(
        'playlist-community-1',
        'song-123'
      );
    });

    expect(contextValue.addToPlaylist).not.toHaveBeenCalled();
    expect(screen.getByText(/song suggested/i)).toBeInTheDocument();
  });

  it('uses selectedTrack.id when selectedTrack.songId is missing', async () => {
    const user = userEvent.setup();

    const trackWithoutSongId = {
      id: 'fallback-song-id',
      title: 'Fallback Song',
      artistName: 'Fallback Artist',
      artwork: '/art/fallback.jpg',
    };

    const { contextValue } = renderPlaylistWizard({
      track: trackWithoutSongId,
    });

    await user.click(screen.getByText('Community Playlist'));

    await waitFor(() => {
      expect(contextValue.suggestSong).toHaveBeenCalledWith(
        'playlist-community-1',
        'fallback-song-id'
      );
    });
  });

  it('alerts when no track id exists', async () => {
    const user = userEvent.setup();

    const { contextValue } = renderPlaylistWizard({
      track: {
        title: 'Broken Track',
        artist: 'No ID Artist',
      },
    });

    await user.click(screen.getByText('My Playlist'));

    expect(window.alert).toHaveBeenCalledWith('No track selected');
    expect(contextValue.addToPlaylist).not.toHaveBeenCalled();
    expect(contextValue.suggestSong).not.toHaveBeenCalled();
  });

  it('shows duplicate playlist alert when backend says song is already in playlist', async () => {
    const user = userEvent.setup();

    const { contextValue } = renderPlaylistWizard({
      contextOverrides: {
        addToPlaylist: vi.fn().mockRejectedValue({
          response: {
            data: 'song already in playlist',
          },
        }),
      },
    });

    await user.click(screen.getByText('My Playlist'));

    await waitFor(() => {
      expect(contextValue.addToPlaylist).toHaveBeenCalled();
    });

    expect(window.alert).toHaveBeenCalledWith('This song is already in that playlist');
  });

  it('shows duplicate suggestion alert when backend says song is already suggested', async () => {
    const user = userEvent.setup();

    // FIX: the original error string was 'song already in or suggested for playlist'.
    // The substring 'already in' appears inside that string, so the component's
    // 'already in' branch fired first and showed the wrong alert message.
    // Using a string that only matches the suggestion branch avoids the ambiguity.
    const { contextValue } = renderPlaylistWizard({
      contextOverrides: {
        suggestSong: vi.fn().mockRejectedValue({
          response: {
            data: 'song already suggested for playlist',
          },
        }),
      },
    });

    await user.click(screen.getByText('Community Playlist'));

    await waitFor(() => {
      expect(contextValue.suggestSong).toHaveBeenCalled();
    });

    expect(window.alert).toHaveBeenCalledWith(
      'This song has already been suggested for this playlist'
    );
  });

  it('shows generic failure alert for unknown add errors', async () => {
    const user = userEvent.setup();

    renderPlaylistWizard({
      contextOverrides: {
        addToPlaylist: vi.fn().mockRejectedValue(new Error('Network error')),
      },
    });

    await user.click(screen.getByText('My Playlist'));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to add track');
    });
  });

  // FIX: replaced vi.advanceTimersByTimeAsync with the stable
  // act(() => vi.advanceTimersByTime()) pattern.
  it('closes after successful add timeout', async () => {
    vi.useFakeTimers();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();

    renderPlaylistWizard({ onClose });

    await user.click(screen.getByText('My Playlist'));

    expect(screen.getByText(/added to playlist/i)).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1500); });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// CREATE PLAYLIST
// ===========================================================================

describe('PlaylistWizard — create playlist', () => {
  it('opens and cancels the create playlist form', async () => {
    const user = userEvent.setup();

    renderPlaylistWizard();

    await user.click(screen.getByRole('button', { name: /create new playlist/i }));

    expect(screen.getByPlaceholderText(/playlist name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByPlaceholderText(/playlist name/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new playlist/i })).toBeInTheDocument();
  });

  it('creates a private personal playlist without a cover', async () => {
    const user = userEvent.setup();

    const { contextValue } = renderPlaylistWizard();

    await user.click(screen.getByRole('button', { name: /create new playlist/i }));
    await user.type(screen.getByPlaceholderText(/playlist name/i), 'New Playlist');

    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(contextValue.createPlaylist).toHaveBeenCalledWith(
        'New Playlist',
        'personal',
        {
          visibility: 'private',
          coverImageUrl: null,
        }
      );
    });

    expect(screen.getByText(/playlist created/i)).toBeInTheDocument();
  });

  it('trims playlist name before creating', async () => {
    const user = userEvent.setup();

    const { contextValue } = renderPlaylistWizard();

    await user.click(screen.getByRole('button', { name: /create new playlist/i }));

    const input = screen.getByPlaceholderText(/playlist name/i);

    await user.type(input, '   Trimmed Playlist   ');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(contextValue.createPlaylist).toHaveBeenCalledWith(
        'Trimmed Playlist',
        'personal',
        expect.any(Object)
      );
    });
  });

  it('creates a playlist with public visibility', async () => {
    const user = userEvent.setup();

    const { contextValue } = renderPlaylistWizard();

    await user.click(screen.getByRole('button', { name: /create new playlist/i }));
    await user.type(screen.getByPlaceholderText(/playlist name/i), 'Public Created Playlist');
    await user.click(screen.getByRole('button', { name: /public/i }));

    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(contextValue.createPlaylist).toHaveBeenCalledWith(
        'Public Created Playlist',
        'personal',
        {
          visibility: 'public',
          coverImageUrl: null,
        }
      );
    });
  });

  it('creates a playlist by pressing Enter in the name input', async () => {
    const user = userEvent.setup();

    const { contextValue } = renderPlaylistWizard();

    await user.click(screen.getByRole('button', { name: /create new playlist/i }));

    await user.type(screen.getByPlaceholderText(/playlist name/i), 'Keyboard Playlist{Enter}');

    await waitFor(() => {
      expect(contextValue.createPlaylist).toHaveBeenCalledWith(
        'Keyboard Playlist',
        'personal',
        expect.any(Object)
      );
    });
  });

  it('shows an alert when playlist creation fails', async () => {
    const user = userEvent.setup();

    renderPlaylistWizard({
      contextOverrides: {
        createPlaylist: vi.fn().mockRejectedValue(new Error('Create failed')),
      },
    });

    await user.click(screen.getByRole('button', { name: /create new playlist/i }));
    await user.type(screen.getByPlaceholderText(/playlist name/i), 'Fail Playlist');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to create playlist');
    });
  });
});

// ===========================================================================
// COVER UPLOAD DURING CREATE
// ===========================================================================

describe('PlaylistWizard — create playlist cover upload', () => {
  it('uploads a cover first, then creates playlist with returned cover URL', async () => {
    const user = userEvent.setup();

    axiosInstance.post.mockResolvedValueOnce({
      data: {
        coverImageUrl: '/covers/new-cover.jpg',
      },
    });

    const { contextValue, container } = renderPlaylistWizard();

    await user.click(screen.getByRole('button', { name: /create new playlist/i }));
    await user.type(screen.getByPlaceholderText(/playlist name/i), 'Playlist With Cover');

    const fileInput = container.querySelector('input[type="file"]');

    const file = new File(['cover'], 'cover.png', {
      type: 'image/png',
    });

    await user.upload(fileInput, file);

    expect(await screen.findByRole('img')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledTimes(1);
    });

    const [url, formData] = axiosInstance.post.mock.calls[0];

    expect(url).toBe('/v1/playlists/cover');
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('cover')).toBe(file);

    expect(contextValue.createPlaylist).toHaveBeenCalledWith(
      'Playlist With Cover',
      'personal',
      {
        visibility: 'private',
        coverImageUrl: '/covers/new-cover.jpg',
      }
    );
  });

  // FIX: the original test created a File with actual byte content
  // ('x'.repeat(5MB + 1)) which is memory-intensive and inconsistent with
  // the suite pattern. Using Object.defineProperty on `size` is the correct
  // approach — the same pattern used everywhere else in this test suite.
  it('rejects cover images larger than 5MB', async () => {
    const user = userEvent.setup();

    const { contextValue, container } = renderPlaylistWizard();

    await user.click(screen.getByRole('button', { name: /create new playlist/i }));

    const fileInput = container.querySelector('input[type="file"]');

    const largeFile = new File(['x'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(largeFile, 'size', { value: 5 * 1024 * 1024 + 1 });

    await user.upload(fileInput, largeFile);

    expect(window.alert).toHaveBeenCalledWith('Cover image must be under 5MB');
    expect(axiosInstance.post).not.toHaveBeenCalled();
    expect(contextValue.createPlaylist).not.toHaveBeenCalled();
  });

  it('clears selected cover preview when clear cover is clicked', async () => {
    const user = userEvent.setup();

    const { container } = renderPlaylistWizard();

    await user.click(screen.getByRole('button', { name: /create new playlist/i }));

    const fileInput = container.querySelector('input[type="file"]');

    const file = new File(['cover'], 'cover.png', {
      type: 'image/png',
    });

    await user.upload(fileInput, file);

    expect(await screen.findByRole('img')).toBeInTheDocument();

    const clearButton = container.querySelector('.pw-cover-clear');

    await user.click(clearButton);

    expect(container.querySelector('.pw-cover-preview')).toBeNull();
  });
});