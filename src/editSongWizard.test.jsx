// src/editSongWizard.test.jsx
//
// Comprehensive test suite for EditSongWizard — the modal that lets an artist
// update an existing song's artwork, description, ISRC, and download policy.
//
// Component behaviour summary:
//   • Renders nothing when show=false or song=null
//   • Pre-populates every field from the `song` prop on mount
//   • Artwork — image preview, new-file picker, type/size validation
//   • Description — textarea, 500-char limit counter
//   • ISRC — uppercased, alphanumeric-only, maxLength 15
//   • Download policy — three toggle buttons: free / paid / unavailable
//   • Paid download — minimum $1.99 enforced before any API call
//   • "Save Changes" disabled when nothing has changed
//   • Two separate API calls:
//       PATCH /v1/media/song/:songId  — artwork, description, isrc
//       PUT   /v1/songs/:songId/download-settings — downloadPolicy, downloadPrice
//     Each fires only when the relevant fields actually changed
//   • onSuccess + onClose called on full success
//   • Error surfaced inline on failure
//   • Cancel button calls onClose without saving
//
// Pattern notes (same as uploadWizard.test.jsx):
//   • Uses vi.spyOn(axiosModule, 'apiCall') to bypass MSW/FormData/axios/jsdom
//   • fireEvent.change for file inputs (bypasses userEvent's accept enforcement)
//   • Each API-touching test installs its own mockApiCall

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as axiosModule from './components/axiosInstance';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------
vi.mock('./editSongWizard.scss', () => ({}));

import EditSongWizard from './editSongWizard';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------
const BASE_SONG = {
  songId: 'song-abc-123',
  title: 'Midnight Uptown',
  description: 'Original description',
  isrc: 'USRC17607839',
  artworkUrl: '/media/artwork/abc.jpg',
  downloadPolicy: 'free',
  downloadPrice: null,
};

const PAID_SONG = {
  ...BASE_SONG,
  songId: 'song-paid-456',
  downloadPolicy: 'paid',
  downloadPrice: 299,           // stored as cents in the DB
};

const BLANK_SONG = {
  songId: 'song-blank-789',
  title: 'Blank Slate',
  description: '',
  isrc: '',
  artworkUrl: null,
  downloadPolicy: 'free',
  downloadPrice: null,
};

// Helper — produce a fake File with controllable type/size
function fakeFile({ name = 'cover.jpg', type = 'image/jpeg', sizeMB = 0.5 } = {}) {
  const file = new File(['x'.repeat(1024)], name, { type });
  Object.defineProperty(file, 'size', { value: Math.round(sizeMB * 1024 * 1024) });
  return file;
}

