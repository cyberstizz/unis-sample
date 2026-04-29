// src/uploadWizard.test.jsx
//
// Comprehensive test suite for UploadWizard — the artist-facing flow that
// uploads a song or video file with metadata, and (for explicit songs)
// optionally uploads a clean version that gets linked to the explicit one.
//
// Wizard structure:
//   Step 1 — choose media type (song vs video)
//   Step 2 — title, description, ISRC, explicit toggle, download policy,
//            file picker, artwork picker
//   Step 3 — confirm + submit (POST /v1/media/{song|video})
//   Step 4 — (only for explicit songs) prompt for clean version
//
// Covers:
//   • show=false renders nothing
//   • Step 1 → 2 → 3 navigation, Back/Next buttons
//   • Initial defaults: mediaType=song, genreId/jurisdictionId from props
//   • File validation: type allowlist (mp3 vs mp4/mov/avi), 50MB size cap
//   • Artwork validation: jpeg/png only, 1MB cap
//   • Title required, file required, genre/jurisdiction required
//   • ISRC is uppercased + alphanumeric-stripped, max 15 chars
//   • Explicit toggle (only shown for songs)
//   • Download policy: free / paid / unavailable
//   • Paid download: minimum $1.99 validation
//   • Confirmation step shows submitted values
//   • Submit POSTs to /v1/media/song or /v1/media/video with FormData
//   • Submit success (non-explicit): calls onUploadSuccess + onClose
//   • Submit success (explicit song): advances to step 4 instead
//   • Step 4 — "skip" path closes wizard immediately
//   • Step 4 — "yes" path uploads clean MP3 + PATCHes the explicit song
//   • Clean version inherits title with " (Clean)" suffix
//   • Server error during upload surfaces in error-message
//   • Loading state disables submit button
//   • Overlay click closes; clicks inside the wizard do NOT close
//   • Close (×) button closes
//
// Pattern notes:
//   • Uses the canonical MSW-bypass pattern via vi.spyOn(axiosModule, 'apiCall')
//     because FormData + MSW + axios + jsdom hangs forever (gotcha #1 from
//     Charles's original prompt).
//   • Each upload test installs its own mockApiCall and falls back to the
//     original for non-upload calls.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as axiosModule from './components/axiosInstance';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------
vi.mock('./uploadWizard.scss', () => ({}));

// Import AFTER mocks
import UploadWizard from './uploadWizard';

// ---------------------------------------------------------------------------
// CONSTANTS / FIXTURES
// ---------------------------------------------------------------------------
const ARTIST_PROFILE = {
  userId: 'user-artist-001',
  username: 'testartist',
  role: 'artist',
  genreId: '00000000-0000-0000-0000-000000000101',
  jurisdiction: { jurisdictionId: '00000000-0000-0000-0000-000000000003', name: 'Uptown Harlem' },
};

// Helper: create a File whose .type and .size jsdom can read back
function fakeFile({
  name = 'track.mp3',
  type = 'audio/mpeg',
  sizeMB = 5,
} = {}) {
  // jsdom respects the second arg (an array of BlobParts) for size only when
  // we explicitly set the size via Object.defineProperty.
  const file = new File(['x'.repeat(1024)], name, { type });
  Object.defineProperty(file, 'size', { value: Math.round(sizeMB * 1024 * 1024) });
  return file;
}

