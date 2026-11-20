// src/utils/queuePersistence.test.js
//
// Keeps the play queue across a page refresh.
//
// Rules:
//   • the queue is saved per account, so signing out and in as someone else on
//     a shared device never shows the last person's queue
//   • a restored queue always comes back PAUSED (browsers block audio that
//     isn't started by a tap), at the position it was left
//   • queues older than a week, or saved in an older format, are dropped
//   • a damaged or oversized save can never break playback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import persistence, {
  saveQueueState,
  loadQueueState,
  clearQueueState,
  clearAllQueueState,
} from './queuePersistence';

const DAY = 24 * 60 * 60 * 1000;
const key = (userId) => `unis.queue.${userId}`;
const song = (n) => ({ qid: `q-${n}`, songId: `song-${n}`, title: `Track ${n}`, fileUrl: `https://cdn.test/${n}.mp3` });
const songs = (count) => Array.from({ length: count }, (_, i) => song(i + 1));

const STATE = {
  queue: songs(3),
  originalQueue: songs(3),
  currentIndex: 1,
  currentMedia: song(2),
  queueSource: 'playlist',
  isShuffled: true,
  repeatMode: 'all',
  autoplay: true,
  currentTime: 42.5,
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===========================================================================
describe('queuePersistence — saving', () => {
  it('saves under a key for that account', () => {
    expect(saveQueueState('user-1', STATE)).toBe(true);
    expect(localStorage.getItem(key('user-1'))).not.toBeNull();
    expect(localStorage.getItem(key('user-2'))).toBeNull();
  });

  it('a guest\'s queue is saved under its own key', () => {
    saveQueueState(null, STATE);
    saveQueueState(undefined, STATE);
    expect(localStorage.getItem(key('guest'))).not.toBeNull();
    expect(localStorage.length).toBe(1);
  });

  it('stamps the format version and the time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
    saveQueueState('user-1', STATE);
    const saved = JSON.parse(localStorage.getItem(key('user-1')));
    expect(saved.v).toBe(1);
    expect(saved.savedAt).toBe(Date.now());
  });

  it('never saves whether music was playing', () => {
    saveQueueState('user-1', { ...STATE, isPlaying: true });
    expect(JSON.parse(localStorage.getItem(key('user-1')))).not.toHaveProperty('isPlaying');
  });

  it('an empty queue with nothing playing removes the save instead', () => {
    saveQueueState('user-1', STATE);
    expect(saveQueueState('user-1', { queue: [], currentMedia: null })).toBe(true);
    expect(localStorage.getItem(key('user-1'))).toBeNull();
  });

  it.each([null, undefined, {}])('saving %p removes the save', (state) => {
    saveQueueState('user-1', STATE);
    saveQueueState('user-1', state);
    expect(localStorage.getItem(key('user-1'))).toBeNull();
  });

  it('a single song playing with no queue is still saved', () => {
    saveQueueState('user-1', { queue: [], currentMedia: song(9) });
    expect(loadQueueState('user-1')).toMatchObject({ queue: [], currentMedia: song(9) });
  });

  it('caps the saved queue at 500 songs', () => {
    saveQueueState('user-1', { ...STATE, queue: songs(650), originalQueue: songs(650) });
    const saved = JSON.parse(localStorage.getItem(key('user-1')));
    expect(saved.queue).toHaveLength(500);
    expect(saved.originalQueue).toHaveLength(500);
    expect(saved.queue[0].songId).toBe('song-1');
  });

  it('when storage is full it reports failure, drops the old save and does not throw', () => {
    saveQueueState('user-1', STATE);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveQueueState('user-1', STATE)).toBe(false);
    expect(localStorage.getItem(key('user-1'))).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });
});

// ===========================================================================
describe('queuePersistence — restoring', () => {
  it('returns what was saved', () => {
    saveQueueState('user-1', STATE);
    expect(loadQueueState('user-1')).toEqual(STATE);
  });

  it('returns null when nothing was saved', () => {
    expect(loadQueueState('user-1')).toBeNull();
  });

  it('one account never gets another account\'s queue', () => {
    saveQueueState('user-1', STATE);
    expect(loadQueueState('user-2')).toBeNull();
    expect(loadQueueState(null)).toBeNull();
  });

  it('a restored queue carries no "playing" flag — it comes back paused', () => {
    saveQueueState('user-1', { ...STATE, isPlaying: true });
    expect(loadQueueState('user-1')).not.toHaveProperty('isPlaying');
  });

  it('keeps the position in the song', () => {
    saveQueueState('user-1', STATE);
    expect(loadQueueState('user-1').currentTime).toBe(42.5);
  });

  it('is still there after six days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    saveQueueState('user-1', STATE);
    vi.setSystemTime(new Date(Date.now() + 6 * DAY));
    expect(loadQueueState('user-1')).not.toBeNull();
  });

  it('is dropped, and removed, after a week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    saveQueueState('user-1', STATE);
    vi.setSystemTime(new Date(Date.now() + 7 * DAY + 1));
    expect(loadQueueState('user-1')).toBeNull();
    expect(localStorage.getItem(key('user-1'))).toBeNull();
  });

  it('a save from an older format is dropped and removed', () => {
    localStorage.setItem(key('user-1'), JSON.stringify({ v: 0, savedAt: Date.now(), queue: songs(2) }));
    expect(loadQueueState('user-1')).toBeNull();
    expect(localStorage.getItem(key('user-1'))).toBeNull();
  });

  it('a save with no timestamp is dropped', () => {
    localStorage.setItem(key('user-1'), JSON.stringify({ v: 1, queue: songs(2) }));
    expect(loadQueueState('user-1')).toBeNull();
  });

  it('damaged data is dropped and removed, not thrown', () => {
    localStorage.setItem(key('user-1'), '{not json');
    expect(loadQueueState('user-1')).toBeNull();
    expect(localStorage.getItem(key('user-1'))).toBeNull();
  });

  it('a save whose queue is not a list is ignored', () => {
    localStorage.setItem(key('user-1'), JSON.stringify({ v: 1, savedAt: Date.now(), queue: 'oops' }));
    expect(loadQueueState('user-1')).toBeNull();
  });
});

