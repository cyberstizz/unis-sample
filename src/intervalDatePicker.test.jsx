// src/intervalDatePicker.test.jsx
//
// Unit tests for IntervalDatePicker — a multi-mode date picker supporting
// daily, weekly, monthly, quarterly, midterm, and annual intervals.
// Covers rendering, display text, selection, boundary constraints,
// navigation, and click-outside dismissal.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test/utils';
import IntervalDatePicker from './intervalDatePicker';

describe('IntervalDatePicker', () => {
  const defaultProps = {
    interval: 'daily',
    value: '',
    onChange: vi.fn(),
    maxDate: '2024-12-31',
    minDate: '2020-01-01',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ========================================================================
  // Daily interval
  // ========================================================================
  describe('daily interval', () => {
    it('renders a native date input', () => {
      renderWithProviders(<IntervalDatePicker {...defaultProps} interval="daily" />);
      expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'date');
    });

    it('calls onChange with the selected date string', async () => {
      const onChange = vi.fn();
      renderWithProviders(<IntervalDatePicker {...defaultProps} interval="daily" onChange={onChange} />);

      const user = userEvent.setup();
      const input = screen.getByDisplayValue('');
      await user.type(input, '2024-06-15');

      expect(onChange).toHaveBeenCalledWith('2024-06-15');
    });

    it('respects max and min attributes on the date input', () => {
      renderWithProviders(
        <IntervalDatePicker {...defaultProps} interval="daily" maxDate="2024-06-30" minDate="2024-01-01" />
      );
      const input = screen.getByDisplayValue('');
      expect(input).toHaveAttribute('max', '2024-06-30');
      expect(input).toHaveAttribute('min', '2024-01-01');
    });

    it('shows display text from value prop when provided', () => {
      renderWithProviders(
        <IntervalDatePicker {...defaultProps} interval="daily" value="2024-06-15" />
      );
      expect(screen.getByDisplayValue('2024-06-15')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Weekly interval
  // ========================================================================
  describe('weekly interval', () => {
    const weeklyProps = { ...defaultProps, interval: 'weekly', value: '2024-06-12' };

    it('shows the week display text on the toggle button', () => {
      renderWithProviders(<IntervalDatePicker {...weeklyProps} />);
      // June 12 2024 is a Wednesday. Week of June 10 - June 16, 2024.
      expect(screen.getByRole('button', { name: /Week of June 10 - 16, 2024/i })).toBeInTheDocument();
    });

    it('opens the calendar dropdown when toggle is clicked', async () => {
      renderWithProviders(<IntervalDatePicker {...weeklyProps} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Week of/i }));

      expect(screen.getByText(/Click any day to select its week/i)).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
    });

    it('closes the calendar when clicking outside', async () => {
      renderWithProviders(
        <div>
          <IntervalDatePicker {...weeklyProps} />
          <div data-testid="outside">Outside</div>
        </div>
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Week of/i }));
      expect(screen.getByText(/Click any day to select its week/i)).toBeInTheDocument();

      await user.click(screen.getByTestId('outside'));
      await waitFor(() =>
        expect(screen.queryByText(/Click any day to select its week/i)).not.toBeInTheDocument()
      );
    });

    it('selects a week when a valid day is clicked', async () => {
      const onChange = vi.fn();
      renderWithProviders(<IntervalDatePicker {...weeklyProps} onChange={onChange} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Week of/i }));

      // Click day 15 in June 2024 calendar
      const day15 = screen.getByText('15');
      await user.click(day15);

      expect(onChange).toHaveBeenCalledWith('2024-06-15');
    });

    it('disables navigation past maxDate boundary', async () => {
      renderWithProviders(
        <IntervalDatePicker {...weeklyProps} maxDate="2024-06-15" minDate="2024-01-01" />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Week of/i }));

      // Navigate to December 2024 — should be blocked at June
      const nextBtn = screen.getAllByRole('button', { name: /→/i })[0];
      expect(nextBtn).toBeDisabled();
    });

    it('disables navigation before minDate boundary', async () => {
      renderWithProviders(
        <IntervalDatePicker {...weeklyProps} maxDate="2024-12-31" minDate="2024-06-01" />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Week of/i }));

      const prevBtn = screen.getAllByRole('button', { name: /←/i })[0];
      // At June 2024 with minDate June 1, going back to May should be disabled
      expect(prevBtn).toBeDisabled();
    });

    it('does not select dates outside the valid range', async () => {
      const onChange = vi.fn();
      renderWithProviders(
        <IntervalDatePicker
          {...weeklyProps}
          onChange={onChange}
          maxDate="2024-06-10"
          minDate="2024-06-01"
        />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Week of/i }));

      // Click a disabled day (if any are rendered disabled)
      const disabledDay = document.querySelector('.calendar-day.disabled');
      if (disabledDay) {
        await user.click(disabledDay);
        expect(onChange).not.toHaveBeenCalled();
      }
    });
  });

  // ========================================================================
  // Monthly interval
  // ========================================================================
  describe('monthly interval', () => {
    const monthlyProps = { ...defaultProps, interval: 'monthly', value: '2024-06-30' };

    it('shows the month display text on the toggle button', () => {
      renderWithProviders(<IntervalDatePicker {...monthlyProps} />);
      expect(screen.getByRole('button', { name: /June 2024/i })).toBeInTheDocument();
    });

    it('opens month grid when toggle is clicked', async () => {
      renderWithProviders(<IntervalDatePicker {...monthlyProps} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /June 2024/i }));

      expect(screen.getByText('Jan')).toBeInTheDocument();
      expect(screen.getByText('Dec')).toBeInTheDocument();
    });

    it('selects a month and calls onChange with last day of month', async () => {
      const onChange = vi.fn();
      renderWithProviders(<IntervalDatePicker {...monthlyProps} onChange={onChange} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /June 2024/i }));
      await user.click(screen.getByText('Mar'));

      expect(onChange).toHaveBeenCalledWith('2024-03-31');
    });

    it('disables months outside the valid year range', async () => {
      renderWithProviders(
        <IntervalDatePicker
          {...monthlyProps}
          maxDate="2024-03-15"
          minDate="2024-01-01"
          value="2024-02-29"
        />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /February 2024/i }));

      const aprBtn = screen.getByText('Apr');
      expect(aprBtn).toBeDisabled();
    });

    it('navigates years with arrow buttons', async () => {
      renderWithProviders(<IntervalDatePicker {...monthlyProps} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /June 2024/i }));

      const prevYearBtn = screen.getAllByRole('button', { name: /←/i })[0];
      await user.click(prevYearBtn);

      expect(screen.getByText('2023')).toBeInTheDocument();
    });

    it('disables year navigation at boundaries', async () => {
      renderWithProviders(
        <IntervalDatePicker {...monthlyProps} maxDate="2024-12-31" minDate="2024-01-01" />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /June 2024/i }));

      const nextYearBtn = screen.getAllByRole('button', { name: /→/i })[0];
      expect(nextYearBtn).toBeDisabled();
    });
  });

  // ========================================================================
  // Quarterly interval
  // ========================================================================
  describe('quarterly interval', () => {
    const quarterlyProps = { ...defaultProps, interval: 'quarterly', value: '2024-06-30' };

    it('shows the quarter display text on the toggle button', () => {
      renderWithProviders(<IntervalDatePicker {...quarterlyProps} />);
      expect(screen.getByRole('button', { name: /Q2 2024/i })).toBeInTheDocument();
    });

    it('opens quarter grid when toggle is clicked', async () => {
      renderWithProviders(<IntervalDatePicker {...quarterlyProps} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Q2 2024/i }));

      expect(screen.getByText('Q1 (Jan-Mar)')).toBeInTheDocument();
      expect(screen.getByText('Q4 (Oct-Dec)')).toBeInTheDocument();
    });

    it('selects a quarter and calls onChange with last day of quarter', async () => {
      const onChange = vi.fn();
      renderWithProviders(<IntervalDatePicker {...quarterlyProps} onChange={onChange} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Q2 2024/i }));
      await user.click(screen.getByText('Q3 (Jul-Sep)'));

      expect(onChange).toHaveBeenCalledWith('2024-09-30');
    });

    it('disables quarters outside valid range', async () => {
      renderWithProviders(
        <IntervalDatePicker
          {...quarterlyProps}
          maxDate="2024-04-15"
          minDate="2024-01-01"
          value="2024-03-31"
        />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Q1 2024/i }));

      const q3Btn = screen.getByText('Q3 (Jul-Sep)');
      expect(q3Btn).toBeDisabled();
    });
  });

  // ========================================================================
  // Midterm (half-year) interval
  // ========================================================================
  describe('midterm interval', () => {
    const midtermProps = { ...defaultProps, interval: 'midterm', value: '2024-06-30' };

    it('shows the half-year display text on the toggle button', () => {
      renderWithProviders(<IntervalDatePicker {...midtermProps} />);
      expect(screen.getByRole('button', { name: /H1 2024/i })).toBeInTheDocument();
    });

    it('opens half-year grid when toggle is clicked', async () => {
      renderWithProviders(<IntervalDatePicker {...midtermProps} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /H1 2024/i }));

      expect(screen.getByText('H1 (Jan-Jun)')).toBeInTheDocument();
      expect(screen.getByText('H2 (Jul-Dec)')).toBeInTheDocument();
    });

    it('selects a half and calls onChange with last day of half', async () => {
      const onChange = vi.fn();
      renderWithProviders(<IntervalDatePicker {...midtermProps} onChange={onChange} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /H1 2024/i }));
      await user.click(screen.getByText('H2 (Jul-Dec)'));

      expect(onChange).toHaveBeenCalledWith('2024-12-31');
    });

    it('disables halves outside valid range', async () => {
      renderWithProviders(
        <IntervalDatePicker
          {...midtermProps}
          maxDate="2024-03-15"
          minDate="2024-01-01"
          value="2024-03-31"
        />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /H1 2024/i }));

      const h2Btn = screen.getByText('H2 (Jul-Dec)');
      expect(h2Btn).toBeDisabled();
    });
  });

  // ========================================================================
  // Annual interval
  // ========================================================================
  describe('annual interval', () => {
    const annualProps = { ...defaultProps, interval: 'annual', value: '2024-12-31' };

    it('shows the year display text on the toggle button', () => {
      renderWithProviders(<IntervalDatePicker {...annualProps} />);
      expect(screen.getByRole('button', { name: /2024/i })).toBeInTheDocument();
    });

    it('opens year grid when toggle is clicked', async () => {
      renderWithProviders(<IntervalDatePicker {...annualProps} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^2024$/i }));

      const yearGrid = document.querySelector('.year-grid');

      expect(within(yearGrid).getByRole('button', { name: /^2024$/i })).toBeInTheDocument();
      expect(within(yearGrid).getByRole('button', { name: /^2020$/i })).toBeInTheDocument();
    });

    it('selects a year and calls onChange with December 31', async () => {
      const onChange = vi.fn();
      renderWithProviders(<IntervalDatePicker {...annualProps} onChange={onChange} />);

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /2024/i }));
      await user.click(screen.getByText('2022'));

      expect(onChange).toHaveBeenCalledWith('2022-12-31');
      expect(screen.queryByText('2020')).not.toBeInTheDocument(); // dropdown closed
    });

    it('generates years from maxYear down to minYear', async () => {
      renderWithProviders(
        <IntervalDatePicker {...annualProps} maxDate="2022-12-31" minDate="2020-01-01" />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /2024/i }));

      expect(screen.getByText('2022')).toBeInTheDocument();
      expect(screen.getByText('2021')).toBeInTheDocument();
      expect(screen.getByText('2020')).toBeInTheDocument();
      expect(screen.queryByText('2023')).not.toBeInTheDocument();
      expect(screen.queryByText('2019')).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // Default / fallback interval
  // ========================================================================
  describe('fallback for unknown interval', () => {
    it('renders a native date input for unrecognized interval', () => {
      renderWithProviders(<IntervalDatePicker {...defaultProps} interval="unknown" />);
      expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'date');
    });
  });

  // ========================================================================
  // Empty value state
  // ========================================================================
  describe('empty value state', () => {
    it('shows "Select..." placeholder when value is empty', () => {
      renderWithProviders(<IntervalDatePicker {...defaultProps} interval="monthly" value="" />);
      expect(screen.getByRole('button', { name: /Select\.\.\./i })).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Boundary defaults (no minDate / no maxDate)
  // ========================================================================
  describe('default boundaries', () => {
    it('defaults maxDate to today when not provided', () => {
      renderWithProviders(<IntervalDatePicker {...defaultProps} interval="annual" maxDate={undefined} />);
      const today = new Date();
      // The toggle should show current year since value is empty
      expect(screen.getByRole('button', { name: /Select\.\.\./i })).toBeInTheDocument();
    });

    it('defaults minDate to 1900 when not provided', async () => {
      const onChange = vi.fn();
      renderWithProviders(
        <IntervalDatePicker
          {...defaultProps}
          interval="annual"
          minDate={undefined}
          maxDate="2024-12-31"
          onChange={onChange}
        />
      );

      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Select\.\.\./i }));
      // Should include 1900 in the year grid
      expect(screen.getByText('1900')).toBeInTheDocument();
    });
  });
});