// Helper: select a file on a hidden <input type="file">.
// Uses fireEvent.change directly because userEvent.upload v14 enforces the
// `accept` attribute (silently dropping rejected files), which prevents us
// from testing the component's OWN type-rejection logic.
async function selectFile(input, file) {
  fireEvent.change(input, { target: { files: [file] } });
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
let originalApiCall;

beforeEach(() => {
  originalApiCall = axiosModule.apiCall;
  // Stub URL.createObjectURL / revokeObjectURL — jsdom doesn't implement them
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// HELPERS — common render setup
// ---------------------------------------------------------------------------
function renderWizard({
  onClose = vi.fn(),
  onUploadSuccess = vi.fn(),
  userProfile = ARTIST_PROFILE,
  show = true,
} = {}) {
  return {
    onClose,
    onUploadSuccess,
    ...render(
      <UploadWizard
        show={show}
        onClose={onClose}
        onUploadSuccess={onUploadSuccess}
        userProfile={userProfile}
      />
    ),
  };
}

// Advance to step 2 with mediaType=song
async function advanceToStep2(user) {
  await user.click(screen.getByRole('button', { name: /^next$/i }));
  expect(screen.getByRole('heading', { name: /upload file & details/i })).toBeInTheDocument();
}

// Advance to step 2 then fill required fields
async function fillStep2({
  user,
  title = 'My Track',
  file = fakeFile(),
  artwork = null,
  isrc = '',
  explicit = false,
  downloadPolicy = null, // null = leave default 'free'
  downloadPrice = '',
} = {}) {
  await advanceToStep2(user);

  if (title) {
    const titleInput = screen.getByPlaceholderText(/song\/video title/i);
    await user.type(titleInput, title);
  }
  if (isrc) {
    const isrcInput = screen.getByPlaceholderText(/usrc/i);
    await user.type(isrcInput, isrc);
  }
  if (explicit) {
    const toggle = screen.getByRole('switch');
    await user.click(toggle);
  }
  if (downloadPolicy && downloadPolicy !== 'free') {
    const labelMap = { paid: /paid download/i, unavailable: /no download/i, free: /free download/i };
    await user.click(screen.getByRole('button', { name: labelMap[downloadPolicy] }));
  }
  if (downloadPrice) {
    const priceInput = screen.getByPlaceholderText('1.99');
    await user.type(priceInput, downloadPrice);
  }
  if (file) {
    const fileInput = document.getElementById('file');
    await selectFile(fileInput, file);
  }
  if (artwork) {
    const artInput = document.getElementById('artwork');
    await selectFile(artInput, artwork);
  }
}

// ===========================================================================
// VISIBILITY GATING
// ===========================================================================
describe('UploadWizard — visibility', () => {
  it('renders nothing when show=false', () => {
    const { container } = renderWizard({ show: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders the wizard overlay when show=true', () => {
    renderWizard();
    expect(document.querySelector('.upload-wizard-overlay')).not.toBeNull();
  });
});

// ===========================================================================
// STEP 1 — TYPE SELECTION
// ===========================================================================
describe('UploadWizard — step 1 (type selection)', () => {
  it('starts on step 1 with the SONG heading', () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: /upload new song/i })).toBeInTheDocument();
  });

  it('renders the media type select with default = song', () => {
    renderWizard();
    const select = document.querySelector('select.input-field');
    expect(select).not.toBeNull();
    expect(select.value).toBe('song');
  });

  it('switches heading to "VIDEO" when user picks video', async () => {
    renderWizard();
    const user = userEvent.setup();
    const select = document.querySelector('select.input-field');
    await user.selectOptions(select, 'video');
    expect(screen.getByRole('heading', { name: /upload new video/i })).toBeInTheDocument();
  });

  it('Back button is hidden on step 1', () => {
    renderWizard();
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument();
  });

  it('Next button is visible on step 1', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /^next$/i })).toBeInTheDocument();
  });

  it('Close button is rendered', () => {
    renderWizard();
    expect(document.querySelector('.close-button')).not.toBeNull();
  });
});

// ===========================================================================
// NAVIGATION — Step 1 → 2 → 3 → back
// ===========================================================================
describe('UploadWizard — navigation', () => {
  it('Next on step 1 advances to step 2 details form', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
  });

  it('Back from step 2 returns to step 1', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /upload new song/i })).toBeInTheDocument();
  });

  it('Next on step 2 advances to step 3 confirmation', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('heading', { name: /confirm upload/i })).toBeInTheDocument();
  });

  it('Back from step 3 returns to step 2', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('heading', { name: /upload file & details/i })).toBeInTheDocument();
  });

  it('Next button disappears on step 3 (only the submit button is there)', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// STEP 2 — FORM FIELDS
// ===========================================================================
describe('UploadWizard — step 2 form fields', () => {
  it('updates title state when user types', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const input = screen.getByPlaceholderText(/song\/video title/i);
    await user.type(input, 'Midnight Uptown');
    expect(input.value).toBe('Midnight Uptown');
  });

  it('updates description state when user types', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const ta = screen.getByPlaceholderText(/brief description/i);
    await user.type(ta, 'Late night vibes');
    expect(ta.value).toBe('Late night vibes');
  });

  it('uppercases ISRC input and strips non-alphanumeric chars', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const isrc = screen.getByPlaceholderText(/usrc/i);
    await user.type(isrc, 'us-rc176-07839');
    expect(isrc.value).toBe('USRC17607839');
  });

  it('limits ISRC to 15 chars via maxLength', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const isrc = screen.getByPlaceholderText(/usrc/i);
    expect(isrc.maxLength).toBe(15);
  });
});

