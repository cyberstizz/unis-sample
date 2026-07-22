// ═══════════════════════════════════════════════════════════════════════
//  UNIS — Vote Celebration
//  Premium multi-stage celebration fired when a vote lands.
//  Built on canvas-confetti (already in package.json) — GPU-friendly,
//  runs on its own canvas above the wizard overlay, zero React re-renders.
//
//  Choreography (~2.4s total):
//    Stage 1 (0ms)    — center power burst themed to the nominee's artwork
//                       dominant color + white, wide spread, high velocity
//    Stage 2 (180ms)  — dual side cannons angled inward (stadium moment)
//    Stage 3 (450ms)  — golden shimmer rain: slow, drifting star + circle
//                       particles falling from the top edge for ~1.8s
//
//  Accessibility: respects prefers-reduced-motion — fires one small,
//  brief, low-particle burst instead of the full sequence.
//
//  Usage (votingWizard.jsx success path):
//    import { celebrateVote } from './utils/voteCelebration';
//    celebrateVote({ accentColor: dominantColor }); // any rgb()/rgba()/#hex
// ═══════════════════════════════════════════════════════════════════════

import confetti from 'canvas-confetti';

const GOLD = '#f5c542';
const WHITE = '#ffffff';

/** Parse 'rgb(a)(r, g, b[, a])' or '#hex' into a hex string; null if unusable. */
const toHex = (color) => {
  if (!color || typeof color !== 'string') return null;
  if (color.startsWith('#')) return color;
  const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((n) =>
    Math.max(0, Math.min(255, parseInt(n, 10)))
  );
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
};

/** Lighten a hex color toward white by `amt` (0..1) for a tonal pair. */
const lighten = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amt);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
};

// One shared canvas above everything (wizard overlay is z-index 1000).
let cachedFire = null;
const getFire = () => {
  if (cachedFire) return cachedFire;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '2000',
  });
  document.body.appendChild(canvas);
  cachedFire = confetti.create(canvas, { resize: true, useWorker: true });
  return cachedFire;
};

/**
 * Fire the full celebration.
 * @param {Object}  opts
 * @param {string}  [opts.accentColor] rgb()/rgba()/#hex — usually the wizard's
 *                                     extracted artwork dominant color.
 */
export const celebrateVote = ({ accentColor } = {}) => {
  const fire = getFire();
  const accent = toHex(accentColor) || GOLD;
  const palette = [accent, lighten(accent, 0.35), lighten(accent, 0.65), WHITE, GOLD];

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    // Brief, gentle, single burst — acknowledgment without motion overload.
    fire({
      particleCount: 24,
      spread: 55,
      startVelocity: 18,
      gravity: 1.1,
      ticks: 90,
      origin: { x: 0.5, y: 0.55 },
      colors: [accent, WHITE],
      scalar: 0.9,
      disableForReducedMotion: false, // we ARE the reduced variant
    });
    return;
  }

  // ── Stage 1: center power burst ──
  fire({
    particleCount: 110,
    spread: 100,
    startVelocity: 42,
    gravity: 0.9,
    decay: 0.91,
    ticks: 200,
    origin: { x: 0.5, y: 0.55 },
    colors: palette,
    scalar: 1.05,
  });

  // ── Stage 2: dual side cannons ──
  setTimeout(() => {
    const cannon = (x, angle) =>
      fire({
        particleCount: 45,
        angle,
        spread: 55,
        startVelocity: 50,
        gravity: 1,
        decay: 0.9,
        ticks: 180,
        origin: { x, y: 0.7 },
        colors: palette,
        scalar: 0.95,
      });
    cannon(0.08, 60);   // left cannon, aimed up-right
    cannon(0.92, 120);  // right cannon, aimed up-left
  }, 180);

  // ── Stage 3: golden shimmer rain (~1.8s of slow drift) ──
  setTimeout(() => {
    const end = Date.now() + 1800;
    (function shimmer() {
      fire({
        particleCount: 3,
        spread: 120,
        startVelocity: 8,
        gravity: 0.55,
        drift: Math.random() * 2 - 1,
        ticks: 260,
        origin: { x: Math.random(), y: -0.05 },
        colors: [GOLD, lighten(accent, 0.5), WHITE],
        shapes: ['star', 'circle'],
        scalar: 0.8,
      });
      if (Date.now() < end) requestAnimationFrame(shimmer);
    })();
  }, 450);
};

export default celebrateVote;