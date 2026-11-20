// consent.js — the visitor's cookie choices (Nov 2026).
//
// One small store in localStorage ('unis-consent'), read by the cookie banner
// (src/CookieConsent.jsx) and by anything that loads a third-party script.
//
//   essential    always on: sign-in token, theme, queue, and this choice
//   analytics    off until the visitor allows it
//   advertising  off until the visitor allows it; forced off while the
//                browser sends Global Privacy Control (GPC), which twelve
//                US states require sites to honor as an opt-out
//
// RULE for every new third-party script (Google Analytics, AdSense, a pixel):
// load it only when hasConsent('analytics') / hasConsent('advertising') is
// true, and listen with onConsentChange so a later "yes" can load it without
// a reload. Never load it first and ask later.
//
// The choice is kept for a year. Bump CONSENT_VERSION when Unis adds a new
// kind of cookie: everyone is asked once more, and only then.

import { useMemo, useSyncExternalStore } from 'react';

const KEY = 'unis-consent';
export const CONSENT_VERSION = 1;
const KEEP_MS = 365 * 24 * 60 * 60 * 1000;
export const OPEN_COOKIE_SETTINGS = 'unis:cookie-settings';
const CHANGE = 'unis:consent-change';

/** True while the browser is sending a Global Privacy Control signal. */
export function gpcOn() {
  try {
    return typeof navigator !== 'undefined' && navigator.globalPrivacyControl === true;
  } catch {
    return false;
  }
}

// Used when the browser blocks storage, so a choice still holds for the visit.
let memoryRaw = null;

function readRaw() {
  try {
    return localStorage.getItem(KEY) ?? memoryRaw;
  } catch {
    return memoryRaw; // storage blocked (private mode on some browsers)
  }
}

/** Turns the stored string into a choice, or null if there's no current one. */
export function parseConsent(raw) {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw);
    if (!c || c.v !== CONSENT_VERSION) return null;
    const at = Date.parse(c.decidedAt);
    if (Number.isNaN(at) || Date.now() - at > KEEP_MS) return null;
    return {
      v: c.v,
      analytics: c.analytics === true,
      // A GPC signal always wins, even over an older "yes".
      advertising: c.advertising === true && !gpcOn(),
      decidedAt: c.decidedAt,
    };
  } catch {
    return null;
  }
}

/** The current choice, or null if the visitor hasn't decided yet. */
export function readConsent() {
  return parseConsent(readRaw());
}

/** 'essential' is always true; other categories need an explicit yes. */
export function hasConsent(category) {
  if (category === 'essential') return true;
  const c = readConsent();
  return Boolean(c && c[category]);
}

/** Saves a choice and tells everything listening. Returns what was saved. */
export function saveConsent({ analytics = false, advertising = false } = {}) {
  const choice = {
    v: CONSENT_VERSION,
    analytics: Boolean(analytics),
    advertising: Boolean(advertising) && !gpcOn(),
    gpc: gpcOn(),
    decidedAt: new Date().toISOString(),
  };
  memoryRaw = JSON.stringify(choice);
  try {
    localStorage.setItem(KEY, memoryRaw);
  } catch (err) {
    // Still applies for this visit; it just won't be remembered.
    console.warn('[Consent] could not store the choice:', err?.message);
  }
  console.info('[Consent] saved:', { analytics: choice.analytics, advertising: choice.advertising, gpc: choice.gpc });
  try {
    window.dispatchEvent(new CustomEvent(CHANGE, { detail: choice }));
  } catch { /* no window (tests) */ }
  return choice;
}

/** Calls cb(choice) whenever the choice changes, here or in another tab. */
export function onConsentChange(cb) {
  const onLocal = () => cb(readConsent());
  const onStorage = (e) => { if (e.key === KEY) cb(readConsent()); };
  window.addEventListener(CHANGE, onLocal);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE, onLocal);
    window.removeEventListener('storage', onStorage);
  };
}

/** Opens Cookie settings from anywhere (footer, Cookie Policy page). */
export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_SETTINGS));
}

/** React hook: the current choice (or null), kept in sync. */
export function useConsent() {
  const raw = useSyncExternalStore(
    (notify) => onConsentChange(notify),
    readRaw,
    () => null,
  );
  return useMemo(() => parseConsent(raw), [raw]);
}
