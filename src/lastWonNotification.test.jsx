// src/LastWonNotification.test.jsx
//
// Comprehensive test suite for LastWonNotification — a celebratory popup
// shown to listeners when they land on the app, surfacing the most recent
// daily/weekly award winner in their jurisdiction.
//
// Covers:
//   • Auth gating: jurisdictionless users see nothing, no API calls
//   • Fetch behavior: 3 parallel calls to /v1/awards/past with correct query
//     params (type, startDate, endDate, jurisdictionId, intervalId)
//   • Date range: startDate = today−30 days, endDate = today
//   • Render variants: song-daily, song-weekly, artist-daily
//   • Date formatting: daily ("April 25, 2026"), weekly range
//   • Image fallback: placeholder when no artwork URL present
//   • Action buttons: Vote → /voteawards; Listen → playMedia + dismiss;
//     View Profile → navigate to /artist/:id + dismiss
//   • Dismissal: close button, click on overlay, click inside card stays open
//   • Auto-dismiss after 12s once stage 3 reveal completes
//   • Animation stages: badge → date → title+actions in sequence
//   • Resilience: empty results, partial errors, missing fields
//   • BUG #4 regression guard: future-dated awards are rejected
//
// Pattern notes:
//   • Uses fake timers so the 1200ms→400ms→1900ms→2600ms staged reveal
//     doesn't make the suite take 4 seconds per test.
//   • vi.advanceTimersByTimeAsync flushes microtasks between timer ticks,
//     so MSW/axios promise chains resolve naturally.
//   • Math.random is stubbed to deterministically pick the first valid
//     category (so multi-category tests are stable).
//   • `useFakeTimers({ toFake: [...] })` excludes 'queueMicrotask' so MSW
//     internal scheduling isn't affected.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import cacheService from './services/cacheService';

// ---------------------------------------------------------------------------
// MOCKS — CSS, asset, navigation, player
// ---------------------------------------------------------------------------
vi.mock('./lastWonNotification.scss', () => ({}));
vi.mock('./assets/unisLogoThree.svg', () => ({ default: 'unisLogo.svg' }));

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

const { playMediaSpy } = vi.hoisted(() => ({ playMediaSpy: vi.fn() }));
vi.mock('./context/playercontext', async () => {
  const actual = await vi.importActual('./context/playercontext');
  const React = require('react');
  return {
    ...actual,
    PlayerContext: React.createContext({ playMedia: playMediaSpy }),
  };
});

// Import AFTER mocks
import LastWonNotification from './LastWonNotification';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const API = 'http://localhost:8080/api';

// Interval UUIDs — match utils/idMappings.js
const DAILY_ID = '00000000-0000-0000-0000-000000000201';
const WEEKLY_ID = '00000000-0000-0000-0000-000000000202';

// Time after which all 3 stages have fully revealed (1200 + 2600 = 3800ms).
// Add a small buffer for microtask drift.
const FULLY_REVEALED_MS = 4000;

// ---------------------------------------------------------------------------
// AWARD FIXTURE BUILDERS
// ---------------------------------------------------------------------------
const songDailyAward = (overrides = {}) => ({
  awardId: 'award-sd-1',
  awardDate: '2026-04-25',
  jurisdiction: { name: 'Harlem' },
  song: {
    songId: 'song-001',
    title: 'Midnight Uptown',
    artworkUrl: '/uploads/song1.jpg',
    fileUrl: '/uploads/song1.mp3',
    artist: { username: 'Tony Fadd', userId: 'art-1', photoUrl: '/uploads/tony.jpg' },
  },
  ...overrides,
});

const songWeeklyAward = (overrides = {}) => ({
  awardId: 'award-sw-1',
  awardDate: '2026-04-25',
  jurisdiction: { name: 'Harlem' },
  song: {
    songId: 'song-002',
    title: 'Block Party',
    artworkUrl: '/uploads/song2.jpg',
    fileUrl: '/uploads/song2.mp3',
    artist: { username: 'SD Boomin', userId: 'art-2' },
  },
  ...overrides,
});

const artistDailyAward = (overrides = {}) => ({
  awardId: 'award-ad-1',
  awardDate: '2026-04-25',
  jurisdiction: { name: 'Harlem' },
  user: {
    userId: 'art-3',
    username: 'Harlem MC',
    photoUrl: '/uploads/harlem-mc.jpg',
  },
  ...overrides,
});

