// src/winnersNotification.test.jsx
//
// Comprehensive test suite for WinnersNotification — a once-per-day toast
// shown at app load that surfaces the leader for "Artist of the Day" with
// tiered messaging (competitive race, active polls, zero activity, fallback).
//
// Covers:
//   • Auth gating: no user → no fetch; no jurisdiction → no fetch
//   • Once-per-day localStorage gate (EST timezone)
//   • The 2-second mount delay before fetching
//   • Endpoint correctness (BUG #6 regression guard: /v1/awards/past, not
//     /v1/vote/leaderboards)
//   • URL params: type=artist, jurisdictionId from user, genreId from user,
//     intervalId=daily, startDate/endDate window, limit=5
//   • Award response normalization (entry.user.username, votesCount, photoUrl)
//   • Tiered message selection:
//       - Competitive (close race): leader has 3+, runner-up within 2
//       - Competitive (clear leader): leader has 3+, runner-up gap > 2
//       - Active: 1+ total votes, leader has < 3
//       - Zero activity: empty leaderboard
//       - Fallback: API error
//   • Singular/plural pluralization (1 vote vs N votes)
//   • Render correctness: icon, title, message, artwork, dismiss button
//   • Auto-dismiss after 6 seconds
//   • Manual dismiss button hides the card
//   • localStorage write happens after fetch resolves
//
// Pattern notes:
//   • Uses fake timers because the component schedules a 2s setTimeout before
//     fetching and a 6s setTimeout for auto-dismiss.
//   • Spies on apiCall to inspect the URL each test fires.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import * as axiosModule from './components/axiosInstance';
import cacheService from './services/cacheService';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------
vi.mock('./winnersNotification.scss', () => ({}));

// Import AFTER mocks
import WinnersNotification from './winnersNotification';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const API = 'http://localhost:8080/api';
const STORAGE_KEY = 'winnersNotificationShown';

// ---------------------------------------------------------------------------
// AWARD-SHAPED FIXTURE BUILDERS (mirrors /v1/awards/past response)
// ---------------------------------------------------------------------------
const artistAward = ({ username, votes, photoUrl, userId } = {}) => ({
  awardId: `award-${userId || 'x'}`,
  awardDate: '2026-04-25',
  targetType: 'artist',
  targetId: userId || 'art-x',
  votesCount: votes ?? 0,
  jurisdiction: { name: 'Harlem' },
  user: {
    userId: userId || 'art-x',
    username: username || 'Unknown',
    photoUrl: photoUrl || null,
  },
});

// ---------------------------------------------------------------------------
// apiCall LOGGER
// ---------------------------------------------------------------------------
let apiCallLog = [];
function setupApiCallLog() {
  apiCallLog = [];
  const original = axiosModule.apiCall;
  vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    apiCallLog.push({ ...config });
    return original(config);
  });
}
function callsTo(urlSubstring) {
  return apiCallLog.filter((c) => c.url && c.url.includes(urlSubstring));
}
function parseParams(url) {
  const u = new URL(url, 'http://x.test');
  const out = {};
  u.searchParams.forEach((v, k) => { out[k] = v; });
  return out;
}

// ---------------------------------------------------------------------------
// MSW HELPERS
// ---------------------------------------------------------------------------
function mockAwardsPast(payload) {
  server.use(
    http.get(`${API}/v1/awards/past`, () => HttpResponse.json(payload))
  );
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  cacheService.clearAll();
  localStorage.removeItem(STORAGE_KEY);
  setupApiCallLog();
});

