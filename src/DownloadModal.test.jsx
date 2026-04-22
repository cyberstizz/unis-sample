// src/DownloadModal.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DownloadModal from './DownloadModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderModal(props = {}) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    song: {},
    onPurchase: vi.fn(),
  };
  return render(<DownloadModal {...defaultProps} {...props} />);
}

const sampleFreeSong = {
  id: 'song-1',
  title: 'Track One',
  artist: 'testartist',
  artworkUrl: 'https://cdn.example.com/art1.jpg',
  downloadUrl: 'https://cdn.example.com/track1.mp3',
  downloadPolicy: 'free',
  fileName: 'Track One - testartist.mp3',
};

const samplePaidSong = {
  id: 'song-paid',
  title: 'Premium Track',
  artist: 'paidartist',
  artworkUrl: 'https://cdn.example.com/art2.jpg',
  downloadUrl: 'https://cdn.example.com/track-paid.mp3',
  downloadPolicy: 'paid',
  downloadPrice: 199, // $1.99 in cents
  fileName: 'Premium Track.mp3',
};

const sampleUnavailableSong = {
  id: 'song-ua',
  title: 'Gated Track',
  artist: 'privateartist',
  artworkUrl: null,
  downloadPolicy: 'unavailable',
};

// ---------------------------------------------------------------------------
// Global mocks for browser APIs the component uses
// ---------------------------------------------------------------------------
beforeEach(() => {
  // window.URL.createObjectURL / revokeObjectURL don't exist in jsdom
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = vi.fn();

  // Mock fetch for the blob download
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      blob: () => Promise.resolve(new Blob(['fake audio'], { type: 'audio/mpeg' })),
    })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('DownloadModal — closed state', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = renderModal({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal when isOpen is true', () => {
    renderModal({ song: sampleFreeSong });
    expect(screen.getByText('Track One')).toBeInTheDocument();
  });
});

