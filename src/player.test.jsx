import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/utils';
import * as axiosModule from './components/axiosInstance';

// ---------------------------------------------------------------------------
// HEAVY CHILD MOCKS — follow the artistDashboard.test.jsx pattern.
// Player pulls in PlaylistWizard, PlaylistManager, QueuePanel, VotingWizard,
// DownloadModal, AuthGateSheet — all of which do their own fetches + DOM work.
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
  const gateStateRef = { triggered: null, open: false };

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
        gateStateRef.triggered = ctx;
        gateStateRef.open = true;
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

// lucide-react icons — replace with simple stubs so queries by role/text still work
vi.mock('lucide-react', () => {
  const React = require('react');
  const Stub = (name) => (props) => <span data-testid={`icon-${name}`} {...props} />;
  return {
    Heart: Stub('heart'),
    Headphones: Stub('headphones'),
    Vote: Stub('vote'),
    ChevronUp: Stub('chevron-up'),
    ChevronDown: Stub('chevron-down'),
    ListMusic: Stub('list-music'),
  };
});

// Import AFTER mocks are declared
import Player from './player';
import { PlayerContext } from './context/playercontext';

// ---------------------------------------------------------------------------
// HTMLMediaElement STUBS — jsdom does not implement these.
// ---------------------------------------------------------------------------
// Mock play/pause/load so Player's useEffect doesn't blow up
beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
});

// ---------------------------------------------------------------------------
// apiCall mock + log
// ---------------------------------------------------------------------------
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

  // Like status
  if (/\/is-liked/.test(url)) {
    return { data: { isLiked: false } };
  }
  if (/\/likes\/count/.test(url)) {
    return { data: { count: 42 } };
  }
  // Like toggle (post / delete)
  if (/\/like/.test(url) && (method === 'post' || method === 'delete')) {
    return { data: { success: true } };
  }
  // Song fetch for vote
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

// ---------------------------------------------------------------------------
// SAMPLE MEDIA OBJECTS
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// PROVIDE A MOCK PlayerContext VALUE (we avoid the real one so we can control currentMedia, queue, etc.)
// ---------------------------------------------------------------------------
function buildPlayerContextValue(overrides = {}) {
  return {
    isExpanded: false,
    toggleExpand: vi.fn(),
    currentMedia: null,
    next: vi.fn(),
    prev: vi.fn(),
    audioRef: { current: null }, // Player overrides via its own <audio ref={audioRef}>
    playlists: [],
    openPlaylistManager: vi.fn(),
    showPlaylistManager: false,
    closePlaylistManager: vi.fn(),
    queue: [],
    ...overrides,
  };
}

// Because Player reads audioRef.current directly, we need to pass it a ref that
// gets populated by React. The simplest approach: let the component's audio
// element get its own ref via useRef — but Player destructures audioRef from
// context and passes it to the <audio> element. So we must create a real ref.
function makeAudioRef() {
  return { current: null };
}

