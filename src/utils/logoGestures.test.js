// Unit tests for the logo gesture decisions and the gesture player.
import { describe, it, expect, vi } from 'vitest';
import {
  createPlaybackGestureTracker, playLogoGesture, isGestureRunning, GESTURE_CONFIG, LOGO_GESTURES,
} from './logoGestures';

const C = GESTURE_CONFIG;

describe('playback gesture tracker', () => {
  it('first song of a session hops when it starts, no sway', () => {
    const t = createPlaybackGestureTracker();
    expect(t.songChanged({ hadPrevious: false, navMarker: null, nowMs: 0 })).toBeNull();
    expect(t.playStarted({ nowMs: 100 })).toBe('hop');
  });

  it('next / a new pick sways right', () => {
    const t = createPlaybackGestureTracker();
    expect(t.songChanged({ hadPrevious: true, navMarker: null, nowMs: 0 }))
      .toEqual({ gesture: 'sway', direction: 1 });
  });

  it('previous sways left', () => {
    const t = createPlaybackGestureTracker();
    const navMarker = { dir: -1, at: Date.now() };
    expect(t.songChanged({ hadPrevious: true, navMarker, nowMs: 0 }))
      .toEqual({ gesture: 'sway', direction: -1 });
  });

  it('ignores a stale previous marker', () => {
    const t = createPlaybackGestureTracker();
    const navMarker = { dir: -1, at: Date.now() - C.directionMaxAgeMs - 50 };
    expect(t.songChanged({ hadPrevious: true, navMarker, nowMs: 0 }).direction).toBe(1);
  });

  it('rapid skips sway once, not back and forth', () => {
    const t = createPlaybackGestureTracker();
    const sways = [0, 150, 300, 450].map((nowMs) =>
      t.songChanged({ hadPrevious: true, navMarker: null, nowMs }));
    expect(sways.filter(Boolean)).toHaveLength(1);
    expect(t.songChanged({ hadPrevious: true, navMarker: null, nowMs: 450 + C.swayCooldownMs })).not.toBeNull();
  });

  it('the new song starting after a change does not also hop', () => {
    const t = createPlaybackGestureTracker();
    t.songChanged({ hadPrevious: true, navMarker: null, nowMs: 0 });
    expect(t.playStarted({ nowMs: 800 })).toBeNull();
  });

  it('a song ending on its own does not squash', () => {
    const t = createPlaybackGestureTracker();
    expect(t.playStopped({ ended: true, nowMs: 5000 })).toBeNull();
  });

  it('a stop right after a song change (loading blip) does not squash', () => {
    const t = createPlaybackGestureTracker();
    t.songChanged({ hadPrevious: true, navMarker: null, nowMs: 1000 });
    expect(t.playStopped({ ended: false, nowMs: 1100 })).toBeNull();
  });

  it('a real pause squashes, and the next resume hops', () => {
    const t = createPlaybackGestureTracker();
    t.songChanged({ hadPrevious: true, navMarker: null, nowMs: 0 });
    expect(t.playStopped({ ended: false, nowMs: 1500 })).toBe('squash-pending');
    t.pauseConfirmed();
    expect(t.playStarted({ nowMs: 2000 })).toBe('hop');
  });
});

describe('playLogoGesture', () => {
  const fakeEl = () => {
    const anims = [];
    return {
      anims,
      animate: vi.fn((keyframes, opts) => {
        const a = { keyframes, opts, playState: 'running', cancel: vi.fn(function () { this.playState = 'idle'; }) };
        anims.push(a);
        return a;
      }),
    };
  };

  it('plays the named gesture', () => {
    const el = fakeEl();
    const a = playLogoGesture(el, 'squash');
    expect(a.keyframes).toBe(LOGO_GESTURES.squash.keyframes);
    expect(isGestureRunning(a)).toBe(true);
  });

  it('sway leans the requested way', () => {
    const el = fakeEl();
    const left = playLogoGesture(el, 'sway', { direction: -1 });
    expect(left.keyframes[1].transform).toContain('rotate(-7deg)');
    const right = playLogoGesture(el, 'sway', { direction: 1 });
    expect(right.keyframes[1].transform).toContain('rotate(7deg)');
  });

  it('only one gesture at a time: a new one cancels the old', () => {
    const el = fakeEl();
    const first = playLogoGesture(el, 'hop');
    playLogoGesture(el, 'shake', { current: first });
    expect(first.cancel).toHaveBeenCalled();
    expect(isGestureRunning(first)).toBe(false);
  });

  it('does nothing when the user prefers reduced motion', () => {
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true });
    const el = fakeEl();
    expect(playLogoGesture(el, 'hop')).toBeNull();
    expect(el.animate).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does nothing in browsers without the Web Animations API', () => {
    expect(playLogoGesture({}, 'hop')).toBeNull();
  });
});
