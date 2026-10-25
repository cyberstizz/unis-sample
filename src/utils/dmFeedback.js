// src/utils/dmFeedback.js
// Touch feedback for Messages: short vibrations and two soft sounds.
//
// Vibration — Android browsers only. Safari on iPhone doesn't let websites
// vibrate, so these calls are silent there (iPhone gets haptics in the Expo
// app). Browsers also ignore vibration until the person has tapped the page.
//
// Sounds — a tiny send "pop" and a two-note receive chime, synthesized with
// Web Audio (no audio files). Rules, enforced by the callers and here:
//   • only inside an open thread
//   • never while a song is playing — Unis never plays a sound effect over
//     someone's music (callers pass { muted: isPlaying })
//   • never when the tab is hidden
//   • iPhone's silent switch mutes them, like any web audio
// Browsers start audio "suspended" until a tap, so primeSound() is called from
// the first send/tap; receive sounds before that tap simply don't play.

const PATTERNS = {
  tap: 6,           // light tick: tabs, toggles
  press: 12,        // long-press opened the reaction bar
  send: 9,
  react: [7, 28, 9],
  success: [10, 36, 14],
  error: [26, 48, 26],
};

export function haptic(kind = 'tap') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(PATTERNS[kind] ?? PATTERNS.tap);
  } catch {
    /* blocked before the first tap — nothing to do */
  }
}

let ctx = null;

function audio() {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a tap/click so later sounds are allowed to play. */
export function primeSound() {
  const c = audio();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

function blip(c, { from, to, at, dur, peak }) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, at);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + dur * 0.8);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** kind: 'send' | 'receive'. Pass { muted: true } while music is playing. */
export function playSound(kind, { muted = false } = {}) {
  if (muted) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  const c = audio();
  if (!c || c.state !== 'running') return;
  const at = c.currentTime + 0.005;
  try {
    if (kind === 'send') {
      blip(c, { from: 520, to: 880, at, dur: 0.09, peak: 0.045 });
    } else if (kind === 'receive') {
      blip(c, { from: 740, to: 740, at, dur: 0.075, peak: 0.03 });
      blip(c, { from: 988, to: 988, at: at + 0.08, dur: 0.1, peak: 0.026 });
    }
  } catch {
    /* audio graph unavailable — stay silent */
  }
}
