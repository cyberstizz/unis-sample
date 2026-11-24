import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/utils';
import * as axiosModule from './components/axiosInstance';

// ---------------------------------------------------------------------------
// HEAVY CHILD MOCKS — follow the artistDashboard.test.jsx pattern.
// ---------------------------------------------------------------------------

vi.mock('./playlistWizard', () => ({
  default: ({ open, onClose, selectedTrack }) =>
    open ? (
      <div data-testid="playlist-wizard">
        <span data-testid="playlist-wizard-track-id">{selectedTrack?.id || 'none'}</span>
        <button onClick={onClose}>close-playlist-wizard</button>
      </div>
    ) : null,
}));

vi.mock('./playlistManager', () => ({
  default: ({ open, onClose }) =>
    open ? (
      <div data-testid="playlist-manager">
        <button onClick={onClose}>close-playlist-manager</button>
      </div>
    ) : null,
}));

vi.mock('./commentSection', () => ({ // ★ comments: stub the heavy comment section
  default: ({ songId }) => <div data-testid="comment-section" data-song-id={songId} />,
}));

vi.mock('./QueuePanel', () => ({
  default: ({ open, onClose }) =>
    open ? (
      <div data-testid="queue-panel">
        <button onClick={onClose}>close-queue-panel</button>
      </div>
    ) : null,
}));

vi.mock('./votingWizard', () => ({
  default: ({ show, onClose, onVoteSuccess, nominee, userId, filters }) =>
    show ? (
      <div data-testid="voting-wizard">
        <span data-testid="voting-wizard-nominee-id">{nominee?.id || 'none'}</span>
        <span data-testid="voting-wizard-nominee-name">{nominee?.name || 'none'}</span>
        <span data-testid="voting-wizard-jurisdiction">{nominee?.jurisdiction || 'none'}</span>
        <span data-testid="voting-wizard-genre">{nominee?.genreKey || 'none'}</span>
        <span data-testid="voting-wizard-user-id">{userId || 'none'}</span>
        <button onClick={() => onVoteSuccess?.(nominee?.id)}>vote-success</button>
        <button onClick={onClose}>close-voting-wizard</button>
      </div>
    ) : null,
}));

vi.mock('./DownloadModal', () => ({
  default: ({ isOpen, onClose, song }) =>
    isOpen ? (
      <div data-testid="download-modal">
        <span data-testid="download-modal-song-id">{song?.id || 'none'}</span>
        <span data-testid="download-modal-song-title">{song?.title || 'none'}</span>
        <span data-testid="download-modal-policy">{song?.downloadPolicy || 'none'}</span>
        <span data-testid="download-modal-filename">{song?.fileName || 'none'}</span>
        <button onClick={onClose}>close-download-modal</button>
      </div>
    ) : null,
}));

vi.mock('./AuthGateSheet', () => {
  const React = require('react');
  const AuthGateSheet = ({ open, onClose, context }) =>
    open ? (
      <div data-testid="auth-gate-sheet">
        <span data-testid="auth-gate-context">{context || 'none'}</span>
        <button onClick={onClose}>close-auth-gate</button>
      </div>
    ) : null;

  return {
    default: AuthGateSheet,
    useAuthGate: () => {
      const [open, setOpen] = React.useState(false);
      const [context, setContext] = React.useState(null);
      const triggerGate = (ctx) => {
        setContext(ctx);
        setOpen(true);
      };
      return {
        triggerGate,
        gateProps: { open, onClose: () => setOpen(false), context },
      };
    },
    incrementGateSongCount: vi.fn(),
    getGateSongCount: vi.fn(() => 0),
  };
});

vi.mock('./player.scss', () => ({}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal();
  const React = require('react');
  // ★ QA: previous mock listed 6 icons by hand; the component gained more
  //   (Lock, MessageCircle, X), which broke 36/42 tests on pristine HEAD.
  //   Stubbing every real export means new icon imports can never break this
  //   suite again.
  const Stub = (name) => {
    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const Icon = (props) => <span data-testid={`icon-${kebab}`} {...props} />;
    Icon.displayName = name;
    return Icon;
  };
  const mocked = { __esModule: true };
  for (const key of Object.keys(actual)) {
    mocked[key] = typeof actual[key] === 'function' || typeof actual[key] === 'object'
      ? Stub(key)
      : actual[key];
  }
  return mocked;
});

import Player from './player';
import { useLocation } from 'react-router-dom';