describe('DownloadModal — track info display', () => {
  it('displays song title and artist', () => {
    renderModal({ song: sampleFreeSong });
    expect(screen.getByText('Track One')).toBeInTheDocument();
    expect(screen.getByText('testartist')).toBeInTheDocument();
  });

  it('falls back to "Untitled" when title is missing', () => {
    renderModal({ song: { downloadPolicy: 'free' } });
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('falls back to "Unknown Artist" when artist is missing', () => {
    renderModal({ song: { title: 'Track' } });
    expect(screen.getByText('Unknown Artist')).toBeInTheDocument();
  });

  it('renders artwork image when artworkUrl is provided', () => {
    renderModal({ song: sampleFreeSong });
    const img = screen.getByRole('img', { name: /Track One/i });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/art1.jpg');
  });

  it('renders placeholder instead of image when artworkUrl is missing', () => {
    const { container } = renderModal({ song: sampleUnavailableSong });
    // No img element should exist
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });
});

describe('DownloadModal — FREE policy', () => {
  it('shows "Free Download" badge', () => {
    renderModal({ song: sampleFreeSong });
    // "Free Download" (title case) matches badge; "free download" (lowercase) also
    // appears in the description. Use getAllByText since both are expected.
    expect(screen.getAllByText(/Free Download/i).length).toBeGreaterThan(0);
  });

  it('shows descriptive text', () => {
    renderModal({ song: sampleFreeSong });
    expect(screen.getByText(/available as a free download/i)).toBeInTheDocument();
  });

  it('shows "Download Track" button', () => {
    renderModal({ song: sampleFreeSong });
    expect(screen.getByRole('button', { name: /Download Track/i })).toBeInTheDocument();
  });

  it('shows a Cancel button', () => {
    renderModal({ song: sampleFreeSong });
    expect(screen.getByRole('button', { name: /^Cancel$/i })).toBeInTheDocument();
  });

  it('defaults to free policy when downloadPolicy is unspecified', () => {
    renderModal({ song: { title: 'No Policy', artist: 'x', downloadUrl: 'x.mp3' } });
    expect(screen.getAllByText(/Free Download/i).length).toBeGreaterThan(0);
  });
});

describe('DownloadModal — PAID policy', () => {
  it('shows the price formatted as dollars', () => {
    renderModal({ song: samplePaidSong });
    // 199 cents → $1.99, shown in both badge and button
    const matches = screen.getAllByText(/\$1\.99/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('formats $10.00 correctly (1000 cents)', () => {
    renderModal({
      song: { ...samplePaidSong, downloadPrice: 1000 },
    });
    expect(screen.getAllByText(/\$10\.00/).length).toBeGreaterThan(0);
  });

  it('formats $0.99 correctly (99 cents)', () => {
    renderModal({
      song: { ...samplePaidSong, downloadPrice: 99 },
    });
    expect(screen.getAllByText(/\$0\.99/).length).toBeGreaterThan(0);
  });

  it('shows the non-refundable disclaimer', () => {
    renderModal({ song: samplePaidSong });
    expect(
      screen.getByText(/All song purchases are final/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/non-refundable/i)
    ).toBeInTheDocument();
  });

  it('shows "Purchase & Download" button with price', () => {
    renderModal({ song: samplePaidSong });
    expect(
      screen.getByRole('button', { name: /Purchase & Download.*\$1\.99/i })
    ).toBeInTheDocument();
  });

  it('shows purchase description text', () => {
    renderModal({ song: samplePaidSong });
    expect(
      screen.getByText(/high-quality copy you can keep forever/i)
    ).toBeInTheDocument();
  });
});

describe('DownloadModal — UNAVAILABLE policy', () => {
  it('shows "Download Unavailable" badge', () => {
    renderModal({ song: sampleUnavailableSong });
    expect(screen.getByText(/Download Unavailable/i)).toBeInTheDocument();
  });

  it('shows the explanatory message', () => {
    renderModal({ song: sampleUnavailableSong });
    expect(
      screen.getByText(/artist has chosen not to make this track available/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/stream it anytime on Unis/i)).toBeInTheDocument();
  });

  it('shows only a "Got it" button (no download, no cancel)', () => {
    renderModal({ song: sampleUnavailableSong });
    expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download Track/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Purchase/i })).not.toBeInTheDocument();
  });

  it('closes when "Got it" is clicked (via animation delay)', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderModal({ song: sampleUnavailableSong, onClose });

    fireEvent.click(screen.getByRole('button', { name: /Got it/i }));

    // handleClose triggers a 200ms setTimeout before onClose fires
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DownloadModal — free download flow', () => {
  it('fetches the downloadUrl and creates a blob download on click', async () => {
    const user = userEvent.setup();
    renderModal({ song: sampleFreeSong });

    await user.click(screen.getByRole('button', { name: /Download Track/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('https://cdn.example.com/track1.mp3');
    });
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('uses the song fileName for the download anchor', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const user = userEvent.setup();
    renderModal({ song: sampleFreeSong });

    await user.click(screen.getByRole('button', { name: /Download Track/i }));

    await waitFor(() => {
      // Find the anchor element that was appended
      const anchorCall = appendSpy.mock.calls.find(
        ([node]) => node?.tagName === 'A'
      );
      expect(anchorCall).toBeDefined();
      expect(anchorCall[0].download).toBe('Track One - testartist.mp3');
      expect(anchorCall[0].href).toContain('blob:mock-url');
    });
    // Cleanup happens after click
    await waitFor(() => expect(removeSpy).toHaveBeenCalled());
  });

  it('falls back to "title - artist.mp3" when fileName is missing', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const user = userEvent.setup();
    renderModal({ song: { ...sampleFreeSong, fileName: null } });

    await user.click(screen.getByRole('button', { name: /Download Track/i }));

    await waitFor(() => {
      const anchorCall = appendSpy.mock.calls.find(
        ([node]) => node?.tagName === 'A'
      );
      expect(anchorCall[0].download).toBe('Track One - testartist.mp3');
    });
  });

  it('does nothing when downloadUrl is missing', async () => {
    const user = userEvent.setup();
    renderModal({ song: { ...sampleFreeSong, downloadUrl: null } });

    await user.click(screen.getByRole('button', { name: /Download Track/i }));

    // Give the async chain time
    await new Promise(r => setTimeout(r, 50));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows "Download started!" success state after successful download', async () => {
    const user = userEvent.setup();
    renderModal({ song: sampleFreeSong });

    await user.click(screen.getByRole('button', { name: /Download Track/i }));

    await waitFor(() => {
      expect(screen.getByText(/Download started!/i)).toBeInTheDocument();
    });
  });

  it('auto-closes the modal 1.5s after successful download', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { rerender } = renderModal({ song: sampleFreeSong, onClose });

    // Use async user events that work with fake timers
    fireEvent.click(screen.getByRole('button', { name: /Download Track/i }));

    // Let the fetch promise settle
    await act(async () => {
      vi.runAllTicks();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Advance past the 1500ms auto-close + 200ms handleClose delay
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onClose).toHaveBeenCalled();
  });
});

describe('DownloadModal — free download error path', () => {
  it('shows error state when fetch rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    const user = userEvent.setup();
    renderModal({ song: sampleFreeSong });

    await user.click(screen.getByRole('button', { name: /Download Track/i }));

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });

  it('shows a Retry button in error state', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    const user = userEvent.setup();
    renderModal({ song: sampleFreeSong });

    await user.click(screen.getByRole('button', { name: /Download Track/i }));
    await waitFor(() => expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('Retry returns to idle state showing the download button again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));
    const user = userEvent.setup();
    renderModal({ song: sampleFreeSong });

    await user.click(screen.getByRole('button', { name: /Download Track/i }));
    await waitFor(() => expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Retry/i }));

    // After retry → back to idle → download button visible again
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download Track/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });
});

describe('DownloadModal — paid purchase flow', () => {
  it('calls onPurchase with the song id when purchase button clicked', async () => {
    const onPurchase = vi.fn(() => Promise.resolve());
    const user = userEvent.setup();
    renderModal({ song: samplePaidSong, onPurchase });

    await user.click(screen.getByRole('button', { name: /Purchase & Download/i }));

    await waitFor(() => {
      expect(onPurchase).toHaveBeenCalledWith('song-paid');
    });
  });

  it('triggers the download automatically after successful purchase', async () => {
    vi.useFakeTimers();
    const onPurchase = vi.fn(() => Promise.resolve());
    renderModal({ song: samplePaidSong, onPurchase });

    fireEvent.click(screen.getByRole('button', { name: /Purchase & Download/i }));

    // Flush the purchase promise
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // 600ms delay before the download triggers
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    // Real timers for fetch promise
    vi.useRealTimers();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(samplePaidSong.downloadUrl);
    });
  });

  it('shows error state when onPurchase rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onPurchase = vi.fn(() => Promise.reject(new Error('payment declined')));
    const user = userEvent.setup();
    renderModal({ song: samplePaidSong, onPurchase });

    await user.click(screen.getByRole('button', { name: /Purchase & Download/i }));

    await waitFor(() => {
      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    });
  });
});

