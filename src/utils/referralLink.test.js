// src/utils/referralLink.test.js
//
// Referral links. A code arrives either as /join/HARLEM (posters, QR codes,
// ads) or as ?ref=CODE on any page. It is kept in this browser for 30 days and
// filled into the sign-up form so nobody has to type it. Whoever told someone
// about Unis gets the credit — so losing or mangling a code costs a real
// person their referral.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cleanReferral,
  storeReferral,
  captureReferral,
  getStoredReferral,
  joinLink,
} from './referralLink';

const KEY = 'unis_referral_code';
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('referralLink — cleaning a code', () => {
  it.each([
    ['harlem', 'HARLEM'],
    ['  Harlem-01  ', 'HARLEM-01'],
    ['har lem', 'HARLEM'],
    ['HARLEM!?#', 'HARLEM'],
    ['<script>alert(1)</script>', 'SCRIPTALERT1SCRIPT'],
    ['código', 'CDIGO'],
  ])('%p → %p', (raw, clean) => {
    expect(cleanReferral(raw)).toBe(clean);
  });

  it.each([null, undefined, ''])('%p → empty', (raw) => {
    expect(cleanReferral(raw)).toBe('');
  });

  it('caps a code at 64 characters', () => {
    expect(cleanReferral('A'.repeat(200))).toHaveLength(64);
  });
});

describe('referralLink — remembering a code', () => {
  it('stores the cleaned code with the time it arrived', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
    storeReferral(' harlem ');
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual({ code: 'HARLEM', at: Date.now() });
  });

  it('reads it back', () => {
    storeReferral('HARLEM');
    expect(getStoredReferral()).toBe('HARLEM');
  });

  it('a newer link replaces an older one', () => {
    storeReferral('HARLEM');
    storeReferral('UPTOWN');
    expect(getStoredReferral()).toBe('UPTOWN');
  });

  it.each(['', 'ab', '!!', null])('ignores %p — too short to be a code', (raw) => {
    storeReferral('HARLEM');
    storeReferral(raw);
    expect(getStoredReferral()).toBe('HARLEM');
  });

  it('keeps a code for 30 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    storeReferral('HARLEM');

    vi.setSystemTime(new Date(Date.now() + 30 * DAY));
    expect(getStoredReferral()).toBe('HARLEM');
  });

  it('forgets it after 30 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
    storeReferral('HARLEM');

    vi.setSystemTime(new Date(Date.now() + 30 * DAY + 1));
    expect(getStoredReferral()).toBe('');
  });

  it('returns empty when nothing is stored', () => {
    expect(getStoredReferral()).toBe('');
  });

  it('returns empty for a damaged entry instead of throwing', () => {
    localStorage.setItem(KEY, 'not json');
    expect(getStoredReferral()).toBe('');
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now() }));
    expect(getStoredReferral()).toBe('');
  });

  it('cleans a stored code again on the way out', () => {
    localStorage.setItem(KEY, JSON.stringify({ code: 'har<lem>', at: Date.now() }));
    expect(getStoredReferral()).toBe('HARLEM');
  });

  it('does not throw when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => storeReferral('HARLEM')).not.toThrow();
  });
});

describe('referralLink — ?ref= on any page', () => {
  it('captures the code from the address', () => {
    window.history.replaceState({}, '', '/artist/abc?ref=harlem');
    captureReferral();
    expect(getStoredReferral()).toBe('HARLEM');
  });

  it('finds it among other parameters', () => {
    window.history.replaceState({}, '', '/?utm_source=poster&ref=Uptown-7&x=1');
    captureReferral();
    expect(getStoredReferral()).toBe('UPTOWN-7');
  });

  it('leaves an earlier code alone when the address has none', () => {
    storeReferral('HARLEM');
    window.history.replaceState({}, '', '/feed?page=2');
    captureReferral();
    expect(getStoredReferral()).toBe('HARLEM');
  });

  it('an empty ?ref= does not wipe an earlier code', () => {
    storeReferral('HARLEM');
    window.history.replaceState({}, '', '/?ref=');
    captureReferral();
    expect(getStoredReferral()).toBe('HARLEM');
  });
});

describe('referralLink — the link to share or print', () => {
  it('builds /join/CODE on the given origin', () => {
    expect(joinLink('harlem', 'https://unismusic.com')).toBe('https://unismusic.com/join/HARLEM');
  });

  it('defaults to the current site', () => {
    expect(joinLink('HARLEM')).toBe(`${window.location.origin}/join/HARLEM`);
  });

  it('cleans the code first', () => {
    expect(joinLink(' up town/../x ', 'https://unismusic.com')).toBe('https://unismusic.com/join/UPTOWNX');
  });
});
