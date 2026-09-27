// src/utils/bassReactor.js
//
// Singleton Web Audio engine that taps the app's shared media element and
// reports KICK and SNARE hits every animation frame. The header logo
// subscribes and pops on each hit.
//
// ─── HOW HITS ARE DETECTED ──────────────────────────────────────────────
//  1. TWO DRUM DETECTORS.
//       • KICK  — 40–130 Hz (the thump)
//       • SNARE — 1.8–5 kHz "crack" confirmed by 180–400 Hz "body".
//         Requiring the body keeps hi-hats (crack, no body) from firing it.
//
//  2. SPECTRAL FLUX onset detection. Instead of "how loud is the band", we
//     measure how much NEW energy arrived since the last frame, bin by bin.
//     A sustained 808 or bassline produces almost no flux; a drum hit produces
//     a spike. Each spike is compared to an adaptive threshold
//     (running mean + K × std-dev), so the detector self-calibrates to any
//     master — quiet demo or brick-walled single.
//
//  3. HEADROOM. The analyser's default dB ceiling (-30) clips loud, modern
//     masters: the kick band sat pinned at 255 and there was nothing left to
//     detect. We widen the range to -95…-5 dB.
//
//  4. TIME-BASED, not frame-based. All smoothing uses real elapsed time, so
//     the motion feels identical on 60 Hz and 120 Hz (ProMotion) screens.
//
// Hard constraints this module handles for you (unchanged from v1):
//  • createMediaElementSource() may only ever be called ONCE per element —
//    we cache source nodes in a Map keyed by element.
//  • Once an element is routed through an AudioContext, its sound comes out
//    of the graph, so the analyser is always connected to ctx.destination.
//  • Cross-origin media without CORS approval outputs silence into the graph.
//    We refuse any element not rendered with crossOrigin="anonymous"
//    (see player.jsx), and the R2 bucket must allow this origin via CORS.
//  • iOS/Safari suspend the AudioContext until a user gesture — we resume()
//    on every attach, which is always triggered by a play action.

const KILL_SWITCH_KEY = 'unis-logo-pulse'; // localStorage 'off' disables

// ─── DETECTOR TUNING ────────────────────────────────────────────────────
// Everything about WHAT counts as a hit lives here. How big the logo moves
// lives in header.jsx (MOTION).
export const DETECTOR_CONFIG = {
  kick:  { loHz: 40,   hiHz: 130,  k: 2.0, refractoryMs: 110 },
  snare: { loHz: 1800, hiHz: 5000, k: 2.0, refractoryMs: 120 },

  // A snare/clap must also push new energy into its "body" range. Hi-hats
  // and shakers don't, so this is what keeps them from firing the snare.
  // bodyZ = std-devs above the body band's own running mean.
  snareBody: { loHz: 180, hiHz: 400, bodyZ: 1.0, minFlux: 0.015 },

  // Don't fire for this long after a reset (new song / new element) while
  // the running stats find their feet. Otherwise the first frames of every
  // song are judged against a threshold of zero.
  warmupMs: 200,

  // Running mean/std-dev time constant for the adaptive threshold (seconds).
  // Longer = steadier threshold; shorter = adapts faster to a drop/switch-up.
  statsTau: 1.2,

  // A band must rise at least this much (0–1 byte-scale flux, ≈ 2.7 dB
  // averaged across the band) to count at all. Stops frame-to-frame
  // shimmer in a held 808, silence and fade-outs from reading as hits.
  minFlux: 0.03,

  // Hysteresis: after firing, flux must fall below threshold × rearm before
  // the band can fire again. Kills double-triggers on one drum hit.
  rearm: 0.85,

  // If the kick fired this recently, the snare needs a much bigger crack to
  // fire too (a kick's beater click lands in the snare's crack band).
  kickMaskMs: 60,
  kickMaskExtraZ: 2.5,

  // How loud the hardest recent hit was, in std-devs above the mean.
  // Hit strength is measured against this so the biggest hits map to ~1.0.
  zPeakTau: 3.0,
  zPeakMinAboveK: 1.5,
};

const ANALYSER_MIN_DB = -95;
const ANALYSER_MAX_DB = -5;

// Exponential smoothing factor for a time constant, frame-rate independent.
const alphaFor = (dt, tau) => 1 - Math.exp(-dt / tau);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function makeBand(binLo, binHi, cfg) {
  return {
    binLo, binHi, cfg,
    mean: 0, variance: 0,
    zPeak: cfg.k + DETECTOR_CONFIG.zPeakMinAboveK,
    armed: true, lastHitAt: -Infinity,
    flux: 0,
  };
}

function bandFlux(bins, prev, lo, hi) {
  let sum = 0;
  for (let i = lo; i <= hi; i++) {
    const d = bins[i] - prev[i];
    if (d > 0) sum += d;
  }
  return sum / ((hi - lo + 1) * 255);
}

