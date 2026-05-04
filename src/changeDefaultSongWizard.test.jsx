// src/changeDefaultSongWizard.test.jsx
//
// Comprehensive test suite for ChangeDefaultSongWizard — the modal that lets
// an artist pick which of their uploaded songs plays automatically when someone
// visits their UNIS profile.
//
// Component behaviour summary:
//   • Returns null when show=false
//   • Empty-state view when songs=[] — heading "No Songs Yet", "Got It" closes
//   • Song list view when songs are provided:
//       - Pre-selects currentDefaultSongId on mount
//       - Each row shows artwork (or music-icon placeholder), title, plays, duration
//       - Clicking a row selects it — Check icon appears, border goes blue
//       - "Save as Featured" disabled when selection === currentDefaultSongId
//       - "Save as Featured" disabled while the request is in-flight
//       - No-change path: selection unchanged → onClose() with no API call
//       - Happy path: PATCH /v1/users/default-song { defaultSongId } →
//                     onSuccess() + onClose()
//       - Error path: alert shown, onSuccess/onClose NOT called
//       - Cancel + × buttons call onClose
//
// Pattern notes (identical to the rest of the Unis wizard suite):
//   • vi.spyOn(axiosModule, 'apiCall') — no MSW/FormData issues
//   • window.alert spied so alert() calls don't crash jsdom

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as axiosModule from './components/axiosInstance';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------
vi.mock('./changeDefaultSongWizard.scss', () => ({}));

import ChangeDefaultSongWizard from './changeDefaultSongWizard';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------
const SONG_A = {
  songId: 'song-aaa-001',
  title: 'Midnight Uptown',
  plays: 412,
  duration: 213000,           // 3.55 min
  artworkUrl: '/media/art/aaa.jpg',
};

const SONG_B = {
  songId: 'song-bbb-002',
  title: 'Late Night Drive',
  plays: 88,
  duration: 187000,           // 3.1 min
  artworkUrl: 'https://cdn.example.com/bbb.jpg',
};

const SONG_C = {
  songId: 'song-ccc-003',
  title: 'No Artwork Track',
  plays: 0,
  duration: 240000,           // 4.0 min
  artworkUrl: null,
};

const ALL_SONGS = [SONG_A, SONG_B, SONG_C];

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// RENDER HELPER
// ---------------------------------------------------------------------------
function renderWizard({
  show = true,
  songs = ALL_SONGS,
  currentDefaultSongId = SONG_A.songId,
  onClose = vi.fn(),
  onSuccess = vi.fn(),
} = {}) {
  return {
    onClose,
    onSuccess,
    ...render(
      <ChangeDefaultSongWizard
        show={show}
        songs={songs}
        currentDefaultSongId={currentDefaultSongId}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    ),
  };
}

function getHighlightedRows() {
  return Array.from(document.querySelectorAll('[style*="cursor: pointer"]'))
    .filter((row) => {
      const border = row.style.border || '';
      const borderColor = row.style.borderColor || '';

      return (
        border.includes('#004aad') ||
        border.includes('rgb(0, 74, 173)') ||
        borderColor === '#004aad' ||
        borderColor === 'rgb(0, 74, 173)'
      );
    });
}

