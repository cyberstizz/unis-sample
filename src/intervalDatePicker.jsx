import React, { useState, useEffect } from 'react';
import './IntervalDatePicker.scss';

/**
 * Adaptive date picker that changes UI based on selected interval type.
 * - Daily: Standard date picker
 * - Weekly: Date picker with week highlighting
 * - Monthly: Month/Year selector
 * - Quarterly: Quarter/Year selector
 * - Midterm: Half-year selector (H1/H2)
 * - Annual: Year selector only
 */
const IntervalDatePicker = ({ interval, value, onChange, maxDate }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [showCalendar, setShowCalendar] = useState(false);

  // Parse maxDate
  const maxDateObj = maxDate ? new Date(maxDate + 'T12:00:00') : new Date();
  const maxYear = maxDateObj.getFullYear();
  const maxMonth = maxDateObj.getMonth();

  // Generate year options (last 5 years)
  const years = [];
  for (let y = maxYear; y >= maxYear - 5; y--) {
    years.push(y);
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const quarters = [
    { label: 'Q1 (Jan-Mar)', value: 1, startMonth: 0, endMonth: 2 },
    { label: 'Q2 (Apr-Jun)', value: 2, startMonth: 3, endMonth: 5 },
    { label: 'Q3 (Jul-Sep)', value: 3, startMonth: 6, endMonth: 8 },
    { label: 'Q4 (Oct-Dec)', value: 4, startMonth: 9, endMonth: 11 },
  ];

  const halves = [
    { label: 'H1 (Jan-Jun)', value: 1, startMonth: 0, endMonth: 5 },
    { label: 'H2 (Jul-Dec)', value: 2, startMonth: 6, endMonth: 11 },
  ];

  // Get the Monday of a given week
  const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  // Get the Sunday of a given week
  const getSunday = (date) => {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  };

  // Format date as YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get display text based on interval and selection
  const getDisplayText = () => {
    if (!value) return 'Select...';

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    switch (interval) {
      case 'daily':
        return value;
      case 'weekly': {
        const monday = getMonday(date);
        const sunday = getSunday(date);
        return `Week of ${months[monday.getMonth()]} ${monday.getDate()} - ${sunday.getDate()}, ${monday.getFullYear()}`;
      }
      case 'monthly':
        return `${months[month - 1]} ${year}`;
      case 'quarterly': {
        const q = Math.floor((month - 1) / 3) + 1;
        return `Q${q} ${year}`;
      }
      case 'midterm': {
        const h = month <= 6 ? 1 : 2;
        return `H${h} ${year} (${h === 1 ? 'Jan-Jun' : 'Jul-Dec'})`;
      }
      case 'annual':
        return `${year}`;
      default:
        return value;
    }
  };

  // Handle daily/weekly date selection
  const handleDateSelect = (date) => {
    if (date > maxDateObj) return;
    onChange(formatDate(date));
    if (interval === 'daily') {
      setShowCalendar(false);
    }
  };

  // Handle month selection
  const handleMonthSelect = (monthIndex) => {
    if (selectedYear === maxYear && monthIndex > maxMonth) return;
    const lastDay = new Date(selectedYear, monthIndex + 1, 0).getDate();
    const day = Math.min(lastDay, maxDateObj.getDate());
    const selectedDate = new Date(selectedYear, monthIndex, day);
    if (selectedDate <= maxDateObj) {
      onChange(formatDate(new Date(selectedYear, monthIndex, lastDay)));
      setShowCalendar(false);
    }
  };

  // Handle quarter selection
  const handleQuarterSelect = (quarter) => {
    const endMonth = quarter.endMonth;
    if (selectedYear === maxYear && endMonth > maxMonth) return;
    const lastDay = new Date(selectedYear, endMonth + 1, 0).getDate();
    onChange(formatDate(new Date(selectedYear, endMonth, lastDay)));
    setShowCalendar(false);
  };

  // Handle half-year selection
  const handleHalfSelect = (half) => {
    const endMonth = half.endMonth;
    if (selectedYear === maxYear && endMonth > maxMonth) return;
    const lastDay = new Date(selectedYear, endMonth + 1, 0).getDate();
    onChange(formatDate(new Date(selectedYear, endMonth, lastDay)));
    setShowCalendar(false);
  };

  // Handle year selection
  const handleYearSelect = (year) => {
    if (interval === 'annual') {
      onChange(formatDate(new Date(year, 11, 31)));
      setShowCalendar(false);
    } else {
      setSelectedYear(year);
    }
  };

  // Generate calendar days for weekly view
  const generateCalendarDays = () => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days = [];
    
    // Empty cells before first day
    for (let i = 0; i < (startDay === 0 ? 6 : startDay - 1); i++) {
      days.push(null);
    }
    
    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(selectedYear, selectedMonth, d));
    }

    return days;
  };

  // Check if a date is in the selected week
  const isInSelectedWeek = (date) => {
    if (!value || !date) return false;
    const [year, month, day] = value.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const selectedMonday = getMonday(selectedDate);
    const selectedSunday = getSunday(selectedDate);
    return date >= selectedMonday && date <= selectedSunday;
  };

  // Check if date is selectable (not in future)
  const isSelectable = (date) => {
    return date <= maxDateObj;
  };

  // Render the appropriate picker based on interval
  const renderPicker = () => {
    switch (interval) {
      case 'daily':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            max={maxDate}
            className="date-input"
          />
        );

      case 'weekly':
        return (
          <div className="custom-picker">
            <button 
              className="picker-toggle"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              {getDisplayText()}
            </button>
            {showCalendar && (
              <div className="picker-dropdown weekly-picker">
                <div className="picker-header">
                  <button onClick={() => {
                    if (selectedMonth === 0) {
                      setSelectedMonth(11);
                      setSelectedYear(selectedYear - 1);
                    } else {
                      setSelectedMonth(selectedMonth - 1);
                    }
                  }}>←</button>
                  <span>{months[selectedMonth]} {selectedYear}</span>
                  <button onClick={() => {
                    if (selectedMonth === 11) {
                      setSelectedMonth(0);
                      setSelectedYear(selectedYear + 1);
                    } else {
                      setSelectedMonth(selectedMonth + 1);
                    }
                  }}>→</button>
                </div>
                <div className="weekday-headers">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                    <div key={d} className="weekday-header">{d}</div>
                  ))}
                </div>
                <div className="calendar-grid">
                  {generateCalendarDays().map((date, idx) => (
                    <div
                      key={idx}
                      className={`calendar-day ${!date ? 'empty' : ''} ${date && isInSelectedWeek(date) ? 'in-week' : ''} ${date && !isSelectable(date) ? 'disabled' : ''}`}
                      onClick={() => date && isSelectable(date) && handleDateSelect(date)}
                    >
                      {date ? date.getDate() : ''}
                    </div>
                  ))}
                </div>
                <div className="week-hint">Click any day to select its week (Mon-Sun)</div>
              </div>
            )}
          </div>
        );

      case 'monthly':
        return (
          <div className="custom-picker">
            <button 
              className="picker-toggle"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              {getDisplayText()}
            </button>
            {showCalendar && (
              <div className="picker-dropdown month-picker">
                <div className="picker-header">
                  <button onClick={() => setSelectedYear(selectedYear - 1)}>←</button>
                  <span>{selectedYear}</span>
                  <button onClick={() => setSelectedYear(selectedYear + 1)}>→</button>
                </div>
                <div className="month-grid">
                  {months.map((month, idx) => (
                    <button
                      key={month}
                      className={`month-btn ${selectedYear === maxYear && idx > maxMonth ? 'disabled' : ''}`}
                      onClick={() => handleMonthSelect(idx)}
                      disabled={selectedYear === maxYear && idx > maxMonth}
                    >
                      {month.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'quarterly':
        return (
          <div className="custom-picker">
            <button 
              className="picker-toggle"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              {getDisplayText()}
            </button>
            {showCalendar && (
              <div className="picker-dropdown quarter-picker">
                <div className="picker-header">
                  <button onClick={() => setSelectedYear(selectedYear - 1)}>←</button>
                  <span>{selectedYear}</span>
                  <button onClick={() => setSelectedYear(selectedYear + 1)}>→</button>
                </div>
                <div className="quarter-grid">
                  {quarters.map((q) => {
                    const disabled = selectedYear === maxYear && q.endMonth > maxMonth;
                    return (
                      <button
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
            <button 
              className="picker-toggle"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              {getDisplayText()}
            </button>
            {showCalendar && (
              <div className="picker-dropdown midterm-picker">
                <div className="picker-header">
                  <button onClick={() => setSelectedYear(selectedYear - 1)}>←</button>
                  <span>{selectedYear}</span>
                  <button onClick={() => setSelectedYear(selectedYear + 1)}>→</button>
                </div>
                <div className="half-grid">
                  {halves.map((h) => {
                    const disabled = selectedYear === maxYear && h.endMonth > maxMonth;
                    return (
                      <button
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
            <button 
              className="picker-toggle"
              onClick={() => setShowCalendar(!showCalendar)}
            >
              {getDisplayText()}
            </button>
            {showCalendar && (
              <div className="picker-dropdown year-picker">
                <div className="year-grid">
                  {years.map((year) => (
                    <button
                      key={year}
                      className="year-btn"
                      onClick={() => handleYearSelect(year)}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            max={maxDate}
            className="date-input"
          />
        );
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.custom-picker')) {
        setShowCalendar(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="interval-date-picker">
      {renderPicker()}
    </div>
  );
};

export default IntervalDatePicker;