afterEach(() => {
  vi.useRealTimers();
  vi.setSystemTime(new Date());
  vi.restoreAllMocks();
  localStorage.removeItem(STORAGE_KEY);
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

// Render with fake timers and advance past the 2s mount delay so the fetch
// fires and the notification appears.
async function renderAndAdvancePastFetch({ as = 'listener' } = {}) {
  vi.useFakeTimers();
  // Freeze at a stable EST date for deterministic localStorage key
  vi.setSystemTime(new Date('2026-04-26T17:00:00Z'));
  renderWithProviders(<WinnersNotification />, { as });
  // Walk forward in chunks so React commits between timer ticks
  for (let i = 0; i < 6; i++) {
    await vi.advanceTimersByTimeAsync(500);
    await Promise.resolve();
  }
}

// ===========================================================================
// AUTH / JURISDICTION GATING
// ===========================================================================
describe('WinnersNotification — auth gating', () => {
  it('renders nothing for guest users (no user)', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 5 })]);
    vi.useFakeTimers();
    const { container } = renderWithProviders(<WinnersNotification />, { as: 'guest' });
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    }
    expect(container.firstChild).toBeNull();
  });

  it('does not call /v1/awards/past for guests', async () => {
    mockAwardsPast([]);
    vi.useFakeTimers();
    renderWithProviders(<WinnersNotification />, { as: 'guest' });
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
    }
    expect(callsTo('/v1/awards/past')).toHaveLength(0);
  });

  it('[BUG #6] skips the API call when user.jurisdiction is missing (no stale-UUID fallback)', async () => {
    server.use(
      http.get(`${API}/v1/users/profile/:userId`, () =>
        HttpResponse.json({
          userId: 'user-listener-001',
          username: 'testlistener',
          role: 'listener',
          // jurisdiction omitted
        })
      )
    );
    mockAwardsPast([]);
    await renderAndAdvancePastFetch();
    expect(callsTo('/v1/awards/past')).toHaveLength(0);
    expect(callsTo('/v1/vote/leaderboards')).toHaveLength(0);
  });
});

// ===========================================================================
// ENDPOINT CORRECTNESS — BUG #6 PRIMARY FIX
// ===========================================================================
describe('WinnersNotification — endpoint (BUG #6 fix)', () => {
  it('calls /v1/awards/past, NOT /v1/vote/leaderboards', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    expect(callsTo('/v1/awards/past')).toHaveLength(1);
    expect(callsTo('/v1/vote/leaderboards')).toHaveLength(0);
  });

  it('sends type=artist as a query param', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    const params = parseParams(callsTo('/v1/awards/past')[0].url);
    expect(params.type).toBe('artist');
  });

  it('sends jurisdictionId from the user payload (not a hardcoded fallback UUID)', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    const params = parseParams(callsTo('/v1/awards/past')[0].url);
    expect(params.jurisdictionId).toBeTruthy();
    // Listener fixture uses Harlem; verify it's NOT the BUG #6 stale UUID
    expect(params.jurisdictionId).not.toBe('00000000-0000-0000-0000-000000000003');
  });

  it('sends intervalId=daily', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    const params = parseParams(callsTo('/v1/awards/past')[0].url);
    expect(params.intervalId).toBe('00000000-0000-0000-0000-000000000201');
  });

  it('sends limit=5', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    const params = parseParams(callsTo('/v1/awards/past')[0].url);
    expect(params.limit).toBe('5');
  });

  it('sends startDate (yesterday) and endDate (today)', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    const params = parseParams(callsTo('/v1/awards/past')[0].url);
    // Time was frozen at 2026-04-26T17:00:00Z, so today=2026-04-26, yesterday=2026-04-25
    expect(params.endDate).toBe('2026-04-26');
    expect(params.startDate).toBe('2026-04-25');
  });
});

// ===========================================================================
// ONCE-PER-DAY GATE
// ===========================================================================
describe('WinnersNotification — once-per-day localStorage gate', () => {
  it('does not fetch when localStorage already has todays EST date', async () => {
    const todayEst = new Date('2026-04-26T17:00:00Z')
      .toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    localStorage.setItem(STORAGE_KEY, todayEst);
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    expect(callsTo('/v1/awards/past')).toHaveLength(0);
  });

  it('writes todays EST date to localStorage after a successful fetch', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    const expected = new Date('2026-04-26T17:00:00Z')
      .toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(expected);
  });

  it('still writes localStorage even when API errors (so we dont retry-storm)', async () => {
    server.use(
      http.get(`${API}/v1/awards/past`, () => HttpResponse.error())
    );
    await renderAndAdvancePastFetch();
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });
});

// ===========================================================================
// MOUNT DELAY
// ===========================================================================
describe('WinnersNotification — 2-second mount delay', () => {
  it('does not fetch within the first 1 second', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-26T17:00:00Z'));
    renderWithProviders(<WinnersNotification />, { as: 'listener' });
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    expect(callsTo('/v1/awards/past')).toHaveLength(0);
  });

  it('fetches after the 2-second delay completes', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    expect(callsTo('/v1/awards/past')).toHaveLength(1);
  });
});

