import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaylistPanel from './playlistPanel';
import { PlayerContext } from './context/playercontext';

vi.mock('./playlistViewer', () => ({
  default: ({ title, tracks, onClose, onSelect, onRemove, onReorder }) => (
    <div data-testid="playlist-viewer">
      <h4>{title}</h4>

      <ul>
        {tracks.map((track) => (
          <li key={track.id}>{track.title}</li>
        ))}
      </ul>

      <button onClick={onClose}>Close Viewer</button>
      <button onClick={onSelect}>Select Track</button>
      <button onClick={() => onRemove(101)}>Remove First Track</button>
      <button
        onClick={() =>
          onReorder([
            { id: 202, title: 'Second Song' },
            { id: 101, title: 'First Song' },
          ])
        }
      >
        Reorder Tracks
      </button>
    </div>
  ),
}));

function renderPlaylistPanel(playlists = []) {
  return render(
    <PlayerContext.Provider value={{ playlists }}>
      <PlaylistPanel />
    </PlayerContext.Provider>
  );
}

const mockPlaylists = [
  {
    id: 1,
    name: 'Default Queue',
    isDefault: true,
    tracks: [{ id: 999, title: 'Hidden Default Song' }],
  },
  {
    id: 2,
    name: 'Late Night Vibes',
    isDefault: false,
    tracks: [
      { id: 101, title: 'First Song' },
      { id: 202, title: 'Second Song' },
    ],
  },
  {
    id: 3,
    name: 'Morning Energy',
    isDefault: false,
    tracks: [{ id: 303, title: 'Third Song' }],
  },
];

describe('PlaylistPanel', () => {
  it('renders the playlist panel title', () => {
    renderPlaylistPanel(mockPlaylists);

    expect(screen.getByText('Your Playlists')).toBeInTheDocument();
  });

  it('renders non-default playlists with their track counts', () => {
    renderPlaylistPanel(mockPlaylists);

    expect(screen.getByText('Late Night Vibes')).toBeInTheDocument();
    expect(screen.getByText('2 tracks')).toBeInTheDocument();

    expect(screen.getByText('Morning Energy')).toBeInTheDocument();
    expect(screen.getByText('1 tracks')).toBeInTheDocument();
  });

  it('does not render default playlists', () => {
    renderPlaylistPanel(mockPlaylists);

    expect(screen.queryByText('Default Queue')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden Default Song')).not.toBeInTheDocument();
  });

  it('opens PlaylistViewer with the selected playlist title and tracks', async () => {
    renderPlaylistPanel(mockPlaylists);

    const playlistItem = screen
      .getByText('Late Night Vibes')
      .closest('.ppanel-item');

    const openButton = within(playlistItem).getByText('Open');

    await userEvent.click(openButton);

    expect(screen.getByTestId('playlist-viewer')).toBeInTheDocument();
    expect(screen.getByText('Late Night Vibes')).toBeInTheDocument();
    expect(screen.getByText('First Song')).toBeInTheDocument();
    expect(screen.getByText('Second Song')).toBeInTheDocument();
  });

  it('closes PlaylistViewer when onClose is called', async () => {
    renderPlaylistPanel(mockPlaylists);

    const playlistItem = screen
      .getByText('Late Night Vibes')
      .closest('.ppanel-item');

    await userEvent.click(within(playlistItem).getByText('Open'));

    expect(screen.getByTestId('playlist-viewer')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Close Viewer'));

    expect(screen.queryByTestId('playlist-viewer')).not.toBeInTheDocument();
  });

  it('closes PlaylistViewer when onSelect is called', async () => {
    renderPlaylistPanel(mockPlaylists);

    const playlistItem = screen
      .getByText('Late Night Vibes')
      .closest('.ppanel-item');

    await userEvent.click(within(playlistItem).getByText('Open'));

    expect(screen.getByTestId('playlist-viewer')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Select Track'));

    expect(screen.queryByTestId('playlist-viewer')).not.toBeInTheDocument();
  });

  it('removes a track from the local viewer state when onRemove is called', async () => {
    renderPlaylistPanel(mockPlaylists);

    const playlistItem = screen
      .getByText('Late Night Vibes')
      .closest('.ppanel-item');

    await userEvent.click(within(playlistItem).getByText('Open'));

    expect(screen.getByText('First Song')).toBeInTheDocument();
    expect(screen.getByText('Second Song')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Remove First Track'));

    expect(screen.queryByText('First Song')).not.toBeInTheDocument();
    expect(screen.getByText('Second Song')).toBeInTheDocument();
  });

  it('reorders tracks in the local viewer state when onReorder is called', async () => {
    renderPlaylistPanel(mockPlaylists);

    const playlistItem = screen
      .getByText('Late Night Vibes')
      .closest('.ppanel-item');

    await userEvent.click(within(playlistItem).getByText('Open'));

    await userEvent.click(screen.getByText('Reorder Tracks'));

    const viewer = screen.getByTestId('playlist-viewer');
    const tracks = within(viewer).getAllByRole('listitem');

    expect(tracks[0]).toHaveTextContent('Second Song');
    expect(tracks[1]).toHaveTextContent('First Song');
  });
});