// src/changeDefaultSongWizard.test.jsx
//
// Tests for ChangeDefaultSongWizard — the artist picks the featured song that
// plays first across Unis.
//
// Covers:
//   • show=false renders nothing; opening later works
//   • dialog semantics, overlay / × / Cancel close, inside clicks don't
//   • empty state ("No songs yet" → "Got it")
//   • song rows: title, plays, duration, artwork or placeholder
//   • the current featured song starts selected
//   • Save is disabled until a different song is picked
//   • PATCH /v1/users/default-song with the picked id (songId or id)
//   • success: toast names the song, onSuccess then onClose
//   • failure: error toast, wizard stays open, button comes back
//   • busy label while saving

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as axiosModule from './components/axiosInstance';

vi.mock('./changeDefaultSongWizard.scss', () => ({}));

const { feedback } = vi.hoisted(() => ({
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));

import ChangeDefaultSongWizard from './changeDefaultSongWizard';

// ---------------------------------------------------------------------------
const SONGS = [
  { songId: 'song-1', title: 'First Light', playCount: 1234, duration: 180000, artworkUrl: 'https://cdn.test/1.jpg' },
  { songId: 'song-2', title: 'Second Wind', plays: 7, duration: 90000 },
  { id: 'song-3', title: 'Third Rail' },
];

let apiSpy;

function renderWizard(props = {}) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <ChangeDefaultSongWizard
      show
      onClose={onClose}
      onSuccess={onSuccess}
      songs={SONGS}
      currentDefaultSongId="song-1"
      {...props}
    />
  );
  return { onClose, onSuccess, user, ...utils };
}

const row = (title) => screen.getByRole('button', { name: new RegExp(title, 'i') });
const saveButton = () => screen.getByRole('button', { name: /save featured|saving/i });