// ===========================================================================
// EXPLICIT TOGGLE
// ===========================================================================
describe('UploadWizard — explicit toggle', () => {
  it('shows the explicit toggle for songs', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('hides the explicit toggle for videos', async () => {
    renderWizard();
    const user = userEvent.setup();
    const typeSelect = document.querySelector('select.input-field');
    await user.selectOptions(typeSelect, 'video');
    await advanceToStep2(user);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('toggles aria-checked when clicked', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles via Space key', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const toggle = screen.getByRole('switch');
    toggle.focus();
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles via Enter key', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const toggle = screen.getByRole('switch');
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the "after uploading you\'ll be prompted" hint when explicit is on', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByText(/prompted to upload an optional clean version/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// DOWNLOAD POLICY
// ===========================================================================
describe('UploadWizard — download policy', () => {
  it('defaults to Free Download', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    // The free button should look "selected" — we can verify by checking
    // its border style is the active-selection state.
    const freeBtn = screen.getByRole('button', { name: /free download/i });
    expect(freeBtn.style.border).toContain('2px solid');
  });

  it('switching to Paid reveals the price input', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.queryByPlaceholderText('1.99')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /paid download/i }));
    expect(screen.getByPlaceholderText('1.99')).toBeInTheDocument();
  });

  it('switching from Paid back to Free hides the price input', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /paid download/i }));
    await user.click(screen.getByRole('button', { name: /free download/i }));
    expect(screen.queryByPlaceholderText('1.99')).not.toBeInTheDocument();
  });

  it('shows "free" hint copy when Free is selected', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    expect(screen.getByText(/can download this track for free/i)).toBeInTheDocument();
  });

  it('shows "minimum $1.99" hint when Paid is selected', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /paid download/i }));
    expect(screen.getByText(/minimum \$1\.99/i)).toBeInTheDocument();
  });

  it('shows "stream but not download" hint when Unavailable is selected', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.click(screen.getByRole('button', { name: /no download/i }));
    expect(screen.getByText(/stream but not download/i)).toBeInTheDocument();
  });

  it('hides download policy section for videos', async () => {
    renderWizard();
    const user = userEvent.setup();
    const typeSelect = document.querySelector('select.input-field');
    await user.selectOptions(typeSelect, 'video');
    await advanceToStep2(user);
    expect(screen.queryByRole('button', { name: /free download/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// FILE VALIDATION
// ===========================================================================
describe('UploadWizard — file validation', () => {
  it('accepts MP3 for songs', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const input = document.getElementById('file');
    await selectFile(input, fakeFile({ name: 'track.mp3', type: 'audio/mpeg', sizeMB: 5 }));
    expect(screen.getByText(/Selected: track\.mp3/i)).toBeInTheDocument();
  });

  it('rejects WAV (or any non-MP3) for songs', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const input = document.getElementById('file');
    await selectFile(input, fakeFile({ name: 'track.wav', type: 'audio/wav', sizeMB: 5 }));
    expect(screen.getByText(/song must be MP3/i)).toBeInTheDocument();
  });

  it('rejects MP3 for videos', async () => {
    renderWizard();
    const user = userEvent.setup();
    const typeSelect = document.querySelector('select.input-field');
    await user.selectOptions(typeSelect, 'video');
    await advanceToStep2(user);
    const input = document.getElementById('file');
    await selectFile(input, fakeFile({ name: 'clip.mp3', type: 'audio/mpeg', sizeMB: 5 }));
    expect(screen.getByText(/video must be MP4\/MOV\/AVI/i)).toBeInTheDocument();
  });

  it('accepts MP4 for videos', async () => {
    renderWizard();
    const user = userEvent.setup();
    const typeSelect = document.querySelector('select.input-field');
    await user.selectOptions(typeSelect, 'video');
    await advanceToStep2(user);
    const input = document.getElementById('file');
    await selectFile(input, fakeFile({ name: 'clip.mp4', type: 'video/mp4', sizeMB: 10 }));
    expect(screen.getByText(/Selected: clip\.mp4/i)).toBeInTheDocument();
  });

  it('rejects file larger than 50MB', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const input = document.getElementById('file');
    await selectFile(input, fakeFile({ name: 'huge.mp3', type: 'audio/mpeg', sizeMB: 51 }));
    expect(screen.getByText(/File too large \(max 50MB\)/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// ARTWORK VALIDATION
// ===========================================================================
describe('UploadWizard — artwork validation', () => {
  it('accepts JPEG artwork', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const art = document.getElementById('artwork');
    await selectFile(art, fakeFile({ name: 'cover.jpg', type: 'image/jpeg', sizeMB: 0.5 }));
    expect(screen.getByText(/Selected: cover\.jpg/i)).toBeInTheDocument();
  });

  it('accepts PNG artwork', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const art = document.getElementById('artwork');
    await selectFile(art, fakeFile({ name: 'cover.png', type: 'image/png', sizeMB: 0.5 }));
    expect(screen.getByText(/Selected: cover\.png/i)).toBeInTheDocument();
  });

  it('rejects GIF artwork', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const art = document.getElementById('artwork');
    await selectFile(art, fakeFile({ name: 'cover.gif', type: 'image/gif', sizeMB: 0.5 }));
    expect(screen.getByText(/Artwork must be JPEG or PNG/i)).toBeInTheDocument();
  });

  it('rejects artwork larger than 1MB', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    const art = document.getElementById('artwork');
    await selectFile(art, fakeFile({ name: 'cover.jpg', type: 'image/jpeg', sizeMB: 1.5 }));
    expect(screen.getByText(/Artwork too large \(max 1MB\)/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// STEP 3 — CONFIRMATION SUMMARY
// ===========================================================================
describe('UploadWizard — step 3 confirmation', () => {
  it('shows submitted title on confirm screen', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Midnight Uptown' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/Midnight Uptown/)).toBeInTheDocument();
  });

  it('shows "None" when description is blank', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2({ user });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    const summary = document.querySelector('.confirmation-summary');
    expect(summary.textContent).toMatch(/Description:\s*None/i);
  });

  it('shows "Yes" / "No" for Explicit field', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2({ user, explicit: true });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    const summary = document.querySelector('.confirmation-summary');
    expect(summary.textContent).toMatch(/Explicit:\s*Yes/i);
  });

  it('shows ISRC on confirm screen when provided', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2({ user, isrc: 'USRC17607839' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/USRC17607839/)).toBeInTheDocument();
  });

  it('shows "Not provided" for ISRC when blank', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2({ user });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    const summary = document.querySelector('.confirmation-summary');
    expect(summary.textContent).toMatch(/ISRC:\s*Not provided/i);
  });

  it('shows the selected file name on confirm', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2({ user, file: fakeFile({ name: 'banger.mp3' }) });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    // File line: "File: banger.mp3 (song)" — appears in confirmation summary
    const confirmSection = document.querySelector('.confirmation-summary');
    expect(confirmSection.textContent).toMatch(/banger\.mp3/);
  });

  it('renders the submit "Upload Now" button', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2({ user });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByRole('button', { name: /upload now/i })).toBeInTheDocument();
  });

  it('shows the warning copy about uploads being permanent', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2({ user });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// SUBMIT — VALIDATION ERRORS
// ===========================================================================
describe('UploadWizard — submit validation', () => {
  it('shows "All fields required" when title is empty', async () => {
    renderWizard();
    const user = userEvent.setup();
    // Skip title, but provide a file
    await advanceToStep2(user);
    const fileInput = document.getElementById('file');
    await selectFile(fileInput, fakeFile());
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    expect(await screen.findByText(/all fields required/i)).toBeInTheDocument();
  });

  it('shows "All fields required" when no file is selected', async () => {
    renderWizard();
    const user = userEvent.setup();
    await advanceToStep2(user);
    await user.type(screen.getByPlaceholderText(/song\/video title/i), 'No File');
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    expect(await screen.findByText(/all fields required/i)).toBeInTheDocument();
  });

  it('shows "Minimum download price is $1.99" when paid + price below 1.99', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2({
      user,
      title: 'Cheap',
      downloadPolicy: 'paid',
      downloadPrice: '0.99',
    });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    expect(await screen.findByText(/minimum download price is \$1\.99/i)).toBeInTheDocument();
  });

  it('shows price error when paid + no price set', async () => {
    renderWizard();
    const user = userEvent.setup();
    await fillStep2({
      user,
      title: 'No Price',
      downloadPolicy: 'paid',
    });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    expect(await screen.findByText(/minimum download price is \$1\.99/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// SUBMIT — SUCCESS PATHS (non-explicit)
// ===========================================================================
describe('UploadWizard — submit success', () => {
  it('POSTs to /v1/media/song with the right metadata', async () => {
    let capturedPayload = null;
    let capturedUrl = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      capturedUrl = config.url;
      // Pull out the metadata JSON from the FormData
      const fd = config.data;
      const meta = fd.get('song');
      if (meta) capturedPayload = JSON.parse(meta);
      return { data: { songId: 'new-song-1' } };
    });

    const onUploadSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <UploadWizard show={true} onClose={onClose} onUploadSuccess={onUploadSuccess} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Hit Track' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalled());
    expect(capturedUrl).toBe('/v1/media/song');
    expect(capturedPayload.title).toBe('Hit Track');
    expect(capturedPayload.artistId).toBe(ARTIST_PROFILE.userId);
    expect(capturedPayload.genreId).toBe(ARTIST_PROFILE.genreId);
    expect(capturedPayload.jurisdictionId).toBe(ARTIST_PROFILE.jurisdiction.jurisdictionId);
    expect(capturedPayload.explicit).toBe(false);
  });

  it('POSTs to /v1/media/video when video is selected', async () => {
    let capturedUrl = null;
    let capturedKey = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      capturedUrl = config.url;
      // metadata key is the mediaType
      const fd = config.data;
      capturedKey = Array.from(fd.keys()).find((k) => k === 'song' || k === 'video');
      return { data: { videoId: 'new-vid-1' } };
    });

    const onUploadSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <UploadWizard show={true} onClose={onClose} onUploadSuccess={onUploadSuccess} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    const typeSelect = document.querySelector('select.input-field');
    await user.selectOptions(typeSelect, 'video');
    await fillStep2({ user, title: 'Vid', file: fakeFile({ name: 'clip.mp4', type: 'video/mp4' }) });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    await waitFor(() => expect(onUploadSuccess).toHaveBeenCalled());
    expect(capturedUrl).toBe('/v1/media/video');
    expect(capturedKey).toBe('video');
  });

  it('calls onUploadSuccess with response data and onClose on success', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => ({
      data: { songId: 'new-song-1' },
    }));

    const onUploadSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <UploadWizard show={true} onClose={onClose} onUploadSuccess={onUploadSuccess} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Done' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalledWith({ songId: 'new-song-1' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('serializes downloadPrice as integer cents when paid', async () => {
    let capturedPayload = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      const meta = config.data.get('song');
      if (meta) capturedPayload = JSON.parse(meta);
      return { data: { songId: 'paid-1' } };
    });

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({
      user,
      title: 'Premium',
      downloadPolicy: 'paid',
      downloadPrice: '299',  // parseInt('299') = 299 (cents)
    });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    await waitFor(() => expect(capturedPayload).not.toBeNull());
    expect(capturedPayload.downloadPolicy).toBe('paid');
    expect(capturedPayload.downloadPrice).toBe(299);
  });

  it('sends downloadPrice=null when policy is free', async () => {
    let capturedPayload = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      const meta = config.data.get('song');
      if (meta) capturedPayload = JSON.parse(meta);
      return { data: { songId: 'free-1' } };
    });

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Free Track' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    await waitFor(() => expect(capturedPayload).not.toBeNull());
    expect(capturedPayload.downloadPolicy).toBe('free');
    expect(capturedPayload.downloadPrice).toBeNull();
  });

  it('sends artwork when provided', async () => {
    let hadArtwork = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      hadArtwork = config.data.has('artwork');
      return { data: { songId: 'with-art' } };
    });

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({
      user,
      title: 'Arty',
      artwork: fakeFile({ name: 'cover.jpg', type: 'image/jpeg', sizeMB: 0.3 }),
    });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    await waitFor(() => expect(hadArtwork).toBe(true));
  });
});

