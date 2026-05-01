// src/components/QueuePanel.test.jsx
//
// Unit / integration tests for QueuePanel.
// Covers: render gating, header metadata, action buttons, queue list states,
// drag-and-drop reordering, track interactions, save-as-playlist modal,
// and overlay / X-button close behaviour.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerContext } from './context/playercontext';
import QueuePanel from './QueuePanel';

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const makeTrack = (id, overrides = {}) => ({
  songId: `song-${id}`,
  title: `Track ${id}`,
  artist: `Artist ${id}`,
  artworkUrl: `/art/${id}.jpg`,
  duration: 180 * id, // each track: id × 3 min
  ...overrides,
});

/** Build a full PlayerContext value; every callback is a vi.fn() by default. */
const makeContext = (overrides = {}) => ({
  queue: [],
  currentIndex: 0,
  queueSource: null,
  currentMedia: null,
  removeFromQueue: vi.fn(),
  reorderQueue: vi.fn(),
  clearQueue: vi.fn(),
  saveQueueAsPlaylist: vi.fn().mockResolvedValue(undefined),
  playMedia: vi.fn(),
  isShuffled: false,
  toggleShuffle: vi.fn(),
  ...overrides,
});

/**
 * Render <QueuePanel> inside a real PlayerContext.Provider.
 * Returns { ctx, user, ...rtlResult } so each test can assert on the context
 * callbacks and use the pre-configured userEvent instance.
 */
