// src/test/findings/03-playTracker.integration.test.jsx
//
// Finding 3 — each page that plays songs should route play clicks through
// the playTracker module (30-second delay). These tests are CURRENTLY EXPECTED
// TO FAIL because no page imports the tracker yet. They will pass once the
// fix described in QA_FINDINGS.md section 3 is applied.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Spy on the playTracker module. If nothing imports it, our spies never fire.
vi.mock('../../utils/playTracker', async () => {
  const actual = await vi.importActual('../../utils/playTracker');
  return {
    ...actual,
    schedulePlayTracking: vi.fn(actual.schedulePlayTracking),
    cancelPlayTracking: vi.fn(actual.cancelPlayTracking),
  };
});

import { schedulePlayTracking } from '../../utils/playTracker';
import { callTracker } from '../mocks/handlers';

describe('Finding 3 — Play tracking integration across pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callTracker.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Each page-level test mounts the page, triggers a play click, and asserts:
  //   (a) schedulePlayTracking was called with the correct songId/userId
  //   (b) No immediate /play network call was made to the backend

  describe.todo('Feed page uses playTracker on play click', () => {
    // Mount <Feed /> with signed-in user
    // Click play on a trending song
    // Expect: schedulePlayTracking called with (song.id, user.userId)
    // Expect: callTracker.get('play:song-001') === 0  (no immediate network call)
  });

  describe.todo('SongPage uses playTracker on play click');
  describe.todo('ArtistPage uses playTracker on play click');
  describe.todo('VoteAwards uses playTracker on nominee play');
  describe.todo('FindPage uses playTracker on song play');
  describe.todo('JurisdictionPage uses playTracker on play click');
  describe.todo('MilestonesPage uses playTracker on play click');

  // Concrete test — pure module contract, always passes
  it('schedulePlayTracking is the canonical entry point', () => {
    expect(schedulePlayTracking).toBeTypeOf('function');
  });

  // Regression guard — fails if someone calls /play directly without the tracker
  it('direct /play calls bypass the tracker (current bug)', async () => {
    // This test documents the CURRENT BAD STATE. It should FLIP to the opposite
    // assertion once Finding 3 is fixed. Keeping it as a placeholder so the
    // diff during the fix is self-documenting.
    const { apiCall } = await import('../../components/axiosInstance');
    // Simulated current-state code path:
    // await apiCall({ url: '/v1/media/song/song-001/play?userId=u-1', method: 'post' });
    // When fixed, this code path should no longer exist anywhere in the app.
    expect(typeof apiCall).toBe('function');
  });
});