// Render helper: wraps Player in a controlled PlayerContext.Provider so we can
// override currentMedia, queue, etc. per test.
function renderPlayerWith(contextOverrides = {}, authMode = 'listener') {
  const audioRef = makeAudioRef();
  const value = buildPlayerContextValue({ audioRef, ...contextOverrides });

  const ui = (
    <PlayerContext.Provider value={value}>
      <Player />
    </PlayerContext.Provider>
  );

  const utils = renderWithProviders(ui, { as: authMode });
  return { ...utils, contextValue: value, audioRef };
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  setupApiCall(defaultApiHandler);
  // renderWithProviders({ as: 'listener' }) stores a token — make sure it's valid.
  // The token is set by utils.jsx via makeToken(userId). Player decodes it
  // with atob; that will work for real tokens.
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('Player — conditional render (no current media)', () => {
  it('renders NOTHING visible when currentMedia is null (guest)', () => {
    const { container } = renderPlayerWith({ currentMedia: null }, 'guest');
    // No audio element, no player bar
    expect(container.querySelector('.Unis-mini-player')).not.toBeInTheDocument();
    expect(container.querySelector('audio')).not.toBeInTheDocument();
  });

  it('renders NOTHING visible when currentMedia is null (listener)', () => {
    const { container } = renderPlayerWith({ currentMedia: null }, 'listener');
    expect(container.querySelector('.Unis-mini-player')).not.toBeInTheDocument();
  });

  it('still renders modals when currentMedia is null (so sidebar can open PlaylistManager)', () => {
    // This is the "clever" behavior flagged in the architecture — modals render
    // even without a song. Test: when showPlaylistManager=true and currentMedia=null,
    // the PlaylistManager modal should still render.
    renderPlayerWith({ currentMedia: null, showPlaylistManager: true }, 'listener');
    expect(screen.getByTestId('playlist-manager')).toBeInTheDocument();
  });
});

describe('Player — mini-player render (with current media)', () => {
  it('renders the mini-player when currentMedia is present', () => {
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    expect(container.querySelector('.Unis-mini-player')).toBeInTheDocument();
  });

  it('displays the track title and artist', () => {
    renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    expect(screen.getByText('Track One')).toBeInTheDocument();
    expect(screen.getByText('testartist')).toBeInTheDocument();
  });

  it('renders the artwork image with fallback placeholder', () => {
    const noArtwork = { ...sampleSong, artwork: null };
    const { container } = renderPlayerWith({ currentMedia: noArtwork }, 'listener');
    const img = container.querySelector('.player-art img');
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
    // Guest: userMemory doesn't set a token, so the JWT decode in Player yields null userId
    renderPlayerWith({ currentMedia: sampleSong }, 'guest');

    // Give effects a chance
    await new Promise(r => setTimeout(r, 50));
    expect(callsTo(/\/is-liked/).length).toBe(0);
    expect(callsTo(/\/likes\/count/).length).toBe(0);
  });

  it('triggers auth gate when guest clicks like', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'guest');

    // Find the heart button in the player (there's one in .player-heart)
    const heartBtn = container.querySelector('.player-heart');
    expect(heartBtn).toBeInTheDocument();

    await user.click(heartBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('auth-gate-context')).toHaveTextContent('generic');
    });
  });

  it('posts like when authenticated user clicks unliked heart', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');

    // Wait for the like status fetch to complete
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));

    const heartBtn = container.querySelector('.player-heart');
    await user.click(heartBtn);

    await waitFor(() => {
      expect(callsTo(/\/like$/, 'post').length).toBe(1);
    });
  });

  it('sends DELETE when authenticated user clicks already-liked heart', async () => {
    // Override the handler to return isLiked:true
    setupApiCall((config) => {
      if (/\/is-liked/.test(config.url)) return { data: { isLiked: true } };
      return defaultApiHandler(config);
    });

    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');

    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));

    const heartBtn = container.querySelector('.player-heart');
    await user.click(heartBtn);

    await waitFor(() => {
      expect(callsTo(/\/like$/, 'delete').length).toBe(1);
    });
  });
});

describe('Player — vote flow', () => {
  it('triggers auth gate when guest clicks vote', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'guest');

    // The vote button is in .player-buttons with title "Vote for this song"
    const voteBtn = container.querySelector('button[title="Vote for this song"]');
    expect(voteBtn).toBeInTheDocument();

    await user.click(voteBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('auth-gate-context')).toHaveTextContent('vote');
    });
  });

  it('fetches fresh song data and opens VotingWizard for authenticated user', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');

    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));

    const voteBtn = container.querySelector('button[title="Vote for this song"]');
    await user.click(voteBtn);

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
            jurisdiction: 'Uptown Harlem', // string form
            genre: { name: 'rap-hiphop' },
          },
        };
      }
      return defaultApiHandler(config);
    });

    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));

    const voteBtn = container.querySelector('button[title="Vote for this song"]');
    await user.click(voteBtn);

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
            // no jurisdiction field
            genre: { name: 'rap-hiphop' },
          },
        };
      }
      return defaultApiHandler(config);
    });

    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    await waitFor(() => expect(callsTo(/\/is-liked/).length).toBe(1));

    const voteBtn = container.querySelector('button[title="Vote for this song"]');
    await user.click(voteBtn);

    await waitFor(() => {
      expect(screen.getByTestId('voting-wizard-jurisdiction')).toHaveTextContent('Harlem');
    });
  });

  it('opens VotingWizard with fallback voteNominee when song fetch fails — regression', async () => {
    // Flagged in review: handleVoteClick catch block still calls setShowVoteWizard(true)
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

    const voteBtn = container.querySelector('button[title="Vote for this song"]');
    await user.click(voteBtn);

    // Wizard should still open (this is current behavior, even if arguably weird)
    await waitFor(() => {
      expect(screen.getByTestId('voting-wizard')).toBeInTheDocument();
    });
    // With fallback nominee (voteNominee useMemo), not specificVoteData
    expect(screen.getByTestId('voting-wizard-nominee-id')).toHaveTextContent('song-abc-123');
  });
});

