// src/utils/logoGestures.js
//
// One-shot gestures the header logo plays in response to player actions:
//
//   • pause         → squash   (settles down, explains why the pops stopped)
//   • resume        → hop      (wakes back up)
//   • song change   → sway     (leans right for next / a new pick, left for previous)
//   • playback fail → shake    (the familiar "no" gesture)
//
// The press-in on tap is plain CSS in header.scss (.header-logo.is-pressed).
//
// How they coexist with the beat pops: gestures run through the Web
// Animations API, which takes priority over the inline transform the pops
// write. header.jsx also holds the pops at rest while a gesture runs, so the
// two never fight, and pops resume cleanly once it ends. Only one gesture
// plays at a time; a new one replaces whatever was running.

// ─── TUNING ─────────────────────────────────────────────────────────────
export const GESTURE_CONFIG = {
  // A real pause is confirmed after this delay. Changing songs can briefly
  // report "paused" while the new song loads; if the song changes or playback
  // resumes inside this window, it wasn't a real pause and nothing squashes.
  pauseConfirmMs: 120,

  // Rapid skips: after a sway starts, further song changes within this
  // window don't sway again (no rocking back and forth when spamming next).
  swayCooldownMs: 600,

  // prev() stamps a direction marker; it only counts if the song change
  // shows up within this window (guards against a stale marker).
  directionMaxAgeMs: 2000,

  // A resume shortly after a song change is the new song starting, not the
  // user pressing play again — the sway already covered it, so no hop.
  hopAfterChangeMs: 3000,

  // Loading a new song can make the browser report "paused" for a moment.
  // A stop this soon after a song change is part of switching, not a pause.
  stopAfterChangeMs: 500,
};

export const LOGO_GESTURES = {
  // Sits down: wider and shorter, anchored at the bottom, then back.
  squash: {
    duration: 380,
    easing: 'ease-out',
    keyframes: [
      { transform: 'scale(1, 1)', transformOrigin: '50% 100%' },
      { transform: 'scale(1.08, 0.88)', transformOrigin: '50% 100%', offset: 0.4 },
      { transform: 'scale(1, 1)', transformOrigin: '50% 100%' },
    ],
  },

  // Up and down, with a small stretch on the way up and a small landing.
  hop: {
    duration: 440,
    easing: 'ease-in-out',
    keyframes: [
      { transform: 'translateY(0) scale(1, 1)', transformOrigin: '50% 100%' },
      { transform: 'translateY(-9px) scale(0.97, 1.04)', transformOrigin: '50% 100%', offset: 0.4 },
      { transform: 'translateY(0) scale(1, 1)', transformOrigin: '50% 100%', offset: 0.75 },
      { transform: 'translateY(0) scale(1.03, 0.97)', transformOrigin: '50% 100%', offset: 0.88 },
      { transform: 'translateY(0) scale(1, 1)', transformOrigin: '50% 100%' },
    ],
  },

  // One lean in the direction of travel, then back to center.
  // direction: +1 = right (next / new song), -1 = left (previous).
  sway: (direction = 1) => ({
    duration: 520,
    easing: 'ease-in-out',
    keyframes: [
      { transform: 'translateX(0) rotate(0deg)' },
      { transform: `translateX(${6 * direction}px) rotate(${7 * direction}deg)`, offset: 0.35 },
      { transform: 'translateX(0) rotate(0deg)' },
    ],
  }),

  // Quick side-to-side "no", fading out.
  shake: {
    duration: 420,
    easing: 'ease-out',
    keyframes: [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-7px)', offset: 0.15 },
      { transform: 'translateX(7px)', offset: 0.3 },
      { transform: 'translateX(-5px)', offset: 0.45 },
      { transform: 'translateX(5px)', offset: 0.6 },
      { transform: 'translateX(-2px)', offset: 0.8 },
      { transform: 'translateX(0)' },
    ],
  },
};

export function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Play a gesture on an element. Cancels `current` (the previous gesture's
 * Animation) first so only one ever runs. Returns the new Animation, or null
 * if the browser can't animate or the user prefers reduced motion.
 */
export function playLogoGesture(el, name, { direction = 1, current = null } = {}) {
  if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return null;
  const def = typeof LOGO_GESTURES[name] === 'function'
    ? LOGO_GESTURES[name](direction)
    : LOGO_GESTURES[name];
  if (!def) return null;
  if (current) {
    try { current.cancel(); } catch { /* already finished */ }
  }
  return el.animate(def.keyframes, { duration: def.duration, easing: def.easing });
}

/** True while an Animation returned by playLogoGesture is still running. */
export function isGestureRunning(anim) {
  return !!anim && (anim.playState === 'running' || anim.playState === 'pending');
}

/**
 * Pure bookkeeping for which gesture a player event should produce.
 * header.jsx feeds it events and plays what it returns; timers live there.
 */
export function createPlaybackGestureTracker(config = GESTURE_CONFIG) {
  let lastSwayAt = -Infinity;
  let lastChangeAt = -Infinity;

  return {
    /**
     * The current song changed. hadPrevious = there was a song before this
     * one (the first song of a session gets a hop when it starts, not a sway).
     * navMarker = navDirectionRef.current from PlayerContext.
     * Returns { gesture: 'sway', direction } or null.
     */
    songChanged({ hadPrevious, navMarker, nowMs }) {
      if (!hadPrevious) return null;
      lastChangeAt = nowMs;
      if (nowMs - lastSwayAt < config.swayCooldownMs) return null;
      lastSwayAt = nowMs;
      const back = navMarker && navMarker.dir === -1
        && Date.now() - navMarker.at <= config.directionMaxAgeMs;
      return { gesture: 'sway', direction: back ? -1 : 1 };
    },

    /** Playback started (or resumed). Returns 'hop' or null. */
    playStarted({ nowMs }) {
      if (nowMs - lastChangeAt < config.hopAfterChangeMs) {
        lastChangeAt = -Infinity; // consumed by the new song starting
        return null;
      }
      return 'hop';
    },

    /**
     * Playback stopped. Returns 'squash-pending' when it may be a real
     * pause (header confirms it after pauseConfirmMs), null when the song
     * simply ended.
     */
    playStopped({ ended, nowMs }) {
      if (ended) return null;
      if (nowMs - lastChangeAt < config.stopAfterChangeMs) return null;
      return 'squash-pending';
    },

    /**
     * header.jsx confirmed a real pause (and played the squash). Whatever
     * song change came before is old news: the next resume should hop.
     */
    pauseConfirmed() {
      lastChangeAt = -Infinity;
    },
  };
}
