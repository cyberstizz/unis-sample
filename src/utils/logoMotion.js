// src/utils/logoMotion.js
//
// Turns beat events from bassReactor into the header logo's pulse.
// One gesture only: on every kick, snare or hi-hat the logo pops bigger with a glow,
// then eases smoothly back to rest. No tilt, no bounce, no drifting — the
// logo sits still between hits so each drum hit is easy to see.
//
// Pure functions (no DOM, no Web Audio), unit-tested in logoMotion.test.js.
// header.jsx applies the result to the <img> style every frame.

// ─── TUNING ─────────────────────────────────────────────────────────────
export const LOGO_MOTION = {
  popScale: 0.12,  // how much bigger the logo gets on a hit (+12%)
  glowPx: 14,      // glow radius at the top of a hit
  decay: 0.11,     // seconds to ease back (~95% settled in ~0.33s)
};

export function createLogoMotionState() {
  return { pulse: 0 };
}

/**
 * Advance the pulse by one frame.
 * beat = { kickHit, snareHit, hatHit, dt } from bassReactor's subscribeBeat.
 * All three do the same thing; if they land together it's one pop.
 */
export function stepLogoMotion(m, beat) {
  const dt = beat.dt || 1 / 60;
  m.pulse *= Math.exp(-dt / LOGO_MOTION.decay);
  if (beat.kickHit > 0 || beat.snareHit > 0 || beat.hatHit > 0) m.pulse = 1;
  if (m.pulse < 0.002) m.pulse = 0;
  return m;
}

/** CSS values for the current state. */
export function logoStyle(m) {
  if (m.pulse === 0) return { transform: '', filter: '' };
  return {
    transform: `scale(${(1 + m.pulse * LOGO_MOTION.popScale).toFixed(4)})`,
    filter: `drop-shadow(0 0 ${(m.pulse * LOGO_MOTION.glowPx).toFixed(1)}px var(--unis-primary-glow))`,
  };
}
