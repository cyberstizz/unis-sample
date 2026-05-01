// src/ThemePicker.test.jsx

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import ThemePicker from './ThemePicker';
import { useAuth } from './context/AuthContext';

vi.mock('./context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('lucide-react', () => ({
  Check: ({ size, color, strokeWidth, ...props }) => (
    <span data-testid="check-icon" {...props}>
      CheckIcon
    </span>
  ),
}));

describe('ThemePicker', () => {
  const setTheme = vi.fn();

  beforeEach(() => {
    setTheme.mockReset();

    useAuth.mockReturnValue({
      theme: 'blue',
      setTheme,
    });
  });

  test('renders the heading and description', () => {
    render(<ThemePicker userId="user-1" />);

    expect(screen.getByText('Color Theme')).toBeInTheDocument();

    expect(
      screen.getByText(/choose your unis color theme/i)
    ).toBeInTheDocument();
  });

  test('renders all available theme options', () => {
    render(<ThemePicker userId="user-1" />);

    expect(screen.getByRole('button', { name: /unis blue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /orange/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /red/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /green/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /purple/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gold/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dianna/i })).toBeInTheDocument();
  });

  test('shows a check icon on the active theme', () => {
    render(<ThemePicker userId="user-1" />);

    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  test('does not call setTheme when clicking the already active theme', () => {
    render(<ThemePicker userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: /unis blue/i }));

    expect(setTheme).not.toHaveBeenCalled();
  });

  test('calls setTheme with selected theme id and userId when choosing a new theme', () => {
    render(<ThemePicker userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: /orange/i }));

    expect(setTheme).toHaveBeenCalledTimes(1);
    expect(setTheme).toHaveBeenCalledWith('orange', 'user-1');
  });

  test('calls setTheme for the Dianna theme', () => {
    render(<ThemePicker userId="user-1" />);

    fireEvent.click(screen.getByRole('button', { name: /dianna/i }));

    expect(setTheme).toHaveBeenCalledTimes(1);
    expect(setTheme).toHaveBeenCalledWith('dianna', 'user-1');
  });

  test('marks the correct theme as active based on auth context', () => {
    useAuth.mockReturnValue({
      theme: 'green',
      setTheme,
    });

    render(<ThemePicker userId="user-1" />);

    const checkIcon = screen.getByTestId('check-icon');

    expect(checkIcon).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /green/i }));

    expect(setTheme).not.toHaveBeenCalled();
  });

  test('allows selecting a theme even when userId is undefined', () => {
    render(<ThemePicker />);

    fireEvent.click(screen.getByRole('button', { name: /purple/i }));

    expect(setTheme).toHaveBeenCalledWith('purple', undefined);
  });
});