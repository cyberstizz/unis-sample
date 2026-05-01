import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminPlaylistPage from './AdminPlaylistPage';
import { apiCall } from '../components/axiosInstance';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: { username: 'charleslamb', adminRole: 'super_admin' } })) }));
vi.mock('../layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../utils/buildUrl', () => ({ default: (url) => url }));
vi.mock('lucide-react', () => ({
  Music: () => <svg data-testid="icon-music" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Search: () => <svg data-testid="icon-search" />,
  X: () => <svg data-testid="icon-x" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  Image: () => <svg data-testid="icon-image" />,
  TrendingUp: () => <svg data-testid="icon-trending" />,
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  Check: () => <svg data-testid="icon-check" />,
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ─── fixtures ────────────────────────────────────────────────────────────────

const mockPlaylists = [
  { playlistId: 1, name: 'Harlem Heat', songCount: 10, followerCount: 42, coverImageUrl: null },
  { playlistId: 2, name: 'Uptown Vibes', songCount: 5, followerCount: 0, coverImageUrl: 'https://r2.example.com/cover.jpg' },
];

const mockTracks = [
  { playlistItemId: 101, songId: 1, title: 'Bodak Yellow', artistName: 'Cardi B', artworkUrl: null },
  { playlistItemId: 102, songId: 2, title: 'Empire State of Mind', artistName: 'Jay-Z', artworkUrl: null },
];

const mockTrendingSongs = [
  { songId: 10, title: 'Trending Song A', artistName: 'Artist A', artworkUrl: null },
  { songId: 11, title: 'Trending Song B', artistName: 'Artist B', artworkUrl: null },
];

const mockSearchSongs = [
  { songId: 20, title: 'Search Result X', artistName: 'Artist X', artworkUrl: null },
];

const setupListLoad = (playlists = mockPlaylists) => {
  apiCall.mockImplementation(({ url }) => {
    if (url === '/v1/playlists/official') return Promise.resolve({ data: playlists });
    if (url.includes('/v1/search/trending')) return Promise.resolve({ data: mockTrendingSongs });
    return Promise.resolve({ data: {} });
  });
};

const renderPage = () =>
  render(<MemoryRouter><AdminPlaylistPage /></MemoryRouter>);

beforeEach(() => vi.clearAllMocks());

// ─── loading state ────────────────────────────────────────────────────────────

describe('loading state', () => {
  it('shows loading indicator on initial fetch', () => {
    apiCall.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading playlists/i)).toBeInTheDocument();
  });
});

// ─── list view ────────────────────────────────────────────────────────────────

describe('list view', () => {
  it('renders the page header', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText('Official Playlists')).toBeInTheDocument());
    expect(screen.getByText('Manage Unis editorial playlists')).toBeInTheDocument();
  });

  it('renders all playlists from the API', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText('Harlem Heat')).toBeInTheDocument());
    expect(screen.getByText('Uptown Vibes')).toBeInTheDocument();
  });

  it('shows song count for each playlist', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText(/10 songs/i)).toBeInTheDocument());
    expect(screen.getByText(/5 songs/i)).toBeInTheDocument();
  });

  it('shows follower count when > 0', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => expect(screen.getByText(/42 followers/i)).toBeInTheDocument());
  });

  it('does not show follower count when 0', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => screen.getByText('Uptown Vibes'));
    expect(screen.queryByText(/0 followers/i)).not.toBeInTheDocument();
  });

  it('shows empty state when no playlists exist', async () => {
    setupListLoad([]);
    renderPage();
    await waitFor(() => expect(screen.getByText('No official playlists yet')).toBeInTheDocument());
  });

  it('shows Create New Playlist button', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /create new playlist/i })).toBeInTheDocument());
  });
});

// ─── create view ─────────────────────────────────────────────────────────────

