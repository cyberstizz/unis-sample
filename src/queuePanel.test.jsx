// src/queuePanel.test.jsx
//
// Tests for the queue panel: header, Now Playing cockpit (like, transport),
// the always-visible queue actions, the played-songs fold, select mode,
// removal, the end-of-queue note and closing.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import QueuePanel from './QueuePanel';

vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'stizz', photoUrl: null } }),
}));

const feedbackMock = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./context/FeedbackContext', () => ({
  useFeedback: () => feedbackMock,
  errorMessage: (_e, fallback) => fallback,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Durations are milliseconds; track n lasts n minutes.
const makeTrack = (n, overrides = {}) => ({
  qid: `q${n}`,
  id: `song-${n}`,
  title: `Track ${n}`,
  artist: `Artist ${n}`,
  artworkUrl: `/art/${n}.jpg`,
  duration: n * 60_000,
  origin: null,
  ...overrides,
});

const makeContext = (overrides = {}) => ({
  queue: [],
  currentIndex: 0,
  currentMedia: null,
  removeQueueItems: vi.fn(),
  moveQueueItem: vi.fn(),
  moveQueueItemsNext: vi.fn(),
  clearQueue: vi.fn(),
  saveQueueAsPlaylist: vi.fn().mockResolvedValue('pl-1'),
  playQueueIndex: vi.fn(),
  isShuffled: false,
  toggleShuffle: vi.fn(),
  isPlaying: true,
  togglePlayPause: vi.fn(),
  next: vi.fn(),
  prev: vi.fn(),
  repeatMode: 'off',
  cycleRepeat: vi.fn(),
  audioRef: { current: null },
  ...overrides,
});

const fourSongs = (currentIndex = 0) => {
  const queue = [1, 2, 3, 4].map((n) => makeTrack(n));
  return { queue, currentIndex, currentMedia: queue[currentIndex] };
};

const renderPanel = (contextOverrides = {}, props = {}) => {
  const ctx = makeContext(contextOverrides);
  const user = userEvent.setup();
  const onClose = vi.fn();
  const result = render(
    <MemoryRouter>
      <PlayerContext.Provider value={ctx}>
        <QueuePanel open onClose={onClose} {...props} />
      </PlayerContext.Provider>
    </MemoryRouter>
  );
  return { ctx, user, onClose, ...result };
};

const rowFor = (title) => screen.getByText(title, { selector: '.qp-title' }).closest('.qp-item');