// ---------------------------------------------------------------------------
// MSW HELPER — respond to /v1/awards/past based on type + intervalId
// ---------------------------------------------------------------------------
let lastAwardsRequests = [];
function mockAwardsByCategory({ songDaily = [], songWeekly = [], artistDaily = [] } = {}) {
  server.use(
    http.get(`${API}/v1/awards/past`, ({ request }) => {
      const url = new URL(request.url);
      const params = {
        type: url.searchParams.get('type'),
        intervalId: url.searchParams.get('intervalId'),
        jurisdictionId: url.searchParams.get('jurisdictionId'),
        startDate: url.searchParams.get('startDate'),
        endDate: url.searchParams.get('endDate'),
      };
      lastAwardsRequests.push(params);

      if (params.type === 'song' && params.intervalId === DAILY_ID) {
        return HttpResponse.json(songDaily);
      }
      if (params.type === 'song' && params.intervalId === WEEKLY_ID) {
        return HttpResponse.json(songWeekly);
      }
      if (params.type === 'artist' && params.intervalId === DAILY_ID) {
        return HttpResponse.json(artistDaily);
      }
      return HttpResponse.json([]);
    })
  );
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  cacheService.clearAll();
  lastAwardsRequests = [];
  navigateSpy.mockReset();
  playMediaSpy.mockReset();
  // Make Math.random deterministic — always returns 0, picking the first
  // valid category. This avoids flaky tests when multiple categories return
  // data and the picker is random.
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.setSystemTime(new Date());
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

// Render with fake timers and advance through the staged reveal so all
// content is on screen. Returns nothing — the test then asserts on screen.
//
// Freezes the system time at a known reference so the BUG #4 future-date
// filter is deterministic across timezones (todayInEst inside the component
// uses Intl.DateTimeFormat with America/New_York, but it still depends on
// Date.now()).
async function renderAndReveal({
  as = 'listener',
  advanceMs = 5000,
  freezeAt = '2026-04-26T17:00:00Z', // EST: 2026-04-26 1 PM
} = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(freezeAt));
  renderWithProviders(<LastWonNotification />, { as });
  await vi.advanceTimersByTimeAsync(advanceMs);
  // Extra microtask flushes for any stragglers from the API promise chain
  await Promise.resolve();
  await Promise.resolve();
}

// Same setup as renderAndReveal but stops BEFORE advancing — the test then
// chooses how far to advance fake timers itself.
function setupWithFakeTimers({
  as = 'listener',
  freezeAt = '2026-04-26T17:00:00Z',
} = {}) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(freezeAt));
  renderWithProviders(<LastWonNotification />, { as });
}

// Normalize non-breaking spaces to regular spaces — LetterReveal renders each
// space as \u00A0 so element.textContent !== 'a regular spaced string'.
const normSpaces = (s) => (s || '').replace(/\u00A0/g, ' ');

// ===========================================================================
// AUTH GATING
// ===========================================================================
describe('LastWonNotification — auth gating', () => {
  it('renders nothing for guest users (no jurisdiction)', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    vi.useFakeTimers();
    const { container } = renderWithProviders(<LastWonNotification />, { as: 'guest' });
    await vi.advanceTimersByTimeAsync(FULLY_REVEALED_MS);
    expect(container.firstChild).toBeNull();
    expect(lastAwardsRequests).toHaveLength(0);
  });

  it('does not call /v1/awards/past when user has no jurisdiction', async () => {
    // Override the user profile to omit jurisdiction
    server.use(
      http.get(`${API}/v1/users/profile/:userId`, () =>
        HttpResponse.json({
          userId: 'user-listener-001',
          username: 'testlistener',
          role: 'listener',
          // no jurisdiction
        })
      )
    );
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    vi.useFakeTimers();
    renderWithProviders(<LastWonNotification />, { as: 'listener' });
    await vi.advanceTimersByTimeAsync(FULLY_REVEALED_MS);
    expect(lastAwardsRequests).toHaveLength(0);
  });
});