// Shows the current path so navigation can be checked.
const LocationProbe = () => <div data-testid="location">{useLocation().pathname}</div>;
import { PlayerContext } from './context/playercontext';

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
});

let apiCallSpy;
let apiCallLog;

function setupApiCall(handler) {
  apiCallLog = [];
  apiCallSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    apiCallLog.push({ ...config });
    return handler(config);
  });
}

function defaultApiHandler(config) {
  const { url, method = 'get' } = config;

  if (/\/is-liked/.test(url)) return { data: { isLiked: false } };
  if (/\/likes\/count/.test(url)) return { data: { count: 42 } };
  if (/\/like/.test(url) && (method === 'post' || method === 'delete')) {
    return { data: { success: true } };
  }
  if (/^\/v1\/media\/song\/[^/]+$/.test(url) && method === 'get') {
    const songId = url.split('/').pop();
    return {
      data: {
        id: songId,
        title: 'Track One',
        artist: 'testartist',
        jurisdiction: { name: 'Harlem' },
        genre: { name: 'rap-hiphop' },
      },
    };
  }

  throw new Error(`Unmocked apiCall: ${method.toUpperCase()} ${url}`);
}

function callsTo(urlMatcher, method) {
  return apiCallLog.filter(c => {
    const methodMatch = method ? (c.method || 'get').toLowerCase() === method.toLowerCase() : true;
    const urlMatch = typeof urlMatcher === 'string' ? c.url === urlMatcher : urlMatcher.test(c.url);
    return methodMatch && urlMatch;
  });
}

const sampleSong = {
  id: 'song-abc-123',
  title: 'Track One',
  artist: 'testartist',
  artistId: 'artist-xyz-789',
  artwork: 'https://cdn.example.com/artwork.jpg',
  url: 'https://cdn.example.com/track1.mp3',
  type: 'song',
  jurisdiction: 'Harlem',
  genreKey: 'rap-hiphop',
};

const samplePaidSong = {
  ...sampleSong,
  id: 'song-paid-456',
  title: 'Track Two',
  downloadPolicy: 'paid',
  downloadPrice: 199,
};

function buildPlayerContextValue(overrides = {}) {
  return {
    isExpanded: false,
    toggleExpand: vi.fn(),
    currentMedia: null,
    next: vi.fn(),
    prev: vi.fn(),
    audioRef: { current: null },
    playlists: [],
    openPlaylistManager: vi.fn(),
    showPlaylistManager: false,
    closePlaylistManager: vi.fn(),
    queue: [],
    ...overrides,
  };
}

function makeAudioRef() {
  return { current: null };
}

function renderPlayerWith(contextOverrides = {}, authMode = 'listener') {
  const audioRef = makeAudioRef();
  const value = buildPlayerContextValue({ audioRef, ...contextOverrides });

  const ui = (
    <PlayerContext.Provider value={value}>
      <Player />
      <LocationProbe />
    </PlayerContext.Provider>
  );

  const utils = renderWithProviders(ui, { as: authMode });
  return { ...utils, contextValue: value, audioRef };
}

