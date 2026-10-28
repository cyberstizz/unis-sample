// src/DownloadModal.test.jsx
//
// The download window asks the server what this person may do with a song
// (free / paid / owned / streaming only), takes payment with Stripe's card
// form for paid songs, and saves the file under its real name without ever
// navigating to the bare audio file.
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ────────────────────────────────────────────────────────────────────
const apiCall = vi.fn();
vi.mock('./components/axiosInstance', () => ({ apiCall: (...args) => apiCall(...args) }));

const confirmPayment = vi.fn();
vi.mock('@stripe/stripe-js', () => ({ loadStripe: vi.fn(() => Promise.resolve({})) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => <div data-testid="stripe-elements">{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment }),
  useElements: () => ({}),
}));

let DownloadModal;
beforeAll(async () => {
  // The Stripe key is read when the module loads.
  vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_123');
  DownloadModal = (await import('./DownloadModal')).default;
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const song = {
  id: 'song-1',
  title: 'Track One',
  artist: 'testartist',
  artworkUrl: 'https://cdn.example.com/art1.jpg',
  fileName: 'testartist - Track One.mp3',
};
const FILE = 'https://cdn.example.com/track1.mp3';

/** Server answers for GET /v1/songs/{id}/download, purchase and confirm. */
function serverSays({ info, purchase, confirm } = {}) {
  apiCall.mockImplementation(({ method, url }) => {
    if (method === 'get' && url === '/v1/songs/song-1/download') {
      if (info instanceof Error) return Promise.reject(info);
      return Promise.resolve({ data: info });
    }
    if (method === 'post' && url === '/v1/songs/song-1/purchase') {
      if (purchase instanceof Error) return Promise.reject(purchase);
      return Promise.resolve({ data: purchase || { clientSecret: 'pi_1_secret_x' } });
    }
    if (method === 'post' && url === '/v1/songs/song-1/purchase/confirm') {
      return Promise.resolve({ data: confirm || { success: true, downloadUrl: FILE, purchaseId: 7 } });
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
}

const httpError = (status, error) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { error } } });

function renderModal(props = {}) {
  const onClose = vi.fn();
  const utils = render(<DownloadModal isOpen onClose={onClose} song={song} {...props} />);
  return { ...utils, onClose };
}

let anchors;
beforeEach(() => {
  apiCall.mockReset();
  confirmPayment.mockReset();
  window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  window.URL.revokeObjectURL = vi.fn();
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    blob: () => Promise.resolve(new Blob(['fake audio'], { type: 'audio/mpeg' })),
  }));
  anchors = [];
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    const el = realCreate(tag);
    if (tag === 'a') { el.click = vi.fn(); anchors.push(el); }
    return el;
  });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('DownloadModal — opening', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<DownloadModal isOpen={false} song={song} />);
    expect(container.firstChild).toBeNull();
    expect(apiCall).not.toHaveBeenCalled();
  });

  it('shows the song and asks the server what this person can do with it', async () => {
    serverSays({ info: { downloadPolicy: 'free', canDownload: true, downloadUrl: FILE } });
    renderModal();
    expect(screen.getByText('Track One')).toBeInTheDocument();
    expect(screen.getByText('testartist')).toBeInTheDocument();
    await screen.findByRole('button', { name: /download track/i });
    expect(apiCall).toHaveBeenCalledWith(expect.objectContaining({
      method: 'get', url: '/v1/songs/song-1/download', useCache: false,
    }));
  });

  it('trusts the server over the track data the player passes in', async () => {
    serverSays({ info: { downloadPolicy: 'paid', price: 199, canDownload: false, alreadyPurchased: false } });
    renderModal({ song: { ...song, downloadPolicy: 'free' } });
    expect(await screen.findByRole('button', { name: /buy for \$1\.99/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download track/i })).not.toBeInTheDocument();
  });

  it('asks a signed-out person to sign in', async () => {
    serverSays({ info: httpError(401) });
    renderModal();
    expect(await screen.findByText(/sign in to download/i)).toBeInTheDocument();
  });

  it('shows an error with a retry when the server can’t answer', async () => {
    serverSays({ info: httpError(500) });
    renderModal();
    expect(await screen.findByText(/couldn't load this song's download options/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('DownloadModal — free and owned songs', () => {
  it('saves the file under its real name without navigating to it', async () => {
    serverSays({ info: { downloadPolicy: 'free', canDownload: true, downloadUrl: FILE } });
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: /download track/i }));
    expect(await screen.findByText(/download started/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(FILE);
    const saved = anchors.find((a) => a.download);
    expect(saved.download).toBe('testartist - Track One.mp3');
    expect(saved.href).toBe('blob:mock-url');
    expect(saved.click).toHaveBeenCalled();
    expect(anchors.some((a) => a.href === FILE && a.click.mock.calls.length > 0)).toBe(false);
  });

  it('names the file "Artist - Title.mp3" when no file name is given', async () => {
    serverSays({ info: { downloadPolicy: 'free', canDownload: true, downloadUrl: FILE } });
    renderModal({ song: { ...song, fileName: undefined } });
    await userEvent.click(await screen.findByRole('button', { name: /download track/i }));
    await screen.findByText(/download started/i);
    expect(anchors.find((a) => a.download).download).toBe('testartist - Track One.mp3');
  });

  it('shows an error (not the browser player page) when the file can’t be fetched', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 403 }));
    serverSays({ info: { downloadPolicy: 'free', canDownload: true, downloadUrl: FILE } });
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: /download track/i }));
    expect(await screen.findByText(/couldn't save the file/i)).toBeInTheDocument();
    expect(screen.getByText(/open the file in a new tab instead/i)).toBeInTheDocument();
    expect(anchors.some((a) => a.click.mock.calls.length > 0)).toBe(false);
  });

  it('offers a bought song again as a download, not a second purchase', async () => {
    serverSays({ info: { downloadPolicy: 'paid', price: 199, alreadyPurchased: true, canDownload: true, downloadUrl: FILE } });
    renderModal();
    expect(await screen.findByText(/you own this/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /buy for/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download track/i })).toBeEnabled();
  });

  it('closes itself shortly after a download starts', async () => {
    serverSays({ info: { downloadPolicy: 'free', canDownload: true, downloadUrl: FILE } });
    const { onClose } = renderModal();
    await userEvent.click(await screen.findByRole('button', { name: /download track/i }));
    await screen.findByText(/download started/i);
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 3000 });
  });
});