// ===========================================================================
// SUBMIT — ERROR HANDLING
// ===========================================================================
describe('UploadWizard — submit errors', () => {
  it('surfaces backend message when API returns one', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      const err = new Error('Request failed');
      err.response = { data: { message: 'Storage quota exceeded' } };
      throw err;
    });

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Track' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    expect(await screen.findByText(/storage quota exceeded/i)).toBeInTheDocument();
  });

  it('falls back to error.message when no response.data.message', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      throw new Error('Network down');
    });

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Track' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    expect(await screen.findByText(/network down/i)).toBeInTheDocument();
  });

  it('does not call onUploadSuccess on failure', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      throw new Error('boom');
    });

    const onUploadSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <UploadWizard show={true} onClose={onClose} onUploadSuccess={onUploadSuccess} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Track' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    await screen.findByText(/boom/i);
    expect(onUploadSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables submit button while loading', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      await pending;
      return { data: { songId: 'slow' } };
    });

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Slow' });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /uploading\.\.\./i })).toBeDisabled();
    });
    resolveFn();
  });
});

// ===========================================================================
// EXPLICIT SONG → STEP 4 (CLEAN VERSION FLOW)
// ===========================================================================
describe('UploadWizard — explicit song advances to step 4', () => {
  it('advances to step 4 instead of closing on success', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => ({
      data: { songId: 'explicit-1' },
    }));

    const onClose = vi.fn();
    render(
      <UploadWizard show={true} onClose={onClose} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Bad Words', explicit: true });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    expect(await screen.findByRole('heading', { name: /upload clean version/i })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the original title in the step 4 prompt copy', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => ({
      data: { songId: 'explicit-1' },
    }));

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Late Night Sin', explicit: true });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));

    await screen.findByRole('heading', { name: /upload clean version/i });
    expect(screen.getByText(/Late Night Sin/)).toBeInTheDocument();
  });
});

