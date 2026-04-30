import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaylistManager from './playlistManager';
import { PlayerContext } from './context/playercontext';
import axiosInstance from './components/axiosInstance';

vi.mock('./components/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('./playlistViewer', () => ({
  default: ({ playlistId, onClose }) => (
    <div data-testid="playlist-viewer">
      Playlist Viewer: {playlistId}
      <button onClick={onClose}>Close Viewer</button>
    </div>
  ),
}));

vi.mock('./utils/buildUrl', () => ({
  buildUrl: (url) => url,
}));

const defaultContextValue = {
  playlists: [
    {
      playlistId: 1,
      name: 'Late Night Vibes',
      songCount: 3,
      visibility: 'private',
      type: 'personal',
    },
  ],
  followedPlaylists: [],
  loading: false,
  refreshPlaylists: vi.fn(),
  loadFollowedPlaylists: vi.fn(),
  createPlaylist: vi.fn(),
};

function renderPlaylistManager(props = {}, contextOverrides = {}) {
  const contextValue = {
    ...defaultContextValue,
    ...contextOverrides,
  };

  return render(
    <PlayerContext.Provider value={contextValue}>
      <PlaylistManager open={true} onClose={vi.fn()} {...props} />
    </PlayerContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('PlaylistManager', () => {
  it('does not render when open is false', () => {
    render(
      <PlayerContext.Provider value={defaultContextValue}>
        <PlaylistManager open={false} onClose={vi.fn()} />
      </PlayerContext.Provider>
    );

    expect(screen.queryByText('Playlists')).not.toBeInTheDocument();
  });

  it('renders the playlist manager and calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();

    const { container } = render(
      <PlayerContext.Provider value={defaultContextValue}>
        <PlaylistManager open={true} onClose={onClose} />
      </PlayerContext.Provider>
    );

    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.getByText('Late Night Vibes')).toBeInTheDocument();

    const closeButton = container.querySelector('.pm-close');
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows personal playlists and opens PlaylistViewer when a playlist is selected', async () => {
    renderPlaylistManager();

    expect(screen.getByText('Late Night Vibes')).toBeInTheDocument();
    expect(screen.getByText('3 songs')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Late Night Vibes'));

    expect(screen.getByTestId('playlist-viewer')).toBeInTheDocument();
    expect(screen.getByText(/Playlist Viewer: 1/i)).toBeInTheDocument();
  });

  it('creates a personal playlist with the selected visibility', async () => {
    const createPlaylist = vi.fn().mockResolvedValue();

    renderPlaylistManager({}, { createPlaylist });

    await userEvent.click(screen.getByText('Create New Playlist'));

    const nameInput = screen.getByPlaceholderText(
      'Playlist name (e.g. Late Night Vibes)'
    );

    await userEvent.type(nameInput, '  Morning Energy  ');
    await userEvent.click(screen.getByText('Public'));
    await userEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(createPlaylist).toHaveBeenCalledWith('Morning Energy', 'personal', {
        visibility: 'public',
        coverImageUrl: null,
      });
    });
  });

  it('searches playlists from public tabs and displays the results', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: [
        {
          playlistId: 22,
          name: 'Jazz Around Town',
          songCount: 8,
          visibility: 'public',
          type: 'personal',
          creatorName: 'Charles',
        },
      ],
    });

    renderPlaylistManager();

    await userEvent.click(screen.getByText('Discover'));

    const searchInput = screen.getByPlaceholderText('Search playlists...');

    fireEvent.change(searchInput, {
      target: { value: 'jazz' },
    });

    await waitFor(() => {
      expect(axiosInstance.get).toHaveBeenCalledWith(
        '/v1/playlists/search?q=jazz'
      );
    });

    expect(await screen.findByText('Jazz Around Town')).toBeInTheDocument();
    expect(screen.getByText(/8 songs/i)).toBeInTheDocument();
    expect(screen.getByText(/by Charles/i)).toBeInTheDocument();
  });
});