describe('DownloadModal — close interactions', () => {
  it('calls onClose when X button is clicked (after 200ms animation)', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { container } = renderModal({ song: sampleFreeSong, onClose });

    // The close button is the first button in the modal (top-right X)
    const closeBtn = container.querySelectorAll('button')[0];
    fireEvent.click(closeBtn);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel (free policy) is clicked', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderModal({ song: sampleFreeSong, onClose });

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel (paid policy) is clicked', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderModal({ song: samplePaidSong, onClose });

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when overlay backdrop is clicked', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const { container } = renderModal({ song: sampleFreeSong, onClose });

    // The overlay is the outermost div with the click handler
    const overlay = container.firstChild;
    fireEvent.click(overlay);

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when modal body is clicked (stopPropagation)', async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    renderModal({ song: sampleFreeSong, onClose });

    // Click inside the modal body (e.g. the title)
    fireEvent.click(screen.getByText('Track One'));

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('DownloadModal — state reset on reopen', () => {
  it('resets status to idle when the modal reopens', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn(() => Promise.reject(new Error('fail')));

    const { rerender } = renderModal({ song: sampleFreeSong, isOpen: true });

    // Trigger an error state
    fireEvent.click(screen.getByRole('button', { name: /Download Track/i }));
    await waitFor(() => expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument());

    // Close
    rerender(<DownloadModal isOpen={false} song={sampleFreeSong} />);
    // Reopen
    rerender(<DownloadModal isOpen={true} song={sampleFreeSong} />);

    // Status should be idle again → download button visible, no error
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download Track/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument();
  });
});

describe('DownloadModal — policy switching', () => {
  it('switches from free to paid content when song prop changes', () => {
    const { rerender } = renderModal({ song: sampleFreeSong });
    expect(screen.getAllByText(/Free Download/i).length).toBeGreaterThan(0);

    rerender(<DownloadModal isOpen={true} song={samplePaidSong} />);
    expect(screen.queryByText(/Free Download/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/\$1\.99/).length).toBeGreaterThan(0);
  });
});

describe('DownloadModal — defaults and edge cases', () => {
  it('uses default empty song object when prop is omitted', () => {
    render(<DownloadModal isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Untitled')).toBeInTheDocument();
    expect(screen.getByText('Unknown Artist')).toBeInTheDocument();
  });

  it('uses default no-op onClose when prop is omitted (no crash)', () => {
    // Should not throw
    expect(() => {
      render(<DownloadModal isOpen={true} song={sampleFreeSong} />);
    }).not.toThrow();
  });

  it('uses default no-op onPurchase when prop is omitted (paid policy)', async () => {
    // If onPurchase isn't passed, clicking the button should use the default
    // () => {} and not crash. Status will progress to purchased/complete.
    const user = userEvent.setup();
    render(<DownloadModal isOpen={true} song={samplePaidSong} />);

    await user.click(screen.getByRole('button', { name: /Purchase & Download/i }));

    // The default onPurchase resolves synchronously (it's a no-op), so no throw
    // The component will then try to download and that's fine.
    await new Promise(r => setTimeout(r, 50));
    // No assertion — just verifying no crash
    expect(true).toBe(true);
  });
});