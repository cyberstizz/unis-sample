// ============================================================================
// periodBounds.js — single source of truth for award period math.
//
// WHY THIS FILE EXISTS
// --------------------
// An award period is only meaningful once it has CLOSED. Asking the backend
// for an open period is not a harmless empty result: `getPeriodLeaderboard`
// auto-populates missing awards, so a request for an unfinished period makes
// the server persist a permanent Award row stamped with a future awardDate,
// computed from partial data. `existsAwardForCategory` then blocks the real
// cron from ever recomputing it. One stray click freezes a bogus winner.
//
// Every "is this period over?" decision in the app routes through here so the
// rule can never drift between the page, the picker, and the tests.
//
// All math is LOCAL time. Date#toISOString() converts to UTC, which in New York
// rolls the date forward after 8pm EDT — that is how "yesterday" silently
// became "today" in the old milestones max-date calculation.
// ============================================================================

export const INTERVALS = ['daily', 'weekly', 'monthly', 'quarterly', 'midterm', 'annual'];

/** Format a Date as YYYY-MM-DD using local calendar fields. Never UTC. */
export const toLocalISO = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Parse YYYY-MM-DD into a local Date at midnight. Returns null if unparseable. */
export const fromLocalISO = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return null;
  const [y, m, d] = dateString.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

/** Midnight today, local. Injectable for tests. */
const startOfToday = (now = new Date()) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate());

/** Monday of the week containing `date` (ISO weeks: Mon–Sun). */
const mondayOf = (date) => {
  const dow = date.getDay();               // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - back);
};

/**
 * The full calendar window an interval covers for a given anchor date.
 * Any date inside the period resolves to the same window, so callers can pass
 * either a user selection or a period end date interchangeably.
 *
 * @returns {{ start: Date, end: Date } | null}
 */
export const getPeriodBounds = (dateString, interval) => {
  const anchor = fromLocalISO(dateString);
  if (!anchor) return null;

  const y = anchor.getFullYear();
  const m = anchor.getMonth();

  switch (interval) {
    case 'daily':
      return { start: new Date(y, m, anchor.getDate()), end: new Date(y, m, anchor.getDate()) };

    case 'weekly': {
      const start = mondayOf(anchor);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { start, end };
    }

    case 'monthly':
      return { start: new Date(y, m, 1), end: new Date(y, m + 1, 0) };

    case 'quarterly': {
      const qStart = Math.floor(m / 3) * 3;
      return { start: new Date(y, qStart, 1), end: new Date(y, qStart + 3, 0) };
    }

    case 'midterm': {
      const hStart = m <= 5 ? 0 : 6;
      return { start: new Date(y, hStart, 1), end: new Date(y, hStart + 6, 0) };
    }

    case 'annual':
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31) };

    default:
      return { start: new Date(y, m, anchor.getDate()), end: new Date(y, m, anchor.getDate()) };
  }
};

/** Period bounds as YYYY-MM-DD strings — the shape the API wants. */
export const getPeriodRange = (dateString, interval) => {
  const bounds = getPeriodBounds(dateString, interval);
  if (!bounds) return { startDate: null, endDate: null };
  return { startDate: toLocalISO(bounds.start), endDate: toLocalISO(bounds.end) };
};

/**
 * True only when the period has fully elapsed.
 * A period ending today is NOT closed — the day is still accruing plays,
 * votes and likes, so any winner computed now could be wrong by midnight.
 */
export const isPeriodComplete = (dateString, interval, now = new Date()) => {
  const bounds = getPeriodBounds(dateString, interval);
  if (!bounds) return false;
  return bounds.end.getTime() < startOfToday(now).getTime();
};

/**
 * The last date the user is allowed to select for a given interval —
 * i.e. the end of the most recent CLOSED period.
 *
 *   daily      → yesterday
 *   weekly     → the Sunday before the current week's Monday
 *   monthly    → last day of last month
 *   quarterly  → last day of last quarter
 *   midterm    → last day of last half
 *   annual     → Dec 31 of last year
 *
 * Doubles as the `maxDate` for IntervalDatePicker, which derives its disabled
 * years/months/quarters from it.
 */
export const getLastCompletedPeriodEnd = (interval, now = new Date()) => {
  const today = startOfToday(now);
  const y = today.getFullYear();
  const m = today.getMonth();

  switch (interval) {
    case 'daily':
      return toLocalISO(new Date(y, m, today.getDate() - 1));

    case 'weekly': {
      const thisMonday = mondayOf(today);
      return toLocalISO(new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 1));
    }

    case 'monthly':
      return toLocalISO(new Date(y, m, 0));           // day 0 of this month = last day of previous

    case 'quarterly': {
      const qStart = Math.floor(m / 3) * 3;
      return toLocalISO(new Date(y, qStart, 0));
    }

    case 'midterm': {
      const hStart = m <= 5 ? 0 : 6;
      return toLocalISO(new Date(y, hStart, 0));
    }

    case 'annual':
      return toLocalISO(new Date(y - 1, 11, 31));

    default:
      return toLocalISO(new Date(y, m, today.getDate() - 1));
  }
};

/**
 * Force a date into legal territory for an interval.
 *
 * This is the fix for the cross-interval leak: the old page recomputed maxDate
 * when `interval` changed but never revisited `selectedDate`, so picking
 * "yesterday" on Daily and then switching to Annual carried 2026-07-27 across
 * and resolved to Jan 1 – Dec 31 of the CURRENT, unfinished year.
 *
 * Returns the input untouched when its period is already closed, otherwise the
 * end of the most recent closed period.
 */
export const clampToCompletedPeriod = (dateString, interval, now = new Date()) => {
  if (!dateString) return getLastCompletedPeriodEnd(interval, now);
  if (isPeriodComplete(dateString, interval, now)) return dateString;
  return getLastCompletedPeriodEnd(interval, now);
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Human label for the period an anchor date falls in. "Q2 2026", "Week of Jun 15 – 21, 2026". */
export const formatPeriodLabel = (dateString, interval) => {
  const bounds = getPeriodBounds(dateString, interval);
  if (!bounds) return '';
  const { start, end } = bounds;

  switch (interval) {
    case 'daily':
      return `${DAYS[start.getDay()]}, ${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
    case 'weekly':
      return `Week of ${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    case 'monthly':
      return `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
    case 'quarterly':
      return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
    case 'midterm':
      return `${start.getMonth() === 0 ? 'First' : 'Second'} half of ${start.getFullYear()}`;
    case 'annual':
      return `${start.getFullYear()}`;
    default:
      return `${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  }
};

/** Compact range caption shown next to the picker: "Apr 1 – Jun 30, 2026". */
export const formatPeriodRange = (dateString, interval) => {
  const bounds = getPeriodBounds(dateString, interval);
  if (!bounds) return '';
  const { start, end } = bounds;
  const short = (d) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  if (interval === 'daily') return `${short(start)}, ${start.getFullYear()}`;
  return `${short(start)} – ${short(end)}, ${end.getFullYear()}`;
};

/**
 * When a period is still open, this is the day it closes — used by the
 * "still running" state so the copy can tell the user exactly when to return.
 */
export const getPeriodCloseLabel = (dateString, interval) => {
  const bounds = getPeriodBounds(dateString, interval);
  if (!bounds) return '';
  const { end } = bounds;
  return `${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
};