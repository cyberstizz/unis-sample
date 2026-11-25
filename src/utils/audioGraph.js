// src/utils/audioGraph.js
//
// The player's one Web Audio graph. Every media element the player uses (the
// main <audio>, the second deck Unis Mix plays the next song on, and the
// <video> element) gets its own LANE, and every lane feeds one master bus:
//
//   element ─► level (levelling gain)
//           ─► lows  (low shelf, 220 Hz: the bass swap)
//           ─► hp    (high-pass: Rise thins the outgoing song)
//           ─► lp    (low-pass: Rise opens up the incoming song)
//           ─► fade  (the transition's volume curve)
//           ─► master ─► limiter (-1 dB) ─► speakers
//                              └─► tap (the header logo's beat detector listens here)
//            lp ─► send ─► echo (half-beat delay, feedback) ─► master
//
// Hard rules (see also bassReactor.js):
//   • createMediaElementSource() works once per element, so lanes are cached.
//   • Once an element is in the graph, its sound only comes out of the graph.
//   • A cross-origin element without CORS approval would play silence, so
//     elements must be rendered with crossOrigin="anonymous".
//   • iPhones stop Web Audio when the screen locks unless the page asks for a
//     "playback" audio session (navigator.audioSession, iOS/iPadOS 17+). On an
//     iPhone without it, nothing is routed: playback stays exactly as before,
//     and levelling/mixing report themselves unavailable.

let ctx = null;
let master = null;
let limiter = null;
let tap = null;
const lanes = new Map();     // element -> lane
let sessionSet = false;

const isIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
};

/** True when this device can route the player through Web Audio safely. */
export function graphSupported() {
  if (typeof window === 'undefined') return false;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  if (isIOS() && !('audioSession' in navigator)) return false;
  return true;
}

/** Ask iOS/iPadOS for a playback session: music keeps going when the screen locks. */
export function claimPlaybackSession() {
  if (sessionSet) return;
  sessionSet = true;
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch { /* older browsers */ }
}

export function getContext() {
  if (ctx) return ctx;
  if (!graphSupported()) return null;
  claimPlaybackSession();
  const AC = window.AudioContext || window.webkitAudioContext;
  try {
    ctx = new AC();
  } catch (e) {
    console.error('[audioGraph] could not start Web Audio:', e);
    return null;
  }
  master = ctx.createGain();
  limiter = ctx.createDynamicsCompressor();
  // A limiter just under full scale: catches peaks when a quiet song is
  // turned up (Loud), otherwise does nothing audible.
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  tap = ctx.createGain();
  master.connect(limiter);
  limiter.connect(ctx.destination);
  limiter.connect(tap);
  installUnlock();
  return ctx;
}

// Browsers start Web Audio suspended until the person interacts. Any tap,
// click or key press un-suspends it, so a song that starts on its own later
// (next in the queue) still has sound.
let unlockInstalled = false;
function installUnlock() {
  if (unlockInstalled || typeof document === 'undefined') return;
  unlockInstalled = true;
  const unlock = () => {
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
  };
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) unlock(); });
}

/**
 * Resolves true once the graph is running (it may need the first tap).
 * Elements are only routed into a running graph, so a song is never silenced
 * by a suspended one.
 */
export function ensureRunning(timeoutMs = 600) {
  const c = getContext();
  if (!c) return Promise.resolve(false);
  if (c.state === 'running') return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    c.resume().then(() => finish(c.state === 'running')).catch(() => finish(false));
    setTimeout(() => finish(c.state === 'running'), timeoutMs);
  });
}

export function isRunning() {
  return !!(ctx && ctx.state === 'running');
}

/** The node the logo's analyser listens to (after the limiter). */
export function getTap() {
  getContext();
  return tap;
}

export function resumeContext() {
  const c = getContext();
  if (c && c.state !== 'running') c.resume().catch(() => {});
  return c;
}

/** True once this element plays through the graph. */
export function isRouted(el) {
  return !!(el && lanes.has(el));
}

/**
 * The element's lane, creating it (and routing the element) if needed.
 * Returns null when routing isn't possible; the element then plays as usual.
 */
export function laneFor(el) {
  if (!el) return null;
  const existing = lanes.get(el);
  if (existing) return existing;
  if (el.crossOrigin !== 'anonymous') return null;
  const c = getContext();
  if (!c) return null;
  let src;
  try {
    src = c.createMediaElementSource(el);
  } catch (e) {
    console.error('[audioGraph] createMediaElementSource failed:', e);
    return null;
  }
  const level = c.createGain();
  const lows = c.createBiquadFilter(); lows.type = 'lowshelf'; lows.frequency.value = 220; lows.gain.value = 0;
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 10; hp.Q.value = 0.7;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.7;
  const fade = c.createGain();
  src.connect(level); level.connect(lows); lows.connect(hp); hp.connect(lp); lp.connect(fade); fade.connect(master);

  const send = c.createGain(); send.gain.value = 0;
  const delay = c.createDelay(2); delay.delayTime.value = 0.3;
  const echoTone = c.createBiquadFilter(); echoTone.type = 'bandpass'; echoTone.frequency.value = 1500; echoTone.Q.value = 0.6;
  const feedback = c.createGain(); feedback.gain.value = 0;
  lp.connect(send); send.connect(delay); delay.connect(echoTone); echoTone.connect(feedback); feedback.connect(delay); echoTone.connect(master);

  const lane = { el, src, level, lows, hp, lp, fade, send, delay, feedback };
  lanes.set(el, lane);
  return lane;
}

/** Puts a lane back to neutral (full volume, no filters, no echo), now. */
export function resetLane(lane, { keepLevel = true } = {}) {
  if (!lane || !ctx) return;
  const now = ctx.currentTime;
  const params = [lane.fade.gain, lane.lows.gain, lane.hp.frequency, lane.lp.frequency, lane.send.gain, lane.feedback.gain];
  if (!keepLevel) params.push(lane.level.gain);
  params.forEach((p) => { try { p.cancelScheduledValues(now); } catch { /* noop */ } });
  lane.fade.gain.setValueAtTime(1, now);
  lane.lows.gain.setValueAtTime(0, now);
  lane.hp.frequency.setValueAtTime(10, now);
  lane.lp.frequency.setValueAtTime(20000, now);
  lane.send.gain.setValueAtTime(0, now);
  lane.feedback.gain.setValueAtTime(0, now);
  if (!keepLevel) lane.level.gain.setValueAtTime(1, now);
}

/** Smoothly moves a lane's levelling gain (linear gain, not dB). */
export function setLaneLevel(lane, gain, seconds = 0.25) {
  if (!lane || !ctx) return;
  const now = ctx.currentTime;
  try { lane.level.gain.cancelScheduledValues(now); } catch { /* noop */ }
  lane.level.gain.setTargetAtTime(gain, now, Math.max(0.01, seconds / 3));
}

export function currentTime() {
  return ctx ? ctx.currentTime : 0;
}
