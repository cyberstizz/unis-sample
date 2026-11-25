// src/utils/mixAutomation.js
//
// Writes a transition plan's curves onto two lanes of the audio graph, on the
// audio clock. Shared by the playback engine and the Mix editor's Preview, so
// a preview sounds exactly like the real thing.

import { getContext } from './audioGraph';

const STEP = 0.04;   // seconds between automation points

/**
 * laneA, laneB  lanes from audioGraph.laneFor
 * plan          from mixPlanner.planTransition
 * aNow          the outgoing song's current time (A-time) right now
 * gainB         levelling gain for the incoming song
 */
export function scheduleBlend(laneA, laneB, plan, aNow, gainB = 1) {
  const c = getContext();
  if (!c || !laneA || !laneB || !plan) return;
  const acNow = c.currentTime;
  const at = (x) => acNow + (x - aNow);
  const cv = plan.curves;
  const end = Math.max(plan.aEnd, plan.windowEnd, cv.echoEnd || 0) + 0.2;
  laneA.delay.delayTime.setValueAtTime(Math.max(0.05, (plan.beatSec || 0.5) / 2), acNow);
  laneB.level.gain.setValueAtTime(gainB, acNow);
  const sched = (param, f, map) => {
    try { param.cancelScheduledValues(acNow); } catch { /* noop */ }
    let first = true;
    for (let x = aNow; x <= end; x += STEP) {
      const v = map ? map(f(x)) : f(x);
      if (first) { param.setValueAtTime(v, at(x)); first = false; } else param.linearRampToValueAtTime(v, at(x));
    }
  };
  sched(laneA.fade.gain, cv.gA);
  sched(laneB.fade.gain, cv.gB);
  sched(laneA.lows.gain, cv.loA, (v) => -26 * (1 - v));
  sched(laneB.lows.gain, cv.loB, (v) => -26 * (1 - v));
  sched(laneA.hp.frequency, cv.hpA);
  sched(laneB.lp.frequency, cv.lpB);
  sched(laneA.send.gain, cv.snA);
  sched(laneA.feedback.gain, cv.fbA);
}

/** Where B should be (its own media time) when A is at x, during the blend. */
export function expectedB(plan, x) {
  return plan.bStart + (x - plan.bStartAt) * (plan.rate || 1);
}