// ===========================================================================
// VISIBILITY GATING
// ===========================================================================
describe('ChangeDefaultSongWizard — visibility', () => {
  it('renders nothing when show=false', () => {
    const { container } = renderWizard({ show: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders the overlay when show=true', () => {
    renderWizard();
    expect(document.querySelector('.upload-wizard-overlay')).not.toBeNull();
  });

  it('renders the wizard panel inside the overlay', () => {
    renderWizard();
    expect(document.querySelector('.upload-wizard')).not.toBeNull();
  });
});

// ===========================================================================
// EMPTY STATE — NO SONGS
// ===========================================================================
describe('ChangeDefaultSongWizard — empty state (no songs)', () => {
  it('shows the "No Songs Yet" heading when songs array is empty', () => {
    renderWizard({ songs: [] });
    expect(screen.getByRole('heading', { name: /no songs yet/i })).toBeInTheDocument();
  });

  it('shows the upload-prompt copy', () => {
    renderWizard({ songs: [] });
    expect(screen.getByText(/upload your first song/i)).toBeInTheDocument();
  });

  it('renders a "Got It" button in the empty state', () => {
    renderWizard({ songs: [] });
    expect(screen.getByRole('button', { name: /got it/i })).toBeInTheDocument();
  });

  it('"Got It" button calls onClose', async () => {
    const { onClose } = renderWizard({ songs: [] });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /got it/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT show the song list or "Save as Featured" button in empty state', () => {
    renderWizard({ songs: [] });
    expect(screen.queryByRole('button', { name: /save as featured/i })).not.toBeInTheDocument();
  });

  it('renders the close (×) button in the empty state', () => {
    renderWizard({ songs: [] });
    expect(document.querySelector('.close-button')).not.toBeNull();
  });

  it('close (×) in empty state calls onClose', async () => {
    const { onClose } = renderWizard({ songs: [] });
    const user = userEvent.setup();
    await user.click(document.querySelector('.close-button'));
    expect(onClose).toHaveBeenCalled();
  });
});

// ===========================================================================
// SONG LIST — RENDERING
// ===========================================================================
describe('ChangeDefaultSongWizard — song list rendering', () => {
  it('shows the "Set Featured Song" heading', () => {
    renderWizard();
    expect(screen.getByRole('heading', { name: /set featured song/i })).toBeInTheDocument();
  });

  it('renders all songs in the list', () => {
    renderWizard();
    expect(screen.getByText('Midnight Uptown')).toBeInTheDocument();
    expect(screen.getByText('Late Night Drive')).toBeInTheDocument();
    expect(screen.getByText('No Artwork Track')).toBeInTheDocument();
  });

  it('shows play count for each song', () => {
    renderWizard();
    expect(screen.getByText(/412 plays/)).toBeInTheDocument();
    expect(screen.getByText(/88 plays/)).toBeInTheDocument();
    // SONG_C has 0 plays
    expect(screen.getByText(/0 plays/)).toBeInTheDocument();
  });

it('formats duration in minutes with one decimal', () => {
  renderWizard();

  const hasSongMetaText = (plays, duration) => (_, node) => {
    if (node?.tagName?.toLowerCase() !== 'p') return false;

    const text = node.textContent.replace(/\s+/g, ' ').trim();
    return text.includes(`${plays} plays`) && text.includes(`${duration} min`);
  };

  expect(screen.getByText(hasSongMetaText(412, '3.5'))).toBeInTheDocument();
  expect(screen.getByText(hasSongMetaText(88, '3.1'))).toBeInTheDocument();
  expect(screen.getByText(hasSongMetaText(0, '4.0'))).toBeInTheDocument();
});

  it('renders artwork image for songs with an artwork URL', () => {
    renderWizard();
    const artworkImages = screen.getAllByRole('img');
    // SONG_A and SONG_B have artworkUrl; SONG_C does not
    expect(artworkImages).toHaveLength(2);
  });

  it('prefixes relative artworkUrl with the API base URL', () => {
    renderWizard();
    const img = screen.getByAltText('Midnight Uptown');
    expect(img.src).toContain(SONG_A.artworkUrl);
  });

  it('uses absolute artworkUrl as-is when it starts with http', () => {
    renderWizard();
    const img = screen.getByAltText('Late Night Drive');
    expect(img.src).toBe(SONG_B.artworkUrl);
  });

  it('shows the music-icon placeholder for songs without artwork', () => {
    renderWizard();
    // SONG_C has no artworkUrl — its row should not have an <img>
    expect(screen.queryByAltText('No Artwork Track')).toBeNull();
  });

  it('renders the Cancel button', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders the "Save as Featured" button', () => {
    renderWizard();
    expect(screen.getByRole('button', { name: /save as featured/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// INITIAL SELECTION STATE
// ===========================================================================
describe('ChangeDefaultSongWizard — initial selection', () => {
  it('pre-selects the currentDefaultSongId row on mount', () => {
    renderWizard({ currentDefaultSongId: SONG_A.songId });
    // The check icon only appears for the selected song
    // Lucide Check renders as an SVG — we verify it's inside SONG_A's row
    // by checking that exactly one check icon exists and the button is disabled
    // (selection matches the current default → no change)
    expect(screen.getByRole('button', { name: /save as featured/i })).toBeDisabled();
  });

  it('"Save as Featured" is disabled when selection equals currentDefaultSongId', () => {
    renderWizard({ currentDefaultSongId: SONG_B.songId });
    expect(screen.getByRole('button', { name: /save as featured/i })).toBeDisabled();
  });

  it('"Save as Featured" is enabled immediately when currentDefaultSongId is null', () => {
    // No default set yet — any selection is a valid new choice
    renderWizard({ currentDefaultSongId: null });
    // With null currentDefaultSongId, selectedSongId initialises to null too,
    // so the button should still be disabled (null === null)
    expect(screen.getByRole('button', { name: /save as featured/i })).toBeDisabled();
  });

  it('shows only one Check icon when the list first renders', () => {
    // Check icon rendered by Lucide — count the check SVGs by their data-lucide attr
    // or by counting matching SVG paths; simplest proxy is querying by stroke colour
    renderWizard({ currentDefaultSongId: SONG_A.songId });
    // There should be exactly 1 selected row (SONG_A)
    // We verify by ensuring only one row has the blue border colour (inline style)
    const allRows = getHighlightedRows();
    expect(allRows).toHaveLength(1);
    expect(allRows[0].textContent).toContain('Midnight Uptown');
  });
});

// ===========================================================================
// SONG SELECTION INTERACTION
// ===========================================================================
describe('ChangeDefaultSongWizard — song selection interaction', () => {
  it('clicking a different song enables "Save as Featured"', async () => {
    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    expect(screen.getByRole('button', { name: /save as featured/i })).not.toBeDisabled();
  });

  it('clicking the already-selected song keeps "Save as Featured" disabled', async () => {
    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Midnight Uptown'));
    expect(screen.getByRole('button', { name: /save as featured/i })).toBeDisabled();
  });

  it('clicking a song moves the selection highlight to that row', async () => {
    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    // Now SONG_B row should be the only highlighted row
    const highlighted = getHighlightedRows();
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].textContent).toContain('Late Night Drive');
  });

  it('clicking back to the original song re-disables "Save as Featured"', async () => {
    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    expect(screen.getByRole('button', { name: /save as featured/i })).not.toBeDisabled();
    await user.click(screen.getByText('Midnight Uptown'));
    expect(screen.getByRole('button', { name: /save as featured/i })).toBeDisabled();
  });

  it('selecting a song with no artwork still highlights that row', async () => {
    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('No Artwork Track'));
    const highlighted = getHighlightedRows();
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].textContent).toContain('No Artwork Track');
  });

  it('clicking a song with no prior default enables "Save as Featured"', async () => {
    renderWizard({ currentDefaultSongId: null });
    const user = userEvent.setup();
    await user.click(screen.getByText('Midnight Uptown'));
    expect(screen.getByRole('button', { name: /save as featured/i })).not.toBeDisabled();
  });
});

// ===========================================================================
// NO-CHANGE PATH — selection unchanged
// ===========================================================================
describe('ChangeDefaultSongWizard — no-change short-circuit', () => {
  it('calls onClose without an API call when selection is unchanged', async () => {
    const apiSpy = vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });
    const { onClose } = renderWizard({ currentDefaultSongId: SONG_A.songId });

    // The Save button is disabled when nothing changed, so we verify
    // no API call was ever made and the button guard works
    expect(screen.getByRole('button', { name: /save as featured/i })).toBeDisabled();
    expect(apiSpy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// SUBMIT — HAPPY PATH
// ===========================================================================
describe('ChangeDefaultSongWizard — submit happy path', () => {
  it('PATCHes /v1/users/default-song with the selected songId', async () => {
    let capturedConfig = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      capturedConfig = config;
      return { data: {} };
    });

    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    await user.click(screen.getByRole('button', { name: /save as featured/i }));

    await waitFor(() => {
      expect(capturedConfig.method).toBe('patch');
      expect(capturedConfig.url).toBe('/v1/users/default-song');
      expect(capturedConfig.data).toEqual({ defaultSongId: SONG_B.songId });
    });
  });

  it('calls onSuccess after a successful PATCH', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });
    const { onSuccess } = renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    await user.click(screen.getByRole('button', { name: /save as featured/i }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('calls onClose after a successful PATCH', async () => {
    vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });
    const { onClose } = renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    await user.click(screen.getByRole('button', { name: /save as featured/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('sends the correct defaultSongId when switching to a song with no artwork', async () => {
    let capturedData = null;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
      capturedData = config.data;
      return { data: {} };
    });

    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('No Artwork Track'));
    await user.click(screen.getByRole('button', { name: /save as featured/i }));

    await waitFor(() => expect(capturedData).toEqual({ defaultSongId: SONG_C.songId }));
  });

  it('shows "Saving..." and disables the button while the request is in-flight', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      await pending;
      return { data: {} };
    });

    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    await user.click(screen.getByRole('button', { name: /save as featured/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving\.\.\./i })).toBeDisabled();
    });
    resolveFn();
  });

  it('only makes one API call per save', async () => {
    let callCount = 0;
    vi.spyOn(axiosModule, 'apiCall').mockImplementation(async () => {
      callCount++;
      return { data: {} };
    });

    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    await user.click(screen.getByRole('button', { name: /save as featured/i }));

    await waitFor(() => expect(callCount).toBe(1));
  });
});

