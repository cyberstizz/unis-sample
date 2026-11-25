// src/utils/sleepTimer.js
//
// The sleep timer: stop the music after N minutes, or at the end of this song.
// The last 10 seconds fade out (through the audio graph when the song plays
// through it, otherwise the element's volume), then playback pauses and the
// volume is put back. Session only: a reload clears it.

import { useSyncExternalStore } from 'react';
import { getContext, laneFor, isRouted } from './audioGraph';

const FADE_SEC = 10;
let state = { mode: null, endsAt: null };   // mode: null | 'time' | 'end'
const listeners = new Set();
let timer = null;
let mediaGetter = () => null;
let fading = null;

function set(next) {
  state = next;
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

export function subscribeSleep(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getSleep() { return state; }
export function useSleepTimer() { return useSyncExternalStore(subscribeSleep, getSleep, getSleep); }

/** player.jsx tells the timer how to find the playing element. */
export function bindSleepMedia(getter) { mediaGetter = getter; }

export function startSleep(minutes) {
  cancelFade();
  set({ mode: 'time', endsAt: Date.now() + minutes * 60000 });
  run();
}

export function sleepAtEndOfSong() {
  cancelFade();
  set({ mode: 'end', endsAt: null });
  run();
}

export function cancelSleep() {
  cancelFade();
  set({ mode: null, endsAt: null });
  stop();
}

/** Seconds left (time mode), or for 'end' the time left in the song. */
export function sleepRemaining() {
  if (state.mode === 'time') return Math.max(0, (state.endsAt - Date.now()) / 1000);
  if (state.mode === 'end') {
    const el = mediaGetter();
    return el && Number.isFinite(el.duration) ? Math.max(0, el.duration - el.currentTime) : null;
  }
  return null;
}

function stop() { if (timer) { clearInterval(timer); timer = null; } }

function run() {
  stop();
  timer = setInterval(() => {
    if (!state.mode) { stop(); return; }
    const left = sleepRemaining();
    listeners.forEach((fn) => { try { fn(); } catch { /* noop */ } });
    if (left == null) return;
    const el = mediaGetter();
    if (left <= FADE_SEC && !fading && el && !el.paused) beginFade(el, left);
    if (left <= 0.15) finish();
  }, 250);
}

function beginFade(el, seconds) {
  const lane = isRouted(el) ? laneFor(el) : null;
  const ctx = getContext();
  if (lane && ctx) {
    const now = ctx.currentTime;
    const p = lane.level.gain;
    const from = p.value;
    try { p.cancelScheduledValues(now); } catch { /* noop */ }
    p.setValueAtTime(from, now);
    p.linearRampToValueAtTime(0.0001, now + Math.max(0.5, seconds));
    fading = { el, restore: () => { try { p.cancelScheduledValues(ctx.currentTime); p.setValueAtTime(from, ctx.currentTime); } catch { /* noop */ } } };
    return;
  }
  const startVol = el.volume;
  const t0 = performance.now();
  const id = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / (Math.max(0.5, seconds) * 1000));
    try { el.volume = startVol * (1 - k); } catch { /* iPhone: volume is read-only, it just stops */ }
  }, 100);
  fading = { el, restore: () => { clearInterval(id); try { el.volume = startVol; } catch { /* noop */ } } };
}

function cancelFade() {
  if (fading) { fading.restore(); fading = null; }
}

function finish() {
  const el = fading?.el || mediaGetter();
  try { el?.pause(); } catch { /* noop */ }
  cancelFade();
  set({ mode: null, endsAt: null });
  stop();
  // The player shows "Sleep timer ended" (player.jsx listens for this).
  try { window.dispatchEvent(new CustomEvent('unis:sleep-ended')); } catch { /* noop */ }
}

// Any touch during the fade cancels it and keeps the music going.
export function sleepFading() { return !!fading; }
export function cancelSleepFade() { if (fading) { cancelSleep(); } }

export function formatSleep(sec) {
  if (sec == null) return '';
  const s = Math.ceil(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