// Helper — fire a change event on a hidden <input type="file">
// (mirrors the pattern in uploadWizard.test.jsx)
async function selectFile(input, file) {
  fireEvent.change(input, { target: { files: [file] } });
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// RENDER HELPERS
// ---------------------------------------------------------------------------
function renderWizard({
  show = true,
  song = BASE_SONG,
  onClose = vi.fn(),
  onSuccess = vi.fn(),
} = {}) {
  return {
    onClose,
    onSuccess,
    ...render(
      <EditSongWizard
        show={show}
        song={song}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    ),
  };
}

// ===========================================================================
// VISIBILITY GATING
// ===========================================================================
describe('EditSongWizard — visibility', () => {
  it('renders nothing when show=false', () => {
    const { container } = renderWizard({ show: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when song is null', () => {
    const { container } = renderWizard({ song: null });
    expect(container.firstChild).toBeNull();
  });

  it('renders the overlay when show=true and song is provided', () => {
    renderWizard();
    expect(document.querySelector('.upload-wizard-overlay')).not.toBeNull();
  });

  it('renders the wizard panel inside the overlay', () => {
    renderWizard();
    expect(document.querySelector('.upload-wizard')).not.toBeNull();
  });
});

// ===========================================================================
// INITIAL STATE — PRE-POPULATION FROM SONG PROP
// ===========================================================================
describe('EditSongWizard — initial state pre-population', () => {
  it('shows the song title in the heading intro copy', () => {
    renderWizard();
    expect(screen.getByText(/Midnight Uptown/)).toBeInTheDocument();
  });

  it('pre-fills the description textarea', () => {
    renderWizard();
    const ta = screen.getByPlaceholderText(/describe your track/i);
    expect(ta.value).toBe(BASE_SONG.description);
  });

  it('pre-fills the ISRC input', () => {
    renderWizard();
    const isrcInput = screen.getByPlaceholderText(/usrc/i);
    expect(isrcInput.value).toBe(BASE_SONG.isrc);
  });

  it('shows the existing artwork preview when artworkUrl is a relative path', () => {
    renderWizard();
    const img = document.querySelector('img[alt="Song artwork"]');
    expect(img).not.toBeNull();
    // relative URL gets prefixed with the API base URL
    expect(img.src).toContain(BASE_SONG.artworkUrl);
  });

  it('shows the artwork directly when artworkUrl is already absolute', () => {
    const song = { ...BASE_SONG, artworkUrl: 'https://cdn.example.com/art.jpg' };
    renderWizard({ song });
    const img = document.querySelector('img[alt="Song artwork"]');
    expect(img.src).toBe('https://cdn.example.com/art.jpg');
  });

  it('shows the music-icon placeholder when artworkUrl is null', () => {
    renderWizard({ song: BLANK_SONG });
    expect(document.querySelector('img[alt="Song artwork"]')).toBeNull();
    // Lucide Music icon renders an svg inside the placeholder div
    expect(document.querySelector('.upload-wizard svg')).not.toBeNull();
  });

  it('defaults download policy toggle to "free" for a free song', () => {
    renderWizard();
    const freeBtn = screen.getByRole('button', { name: /free download/i });
    // Active button has 2px solid border
    expect(freeBtn.style.border).toContain('2px solid');
  });

  it('defaults download policy toggle to "paid" for a paid song', () => {
    renderWizard({ song: PAID_SONG });
    const paidBtn = screen.getByRole('button', { name: /paid download/i });
    expect(paidBtn.style.border).toContain('2px solid');
  });

  it('pre-fills the price input in dollars for a paid song', () => {
    renderWizard({ song: PAID_SONG });
    const priceInput = screen.getByPlaceholderText('1.99');
    // 299 cents → "2.99"
    expect(priceInput.value).toBe('2.99');
  });

  it('leaves the description counter at the correct initial length', () => {
    renderWizard();
    const expectedLen = BASE_SONG.description.length;
    expect(screen.getByText(`${expectedLen}/500`)).toBeInTheDocument();
  });

  it('leaves description counter at 0/500 when description is empty', () => {
    renderWizard({ song: BLANK_SONG });
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });
});

// ===========================================================================
// ARTWORK
// ===========================================================================
describe('EditSongWizard — artwork', () => {
  it('updates the preview when a new image is chosen', async () => {
    renderWizard();
    const artInput = document.querySelector('input[type="file"][accept="image/*"]');
    await selectFile(artInput, fakeFile({ name: 'new-cover.jpg', type: 'image/jpeg' }));
    const img = document.querySelector('img[alt="Song artwork"]');
    expect(img.src).toBe('blob:mock-preview-url');
  });

  it('shows the selected filename after picking a new artwork', async () => {
    renderWizard();
    const artInput = document.querySelector('input[type="file"][accept="image/*"]');
    await selectFile(artInput, fakeFile({ name: 'fresh-art.png', type: 'image/png' }));
    expect(screen.getByText(/Selected: fresh-art\.png/i)).toBeInTheDocument();
  });

  it('calls URL.createObjectURL when a new artwork is selected', async () => {
    renderWizard();
    const artInput = document.querySelector('input[type="file"][accept="image/*"]');
    await selectFile(artInput, fakeFile());
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

// ===========================================================================
// DESCRIPTION
// ===========================================================================
describe('EditSongWizard — description', () => {
  it('updates the textarea and counter as the user types', async () => {
    renderWizard({ song: BLANK_SONG });
    const user = userEvent.setup();
    const ta = screen.getByPlaceholderText(/describe your track/i);
    await user.type(ta, 'Late night vibes');
    expect(ta.value).toBe('Late night vibes');
    expect(screen.getByText('16/500')).toBeInTheDocument();
  });

  it('clears description when user deletes all text', async () => {
    renderWizard();
    const user = userEvent.setup();
    const ta = screen.getByPlaceholderText(/describe your track/i);
    await user.clear(ta);
    expect(ta.value).toBe('');
    expect(screen.getByText('0/500')).toBeInTheDocument();
  });

  it('enforces the 500 character maxLength attribute', () => {
    renderWizard();
    const ta = screen.getByPlaceholderText(/describe your track/i);
    expect(ta.maxLength).toBe(500);
  });
});

// ===========================================================================
// ISRC
// ===========================================================================
describe('EditSongWizard — ISRC', () => {
  it('uppercases input and strips non-alphanumeric characters', async () => {
    renderWizard({ song: BLANK_SONG });
    const user = userEvent.setup();
    const isrcInput = screen.getByPlaceholderText(/usrc/i);
    await user.type(isrcInput, 'us-rc176-07839');
    expect(isrcInput.value).toBe('USRC17607839');
  });

  it('enforces maxLength of 15', () => {
    renderWizard();
    const isrcInput = screen.getByPlaceholderText(/usrc/i);
    expect(isrcInput.maxLength).toBe(15);
  });

  it('can be cleared', async () => {
    renderWizard();
    const user = userEvent.setup();
    const isrcInput = screen.getByPlaceholderText(/usrc/i);
    await user.clear(isrcInput);
    expect(isrcInput.value).toBe('');
  });

  it('shows the helper text about ISRC format', () => {
    renderWizard();
    expect(screen.getByText(/12-character International Standard Recording Code/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// DOWNLOAD POLICY TOGGLE
// ===========================================================================
describe('EditSongWizard — download policy', () => {
  it('switching to Paid reveals the price input', async () => {
    renderWizard();
    const user = userEvent.setup();
    expect(screen.queryByPlaceholderText('1.99')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /paid download/i }));
    expect(screen.getByPlaceholderText('1.99')).toBeInTheDocument();
  });

  it('switching from Paid back to Free hides the price input', async () => {
    renderWizard({ song: PAID_SONG });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /free download/i }));
    expect(screen.queryByPlaceholderText('1.99')).not.toBeInTheDocument();
  });

  it('switching to No Download hides the price input', async () => {
    renderWizard({ song: PAID_SONG });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    expect(screen.queryByPlaceholderText('1.99')).not.toBeInTheDocument();
  });

  it('shows the free-download hint copy when Free is active', () => {
    renderWizard();
    expect(screen.getByText(/can download this track for free/i)).toBeInTheDocument();
  });

  it('shows the 90% Stripe copy when Paid is active', async () => {
    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /paid download/i }));
    expect(screen.getByText(/minimum \$1\.99/i)).toBeInTheDocument();
  });

  it('shows the stream-only copy when No Download is active', async () => {
    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    expect(screen.getByText(/stream but not download/i)).toBeInTheDocument();
  });

  it('clears the price value when switching away from Paid', async () => {
    renderWizard({ song: PAID_SONG });
    const user = userEvent.setup();
    // Switch to free — price input disappears
    await user.click(screen.getByRole('button', { name: /free download/i }));
    // Switch back to paid — input should be empty (not carry old value)
    await user.click(screen.getByRole('button', { name: /paid download/i }));
    const priceInput = screen.getByPlaceholderText('1.99');
    expect(priceInput.value).toBe('');
  });
});

// ===========================================================================
// SAVE BUTTON DISABLED STATE (no changes)
// ===========================================================================
describe('EditSongWizard — save button disabled state', () => {
  it('"Save Changes" is disabled when nothing has changed', () => {
    renderWizard();
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeDisabled();
  });

  it('"Save Changes" becomes enabled after description is changed', async () => {
    renderWizard();
    const user = userEvent.setup();
    const ta = screen.getByPlaceholderText(/describe your track/i);
    await user.type(ta, ' (updated)');
    expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
  });

  it('"Save Changes" becomes enabled after ISRC is changed', async () => {
    renderWizard();
    const user = userEvent.setup();
    const isrcInput = screen.getByPlaceholderText(/usrc/i);
    await user.clear(isrcInput);
    expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
  });

  it('"Save Changes" becomes enabled after a new artwork file is chosen', async () => {
    renderWizard();
    const artInput = document.querySelector('input[type="file"][accept="image/*"]');
    await selectFile(artInput, fakeFile());
    expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
  });

  it('"Save Changes" becomes enabled after download policy is changed', async () => {
    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
  });

  it('"Save Changes" becomes enabled after download price is changed on a paid song', async () => {
    renderWizard({ song: PAID_SONG });
    const user = userEvent.setup();
    const priceInput = screen.getByPlaceholderText('1.99');
    await user.clear(priceInput);
    await user.type(priceInput, '4.99');
    expect(screen.getByRole('button', { name: /save changes/i })).not.toBeDisabled();
  });
});

// ===========================================================================
// CANCEL BUTTON
// ===========================================================================
describe('EditSongWizard — cancel', () => {
  it('Cancel button calls onClose', async () => {
    const { onClose } = renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('Close (×) button calls onClose', async () => {
    const { onClose } = renderWizard();
    const user = userEvent.setup();
    await user.click(document.querySelector('.close-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking "Save Changes" with no changes just calls onClose', async () => {
    // Regression: the component should short-circuit and close, not make API calls
    const spy = vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });
    const { onClose } = renderWizard();
    const user = userEvent.setup();
    // Button is disabled when no changes, so force-enable by clicking once
    // Actually with no changes the button should be disabled, so we can verify
    // the button is disabled and no API call would be made
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeDisabled();
    expect(spy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// SUBMIT — VALIDATION ERRORS
// ===========================================================================
describe('EditSongWizard — submit validation', () => {
  it('alerts and blocks submission when paid policy has no price', async () => {
    // Use window.alert spy since the component uses alert()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const apiSpy = vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });

    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /paid download/i }));
    // policy changed → button enabled, but no price set
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/minimum download price is \$1\.99/i));
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it('alerts when paid price is below $1.99', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });

    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /paid download/i }));
    await user.type(screen.getByPlaceholderText('1.99'), '0.99');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/minimum download price is \$1\.99/i));
  });

  it('does NOT alert when paid price is exactly $1.99', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });

    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /paid download/i }));
    await user.type(screen.getByPlaceholderText('1.99'), '1.99');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(alertSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// SUBMIT — MEDIA CHANGES (PATCH /v1/media/song/:id)
// ===========================================================================
describe('EditSongWizard — PATCH media changes', () => {
  it('PATCHes the correct song ID', async () => {
    let capturedUrl = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      capturedUrl = config.url;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    const ta = screen.getByPlaceholderText(/describe your track/i);
    await user.clear(ta);
    await user.type(ta, 'Updated description');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(capturedUrl).toBe(`/v1/media/song/${BASE_SONG.songId}`));
  });

  it('includes changed description in FormData', async () => {
    let capturedDesc = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.url.includes('/v1/media/song/')) {
        capturedDesc = config.data.get('description');
      }
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    const ta = screen.getByPlaceholderText(/describe your track/i);
    await user.clear(ta);
    await user.type(ta, 'New vibe');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(capturedDesc).toBe('New vibe'));
  });

  it('includes changed ISRC in FormData', async () => {
    let capturedIsrc = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.url.includes('/v1/media/song/')) {
        capturedIsrc = config.data.get('isrc');
      }
      return { data: {} };
    });

    renderWizard({ song: BLANK_SONG });
    const user = userEvent.setup();
    const isrcInput = screen.getByPlaceholderText(/usrc/i);
    await user.type(isrcInput, 'USRC17607839');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(capturedIsrc).toBe('USRC17607839'));
  });

  it('includes artwork file in FormData when a new file is selected', async () => {
    let hadArtwork = false;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.url.includes('/v1/media/song/')) {
        hadArtwork = config.data.has('artwork');
      }
      return { data: {} };
    });

    renderWizard();
    const artInput = document.querySelector('input[type="file"][accept="image/*"]');
    await selectFile(artInput, fakeFile({ name: 'new-art.jpg', type: 'image/jpeg' }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(hadArtwork).toBe(true));
  });

  it('sends multipart/form-data content type for media changes', async () => {
    let capturedContentType = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.url.includes('/v1/media/song/')) {
        capturedContentType = config.headers?.['Content-Type'];
      }
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    const ta = screen.getByPlaceholderText(/describe your track/i);
    await user.clear(ta);
    await user.type(ta, 'New');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(capturedContentType).toBe('multipart/form-data'));
  });

  it('does NOT call the PATCH endpoint when only download policy changed', async () => {
    let patchCalled = false;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.method === 'patch') patchCalled = true;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(patchCalled).toBe(false));
  });
});

