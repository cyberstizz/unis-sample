// === src/utils/playTracker.js ===
// Centralized play-tracking utility with 30-second delay.
// Import this wherever you currently fire POST /v1/media/song/{songId}/play
//
// Usage:
//   import { schedulePlayTracking, cancelPlayTracking } from '../utils/playTracker';
//
//   // When user clicks play:
//   schedulePlayTracking(songId, userId);
//
//   // When user skips/changes song before 30 seconds:
//   cancelPlayTracking();
//
// The actual audio playback is NOT affected — this only controls
// when the tracking API call fires. The song plays immediately.

import { apiCall } from '../components/axiosInstance';

let playTimer = null;
let currentTrackingId = null; // songId being tracked

const PLAY_TRACKING_DELAY_MS = 30000; // 30 seconds — matches Spotify's industry standard

/**
 * Schedule a play-tracking API call after 30 seconds.
 * If called again before the timer fires (e.g., user switches songs),
 * the previous timer is cancelled — no play is recorded for the skipped song.
 *
 * @param {string} songId - UUID of the song
 * @param {string} userId - UUID of the user (can be null for unauthenticated)
 */
export function schedulePlayTracking(songId, userId) {
  // Cancel any existing timer (user changed song before 30s)
  cancelPlayTracking();

  currentTrackingId = songId;

  playTimer = setTimeout(async () => {
    try {
      const url = userId
        ? `/v1/media/song/${songId}/play?userId=${userId}`
        : `/v1/media/song/${songId}/play`;

      await apiCall({
        url,
        method: 'post',
      });

      console.log(`[PlayTracker] Play recorded for song ${songId} after 30s`);
    } catch (err) {
      // Silent failure — play tracking should never interrupt UX
      console.warn(`[PlayTracker] Failed to record play for ${songId}:`, err.message);
    } finally {
      playTimer = null;
      currentTrackingId = null;
    }
  }, PLAY_TRACKING_DELAY_MS);

  console.log(`[PlayTracker] Timer started for song ${songId} (30s)`);
}

/**
 * Cancel any pending play-tracking timer.
 * Call this when:
 * - User skips to next/prev song
 * - User pauses before 30 seconds (optional — you may want to keep the timer running on pause)
 * - Component unmounts
 */
export function cancelPlayTracking() {
  if (playTimer) {
    clearTimeout(playTimer);
    console.log(`[PlayTracker] Timer cancelled for song ${currentTrackingId}`);
    playTimer = null;
    currentTrackingId = null;
  }
}

/**
 * Get the songId currently being tracked (if any).
 * Useful for debugging or conditional logic.
 */
export function getCurrentTrackingId() {
  return currentTrackingId;
}