beforeEach(() => {
  setupApiCall(defaultApiHandler);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// The player has three faces (revamp, Nov 2026):
//   • phones/tablets (≤1024px): the mini player (.unp-mini) plus the song
//     actions tray (.unp-tray) opened by its arrow
//   • computers (≥1025px): the dock (.unp-dock)
//   • Now Playing (.unp-np), always mounted, open when isExpanded
// jsdom's matchMedia matches nothing, so renders default to the phone face;
// asDesktop() switches to the dock.
// ---------------------------------------------------------------------------

function asDesktop() {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(min-width: 1025px)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

const miniOf = (container) => container.querySelector('.unp-mini');
const dockOf = (container) => container.querySelector('.unp-dock');
const trayOf = (container) => container.querySelector('.unp-tray');

async function openTray(user, container) {
  await user.click(container.querySelector('.unp-mini__arrow'));
  const tray = trayOf(container);
  expect(tray).toHaveClass('is-open');
  return tray;
}

async function clickInTray(user, container, name) {
  const tray = await openTray(user, container);
  await user.click(within(tray).getByRole('button', { name }));
}

describe('Player — conditional render (no current media)', () => {
  it('renders NOTHING visible when currentMedia is null (guest)', () => {
    const { container } = renderPlayerWith({ currentMedia: null }, 'guest');
    expect(miniOf(container)).not.toBeInTheDocument();
    expect(dockOf(container)).not.toBeInTheDocument();
    expect(container.querySelector('audio')).not.toBeInTheDocument();
  });

  it('renders NOTHING visible when currentMedia is null (listener)', () => {
    const { container } = renderPlayerWith({ currentMedia: null }, 'listener');
    expect(miniOf(container)).not.toBeInTheDocument();
    expect(container.querySelector('.unp-np')).not.toBeInTheDocument();
  });

  it('still renders modals when currentMedia is null (so sidebar can open PlaylistManager)', () => {
    renderPlayerWith({ currentMedia: null, showPlaylistManager: true }, 'listener');
    expect(screen.getByTestId('playlist-manager')).toBeInTheDocument();
  });
});

describe('Player — mini-player render (with current media)', () => {
  it('renders the mini-player when currentMedia is present', () => {
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    expect(screen.getByRole('region', { name: 'Player' })).toBe(miniOf(container));
    expect(dockOf(container)).not.toBeInTheDocument();
  });

  it('displays the track title and artist', () => {
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    const mini = miniOf(container);
    expect(within(mini).getByText('Track One')).toBeInTheDocument();
    expect(within(mini).getByText('testartist')).toBeInTheDocument();
  });

  it('renders the artwork image with fallback placeholder', () => {
    const noArtwork = { ...sampleSong, artwork: null };
    const { container } = renderPlayerWith({ currentMedia: noArtwork }, 'listener');
    const img = container.querySelector('.unp-mini__art img');
    expect(img).toHaveAttribute('src', '/assets/placeholder.jpg');
  });

  it('renders the audio element (not video) for type=song', () => {
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    expect(container.querySelector('audio')).toBeInTheDocument();
    expect(container.querySelector('video')).not.toBeInTheDocument();
  });

  it('renders the video element (not audio) for type=video', () => {
    const video = { ...sampleSong, type: 'video' };
    const { container } = renderPlayerWith({ currentMedia: video, isExpanded: true }, 'listener');
    expect(container.querySelector('video')).toBeInTheDocument();
  });

  it('tapping the mini player opens Now Playing', async () => {
    const toggleExpand = vi.fn();
    const user = userEvent.setup();
    renderPlayerWith({ currentMedia: sampleSong, toggleExpand }, 'listener');
    await user.click(screen.getByRole('button', { name: /open now playing: track one by testartist/i }));
    expect(toggleExpand).toHaveBeenCalledTimes(1);
  });
});

describe('Player — dock (computers)', () => {
  it('renders the dock instead of the mini player and tray', () => {
    asDesktop();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    expect(dockOf(container)).toBeInTheDocument();
    expect(miniOf(container)).not.toBeInTheDocument();
    expect(trayOf(container)).not.toBeInTheDocument();
  });
});

describe('Player — like system', () => {
  it('fetches like status and count on mount when authenticated', async () => {
    renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => {
      expect(callsTo(/\/is-liked/).length).toBe(1);
      expect(callsTo(/\/likes\/count/).length).toBe(1);
    });
  });

  it('does NOT fetch like status when userId is missing (guest)', async () => {
    renderPlayerWith({ currentMedia: sampleSong }, 'guest');
    await new Promise(r => setTimeout(r, 50));
    expect(callsTo(/\/is-liked/).length).toBe(0);
    expect(callsTo(/\/likes\/count/).length).toBe(0);
  });

  it('triggers auth gate when guest clicks like', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'guest');
    await clickInTray(user, container, /^like/i);
    await waitFor(() => {
      expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('auth-gate-context')).toHaveTextContent('generic');
    });
  });

  it('posts like when authenticated user clicks unliked heart', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));
    await clickInTray(user, container, /^like/i);
    await waitFor(() => {
      expect(callsTo(/\/like(\?|$)/, 'post').length).toBe(1);
    });
  });

  it('sends DELETE when authenticated user clicks already-liked heart', async () => {
    setupApiCall((config) => {
      if (/\/is-liked/.test(config.url)) return { data: { isLiked: true } };
      return defaultApiHandler(config);
    });

    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));
    await waitFor(() => expect(within(trayOf(container)).getByText('Liked')).toBeInTheDocument());
    await clickInTray(user, container, /^liked/i);
    await waitFor(() => {
      expect(callsTo(/\/like(\?|$)/, 'delete').length).toBe(1);
    });
  });

  it('the dock heart likes the song on computers', async () => {
    asDesktop();
    const user = userEvent.setup();
    renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Like this song' }));
    await waitFor(() => {
      expect(callsTo(/\/like(\?|$)/, 'post').length).toBe(1);
    });
  });
});