// Update a band's stats and decide whether it fires this frame.
// Returns hit strength 0–1 (0 = no hit). extraZ raises the bar temporarily.
function stepBand(band, flux, dt, nowMs, extraZ = 0) {
  const C = DETECTOR_CONFIG;
  band.flux = flux;

  const std = Math.sqrt(band.variance);
  const threshold = band.mean + (band.cfg.k + extraZ) * std;
  const z = std > 1e-6 ? (flux - band.mean) / std : 0;

  let strength = 0;
  const canFire = band.armed
    && flux > C.minFlux
    && flux > threshold
    && nowMs - band.lastHitAt >= band.cfg.refractoryMs;

  if (canFire) {
    band.zPeak = Math.max(band.zPeak, z);
    strength = clamp01((z - band.cfg.k) / Math.max(0.5, band.zPeak - band.cfg.k));
    // Any hit that cleared the threshold is a real hit: give it a floor so it
    // is always visible. Strength then only decides "big" vs "bigger".
    strength = 0.35 + 0.65 * strength;
    band.armed = false;
    band.lastHitAt = nowMs;
  } else if (!band.armed && flux < threshold * C.rearm) {
    band.armed = true;
  }

  // Update running stats AFTER the decision so a hit is judged against the
  // song so far, not against itself.
  const a = alphaFor(dt, C.statsTau);
  const diff = flux - band.mean;
  band.mean += a * diff;
  band.variance += a * (diff * diff - band.variance);

  // Let the "loudest recent hit" reference decay so quiet sections recover.
  const floor = band.cfg.k + C.zPeakMinAboveK;
  band.zPeak = floor + (band.zPeak - floor) * Math.exp(-dt / C.zPeakTau);

  return strength;
}

/**
 * Pure beat detector — no Web Audio, so it's unit-testable with synthetic
 * spectra. The live engine below feeds it real analyser data.
 *
 * process({ bins, dt, nowMs }) → {
 *   kickHit:   0–1 (>0 only on the frame a kick is detected),
 *   snareHit:  0–1 (>0 only on the frame a snare/clap is detected),
 *   kick:      0–1 decaying kick envelope (legacy subscribeBass value),
 *   dt:        seconds since the previous frame (clamped), for consumers'
 *              own time-based animation,
 * }
 */
export function createBeatDetector({ binHz, binCount }) {
  const C = DETECTOR_CONFIG;
  const toBin = (hz) => Math.min(binCount - 1, Math.max(1, Math.round(hz / binHz)));
  const range = (b) => {
    const lo = toBin(b.loHz);
    return [lo, Math.max(lo, toBin(b.hiHz))];
  };

  const kick = makeBand(...range(C.kick), C.kick);
  const snare = makeBand(...range(C.snare), C.snare);
  const [bodyLo, bodyHi] = range(C.snareBody);
  const body = { lo: bodyLo, hi: bodyHi, mean: 0, variance: 0 };
  let startedAt = null;

  let prev = new Uint8Array(binCount);
  let primed = false;
  let kickEnv = 0;

  function reset() {
    for (const b of [kick, snare]) {
      b.mean = 0; b.variance = 0; b.armed = true; b.lastHitAt = -Infinity;
      b.zPeak = b.cfg.k + C.zPeakMinAboveK;
    }
    body.mean = 0; body.variance = 0;
    startedAt = null;
    prev = new Uint8Array(binCount);
    primed = false;
    kickEnv = 0;
  }

  function process({ bins, dt, nowMs }) {
    // Clamp dt: a backgrounded tab can hand us a multi-second gap.
    dt = Math.min(Math.max(dt, 1 / 240), 1 / 20);

    if (startedAt === null) startedAt = nowMs;
    const warm = nowMs - startedAt >= C.warmupMs;

    if (!primed) {
      prev.set(bins);
      primed = true;
      return { kickHit: 0, snareHit: 0, kick: 0, dt };
    }

    const kFlux = bandFlux(bins, prev, kick.binLo, kick.binHi);
    const sFlux = bandFlux(bins, prev, snare.binLo, snare.binHi);
    const bFlux = bandFlux(bins, prev, body.lo, body.hi);
    prev.set(bins);

    // During warm-up, stats update but nothing is allowed to fire.
    const block = warm ? 0 : Infinity;
    const kickHit = stepBand(kick, kFlux, dt, nowMs, block);

    // Snare: masked right after a kick (beater click), and must have body.
    const recentKick = nowMs - kick.lastHitAt < C.kickMaskMs;
    const bodyStd = Math.sqrt(body.variance);
    const hasBody = bFlux >= C.snareBody.minFlux
      && bFlux > body.mean + C.snareBody.bodyZ * bodyStd;
    const prevSnareAt = snare.lastHitAt;
    let snareHit = stepBand(snare, sFlux, dt, nowMs, block + (recentKick ? C.kickMaskExtraZ : 0));
    if (snareHit > 0 && !hasBody) {
      // It was a hat/shaker: undo the fire so the band stays armed.
      snareHit = 0;
      snare.armed = true;
      snare.lastHitAt = prevSnareAt;
    }
    const ba = alphaFor(dt, C.statsTau);
    const bDiff = bFlux - body.mean;
    body.mean += ba * bDiff;
    body.variance += ba * (bDiff * bDiff - body.variance);

    // Legacy envelope: instant attack, ~180ms decay.
    kickEnv = Math.max(kickHit, kickEnv * Math.exp(-dt / 0.18));
    if (kickEnv < 0.001) kickEnv = 0;

    return { kickHit, snareHit, kick: kickEnv, dt };
  }

  return { process, reset, _bands: { kick, snare, body } };
}