describe('create view', () => {
  it('switches to create view on button click', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.click(screen.getByRole('button', { name: /create new playlist/i }));
    expect(screen.getByText('Create Official Playlist')).toBeInTheDocument();
    expect(screen.getByText('New playlist will be visible to all users')).toBeInTheDocument();
  });

  it('shows Back button in create view', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.click(screen.getByRole('button', { name: /create new playlist/i }));
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('returns to list view when Back is clicked', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.click(screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('Official Playlists')).toBeInTheDocument();
  });

  it('Create & Add Songs button is disabled when name is empty', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.click(screen.getByRole('button', { name: /create new playlist/i }));
    expect(screen.getByRole('button', { name: /create & add songs/i })).toBeDisabled();
  });

  it('Create & Add Songs button enables after name is typed', async () => {
    setupListLoad();
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.click(screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.type(screen.getByPlaceholderText(/harlem's best/i), 'My Playlist');
    expect(screen.getByRole('button', { name: /create & add songs/i })).not.toBeDisabled();
  });

  it('calls /v1/playlists with correct payload on create', async () => {
    setupListLoad();
    apiCall.mockImplementation(({ url }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists') return Promise.resolve({ data: { playlistId: 99, name: 'My Playlist', tracks: [] } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.click(screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.type(screen.getByPlaceholderText(/harlem's best/i), 'My Playlist');
    await userEvent.type(screen.getByPlaceholderText(/what is this playlist about/i), 'A great one');
    await userEvent.click(screen.getByRole('button', { name: /create & add songs/i }));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith(expect.objectContaining({
        url: '/v1/playlists',
        method: 'post',
        data: expect.objectContaining({
          name: 'My Playlist',
          type: 'official',
          visibility: 'public',
          description: 'A great one',
        }),
      }));
    });
  });

  it('transitions to edit view after successful create', async () => {
    setupListLoad();
    apiCall.mockImplementation(({ url }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists') return Promise.resolve({ data: { playlistId: 99, name: 'My Playlist', tracks: [] } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.click(screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.type(screen.getByPlaceholderText(/harlem's best/i), 'My Playlist');
    await userEvent.click(screen.getByRole('button', { name: /create & add songs/i }));

    await waitFor(() => expect(screen.getByText('My Playlist')).toBeInTheDocument());
    // Should be in edit view now — track count visible in subtitle
    expect(screen.getByText(/0 songs/i)).toBeInTheDocument();
  });

  it('alerts and stays on create view on API failure', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    setupListLoad();
    apiCall.mockImplementation(({ url }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists') return Promise.reject({ response: { data: { message: 'Server error' } } });
      return Promise.resolve({ data: {} });
    });

    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.click(screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.type(screen.getByPlaceholderText(/harlem's best/i), 'My Playlist');
    await userEvent.click(screen.getByRole('button', { name: /create & add songs/i }));

    await waitFor(() => expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Failed to create playlist')));
    expect(screen.getByText('Create Official Playlist')).toBeInTheDocument();
    alertMock.mockRestore();
  });

  it('rejects cover images over 5MB', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    setupListLoad();
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /create new playlist/i }));
    await userEvent.click(screen.getByRole('button', { name: /create new playlist/i }));

    const bigFile = new File(['x'.repeat(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 });
    const input = document.querySelector('input[type="file"]');
    await userEvent.upload(input, bigFile);

    expect(alertMock).toHaveBeenCalledWith('Cover image must be under 5MB');
    alertMock.mockRestore();
  });
});

// ─── edit view ────────────────────────────────────────────────────────────────

describe('edit view — opening an existing playlist', () => {
  const setupEditLoad = () => {
    apiCall.mockImplementation(({ url, method }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1' && method === 'get') return Promise.resolve({ data: { playlistId: 1, name: 'Harlem Heat', tracks: mockTracks } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: mockTrendingSongs });
      return Promise.resolve({ data: {} });
    });
  };

  it('loads the playlist and enters edit view on card click', async () => {
    setupEditLoad();
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => expect(screen.getByText('Tracks in Playlist (2)')).toBeInTheDocument());
  });

  it('renders existing tracks in the playlist', async () => {
    setupEditLoad();
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => expect(screen.getByText('Bodak Yellow')).toBeInTheDocument());
    expect(screen.getByText('Empire State of Mind')).toBeInTheDocument();
  });

  it('shows track count in the subtitle', async () => {
    setupEditLoad();
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => expect(screen.getByText('2 songs')).toBeInTheDocument());
  });

  it('shows empty state when playlist has no tracks', async () => {
    apiCall.mockImplementation(({ url }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1') return Promise.resolve({ data: { playlistId: 1, name: 'Harlem Heat', tracks: [] } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => expect(screen.getByText(/no tracks yet/i)).toBeInTheDocument());
  });
});

