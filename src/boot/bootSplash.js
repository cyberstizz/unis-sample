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
//   • The full intro gets to finish its "lights on" moment first (about 2.1s
//     from the moment the page started loading). A reload in the same
//     session (quick mode) or reduced motion needs only half a second.
//   • It never stays longer than 9 seconds, whatever is still loading.
//   • Leaving: the wordmark flies into the header logo and hands over to it,
//     while the dark stage dissolves. If there is no header on the page
//     (sign-in, the pitch pages) it fades up and away instead.
//
// onSplashGone(cb) lets other code wait for it: the header logo plays its
// stretch the moment the wordmark lands, and the welcome tour waits until
// the stage is clear.
//
// In tests (and anywhere #unis-splash is missing) every function here is a
// harmless no-op, and onSplashGone calls back straight away.
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react';

const MIN_FULL_MS = 2150;   // the intro's lights-on moment has played
const MIN_QUICK_MS = 500;
const MAX_MS = 9000;
const SETTLE_MS = 140;      // let one loading state hand over to the next

// The header logo is a square image with the wordmark in the middle. This is
// where the letters sit inside it (from the logo files themselves).
const WORDMARK_IN_LOGO = { x: 0.04531, y: 0.36016, w: 0.90938, h: 0.20234 };

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
 * Calls back once the splash is gone: cb(true) when the wordmark landed in
 * the header logo, cb(false) otherwise (including when there was no splash).
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

// Where the letters of the header logo are on screen, or null when there is
// no visible header logo to land in.
function headerTarget() {
  const img = document.querySelector('.header-logo .logo-img');
  if (!img) return null;
  const r = img.getBoundingClientRect();
  const cs = getComputedStyle(img);
  const pl = parseFloat(cs.paddingLeft) || 0;
  const pr = parseFloat(cs.paddingRight) || 0;
  const pt = parseFloat(cs.paddingTop) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;
  const w = r.width - pl - pr;
  const h = r.height - pt - pb;
  const visible = w > 8 && h > 8 && r.bottom > 0 && r.top < window.innerHeight
    && cs.visibility !== 'hidden' && cs.display !== 'none';
  if (!visible) return null;
  return {
    img,
    left: r.left + pl + w * WORDMARK_IN_LOGO.x,
    top: r.top + pt + h * WORDMARK_IN_LOGO.y,
    width: w * WORDMARK_IN_LOGO.w,
    height: h * WORDMARK_IN_LOGO.h,
  };
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

  const bg = root.querySelector('.us-bg');
  const word = root.querySelector('.us-word');
  const floor = root.querySelector('.us-floor');

  if (typeof root.animate !== 'function' || !word || !bg) {
    finish(root, false);
    return;
  }

  // Reduced motion: a plain crossfade.
  if (reducedMotion()) {
    root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease', fill: 'forwards' })
      .finished.then(() => finish(root, false), () => finish(root, false));
    return;
  }

  floor?.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });

  const target = headerTarget();

  if (!target) {
    // No header to land in: the wordmark lifts and dissolves with the stage.
    word.animate(
      [
        { transform: 'scale(1)', opacity: 1, filter: 'blur(0px)' },
        { transform: 'scale(1.06)', opacity: 0, filter: 'blur(8px)' },
      ],
      { duration: 460, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' },
    );
    bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, delay: 80, easing: 'ease-in-out', fill: 'forwards' })
      .finished.then(() => finish(root, false), () => finish(root, false));
    return;
  }

  // Fly into the header logo. The header logo hides until the hand-over so
  // there are never two logos on screen.
  const from = word.getBoundingClientRect();
  const scale = target.width / from.width;
  const dx = (target.left + target.width / 2) - (from.left + from.width / 2);
  const dy = (target.top + target.height / 2) - (from.top + from.height / 2);
  const FLIGHT = 780;
  const HANDOVER_AT = 560;

  const headerImg = target.img;
  const prevOpacity = headerImg.style.opacity;
  headerImg.style.opacity = '0';

  word.animate(
    [
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: `translate(${dx * 0.1}px, ${dy * 0.1 - 6}px) scale(${1 - (1 - scale) * 0.12})`, offset: 0.22 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
    ],
    { duration: FLIGHT, easing: 'cubic-bezier(.7,0,.16,1)', fill: 'forwards' },
  );
  bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 560, delay: 180, easing: 'ease-in-out', fill: 'forwards' });

  let reveal = null;
  setTimeout(() => {
    word.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FLIGHT - HANDOVER_AT, easing: 'ease-out', fill: 'forwards' });
    reveal = headerImg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FLIGHT - HANDOVER_AT, easing: 'ease-out', fill: 'forwards' });
  }, HANDOVER_AT);

  setTimeout(() => {
    headerImg.style.opacity = prevOpacity;
    reveal?.cancel();
    finish(root, true);
  }, FLIGHT + 20);
}
