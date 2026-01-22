import React, { useState, useEffect } from 'react';
import './IntervalDatePicker.scss';

const IntervalDatePicker = ({ interval, value, onChange, maxDate, minDate }) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [showCalendar, setShowCalendar] = useState(false);

  // 1. Parse BOTH dates safely
  const maxDateObj = maxDate ? new Date(maxDate + 'T12:00:00') : new Date();
  const minDateObj = minDate ? new Date(minDate + 'T12:00:00') : new Date('1900-01-01');

  const maxYear = maxDateObj.getFullYear();
  const maxMonth = maxDateObj.getMonth();
  
  const minYear = minDateObj.getFullYear();
  const minMonth = minDateObj.getMonth();

  // 2. Generate years (Respecting the Min Date)
  const years = [];
  // Only go back as far as the minYear allow
  for (let y = maxYear; y >= minYear; y--) {
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

  const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const getSunday = (date) => {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return sunday;
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDisplayText = () => {
    if (!value) return 'Select...';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    switch (interval) {
      case 'daily': return value;
      case 'weekly': {
        const monday = getMonday(date);
        const sunday = getSunday(date);
        return `Week of ${months[monday.getMonth()]} ${monday.getDate()} - ${sunday.getDate()}, ${monday.getFullYear()}`;
      }
      case 'monthly': return `${months[month - 1]} ${year}`;
      case 'quarterly': {
        const q = Math.floor((month - 1) / 3) + 1;
        return `Q${q} ${year}`;
      }
      case 'midterm': {
        const h = month <= 6 ? 1 : 2;
        return `H${h} ${year} (${h === 1 ? 'Jan-Jun' : 'Jul-Dec'})`;
      }
      case 'annual': return `${year}`;
      default: return value;
    }
  };

  // 3. Logic: Check if date is within valid range (Min - Max)
  const isSelectable = (date) => {
    // Reset times to midnight for fair comparison
    const d = new Date(date); d.setHours(0,0,0,0);
    const max = new Date(maxDateObj); max.setHours(0,0,0,0);
    const min = new Date(minDateObj); min.setHours(0,0,0,0);
    
    return d <= max && d >= min;
  };

  const handleDateSelect = (date) => {
    if (!isSelectable(date)) return;
    onChange(formatDate(date));
    if (interval === 'daily') setShowCalendar(false);
  };

  const handleMonthSelect = (monthIndex) => {
    // Max Check
    if (selectedYear === maxYear && monthIndex > maxMonth) return;
    // Min Check
    if (selectedYear === minYear && monthIndex < minMonth) return;

    const lastDay = new Date(selectedYear, monthIndex + 1, 0).getDate();
    const selectedDate = new Date(selectedYear, monthIndex, lastDay);
    onChange(formatDate(selectedDate));
    setShowCalendar(false);
  };

  const handleQuarterSelect = (quarter) => {
    // Max Check
    if (selectedYear === maxYear && quarter.endMonth > maxMonth) return;
    // Min Check (If the quarter ENDS before the min date starts, disable it)
    if (selectedYear === minYear && quarter.endMonth < minMonth) return;

    const lastDay = new Date(selectedYear, quarter.endMonth + 1, 0).getDate();
    onChange(formatDate(new Date(selectedYear, quarter.endMonth, lastDay)));
    setShowCalendar(false);
  };

  const handleHalfSelect = (half) => {
    if (selectedYear === maxYear && half.endMonth > maxMonth) return;
    if (selectedYear === minYear && half.endMonth < minMonth) return;

    const lastDay = new Date(selectedYear, half.endMonth + 1, 0).getDate();
    onChange(formatDate(new Date(selectedYear, half.endMonth, lastDay)));
    setShowCalendar(false);
  };

  const handleYearSelect = (year) => {
    if (interval === 'annual') {
      onChange(formatDate(new Date(year, 11, 31)));
      setShowCalendar(false);
    } else {
      setSelectedYear(year);
    }
  };

  const generateCalendarDays = () => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const days = [];
    
    for (let i = 0; i < (startDay === 0 ? 6 : startDay - 1); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(selectedYear, selectedMonth, d));
    return days;
  };

  const isInSelectedWeek = (date) => {
    if (!value || !date) return false;
    const [year, month, day] = value.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const selectedMonday = getMonday(selectedDate);
    const selectedSunday = getSunday(selectedDate);
    return date >= selectedMonday && date <= selectedSunday;
  };

  const renderPicker = () => {
    switch (interval) {
      case 'daily':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            max={maxDate}
            min={minDate} // FIXED: Correct JSX Syntax
            className="date-input"
          />
        );

      case 'weekly':
        return (
          <div className="custom-picker">
            <button className="picker-toggle" onClick={() => setShowCalendar(!showCalendar)}>
              {getDisplayText()}
            </button>
            {showCalendar && (
              <div className="picker-dropdown weekly-picker">
                <div className="picker-header">
                  <button onClick={() => {
                     // Logic to go back a month
                     if (selectedMonth === 0) {
                         if (selectedYear > minYear) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
                     } else {
                         setSelectedMonth(selectedMonth - 1);
                     }
                  }} disabled={selectedYear === minYear && selectedMonth <= minMonth}>←</button>
                  
                  <span>{months[selectedMonth]} {selectedYear}</span>
                  
                  <button onClick={() => {
                     if (selectedMonth === 11) {
                         if (selectedYear < maxYear) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
                     } else {
                         setSelectedMonth(selectedMonth + 1);
                     }
                  }} disabled={selectedYear === maxYear && selectedMonth >= maxMonth}>→</button>
                </div>
                
                <div className="weekday-headers">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="weekday-header">{d}</div>)}
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
                <div className="week-hint">Click any day to select its week</div>
              </div>
            )}
          </div>
        );

      case 'monthly':
        return (
          <div className="custom-picker">
            <button className="picker-toggle" onClick={() => setShowCalendar(!showCalendar)}>{getDisplayText()}</button>
            {showCalendar && (
              <div className="picker-dropdown month-picker">
                <div className="picker-header">
                  <button onClick={() => setSelectedYear(selectedYear - 1)} disabled={selectedYear <= minYear}>←</button>
                  <span>{selectedYear}</span>
                  <button onClick={() => setSelectedYear(selectedYear + 1)} disabled={selectedYear >= maxYear}>→</button>
                </div>
                <div className="month-grid">
                  {months.map((month, idx) => {
                    const isTooEarly = selectedYear === minYear && idx < minMonth;
                    const isTooLate = selectedYear === maxYear && idx > maxMonth;
                    const disabled = isTooEarly || isTooLate;
                    return (
                      <button key={month} className={`month-btn ${disabled ? 'disabled' : ''}`} onClick={() => !disabled && handleMonthSelect(idx)} disabled={disabled}>
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
            <button className="picker-toggle" onClick={() => setShowCalendar(!showCalendar)}>{getDisplayText()}</button>
            {showCalendar && (
              <div className="picker-dropdown quarter-picker">
                <div className="picker-header">
                  <button onClick={() => setSelectedYear(selectedYear - 1)} disabled={selectedYear <= minYear}>←</button>
                  <span>{selectedYear}</span>
                  <button onClick={() => setSelectedYear(selectedYear + 1)} disabled={selectedYear >= maxYear}>→</button>
                </div>
                <div className="quarter-grid">
                  {quarters.map((q) => {
                    const isTooEarly = selectedYear === minYear && q.endMonth < minMonth;
                    const isTooLate = selectedYear === maxYear && q.endMonth > maxMonth;
                    const disabled = isTooEarly || isTooLate;
                    return (
                      <button key={q.value} className={`quarter-btn ${disabled ? 'disabled' : ''}`} onClick={() => !disabled && handleQuarterSelect(q)} disabled={disabled}>
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
            <button className="picker-toggle" onClick={() => setShowCalendar(!showCalendar)}>{getDisplayText()}</button>
            {showCalendar && (
              <div className="picker-dropdown midterm-picker">
                 <div className="picker-header">
                  <button onClick={() => setSelectedYear(selectedYear - 1)} disabled={selectedYear <= minYear}>←</button>
                  <span>{selectedYear}</span>
                  <button onClick={() => setSelectedYear(selectedYear + 1)} disabled={selectedYear >= maxYear}>→</button>
                </div>
                <div className="half-grid">
                  {halves.map((h) => {
                    const isTooEarly = selectedYear === minYear && h.endMonth < minMonth;
                    const isTooLate = selectedYear === maxYear && h.endMonth > maxMonth;
                    const disabled = isTooEarly || isTooLate;
                    return (
                      <button key={h.value} className={`half-btn ${disabled ? 'disabled' : ''}`} onClick={() => !disabled && handleHalfSelect(h)} disabled={disabled}>
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
            <button className="picker-toggle" onClick={() => setShowCalendar(!showCalendar)}>{getDisplayText()}</button>
            {showCalendar && (
              <div className="picker-dropdown year-picker">
                <div className="year-grid">
                  {years.map((year) => (
                    <button key={year} className="year-btn" onClick={() => handleYearSelect(year)}>
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} max={maxDate} min={minDate} className="date-input" />;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.custom-picker')) setShowCalendar(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return <div className="interval-date-picker">{renderPicker()}</div>;
};

export default IntervalDatePicker;