beforeEach(() => {
  vi.clearAllMocks();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

// ---------------------------------------------------------------------------

describe('QueuePanel', () => {
  describe('render gating and header', () => {
    it('renders nothing when closed', () => {
      const { container } = render(
        <MemoryRouter>
          <PlayerContext.Provider value={makeContext()}>
            <QueuePanel open={false} onClose={vi.fn()} />
          </PlayerContext.Provider>
        </MemoryRouter>
      );
      expect(container.firstChild).toBeNull();
    });

    it('shows the song count and the listening time left', () => {
      renderPanel(fourSongs(0));
      // 1 + 2 + 3 + 4 minutes, nothing played yet
      expect(screen.getByText(/4 songs/)).toBeInTheDocument();
      expect(screen.getByText('10 min left')).toBeInTheDocument();
    });

    it('uses the singular for one song', () => {
      const t = makeTrack(1);
      renderPanel({ queue: [t], currentMedia: t });
      expect(screen.getByText(/^1 song/)).toBeInTheDocument();
    });

    it('drops the time left when repeat one is on', () => {
      renderPanel({ ...fourSongs(0), repeatMode: 'one' });
      expect(screen.queryByText(/left$/)).not.toBeInTheDocument();
    });
  });

  describe('Now Playing cockpit', () => {
    it('renders the themed bottom edge and the artwork bleed', () => {
      const { container } = renderPanel(fourSongs(0));
      expect(container.querySelector('.qp-now .qp-now-edge')).toBeInTheDocument();
      expect(container.querySelector('.qp-now .qp-now-bleed')).toBeInTheDocument();
    });

    it('shows a like button wired to the player', async () => {
      const onToggleLike = vi.fn();
      const { user } = renderPanel(fourSongs(0), { isLiked: false, onToggleLike });
      const like = screen.getByRole('button', { name: 'Like this song' });
      expect(like).toHaveAttribute('aria-pressed', 'false');
      await user.click(like);
      expect(onToggleLike).toHaveBeenCalledTimes(1);
    });

    it('marks the like button when the song is liked', () => {
      renderPanel(fourSongs(0), { isLiked: true, onToggleLike: vi.fn() });
      const like = screen.getByRole('button', { name: 'Unlike this song' });
      expect(like).toHaveAttribute('aria-pressed', 'true');
      expect(like).toHaveClass('qp-like-on');
    });

    it('hides the like button when no handler is given', () => {
      renderPanel(fourSongs(0));
      expect(screen.queryByRole('button', { name: /like this song/i })).not.toBeInTheDocument();
    });

    it('wires the transport buttons', async () => {
      const { ctx, user } = renderPanel(fourSongs(1));
      await user.click(screen.getByRole('button', { name: 'Previous' }));
      await user.click(screen.getByRole('button', { name: 'Pause' }));
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await user.click(screen.getByRole('button', { name: 'Shuffle off' }));
      await user.click(screen.getByRole('button', { name: 'Repeat off' }));
      expect(ctx.prev).toHaveBeenCalled();
      expect(ctx.togglePlayPause).toHaveBeenCalled();
      expect(ctx.next).toHaveBeenCalled();
      expect(ctx.toggleShuffle).toHaveBeenCalled();
      expect(ctx.cycleRepeat).toHaveBeenCalled();
    });
  });

  describe('queue actions', () => {
    it('keeps Select, Save and Clear in view', () => {
      renderPanel(fourSongs(0));
      expect(screen.getByRole('button', { name: /select/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Save queue as playlist' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Clear queue' })).toBeEnabled();
    });

    it('asks before clearing, then clears', async () => {
      const { ctx, user } = renderPanel(fourSongs(0));
      await user.click(screen.getByRole('button', { name: 'Clear queue' }));
      expect(screen.getByText(/Clear the entire queue/)).toBeInTheDocument();
      expect(ctx.clearQueue).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Clear' }));
      expect(ctx.clearQueue).toHaveBeenCalledTimes(1);
    });

    it('cancelling the clear keeps the queue', async () => {
      const { ctx, user } = renderPanel(fourSongs(0));
      await user.click(screen.getByRole('button', { name: 'Clear queue' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(ctx.clearQueue).not.toHaveBeenCalled();
      expect(screen.queryByText(/Clear the entire queue/)).not.toBeInTheDocument();
    });

    it('saves the queue as a playlist', async () => {
      const { ctx, user } = renderPanel(fourSongs(0));
      await user.click(screen.getByRole('button', { name: 'Save queue as playlist' }));
      const save = screen.getByRole('button', { name: 'Save' });
      expect(save).toBeDisabled();
      await user.type(screen.getByPlaceholderText('Playlist name...'), 'Night drive');
      await user.click(save);
      expect(ctx.saveQueueAsPlaylist).toHaveBeenCalledWith('Night drive');
      expect(feedbackMock.success).toHaveBeenCalled();
    });

    it('shows the empty state with no songs', () => {
      renderPanel();
      expect(screen.getByText('Your queue is empty')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear queue' })).toBeDisabled();
    });
  });

  describe('the list', () => {
    it('plays the exact position tapped', async () => {
      const { ctx, user } = renderPanel(fourSongs(0));
      await user.click(rowFor('Track 3'));
      expect(ctx.playQueueIndex).toHaveBeenCalledWith(2);
    });

    it('marks the current song and gives it no grip or remove button', () => {
      renderPanel(fourSongs(0));
      const current = rowFor('Track 1');
      expect(current).toHaveClass('qp-current');
      expect(within(current).queryByRole('button', { name: /reorder/i })).not.toBeInTheDocument();
      expect(within(current).queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
    });

    it('asks before removing a song, then removes it', async () => {
      const { ctx, user } = renderPanel(fourSongs(0));
      await user.click(screen.getByRole('button', { name: 'Remove Track 2 from queue' }));
      expect(ctx.removeQueueItems).not.toHaveBeenCalled();
      await user.click(screen.getByRole('button', { name: 'Remove' }));
      expect(ctx.removeQueueItems).toHaveBeenCalledWith(['q2']);
    });

    it('formats durations as m:ss', () => {
      renderPanel({ queue: [makeTrack(1, { duration: 65_000 })], currentIndex: 0 });
      expect(screen.getByText('1:05')).toBeInTheDocument();
    });
  });

  describe('played songs fold', () => {
    it('folds songs already played into one row', () => {
      renderPanel(fourSongs(2));
      expect(screen.getByRole('button', { name: /Played · 2 songs/ })).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Track 1', { selector: '.qp-title' })).not.toBeInTheDocument();
      expect(screen.getByText('Track 3', { selector: '.qp-title' })).toBeInTheDocument();
    });

    it('opens to show them again, with a Now playing divider', async () => {
      const { user, ctx } = renderPanel(fourSongs(2));
      await user.click(screen.getByRole('button', { name: /Played · 2 songs/ }));
      expect(screen.getByText('Track 1', { selector: '.qp-title' })).toBeInTheDocument();
      expect(screen.getByText('Now playing', { selector: '.qp-now-divider span' })).toBeInTheDocument();
      await user.click(rowFor('Track 1'));
      expect(ctx.playQueueIndex).toHaveBeenCalledWith(0);
    });

    it('has no fold when nothing has played', () => {
      renderPanel(fourSongs(0));
      expect(screen.queryByRole('button', { name: /^Played/ })).not.toBeInTheDocument();
    });
  });

  describe('select mode', () => {
    it('selects songs and removes them together', async () => {
      const { ctx, user } = renderPanel(fourSongs(0));
      await user.click(screen.getByRole('button', { name: /select/i }));
      expect(screen.getByText('Select songs')).toBeInTheDocument();

      await user.click(rowFor('Track 2'));
      await user.click(rowFor('Track 4'));
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      expect(ctx.playQueueIndex).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: /Remove 2/ }));
      expect(ctx.removeQueueItems).toHaveBeenCalledWith(['q2', 'q4']);
      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });

    it('moves the selection to play next', async () => {
      const { ctx, user } = renderPanel(fourSongs(0));
      await user.click(screen.getByRole('button', { name: /select/i }));
      await user.click(rowFor('Track 4'));
      await user.click(screen.getByRole('button', { name: /Play next/ }));
      expect(ctx.moveQueueItemsNext).toHaveBeenCalledWith(['q4']);
    });

    it('cannot select the song playing now', async () => {
      const { user } = renderPanel(fourSongs(0));
      await user.click(screen.getByRole('button', { name: /select/i }));
      await user.click(rowFor('Track 1'));
      expect(screen.getByText('Select songs')).toBeInTheDocument();
    });

    it('All selects every other song; Done leaves', async () => {
      const { user } = renderPanel(fourSongs(0));
      await user.click(screen.getByRole('button', { name: /select/i }));
      await user.click(screen.getByRole('button', { name: 'All' }));
      expect(screen.getByText('3 selected')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(screen.getByText('Up next')).toBeInTheDocument();
    });

    it('disables the actions until something is picked', async () => {
      const { user } = renderPanel(fourSongs(0));
      await user.click(screen.getByRole('button', { name: /select/i }));
      expect(screen.getByRole('button', { name: /Play next/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /^Remove/ })).toBeDisabled();
    });
  });

  describe('end of queue note', () => {
    it.each([
      ['off', 'End of queue · playback stops here'],
      ['all', 'End of queue · repeat all starts it over'],
      ['one', 'Repeat one is on · this song keeps playing'],
    ])('repeat %s', (repeatMode, text) => {
      renderPanel({ ...fourSongs(0), repeatMode });
      expect(screen.getByText(text)).toBeInTheDocument();
    });
  });

  describe('closing', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));

    it('closes from the chevron after the slide-out', async () => {
      const { user, onClose } = renderPanel(fourSongs(0));
      await user.click(screen.getAllByRole('button', { name: 'Close queue' })[1]);
      act(() => { vi.advanceTimersByTime(300); });
      expect(onClose).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('does not close when the panel itself is clicked', async () => {
      const { user, onClose, container } = renderPanel(fourSongs(0));
      await user.click(container.querySelector('.qp-container'));
      act(() => { vi.advanceTimersByTime(300); });
      expect(onClose).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
