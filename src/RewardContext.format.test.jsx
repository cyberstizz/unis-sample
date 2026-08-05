// Proves the reward score is EXACT — the old K/M rounding made a real +25
// move look frozen (7,325 and 7,350 both rendered "7.3K"). formatScore now
// renders every point with thousands grouping.

import { describe, it, expect } from 'vitest';
import { formatScore } from './RewardContext';

describe('formatScore (exact)', () => {
  it('groups thousands with commas, no abbreviation', () => {
    expect(formatScore(7325)).toBe('7,325');
    expect(formatScore(7350)).toBe('7,350');
    expect(formatScore(1204)).toBe('1,204');
    expect(formatScore(1_250_000)).toBe('1,250,000');
  });

  it('distinguishes a +25 move that the old abbreviation flattened', () => {
    // Both used to render "7.3K" — now they differ.
    expect(formatScore(7325)).not.toBe(formatScore(7350));
  });

  it('handles small and non-finite values safely', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(42)).toBe('42');
    expect(formatScore(undefined)).toBe('0');
    expect(formatScore(null)).toBe('0');
    expect(formatScore('not-a-number')).toBe('0');
  });
});