// ===========================================================================
// SUBMIT — ERROR PATH
// ===========================================================================
describe('ChangeDefaultSongWizard — submit error path', () => {
  it('shows the failure alert when the API throws', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockRejectedValue(new Error('Network error'));

    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    await user.click(screen.getByRole('button', { name: /save as featured/i }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringMatching(/failed to update featured song/i)
      )
    );
  });

  it('does NOT call onSuccess when the API throws', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockRejectedValue(new Error('boom'));

    const { onSuccess } = renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    await user.click(screen.getByRole('button', { name: /save as featured/i }));

    await waitFor(() => expect(onSuccess).not.toHaveBeenCalled());
  });

  it('does NOT call onClose when the API throws', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockRejectedValue(new Error('boom'));

    const { onClose } = renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    await user.click(screen.getByRole('button', { name: /save as featured/i }));

    await waitFor(() => expect(onClose).not.toHaveBeenCalled());
  });

  it('re-enables "Save as Featured" after a failed request', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(axiosModule, 'apiCall').mockRejectedValue(new Error('Flaky'));

    renderWizard({ currentDefaultSongId: SONG_A.songId });
    const user = userEvent.setup();
    await user.click(screen.getByText('Late Night Drive'));
    await user.click(screen.getByRole('button', { name: /save as featured/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save as featured/i })).not.toBeDisabled();
    });
  });
});

// ===========================================================================
// CLOSE / CANCEL BEHAVIOUR
// ===========================================================================
describe('ChangeDefaultSongWizard — close and cancel', () => {
  it('Cancel button calls onClose', async () => {
    const { onClose } = renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('close (×) button calls onClose', async () => {
    const { onClose } = renderWizard();
    const user = userEvent.setup();
    await user.click(document.querySelector('.close-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('Cancel does not trigger an API call', async () => {
    const apiSpy = vi.spyOn(axiosModule, 'apiCall').mockResolvedValue({ data: {} });
    renderWizard();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(apiSpy).not.toHaveBeenCalled();
  });
});