describe('Player — vote flow', () => {
  it('triggers auth gate when guest clicks vote', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'guest');
    await clickInTray(user, container, /vote for this song/i);
    await waitFor(() => {
      expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('auth-gate-context')).toHaveTextContent('vote');
    });
  });

  it('fetches fresh song data and opens VotingWizard for authenticated user', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));
    await clickInTray(user, container, /vote for this song/i);
    await waitFor(() => {
      expect(screen.getByTestId('voting-wizard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('voting-wizard-nominee-id')).toHaveTextContent('song-abc-123');
    expect(screen.getByTestId('voting-wizard-jurisdiction')).toHaveTextContent('Harlem');
    expect(screen.getByTestId('voting-wizard-genre')).toHaveTextContent('rap-hiphop');
  });

  it('handles jurisdiction as string (not object)', async () => {
    setupApiCall((config) => {
      if (/^\/v1\/media\/song\/[^/]+$/.test(config.url) && (config.method === 'get' || !config.method)) {
        return {
          data: {
            id: config.url.split('/').pop(),
            title: 'Track One',
            jurisdiction: 'Uptown Harlem',
            genre: { name: 'rap-hiphop' },
          },
        };
      }
      return defaultApiHandler(config);
    });

    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));
    await clickInTray(user, container, /vote for this song/i);
    await waitFor(() => {
      expect(screen.getByTestId('voting-wizard-jurisdiction')).toHaveTextContent('Uptown Harlem');
    });
  });

  it('falls back to Harlem when jurisdiction is missing', async () => {
    setupApiCall((config) => {
      if (/^\/v1\/media\/song\/[^/]+$/.test(config.url)) {
        return {
          data: {
            id: config.url.split('/').pop(),
            title: 'Track One',
            genre: { name: 'rap-hiphop' },
          },
        };
      }
      return defaultApiHandler(config);
    });

    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));
    await clickInTray(user, container, /vote for this song/i);
    await waitFor(() => {
      expect(screen.getByTestId('voting-wizard-jurisdiction')).toHaveTextContent('Harlem');
    });
  });

  it('opens VotingWizard with fallback voteNominee when song fetch fails — regression', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setupApiCall((config) => {
      if (/^\/v1\/media\/song\/[^/]+$/.test(config.url) && (config.method === 'get' || !config.method)) {
        return Promise.reject(new Error('500 server error'));
      }
      return defaultApiHandler(config);
    });

    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));
    await clickInTray(user, container, /vote for this song/i);
    await waitFor(() => {
      expect(screen.getByTestId('voting-wizard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('voting-wizard-nominee-id')).toHaveTextContent('song-abc-123');
  });

  it('the dock Vote button opens VotingWizard on computers', async () => {
    asDesktop();
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));
    await user.click(within(dockOf(container)).getByRole('button', { name: /^vote$/i }));
    await waitFor(() => {
      expect(screen.getByTestId('voting-wizard')).toBeInTheDocument();
    });
  });
});

describe('Player — download flow', () => {
  it('triggers auth gate when guest clicks download', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'guest');
    await clickInTray(user, container, /^download/i);
    await waitFor(() => {
      expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('auth-gate-context')).toHaveTextContent('generic');
    });
  });

  it('opens DownloadModal with song data for authenticated user', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await clickInTray(user, container, /^download/i);
    await waitFor(() => {
      expect(screen.getByTestId('download-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('download-modal-song-id')).toHaveTextContent('song-abc-123');
    expect(screen.getByTestId('download-modal-song-title')).toHaveTextContent('Track One');
    expect(screen.getByTestId('download-modal-filename')).toHaveTextContent(
      'testartist - Track One.mp3'
    );
    // the tray closes behind the modal
    expect(trayOf(container)).not.toHaveClass('is-open');
  });

  it('passes paid download policy to DownloadModal', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: samplePaidSong }, 'listener');
    await clickInTray(user, container, /^download/i);
    await waitFor(() => {
      expect(screen.getByTestId('download-modal-policy')).toHaveTextContent('paid');
    });
  });

  it('defaults to "free" download policy when unspecified', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await clickInTray(user, container, /^download/i);
    await waitFor(() => {
      expect(screen.getByTestId('download-modal-policy')).toHaveTextContent('free');
    });
  });
});

