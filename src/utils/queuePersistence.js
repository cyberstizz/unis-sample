// src/utils/queuePersistence.js
//
// Persists the play queue across page refreshes.
//
// WHY NOT REDUX
// A Redux store is in-memory. Refreshing the page destroys a Redux store
// exactly as fast as it destroys a React Context — the queue would still
// vanish. What people mean when they say "use Redux for this" is really
// redux-persist, which is a persistence layer bolted onto Redux. This file is
// that persistence layer, without the rewrite. PlayerContext keeps working
// exactly as it does today.
//
// SIZE REALITY CHECK
// A full song object in this app is ~756 bytes. A 300-track queue of FULL
// objects is ~222 KB. The localStorage budget is ~5 MB. That is about 4% of
// the budget for a queue far larger than any real listener will build. Queue
// size is not a scaling problem — it is per-user, client-side, and never
// touches your servers. We still cap it below, but as a sanity guard rather
// than a real constraint.
//
// PRIVACY
// The key is namespaced per user and cleared on logout. Without that, signing
// out and back in as someone else on a shared device would surface the
// previous account's queue.

const STORAGE_PREFIX = 'unis.queue';

// Bump when the persisted shape changes. Old payloads are dropped rather than
// fed to a player that no longer understands them.
const SCHEMA_VERSION = 1;

// Sanity cap, not a budget constraint — see the size note above.
const MAX_PERSISTED_TRACKS = 500;

// Stale queues are dropped. A week-old queue is not something the user is
// still trying to resume.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const keyFor = (userId) => `${STORAGE_PREFIX}.${userId || 'guest'}`;

/**
 * Persist the queue. Called on a debounce from PlayerContext.
 *
 * `isPlaying` is deliberately NOT persisted. Browsers block audio playback
 * that isn't tied to a user gesture, so restoring a "playing" state produces
 * either a silent failure or a console error. We restore the queue paused and
 * let the user press play.
 */
export function saveQueueState(userId, state) {
  try {
    const {
      queue = [],
      originalQueue = [],
      currentIndex = 0,
      currentMedia = null,
      queueSource = null,
      isShuffled = false,
      repeatMode = 'off',
      autoplay = false,
      currentTime = 0,
    } = state || {};

    if (!queue.length && !currentMedia) {
      clearQueueState(userId);
      return true;
    }

    const payload = {
      v: SCHEMA_VERSION,
      savedAt: Date.now(),
      queue: queue.slice(0, MAX_PERSISTED_TRACKS),
      originalQueue: originalQueue.slice(0, MAX_PERSISTED_TRACKS),
      currentIndex,
      currentMedia,
      queueSource,
      isShuffled,
      repeatMode,
      autoplay,
      // Resume position, so a refresh mid-track picks up where it left off.
      currentTime,
    };

    localStorage.setItem(keyFor(userId), JSON.stringify(payload));
    return true;
  } catch (err) {
    // QuotaExceededError is the realistic failure. Losing the persisted queue
    // must never break playback, so we degrade to in-memory-only.
    console.warn('[QueuePersistence] Could not save queue state:', err?.name || err);
    try {
      localStorage.removeItem(keyFor(userId));
    } catch {
      /* nothing further we can do */
    }
    return false;
  }
}

/**
 * Restore a previously persisted queue. Returns null when there is nothing
 * usable, so the caller can just fall through to empty state.
 */
export function loadQueueState(userId) {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (parsed?.v !== SCHEMA_VERSION) {
      console.log('[QueuePersistence] Dropping queue saved under an older schema');
      clearQueueState(userId);
      return null;
    }

    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      console.log('[QueuePersistence] Dropping stale queue');
      clearQueueState(userId);
      return null;
    }

    if (!Array.isArray(parsed.queue)) return null;

    // Guard the index against a truncated or edited queue.
    const safeIndex =
      Number.isInteger(parsed.currentIndex) &&
      parsed.currentIndex >= 0 &&
      parsed.currentIndex < parsed.queue.length
        ? parsed.currentIndex
        : 0;

    console.log(`[QueuePersistence] Restored ${parsed.queue.length} tracks`);

    return {
      queue: parsed.queue,
      originalQueue: Array.isArray(parsed.originalQueue) ? parsed.originalQueue : parsed.queue,
      currentIndex: safeIndex,
      currentMedia: parsed.currentMedia ?? parsed.queue[safeIndex] ?? null,
      queueSource: parsed.queueSource ?? null,
      isShuffled: Boolean(parsed.isShuffled),
      repeatMode: ['off', 'all', 'one'].includes(parsed.repeatMode) ? parsed.repeatMode : 'off',
      autoplay: Boolean(parsed.autoplay),
      currentTime: Number.isFinite(parsed.currentTime) ? parsed.currentTime : 0,
    };
  } catch (err) {
    console.warn('[QueuePersistence] Could not restore queue state:', err?.name || err);
    clearQueueState(userId);
    return null;
  }
}

/** Remove one user's persisted queue. Call on logout. */
export function clearQueueState(userId) {
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    /* ignore */
  }
}

/**
 * Remove every persisted queue regardless of user. Use in the logout path and
 * the session-expired handler, where the userId may already be gone.
 */
export function clearAllQueueState() {
  try {
    // Iterate the Storage index API rather than Object.keys(localStorage).
    // Object.keys relies on named properties being exposed as own enumerable
    // keys, which is not dependable across Storage implementations (and fails
    // outright under some test shims). Walk backwards because removeItem
    // reindexes as it goes.
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    console.log('[QueuePersistence] Cleared all persisted queues');
  } catch {
    /* ignore */
  }
}

export default { saveQueueState, loadQueueState, clearQueueState, clearAllQueueState };