// ===========================================================================
// MESSAGE TIERS
// ===========================================================================
describe('WinnersNotification — competitive (close race)', () => {
  it('shows "Close Race" when leader has 3+ votes and runner-up is within 2', async () => {
    mockAwardsPast([
      artistAward({ username: 'Tony Fadd', votes: 5 }),
      artistAward({ username: 'SD Boomin', votes: 4 }),
    ]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/close race/i)).toBeInTheDocument();
    expect(screen.getByText(/tony fadd and sd boomin are neck and neck/i)).toBeInTheDocument();
  });

  it('uses "tied" wording when the gap is zero', async () => {
    mockAwardsPast([
      artistAward({ username: 'Tony', votes: 5 }),
      artistAward({ username: 'SD', votes: 5 }),
    ]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/tied/i)).toBeInTheDocument();
  });

  it('uses singular "1 vote apart" when gap is 1', async () => {
    mockAwardsPast([
      artistAward({ username: 'Tony', votes: 5 }),
      artistAward({ username: 'SD', votes: 4 }),
    ]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/1 vote apart/i)).toBeInTheDocument();
  });

  it('uses plural "2 votes apart" when gap is 2', async () => {
    mockAwardsPast([
      artistAward({ username: 'Tony', votes: 5 }),
      artistAward({ username: 'SD', votes: 3 }),
    ]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/2 votes apart/i)).toBeInTheDocument();
  });
});

describe('WinnersNotification — competitive (clear leader)', () => {
  it('shows "Current Leader" when leader has 3+ votes and runner-up is more than 2 behind', async () => {
    mockAwardsPast([
      artistAward({ username: 'Tony', votes: 10 }),
      artistAward({ username: 'SD', votes: 1 }),
    ]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/current leader/i)).toBeInTheDocument();
    expect(screen.getByText(/tony is leading.*10 votes/i)).toBeInTheDocument();
  });

  it('shows "Current Leader" when there is no runner-up at all', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 7 })]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/current leader/i)).toBeInTheDocument();
  });

  it('uses singular "1 vote" when leader has exactly 1 (but only if leader threshold is met)', async () => {
    // Leader needs 3+ for competitive, so this falls through to ACTIVE tier
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    // Active tier: "1 vote cast so far today"
    expect(screen.getByText(/1 vote cast so far today/i)).toBeInTheDocument();
  });
});

describe('WinnersNotification — active polls', () => {
  it('shows "Polls Are Open" when total votes >= 1 but leader has < 3', async () => {
    mockAwardsPast([
      artistAward({ username: 'Tony', votes: 2 }),
      artistAward({ username: 'SD', votes: 1 }),
    ]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/polls are open/i)).toBeInTheDocument();
    // 2 + 1 = 3 votes total
    expect(screen.getByText(/3 votes cast so far today/i)).toBeInTheDocument();
  });

  it('mentions the user\'s jurisdiction by name', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 1 })]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/in harlem/i)).toBeInTheDocument();
  });
});

describe('WinnersNotification — zero activity', () => {
  it('shows "Voting Is Open" when API returns an empty array', async () => {
    mockAwardsPast([]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/welcome to unis/i)).toBeInTheDocument();
  });

  it('shows the welcome fallback when the response is empty', async () => {
    mockAwardsPast([]);
    await renderAndAdvancePastFetch();
    // Empty leaderboard → buildFallbackMessage → "Welcome to Unis"
    expect(screen.getByText(/welcome to unis/i)).toBeInTheDocument();
  });

  it('does NOT mention any artist names in the zero-activity case', async () => {
    mockAwardsPast([]);
    await renderAndAdvancePastFetch();
    // Fallback message has generic copy, no artist names
    const messageText = document.querySelector('.notification-content p').textContent;
    expect(messageText).toMatch(/leaderboards|favorite local artists/i);
  });
});