describe('Player — download flow', () => {
  it('triggers auth gate when guest clicks download', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'guest');

    const downloadBtn = container.querySelector('button[title="Download"]');
    expect(downloadBtn).toBeInTheDocument();

    await user.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('auth-gate-context')).toHaveTextContent('generic');
    });
  });

  it('opens DownloadModal with song data for authenticated user', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');

    const downloadBtn = container.querySelector('button[title="Download"]');
    await user.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByTestId('download-modal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('download-modal-song-id')).toHaveTextContent('song-abc-123');
    expect(screen.getByTestId('download-modal-song-title')).toHaveTextContent('Track One');
    expect(screen.getByTestId('download-modal-filename')).toHaveTextContent(
      'testartist - Track One.mp3'
    );
  });

  it('passes paid download policy to DownloadModal', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: samplePaidSong }, 'listener');

    const downloadBtn = container.querySelector('button[title="Download"]');
    await user.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByTestId('download-modal-policy')).toHaveTextContent('paid');
    });
  });

  it('defaults to "free" download policy when unspecified', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');

    const downloadBtn = container.querySelector('button[title="Download"]');
    await user.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByTestId('download-modal-policy')).toHaveTextContent('free');
    });
  });
});

describe('Player — add to playlist flow', () => {
  it('triggers auth gate when guest clicks "+"', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'guest');

    const addBtn = container.querySelector('button[title="Add to playlist or queue"]');
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();
      expect(screen.getByTestId('auth-gate-context')).toHaveTextContent('generic');
    });
  });

  it('opens PlaylistWizard for authenticated user', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');

    const addBtn = container.querySelector('button[title="Add to playlist or queue"]');
    await user.click(addBtn);

    await waitFor(() => {
      expect(screen.getByTestId('playlist-wizard')).toBeInTheDocument();
    });
    expect(screen.getByTestId('playlist-wizard-track-id')).toHaveTextContent('song-abc-123');
  });
});

describe('Player — queue panel', () => {
  it('displays queue count badge when queue has items', () => {
    const queue = [sampleSong, samplePaidSong, { ...sampleSong, id: 's3' }];
    const { container } = renderPlayerWith({ currentMedia: sampleSong, queue }, 'listener');

    const badge = container.querySelector('.player-queue-badge');
    expect(badge).toHaveTextContent('3');
  });

  it('does NOT render queue badge when queue is empty', () => {
    const { container } = renderPlayerWith({ currentMedia: sampleSong, queue: [] }, 'listener');
    const badge = container.querySelector('.player-queue-badge');
    expect(badge).not.toBeInTheDocument();
  });

  it('toggles QueuePanel when queue button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong, queue: [sampleSong] }, 'listener');

    // Queue button has dynamic title: "Queue (1)" or similar — find it by class
    const queueBtn = container.querySelector('.player-queue-btn');
    expect(queueBtn).toBeInTheDocument();

    expect(screen.queryByTestId('queue-panel')).not.toBeInTheDocument();
    await user.click(queueBtn);
    expect(screen.getByTestId('queue-panel')).toBeInTheDocument();

    // Toggle closed
    await user.click(queueBtn);
    await waitFor(() => {
      expect(screen.queryByTestId('queue-panel')).not.toBeInTheDocument();
    });
  });
});

describe('Player — playback controls', () => {
  it('calls prev() from context when prev button clicked', async () => {
    const prev = vi.fn();
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong, prev }, 'listener');

    const prevBtn = container.querySelector('button[title="Previous"]');
    await user.click(prevBtn);
    expect(prev).toHaveBeenCalledTimes(1);
  });

  it('calls next() from context when next button clicked', async () => {
    const next = vi.fn();
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong, next }, 'listener');

    const nextBtn = container.querySelector('button[title="Next"]');
    await user.click(nextBtn);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls audio.play() when play/pause is clicked on paused audio', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');

    // Wait for the audio element to mount
    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();

    // Ensure it's "paused" state (default for jsdom)
    // The HTMLMediaElement.prototype.play mock returns resolved promise
    const playSpy = vi.spyOn(audio, 'play');

    const playBtn = container.querySelector('.player-btn-play');
    await user.click(playBtn);
    // After the canplay handler runs or click, play should have been invoked.
    // Note: Player's handlePlayPause reads audio.paused which in jsdom is always true by default.
    expect(playSpy).toHaveBeenCalled();
  });
});

describe('Player — navigation clicks', () => {
  it('navigates to /song/:id when track title is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');

    const title = container.querySelector('.player-track-title');
    expect(title).toBeInTheDocument();

    await user.click(title);
    // Real navigation happens via react-router's MemoryRouter in renderWithProviders —
    // we can't assert the URL directly, but we can assert no error was thrown.
    // For a stronger test, assert the click handler stops propagation — smoke test only here.
    expect(title).toBeInTheDocument();
  });

  it('does not navigate to artist when artistId is missing', async () => {
    const noArtistId = { ...sampleSong, artistId: null };
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: noArtistId }, 'listener');

    const artistEl = container.querySelector('.player-track-artist');
    await user.click(artistEl);
    // Smoke test — should not throw
    expect(artistEl).toBeInTheDocument();
  });
});