// ─── LIVE ENGINE ────────────────────────────────────────────────────────
let ctx = null;
let analyser = null;
let freqData = null;
let detector = null;

const sources = new Map();      // mediaElement -> MediaElementAudioSourceNode
let connectedSource = null;     // the source currently feeding the analyser

const subscribers = new Set();  // beat subscribers (frame object)
let rafId = null;
let lastTs = null;

export function isPulseEnabled() {
  try {
    return localStorage.getItem(KILL_SWITCH_KEY) !== 'off';
  } catch (e) {
    return true;
  }
}

export function setPulseEnabled(on) {
  try {
    localStorage.setItem(KILL_SWITCH_KEY, on ? 'on' : 'off');
  } catch (e) { /* private mode — ignore */ }
}

function ensureContext() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;               // bin ≈ 21–23 Hz: enough to isolate the kick
  analyser.smoothingTimeConstant = 0;    // flux needs raw frames; we smooth ourselves
  analyser.minDecibels = ANALYSER_MIN_DB;
  analyser.maxDecibels = ANALYSER_MAX_DB;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.connect(ctx.destination);

  detector = createBeatDetector({
    binHz: ctx.sampleRate / analyser.fftSize,
    binCount: analyser.frequencyBinCount,
  });
  return true;
}

/**
 * Route a media element (audio or video) through the analyser.
 * Safe to call repeatedly — on every play, on element remount, etc.
 * Returns true if the element is (now) feeding the analyser.
 */
export function attachMediaElement(el) {
  if (!el || !isPulseEnabled()) return false;
  // Refuse tainted elements: without CORS approval the graph outputs
  // silence, which would mute playback for the user.
  if (el.crossOrigin !== 'anonymous') return false;
  if (!ensureContext()) return false;

  let src = sources.get(el);
  if (!src) {
    try {
      src = ctx.createMediaElementSource(el);
    } catch (e) {
      console.error('[bassReactor] createMediaElementSource failed:', e);
      return false;
    }
    sources.set(el, src);
  }

  if (connectedSource !== src) {
    if (connectedSource) {
      try { connectedSource.disconnect(); } catch (e) { /* noop */ }
    }
    src.connect(analyser);
    connectedSource = src;
    detector.reset(); // new element = new song context
  }

  if (ctx.state === 'suspended') {
    ctx.resume().catch((e) => console.error('[bassReactor] resume failed:', e));
  }
  return true;
}

function frame(ts) {
  rafId = requestAnimationFrame(frame);
  if (!analyser || !detector) return;

  const dt = lastTs == null ? 1 / 60 : (ts - lastTs) / 1000;
  lastTs = ts;

  analyser.getByteFrequencyData(freqData);
  const out = detector.process({ bins: freqData, dt, nowMs: ts });

  for (const fn of subscribers) {
    try { fn(out); } catch (e) { console.error('[bassReactor] subscriber error:', e); }
  }
}

function startLoop() {
  if (rafId == null && analyser && subscribers.size > 0) {
    lastTs = null;
    rafId = requestAnimationFrame(frame);
  }
}

/**
 * Subscribe to beat frames (see createBeatDetector for the shape).
 * Callback runs every animation frame while at least one subscriber exists.
 * Returns an unsubscribe function.
 */
export function subscribeBeat(fn) {
  subscribers.add(fn);
  startLoop();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      lastTs = null;
      if (detector) detector.reset();
    }
  };
}

/**
 * Legacy API (v1): callback receives a single 0–1 kick envelope per frame.
 * Kept so nothing else breaks; new code should use subscribeBeat.
 */
export function subscribeBass(fn) {
  return subscribeBeat((out) => fn(out.kick));
}

/** Kick the loop after a late attach (analyser created after subscribe). */
export function ensureRunning() {
  startLoop();
}
