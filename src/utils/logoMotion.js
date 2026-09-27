// src/utils/logoMotion.js
//
// Turns beat events from bassReactor (kick / snare / energy) into the header
// logo's motion: damped springs for punch, tilt and hop, plus a glow flash
// and a slow "breath" that follows the song's energy. Pure functions, no DOM,
// no Web Audio, so it's unit-tested in logoMotion.test.js. header.jsx applies
// the resulting numbers to the <img> style every frame.

// ─── LOGO MOTION TUNING ──────────────────────────────────────────
// How BIG the logo moves on each hit. What counts as a hit lives in
// utils/bassReactor.js (DETECTOR_CONFIG). Safe to tweak live.
export const LOGO_MOTION = {
  // Spring feel. Higher stiffness = snappier; lower damping = more bounce.
  // 900 / 27 peaks ~45ms after the hit and settles in ~300ms: one clear
  // pop per beat with a small rebound.
  stiffness: 900,
  damping: 27,

  kickScale: 0.18,     // extra size at the peak of the hardest kick (+18%)
  kickSquash: 0.35,    // share of the punch that goes wide vs tall (0 = none)
  kickGlow: 0.55,      // how much glow a kick adds (snares own the flash)

  snareTiltDeg: 6,     // peak tilt on the hardest snare, alternating sides
  snareLiftPx: 5,      // little upward hop on the snare

  glowPx: 24,          // drop-shadow radius at full glow
  glowBrightness: 0.18,
  glowDecay: 0.14,     // seconds for the flash to fade to ~37%

  breathScale: 0.035,  // overall size swell as the song gets bigger
  breathTau: 0.35,     // seconds to follow the song's energy
  energyBoost: 0.6,    // hits range from 70% (quiet) to 130% (hook) size
};

// Integrator step. Fine enough that a stiff spring behaves the same on 60 Hz
// and 120 Hz screens.
const SPRING_H = 1 / 240;

function springStep(x, v, h) {
  v += (-LOGO_MOTION.stiffness * x - LOGO_MOTION.damping * v) * h;
  return [x + v * h, v];
}

// Impulse that produces a peak of exactly 1 on this spring, measured with
// the same integrator the logo uses. The LOGO_MOTION numbers above then read
// as the actual peak you'll see (e.g. kickScale 0.18 = +18%).
const UNIT_IMPULSE = (() => {
  let x = 0; let v = 1; let peak = 0;
  for (let i = 0; i < 240; i++) {
    [x, v] = springStep(x, v, SPRING_H);
    if (x > peak) peak = x;
  }
  return 1 / peak;
})();

/**
 * Advance the logo's motion state by one beat frame. Pure (mutates `m`
 * only), so it's unit-testable without a DOM or Web Audio.
 */
export function createLogoMotionState() {
  return { scale: 0, scaleV: 0, tilt: 0, tiltV: 0, lift: 0, liftV: 0, glow: 0, breath: 0 };
}

export function stepLogoMotion(m, beat) {
  const M = LOGO_MOTION;
  const dt = beat.dt || 1 / 60;
  const amp = 1 + M.energyBoost * ((beat.energy ?? 0.5) - 0.5);

  // Fade the previous flash first, so a hit on this frame shows at full.
  m.glow *= Math.exp(-dt / M.glowDecay);
  if (m.glow < 0.005) m.glow = 0;

  if (beat.kickHit > 0) {
    m.scaleV += UNIT_IMPULSE * M.kickScale * beat.kickHit * amp;
    m.glow = Math.max(m.glow, beat.kickHit * M.kickGlow * amp);
  }
  if (beat.snareHit > 0) {
    m.tiltV += UNIT_IMPULSE * M.snareTiltDeg * beat.snareHit * amp * (beat.snareSide || 1);
    m.liftV -= UNIT_IMPULSE * M.snareLiftPx * beat.snareHit * amp;
    m.glow = Math.max(m.glow, Math.min(1, beat.snareHit * amp));
  }

  // Semi-implicit Euler, sub-stepped so a stiff spring stays stable (and
  // identical) whatever the frame rate.
  const steps = Math.max(1, Math.ceil(dt / SPRING_H - 1e-9));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    [m.scale, m.scaleV] = springStep(m.scale, m.scaleV, h);
    [m.tilt, m.tiltV] = springStep(m.tilt, m.tiltV, h);
    [m.lift, m.liftV] = springStep(m.lift, m.liftV, h);
  }

  m.breath += (1 - Math.exp(-dt / M.breathTau)) * ((beat.energy ?? 0) - m.breath);
  return m;
}