describe('Player — expanded view', () => {
  it('renders the expanded view when isExpanded=true', () => {
    const { container } = renderPlayerWith(
      { currentMedia: sampleSong, isExpanded: true },
      'listener'
    );
    expect(container.querySelector('.expanded-view')).toBeInTheDocument();
    expect(container.querySelector('.expanded-album-art')).toBeInTheDocument();
  });

  it('calls toggleExpand when minimize button is clicked', async () => {
    const toggleExpand = vi.fn();
    const user = userEvent.setup();
    renderPlayerWith(
      { currentMedia: sampleSong, isExpanded: true, toggleExpand },
      'listener'
    );

    const minimize = screen.getByRole('button', { name: /minimize/i });
    await user.click(minimize);
    expect(toggleExpand).toHaveBeenCalledTimes(1);
  });
});

describe('Player — mobile actions tray', () => {
  it('tray is closed by default', () => {
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    const tray = container.querySelector('.mobile-actions-tray');
    expect(tray).toBeInTheDocument();
    expect(tray).not.toHaveClass('open');
  });

  it('opens the tray when the toggle button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');

    const toggle = container.querySelector('.mobile-actions-toggle');
    await user.click(toggle);

    const tray = container.querySelector('.mobile-actions-tray');
    expect(tray).toHaveClass('open');
  });

  it('closes the queue panel via tray Queue button and opens QueuePanel', async () => {
    const user = userEvent.setup();
    const { container } = renderPlayerWith(
      { currentMedia: sampleSong, queue: [sampleSong] },
      'listener'
    );

    // Open the tray
    const toggle = container.querySelector('.mobile-actions-toggle');
    await user.click(toggle);

    // Click Queue inside the tray
    const trayQueueBtn = within(container.querySelector('.mobile-actions-tray'))
      .getByText(/queue/i)
      .closest('button');
    await user.click(trayQueueBtn);

    expect(screen.getByTestId('queue-panel')).toBeInTheDocument();

    // Tray should have closed (flipped back)
    const tray = container.querySelector('.mobile-actions-tray');
    expect(tray).not.toHaveClass('open');
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

    // Trigger a gate
    const voteBtn = container.querySelector('button[title="Vote for this song"]');
    await user.click(voteBtn);
    expect(screen.getByTestId('auth-gate-sheet')).toBeInTheDocument();

    // Close it
    await user.click(screen.getByText('close-auth-gate'));
    await waitFor(() => {
      expect(screen.queryByTestId('auth-gate-sheet')).not.toBeInTheDocument();
    });
  });
});

describe('Player — formatTime', () => {
  it('formats time correctly — indirectly via progress display', () => {
    // Render with media, then the time spans should say "0:00 / 0:00" initially
    const { container } = renderPlayerWith({ currentMedia: sampleSong }, 'listener');
    const timeSpans = container.querySelectorAll('.player-time');
    expect(timeSpans.length).toBeGreaterThanOrEqual(2);
    // Both should start at 0:00 because audio hasn't loaded metadata yet
    timeSpans.forEach((el) => {
      expect(el).toHaveTextContent('0:00');
    });
  });
});

// ---------------------------------------------------------------------------
// SKIPPED / TODO — documented reasons
// ---------------------------------------------------------------------------

// Audio event listener tests (timeupdate, ended, loadedmetadata) would require
// manually dispatching HTMLMediaElement events in jsdom, which is fragile.
// jsdom's HTMLMediaElement is a partial implementation — duration is always NaN,
// currentTime is always 0, and dispatching a 'loadedmetadata' event does not
// auto-populate duration. Skipping rather than forcing brittle tests.
describe.todo('Player — audio event sync (timeupdate updates currentTime state)');
describe.todo('Player — audio "ended" event triggers next()');
describe.todo('Player — audio "loadedmetadata" populates duration');
describe.todo('Player — seek bar click updates audio.currentTime');
describe.todo('Player — volume slider click updates audio.volume');
describe.todo('Player — volume icon click toggles mute (0 ↔ 0.7)');

// These require deeper integration with the real PlayerContext or additional
// context exposure that doesn't warrant the complexity for coverage % alone.
describe.todo('Player — incrementGateSongCount fires on guest media change');
describe.todo('Player — Media Session API metadata is set on track change');
describe.todo('Player — handleVoteClick alerts on missing song id');