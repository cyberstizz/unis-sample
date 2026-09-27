// Unit tests for the header logo pulse.
import { describe, it, expect } from 'vitest';
import { stepLogoMotion, createLogoMotionState, logoStyle, LOGO_MOTION } from './logoMotion';

const idle = { kickHit: 0, snareHit: 0, dt: 1 / 60 };

describe('logo pulse', () => {
  it('rests with no transform when nothing is hitting', () => {
    const m = createLogoMotionState();
    for (let i = 0; i < 30; i++) stepLogoMotion(m, idle);
    expect(logoStyle(m)).toEqual({ transform: '', filter: '' });
  });

  it('pops to full size on a kick', () => {
    const m = stepLogoMotion(createLogoMotionState(), { ...idle, kickHit: 0.4 });
    expect(logoStyle(m).transform).toBe(`scale(${(1 + LOGO_MOTION.popScale).toFixed(4)})`);
  });

  it('pops the same way on a snare', () => {
    const k = logoStyle(stepLogoMotion(createLogoMotionState(), { ...idle, kickHit: 1 }));
    const s = logoStyle(stepLogoMotion(createLogoMotionState(), { ...idle, snareHit: 1 }));
    expect(s).toEqual(k);
  });

  it('only ever grows then shrinks (no bounce, never below normal size)', () => {
    const m = stepLogoMotion(createLogoMotionState(), { ...idle, kickHit: 1 });
    let last = m.pulse;
    for (let i = 0; i < 40; i++) {
      stepLogoMotion(m, idle);
      expect(m.pulse).toBeLessThanOrEqual(last);
      expect(m.pulse).toBeGreaterThanOrEqual(0);
      last = m.pulse;
    }
  });

  it('is back at rest (under a pixel on the 92px logo) within ~0.5s', () => {
    const m = stepLogoMotion(createLogoMotionState(), { ...idle, kickHit: 1 });
    for (let i = 0; i < 30; i++) stepLogoMotion(m, idle);
    expect(m.pulse * LOGO_MOTION.popScale * 92).toBeLessThan(0.5);
  });

  it('a kick and snare together make one pop, not a bigger one', () => {
    const both = stepLogoMotion(createLogoMotionState(), { ...idle, kickHit: 1, snareHit: 1 });
    expect(both.pulse).toBe(1);
  });
});