describe('queuePersistence — repairing what it restores', () => {
  const stored = (fields) =>
    localStorage.setItem(key('user-1'), JSON.stringify({ v: 1, savedAt: Date.now(), queue: songs(3), ...fields }));

  it.each([
    ['past the end', 7],
    ['negative', -1],
    ['not a whole number', 1.5],
    ['text', '1'],
    ['missing', undefined],
  ])('a position that is %s goes back to the first song', (_label, currentIndex) => {
    stored({ currentIndex });
    const restored = loadQueueState('user-1');
    expect(restored.currentIndex).toBe(0);
    expect(restored.currentMedia).toEqual(song(1));
  });

  it('uses the song at the saved position when no current song was saved', () => {
    stored({ currentIndex: 2 });
    expect(loadQueueState('user-1').currentMedia).toEqual(song(3));
  });

  it('keeps a saved current song even when it is not the one at that position', () => {
    stored({ currentIndex: 0, currentMedia: song(99) });
    expect(loadQueueState('user-1').currentMedia).toEqual(song(99));
  });

  it('falls back to the queue itself when the unshuffled order is missing', () => {
    stored({ originalQueue: undefined });
    expect(loadQueueState('user-1').originalQueue).toEqual(songs(3));
  });

  it.each(['off', 'all', 'one'])('keeps repeat mode "%s"', (repeatMode) => {
    stored({ repeatMode });
    expect(loadQueueState('user-1').repeatMode).toBe(repeatMode);
  });

  it.each(['shuffle', '', null, undefined, 5])('an unknown repeat mode (%p) becomes "off"', (repeatMode) => {
    stored({ repeatMode });
    expect(loadQueueState('user-1').repeatMode).toBe('off');
  });

  it('fills in everything else with safe defaults', () => {
    stored({});
    expect(loadQueueState('user-1')).toMatchObject({
      queueSource: null, isShuffled: false, autoplay: false, currentTime: 0,
    });
  });

  it.each([null, 'abc', undefined])('a bad position in the song (%p) becomes 0', (currentTime) => {
    stored({ currentTime });
    expect(loadQueueState('user-1').currentTime).toBe(0);
  });
});

// ===========================================================================
describe('queuePersistence — clearing', () => {
  it('clears one account\'s queue and leaves the others', () => {
    saveQueueState('user-1', STATE);
    saveQueueState('user-2', STATE);
    clearQueueState('user-1');
    expect(loadQueueState('user-1')).toBeNull();
    expect(loadQueueState('user-2')).not.toBeNull();
  });

  it('logout clears every saved queue, guest included, and nothing else', () => {
    saveQueueState('user-1', STATE);
    saveQueueState('user-2', STATE);
    saveQueueState(null, STATE);
    localStorage.setItem('token', 'abc');
    localStorage.setItem('unis_referral_code', '{"code":"HARLEM"}');

    clearAllQueueState();

    expect(loadQueueState('user-1')).toBeNull();
    expect(loadQueueState('user-2')).toBeNull();
    expect(loadQueueState(null)).toBeNull();
    expect(localStorage.getItem('token')).toBe('abc');
    expect(localStorage.getItem('unis_referral_code')).not.toBeNull();
  });

  it('clearing with nothing saved does not throw', () => {
    expect(() => clearQueueState('user-1')).not.toThrow();
    expect(() => clearAllQueueState()).not.toThrow();
  });

  it('blocked storage does not throw either', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => clearQueueState('user-1')).not.toThrow();
    expect(() => clearAllQueueState()).not.toThrow();
  });
});

describe('queuePersistence — exports', () => {
  it('the default export carries the same four functions', () => {
    expect(persistence).toEqual({ saveQueueState, loadQueueState, clearQueueState, clearAllQueueState });
  });
});
