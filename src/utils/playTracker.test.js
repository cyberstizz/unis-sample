// src/utils/playTracker.test.js
//
// Tests for Finding 3 — playTracker.js
//
// Current state: file is implemented but imported nowhere. These tests verify
// the module behaves correctly in isolation. The integration tests in
// /src/test/findings/03-playTracker.integration.test.jsx verify that components
// actually USE it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  schedulePlayTracking,
  cancelPlayTracking,
  getCurrentTrackingId,
} from './playTracker';

// Mock the axios client so we can assert on the API call without hitting MSW
vi.mock('../components/axiosInstance', () => ({
  apiCall: vi.fn().mockResolvedValue({ data: { tracked: true } }),
}));

import { apiCall } from '../components/axiosInstance';

describe('playTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cancelPlayTracking();
    vi.useRealTimers();
  });

  describe('schedulePlayTracking', () => {
    it('does NOT fire the /play endpoint immediately', () => {
      schedulePlayTracking('song-001', 'user-001');
      expect(apiCall).not.toHaveBeenCalled();
    });

    it('fires the /play endpoint after exactly 30 seconds', async () => {
      schedulePlayTracking('song-001', 'user-001');

      // 29.9s — still should not have fired
      vi.advanceTimersByTime(29_900);
      expect(apiCall).not.toHaveBeenCalled();

      // 30.0s — now it fires
      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith({
        url: '/v1/media/song/song-001/play?userId=user-001',
        method: 'post',
      });
    });

    it('fires without userId param when called anonymously', async () => {
      schedulePlayTracking('song-002', null);
      vi.advanceTimersByTime(30_000);
      await vi.runAllTimersAsync();

      expect(apiCall).toHaveBeenCalledWith({
        url: '/v1/media/song/song-002/play',
        method: 'post',
      });
    });

    it('tracks the current song being scheduled', () => {
      schedulePlayTracking('song-001', 'user-001');
      expect(getCurrentTrackingId()).toBe('song-001');
    });

    it('cancels previous timer when a new song starts before 30s', async () => {
      schedulePlayTracking('song-001', 'user-001');
      vi.advanceTimersByTime(10_000);

      // User switches songs 10s in
      schedulePlayTracking('song-002', 'user-001');

      // Run a full 30s from the second schedule
      vi.advanceTimersByTime(30_000);
      await vi.runAllTimersAsync();

      // Only song-002 should have been tracked, not song-001
      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('song-002') })
      );
    });
  });

  describe('cancelPlayTracking', () => {
    it('prevents a scheduled call from firing', async () => {
      schedulePlayTracking('song-001', 'user-001');
      vi.advanceTimersByTime(15_000);

      cancelPlayTracking();

      vi.advanceTimersByTime(60_000);
      await vi.runAllTimersAsync();

      expect(apiCall).not.toHaveBeenCalled();
    });

    it('clears the current tracking id', () => {
      schedulePlayTracking('song-001', 'user-001');
      cancelPlayTracking();
      expect(getCurrentTrackingId()).toBeNull();
    });

    it('is safe to call when nothing is scheduled', () => {
      expect(() => cancelPlayTracking()).not.toThrow();
    });
  });
});
