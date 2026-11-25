// src/utils/mixPreview.js
//
// The Mix editor's Preview: plays one transition on two private decks,
// starting two bars before the mix, exactly as the engine would play it
// (same plan, same curves, same beat lock). The main player pauses while a
// preview runs.

import { laneFor, resetLane, setLaneLevel, ensureRunning, getContext } from './audioGraph';
import { scheduleBlend, expectedB } from './mixAutomation';

let decks = null;
let current = null;

function getDecks() {
  if (!decks) {
    decks = [0, 1].map(() => {
      const el = document.createElement('audio');
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.style.display = 'none';
      el.className = 'hidden-media unis-preview-deck';
      document.body.appendChild(el);
      return el;
    });
  }
  return decks;
}

function waitReady(el) {
  return new Promise((resolve) => {
    if (el.readyState >= 2) { resolve(true); return; }
    const done = (ok) => { el.removeEventListener('canplay', on); el.removeEventListener('error', off); resolve(ok); };
    const on = () => done(true);
    const off = () => done(false);
    el.addEventListener('canplay', on);
    el.addEventListener('error', off);
    setTimeout(() => done(el.readyState >= 2), 8000);
  });
}

/**
 * Starts a preview. Returns a stop() function.
 *   urlA, urlB     the two songs
 *   plan           mixPlanner plan (A-time)
 *   gainA, gainB   levelling gains
 *   onTime(x)      A-time, about 5 times a second (for the playhead)
 *   onEnd()        when it finishes or is stopped
 *   onError(msg)
 */
export async function startPreview({ urlA, urlB, plan, gainA = 1, gainB = 1, onTime, onEnd, onError }) {
  stopPreview();
  const ok = await ensureRunning(1500);
  if (!ok) { onError?.('Tap Preview again to allow sound.'); onEnd?.(); return () => {}; }
  const [A, B] = getDecks();
  const laneA = laneFor(A); const laneB = laneFor(B);
  if (!laneA || !laneB) { onError?.('This browser can’t preview mixes.'); onEnd?.(); return () => {}; }
  const token = {};
  current = token;

  resetLane(laneA, { keepLevel: false });
  resetLane(laneB, { keepLevel: false });
  laneB.fade.gain.setValueAtTime(0, getContext().currentTime);
  setLaneLevel(laneA, gainA, 0.02);
  setLaneLevel(laneB, gainB, 0.02);

  const from = Math.max(0, plan.aStart - 2 * (plan.barSec || 2));
  const until = Math.max(plan.aEnd, plan.windowEnd) + 2 * (plan.barSec || 2);
  A.src = urlA; B.src = urlB;
  A.currentTime = from;
  try { B.preservesPitch = true; B.webkitPreservesPitch = true; } catch { /* noop */ }
  B.playbackRate = plan.rate || 1;
  const [okA, okB] = await Promise.all([waitReady(A), waitReady(B)]);
  if (current !== token) return () => {};
  if (!okA || !okB) { onError?.('Couldn’t load the songs for a preview.'); finish(); return () => {}; }

  try { await A.play(); } catch { onError?.('Tap Preview again to allow sound.'); finish(); return () => {}; }
  scheduleBlend(laneA, laneB, plan, A.currentTime, gainB);

  let bStarted = false;
  let glideAt = null;
  const iv = setInterval(() => {
    if (current !== token) { clearInterval(iv); return; }
    const x = A.currentTime;
    onTime?.(x);
    if (!bStarted && x >= plan.bStartAt - 0.6) {
      bStarted = true;
      B.currentTime = Math.max(0, expectedB(plan, x + 0.05));
      B.play().catch(() => {});
    }
    if (bStarted && x >= plan.bStartAt && x < plan.aEnd && plan.rate) {
      const err = B.currentTime - expectedB(plan, x);
      if (Math.abs(err) > 0.3) B.currentTime = expectedB(plan, x);
      else B.playbackRate = plan.rate * (1 - Math.max(-0.03, Math.min(0.03, err * 0.8)));
    }
    if (x >= plan.aEnd && glideAt == null) glideAt = performance.now();
    if (glideAt != null && plan.glideSec) {
      const k = Math.min(1, (performance.now() - glideAt) / (plan.glideSec * 1000));
      B.playbackRate = plan.rate + (1 - plan.rate) * k;
    }
    // A-time keeps counting on the outgoing deck until the end of the preview window.
    if (x >= until || A.ended) finish();
  }, 200);

  function finish() {
    clearInterval(iv);
    if (current === token) current = null;
    [A, B].forEach((d) => { try { d.pause(); } catch { /* noop */ } });
    resetLane(laneA, { keepLevel: false });
    resetLane(laneB, { keepLevel: false });
    onEnd?.();
  }
  token.stop = finish;
  return finish;
}

export function stopPreview() {
  if (current?.stop) current.stop();
  current = null;
}