// ─── song picker — leaderboard mode ──────────────────────────────────────────

describe('song picker — leaderboard mode', () => {
  const openEditView = async () => {
    apiCall.mockImplementation(({ url }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1') return Promise.resolve({ data: { playlistId: 1, name: 'Harlem Heat', tracks: [] } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: mockTrendingSongs });
      return Promise.resolve({ data: {} });
    });
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => screen.getByText('Add Songs'));
  };

  it('loads and displays trending songs', async () => {
    await openEditView();
    await waitFor(() => expect(screen.getByText('Trending Song A')).toBeInTheDocument());
    expect(screen.getByText('Trending Song B')).toBeInTheDocument();
  });

  it('shows Add button for songs not yet in the playlist', async () => {
    await openEditView();
    await waitFor(() => screen.getByText('Trending Song A'));
    const addButtons = screen.getAllByRole('button', { name: /add/i });
    expect(addButtons.length).toBeGreaterThan(0);
  });

  it('calls the tracks endpoint when Add is clicked', async () => {
    apiCall.mockImplementation(({ url }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1') return Promise.resolve({ data: { playlistId: 1, name: 'Harlem Heat', tracks: [] } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: mockTrendingSongs });
      if (url === '/v1/playlists/1/tracks') return Promise.resolve({ data: { tracks: [{ playlistItemId: 200, songId: 10, title: 'Trending Song A', artistName: 'Artist A' }] } });
      return Promise.resolve({ data: {} });
    });
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => screen.getByText('Trending Song A'));

    const addButtons = screen.getAllByRole('button', { name: /^add$/i });
    await userEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith(expect.objectContaining({
        url: '/v1/playlists/1/tracks',
        method: 'post',
        data: { songId: 10 },
      }));
    });
  });

  it('shows Added state and disables button for songs already in the playlist', async () => {
    apiCall.mockImplementation(({ url }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1') return Promise.resolve({ data: { playlistId: 1, name: 'Harlem Heat', tracks: [{ playlistItemId: 101, songId: 10, title: 'Trending Song A', artistName: 'Artist A' }] } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: mockTrendingSongs });
      return Promise.resolve({ data: {} });
    });
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => screen.getByText('Trending Song A'));

    const addedButton = screen.getByRole('button', { name: /added/i });
    expect(addedButton).toBeDisabled();
  });
});

// ─── song picker — search mode ────────────────────────────────────────────────

describe('song picker — search mode', () => {
  const openEditAndSwitchToSearch = async () => {
    apiCall.mockImplementation(({ url }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1') return Promise.resolve({ data: { playlistId: 1, name: 'Harlem Heat', tracks: [] } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: mockTrendingSongs });
      if (url.includes('/v1/search/suggestions')) return Promise.resolve({ data: { songs: mockSearchSongs } });
      return Promise.resolve({ data: {} });
    });
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => screen.getByText('Add Songs'));
    await userEvent.click(screen.getByRole('button', { name: /search/i }));
  };

  it('shows search input in search mode', async () => {
    await openEditAndSwitchToSearch();
    expect(screen.getByPlaceholderText(/search by song or artist/i)).toBeInTheDocument();
  });

  it('shows "Type to search" before query is entered', async () => {
    await openEditAndSwitchToSearch();
    expect(screen.getByText(/type to search/i)).toBeInTheDocument();
  });

  it('calls suggestions endpoint on input and renders results', async () => {
    await openEditAndSwitchToSearch();
    await userEvent.type(screen.getByPlaceholderText(/search by song or artist/i), 'harlem');
    await waitFor(() => expect(screen.getByText('Search Result X')).toBeInTheDocument());
    expect(apiCall).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining('/v1/search/suggestions?q=harlem'),
    }));
  });

  it('clears results when search query is cleared', async () => {
    await openEditAndSwitchToSearch();
    const input = screen.getByPlaceholderText(/search by song or artist/i);
    await userEvent.type(input, 'harlem');
    await waitFor(() => screen.getByText('Search Result X'));
    await userEvent.clear(input);
    await waitFor(() => expect(screen.queryByText('Search Result X')).not.toBeInTheDocument());
  });
});

