// src/pages/ResetPassword.test.jsx
// Tests the live reset page (routed at /reset-password). Replaces
// src/ResetPassword.test.jsx, which described a design that was never built
// (strength meter, "Link Expired" screen) and pointed at a stray copy of the
// page outside src/pages.
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));
vi.mock('../layout', () => ({ default: ({ children }) => <div data-testid="layout">{children}</div> }));
vi.mock('../assets/randomrapper.jpeg', () => ({ default: 'bg.jpeg' }));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: vi.fn(),
  };
});

import { useSearchParams } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';
import ResetPassword from './ResetPassword';

const renderWithToken = (token = null) => {
  const params = new URLSearchParams(token ? { token } : {});
  useSearchParams.mockReturnValue([params]);
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>
  );
};

const fill = (pw, confirm = pw) => {
  fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: pw } });
  fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: confirm } });
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe('ResetPassword — the form', () => {
  it('renders the heading and both password fields', () => {
    renderWithToken('abc123');
    expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/minimum 8 characters/i)).toHaveAttribute('type', 'password');
    expect(screen.getByPlaceholderText(/re-enter your password/i)).toHaveAttribute('type', 'password');
  });
});

describe('ResetPassword — validation (no request sent)', () => {
  it('rejects a link with no token', async () => {
    renderWithToken(null);
    fill('newpassword123');
    submit();
    expect(await screen.findByText(/invalid reset link/i)).toBeInTheDocument();
    expect(apiCall).not.toHaveBeenCalled();
  });

  it('rejects a password under 8 characters', async () => {
    renderWithToken('abc123');
    fill('short');
    submit();
    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(apiCall).not.toHaveBeenCalled();
  });

  it('rejects passwords that do not match', async () => {
    renderWithToken('abc123');
    fill('password123', 'different123');
    submit();
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(apiCall).not.toHaveBeenCalled();
  });
});

describe('ResetPassword — submitting', () => {
  it('posts the token and new password to /auth/reset-password', async () => {
    apiCall.mockResolvedValueOnce({});
    renderWithToken('mytoken');
    fill('newpassword123');
    submit();
    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        url: '/auth/reset-password',
        method: 'post',
        data: { token: 'mytoken', newPassword: 'newpassword123' },
      });
    });
  });

  it('shows the success screen, then goes to /login after 3 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    apiCall.mockResolvedValueOnce({});
    renderWithToken('abc123');
    fill('newpassword123');
    submit();

    expect(await screen.findByText('Password Reset Successfully')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('disables the button and shows Resetting... while the request is in flight', async () => {
    apiCall.mockReturnValueOnce(new Promise(() => {}));
    renderWithToken('abc123');
    fill('newpassword123');
    submit();
    const btn = await screen.findByRole('button', { name: /resetting/i });
    expect(btn).toBeDisabled();
  });
});

describe('ResetPassword — server errors', () => {
  it('shows the server’s message and keeps the form', async () => {
    apiCall.mockRejectedValueOnce({ response: { data: { error: 'Token has expired' } } });
    renderWithToken('abc123');
    fill('newpassword123');
    submit();
    expect(await screen.findByText('Token has expired')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/minimum 8 characters/i)).toBeInTheDocument();
  });

  it('falls back to a plain message when the server gives none', async () => {
    apiCall.mockRejectedValueOnce({ response: null });
    renderWithToken('abc123');
    fill('newpassword123');
    submit();
    expect(await screen.findByText('Reset link is invalid or expired.')).toBeInTheDocument();
    // the button is usable again
    expect(screen.getByRole('button', { name: /reset password/i })).not.toBeDisabled();
  });
});