describe('Player — add to playlist flow', () => {
  it('triggers auth gate when guest clicks "+"', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'guest');
    await clickInTray(user, container, /^add/i);
    await waitFor(() => {
      expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('auth-gate-context')).toHaveTextContent('generic');
    });
  });

  it('opens PlaylistWizard for authenticated user', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await clickInTray(user, container, /^add/i);
    await waitFor(() => {
      expect(screen.getByTestId('playlist-wizard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('playlist-wizard-track-id')).toHaveTextContent('song-abc-123');
  });

  it('the dock "+" opens PlaylistWizard on computers', async () => {
    asDesktop();
    const user = userEvent.setup();
    renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await user.click(screen.getByRole('button', { name: /add to playlist or queue/i }));
    await waitFor(() => {
      expect(screen.getByTestId('playlist-wizard')).toBeInTheDocument();
    });
  });
});

describe('Player — queue panel', () => {
  it('displays queue count badge when queue has items', () => {
    const queue = [sampleSong, samplePaidSong, { ...sampleSong, id: 's3' }];
    const { container } = renderPlayerWith({ currentMedia: sampleSong, queue }, 'listener');
    const badge = container.querySelector('.unp-mini__queue .unp-badge');
    expect(badge).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: 'Queue, 3 songs' })).toBeInTheDocument();
  });

  it('does NOT render queue badge when queue is empty', () => {
    const { container } = renderPlayerWith({ currentMedia: sampleSong, queue: [] }, 'listener');
    expect(container.querySelector('.unp-mini__queue .unp-badge')).not.toBeInTheDocument();
  });

  it('phones: the queue button opens Now Playing', async () => {
    const toggleExpand = vi.fn();
    const user = userEvent.setup();
    renderPlayerWith({ currentMedia: sampleSong, queue: [sampleSong], toggleExpand }, 'listener');
    await user.click(screen.getByRole('button', { name: 'Queue, 1 songs' }));
    expect(toggleExpand).toHaveBeenCalledTimes(1);
  });

  it('computers: toggles QueuePanel when queue button is clicked', async () => {
    asDesktop();
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong, queue: [sampleSong] }, 'listener');
    const queueBtn = within(dockOf(container)).getByRole('button', { name: 'Queue, 1 songs' });

    expect(screen.queryByTestId('queue-panel')).not.toBeInTheDocument();
    await user.click(queueBtn);
    expect(screen.getByTestId('queue-panel')).toBeInTheDocument();

    await user.click(queueBtn);
    await waitFor(() => {
      expect(screen.queryByTestId('queue-panel')).not.toBeInTheDocument();
    });
  });
});

describe('Player — playback controls', () => {
  it('calls prev() from context when prev button clicked', async () => {
    asDesktop();
    const prev = vi.fn();
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong, prev }, 'listener');
    await user.click(within(dockOf(container)).getByRole('button', { name: 'Previous' }));
    expect(prev).toHaveBeenCalledTimes(1);
  });

  it('calls next() from context when next button clicked', async () => {
    asDesktop();
    const next = vi.fn();
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong, next }, 'listener');
    await user.click(within(dockOf(container)).getByRole('button', { name: 'Next' }));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls audio.play() when play/pause is clicked on paused audio', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();
    const playSpy = vi.spyOn(audio, 'play');
    await user.click(within(miniOf(container)).getByRole('button', { name: 'Play' }));
    expect(playSpy).toHaveBeenCalled();
  });
});

