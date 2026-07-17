// src/utils/bassReactor.js
//
// Singleton Web Audio engine that taps the app's shared media element and
// publishes a smoothed 0–1 "bass energy" value (~20–160 Hz) every animation
// frame. Any component can subscribe (the header logo does).
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

let ctx = null;
let analyser = null;
let freqData = null;

const sources = new Map();      // mediaElement -> MediaElementAudioSourceNode
let connectedSource = null;     // the source currently feeding the analyser

const subscribers = new Set();
let rafId = null;

// Envelope state
let smoothed = 0;
let adaptivePeak = 0.12;
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
  analyser.smoothingTimeConstant = 0.5;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.connect(ctx.destination);

  const binHz = ctx.sampleRate / analyser.fftSize;
  binLo = Math.max(1, Math.round(20 / binHz));
  binHi = Math.max(binLo + 1, Math.round(160 / binHz));
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

  let sum = 0;
  for (let i = binLo; i <= binHi; i++) sum += freqData[i];
  const avg = sum / ((binHi - binLo + 1) * 255); // 0–1 raw bass energy

  // Adaptive normalization so quietly-mastered tracks still pulse and
  // loud masters don't peg at 1.0 the whole song.
  adaptivePeak = Math.max(avg, adaptivePeak * 0.996, 0.12);
  const norm = Math.min(1, avg / adaptivePeak);

  // Fast attack, slower release → punchy on the kick, smooth decay.
  smoothed = norm >= smoothed ? norm : smoothed * 0.86 + norm * 0.14;

  for (const fn of subscribers) fn(smoothed);
}

/**
 * Subscribe to the bass envelope. Callback receives a 0–1 float every
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
      smoothed = 0;
    }
  };
}

/** Kick the loop after a late attach (analyser created after subscribe). */
export function ensureRunning() {
  if (rafId == null && analyser && subscribers.size > 0) {
    rafId = requestAnimationFrame(frame);
  }
}