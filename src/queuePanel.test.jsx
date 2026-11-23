// src/queuePanel.test.jsx
//
// Tests for QueuePanel — the "playback cockpit" queue.
//
// Covers:
//   • render gating, animated close (grab handle, chevron, overlay)
//   • header: song count, upcoming count, avatar fallback chain
//   • now-playing hero: title/artist, "Playing from" playlist link
//   • transport: shuffle, previous, play/pause, next, repeat
//   • live scrubber mirrors the real <audio> element
//   • queue rows: tap to play the exact position, current/past states
//   • removal is always confirmed in place (one song, a playlist group, clear)
//   • playlist groups: label, count, "Remove all", open the playlist
//   • overflow menu: Save as playlist, Clear queue
//   • save-as-playlist modal: validation, success toast with View, failure
//   • drag-and-drop reorder calls moveQueueItem once, on drop
//
// PlayerContext is supplied directly; useAuth, useFeedback and useNavigate
// are mocked. DndContext is wrapped so a drop can be fired by hand — jsdom has
// no layout, so a real pointer drag can't be simulated.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./queuePanel.scss', () => ({}));

const authState = { user: { username: 'charles', photoUrl: null } };
vi.mock('./context/AuthContext', () => ({
  useAuth: () => authState,
}));

const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigate,
}));

// Capture the drag handlers QueuePanel passes to DndContext.
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
import QueuePanel from './QueuePanel';

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------
const makeTrack = (id, overrides = {}) => ({
  qid: `q-${id}`,
  songId: `song-${id}`,
  title: `Track ${id}`,
  artist: `Artist ${id}`,
  artworkUrl: `/art/${id}.jpg`,
  duration: 180000, // queue durations are milliseconds → 3:00
  ...overrides,
});

const fromPlaylist = (id, overrides = {}) => makeTrack(id, {
  origin: { type: 'playlist', batchId: 'batch-1', playlistId: 'pl-9', name: 'Gym Mix' },
  ...overrides,
});

const makeContext = (overrides = {}) => ({
  queue: [],
  currentIndex: 0,
  currentMedia: null,
  removeQueueItems: vi.fn(),
  moveQueueItem: vi.fn(),
  clearQueue: vi.fn(),
  saveQueueAsPlaylist: vi.fn().mockResolvedValue('pl-new'),
  playQueueIndex: vi.fn(),
  isShuffled: false,
  toggleShuffle: vi.fn(),
  isPlaying: false,
  togglePlayPause: vi.fn(),
  next: vi.fn(),
  prev: vi.fn(),
  repeatMode: 'off',
  cycleRepeat: vi.fn(),
  audioRef: { current: null },
  ...overrides,
});

const renderQueuePanel = (contextOverrides = {}, props = {}) => {
  const ctx = makeContext(contextOverrides);
  const onClose = props.onClose || vi.fn();
  const user = userEvent.setup();
  const result = render(
    <PlayerContext.Provider value={ctx}>
      <QueuePanel open={true} onClose={onClose} {...props} />
    </PlayerContext.Provider>
  );
  return { ctx, user, onClose, ...result };
};

const three = () => [makeTrack(1), makeTrack(2), makeTrack(3)];

/** The clickable row for a track title. */
const rowOf = (title) => screen.getAllByText(title)
  .map((el) => el.closest('.qp-item'))
  .find(Boolean);

// The queue's own actions (Select · Save · Clear) sit in the "Up next" bar,
// always in view; there is no options menu any more.
const clearChip = () => screen.getByRole('button', { name: 'Clear queue' });
const saveChip = () => screen.getByRole('button', { name: 'Save queue as playlist' });

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = { username: 'charles', photoUrl: null };
  dnd = {};
});

