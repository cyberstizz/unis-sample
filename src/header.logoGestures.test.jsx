// Header logo gestures, wired end to end: a real PlayerContext value drives
// pause / resume / song change, a real <audio> element fires errors, and
// Element.animate is recorded so we can see which gesture played.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
}));
vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({ user: null, isGuest: true, logout: vi.fn(), theme: 'blue' }),
}));
vi.mock('./AuthGateSheet', () => ({
  default: () => null,
  useAuthGate: () => ({ triggerGate: vi.fn(), gateProps: { open: false } }),
}));
vi.mock('./components/SearchBar', () => ({ default: () => <div /> }));
vi.mock('./utils/buildUrl', () => ({ buildUrl: (p) => p }));
vi.mock('./assets/unisLogoThree.svg', () => ({ default: '/logo-blue.svg' }));
vi.mock('./assets/logo-orange.png', () => ({ default: '/o.png' }));
vi.mock('./assets/logo-red.png', () => ({ default: '/r.png' }));
vi.mock('./assets/logo-green.png', () => ({ default: '/g.png' }));
vi.mock('./assets/logo-purple.png', () => ({ default: '/p.png' }));
vi.mock('./assets/logo-gold.png', () => ({ default: '/y.png' }));
vi.mock('./assets/logo-dianna.png', () => ({ default: '/d.png' }));
vi.mock('./header.scss', () => ({}));
// Beat pops are covered by their own tests; keep the analyser out of this.
vi.mock('./utils/bassReactor', () => ({
  attachMediaElement: () => false,
  subscribeBeat: () => () => {},
  ensureRunning: () => {},
  isPulseEnabled: () => true,
}));

import Header from './header';
import { PlayerContext } from './context/playercontext';

// Record which gesture played, by recognising its keyframes.
let played;
const gestureName = (keyframes) => {
  const mid = keyframes[1].transform;
  if (mid.startsWith('scale(1.08')) return 'squash';
  if (mid.startsWith('translateY(-')) return 'hop';
  if (mid.includes('rotate(-')) return 'sway-left';
  if (mid.includes('rotate(')) return 'sway-right';
  if (mid.startsWith('translateX(-7')) return 'shake';
  return 'unknown';
};

let audio;
const song = (id) => ({ id, url: `/songs/${id}.mp3` });

function Harness({ value }) {
  return (
    <PlayerContext.Provider value={value}>
      <Header />
    </PlayerContext.Provider>
  );
}

function setup(initial = {}) {
  const audioRef = { current: audio };
  const navDirectionRef = { current: null };
  let value = { audioRef, navDirectionRef, isPlaying: false, currentMedia: null, ...initial };
  const utils = render(<Harness value={value} />);
  const update = (patch) => {
    value = { ...value, ...patch };
    utils.rerender(<Harness value={value} />);
  };
  return { update, navDirectionRef, audioRef };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
  played = [];
  Element.prototype.animate = vi.fn(function (keyframes) {
    played.push(gestureName(keyframes));
    return { playState: 'running', cancel() { this.playState = 'idle'; } };
  });
  audio = document.createElement('audio');
  document.body.appendChild(audio);
  Object.defineProperty(audio, 'paused', { configurable: true, get: () => audio._paused ?? true });
  Object.defineProperty(audio, 'ended', { configurable: true, get: () => audio._ended ?? false });
});

afterEach(() => {
  vi.useRealTimers();
  delete Element.prototype.animate;
  audio.remove();
});

describe('Header logo gestures', () => {
  it('hops when the first song starts', () => {
    const { update } = setup();
    update({ currentMedia: song('a') });
    update({ isPlaying: true });
    expect(played).toEqual(['hop']);
  });

  it('squashes on a real pause, then hops on resume', () => {
    const { update } = setup({ currentMedia: song('a'), isPlaying: true });
    audio._paused = true;
    update({ isPlaying: false });
    expect(played).toEqual([]); // waits to confirm it's a real pause
    act(() => { vi.advanceTimersByTime(200); });
    expect(played).toEqual(['squash']);
    audio._paused = false;
    update({ isPlaying: true });
    expect(played).toEqual(['squash', 'hop']);
  });

  it('does not squash when a song ends and the next one starts', () => {
    const { update } = setup({ currentMedia: song('a'), isPlaying: true });
    audio._ended = true;
    audio._paused = true;
    update({ isPlaying: false });
    audio._ended = false;
    update({ currentMedia: song('b') });
    update({ isPlaying: true });
    act(() => { vi.advanceTimersByTime(500); });
    expect(played).toEqual(['sway-right']);
  });

  it('sways right on next and left on previous', () => {
    const { update, navDirectionRef } = setup({ currentMedia: song('a'), isPlaying: true });
    update({ currentMedia: song('b') });
    act(() => { vi.advanceTimersByTime(1000); });
    navDirectionRef.current = { dir: -1, at: Date.now() };
    update({ currentMedia: song('a') });
    expect(played).toEqual(['sway-right', 'sway-left']);
    expect(navDirectionRef.current).toBeNull(); // marker consumed
  });

  it('does not squash on the brief "pause" while a new song loads', () => {
    const { update } = setup({ currentMedia: song('a'), isPlaying: true });
    update({ currentMedia: song('b') });
    audio._paused = true;
    update({ isPlaying: false });
    act(() => { vi.advanceTimersByTime(200); });
    audio._paused = false;
    update({ isPlaying: true });
    expect(played).toEqual(['sway-right']);
  });

  it('does not sway for the song restored on page load', () => {
    setup({ currentMedia: song('a'), isPlaying: false });
    act(() => { vi.advanceTimersByTime(500); });
    expect(played).toEqual([]);
  });

  it('shakes when the playing song fails', () => {
    setup({ currentMedia: song('a'), isPlaying: true });
    audio.setAttribute('src', '/songs/a.mp3');
    audio._paused = false;
    fireEvent(audio, new Event('error'));
    expect(played).toEqual(['shake']);
  });

  it('does not shake when the player is cleared (empty src)', () => {
    setup({ currentMedia: song('a'), isPlaying: true });
    audio.setAttribute('src', '');
    fireEvent(audio, new Event('error'));
    expect(played).toEqual([]);
  });

  it('does not shake for a stale restored song before anything was played', () => {
    setup({ currentMedia: song('a'), isPlaying: false });
    audio.setAttribute('src', '/songs/a.mp3');
    audio._paused = true;
    fireEvent(audio, new Event('error'));
    expect(played).toEqual([]);
  });

  it('presses in on tap and releases', () => {
    setup();
    const btn = screen.getByRole('button', { name: /go to unis home/i });
    fireEvent.pointerDown(btn);
    expect(btn.classList.contains('is-pressed')).toBe(true);
    fireEvent.pointerUp(btn);
    expect(btn.classList.contains('is-pressed')).toBe(false);
    fireEvent.pointerDown(btn);
    fireEvent.pointerLeave(btn);
    expect(btn.classList.contains('is-pressed')).toBe(false);
  });
});
