// src/lyricsWizard.test.jsx
// The timed-lyrics wizard: Words → Tap along → Check, and how it saves.
// The song's audio element is driven by hand here (jsdom has no playback):
// `media.at(t)` moves the clock, `media.start()` puts it in the playing state.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./lyricsWizard.scss', () => ({}));
vi.mock('./components/lyricsLines.scss', () => ({}));
vi.mock('./components/axiosInstance', () => ({ apiCall: vi.fn() }));

const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./context/FeedbackContext', () => ({ useFeedback: () => feedback }));

import { apiCall } from './components/axiosInstance';
import LyricsWizard from './lyricsWizard';

const SONG = { songId: 'song-1', title: 'Lenox Nights', fileUrl: 'songs/lenox.mp3' };

function serverSong({ lyrics = '', syncedLyrics = null } = {}) {
  apiCall.mockImplementation(({ method }) => {
    if (method === 'get') {
      return Promise.resolve({ data: { songId: 'song-1', fileUrl: 'songs/lenox.mp3', lyrics, syncedLyrics } });
    }
    return Promise.resolve({ data: { songId: 'song-1' } });
  });
}

function renderWizard(props = {}) {
  const all = { show: true, onClose: vi.fn(), onSuccess: vi.fn(), song: SONG, ...props };
  const user = userEvent.setup();
  render(<LyricsWizard {...all} />);
  return { user, props: all };
}

// A hand-driven clock on the wizard's <audio>.
function mediaControl() {
  const audio = document.querySelector('.lw audio');
  let paused = true;
  let time = 0;
  Object.defineProperty(audio, 'paused', { configurable: true, get: () => paused });
  Object.defineProperty(audio, 'duration', { configurable: true, get: () => 200 });
  Object.defineProperty(audio, 'currentTime', {
    configurable: true,
    get: () => time,
    set: (v) => { time = v; },
  });
  audio.play = vi.fn(() => { paused = false; fireEvent.play(audio); return Promise.resolve(); });
  audio.pause = vi.fn(() => { paused = true; fireEvent.pause(audio); });
  return {
    audio,
    start: () => act(() => { audio.play(); }),
    at: (t) => { time = t; },
  };
}