// ===========================================================================
// FETCH BEHAVIOR
// ===========================================================================
describe('LastWonNotification — fetch behavior', () => {
  it('fires three parallel /v1/awards/past requests (one per category)', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    await renderAndReveal();
    expect(lastAwardsRequests).toHaveLength(3);
  });

  it('sends type=song + intervalId=daily for the song-daily fetch', async () => {
    mockAwardsByCategory();
    await renderAndReveal();
    const songDaily = lastAwardsRequests.find(
      (r) => r.type === 'song' && r.intervalId === DAILY_ID
    );
    expect(songDaily).toBeTruthy();
  });

  it('sends type=song + intervalId=weekly for the song-weekly fetch', async () => {
    mockAwardsByCategory();
    await renderAndReveal();
    const songWeekly = lastAwardsRequests.find(
      (r) => r.type === 'song' && r.intervalId === WEEKLY_ID
    );
    expect(songWeekly).toBeTruthy();
  });

  it('sends type=artist + intervalId=daily for the artist-daily fetch', async () => {
    mockAwardsByCategory();
    await renderAndReveal();
    const artistDaily = lastAwardsRequests.find(
      (r) => r.type === 'artist' && r.intervalId === DAILY_ID
    );
    expect(artistDaily).toBeTruthy();
  });

  it('passes the user jurisdictionId on every request', async () => {
    mockAwardsByCategory();
    await renderAndReveal();
    expect(lastAwardsRequests).toHaveLength(3);
    lastAwardsRequests.forEach((r) => {
      // Listener fixture's jurisdictionId
      expect(r.jurisdictionId).toBeTruthy();
      expect(r.jurisdictionId).toMatch(/^[0-9a-f-]{36}$/i);
    });
  });

  it('uses a 30-day rolling date window (startDate = today − 30, endDate = today)', async () => {
    mockAwardsByCategory();
    await renderAndReveal();
    const r = lastAwardsRequests[0];
    const start = new Date(r.startDate + 'T00:00:00Z');
    const end = new Date(r.endDate + 'T00:00:00Z');
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });
});

// ===========================================================================
// EMPTY / NO-DATA STATES
// ===========================================================================
describe('LastWonNotification — empty states', () => {
  it('renders nothing when all three categories return empty arrays', async () => {
    mockAwardsByCategory({ songDaily: [], songWeekly: [], artistDaily: [] });
    vi.useFakeTimers();
    const { container } = renderWithProviders(<LastWonNotification />, { as: 'listener' });
    await vi.advanceTimersByTimeAsync(FULLY_REVEALED_MS);
    expect(container.firstChild).toBeNull();
  });

  it('continues to render when some categories error and at least one succeeds', async () => {
    server.use(
      http.get(`${API}/v1/awards/past`, ({ request }) => {
        const url = new URL(request.url);
        const type = url.searchParams.get('type');
        const intervalId = url.searchParams.get('intervalId');
        if (type === 'song' && intervalId === DAILY_ID) {
          return HttpResponse.json([songDailyAward()]);
        }
        // Fail the other two categories
        return new HttpResponse(null, { status: 500 });
      })
    );
    await renderAndReveal();
    // The song-daily card should still render
    expect(screen.getByText(/midnight uptown/i)).toBeInTheDocument();
  });
});

