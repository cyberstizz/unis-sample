// src/playlists.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Playlists from './playlists';
import { PlayerContext } from './context/playercontext';

function renderPlaylists(contextOverrides = {}) {
  const contextValue = {
    playlists: [
      {
        id: 1,
        name: 'Late Night Vibes',
        tracks: [
          { id: 101, title: 'Track One' },
          { id: 102, title: 'Track Two' },
        ],
      },
      {
        id: 2,
        name: 'Morning Energy',
        tracks: [],
      },
    ],
    createPlaylist: vi.fn(),
    loadPlaylist: vi.fn(),
    addToPlaylist: vi.fn(),
    removeFromPlaylist: vi.fn(),
    reorderPlaylist: vi.fn(),
    ...contextOverrides,
  };

  render(
    <PlayerContext.Provider value={contextValue}>
      <Playlists />
    </PlayerContext.Provider>
  );

  return contextValue;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Playlists', () => {
  it('renders the playlists title, input, and create button', () => {
    renderPlaylists();

    expect(screen.getByRole('heading', { name: 'Playlists' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('New Playlist Name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('renders playlists with their track counts', () => {
    renderPlaylists();

    expect(screen.getByText('Late Night Vibes (2 tracks)')).toBeInTheDocument();
    expect(screen.getByText('Morning Energy (0 tracks)')).toBeInTheDocument();
  });

  it('creates a playlist and clears the input when a name is entered', async () => {
    const user = userEvent.setup();
    const createPlaylist = vi.fn();

    renderPlaylists({ createPlaylist });

    const input = screen.getByPlaceholderText('New Playlist Name');

    await user.type(input, 'Workout Mix');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(createPlaylist).toHaveBeenCalledTimes(1);
    expect(createPlaylist).toHaveBeenCalledWith('Workout Mix');
    expect(input).toHaveValue('');
  });

  it('does not create a playlist when the input is empty', async () => {
    const user = userEvent.setup();
    const createPlaylist = vi.fn();

    renderPlaylists({ createPlaylist });

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(createPlaylist).not.toHaveBeenCalled();
  });

  it('loads the selected playlist when its Load button is clicked', async () => {
    const user = userEvent.setup();
    const loadPlaylist = vi.fn();

    const contextValue = renderPlaylists({ loadPlaylist });

    const loadButtons = screen.getAllByRole('button', { name: 'Load' });

    await user.click(loadButtons[0]);

    expect(loadPlaylist).toHaveBeenCalledTimes(1);
    expect(loadPlaylist).toHaveBeenCalledWith(contextValue.playlists[0]);
  });
});