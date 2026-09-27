// Unit tests for the header logo's spring motion (stepLogoMotion).
import { describe, it, expect } from 'vitest';
import { stepLogoMotion, createLogoMotionState, LOGO_MOTION } from './logoMotion';

const fresh = createLogoMotionState;
const quiet = { kickHit: 0, snareHit: 0, snareSide: 1, energy: 0.5, dt: 1 / 60 };

function simulate(first, frames = 40) {
  const m = fresh();
  const trace = [];
  stepLogoMotion(m, { ...quiet, ...first });
  trace.push({ ...m });
  for (let i = 1; i < frames; i++) {
    stepLogoMotion(m, quiet);
    trace.push({ ...m });
  }
  return trace;
}

describe('stepLogoMotion', () => {
  it('a full-strength kick peaks at about kickScale, quickly', () => {
    const trace = simulate({ kickHit: 1 });
    const peak = Math.max(...trace.map((s) => s.scale));
    const peakFrame = trace.findIndex((s) => s.scale === peak);
    expect(peak).toBeGreaterThan(LOGO_MOTION.kickScale * 0.85);
    expect(peak).toBeLessThan(LOGO_MOTION.kickScale * 1.15);
    expect(peakFrame).toBeLessThanOrEqual(4); // ≤ ~70ms: reads as "on the beat"
  });

  it('settles back to rest well before the next beat at 90 BPM', () => {
    const trace = simulate({ kickHit: 1 }, 30); // 500ms
    expect(Math.abs(trace[trace.length - 1].scale)).toBeLessThan(0.005);
  });

  it('snares tilt toward snareSide and flash the glow', () => {
    const left = simulate({ snareHit: 1, snareSide: -1 });
    const right = simulate({ snareHit: 1, snareSide: 1 });
    expect(Math.min(...left.map((s) => s.tilt))).toBeLessThan(-LOGO_MOTION.snareTiltDeg * 0.8);
    expect(Math.max(...right.map((s) => s.tilt))).toBeGreaterThan(LOGO_MOTION.snareTiltDeg * 0.8);
    expect(left[0].glow).toBeGreaterThan(0.9);
    expect(Math.min(...right.map((s) => s.lift))).toBeLessThan(0); // hops up
  });

  it('hits are bigger in loud sections than quiet ones', () => {
    const peakAt = (energy) => Math.max(...simulate({ kickHit: 1, energy }).map((s) => s.scale));
    expect(peakAt(1)).toBeGreaterThan(peakAt(0) * 1.5);
  });

  it('stays stable on a long frame (backgrounded tab)', () => {
    const m = fresh();
    stepLogoMotion(m, { ...quiet, kickHit: 1, dt: 0.05 });
    for (let i = 0; i < 20; i++) stepLogoMotion(m, { ...quiet, dt: 0.05 });
    expect(Number.isFinite(m.scale)).toBe(true);
    expect(Math.abs(m.scale)).toBeLessThan(0.01);
  });
});
