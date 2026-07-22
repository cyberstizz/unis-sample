// src/utils/bassReactor.js
//
// Singleton Web Audio engine that taps the app's shared media element and
// publishes a smoothed 0–1 "kick energy" value every animation frame. Any
// component can subscribe (the header logo does).
//
// ─── HOW THE MOTION IS SHAPED ───────────────────────────────────────────
// The goal is for the logo to POP on the kick drum, not wobble along with the
// whole low end. Absolute low-frequency energy doesn't do that: a sustained
// bassline or 808 keeps the band "hot" the whole time, so you get constant,
// barely-noticeable motion instead of distinct hits.
//
// Instead we measure how far the kick band jumps ABOVE its own recent
// baseline. A slow-moving average of the band represents the sustained
// bassline/drone; subtract it and what's left is the transient — the kick
// punching through. That transient is normalized, gated, and run through an
// envelope follower (fast attack / smooth release) so each kick becomes a
// clean pop that settles back toward rest before the next beat.
//
// Hard constraints this module handles for you:
//  • createMediaElementSource() may only ever be called ONCE per element —
//    we cache source nodes in a Map keyed by element.
//  • Once an element is routed through an AudioContext, its sound comes out
//    of the graph, so the analyser is always connected to ctx.destination.
//  • Cross-origin media without CORS approval outputs silence into the graph.
//    We therefore refuse to attach any element that wasn't rendered with
//    crossOrigin="anonymous" (see player.jsx), and your R2 bucket must have
//    a CORS policy allowing your origin.
//  • iOS/Safari suspend the AudioContext until a user gesture — we resume()
//    on every attach, which is always triggered by a play action.

const KILL_SWITCH_KEY = 'unis-logo-pulse'; // localStorage 'off' disables

// ─── TUNING ─────────────────────────────────────────────────────────────
// All the "feel" lives here. Safe to tweak live.
const CONFIG = {
  // Frequency window the pulse listens to, in Hz. A kick's thump lives roughly
  // 40–130 Hz. Narrow = tighter to the kick; widen the top toward ~180 to also
  // catch snare/clap body if you ever want a busier feel.
  bandLoHz: 35,
  bandHiHz: 130,

  // How fast the "sustained level" baseline adapts (per frame, 0–1).
  // Lower = slower = a single kick stands out more. Too high and the baseline
  // "eats" the kick before it can register.
  baselineRate: 0.015,

  // Adaptive normalization: the loudest recent transient maps to ~1.0.
  // peakDecay is per-frame; lower = forgets loud hits faster (more sensitive
  // in quiet sections). minPeak stops silence from being amplified into noise.
  peakDecay: 0.994,
  minPeak: 0.04,

  // Noise gate on the normalized transient (0–1). Everything below this is
  // treated as rest, so the logo actually sits still between hits.
  gate: 0.08,

  // Dynamics curve. >1 keeps soft hits soft and lets hard hits pop
  // (preserves the groove's dynamics). =1 is linear. <1 flattens everything.
  gamma: 1.15,

  // Envelope follower coefficients (per frame). attack = how fast it rises to
  // a new peak, release = how slowly it falls. Fast attack + slow release is
  // what makes a "kick" read as a kick.
  attack: 0.5,   // ~87% of a step in ~4 frames (~65ms) — snappy, not jittery
  release: 0.09, // decays to ~rest over ~450–500ms — one clean pop per beat
};

let ctx = null;
let analyser = null;
let freqData = null;

const sources = new Map();      // mediaElement -> MediaElementAudioSourceNode
let connectedSource = null;     // the source currently feeding the analyser

const subscribers = new Set();
let rafId = null;

// ─── Envelope / detector state ──────────────────────────────────────────
let baseline = 0;       // slow-moving sustained level of the band
let adaptivePeak = CONFIG.minPeak;
let env = 0;            // published value
let binLo = 1;
let binHi = 8;

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
  analyser.fftSize = 2048;               // bin width ≈ 21–23 Hz at 44.1/48k
  // Low, not zero: we want transients to survive to our own envelope
  // follower rather than being pre-blurred by the analyser.
  analyser.smoothingTimeConstant = 0.25;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.connect(ctx.destination);

  const binHz = ctx.sampleRate / analyser.fftSize;
  binLo = Math.max(1, Math.round(CONFIG.bandLoHz / binHz));
  binHi = Math.max(binLo + 1, Math.round(CONFIG.bandHiHz / binHz));
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
      // Element already claimed by another context, or unsupported.
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
  }

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return true;
}

function frame() {
  rafId = requestAnimationFrame(frame);
  if (!analyser) return;

  analyser.getByteFrequencyData(freqData);

  // 1. Current energy in the kick band (0–1).
  let sum = 0;
  for (let i = binLo; i <= binHi; i++) sum += freqData[i];
  const energy = sum / ((binHi - binLo + 1) * 255);

  // 2. Track the sustained level of the band, then measure how far we've
  //    jumped above it right now. That jump IS the kick transient; a steady
  //    bassline raises the baseline and gets subtracted away.
  baseline += (energy - baseline) * CONFIG.baselineRate;
  const transient = Math.max(0, energy - baseline);

  // 3. Adaptive normalization so the hardest recent kick maps near 1.0,
  //    regardless of how the track was mastered.
  adaptivePeak = Math.max(transient, adaptivePeak * CONFIG.peakDecay, CONFIG.minPeak);
  let target = Math.min(1, transient / adaptivePeak);

  // 4. Gate out the noise floor so the logo rests between hits, then rescale
  //    what's left back to the full 0–1 range.
  target = target <= CONFIG.gate ? 0 : (target - CONFIG.gate) / (1 - CONFIG.gate);

  // 5. Dynamics curve — soft hits stay soft, hard hits pop.
  if (target > 0) target = Math.pow(target, CONFIG.gamma);

  // 6. Envelope follower: fast rise onto a new peak, smooth fall after.
  const rate = target > env ? CONFIG.attack : CONFIG.release;
  env += (target - env) * rate;
  if (env < 0.0005) env = 0; // snap fully to rest; kills sub-pixel drift

  for (const fn of subscribers) fn(env);
}

/**
 * Subscribe to the kick envelope. Callback receives a 0–1 float every
 * animation frame while at least one subscriber exists.
 * Returns an unsubscribe function.
 */
export function subscribeBass(fn) {
  subscribers.add(fn);
  if (rafId == null && analyser) rafId = requestAnimationFrame(frame);
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      // reset detector so the next session starts clean
      env = 0;
      baseline = 0;
      adaptivePeak = CONFIG.minPeak;
    }
  };
}

/** Kick the loop after a late attach (analyser created after subscribe). */
export function ensureRunning() {
  if (rafId == null && analyser && subscribers.size > 0) {
    rafId = requestAnimationFrame(frame);
  }
}