describe('QueuePanel', () => {
  // =========================================================================
  describe('render gating and closing', () => {
    it('renders nothing when open=false', () => {
      const { container } = render(
        <PlayerContext.Provider value={makeContext()}>
          <QueuePanel open={false} onClose={vi.fn()} />
        </PlayerContext.Provider>
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders the panel when open=true', () => {
      renderQueuePanel();
      expect(screen.getByRole('heading', { name: 'Queue' })).toBeInTheDocument();
    });

    it.each([
      ['the chevron', () => screen.getAllByRole('button', { name: /close queue/i })[1]],
      ['the grab handle', () => screen.getAllByRole('button', { name: /close queue/i })[0]],
      ['the overlay', () => document.querySelector('.qp-overlay')],
    ])('%s closes after the slide-out animation', (_label, target) => {
      vi.useFakeTimers();
      const { onClose } = renderQueuePanel();
      fireEvent.click(target());

      expect(document.querySelector('.qp-overlay')).toHaveClass('qp-closing');
      expect(onClose).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(280); });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('clicking inside the panel does not close it', async () => {
      const { user, onClose } = renderQueuePanel();
      await user.click(document.querySelector('.qp-container'));
      expect(document.querySelector('.qp-overlay')).not.toHaveClass('qp-closing');
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('header', () => {
    it('says "1 song" for a single track', () => {
      renderQueuePanel({ queue: [makeTrack(1)] });
      expect(document.querySelector('.qp-sub')).toHaveTextContent(/^1 song\b/);
    });

    it('says "songs", and the Up next bar counts what is upcoming', () => {
      renderQueuePanel({ queue: three(), currentIndex: 0 });
      expect(document.querySelector('.qp-sub')).toHaveTextContent(/^3 songs\b/);
      expect(document.querySelector('.qp-count')).toHaveTextContent('2');
    });

    it('drops the upcoming count on the last track', () => {
      renderQueuePanel({ queue: three(), currentIndex: 2 });
      expect(document.querySelector('.qp-sub')).toHaveTextContent(/^3 songs\b/);
      expect(document.querySelector('.qp-count')).toBeNull();
    });

    it('shows the username initial when there is no photo', () => {
      renderQueuePanel();
      expect(document.querySelector('.qp-avatar')).toHaveTextContent('C');
    });

    it('shows the profile photo when there is one', () => {
      authState.user = { username: 'charles', photoUrl: 'https://cdn.unis.test/me.jpg' };
      renderQueuePanel();
      expect(document.querySelector('.qp-avatar img')).toHaveAttribute('src', 'https://cdn.unis.test/me.jpg');
    });

    it('falls back to an icon for a guest', () => {
      authState.user = null;
      renderQueuePanel();
      const avatar = document.querySelector('.qp-avatar');
      expect(avatar.querySelector('svg')).not.toBeNull();
      expect(avatar).toHaveAttribute('title', 'You');
    });
  });

  // =========================================================================
  describe('now playing', () => {
    it('is hidden when nothing is queued or playing', () => {
      renderQueuePanel();
      expect(screen.queryByText(/now playing/i)).not.toBeInTheDocument();
    });

    it('shows the current track from the queue', () => {
      renderQueuePanel({ queue: three(), currentIndex: 1 });
      const hero = document.querySelector('.qp-now');
      expect(within(hero).getByText('Track 2')).toBeInTheDocument();
      expect(within(hero).getByText('Artist 2')).toBeInTheDocument();
    });

    it('prefers currentMedia over the queue position', () => {
      renderQueuePanel({
        queue: three(),
        currentMedia: { title: 'Live Cut', artistName: 'Someone Else' },
      });
      const hero = document.querySelector('.qp-now');
      expect(within(hero).getByText('Live Cut')).toBeInTheDocument();
      expect(within(hero).getByText('Someone Else')).toBeInTheDocument();
    });

    it('falls back to Untitled / Unknown', () => {
      renderQueuePanel({ currentMedia: {} });
      const hero = document.querySelector('.qp-now');
      expect(within(hero).getByText('Untitled')).toBeInTheDocument();
      expect(within(hero).getByText('Unknown')).toBeInTheDocument();
    });

    it('"Playing from" opens the playlist the song came from', () => {
      vi.useFakeTimers();
      const { onClose } = renderQueuePanel({ queue: [fromPlaylist(1), fromPlaylist(2)] });
      fireEvent.click(document.querySelector('.qp-playing-from'));

      expect(navigate).toHaveBeenCalledWith('/playlist/pl-9');
      act(() => { vi.advanceTimersByTime(280); });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  describe('transport', () => {
    it('wires previous, play/pause and next to the player', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(screen.getByRole('button', { name: 'Previous' }));
      await user.click(screen.getByRole('button', { name: 'Play' }));
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(ctx.prev).toHaveBeenCalledTimes(1);
      expect(ctx.togglePlayPause).toHaveBeenCalledTimes(1);
      expect(ctx.next).toHaveBeenCalledTimes(1);
    });

    it('labels the main button Pause while playing', () => {
      renderQueuePanel({ queue: three(), isPlaying: true });
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    });

    it('shuffle toggles and reflects its state', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three(), isShuffled: true });
      const shuffle = screen.getByTitle('Shuffle on');
      expect(shuffle).toHaveAttribute('aria-pressed', 'true');
      await user.click(shuffle);
      expect(ctx.toggleShuffle).toHaveBeenCalledTimes(1);
    });

    it('shuffle is disabled with fewer than two songs', () => {
      renderQueuePanel({ queue: [makeTrack(1)] });
      expect(screen.getByTitle('Shuffle off')).toBeDisabled();
    });

    it.each([
      ['off', 'Repeat off', false],
      ['all', 'Repeat all', true],
      ['one', 'Repeat one', true],
    ])('repeat mode "%s" is labelled "%s"', async (repeatMode, label, isOn) => {
      const { ctx, user } = renderQueuePanel({ queue: three(), repeatMode });
      const repeat = screen.getByRole('button', { name: label });
      expect(repeat.classList.contains('qp-on')).toBe(isOn);
      await user.click(repeat);
      expect(ctx.cycleRepeat).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  describe('scrubber', () => {
    const makeAudio = (currentTime, duration) => {
      const audio = document.createElement('audio');
      Object.defineProperty(audio, 'duration', { value: duration, configurable: true });
      audio.currentTime = currentTime;
      return audio;
    };

    it('starts at 0:00 with no audio element', () => {
      renderQueuePanel({ queue: three() });
      expect(screen.getByRole('slider', { name: 'Seek' })).toHaveAttribute('aria-valuenow', '0');
      expect(document.querySelector('.qp-seek-times')).toHaveTextContent('0:00-0:00');
    });

    it('mirrors the audio element position and time left', () => {
      const audio = makeAudio(30, 120);
      renderQueuePanel({ queue: three(), audioRef: { current: audio } });
      expect(screen.getByRole('slider', { name: 'Seek' })).toHaveAttribute('aria-valuenow', '25');
      expect(document.querySelector('.qp-seek-times')).toHaveTextContent('0:30-1:30');
    });

    it('follows timeupdate events', () => {
      const audio = makeAudio(0, 200);
      renderQueuePanel({ queue: three(), audioRef: { current: audio } });
      audio.currentTime = 100;
      act(() => { audio.dispatchEvent(new Event('timeupdate')); });
      expect(screen.getByRole('slider', { name: 'Seek' })).toHaveAttribute('aria-valuenow', '50');
    });

    it('clicking the bar seeks the audio', () => {
      const audio = makeAudio(0, 200);
      renderQueuePanel({ queue: three(), audioRef: { current: audio } });
      const bar = screen.getByRole('slider', { name: 'Seek' });
      bar.getBoundingClientRect = () => ({ left: 0, width: 400, top: 0, height: 4, right: 400, bottom: 4 });

      // jsdom's PointerEvent drops clientX, so send a MouseEvent of that type.
      fireEvent(bar, new MouseEvent('pointerdown', { bubbles: true, clientX: 300 }));
      expect(audio.currentTime).toBe(150);
      expect(bar).toHaveAttribute('aria-valuenow', '75');
    });
  });

  // =========================================================================
  describe('queue list', () => {
    it('shows the empty state and disables Save and Clear', () => {
      renderQueuePanel();
      expect(screen.getByText(/your queue is empty/i)).toBeInTheDocument();
      expect(saveChip()).toBeDisabled();
      expect(clearChip()).toBeDisabled();
    });

    it('renders one row per track with its duration', () => {
      renderQueuePanel({ queue: three() });
      expect(document.querySelectorAll('.qp-item')).toHaveLength(3);
      expect(document.querySelectorAll('.qp-duration')[0]).toHaveTextContent('3:00');
    });

    it('falls back to Untitled / Unknown in a row', () => {
      renderQueuePanel({ queue: [makeTrack(1), makeTrack(2, { title: undefined, artist: undefined })] });
      const row = document.querySelectorAll('.qp-item')[1];
      expect(within(row).getByText('Untitled')).toBeInTheDocument();
      expect(within(row).getByText('Unknown')).toBeInTheDocument();
    });

    it('folds away the songs already played, and dims them when unfolded', async () => {
      const { user } = renderQueuePanel({ queue: three(), currentIndex: 1 });
      let rows = document.querySelectorAll('.qp-item');
      expect(rows).toHaveLength(2);                 // played song folded away
      expect(rows[0]).toHaveClass('qp-current');
      expect(rows[0]).toHaveAttribute('aria-current', 'true');

      await user.click(screen.getByRole('button', { name: /played · 1 song/i }));
      rows = document.querySelectorAll('.qp-item');
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveClass('qp-past');
      expect(rows[1]).toHaveClass('qp-current');
      expect(rows[2]).not.toHaveClass('qp-past');
    });

    it('the current row has playing bars instead of a grip or a remove button', () => {
      renderQueuePanel({ queue: three(), currentIndex: 0, isPlaying: true });
      const current = document.querySelector('.qp-current');
      expect(current.querySelector('.qp-now-playing')).not.toBeNull();
      expect(current.querySelector('.qp-paused')).toBeNull();
      expect(current.querySelector('.qp-grip')).toBeNull();
      expect(current.querySelector('.qp-remove')).toBeNull();
    });

    it('the playing bars freeze when paused', () => {
      renderQueuePanel({ queue: three(), isPlaying: false });
      expect(document.querySelector('.qp-current .qp-now-playing')).toHaveClass('qp-paused');
    });

    it('tapping a row plays that exact queue position', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(rowOf('Track 3'));
      expect(ctx.playQueueIndex).toHaveBeenCalledWith(2);
    });

    it('a song queued twice plays the copy that was tapped', async () => {
      const queue = [makeTrack(1), makeTrack(2), makeTrack(2, { qid: 'q-2-again' })];
      const { ctx, user } = renderQueuePanel({ queue });
      await user.click(document.querySelectorAll('.qp-item')[2]);
      expect(ctx.playQueueIndex).toHaveBeenCalledWith(2);
    });

    it('Enter on a focused row plays it', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      rowOf('Track 2').focus();
      await user.keyboard('{Enter}');
      expect(ctx.playQueueIndex).toHaveBeenCalledWith(1);
    });

    it('clicking the grip does not play the row', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(screen.getByRole('button', { name: 'Reorder Track 2' }));
      expect(ctx.playQueueIndex).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  describe('removing one song', () => {
    it('asks first — nothing is removed on the first tap', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(screen.getByRole('button', { name: 'Remove Track 2 from queue' }));

      expect(screen.getByText('Remove?')).toBeInTheDocument();
      expect(ctx.removeQueueItems).not.toHaveBeenCalled();
      expect(ctx.playQueueIndex).not.toHaveBeenCalled();
    });

    it('Remove confirms and removes by queue id', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(screen.getByRole('button', { name: 'Remove Track 2 from queue' }));
      await user.click(screen.getByRole('button', { name: 'Remove' }));

      expect(ctx.removeQueueItems).toHaveBeenCalledWith(['q-2']);
      expect(screen.queryByText('Remove?')).not.toBeInTheDocument();
    });

    it('Cancel keeps the song', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(screen.getByRole('button', { name: 'Remove Track 2 from queue' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(ctx.removeQueueItems).not.toHaveBeenCalled();
      expect(screen.queryByText('Remove?')).not.toBeInTheDocument();
    });

    it('Escape cancels the confirmation', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(screen.getByRole('button', { name: 'Remove Track 2 from queue' }));
      await user.keyboard('{Escape}');

      expect(screen.queryByText('Remove?')).not.toBeInTheDocument();
      expect(ctx.removeQueueItems).not.toHaveBeenCalled();
    });

    it('tapping the row while it is confirming does not play it', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(screen.getByRole('button', { name: 'Remove Track 2 from queue' }));
      await user.click(rowOf('Track 2'));
      expect(ctx.playQueueIndex).not.toHaveBeenCalled();
    });

    it('playing another row drops the pending confirmation', async () => {
      const { user } = renderQueuePanel({ queue: three() });
      await user.click(screen.getByRole('button', { name: 'Remove Track 2 from queue' }));
      await user.click(rowOf('Track 3'));
      expect(screen.queryByText('Remove?')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  describe('playlist groups', () => {
    const grouped = () => [makeTrack(1), fromPlaylist(2), fromPlaylist(3), fromPlaylist(4), makeTrack(5)];

    it('labels the group once, with its song count', () => {
      renderQueuePanel({ queue: grouped() });
      const labels = document.querySelectorAll('.qp-group-label');
      expect(labels).toHaveLength(1);
      expect(within(labels[0]).getByText('Gym Mix')).toBeInTheDocument();
      expect(labels[0].querySelector('.qp-group-count')).toHaveTextContent('3');
    });

    it('rails every song in the group and marks its first and last', () => {
      renderQueuePanel({ queue: grouped() });
      const railed = document.querySelectorAll('.qp-railed');
      expect(railed).toHaveLength(3);
      expect(railed[0]).toHaveClass('qp-rail-first');
      expect(railed[2]).toHaveClass('qp-rail-last');
    });

    it('two separate adds of the same playlist are two groups', () => {
      const queue = [
        fromPlaylist(1), fromPlaylist(2),
        makeTrack(3),
        fromPlaylist(4, { origin: { type: 'playlist', batchId: 'batch-2', playlistId: 'pl-9', name: 'Gym Mix' } }),
      ];
      renderQueuePanel({ queue, currentIndex: 0 });
      expect(document.querySelectorAll('.qp-group-label')).toHaveLength(2);
    });

    it('the group label opens the playlist', async () => {
      const { user } = renderQueuePanel({ queue: grouped() });
      await user.click(screen.getByTitle('Open Gym Mix'));
      expect(navigate).toHaveBeenCalledWith('/playlist/pl-9');
    });

    it('"Remove all" asks first, then removes the whole group', async () => {
      const { ctx, user } = renderQueuePanel({ queue: grouped() });
      await user.click(screen.getByRole('button', { name: /remove all songs from Gym Mix/i }));

      expect(screen.getByText(/remove 3 songs from/i)).toBeInTheDocument();
      expect(ctx.removeQueueItems).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Remove' }));
      expect(ctx.removeQueueItems).toHaveBeenCalledWith(['q-2', 'q-3', 'q-4']);
    });

    it('never removes the song that is playing', async () => {
      const { ctx, user } = renderQueuePanel({ queue: grouped(), currentIndex: 2 });
      await user.click(screen.getByRole('button', { name: /remove all songs from Gym Mix/i }));
      expect(screen.getByText(/remove 2 songs from/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Remove' }));
      expect(ctx.removeQueueItems).toHaveBeenCalledWith(['q-2', 'q-4']);
    });

    it('hides "Remove all" when only one song in the group can go', () => {
      renderQueuePanel({ queue: [fromPlaylist(1), fromPlaylist(2)], currentIndex: 0 });
      expect(screen.queryByRole('button', { name: /remove all songs/i })).not.toBeInTheDocument();
    });

    it('Cancel keeps the group', async () => {
      const { ctx, user } = renderQueuePanel({ queue: grouped() });
      await user.click(screen.getByRole('button', { name: /remove all songs from Gym Mix/i }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(ctx.removeQueueItems).not.toHaveBeenCalled();
      expect(screen.getByText('Gym Mix')).toBeInTheDocument();
    });
  });

  // =========================================================================
  describe('Save and Clear in the Up next bar', () => {
    it('are always in view while the queue has songs', () => {
      renderQueuePanel({ queue: three() });
      expect(saveChip()).toBeEnabled();
      expect(clearChip()).toBeEnabled();
    });

    it('Clear queue asks first', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(clearChip());

      expect(screen.getByText(/clear the entire queue\? playback will stop/i)).toBeInTheDocument();
      expect(ctx.clearQueue).not.toHaveBeenCalled();
    });

    it('Clear confirms and empties the queue', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(clearChip());
      await user.click(screen.getByRole('button', { name: 'Clear' }));

      expect(ctx.clearQueue).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Up next')).toBeInTheDocument();
    });

    it('Cancel keeps the queue', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await user.click(clearChip());
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(ctx.clearQueue).not.toHaveBeenCalled();
      expect(screen.getByText('Up next')).toBeInTheDocument();
    });
  });

  // =========================================================================
  describe('save as playlist', () => {
    const openSave = async (user) => {
      await user.click(saveChip());
    };

    it('opens the modal with Save disabled until a name is typed', async () => {
      const { user } = renderQueuePanel({ queue: three() });
      await openSave(user);

      expect(screen.getByRole('heading', { name: /save queue as playlist/i })).toBeInTheDocument();
      const save = screen.getByRole('button', { name: 'Save' });
      expect(save).toBeDisabled();

      await user.type(screen.getByPlaceholderText(/playlist name/i), '   ');
      expect(save).toBeDisabled();

      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Late Night');
      expect(save).toBeEnabled();
    });

    it('saves the trimmed name, closes, and confirms with a toast', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await openSave(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), '  Late Night  ');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(ctx.saveQueueAsPlaylist).toHaveBeenCalledWith('Late Night'));
      await waitFor(() => expect(screen.queryByPlaceholderText(/playlist name/i)).not.toBeInTheDocument());
      expect(feedback.success).toHaveBeenCalledWith(
        'Saved your queue as “Late Night”',
        expect.objectContaining({ action: expect.objectContaining({ label: 'View' }) })
      );
    });

    it('the toast\'s View action opens the new playlist', async () => {
      const { user } = renderQueuePanel({ queue: three() });
      await openSave(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Late Night');
      await user.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(feedback.success).toHaveBeenCalled());

      act(() => { feedback.success.mock.calls[0][1].action.onClick(); });
      expect(navigate).toHaveBeenCalledWith('/playlist/pl-new');
    });

    it('offers no View action when the save returns no id', async () => {
      const { user } = renderQueuePanel({
        queue: three(),
        saveQueueAsPlaylist: vi.fn().mockResolvedValue(undefined),
      });
      await openSave(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Late Night');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(feedback.success).toHaveBeenCalled());
      expect(feedback.success.mock.calls[0][1]).toBeUndefined();
    });

    it('Enter in the name box saves', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await openSave(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Late Night{Enter}');
      await waitFor(() => expect(ctx.saveQueueAsPlaylist).toHaveBeenCalledWith('Late Night'));
    });

    it('Cancel closes the modal and forgets the name', async () => {
      const { ctx, user } = renderQueuePanel({ queue: three() });
      await openSave(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Late Night');
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(ctx.saveQueueAsPlaylist).not.toHaveBeenCalled();

      await openSave(user);
      expect(screen.getByPlaceholderText(/playlist name/i)).toHaveValue('');
    });

    it('a failed save tells the user and keeps the modal open', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { user } = renderQueuePanel({
        queue: three(),
        saveQueueAsPlaylist: vi.fn().mockRejectedValue(new Error('nope')),
      });
      await openSave(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Late Night');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(feedback.error).toHaveBeenCalledWith(
        "Couldn't save your queue as a playlist. Try again."
      ));
      expect(feedback.success).not.toHaveBeenCalled();
      expect(screen.getByPlaceholderText(/playlist name/i)).toHaveValue('Late Night');
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    it('shows a busy label while saving', async () => {
      let finish;
      const { user } = renderQueuePanel({
        queue: three(),
        saveQueueAsPlaylist: vi.fn(() => new Promise((resolve) => { finish = resolve; })),
      });
      await openSave(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Late Night');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
      await act(async () => { finish('pl-new'); });
    });
  });

  // =========================================================================
  describe('drag-and-drop reorder', () => {
    it('gives every row except the current one a reorder grip', () => {
      renderQueuePanel({ queue: three(), currentIndex: 0 });
      expect(screen.queryByRole('button', { name: 'Reorder Track 1' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reorder Track 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reorder Track 3' })).toBeInTheDocument();
    });

    it('a drop moves the song from its old position to the new one', () => {
      const { ctx } = renderQueuePanel({ queue: three() });
      act(() => { dnd.onDragStart({ active: { id: 'q-3' } }); });
      act(() => { dnd.onDragEnd({ active: { id: 'q-3' }, over: { id: 'q-2' } }); });
      expect(ctx.moveQueueItem).toHaveBeenCalledTimes(1);
      expect(ctx.moveQueueItem).toHaveBeenCalledWith(2, 1);
    });

    it('dropping a song back where it started changes nothing', () => {
      const { ctx } = renderQueuePanel({ queue: three() });
      act(() => { dnd.onDragEnd({ active: { id: 'q-2' }, over: { id: 'q-2' } }); });
      expect(ctx.moveQueueItem).not.toHaveBeenCalled();
    });

    it('dropping outside the list changes nothing', () => {
      const { ctx } = renderQueuePanel({ queue: three() });
      act(() => { dnd.onDragEnd({ active: { id: 'q-2' }, over: null }); });
      expect(ctx.moveQueueItem).not.toHaveBeenCalled();
    });

    it('marks the list while a drag is in progress and clears it on cancel', () => {
      renderQueuePanel({ queue: three() });
      act(() => { dnd.onDragStart({ active: { id: 'q-2' } }); });
      expect(document.querySelector('.qp-list')).toHaveClass('qp-list-dragging');
      act(() => { dnd.onDragCancel(); });
      expect(document.querySelector('.qp-list')).not.toHaveClass('qp-list-dragging');
    });

    it('starting a drag drops a pending removal confirmation', async () => {
      const { user } = renderQueuePanel({ queue: three() });
      await user.click(screen.getByRole('button', { name: 'Remove Track 2 from queue' }));
      act(() => { dnd.onDragStart({ active: { id: 'q-3' } }); });
      expect(screen.queryByText('Remove?')).not.toBeInTheDocument();
    });
  });
});