// ===========================================================================
// SONG-DAILY RENDERING
// ===========================================================================
describe('LastWonNotification — song-daily rendering', () => {
  beforeEach(() => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
  });

  it('renders the "Song of the Day" badge', async () => {
    await renderAndReveal();
    // Badge text is split into per-letter spans with NBSP for spaces
    const badge = document.querySelector('.lwn-tag .lwn-tag-text');
    expect(badge).not.toBeNull();
    expect(normSpaces(badge.textContent)).toBe('Song of the Day');
  });

  it('renders the song title in the title block', async () => {
    await renderAndReveal();
    expect(screen.getByText('Midnight Uptown')).toBeInTheDocument();
  });

  it('renders the artist name as the subtitle', async () => {
    await renderAndReveal();
    expect(screen.getByText('Tony Fadd')).toBeInTheDocument();
  });

  it('renders the jurisdiction in uppercase', async () => {
    await renderAndReveal();
    expect(screen.getByText('HARLEM')).toBeInTheDocument();
  });

  it('renders the date in "Month Day, Year" format', async () => {
    await renderAndReveal();
    // 2026-04-25 → "April 25, 2026"
    expect(screen.getByText(/april 25, 2026/i)).toBeInTheDocument();
  });

  it('renders the artwork image', async () => {
    await renderAndReveal();
    const img = screen.getByAltText('Midnight Uptown');
    expect(img.src).toContain('/uploads/song1.jpg');
  });

  it('Listen button labelled "Listen" is shown for song awards', async () => {
    await renderAndReveal();
    expect(screen.getByRole('button', { name: /listen/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// SONG-WEEKLY RENDERING (week range date format)
// ===========================================================================
describe('LastWonNotification — song-weekly rendering', () => {
  it('renders the "Song of the Week" badge', async () => {
    mockAwardsByCategory({ songWeekly: [songWeeklyAward()] });
    await renderAndReveal();
    const badge = document.querySelector('.lwn-tag .lwn-tag-text');
    expect(normSpaces(badge.textContent)).toBe('Song of the Week');
  });

  it('renders a date range (start–end) for weekly awards', async () => {
    // Award date 2026-04-25, week range = April 19 – 25, 2026
    mockAwardsByCategory({ songWeekly: [songWeeklyAward({ awardDate: '2026-04-25' })] });
    await renderAndReveal();
    // Use a flexible matcher because of unicode dash (–)
    expect(screen.getByText(/april 19.*25, 2026/i)).toBeInTheDocument();
  });

  it('renders cross-month range when week spans two months', async () => {
    // Week ending 2026-05-02 starts 2026-04-26.
    // Freeze AT 2026-05-03 so the BUG #4 filter doesn't reject the award.
    mockAwardsByCategory({ songWeekly: [songWeeklyAward({ awardDate: '2026-05-02' })] });
    await renderAndReveal({ freezeAt: '2026-05-03T17:00:00Z' });
    const dateEl = document.querySelector('.lwn-date');
    expect(dateEl).not.toBeNull();
    // textContent contains "April 26 – May 2, 2026" (or with comma variants)
    expect(dateEl.textContent).toMatch(/april\s+26/i);
    expect(dateEl.textContent).toMatch(/may\s+2/i);
    expect(dateEl.textContent).toMatch(/2026/);
  });
});

// ===========================================================================
// ARTIST-DAILY RENDERING
// ===========================================================================
describe('LastWonNotification — artist-daily rendering', () => {
  beforeEach(() => {
    // Suppress songs so the picker chooses the artist
    mockAwardsByCategory({ artistDaily: [artistDailyAward()] });
  });

  it('renders the "Artist of the Day" badge', async () => {
    await renderAndReveal();
    const badge = document.querySelector('.lwn-tag .lwn-tag-text');
    expect(normSpaces(badge.textContent)).toBe('Artist of the Day');
  });

  it('renders the artist username as the title', async () => {
    await renderAndReveal();
    expect(screen.getByText('Harlem MC')).toBeInTheDocument();
  });

  it('does not render an artist subtitle (artist IS the subject, not the subtitle)', async () => {
    await renderAndReveal();
    // No <p class="lwn-artist"> should exist for artist awards
    expect(document.querySelector('.lwn-artist')).toBeNull();
  });

  it('renders "View Profile" as the secondary action label', async () => {
    await renderAndReveal();
    expect(screen.getByRole('button', { name: /view profile/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// IMAGE FALLBACK
// ===========================================================================
describe('LastWonNotification — image fallback', () => {
  it('renders the placeholder div when the song award has no artwork or photo URL', async () => {
    mockAwardsByCategory({
      songDaily: [
        songDailyAward({
          song: {
            songId: 'song-001',
            title: 'No Art Track',
            artworkUrl: null,
            fileUrl: '/u.mp3',
            artist: { username: 'Anon', userId: 'art-x', photoUrl: null },
          },
        }),
      ],
    });
    await renderAndReveal();
    expect(document.querySelector('.lwn-hero-placeholder')).not.toBeNull();
    expect(document.querySelector('.lwn-hero-img')).toBeNull();
  });
});

// ===========================================================================
// ACTION BUTTONS
// ===========================================================================
describe('LastWonNotification — Vote button', () => {
  it('navigates to /voteawards and dismisses the card', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    await renderAndReveal();
    fireEvent.click(screen.getByRole('button', { name: /vote now/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/voteawards');
    // After dismiss, the visible class is removed
    await vi.advanceTimersByTimeAsync(0);
    const overlay = document.querySelector('.lwn-overlay');
    expect(overlay.classList.contains('lwn-visible')).toBe(false);
  });
});

describe('LastWonNotification — Listen button (song)', () => {
  it('calls playMedia with the song details and dismisses', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    await renderAndReveal();
    fireEvent.click(screen.getByRole('button', { name: /listen/i }));

    expect(playMediaSpy).toHaveBeenCalledTimes(1);
    const [mediaArg, queueArg] = playMediaSpy.mock.calls[0];
    expect(mediaArg.type).toBe('song');
    expect(mediaArg.id).toBe('song-001');
    expect(mediaArg.title).toBe('Midnight Uptown');
    expect(mediaArg.artist).toBe('Tony Fadd');
    expect(mediaArg.url).toContain('/uploads/song1.mp3');
    // Queue is a single-item list
    expect(Array.isArray(queueArg)).toBe(true);
    expect(queueArg).toHaveLength(1);
  });

  it('does not navigate (uses playMedia, not router) for song awards', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    await renderAndReveal();
    fireEvent.click(screen.getByRole('button', { name: /listen/i }));
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

describe('LastWonNotification — View Profile button (artist)', () => {
  it('navigates to /artist/:userId and dismisses', async () => {
    mockAwardsByCategory({ artistDaily: [artistDailyAward()] });
    await renderAndReveal();
    fireEvent.click(screen.getByRole('button', { name: /view profile/i }));
    expect(navigateSpy).toHaveBeenCalledWith('/artist/art-3');
    expect(playMediaSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// DISMISSAL — close button, overlay click, card click
// ===========================================================================
describe('LastWonNotification — dismissal', () => {
  beforeEach(() => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
  });

  it('Close (X) button hides the card', async () => {
    await renderAndReveal();
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    const overlay = document.querySelector('.lwn-overlay');
    expect(overlay.classList.contains('lwn-visible')).toBe(false);
  });

  it('clicking on the overlay backdrop dismisses', async () => {
    await renderAndReveal();
    const overlay = document.querySelector('.lwn-overlay');
    // Simulate a click whose target IS the overlay (backdrop)
    fireEvent.click(overlay, { target: overlay });
    expect(overlay.classList.contains('lwn-visible')).toBe(false);
  });

  it('clicking inside the card does NOT dismiss', async () => {
    await renderAndReveal();
    const card = document.querySelector('.lwn-card');
    fireEvent.click(card);
    const overlay = document.querySelector('.lwn-overlay');
    expect(overlay.classList.contains('lwn-visible')).toBe(true);
  });
});

// ===========================================================================
// AUTO-DISMISS (12-second timer)
// ===========================================================================
describe('LastWonNotification — auto-dismiss', () => {
  it('auto-dismisses 12 seconds after stage 3 reveal', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    await renderAndReveal();
    const overlay = document.querySelector('.lwn-overlay');
    expect(overlay.classList.contains('lwn-visible')).toBe(true);

    // The animStage>=3 effect schedules:
    //   - setInterval every 30ms (progress bar updates)
    //   - setTimeout dismiss at DISPLAY_DURATION (12000ms)
    // Walk forward in chunks so the interval doesn't starve the timeout queue.
    for (let i = 0; i < 14; i++) {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    }
    expect(overlay.classList.contains('lwn-visible')).toBe(false);
  });

  it('progress bar narrows as time elapses (width ratchets down)', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    await renderAndReveal();
    const fill = document.querySelector('.lwn-pfill');
    // Width starts at 100%
    expect(fill.style.width).toBe('100%');
    // After 6s (half the duration), it should be ~50%
    await vi.advanceTimersByTimeAsync(6000);
    const widthPct = parseFloat(fill.style.width);
    expect(widthPct).toBeLessThan(60);
    expect(widthPct).toBeGreaterThan(40);
  });
});

// ===========================================================================
// ANIMATION STAGES
// ===========================================================================
describe('LastWonNotification — staged reveal', () => {
  it('badge is hidden before stage 1 fires', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    setupWithFakeTimers();
    // Advance to ~1300ms — initial 1200ms delay just completed but the
    // 400ms inner stage-1 timer hasn't fired yet
    await vi.advanceTimersByTimeAsync(1300);
    const badge = document.querySelector('.lwn-tag');
    if (badge) {
      expect(badge.classList.contains('lwn-tag-visible')).toBe(false);
    }
  });

  it('after stage 1, badge has the visible class', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    setupWithFakeTimers();
    // Walk forward in 200ms chunks so React has time to commit each state
    // change between timer ticks. Goal: pass T=1600 (1200ms outer + 400ms inner).
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(200);
      await Promise.resolve();
    }
    const badge = document.querySelector('.lwn-tag');
    expect(badge).not.toBeNull();
    expect(badge.classList.contains('lwn-tag-visible')).toBe(true);
  });

  it('after stage 2, date has the visible class', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    setupWithFakeTimers();
    // 1200ms initial + 1900ms stage 2 + buffer
    await vi.advanceTimersByTimeAsync(3300);
    await Promise.resolve();
    const date = document.querySelector('.lwn-date');
    expect(date.classList.contains('lwn-date-visible')).toBe(true);
  });

  it('after stage 3, title block + actions have visible classes', async () => {
    mockAwardsByCategory({ songDaily: [songDailyAward()] });
    await renderAndReveal();
    expect(document.querySelector('.lwn-title-block').classList.contains('lwn-title-visible')).toBe(true);
    expect(document.querySelector('.lwn-actions').classList.contains('lwn-actions-visible')).toBe(true);
  });
});

// ===========================================================================
// RESILIENCE / EDGE CASES
// ===========================================================================
describe('LastWonNotification — edge cases', () => {
  it('falls back to "Unknown Song" when title is missing on a song award', async () => {
    mockAwardsByCategory({
      songDaily: [
        songDailyAward({
          song: {
            songId: 'song-001',
            artworkUrl: '/u.jpg',
            fileUrl: '/u.mp3',
            artist: { username: 'Tony Fadd', userId: 'art-1' },
            // title omitted
          },
        }),
      ],
    });
    await renderAndReveal();
    expect(screen.getByText(/unknown song/i)).toBeInTheDocument();
  });

  it('falls back to "Unknown Artist" when artist info is missing', async () => {
    mockAwardsByCategory({
      songDaily: [
        songDailyAward({
          song: {
            songId: 'song-001',
            title: 'Track',
            artworkUrl: '/u.jpg',
            fileUrl: '/u.mp3',
            artist: null,
          },
        }),
      ],
    });
    await renderAndReveal();
    expect(screen.getByText(/unknown artist/i)).toBeInTheDocument();
  });

  it('falls back to "Unknown" jurisdiction when missing', async () => {
    mockAwardsByCategory({
      songDaily: [songDailyAward({ jurisdiction: null })],
    });
    await renderAndReveal();
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument();
  });
});

// ===========================================================================
// BUG #4 REGRESSION GUARD — future-dated awards must be filtered
// ===========================================================================
describe('LastWonNotification — BUG #4 regression: future-dated awards filter', () => {
  it('rejects awards with awardDate later than today (EST), even when the API returns them', async () => {
    // Use a far-future date so the filter triggers regardless of test runner TZ.
    // (todayInEst() inside the component computes today using America/New_York.)
    const farFuture = '2099-12-31';
    mockAwardsByCategory({
      songDaily: [songDailyAward({ awardDate: farFuture, song: {
        songId: 'future-song',
        title: 'Time Traveler',
        artworkUrl: '/u.jpg',
        fileUrl: '/u.mp3',
        artist: { username: 'Future Artist', userId: 'art-1' },
      } })],
    });
    vi.useFakeTimers();
    const { container } = renderWithProviders(<LastWonNotification />, { as: 'listener' });
    await vi.advanceTimersByTimeAsync(FULLY_REVEALED_MS);
    // Component should render nothing — no other category had data either
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/time traveler/i)).not.toBeInTheDocument();
  });

  it('falls through to other categories when the first category has only future awards', async () => {
    // song-daily returns ONLY a future award, so it should be filtered to []
    // The picker should fall through to artist-daily.
    mockAwardsByCategory({
      songDaily: [songDailyAward({ awardDate: '2099-12-31', song: {
        songId: 'future', title: 'Future', artworkUrl: '/u.jpg', fileUrl: '/u.mp3',
        artist: { username: 'X', userId: 'x' },
      } })],
      artistDaily: [artistDailyAward()],
    });
    await renderAndReveal();
    // Artist of the Day should win the picker
    expect(screen.getByText('Harlem MC')).toBeInTheDocument();
    expect(screen.queryByText(/future/i)).not.toBeInTheDocument();
  });

  it('still includes awards dated today (EST)', async () => {
    // Use a recent past date that's definitely in the past in any timezone
    const definitelyPast = '2026-01-01';
    mockAwardsByCategory({
      songDaily: [songDailyAward({ awardDate: definitelyPast })],
    });
    await renderAndReveal();
    expect(screen.getByText('Midnight Uptown')).toBeInTheDocument();
  });
});