const patchBody = () => apiCall.mock.calls.find(([c]) => c.method === 'patch')?.[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LyricsWizard', () => {
  it('renders nothing when hidden', () => {
    serverSong();
    render(<LyricsWizard show={false} song={SONG} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens on top of the app (portalled under #root or body) with the saved words loaded', async () => {
    serverSong({ lyrics: 'Line one\nLine two' });
    renderWizard();
    const box = await screen.findByLabelText('Lyrics');
    await waitFor(() => expect(box).toHaveValue('Line one\nLine two'));
    expect(screen.getByRole('dialog').closest('.lw-overlay').parentElement).toBe(document.body);
    expect(screen.getByRole('heading', { name: 'Lenox Nights' })).toBeInTheDocument();
    expect(apiCall).toHaveBeenCalledWith(expect.objectContaining({ method: 'get', url: '/v1/media/song/song-1' }));
  });

  it('needs words before Next', async () => {
    serverSong();
    renderWizard();
    await screen.findByLabelText('Lyrics');
    expect(screen.getByRole('button', { name: 'Next: tap along' })).toBeDisabled();
  });

  it('runs the whole flow: words → tap each line → check → save as LRC', async () => {
    serverSong();
    const { user, props } = renderWizard();
    const box = await screen.findByLabelText('Lyrics');
    await user.type(box, 'First line{enter}Second line');
    await user.click(screen.getByRole('button', { name: 'Next: tap along' }));

    expect(screen.getByText('Tap as this line starts', { exact: false })).toBeInTheDocument();
    const media = mediaControl();
    media.start();

    media.at(12.5);
    await user.click(screen.getByRole('button', { name: /line 1 starts now/i }));
    media.at(16);
    await user.click(screen.getByRole('button', { name: /line 2 starts now/i }));

    // Last tap moves on to Check by itself.
    await screen.findByRole('button', { name: 'Save lyrics' }, { timeout: 2000 });
    await user.click(screen.getByRole('button', { name: 'Save lyrics' }));

    await waitFor(() => expect(patchBody()).toBeTruthy());
    expect(patchBody()).toEqual(expect.objectContaining({
      url: '/v1/media/song/song-1/lyrics',
      data: { lyrics: 'First line\nSecond line', syncedLyrics: '[00:12.40]First line\n[00:15.90]Second line' },
    }));
    expect(feedback.success).toHaveBeenCalled();
    expect(props.onSuccess).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('Undo clears the last tap', async () => {
    serverSong();
    const { user } = renderWizard();
    await user.type(await screen.findByLabelText('Lyrics'), 'A{enter}B{enter}C');
    await user.click(screen.getByRole('button', { name: 'Next: tap along' }));
    const media = mediaControl();
    media.start();
    media.at(5);
    await user.click(screen.getByRole('button', { name: /line 1 starts now/i }));
    expect(screen.getByText('1 of 3 lines')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /undo last tap/i }));
    expect(screen.getByText('0 of 3 lines')).toBeInTheDocument();
  });

  it('a timed song goes straight to Check and keeps every unchanged time', async () => {
    serverSong({ lyrics: 'One\nTwo', syncedLyrics: '[00:10.00]One\n[00:20.00]Two' });
    const { user } = renderWizard();
    await waitFor(async () => expect(await screen.findByLabelText('Lyrics')).toHaveValue('One\nTwo'));
    expect(screen.getByText(/already timed/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next: check timing' }));
    expect(screen.getByText('0:10.0')).toBeInTheDocument();
    expect(screen.getByText('0:20.0')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save lyrics' }));
    await waitFor(() => expect(patchBody()?.data.syncedLyrics).toBe('[00:10.00]One\n[00:20.00]Two'));
  });

  it('a changed line needs a new time before saving', async () => {
    serverSong({ lyrics: 'One\nTwo', syncedLyrics: '[00:10.00]One\n[00:20.00]Two' });
    const { user } = renderWizard();
    const box = await screen.findByLabelText('Lyrics');
    await waitFor(() => expect(box).toHaveValue('One\nTwo'));
    await user.clear(box);
    await user.type(box, 'One{enter}Two changed');
    expect(screen.getByText(/1 line has changed/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next: check timing' }));

    expect(screen.getByText(/1 line needs a time/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save lyrics' })).toBeDisabled();

    const media = mediaControl();
    media.start();
    media.at(21);
    await user.click(screen.getByRole('button', { name: 'Stamp' }));
    expect(screen.getByRole('button', { name: 'Save lyrics' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save lyrics' }));
    await waitFor(() => expect(patchBody()?.data.syncedLyrics).toBe('[00:10.00]One\n[00:20.90]Two changed'));
  });

  it('Save words only keeps the timing when the words match, and clears it when they changed', async () => {
    serverSong({ lyrics: 'One', syncedLyrics: '[00:10.00]One' });
    const { user } = renderWizard();
    const box = await screen.findByLabelText('Lyrics');
    await waitFor(() => expect(box).toHaveValue('One'));
    await user.type(box, '{enter}Two');
    expect(screen.getByText(/clears this song.s timing/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save words only' }));
    await waitFor(() => expect(patchBody()?.data).toEqual({ lyrics: 'One\nTwo', syncedLyrics: '' }));
    expect(feedback.success).toHaveBeenCalledWith(expect.stringMatching(/timing was cleared/i));
  });

  it('emptying the words clears the lyrics and their timing', async () => {
    serverSong({ lyrics: 'One', syncedLyrics: '[00:10.00]One' });
    const { user } = renderWizard();
    const box = await screen.findByLabelText('Lyrics');
    await waitFor(() => expect(box).toHaveValue('One'));
    await user.clear(box);
    await user.click(screen.getByRole('button', { name: 'Clear lyrics' }));
    await waitFor(() => expect(patchBody()?.data).toEqual({ lyrics: '', syncedLyrics: '' }));
  });

  it('timed lyrics pasted into the words box are recognised on Next', async () => {
    serverSong();
    const { user } = renderWizard();
    const box = await screen.findByLabelText('Lyrics');
    await user.click(box);
    await user.paste('[00:01.00]Hello\n[00:03.50]World');
    await user.click(screen.getByRole('button', { name: 'Next: tap along' }));
    expect(screen.getByText('0:01.0')).toBeInTheDocument();
    expect(screen.getByText('0:03.5')).toBeInTheDocument();
    expect(screen.getByLabelText('Preview of the timed lyrics')).toBeInTheDocument();
  });

  it('imports an .lrc file straight to Check', async () => {
    serverSong();
    const { user } = renderWizard();
    await screen.findByLabelText('Lyrics');
    const file = new File(['[00:02.00]Imported line'], 'song.lrc', { type: 'text/plain' });
    const input = document.querySelector('.lw input[type="file"]');
    await user.upload(input, file);
    expect(await screen.findByText('0:02.0')).toBeInTheDocument();
    expect(feedback.info).toHaveBeenCalledWith(expect.stringMatching(/Imported 1 timed lines/));
  });

  it('asks before closing with unsaved timing', async () => {
    serverSong();
    const { user, props } = renderWizard();
    await user.type(await screen.findByLabelText('Lyrics'), 'A{enter}B');
    await user.click(screen.getByRole('button', { name: 'Next: tap along' }));
    const media = mediaControl();
    media.start();
    media.at(3);
    await user.click(screen.getByRole('button', { name: /line 1 starts now/i }));

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/timing isn.t saved yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close without saving' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows "How it works" only when a tour is wired, and hands over to it', async () => {
    serverSong();
    const onHelp = vi.fn();
    const { user, props } = renderWizard({ onHelp });
    await user.click(await screen.findByRole('button', { name: /how it works/i }));
    expect(props.onClose).toHaveBeenCalled();
    expect(onHelp).toHaveBeenCalled();
  });

  it('has no "How it works" button without a tour', async () => {
    serverSong();
    renderWizard();
    await screen.findByLabelText('Lyrics');
    expect(screen.queryByRole('button', { name: /how it works/i })).not.toBeInTheDocument();
  });

  it('shows the server’s reason when saving fails', async () => {
    apiCall.mockImplementation(({ method }) => (method === 'get'
      ? Promise.resolve({ data: { lyrics: 'One', fileUrl: 'x.mp3' } })
      : Promise.reject({ response: { data: { error: 'Line times must go in order.' } } })));
    const { user } = renderWizard();
    const box = await screen.findByLabelText('Lyrics');
    await waitFor(() => expect(box).toHaveValue('One'));
    await user.type(box, '{enter}Two');
    await user.click(screen.getByRole('button', { name: 'Save words only' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Line times must go in order.');
  });
});
