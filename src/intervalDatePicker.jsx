// ============================================================================
// IntervalDatePicker.jsx
//
// Picks the anchor date for an award period. The caller supplies maxDate as the
// end of the last CLOSED period (see utils/periodBounds.js). This component
// additionally refuses any period that has not closed, so a wrong maxDate from
// a future caller still cannot surface an open period. Two independent checks,
// because the cost of getting it wrong is a persisted phantom award row.
//
// WHY THE PANEL IS A PORTAL
//   It used to be `position: absolute` inside .custom-picker, which made its
//   width depend on the toggle's width. On a 386px phone that resolved to about
//   128px: the day grid overflowed its own card, columns collapsed to ~23px,
//   and with aspect-ratio:1 the tap targets were 23px square. That is why taps
//   missed. `position: fixed` would not have rescued it either — .ms-controls
//   carries backdrop-filter, which makes it the containing block for fixed
//   descendants, so the panel would still have been trapped inside the card.
//
//   The panel now renders through createPortal into document.body, where
//   nothing upstream can constrain it:
//     • ≥681px — anchored under the toggle, flipping above when short on room.
//     • ≤680px — a full-width bottom sheet. Tap targets are at least 40px.
//
//   Styles for the panel live under `.idp-layer` at the top level of the
//   stylesheet rather than nested inside `.interval-date-picker`, since the
//   portal moves it out of that subtree.
//
// YEAR NAVIGATION
//   The calendar header carries four controls — ‹‹ year, ‹ month, month ›,
//   year ››. Stepping back a year through twelve taps on a month arrow was not
//   navigation.
// ============================================================================

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './intervalDatePicker.scss';
import { fromLocalISO, toLocalISO, isPeriodComplete } from './utils/periodBounds';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const QUARTERS = [
  { label: 'Q1 (Jan-Mar)', value: 1, startMonth: 0, endMonth: 2 },
  { label: 'Q2 (Apr-Jun)', value: 2, startMonth: 3, endMonth: 5 },
  { label: 'Q3 (Jul-Sep)', value: 3, startMonth: 6, endMonth: 8 },
  { label: 'Q4 (Oct-Dec)', value: 4, startMonth: 9, endMonth: 11 },
];

const HALVES = [
  { label: 'H1 (Jan-Jun)', value: 1, startMonth: 0, endMonth: 5 },
  { label: 'H2 (Jul-Dec)', value: 2, startMonth: 6, endMonth: 11 },
];

const TITLES = {
  daily: 'Pick a date',
  weekly: 'Pick a week',
  monthly: 'Pick a month',
  quarterly: 'Pick a quarter',
  midterm: 'Pick a half year',
  annual: 'Pick a year',
};

const TOGGLE_LABEL = {
  daily: 'Date',
  weekly: 'Week',
  monthly: 'Month',
  quarterly: 'Quarter',
  midterm: 'Half year',
  annual: 'Year',
};

const MODE_CLASS = {
  daily: 'daily-picker',
  weekly: 'weekly-picker',
  monthly: 'month-picker',
  quarterly: 'quarter-picker',
  midterm: 'midterm-picker',
  annual: 'year-picker',
};

const OPTION_CLASS = {
  monthly: 'month-btn',
  quarterly: 'quarter-btn',
  midterm: 'half-btn',
  annual: 'year-btn',
};

const PANEL_WIDTH = 320;
const PANEL_EST_HEIGHT = 400;

const getMonday = (date) => {
  const dow = date.getDay();
  const back = dow === 0 ? 6 : dow - 1;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - back);
};

const getSunday = (date) => {
  const mon = getMonday(date);
  return new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
};