beforeEach(() => {
  vi.clearAllMocks();
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
describe('ChangeDefaultSongWizard — visibility and closing', () => {
  it('renders nothing when show=false', () => {
    const { container } = renderWizard({ show: false });
    expect(container.firstChild).toBeNull();
  });

  it('opens when show turns true after first rendering closed', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = renderWizard({ show: false });
    rerender(
      <ChangeDefaultSongWizard show onClose={vi.fn()} songs={SONGS} currentDefaultSongId="song-1" />
    );
    expect(screen.getByRole('dialog', { name: /set featured song/i })).toBeInTheDocument();
  });

  it('is a labelled modal dialog', () => {
    renderWizard();
    const dialog = screen.getByRole('dialog', { name: /set featured song/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: /set your featured song/i })).toBeInTheDocument();
  });

  it('closes when the overlay is clicked', async () => {
    const { user, onClose } = renderWizard();
    await user.click(document.querySelector('.cdsw-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when the modal itself is clicked', async () => {
    const { user, onClose } = renderWizard();
    await user.click(document.querySelector('.cdsw-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the × button', async () => {
    const { user, onClose } = renderWizard();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel closes without saving', async () => {
    const { user, onClose, onSuccess } = renderWizard();
    await user.click(row('Second Wind'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(apiSpy).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('ChangeDefaultSongWizard — no songs', () => {
  it.each([[[]], [null]])('shows the empty state for songs=%j', (songs) => {
    renderWizard({ songs });
    expect(screen.getByRole('heading', { name: /no songs yet/i })).toBeInTheDocument();
    expect(screen.getByText(/upload your first song/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save featured/i })).not.toBeInTheDocument();
  });

  it('"Got it" closes', async () => {
    const { user, onClose } = renderWizard({ songs: [] });
    await user.click(screen.getByRole('button', { name: /got it/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
describe('ChangeDefaultSongWizard — song list', () => {
  it('lists every song', () => {
    renderWizard();
    expect(document.querySelectorAll('.cdsw-song')).toHaveLength(3);
  });

  it('shows plays (with separators) and duration in minutes', () => {
    renderWizard();
    expect(within(row('First Light')).getByText('1,234 plays · 3.0 min')).toBeInTheDocument();
  });

  it('reads plays from either playCount or plays', () => {
    renderWizard();
    expect(within(row('Second Wind')).getByText('7 plays · 1.5 min')).toBeInTheDocument();
  });

  it('shows 0 plays and no duration when neither is known', () => {
    renderWizard();
    expect(within(row('Third Rail')).getByText(/^0 plays$/)).toBeInTheDocument();
  });

  it('shows the artwork when there is one, a placeholder when not', () => {
    renderWizard();
    expect(row('First Light').querySelector('img.cdsw-song__art')).toHaveAttribute('src', 'https://cdn.test/1.jpg');
    expect(row('Second Wind').querySelector('img')).toBeNull();
    expect(row('Second Wind').querySelector('.cdsw-song__art--placeholder')).not.toBeNull();
  });

  it('starts with the current featured song selected', () => {
    renderWizard();
    expect(row('First Light')).toHaveAttribute('aria-pressed', 'true');
    expect(row('First Light')).toHaveClass('cdsw-song--selected');
    expect(row('Second Wind')).toHaveAttribute('aria-pressed', 'false');
  });

  it('starts with nothing selected when there is no featured song yet', () => {
    renderWizard({ currentDefaultSongId: undefined });
    expect(document.querySelector('.cdsw-song--selected')).toBeNull();
  });

  it('picking a song moves the selection', async () => {
    const { user } = renderWizard();
    await user.click(row('Second Wind'));
    expect(row('Second Wind')).toHaveAttribute('aria-pressed', 'true');
    expect(row('First Light')).toHaveAttribute('aria-pressed', 'false');
    expect(document.querySelectorAll('.cdsw-song__check.is-on')).toHaveLength(1);
  });
});

// ===========================================================================
describe('ChangeDefaultSongWizard — Save button state', () => {
  it('is disabled while the current featured song is still selected', () => {
    renderWizard();
    expect(saveButton()).toBeDisabled();
  });

  it('is disabled when nothing is selected', () => {
    renderWizard({ currentDefaultSongId: undefined });
    expect(saveButton()).toBeDisabled();
  });

  it('enables once a different song is picked', async () => {
    const { user } = renderWizard();
    await user.click(row('Second Wind'));
    expect(saveButton()).toBeEnabled();
  });

  it('disables again when the user goes back to the current one', async () => {
    const { user } = renderWizard();
    await user.click(row('Second Wind'));
    await user.click(row('First Light'));
    expect(saveButton()).toBeDisabled();
  });
});

// ===========================================================================
describe('ChangeDefaultSongWizard — saving', () => {
  it('PATCHes the picked song id', async () => {
    const { user } = renderWizard();
    await user.click(row('Second Wind'));
    await user.click(saveButton());

    await waitFor(() => expect(apiSpy).toHaveBeenCalledTimes(1));
    expect(apiSpy).toHaveBeenCalledWith({
      method: 'patch',
      url: '/v1/users/default-song',
      data: { defaultSongId: 'song-2' },
    });
  });

  it('works for a song that only has `id`', async () => {
    const { user } = renderWizard();
    await user.click(row('Third Rail'));
    await user.click(saveButton());
    await waitFor(() =>
      expect(apiSpy).toHaveBeenCalledWith(expect.objectContaining({ data: { defaultSongId: 'song-3' } })));
  });

  it('on success names the song in a toast, then calls onSuccess and onClose', async () => {
    const { user, onClose, onSuccess } = renderWizard();
    await user.click(row('Second Wind'));
    await user.click(saveButton());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(feedback.success).toHaveBeenCalledWith('“Second Wind” is now your featured song');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  it('uses a generic toast when the song has no title', async () => {
    const { user } = renderWizard({ songs: [SONGS[0], { songId: 'song-x' }] });
    await user.click(document.querySelectorAll('.cdsw-song')[1]);
    await user.click(saveButton());
    await waitFor(() => expect(feedback.success).toHaveBeenCalledWith('Featured song updated'));
  });

  it('saves fine without an onSuccess callback', async () => {
    const { user, onClose } = renderWizard({ onSuccess: undefined });
    await user.click(row('Second Wind'));
    await user.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows "Saving…" and blocks a second click while the request is in flight', async () => {
    let finish;
    apiSpy.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user, onClose } = renderWizard();
    await user.click(row('Second Wind'));
    await user.click(saveButton());

    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    await user.click(saveButton());
    expect(apiSpy).toHaveBeenCalledTimes(1);

    finish({ data: {} });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

// ===========================================================================
describe('ChangeDefaultSongWizard — save failures', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('tells the user, stays open, and calls neither callback', async () => {
    apiSpy.mockRejectedValue(new Error('boom'));
    const { user, onClose, onSuccess } = renderWizard();
    await user.click(row('Second Wind'));
    await user.click(saveButton());

    await waitFor(() =>
      expect(feedback.error).toHaveBeenCalledWith("Couldn't update your featured song. Try again."));
    expect(feedback.success).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith('Failed to update featured song:', expect.any(Error));
  });

  it('passes on a short server message', async () => {
    apiSpy.mockRejectedValue({ response: { status: 400, data: { message: 'That song was removed' } } });
    const { user } = renderWizard();
    await user.click(row('Second Wind'));
    await user.click(saveButton());
    await waitFor(() => expect(feedback.error).toHaveBeenCalledWith('That song was removed'));
  });

  it('keeps the selection and re-enables Save so the user can retry', async () => {
    apiSpy.mockRejectedValueOnce(new Error('boom'));
    const { user, onClose } = renderWizard();
    await user.click(row('Second Wind'));
    await user.click(saveButton());
    await waitFor(() => expect(feedback.error).toHaveBeenCalled());

    expect(row('Second Wind')).toHaveAttribute('aria-pressed', 'true');
    expect(saveButton()).toBeEnabled();

    await user.click(saveButton());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(apiSpy).toHaveBeenCalledTimes(2);
  });
});