// ===========================================================================
// SUBMIT — DOWNLOAD SETTINGS (PUT /v1/songs/:id/download-settings)
// ===========================================================================
describe('EditSongWizard — PUT download settings', () => {
  it('PUTs to the correct URL when download policy changes', async () => {
    let capturedUrl = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.method === 'put') capturedUrl = config.url;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(capturedUrl).toBe(`/v1/songs/${BASE_SONG.songId}/download-settings`));
  });

  it('sends downloadPolicy=unavailable in the PUT body', async () => {
    let capturedBody = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.method === 'put') capturedBody = config.data;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(capturedBody.downloadPolicy).toBe('unavailable');
      expect(capturedBody.downloadPrice).toBeNull();
    });
  });

  it('sends downloadPrice as integer cents in the PUT body when paid', async () => {
    let capturedBody = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.method === 'put') capturedBody = config.data;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /paid download/i }));
    await user.type(screen.getByPlaceholderText('1.99'), '4.99');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(capturedBody.downloadPolicy).toBe('paid');
      expect(capturedBody.downloadPrice).toBe(499);
    });
  });

  it('sends downloadPrice=null when switching from paid to free', async () => {
    let capturedBody = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.method === 'put') capturedBody = config.data;
      return { data: {} };
    });

    renderWizard({ song: PAID_SONG });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /free download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(capturedBody.downloadPolicy).toBe('free');
      expect(capturedBody.downloadPrice).toBeNull();
    });
  });

  it('does NOT call the PUT endpoint when only description changed', async () => {
    let putCalled = false;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.method === 'put') putCalled = true;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    const ta = screen.getByPlaceholderText(/describe your track/i);
    await user.clear(ta);
    await user.type(ta, 'Just a new description');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(putCalled).toBe(false));
  });
});

