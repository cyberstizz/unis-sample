// src/boot/bootSplash.js
// ─────────────────────────────────────────────────────────────
// Decides when the launch splash leaves, and how.
//
// The splash itself is plain HTML in index.html (#unis-splash), styled by
// public/splash.css, so it is on screen before this file even downloads.
// This module takes over once React loads:
//
//   • It stays while anything is still loading. Any loading state can keep
//     it up by rendering <SplashHold /> (the auth check, a page's code
//     downloading, the feed's first fetch). When nothing holds it and
//     markAppReady() has run, it leaves.
//   • The first visit of a session lets the light sweep write the wordmark
//     in fully first (about 1.5s from the moment the page started loading).
//     A reload in the same session (quick mode) or reduced motion needs only
//     half a second.
//   • It never stays longer than 9 seconds, whatever is still loading.
//   • Leaving: the wordmark and the dark stage fade out together, revealing
//     the app. (It used to fly into the header logo; the sweep now matches
//     the in-app loader instead, so it simply fades.)
//
// onSplashGone(cb) lets other code wait for it: the header logo plays its
// breath, and the welcome tour waits until the stage is clear.
//
// In tests (and anywhere #unis-splash is missing) every function here is a
// harmless no-op, and onSplashGone calls back straight away.
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react';

const MIN_FULL_MS = 1500;   // the sweep has written the wordmark in
const MIN_QUICK_MS = 500;
const MAX_MS = 9000;
const SETTLE_MS = 140;      // let one loading state hand over to the next

let state = 'gone';         // 'showing' | 'leaving' | 'gone'
let holds = 0;
let appReady = false;
let checkTimer = null;
const goneCallbacks = new Set();

const splashEl = () =>
  (typeof document !== 'undefined' ? document.getElementById('unis-splash') : null);

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const isQuick = () =>
  document.documentElement.classList.contains('splash-quick') || reducedMotion();

if (splashEl()) {
  state = 'showing';
  setTimeout(() => leave(), MAX_MS);
}

/** True while the splash is still covering the app. */
export function isSplashShowing() {
  return state !== 'gone' && !!splashEl();
}

/**
 * Calls back once the splash is gone. The callback gets `false` (kept for
 * callers written when the wordmark could land in the header logo).
 * Returns an unsubscribe function.
 */
export function onSplashGone(cb) {
  if (state === 'gone' || !splashEl()) {
    cb(false);
    return () => {};
  }
  goneCallbacks.add(cb);
  return () => goneCallbacks.delete(cb);
}

/** Keeps the splash up until the returned function is called. */
export function holdSplash() {
  if (state !== 'showing') return () => {};
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    scheduleCheck();
  };
}

/** React has mounted. Called once from App. */
export function markAppReady() {
  appReady = true;
  scheduleCheck();
}

/** Render this inside any loading state that should keep the splash up. */
export function SplashHold() {
  useEffect(() => holdSplash(), []);
  return null;
}

function scheduleCheck() {
  if (state !== 'showing') return;
  clearTimeout(checkTimer);
  checkTimer = setTimeout(tryLeave, SETTLE_MS);
}

function tryLeave() {
  if (state !== 'showing' || !appReady || holds > 0) return;
  const minMs = isQuick() ? MIN_QUICK_MS : MIN_FULL_MS;
  const elapsed = performance.now();
  if (elapsed < minMs) {
    checkTimer = setTimeout(tryLeave, minMs - elapsed);
    return;
  }
  leave();
}

function finish(root, landed) {
  root?.remove();
  state = 'gone';
  const callbacks = [...goneCallbacks];
  goneCallbacks.clear();
  callbacks.forEach((cb) => {
    try {
      cb(landed);
    } catch (err) {
      console.error('[bootSplash] onSplashGone callback failed:', err);
    }
  });
}

function leave() {
  if (state !== 'showing') return;
  state = 'leaving';
  clearTimeout(checkTimer);
  try { sessionStorage.setItem('unis-splash-seen', '1'); } catch { /* private mode */ }

  const root = splashEl();
  if (!root) { finish(null, false); return; }
  root.classList.add('is-leaving');
  root.setAttribute('aria-busy', 'false');

  if (typeof root.animate !== 'function') {
    finish(root, false);
    return;
  }

  // The wordmark lifts a touch and softens while the whole stage fades.
  const mark = root.querySelector('.us-mark');
  if (mark && !reducedMotion()) {
    mark.animate(
      [
        { transform: 'scale(1)', filter: 'blur(0px)' },
        { transform: 'scale(1.04)', filter: 'blur(6px)' },
      ],
      { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
    );
  }
  root.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: reducedMotion() ? 260 : 420,
    delay: reducedMotion() ? 0 : 60,
    easing: 'ease-in-out',
    fill: 'forwards',
  }).finished.then(() => finish(root, false), () => finish(root, false));
}