/** True below the phone breakpoint. Kept in sync with the SCSS at 680px. */
const useIsCompact = () => {
  const query = '(max-width: 680px)';
  const [compact, setCompact] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return !!window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const onChange = (e) => setCompact(!!e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  return compact;
};

const IntervalDatePicker = ({ interval, value, onChange, maxDate, minDate }) => {
  const initial = fromLocalISO(value) || fromLocalISO(maxDate) || new Date();

  const [selectedYear, setSelectedYear] = useState(() => initial.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => initial.getMonth());
  const [showCalendar, setShowCalendar] = useState(false);
  const [coords, setCoords] = useState(null);

  const toggleRef = useRef(null);
  const compact = useIsCompact();

  const maxDateObj = useMemo(() => fromLocalISO(maxDate) || new Date(), [maxDate]);
  const minDateObj = useMemo(() => fromLocalISO(minDate) || new Date(1900, 0, 1), [minDate]);

  const maxYear = maxDateObj.getFullYear();
  const maxMonth = maxDateObj.getMonth();
  const minYear = minDateObj.getFullYear();
  const minMonth = minDateObj.getMonth();

  const years = useMemo(() => {
    const out = [];
    for (let y = maxYear; y >= minYear; y--) out.push(y);
    return out;
  }, [maxYear, minYear]);

  useEffect(() => {
    const parsed = fromLocalISO(value);
    if (parsed) {
      setSelectedYear(parsed.getFullYear());
      setSelectedMonth(parsed.getMonth());
    }
  }, [value]);

  // Escape closes, wherever focus happens to be.
  useEffect(() => {
    if (!showCalendar) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setShowCalendar(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showCalendar]);

  // Outside click closes. On desktop the layer is pointer-events:none so the
  // page underneath stays live — which means the layer never receives the
  // event and this document listener is what actually does the closing. The
  // toggle is excluded so its own onClick can handle the toggle-shut case
  // without this firing first and making it reopen.
  useEffect(() => {
    if (!showCalendar) return undefined;
    const onDown = (e) => {
      if (e.target?.closest?.('.idp-panel')) return;
      if (toggleRef.current?.contains(e.target)) return;
      setShowCalendar(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [showCalendar]);

  // Anchor the panel under the toggle on desktop. The bottom sheet needs no
  // measurement, so this is skipped when compact.
  useLayoutEffect(() => {
    if (!showCalendar || compact) return undefined;

    const place = () => {
      const rect = toggleRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vw = window.innerWidth || PANEL_WIDTH;
      const vh = window.innerHeight || PANEL_EST_HEIGHT;

      const left = Math.max(12, Math.min(rect.left, vw - PANEL_WIDTH - 12));
      const roomBelow = vh - rect.bottom;
      const top = roomBelow >= PANEL_EST_HEIGHT
        ? rect.bottom + 6
        : Math.max(12, rect.top - PANEL_EST_HEIGHT - 6);

      setCoords({ top, left, width: PANEL_WIDTH });
    };

    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [showCalendar, compact]);

  // ── The single gate ───────────────────────────────────────────────────────
  // A candidate date is selectable only if it sits inside the min/max window
  // AND its period has actually closed.
  const isAllowed = useCallback((date) => {
    if (!date) return false;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const max = new Date(maxDateObj.getFullYear(), maxDateObj.getMonth(), maxDateObj.getDate());
    const min = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), minDateObj.getDate());
    if (d > max || d < min) return false;
    return isPeriodComplete(toLocalISO(d), interval);
  }, [maxDateObj, minDateObj, interval]);

  const commit = useCallback((date) => {
    if (!isAllowed(date)) return;
    onChange(toLocalISO(date));
    setShowCalendar(false);
  }, [isAllowed, onChange]);

  const getDisplayText = () => {
    const date = fromLocalISO(value);
    if (!date) return 'Select…';
    const year = date.getFullYear();
    const month = date.getMonth();

    switch (interval) {
      case 'daily':
        return value;
      case 'weekly': {
        const mon = getMonday(date);
        const sun = getSunday(date);
        return `Week of ${MONTHS[mon.getMonth()]} ${mon.getDate()} – ${sun.getDate()}, ${mon.getFullYear()}`;
      }
      case 'monthly':
        return `${MONTHS[month]} ${year}`;
      case 'quarterly':
        return `Q${Math.floor(month / 3) + 1} ${year}`;
      case 'midterm':
        return `H${month <= 5 ? 1 : 2} ${year} (${month <= 5 ? 'Jan-Jun' : 'Jul-Dec'})`;
      case 'annual':
        return `${year}`;
      default:
        return value;
    }
  };

  const handleDateSelect = (date) => {
    if (!isAllowed(date)) return;
    onChange(toLocalISO(date));
    setShowCalendar(false);
  };

  const handleMonthSelect = (monthIndex) => commit(new Date(selectedYear, monthIndex + 1, 0));
  const handleQuarterSelect = (q) => commit(new Date(selectedYear, q.endMonth + 1, 0));
  const handleHalfSelect = (h) => commit(new Date(selectedYear, h.endMonth + 1, 0));

  // Previously unguarded — the years array bounded it by accident, not by rule.
  const handleYearSelect = (year) => {
    if (interval !== 'annual') {
      setSelectedYear(year);
      return;
    }
    commit(new Date(year, 11, 31));
  };

  const monthDisabled = (idx) => {
    if (selectedYear === minYear && idx < minMonth) return true;
    return !isAllowed(new Date(selectedYear, idx + 1, 0));
  };

  const quarterDisabled = (q) => {
    if (selectedYear === minYear && q.endMonth < minMonth) return true;
    return !isAllowed(new Date(selectedYear, q.endMonth + 1, 0));
  };

  const halfDisabled = (h) => {
    if (selectedYear === minYear && h.endMonth < minMonth) return true;
    return !isAllowed(new Date(selectedYear, h.endMonth + 1, 0));
  };

  const yearDisabled = (year) => !isAllowed(new Date(year, 11, 31));

  const generateCalendarDays = () => {
    const first = new Date(selectedYear, selectedMonth, 1);
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const startDay = first.getDay();
    const days = [];
    for (let i = 0; i < (startDay === 0 ? 6 : startDay - 1); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(selectedYear, selectedMonth, d));
    return days;
  };

  const isInSelectedWeek = (date) => {
    const sel = fromLocalISO(value);
    if (!sel || !date) return false;
    return date >= getMonday(sel) && date <= getSunday(sel);
  };

  const stepMonth = (delta) => {
    const next = new Date(selectedYear, selectedMonth + delta, 1);
    setSelectedMonth(next.getMonth());
    setSelectedYear(next.getFullYear());
  };

  const stepYear = (delta) => {
    const nextYear = selectedYear + delta;
    if (nextYear < minYear || nextYear > maxYear) return;
    // Clamp the month so a year jump cannot land past maxDate.
    let month = selectedMonth;
    if (nextYear === maxYear && month > maxMonth) month = maxMonth;
    if (nextYear === minYear && month < minMonth) month = minMonth;
    setSelectedYear(nextYear);
    setSelectedMonth(month);
  };

  const atMinMonth = selectedYear === minYear && selectedMonth <= minMonth;
  const atMaxMonth = selectedYear === maxYear && selectedMonth >= maxMonth;

  // ── Calendar header: year and month, both steppable ───────────────────────
  const renderCalendarNav = () => (
    <div className="picker-header">
      <button
        type="button"
        className="picker-nav-btn"
        onClick={() => stepYear(-1)}
        disabled={selectedYear <= minYear}
        aria-label="Previous year"
      >
        «
      </button>
      <button
        type="button"
        className="picker-nav-btn"
        onClick={() => stepMonth(-1)}
        disabled={atMinMonth}
        aria-label="Previous month"
      >
        ‹
      </button>

      <span className="picker-nav-title">{MONTHS[selectedMonth]} {selectedYear}</span>

      <button
        type="button"
        className="picker-nav-btn"
        onClick={() => stepMonth(1)}
        disabled={atMaxMonth}
        aria-label="Next month"
      >
        ›
      </button>
      <button
        type="button"
        className="picker-nav-btn"
        onClick={() => stepYear(1)}
        disabled={selectedYear >= maxYear}
        aria-label="Next year"
      >
        »
      </button>
    </div>
  );

  const renderYearNav = () => (
    <div className="picker-header">
      <button
        type="button"
        className="picker-nav-btn"
        onClick={() => setSelectedYear(selectedYear - 1)}
        disabled={selectedYear <= minYear}
        aria-label="Previous year"
      >
        ‹
      </button>
      <span className="picker-nav-title">{selectedYear}</span>
      <button
        type="button"
        className="picker-nav-btn"
        onClick={() => setSelectedYear(selectedYear + 1)}
        disabled={selectedYear >= maxYear}
        aria-label="Next year"
      >
        ›
      </button>
    </div>
  );

  /**
   * Shared day grid. `mode` decides what a selected cell means:
   *   'day'  — that single date is highlighted
   *   'week' — the whole Mon–Sun week containing it is highlighted
   */
  const renderCalendar = (mode) => {
    const selected = fromLocalISO(value);

    return (
      <>
        {renderCalendarNav()}

        <div className="weekday-headers">
          {WEEKDAYS.map((d) => (
            <span key={d} className="weekday-header" aria-hidden="true">{d}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {generateCalendarDays().map((date, idx) => {
            if (!date) return <span key={`e${idx}`} className="calendar-day empty" />;

            const disabled = !isAllowed(date);
            const active = mode === 'week'
              ? isInSelectedWeek(date)
              : !!selected && toLocalISO(date) === toLocalISO(selected);

            return (
              <button
                type="button"
                key={toLocalISO(date)}
                className={`calendar-day${active ? (mode === 'week' ? ' in-week' : ' is-selected') : ''}${disabled ? ' disabled' : ''}`}
                disabled={disabled}
                aria-pressed={active}
                aria-label={`${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`}
                onClick={() => handleDateSelect(date)}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>

        {mode === 'week' && (
          <p className="week-hint">Click any day to select its week</p>
        )}
      </>
    );
  };

  const renderOptionGrid = (items, gridClass) => (
    <div className={`option-grid ${gridClass}`}>{items}</div>
  );

  const renderPanelBody = () => {
    const selected = fromLocalISO(value);

    switch (interval) {
      case 'daily':
        return renderCalendar('day');

      case 'weekly':
        return renderCalendar('week');

      case 'monthly':
        return (
          <>
            {renderYearNav()}
            {renderOptionGrid(
              MONTHS.map((month, idx) => {
                const disabled = monthDisabled(idx);
                const active = !!selected
                  && selected.getFullYear() === selectedYear
                  && selected.getMonth() === idx;
                return (
                  <button
                    type="button"
                    key={month}
                    className={`option-btn ${OPTION_CLASS[interval]}${active ? ' is-active' : ''}${disabled ? ' disabled' : ''}`}
                    onClick={() => handleMonthSelect(idx)}
                    disabled={disabled}
                    aria-pressed={active}
                    aria-label={`${month} ${selectedYear}`}
                  >
                    {month.slice(0, 3)}
                  </button>
                );
              }),
              'month-grid'
            )}
          </>
        );

      case 'quarterly':
        return (
          <>
            {renderYearNav()}
            {renderOptionGrid(
              QUARTERS.map((q) => {
                const disabled = quarterDisabled(q);
                const active = !!selected
                  && selected.getFullYear() === selectedYear
                  && Math.floor(selected.getMonth() / 3) === q.value - 1;
                return (
                  <button
                    type="button"
                    key={q.value}
                    className={`option-btn ${OPTION_CLASS[interval]}${active ? ' is-active' : ''}${disabled ? ' disabled' : ''}`}
                    onClick={() => handleQuarterSelect(q)}
                    disabled={disabled}
                    aria-pressed={active}
                    aria-label={`${q.label} ${selectedYear}`}
                  >
                    {q.label}
                  </button>
                );
              }),
              'quarter-grid'
            )}
          </>
        );

      case 'midterm':
        return (
          <>
            {renderYearNav()}
            {renderOptionGrid(
              HALVES.map((h) => {
                const disabled = halfDisabled(h);
                const active = !!selected
                  && selected.getFullYear() === selectedYear
                  && (selected.getMonth() <= 5 ? 5 : 11) === h.endMonth;
                return (
                  <button
                    type="button"
                    key={h.value}
                    className={`option-btn ${OPTION_CLASS[interval]}${active ? ' is-active' : ''}${disabled ? ' disabled' : ''}`}
                    onClick={() => handleHalfSelect(h)}
                    disabled={disabled}
                    aria-pressed={active}
                    aria-label={`${h.label} ${selectedYear}`}
                  >
                    {h.label}
                  </button>
                );
              }),
              'half-grid'
            )}
          </>
        );

      case 'annual':
        return (
          <div className="year-scroll">
            {renderOptionGrid(
              years.map((year) => {
                const disabled = yearDisabled(year);
                const active = !!selected && selected.getFullYear() === year;
                return (
                  <button
                    type="button"
                    key={year}
                    className={`option-btn ${OPTION_CLASS[interval]}${active ? ' is-active' : ''}${disabled ? ' disabled' : ''}`}
                    onClick={() => handleYearSelect(year)}
                    disabled={disabled}
                    aria-pressed={active}
                  >
                    {year}
                  </button>
                );
              }),
              'year-grid'
            )}
          </div>
        );

      default:
        return renderCalendar('day');
    }
  };

  const panel = showCalendar
    ? createPortal(
        <div
          className={`idp-layer${compact ? ' is-compact' : ''}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowCalendar(false);
          }}
        >
          <div
            className={`picker-dropdown idp-panel ${MODE_CLASS[interval] || 'daily-picker'}`}
            role="dialog"
            aria-modal={compact ? 'true' : undefined}
            aria-label={TITLES[interval] || 'Pick a period'}
            style={compact ? undefined : (coords || { top: -9999, left: -9999, width: PANEL_WIDTH })}
          >
            <div className="idp-panel-head">
              <h2 className="idp-panel-title">{TITLES[interval] || 'Pick a period'}</h2>
              <button
                type="button"
                className="idp-panel-close"
                onClick={() => setShowCalendar(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {renderPanelBody()}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="interval-date-picker">
      <button
        type="button"
        ref={toggleRef}
        className="picker-toggle"
        onClick={() => setShowCalendar((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={showCalendar}
        aria-label={`${TOGGLE_LABEL[interval] || 'Date'}: ${getDisplayText()}`}
      >
        <span className="picker-toggle-text">{getDisplayText()}</span>
      </button>
      {panel}
    </div>
  );
};

export default IntervalDatePicker;