describe('Player — navigation clicks', () => {
  it('navigates to /song/:id when track title is clicked', async () => {
    asDesktop();
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await user.click(within(dockOf(container)).getByRole('button', { name: 'Track One' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/song/song-abc-123');
  });

  it('navigates to /artist/:id when the artist is clicked', async () => {
    asDesktop();
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await user.click(within(dockOf(container)).getByRole('button', { name: 'testartist' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/artist/artist-xyz-789');
  });

  it('does not navigate to artist when artistId is missing', async () => {
    asDesktop();
    const noArtistId = { ...sampleSong, artistId: null };
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: noArtistId }, 'listener');
    await user.click(within(dockOf(container)).getByRole('button', { name: 'testartist' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });
});

describe('Player — expanded view (Now Playing)', () => {
  it('renders the expanded view when isExpanded=true', () => {
    const { container } = renderPlayerWith(
      { currentMedia: sampleSong, isExpanded: true },
      'listener'
    );
    expect(container.querySelector('.unp-np')).toHaveClass('is-open');
    expect(screen.getByRole('dialog', { name: 'Now Playing' })).toBeInTheDocument();
    expect(screen.getByAltText('Artwork for Track One')).toBeInTheDocument();
  });

  it('stays closed when isExpanded=false', () => {
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    expect(container.querySelector('.unp-np')).not.toHaveClass('is-open');
    expect(screen.queryByRole('dialog', { name: 'Now Playing' })).not.toBeInTheDocument();
  });

  it('calls toggleExpand when the close button is clicked', async () => {
    const toggleExpand = vi.fn();
    const user = userEvent.setup();
    renderPlayerWith(
      { currentMedia: sampleSong, isExpanded: true, toggleExpand },
      'listener'
    );
    await user.click(screen.getByRole('button', { name: /close now playing/i }));
    expect(toggleExpand).toHaveBeenCalledTimes(1);
  });
});

describe('Player — mobile actions tray', () => {
  it('tray is closed by default', () => {
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    const tray = trayOf(container);
    expect(tray).toBeInTheDocument();
    expect(tray).not.toHaveClass('is-open');
    expect(container.querySelector('.unp-mini__arrow')).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the tray when the toggle button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await openTray(user, container);
    expect(container.querySelector('.unp-mini__arrow')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Song actions' })).toBeInTheDocument();
  });

  it('shows how many songs are in the queue', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith(
      { currentMedia: sampleSong, queue: [sampleSong] },
      'listener'
    );
    const tray = await openTray(user, container);
    expect(within(tray).getByText(/1 in queue/i)).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: /comments/i })).toBeInTheDocument();
  });

  it('Comments button closes the tray and opens the comment sheet for the current song', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith(
      { currentMedia: sampleSong, queue: [sampleSong] },
      'listener'
    );
    await clickInTray(user, container, /comments/i);
    expect(trayOf(container)).not.toHaveClass('is-open');
    const sheet = screen.getByRole('dialog', { name: /^comments$/i });
    expect(sheet).toBeInTheDocument();
    expect(screen.getByTestId('comment-section')).toHaveAttribute(
      'data-song-id',
      String(sampleSong.id || sampleSong.songId)
    );
    // close button dismisses the sheet
    await user.click(within(sheet).getByRole('button', { name: /close comments/i }));
    expect(screen.queryByRole('dialog', { name: /^comments$/i })).not.toBeInTheDocument();
  });
});

describe('Player — playlist manager integration', () => {
  it('renders PlaylistManager when showPlaylistManager is true (with media)', () => {
    renderPlayerWith(
      { currentMedia: sampleSong, showPlaylistManager: true },
      'listener'
    );
    expect(screen.getByTestId('playlist-manager')).toBeInTheDocument();
  });

  it('calls closePlaylistManager when the wizard emits onClose', async () => {
    const closePlaylistManager = vi.fn();
    const user = userEvent.setup();
    renderPlayerWith(
      {
        currentMedia: sampleSong,
        showPlaylistManager: true,
        closePlaylistManager,
      },
      'listener'
    );
    const closeBtn = screen.getByText('close-playlist-manager');
    await user.click(closeBtn);
    expect(closePlaylistManager).toHaveBeenCalledTimes(1);
  });
});

describe('Player — AuthGateSheet rendering', () => {
  it('renders without the gate sheet initially', () => {
    renderPlayerWith({ currentMedia: sampleSong }, 'guest');
    expect(screen.queryByTestId('auth-gate-sheet')).not.toBeInTheDocument();
  });

  it('dismisses the gate sheet when onClose fires', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'guest');
    await clickInTray(user, container, /vote for this song/i);
    expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
    await user.click(screen.getByText('close-auth-gate'));
    await waitFor(() => {
      expect(screen.queryByTestId('auth-gate-sheet')).not.toBeInTheDocument();
    });
  });
});

describe('Player — formatTime', () => {
  it('formats time correctly — indirectly via progress display', () => {
    asDesktop();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    const timeSpans = dockOf(container).querySelectorAll('.unp-time');
    expect(timeSpans.length).toBe(2);
    timeSpans.forEach((el) => {
      expect(el).toHaveTextContent('0:00');
    });
  });
});

describe.todo('Player — audio event sync (timeupdate updates currentTime state)');
describe.todo('Player — audio "ended" event triggers next()');
describe.todo('Player — audio "loadedmetadata" populates duration');
describe.todo('Player — seek bar click updates audio.currentTime');
describe.todo('Player — volume slider click updates audio.volume');
describe.todo('Player — volume icon click toggles mute (0 ↔ 0.7)');
describe.todo('Player — incrementGateSongCount fires on guest media change');
describe.todo('Player — Media Session API metadata is set on track change');
describe.todo('Player — handleVoteClick alerts on missing song id');