// ─── remove track ─────────────────────────────────────────────────────────────

describe('remove track from playlist', () => {
  it('calls the delete endpoint and updates track list', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiCall.mockImplementation(({ url, method }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1' && method === 'get') return Promise.resolve({ data: { playlistId: 1, name: 'Harlem Heat', tracks: mockTracks } });
      if (url === '/v1/playlists/1/tracks/101' && method === 'delete') return Promise.resolve({ data: { tracks: [mockTracks[1]] } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => screen.getByText('Bodak Yellow'));

    // Click the trash icon next to the first track
    const trashButtons = screen.getAllByTitle ? screen.getAllByRole('button').filter(b => b.querySelector('[data-testid="icon-trash"]')) : [];
    // Use the track list area specifically — first trash in the left panel
    const allTrashButtons = screen.getAllByRole('button').filter(b => b.querySelector('[data-testid="icon-trash"]'));
    await userEvent.click(allTrashButtons[0]);

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith(expect.objectContaining({
        url: '/v1/playlists/1/tracks/101',
        method: 'delete',
      }));
    });
    confirmMock.mockRestore();
  });

  it('does not call delete if confirm is cancelled', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);
    apiCall.mockImplementation(({ url, method }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1' && method === 'get') return Promise.resolve({ data: { playlistId: 1, name: 'Harlem Heat', tracks: mockTracks } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    });

    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => screen.getByText('Bodak Yellow'));

    const allTrashButtons = screen.getAllByRole('button').filter(b => b.querySelector('[data-testid="icon-trash"]'));
    await userEvent.click(allTrashButtons[0]);

    expect(apiCall).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'delete', url: expect.stringContaining('/tracks/') }));
    confirmMock.mockRestore();
  });
});

// ─── delete playlist ──────────────────────────────────────────────────────────

describe('delete playlist from list view', () => {
  it('calls delete endpoint and refreshes list', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
    apiCall.mockImplementation(({ url, method }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1' && method === 'delete') return Promise.resolve({});
      return Promise.resolve({ data: {} });
    });

    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));

    const deleteButtons = screen.getAllByTitle('Delete');
    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith(expect.objectContaining({
        url: '/v1/playlists/1',
        method: 'delete',
      }));
    });
    confirmMock.mockRestore();
  });

  it('does not delete when confirm is cancelled', async () => {
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);
    setupListLoad();
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));

    const deleteButtons = screen.getAllByTitle('Delete');
    await userEvent.click(deleteButtons[0]);

    expect(apiCall).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'delete' }));
    confirmMock.mockRestore();
  });
});

// ─── normalizeSong ────────────────────────────────────────────────────────────

describe('normalizeSong fallbacks (via rendered output)', () => {
  it('shows "Untitled" for songs with no title', async () => {
    apiCall.mockImplementation(({ url }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1') return Promise.resolve({ data: { playlistId: 1, name: 'Harlem Heat', tracks: [] } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: [{ songId: 99, artistName: 'Someone' }] });
      return Promise.resolve({ data: {} });
    });
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => expect(screen.getByText('Untitled')).toBeInTheDocument());
  });

  it('shows "Unknown" for songs with no artist', async () => {
    apiCall.mockImplementation(({ url }) => {
      if (url === '/v1/playlists/official') return Promise.resolve({ data: mockPlaylists });
      if (url === '/v1/playlists/1') return Promise.resolve({ data: { playlistId: 1, name: 'Harlem Heat', tracks: [] } });
      if (url.includes('/v1/search/trending')) return Promise.resolve({ data: [{ songId: 99, title: 'Mystery Song' }] });
      return Promise.resolve({ data: {} });
    });
    renderPage();
    await waitFor(() => screen.getByText('Harlem Heat'));
    await userEvent.click(screen.getByText('Harlem Heat'));
    await waitFor(() => expect(screen.getByText('Unknown')).toBeInTheDocument());
  });
});