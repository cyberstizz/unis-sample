// src/lyricsWizard.test.jsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

vi.mock('./lyricsWizard.scss', () => ({}));

vi.mock('./components/axiosInstance', () => ({
  apiCall: vi.fn(),
}));

import { apiCall } from './components/axiosInstance';

// Adjust casing/path only if your actual filename differs.
import LyricsWizard from './lyricsWizard';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const songWithLyrics = {
  songId: 'song-123',
  title: 'Test Song',
  lyrics: 'Old lyrics',
};

const songWithoutLyrics = {
  songId: 'song-456',
  title: 'Instrumental Maybe',
  lyrics: '',
};

function renderLyricsWizard(overrides = {}) {
  const props = {
    show: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    song: songWithLyrics,
    ...overrides,
  };

  const result = render(<LyricsWizard {...props} />);

  return {
    ...result,
    props,
  };
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// VISIBILITY / BASIC RENDER
// ===========================================================================

describe('LyricsWizard — visibility and render', () => {
  it('renders nothing when show is false', () => {
    const { container } = renderLyricsWizard({ show: false });

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when song is missing', () => {
    const { container } = renderLyricsWizard({ song: null });

    expect(container.firstChild).toBeNull();
  });

  it('renders Edit Lyrics when the song already has lyrics', () => {
    renderLyricsWizard({
      song: songWithLyrics,
    });

    expect(screen.getByText(/edit lyrics/i)).toBeInTheDocument(); // ★ item 1: mode moved to the eyebrow
    expect(screen.getByRole('heading', { name: /test song/i })).toBeInTheDocument(); // ★

    expect(screen.getByDisplayValue('Old lyrics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save lyrics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders Add Lyrics when the song has no lyrics', () => {
    renderLyricsWizard({
      song: songWithoutLyrics,
    });

    expect(screen.getByText(/add lyrics/i)).toBeInTheDocument(); // ★ item 1: mode moved to the eyebrow
    expect(screen.getByRole('heading', { name: /instrumental maybe/i })).toBeInTheDocument(); // ★

    expect(screen.getByPlaceholderText(/enter lyrics here/i)).toHaveValue('');
  });
});

// ===========================================================================
// SAVE SUCCESS
// ===========================================================================

describe('LyricsWizard — save success', () => {
  it('saves trimmed lyrics using multipart FormData and the existing song patch endpoint', async () => {
    const user = userEvent.setup();

    apiCall.mockResolvedValueOnce({ data: {} });

    const { props } = renderLyricsWizard({
      song: songWithLyrics,
    });

    const textarea = screen.getByDisplayValue('Old lyrics');

    await user.clear(textarea);
    await user.type(textarea, '   New lyrics line one\nNew lyrics line two   ');

    await user.click(screen.getByRole('button', { name: /save lyrics/i }));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    const config = apiCall.mock.calls[0][0];

    expect(config.method).toBe('patch');
    expect(config.url).toBe('/v1/media/song/song-123');
    expect(config.data).toBeInstanceOf(FormData);
    expect(config.data.get('lyrics')).toBe('New lyrics line one\nNew lyrics line two');

    expect(props.onSuccess).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('falls back to song.id when song.songId is missing', async () => {
    const user = userEvent.setup();

    apiCall.mockResolvedValueOnce({ data: {} });

    renderLyricsWizard({
      song: {
        id: 'fallback-song-id',
        title: 'Fallback Song',
        lyrics: 'Some lyrics',
      },
    });

    await user.click(screen.getByRole('button', { name: /save lyrics/i }));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'patch',
          url: '/v1/media/song/fallback-song-id',
        })
      );
    });
  });

  it('sends an empty string when lyrics are cleared', async () => {
    const user = userEvent.setup();

    apiCall.mockResolvedValueOnce({ data: {} });

    renderLyricsWizard({
      song: songWithLyrics,
    });

    const textarea = screen.getByDisplayValue('Old lyrics');

    await user.clear(textarea);
    await user.click(screen.getByRole('button', { name: /save lyrics/i }));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    const formData = apiCall.mock.calls[0][0].data;

    expect(formData.get('lyrics')).toBe('');
  });

  it('does not fail if onSuccess is not provided', async () => {
    const user = userEvent.setup();

    apiCall.mockResolvedValueOnce({ data: {} });

    const onClose = vi.fn();

    renderLyricsWizard({
      onSuccess: undefined,
      onClose,
    });

    await user.click(screen.getByRole('button', { name: /save lyrics/i }));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// SAVE FAILURE
// ===========================================================================

describe('LyricsWizard — save failure', () => {
  it('shows an inline error and does not close when saving fails', async () => { // ★ item 1: alert() → inline error
    const user = userEvent.setup();

    apiCall.mockRejectedValueOnce(new Error('Network error'));

    const { props } = renderLyricsWizard();

    await user.click(screen.getByRole('button', { name: /save lyrics/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not save the lyrics/i); // ★

    expect(props.onSuccess).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('prevents double-click duplicate saves while saving is in progress', async () => {
    const user = userEvent.setup();

    let resolveRequest;

    apiCall.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    renderLyricsWizard();

    const saveButton = screen.getByRole('button', { name: /save lyrics/i });

    await user.click(saveButton);
    await user.click(saveButton);

    expect(apiCall).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

    resolveRequest({ data: {} });

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledTimes(1);
    });
  });
});

// ===========================================================================
// CLOSE BEHAVIOR
// ===========================================================================

describe('LyricsWizard — close behavior', () => {
  it('Cancel closes the wizard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderLyricsWizard({ onClose });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the X button closes the wizard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = renderLyricsWizard({ onClose });

    const closeButton = container.querySelector('.lw__close');

    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop closes the wizard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = renderLyricsWizard({ onClose });

    const backdrop = container.querySelector('.lw-overlay');

    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the modal does not close the wizard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = renderLyricsWizard({ onClose });

    const modal = container.querySelector('.lw');

    await user.click(modal);

    expect(onClose).not.toHaveBeenCalled();
  });
});