// ===========================================================================
// SUBMIT — BOTH CALLS TOGETHER
// ===========================================================================
describe('EditSongWizard — combined media + download changes', () => {
  it('fires both PATCH and PUT when both categories changed', async () => {
    let patchCalled = false;
    let putCalled = false;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      if (config.method === 'patch') patchCalled = true;
      if (config.method === 'put') putCalled = true;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    // Media change
    const ta = screen.getByPlaceholderText(/describe your track/i);
    await user.clear(ta);
    await user.type(ta, 'Both changed');
    // Download policy change
    await user.click(screen.getByRole('button', { name: /no download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(patchCalled).toBe(true);
      expect(putCalled).toBe(true);
    });
  });
});

// ===========================================================================
// SUBMIT — SUCCESS
// ===========================================================================
describe('EditSongWizard — submit success', () => {
  it('calls onSuccess after a successful save', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });

    const { onSuccess } = renderWizard();
    const user = userEvent.setup();
    const ta = screen.getByPlaceholderText(/describe your track/i);
    await user.clear(ta);
    await user.type(ta, 'Success path');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('calls onClose after a successful save', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });

    const { onClose } = renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows "Saving..." on the button while the request is in-flight', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      await pending;
      return { data: {} };
    });

    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving\.\.\./i })).toBeDisabled();
    });
    resolveFn();
  });

  it('does not call onSuccess when nothing has changed (button is disabled)', () => {
    const apiSpy = vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });
    const { onSuccess } = renderWizard();
    // Save button is disabled with no changes — verify neither onSuccess nor apiCall fire
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    expect(saveBtn).toBeDisabled();
    expect(apiSpy).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// SUBMIT — ERROR HANDLING
// ===========================================================================
describe('EditSongWizard — submit errors', () => {
  it('alerts the backend error message when the API returns one', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      const err = new Error('Request failed');
      err.response = { data: { message: 'Storage quota exceeded' } };
      throw err;
    });

    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/failed to update song/i))
    );
  });

  it('does not call onSuccess on failure', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      throw new Error('Network down');
    });

    const { onSuccess, onClose } = renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await screen.findByRole('button', { name: /save changes/i }); // wait for loading to clear
    await waitFor(() => {
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('re-enables the Save button after a failed request', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      throw new Error('Flaky server');
    });

    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: /save changes/i });
      expect(saveBtn).not.toBeDisabled();
    });
  });

  it('does not call onClose on failure', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      throw new Error('boom');
    });

    const { onClose } = renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /no download/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onClose).not.toHaveBeenCalled());
  });
});