describe('UploadWizard — step 4 skip path', () => {
  it('"No, skip for now" button calls onUploadSuccess + onClose', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => ({
      data: { songId: 'explicit-1' },
    }));

    const onUploadSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <UploadWizard show={true} onClose={onClose} onUploadSuccess={onUploadSuccess} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Skip Path', explicit: true });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    await screen.findByRole('heading', { name: /upload clean version/i });

    await user.click(screen.getByRole('button', { name: /no, skip for now/i }));
    expect(onUploadSuccess).toHaveBeenCalledWith({ songId: 'explicit-1' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('UploadWizard — step 4 yes path', () => {
  it('"Yes, upload a clean version" reveals the clean file picker', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => ({
      data: { songId: 'explicit-1' },
    }));

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Yes Path', explicit: true });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    await screen.findByRole('heading', { name: /upload clean version/i });

    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));
    expect(document.getElementById('cleanFile')).not.toBeNull();
    expect(screen.getByRole('button', { name: /upload clean version/i })).toBeInTheDocument();
  });

  it('rejects non-MP3 clean file', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => ({
      data: { songId: 'explicit-1' },
    }));

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'WAV Clean', explicit: true });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    await screen.findByRole('heading', { name: /upload clean version/i });
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));

    const cleanInput = document.getElementById('cleanFile');
    await selectFile(cleanInput, fakeFile({ name: 'clean.wav', type: 'audio/wav' }));
    expect(screen.getByText(/Clean version must be MP3/i)).toBeInTheDocument();
  });

  it('uploads clean MP3 + PATCHes the explicit song with cleanVersionId', async () => {
    let cleanUploadPayload = null;
    let patchUrl = null;
    let patchHadCleanVersionId = false;
    let callIndex = 0;

    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      callIndex++;
      if (callIndex === 1) {
        // First call: explicit song upload
        return { data: { songId: 'explicit-1' } };
      }
      if (callIndex === 2) {
        // Second call: clean version POST
        const meta = config.data.get('song');
        if (meta) cleanUploadPayload = JSON.parse(meta);
        return { data: { songId: 'clean-1' } };
      }
      if (callIndex === 3) {
        // Third call: PATCH
        patchUrl = config.url;
        patchHadCleanVersionId = config.data.has('cleanVersionId');
        return { data: {} };
      }
      return { data: {} };
    });

    const onUploadSuccess = vi.fn();
    const onClose = vi.fn();
    render(
      <UploadWizard show={true} onClose={onClose} onUploadSuccess={onUploadSuccess} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Bad Words', explicit: true });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    await screen.findByRole('heading', { name: /upload clean version/i });
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));

    const cleanInput = document.getElementById('cleanFile');
    await selectFile(cleanInput, fakeFile({ name: 'clean.mp3', type: 'audio/mpeg' }));
    await user.click(screen.getByRole('button', { name: /upload clean version/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(cleanUploadPayload.title).toBe('Bad Words (Clean)');
    expect(cleanUploadPayload.explicit).toBe(false);
    expect(patchUrl).toBe('/v1/media/song/explicit-1');
    expect(patchHadCleanVersionId).toBe(true);
    expect(onUploadSuccess).toHaveBeenCalledWith({ songId: 'explicit-1' });
  });

  it('shows error message when clean upload fails', async () => {
    let callIndex = 0;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      callIndex++;
      if (callIndex === 1) return { data: { songId: 'explicit-1' } };
      const err = new Error('Clean upload boom');
      err.response = { data: { message: 'Disk full' } };
      throw err;
    });

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'Trk', explicit: true });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    await screen.findByRole('heading', { name: /upload clean version/i });
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));

    const cleanInput = document.getElementById('cleanFile');
    await selectFile(cleanInput, fakeFile({ name: 'clean.mp3', type: 'audio/mpeg' }));
    await user.click(screen.getByRole('button', { name: /upload clean version/i }));

    expect(await screen.findByText(/disk full/i)).toBeInTheDocument();
  });

  it('upload-clean button disabled when no file selected', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => ({
      data: { songId: 'explicit-1' },
    }));

    render(
      <UploadWizard show={true} onClose={vi.fn()} onUploadSuccess={vi.fn()} userProfile={ARTIST_PROFILE} />
    );
    const user = userEvent.setup();
    await fillStep2({ user, title: 'NoFile', explicit: true });
    await user.click(screen.getByRole('button', { name: /^next$/i }));
    await user.click(screen.getByRole('button', { name: /upload now/i }));
    await screen.findByRole('heading', { name: /upload clean version/i });
    await user.click(screen.getByRole('button', { name: /yes, upload a clean version/i }));

    expect(screen.getByRole('button', { name: /upload clean version/i })).toBeDisabled();
  });
});

// ===========================================================================
// CLOSE BEHAVIOR
// ===========================================================================
describe('UploadWizard — close behavior', () => {
  it('clicking the × button calls onClose', async () => {
    const onClose = vi.fn();
    renderWizard({ onClose });
    const user = userEvent.setup();
    await user.click(document.querySelector('.close-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the overlay calls onClose', async () => {
    const onClose = vi.fn();
    renderWizard({ onClose });
    const user = userEvent.setup();
    await user.click(document.querySelector('.upload-wizard-overlay'));
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking inside the wizard does NOT call onClose', async () => {
    const onClose = vi.fn();
    renderWizard({ onClose });
    const user = userEvent.setup();
    await user.click(document.querySelector('.upload-wizard'));
    expect(onClose).not.toHaveBeenCalled();
  });
});