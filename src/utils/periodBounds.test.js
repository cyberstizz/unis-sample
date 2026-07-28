import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getPeriodRange,
  isPeriodComplete,
  getLastCompletedPeriodEnd,
  clampToCompletedPeriod,
  toLocalISO,
  fromLocalISO,
  formatPeriodLabel,
} from './periodBounds';

// Tuesday 28 July 2026, 21:30 local.
// The evening hour matters: Date#toISOString() would have rolled this to
// 29 July UTC in New York, which is exactly how the old max-date calculation
// let "yesterday" become "today".
const NOW = new Date(2026, 6, 28, 21, 30);

describe('periodBounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('local date handling', () => {
    it('formats without drifting to UTC in the evening', () => {
      expect(toLocalISO(new Date(2026, 6, 28, 23, 59))).toBe('2026-07-28');
    });

    it('round-trips a date string', () => {
      expect(toLocalISO(fromLocalISO('2026-02-29') || new Date(2026, 1, 29))).toBe('2026-03-01');
      expect(toLocalISO(fromLocalISO('2026-03-01'))).toBe('2026-03-01');
    });

    it('returns null for unparseable input', () => {
      expect(fromLocalISO('')).toBeNull();
      expect(fromLocalISO(null)).toBeNull();
      expect(fromLocalISO('not-a-date')).toBeNull();
    });
  });

  describe('getPeriodRange', () => {
    it('collapses daily to a single day', () => {
      expect(getPeriodRange('2026-07-27', 'daily'))
        .toEqual({ startDate: '2026-07-27', endDate: '2026-07-27' });
    });

    it('expands weekly to Monday through Sunday', () => {
      expect(getPeriodRange('2026-07-23', 'weekly'))
        .toEqual({ startDate: '2026-07-20', endDate: '2026-07-26' });
    });

    it('anchors a Sunday to the week that is ending, not the one starting', () => {
      expect(getPeriodRange('2026-07-26', 'weekly'))
        .toEqual({ startDate: '2026-07-20', endDate: '2026-07-26' });
    });

    it('expands monthly across a leap February', () => {
      expect(getPeriodRange('2028-02-10', 'monthly'))
        .toEqual({ startDate: '2028-02-01', endDate: '2028-02-29' });
    });

    it('expands quarterly to quarter boundaries', () => {
      expect(getPeriodRange('2026-05-14', 'quarterly'))
        .toEqual({ startDate: '2026-04-01', endDate: '2026-06-30' });
    });

    it('expands midterm to half-year boundaries', () => {
      expect(getPeriodRange('2026-09-09', 'midterm'))
        .toEqual({ startDate: '2026-07-01', endDate: '2026-12-31' });
    });

    it('expands annual to the full calendar year', () => {
      expect(getPeriodRange('2025-06-15', 'annual'))
        .toEqual({ startDate: '2025-01-01', endDate: '2025-12-31' });
    });
  });

  describe('isPeriodComplete', () => {
    it('treats yesterday as complete and today as still open', () => {
      expect(isPeriodComplete('2026-07-27', 'daily')).toBe(true);
      expect(isPeriodComplete('2026-07-28', 'daily')).toBe(false);
    });

    it('treats the current week as open', () => {
      expect(isPeriodComplete('2026-07-27', 'weekly')).toBe(false);
      expect(isPeriodComplete('2026-07-26', 'weekly')).toBe(true);
    });

    it('treats the current month as open', () => {
      expect(isPeriodComplete('2026-07-01', 'monthly')).toBe(false);
      expect(isPeriodComplete('2026-06-30', 'monthly')).toBe(true);
    });

    it('treats the current quarter as open', () => {
      expect(isPeriodComplete('2026-08-15', 'quarterly')).toBe(false);
      expect(isPeriodComplete('2026-06-30', 'quarterly')).toBe(true);
    });

    it('treats the current half as open', () => {
      expect(isPeriodComplete('2026-12-31', 'midterm')).toBe(false);
      expect(isPeriodComplete('2026-06-30', 'midterm')).toBe(true);
    });

    // The reported bug, pinned.
    it('treats the current year as open and last year as complete', () => {
      expect(isPeriodComplete('2026-03-01', 'annual')).toBe(false);
      expect(isPeriodComplete('2025-12-31', 'annual')).toBe(true);
    });
  });

  describe('getLastCompletedPeriodEnd', () => {
    it.each([
      ['daily', '2026-07-27'],
      ['weekly', '2026-07-26'],
      ['monthly', '2026-06-30'],
      ['quarterly', '2026-06-30'],
      ['midterm', '2026-06-30'],
      ['annual', '2025-12-31'],
    ])('resolves %s to %s', (interval, expected) => {
      expect(getLastCompletedPeriodEnd(interval)).toBe(expected);
    });

    it('never returns a period that is still open', () => {
      for (const interval of ['daily', 'weekly', 'monthly', 'quarterly', 'midterm', 'annual']) {
        expect(isPeriodComplete(getLastCompletedPeriodEnd(interval), interval)).toBe(true);
      }
    });

    it('rolls over correctly on the first day of a new year', () => {
      vi.setSystemTime(new Date(2027, 0, 1, 9, 0));
      expect(getLastCompletedPeriodEnd('annual')).toBe('2026-12-31');
      expect(getLastCompletedPeriodEnd('monthly')).toBe('2026-12-31');
      expect(getLastCompletedPeriodEnd('quarterly')).toBe('2026-12-31');
      expect(getLastCompletedPeriodEnd('midterm')).toBe('2026-12-31');
    });

    it('resolves the previous week when today is a Monday', () => {
      vi.setSystemTime(new Date(2026, 6, 27, 9, 0)); // Mon 27 Jul
      expect(getLastCompletedPeriodEnd('weekly')).toBe('2026-07-26');
    });
  });

  describe('clampToCompletedPeriod — the cross-interval leak', () => {
    // Pick "yesterday" on Daily, then switch interval. The old page kept the
    // date and silently resolved it into a period that had not finished.
    it.each([
      ['weekly', '2026-07-26'],
      ['monthly', '2026-06-30'],
      ['quarterly', '2026-06-30'],
      ['midterm', '2026-06-30'],
      ['annual', '2025-12-31'],
    ])('re-anchors a daily selection when switching to %s', (interval, expected) => {
      expect(clampToCompletedPeriod('2026-07-27', interval)).toBe(expected);
    });

    it('leaves an already-closed selection untouched', () => {
      expect(clampToCompletedPeriod('2025-12-31', 'annual')).toBe('2025-12-31');
      expect(clampToCompletedPeriod('2026-05-14', 'quarterly')).toBe('2026-05-14');
    });

    it('supplies a default when nothing is selected', () => {
      expect(clampToCompletedPeriod('', 'monthly')).toBe('2026-06-30');
      expect(clampToCompletedPeriod(null, 'daily')).toBe('2026-07-27');
    });

    it('is idempotent', () => {
      for (const interval of ['daily', 'weekly', 'monthly', 'quarterly', 'midterm', 'annual']) {
        const once = clampToCompletedPeriod('2026-07-27', interval);
        expect(clampToCompletedPeriod(once, interval)).toBe(once);
      }
    });
  });

  describe('formatPeriodLabel', () => {
    it('labels each interval in the archive voice', () => {
      expect(formatPeriodLabel('2026-07-27', 'daily')).toBe('Monday, July 27, 2026');
      expect(formatPeriodLabel('2026-07-26', 'weekly')).toBe('Week of July 20 – July 26, 2026');
      expect(formatPeriodLabel('2026-06-30', 'monthly')).toBe('June 2026');
      expect(formatPeriodLabel('2026-06-30', 'quarterly')).toBe('Q2 2026');
      expect(formatPeriodLabel('2026-06-30', 'midterm')).toBe('First half of 2026');
      expect(formatPeriodLabel('2025-12-31', 'annual')).toBe('2025');
    });
  });
});