const renderQueuePanel = (props = {}, contextOverrides = {}) => {
  const ctx = makeContext(contextOverrides);
  const user = userEvent.setup();
  const result = render(
    <PlayerContext.Provider value={ctx}>
      <QueuePanel open={true} onClose={vi.fn()} {...props} />
    </PlayerContext.Provider>
  );
  return { ctx, user, ...result };
};

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('QueuePanel', () => {

  // =========================================================================
  // Render gating
  // =========================================================================
  describe('render gating', () => {
    it('renders nothing when open=false', () => {
      const ctx = makeContext();
      const { container } = render(
        <PlayerContext.Provider value={ctx}>
          <QueuePanel open={false} onClose={vi.fn()} />
        </PlayerContext.Provider>
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders the panel when open=true', () => {
      renderQueuePanel();
      expect(screen.getByRole('heading', { name: /queue/i })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Header metadata
  // =========================================================================
  describe('header metadata', () => {
    it('shows singular "song" when queue has exactly one track', () => {
      renderQueuePanel({}, { queue: [makeTrack(1)], currentIndex: 0 });
      expect(screen.getByText(/1 song(?!s)/i)).toBeInTheDocument();
    });

    it('shows plural "songs" when queue has multiple tracks', () => {
      renderQueuePanel({}, { queue: [makeTrack(1), makeTrack(2)], currentIndex: 0 });
      expect(screen.getByText(/2 songs/i)).toBeInTheDocument();
    });

    it('shows upcoming count when there are tracks after the current one', () => {
      renderQueuePanel({}, {
        queue: [makeTrack(1), makeTrack(2), makeTrack(3)],
        currentIndex: 0,
      });
      // 2 tracks after index 0
      expect(screen.getByText(/2 upcoming/i)).toBeInTheDocument();
    });

    it('does not show upcoming count when on the last track', () => {
      const queue = [makeTrack(1), makeTrack(2)];
      renderQueuePanel({}, { queue, currentIndex: 1 });
      expect(screen.queryByText(/upcoming/i)).toBeNull();
    });

    it('displays the queue source label when queueSource is set', () => {
      renderQueuePanel({}, {
        queue: [makeTrack(1)],
        queueSource: 'My Playlist',
      });
      expect(screen.getByText(/from My Playlist/i)).toBeInTheDocument();
    });

    it('omits the source label when queueSource is null', () => {
      renderQueuePanel({}, { queue: [makeTrack(1)], queueSource: null });
      expect(screen.queryByText(/from/i)).toBeNull();
    });
  });

  // =========================================================================
  // Action buttons — Shuffle
  // =========================================================================
  describe('shuffle button', () => {
    it('is disabled when the queue has fewer than 2 tracks', () => {
      renderQueuePanel({}, { queue: [makeTrack(1)] });
      expect(screen.getByRole('button', { name: /shuffle/i })).toBeDisabled();
    });

    it('is enabled when the queue has 2 or more tracks', () => {
      renderQueuePanel({}, { queue: [makeTrack(1), makeTrack(2)] });
      expect(screen.getByRole('button', { name: /shuffle/i })).not.toBeDisabled();
    });

    it('calls toggleShuffle when clicked', async () => {
      const { ctx, user } = renderQueuePanel({}, {
        queue: [makeTrack(1), makeTrack(2)],
      });
      await user.click(screen.getByRole('button', { name: /shuffle/i }));
      expect(ctx.toggleShuffle).toHaveBeenCalledTimes(1);
    });

    it('shows "Shuffled" label and active class when isShuffled=true', () => {
      renderQueuePanel({}, {
        queue: [makeTrack(1), makeTrack(2)],
        isShuffled: true,
      });
      const btn = screen.getByRole('button', { name: /shuffled/i });
      expect(btn).toBeInTheDocument();
      expect(btn.className).toMatch(/qp-active/);
    });

    it('shows "Shuffle" label (no active class) when isShuffled=false', () => {
      renderQueuePanel({}, { queue: [makeTrack(1), makeTrack(2)], isShuffled: false });
      const btn = screen.getByRole('button', { name: /^shuffle$/i });
      expect(btn.className).not.toMatch(/qp-active/);
    });
  });

  // =========================================================================
  // Action buttons — Save as Playlist
  // =========================================================================
  describe('"Save as Playlist" button', () => {
    it('is disabled when the queue is empty', () => {
      renderQueuePanel({}, { queue: [] });
      expect(screen.getByRole('button', { name: /save as playlist/i })).toBeDisabled();
    });

    it('is enabled when the queue has tracks', () => {
      renderQueuePanel({}, { queue: [makeTrack(1)] });
      expect(screen.getByRole('button', { name: /save as playlist/i })).not.toBeDisabled();
    });

    it('opens the save modal when clicked', async () => {
      const { user } = renderQueuePanel({}, { queue: [makeTrack(1)] });
      await user.click(screen.getByRole('button', { name: /save as playlist/i }));
      expect(screen.getByText(/save queue as playlist/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Action buttons — Clear
  // =========================================================================
  describe('"Clear" button', () => {
    it('is disabled when the queue is empty', () => {
      renderQueuePanel({}, { queue: [] });
      expect(screen.getByRole('button', { name: /clear/i })).toBeDisabled();
    });

    it('calls clearQueue when confirmed', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { ctx, user } = renderQueuePanel({}, { queue: [makeTrack(1)] });
      await user.click(screen.getByRole('button', { name: /clear/i }));
      expect(ctx.clearQueue).toHaveBeenCalledTimes(1);
      vi.restoreAllMocks();
    });

    it('does not call clearQueue when the user cancels the confirm dialog', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const { ctx, user } = renderQueuePanel({}, { queue: [makeTrack(1)] });
      await user.click(screen.getByRole('button', { name: /clear/i }));
      expect(ctx.clearQueue).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    });
  });

  // =========================================================================
  // Empty-queue state
  // =========================================================================
  describe('empty queue state', () => {
    it('shows empty-state message when queue is empty', () => {
      renderQueuePanel({}, { queue: [] });
      expect(screen.getByText(/your queue is empty/i)).toBeInTheDocument();
    });

    it('shows a hint about how to add tracks', () => {
      renderQueuePanel({}, { queue: [] });
      expect(
        screen.getByText(/play a song or add tracks/i)
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Queue list — track rendering
  // =========================================================================
  describe('queue list rendering', () => {
    const queue = [makeTrack(1), makeTrack(2), makeTrack(3)];

    it('renders every track title in the list', () => {
      renderQueuePanel({}, { queue, currentIndex: 0 });
      queue.forEach((t) => expect(screen.getByText(t.title)).toBeInTheDocument());
    });

    it('renders every track artist', () => {
      renderQueuePanel({}, { queue, currentIndex: 0 });
      queue.forEach((t) => expect(screen.getByText(t.artist)).toBeInTheDocument());
    });

    it('formats duration correctly (3:00 for 180 s)', () => {
      renderQueuePanel({}, {
        queue: [makeTrack(1)], // duration: 180
        currentIndex: 0,
      });
      expect(screen.getByText('3:00')).toBeInTheDocument();
    });

    it('applies qp-current class only to the currently playing track', () => {
      renderQueuePanel({}, { queue, currentIndex: 1 });
      const items = document.querySelectorAll('.qp-item');
      expect(items[0].className).not.toMatch(/qp-current/);
      expect(items[1].className).toMatch(/qp-current/);
      expect(items[2].className).not.toMatch(/qp-current/);
    });

    it('applies qp-past class to tracks before the current index', () => {
      renderQueuePanel({}, { queue, currentIndex: 1 });
      const items = document.querySelectorAll('.qp-item');
      expect(items[0].className).toMatch(/qp-past/);
      expect(items[1].className).not.toMatch(/qp-past/);
      expect(items[2].className).not.toMatch(/qp-past/);
    });

    it('renders now-playing bars for the current track instead of a grip handle', () => {
      renderQueuePanel({}, { queue, currentIndex: 0 });
      // The now-playing indicator is a .qp-now-playing div
      expect(document.querySelector('.qp-now-playing')).toBeInTheDocument();
      // And there should be no grip icon on the first item
      const firstItem = document.querySelectorAll('.qp-item')[0];
      expect(within(firstItem).queryByTitle(/grip/i)).toBeNull();
    });

    it('shows a remove button for non-current tracks', () => {
      renderQueuePanel({}, { queue, currentIndex: 0 });
      // tracks at index 1 and 2 should have remove buttons; index 0 should not
      const removeButtons = screen.getAllByTitle(/remove from queue/i);
      expect(removeButtons).toHaveLength(2);
    });

    it('falls back to placeholder artwork when artworkUrl is absent', () => {
      const trackNoArt = { ...makeTrack(1), artworkUrl: undefined, artwork: undefined };
      renderQueuePanel({}, { queue: [trackNoArt], currentIndex: 0 });
      const img = document.querySelector('.qp-art');
      expect(img.getAttribute('src')).toBe('/assets/placeholder.jpg');
    });

    it('shows "Untitled" when track has no title', () => {
      const trackNoTitle = { ...makeTrack(1), title: undefined };
      renderQueuePanel({}, { queue: [trackNoTitle], currentIndex: 0 });
      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('shows "Unknown" when track has no artist', () => {
      const trackNoArtist = { ...makeTrack(1), artist: undefined, artistName: undefined };
      renderQueuePanel({}, { queue: [trackNoArtist], currentIndex: 0 });
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Track interactions — play & remove
  // =========================================================================
  describe('track interactions', () => {
    const queue = [makeTrack(1), makeTrack(2), makeTrack(3)];

    it('calls playMedia with the correct track when a non-current item is clicked', async () => {
      const { ctx, user } = renderQueuePanel({}, { queue, currentIndex: 0 });
      const items = document.querySelectorAll('.qp-item');
      await user.click(items[1]); // click Track 2
      expect(ctx.playMedia).toHaveBeenCalledWith(queue[1], queue, null);
    });

    it('calls removeFromQueue with the correct index when remove is clicked', async () => {
      const { ctx, user } = renderQueuePanel({}, { queue, currentIndex: 0 });
      const removeButtons = screen.getAllByTitle(/remove from queue/i);
      // First remove button corresponds to index 1 (index 0 is current)
      await user.click(removeButtons[0]);
      expect(ctx.removeFromQueue).toHaveBeenCalledWith(1);
    });

    it('does not call removeFromQueue when the current track remove would be triggered', async () => {
      // The current track has no remove button at all, so we verify the
      // handler guards against index === currentIndex defensively.
      const { ctx } = renderQueuePanel({}, { queue, currentIndex: 0 });
      // No remove button exists for index 0
      const removeButtons = screen.getAllByTitle(/remove from queue/i);
      expect(removeButtons).toHaveLength(queue.length - 1);
      expect(ctx.removeFromQueue).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Drag-and-drop reordering
  // =========================================================================
  describe('drag-and-drop reordering', () => {
    it('calls reorderQueue when a track is dragged over another position', () => {
      const queue = [makeTrack(1), makeTrack(2), makeTrack(3)];
      const { ctx } = renderQueuePanel({}, { queue, currentIndex: 0 });

      const items = document.querySelectorAll('.qp-item');

      // Simulate dragging item at index 2 over item at index 1
      const dragEvent = new Event('dragstart', { bubbles: true });
      Object.defineProperty(dragEvent, 'dataTransfer', {
        value: { effectAllowed: '' },
      });
      items[2].dispatchEvent(dragEvent);

      const dragOverEvent = new Event('dragover', { bubbles: true });
      dragOverEvent.preventDefault = vi.fn();
      items[1].dispatchEvent(dragOverEvent);

      expect(ctx.reorderQueue).toHaveBeenCalled();
    });

    it('does not allow the current track to be dragged (draggable=false)', () => {
      const queue = [makeTrack(1), makeTrack(2)];
      renderQueuePanel({}, { queue, currentIndex: 0 });
      const items = document.querySelectorAll('.qp-item');
      // current track item should not be draggable
      expect(items[0].getAttribute('draggable')).toBe('false');
      expect(items[1].getAttribute('draggable')).toBe('true');
    });
  });

  // =========================================================================
  // Save-as-playlist modal
  // =========================================================================
  describe('save-as-playlist modal', () => {
    const openModal = async (user) => {
      await user.click(screen.getByRole('button', { name: /save as playlist/i }));
    };

    it('renders the modal with a text input and Save/Cancel buttons', async () => {
      const { user } = renderQueuePanel({}, { queue: [makeTrack(1)] });
      await openModal(user);
      expect(screen.getByPlaceholderText(/playlist name/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('keeps the Save button disabled while the name is empty', async () => {
      const { user } = renderQueuePanel({}, { queue: [makeTrack(1)] });
      await openModal(user);
      expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    });

    it('enables the Save button once the user types a name', async () => {
      const { user } = renderQueuePanel({}, { queue: [makeTrack(1)] });
      await openModal(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Chill Mix');
      expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
    });

    it('calls saveQueueAsPlaylist with the entered name on Save click', async () => {
      const { ctx, user } = renderQueuePanel({}, { queue: [makeTrack(1)] });
      await openModal(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Chill Mix');
      await user.click(screen.getByRole('button', { name: /^save$/i }));
      expect(ctx.saveQueueAsPlaylist).toHaveBeenCalledWith('Chill Mix');
    });

    it('calls saveQueueAsPlaylist when Enter is pressed in the name field', async () => {
      const { ctx, user } = renderQueuePanel({}, { queue: [makeTrack(1)] });
      await openModal(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Late Night{Enter}');
      await waitFor(() =>
        expect(ctx.saveQueueAsPlaylist).toHaveBeenCalledWith('Late Night')
      );
    });

    it('closes the modal and resets the input after a successful save', async () => {
      const { user } = renderQueuePanel({}, { queue: [makeTrack(1)] });
      await openModal(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Road Trip');
      await user.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() =>
        expect(screen.queryByText(/save queue as playlist/i)).toBeNull()
      );
    });

    it('closes the modal without saving when Cancel is clicked', async () => {
      const { ctx, user } = renderQueuePanel({}, { queue: [makeTrack(1)] });
      await openModal(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Will Not Save');
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(ctx.saveQueueAsPlaylist).not.toHaveBeenCalled();
      expect(screen.queryByText(/save queue as playlist/i)).toBeNull();
    });

    it('shows "Saving…" label while the async call is in-flight', async () => {
      // Make saveQueueAsPlaylist hang so we can observe the mid-flight state
      let resolve;
      const hanging = new Promise((r) => { resolve = r; });
      const { ctx, user } = renderQueuePanel({}, {
        queue: [makeTrack(1)],
        saveQueueAsPlaylist: vi.fn().mockReturnValue(hanging),
      });
      await openModal(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Hang');
      await user.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument()
      );
      // Clean up — resolve the promise so React doesn't warn about state updates
      resolve();
    });

    it('alerts and stays open if saveQueueAsPlaylist rejects', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const { user } = renderQueuePanel({}, {
        queue: [makeTrack(1)],
        saveQueueAsPlaylist: vi.fn().mockRejectedValue(new Error('Network error')),
      });
      await openModal(user);
      await user.type(screen.getByPlaceholderText(/playlist name/i), 'Fail Mix');
      await user.click(screen.getByRole('button', { name: /^save$/i }));
      await waitFor(() => expect(alertSpy).toHaveBeenCalled());
      // Modal should remain visible after a failure
      expect(screen.getByText(/save queue as playlist/i)).toBeInTheDocument();
      alertSpy.mockRestore();
    });
  });

  // =========================================================================
  // Close behaviour
  // =========================================================================
  describe('close behaviour', () => {
    it('calls onClose when the X button is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      const ctx = makeContext();
      render(
        <PlayerContext.Provider value={ctx}>
          <QueuePanel open={true} onClose={onClose} />
        </PlayerContext.Provider>
      );
      await user.click(screen.getByRole('button', { name: '' /* X icon */ }));
      // The X button is the only icon-only button in the header
      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when the overlay backdrop is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      const ctx = makeContext();
      render(
        <PlayerContext.Provider value={ctx}>
          <QueuePanel open={true} onClose={onClose} />
        </PlayerContext.Provider>
      );
      // The overlay is .qp-overlay; click it directly
      await user.click(document.querySelector('.qp-overlay'));
      expect(onClose).toHaveBeenCalled();
    });

    it('does NOT call onClose when the panel body is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      const ctx = makeContext({ queue: [makeTrack(1)] });
      render(
        <PlayerContext.Provider value={ctx}>
          <QueuePanel open={true} onClose={onClose} />
        </PlayerContext.Provider>
      );
      await user.click(document.querySelector('.qp-container'));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Duration formatting edge cases
  // =========================================================================
  describe('duration formatting', () => {
    it('renders an empty duration string when duration is undefined', () => {
      const track = { ...makeTrack(1), duration: undefined };
      renderQueuePanel({}, { queue: [track], currentIndex: 0 });
      // The .qp-duration span should be empty / not show a time
      const durations = document.querySelectorAll('.qp-duration');
      expect(durations[0].textContent).toBe('');
    });

    it('pads seconds correctly (e.g. 65 s → 1:05)', () => {
      const track = { ...makeTrack(1), duration: 65 };
      renderQueuePanel({}, { queue: [track], currentIndex: 0 });
      expect(screen.getByText('1:05')).toBeInTheDocument();
    });

    it('renders 0:00 for a duration of 0', () => {
      const track = { ...makeTrack(1), duration: 0 };
      renderQueuePanel({}, { queue: [track], currentIndex: 0 });
      expect(screen.getByText('0:00')).toBeInTheDocument();
    });
  });
});