describe('DownloadModal — streaming-only songs', () => {
  it('explains the artist turned downloads off', async () => {
    serverSays({ info: { downloadPolicy: 'unavailable', canDownload: false } });
    renderModal();
    expect(await screen.findByText(/streaming only/i)).toBeInTheDocument();
    expect(screen.getByText(/has not enabled downloads/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download track/i })).not.toBeInTheDocument();
  });

  it('says a removed song can’t be downloaded or bought', async () => {
    serverSays({ info: { downloadPolicy: 'unavailable', canDownload: false, removed: true } });
    renderModal();
    expect(await screen.findByText(/this song was removed/i)).toBeInTheDocument();
  });
});

describe('DownloadModal — buying a song', () => {
  const paid = { downloadPolicy: 'paid', price: 199, canDownload: false, alreadyPurchased: false };

  it('shows the price and the final-sale notice', async () => {
    serverSays({ info: paid });
    renderModal();
    expect(await screen.findByRole('button', { name: /buy for \$1\.99/i })).toBeInTheDocument();
    expect(screen.getByText(/digital downloads are final/i)).toBeInTheDocument();
  });

  it('formats cents as dollars', async () => {
    serverSays({ info: { ...paid, price: 94 } });
    renderModal();
    expect(await screen.findByRole('button', { name: /buy for \$0\.94/i })).toBeInTheDocument();
  });

  it('charges with Stripe, confirms on the server, then saves the file', async () => {
    serverSays({ info: paid });
    confirmPayment.mockResolvedValue({ paymentIntent: { id: 'pi_1', status: 'succeeded' } });
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: /buy for \$1\.99/i }));

    expect(await screen.findByTestId('payment-element')).toBeInTheDocument();
    expect(apiCall).toHaveBeenCalledWith(expect.objectContaining({ method: 'post', url: '/v1/songs/song-1/purchase' }));

    await userEvent.click(screen.getByRole('button', { name: /pay \$1\.99/i }));
    expect(await screen.findByText(/download started/i)).toBeInTheDocument();
    expect(confirmPayment).toHaveBeenCalledWith(expect.objectContaining({ redirect: 'if_required' }));
    expect(apiCall).toHaveBeenCalledWith(expect.objectContaining({
      method: 'post', url: '/v1/songs/song-1/purchase/confirm', data: { paymentIntentId: 'pi_1' },
    }));
    expect(global.fetch).toHaveBeenCalledWith(FILE);
  });

  it('never downloads when the card is declined', async () => {
    serverSays({ info: paid });
    confirmPayment.mockResolvedValue({ error: { code: 'card_declined', message: 'Your card was declined.' } });
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: /buy for/i }));
    await userEvent.click(await screen.findByRole('button', { name: /pay \$1\.99/i }));
    expect(await screen.findByText(/your card was declined/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(apiCall).not.toHaveBeenCalledWith(expect.objectContaining({ url: '/v1/songs/song-1/purchase/confirm' }));
  });

  it('shows the server’s reason when a purchase can’t start', async () => {
    serverSays({ info: paid, purchase: httpError(400, "You can't buy your own song. You can always download it from your dashboard.") });
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: /buy for/i }));
    expect(await screen.findByText(/you can't buy your own song/i)).toBeInTheDocument();
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument();
  });

  it('Back leaves the card form without charging', async () => {
    serverSays({ info: paid });
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: /buy for/i }));
    await screen.findByTestId('payment-element');
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(screen.getByRole('button', { name: /buy for \$1\.99/i })).toBeInTheDocument();
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it('tells a refunded buyer the song was removed', async () => {
    serverSays({ info: paid, confirm: { success: false, refunded: true, message: "This song was removed before your purchase finished. You've been refunded in full." } });
    confirmPayment.mockResolvedValue({ paymentIntent: { id: 'pi_1', status: 'succeeded' } });
    renderModal();
    await userEvent.click(await screen.findByRole('button', { name: /buy for/i }));
    await userEvent.click(await screen.findByRole('button', { name: /pay \$1\.99/i }));
    expect(await screen.findByText(/refunded in full/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('DownloadModal — closing', () => {
  it('closes with the X button', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serverSays({ info: { downloadPolicy: 'free', canDownload: true, downloadUrl: FILE } });
    const { onClose } = renderModal();
    fireEvent.click(screen.getByLabelText(/close download modal/i));
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked but not the window itself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serverSays({ info: { downloadPolicy: 'free', canDownload: true, downloadUrl: FILE } });
    const { onClose } = renderModal();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByRole('presentation'));
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(onClose).toHaveBeenCalled();
  });
});