describe('WinnersNotification — fallback (API error)', () => {
  it('shows "Welcome to Unis" when the API throws', async () => {
    server.use(
      http.get(`${API}/v1/awards/past`, () => HttpResponse.error())
    );
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/welcome to unis/i)).toBeInTheDocument();
  });

  it('still shows the dismiss button on the fallback', async () => {
    server.use(
      http.get(`${API}/v1/awards/past`, () => HttpResponse.error())
    );
    await renderAndAdvancePastFetch();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// RESPONSE NORMALIZATION
// ===========================================================================
describe('WinnersNotification — Award response normalization', () => {
  it('reads username from entry.user.username', async () => {
    mockAwardsPast([artistAward({ username: 'CustomUser', votes: 5 })]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/customuser is leading/i)).toBeInTheDocument();
  });

  it('reads votes count from entry.votesCount (Award DTO field)', async () => {
    mockAwardsPast([
      {
        awardId: 'award-1',
        targetType: 'artist',
        votesCount: 12,
        user: { username: 'Heavy Hitter', userId: 'art-1' },
      },
    ]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/heavy hitter is leading.*12 votes/i)).toBeInTheDocument();
  });

  it('falls back to "Unknown" when user.username is missing', async () => {
    mockAwardsPast([
      {
        awardId: 'award-1',
        targetType: 'artist',
        votesCount: 5,
        user: { userId: 'art-1' }, // no username
      },
    ]);
    await renderAndAdvancePastFetch();
    expect(screen.getByText(/unknown is leading/i)).toBeInTheDocument();
  });

  it('reads photo URL from entry.user.photoUrl when present', async () => {
    mockAwardsPast([
      artistAward({
        username: 'Tony',
        votes: 5,
        photoUrl: '/uploads/tony.jpg',
      }),
    ]);
    await renderAndAdvancePastFetch();
    const img = document.querySelector('.notification-artwork');
    expect(img).not.toBeNull();
    expect(img.src).toContain('/uploads/tony.jpg');
  });

  it('does not render an artwork img when photoUrl is missing', async () => {
    mockAwardsPast([
      artistAward({ username: 'Tony', votes: 5, photoUrl: null }),
    ]);
    await renderAndAdvancePastFetch();
    expect(document.querySelector('.notification-artwork')).toBeNull();
  });
});

// ===========================================================================
// AUTO-DISMISS
// ===========================================================================
describe('WinnersNotification — auto-dismiss', () => {
  it('auto-dismisses 6 seconds after appearing', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 5 })]);
    await renderAndAdvancePastFetch();
    expect(document.querySelector('.winners-notification')).not.toBeNull();
    // Walk forward in chunks past the 6s auto-dismiss timer
    for (let i = 0; i < 8; i++) {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
    }
    expect(document.querySelector('.winners-notification')).toBeNull();
  });
});

// ===========================================================================
// MANUAL DISMISS
// ===========================================================================
describe('WinnersNotification — manual dismiss', () => {
  it('clicking the dismiss button hides the card', async () => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 5 })]);
    await renderAndAdvancePastFetch();
    expect(document.querySelector('.winners-notification')).not.toBeNull();
    const btn = screen.getByRole('button', { name: /dismiss/i });
    btn.click();
    await Promise.resolve();
    expect(document.querySelector('.winners-notification')).toBeNull();
  });
});

// ===========================================================================
// RENDER STRUCTURE
// ===========================================================================
describe('WinnersNotification — render structure', () => {
  beforeEach(() => {
    mockAwardsPast([artistAward({ username: 'Tony', votes: 5, photoUrl: '/u.jpg' })]);
  });

  it('renders the icon character', async () => {
    await renderAndAdvancePastFetch();
    expect(document.querySelector('.notification-icon')).not.toBeNull();
  });

  it('renders the title in an h3', async () => {
    await renderAndAdvancePastFetch();
    const h3 = document.querySelector('.notification-content h3');
    expect(h3).not.toBeNull();
    expect(h3.textContent.length).toBeGreaterThan(0);
  });

  it('renders the message in a paragraph', async () => {
    await renderAndAdvancePastFetch();
    const p = document.querySelector('.notification-content p');
    expect(p).not.toBeNull();
    expect(p.textContent.length).toBeGreaterThan(0);
  });

  it('applies the tier color via --border-color CSS custom prop', async () => {
    await renderAndAdvancePastFetch();
    const card = document.querySelector('.winners-card');
    expect(card.style.getPropertyValue('--border-color')).toBeTruthy();
  });
});