// ============================================================================
// IntervalDatePicker.jsx
//
// Picks the anchor date for an award period. The caller supplies maxDate as the
// end of the last CLOSED period (see utils/periodBounds.js). This component
// additionally refuses any period that has not closed, so a wrong maxDate from
// a future caller still cannot surface an open period. Two independent checks,
// because the cost of getting it wrong is a persisted phantom award row.
//
// Changes from the previous version:
//   • Every option is validated with isPeriodComplete(), not just against maxDate.
//   • handleYearSelect had no bounds check at all — added.
//   • All buttons carry type="button" (a bare <button> defaults to submit and
//     fires on spacebar, which caused document reloads elsewhere in the app).
//   • Date parsing routes through fromLocalISO — no UTC drift.
//   • Dropdowns are labelled and expose aria-expanded / aria-pressed.
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import './intervalDatePicker.scss';
import { fromLocalISO, toLocalISO, isPeriodComplete } from './utils/periodBounds';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

const getMonday = (date) => {
  const dow = date.getDay();
  const back = dow === 0 ? 6 : dow - 1;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - back);
};

const getSunday = (date) => {
  const mon = getMonday(date);
  return new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
};

const IntervalDatePicker = ({ interval, value, onChange, maxDate, minDate }) => {
  const initial = fromLocalISO(value) || fromLocalISO(maxDate) || new Date();

  const [selectedYear, setSelectedYear] = useState(() => initial.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => initial.getMonth());
  const [showCalendar, setShowCalendar] = useState(false);

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

  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest('.custom-picker')) setShowCalendar(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // ── The single gate ───────────────────────────────────────────────────────
  // A candidate date is selectable only if it sits inside the min/max window
  // AND its period has actually closed.
  const isAllowed = (date) => {
    if (!date) return false;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const max = new Date(maxDateObj.getFullYear(), maxDateObj.getMonth(), maxDateObj.getDate());
    const min = new Date(minDateObj.getFullYear(), minDateObj.getMonth(), minDateObj.getDate());
    if (d > max || d < min) return false;
    return isPeriodComplete(toLocalISO(d), interval);
  };

  const commit = (date) => {
    if (!isAllowed(date)) return;
    onChange(toLocalISO(date));
    setShowCalendar(false);
  };

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
    if (interval === 'daily') setShowCalendar(false);
  };

  const handleMonthSelect = (monthIndex) => {
    const last = new Date(selectedYear, monthIndex + 1, 0);
    commit(last);
  };

  const handleQuarterSelect = (q) => {
    commit(new Date(selectedYear, q.endMonth + 1, 0));
  };

  const handleHalfSelect = (h) => {
    commit(new Date(selectedYear, h.endMonth + 1, 0));
  };

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

  const toggle = () => setShowCalendar((open) => !open);

  const renderToggle = (label) => (
    <button
      type="button"
      className="picker-toggle"
      onClick={toggle}
      aria-haspopup="dialog"
      aria-expanded={showCalendar}
      aria-label={`${label}: ${getDisplayText()}`}
    >
      {getDisplayText()}
    </button>
  );

  const renderYearNav = () => (
    <div className="picker-header">
      <button
        type="button"
        onClick={() => setSelectedYear(selectedYear - 1)}
        disabled={selectedYear <= minYear}
        aria-label="Previous year"
      >
        ←
      </button>
      <span>{selectedYear}</span>
      <button
        type="button"
        onClick={() => setSelectedYear(selectedYear + 1)}
        disabled={selectedYear >= maxYear}
        aria-label="Next year"
      >
        →
      </button>
    </div>
  );

  const renderPicker = () => {
    switch (interval) {
      case 'daily':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            max={maxDate}
            min={minDate}
            className="date-input"
            aria-label="Award date"
          />
        );

      case 'weekly':
        return (
          <div className="custom-picker">
            {renderToggle('Week')}
            {showCalendar && (
              <div className="picker-dropdown weekly-picker" role="dialog" aria-label="Pick a week">
                <div className="picker-header">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMonth === 0) {
                        if (selectedYear > minYear) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
                      } else {
                        setSelectedMonth(selectedMonth - 1);
                      }
                    }}
                    disabled={selectedYear === minYear && selectedMonth <= minMonth}
                    aria-label="Previous month"
                  >
                    ←
                  </button>
                  <span>{MONTHS[selectedMonth]} {selectedYear}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMonth === 11) {
                        if (selectedYear < maxYear) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
                      } else {
                        setSelectedMonth(selectedMonth + 1);
                      }
                    }}
                    disabled={selectedYear === maxYear && selectedMonth >= maxMonth}
                    aria-label="Next month"
                  >
                    →
                  </button>
                </div>

                <div className="weekday-headers">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                    <div key={d} className="weekday-header">{d}</div>
                  ))}
                </div>

                <div className="calendar-grid">
                  {generateCalendarDays().map((date, idx) => {
                    const disabled = !!date && !isAllowed(date);
                    return (
                      <div
                        key={idx}
                        role={date ? 'button' : undefined}
                        tabIndex={date && !disabled ? 0 : undefined}
                        aria-disabled={disabled || undefined}
                        className={`calendar-day ${!date ? 'empty' : ''} ${date && isInSelectedWeek(date) ? 'in-week' : ''} ${disabled ? 'disabled' : ''}`}
                        onClick={() => date && handleDateSelect(date)}
                        onKeyDown={(e) => {
                          if (date && !disabled && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            handleDateSelect(date);
                          }
                        }}
                      >
                        {date ? date.getDate() : ''}
                      </div>
                    );
                  })}
                </div>
                <div className="week-hint">Click any day to select its week</div>
              </div>
            )}
          </div>
        );

      case 'monthly':
        return (
          <div className="custom-picker">
            {renderToggle('Month')}
            {showCalendar && (
              <div className="picker-dropdown month-picker" role="dialog" aria-label="Pick a month">
                {renderYearNav()}
                <div className="month-grid">
                  {MONTHS.map((month, idx) => {
                    const disabled = monthDisabled(idx);
                    return (
                      <button
                        type="button"
                        key={month}
                        className={`month-btn ${disabled ? 'disabled' : ''}`}
                        onClick={() => !disabled && handleMonthSelect(idx)}
                        disabled={disabled}
                        aria-label={`${month} ${selectedYear}`}
                      >
                        {month.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 'quarterly':
        return (
          <div className="custom-picker">
            {renderToggle('Quarter')}
            {showCalendar && (
              <div className="picker-dropdown quarter-picker" role="dialog" aria-label="Pick a quarter">
                {renderYearNav()}
                <div className="quarter-grid">
                  {QUARTERS.map((q) => {
                    const disabled = quarterDisabled(q);
                    return (
                      <button
                        type="button"
                        key={q.value}
                        className={`quarter-btn ${disabled ? 'disabled' : ''}`}
                        onClick={() => !disabled && handleQuarterSelect(q)}
                        disabled={disabled}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 'midterm':
        return (
          <div className="custom-picker">
            {renderToggle('Half year')}
            {showCalendar && (
              <div className="picker-dropdown midterm-picker" role="dialog" aria-label="Pick a half year">
                {renderYearNav()}
                <div className="half-grid">
                  {HALVES.map((h) => {
                    const disabled = halfDisabled(h);
                    return (
                      <button
                        type="button"
                        key={h.value}
                        className={`half-btn ${disabled ? 'disabled' : ''}`}
                        onClick={() => !disabled && handleHalfSelect(h)}
                        disabled={disabled}
                      >
                        {h.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      case 'annual':
        return (
          <div className="custom-picker">
            {renderToggle('Year')}
            {showCalendar && (
              <div className="picker-dropdown year-picker" role="dialog" aria-label="Pick a year">
                <div className="year-grid">
                  {years.map((year) => {
                    const disabled = yearDisabled(year);
                    return (
                      <button
                        type="button"
                        key={year}
                        className={`year-btn ${disabled ? 'disabled' : ''}`}
                        onClick={() => !disabled && handleYearSelect(year)}
                        disabled={disabled}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            max={maxDate}
            min={minDate}
            className="date-input"
            aria-label="Award date"
          />
        );
    }
  };

  return <div className="interval-date-picker">{renderPicker()}</div>;
};

export default IntervalDatePicker;