import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ResetPassword from './ResetPassword';
import axiosInstance from './components/axiosInstance';

vi.mock('./components/axiosInstance', () => ({ default: { post: vi.fn() } }));
vi.mock('./assets/UnisFireFinal.png', () => ({ default: 'unis-logo.png' }));

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

const renderWithToken = (token = null) => {
  const params = new URLSearchParams(token ? { token } : {});
  useSearchParams.mockReturnValue([params]);
  return render(
    <MemoryRouter>
      <ResetPassword />
    </MemoryRouter>
  );
};

beforeEach(() => vi.clearAllMocks());

// ─── invalid state ───────────────────────────────────────────────────────────

describe('invalid state — no token in URL', () => {
  it('renders the invalid link message', () => {
    renderWithToken(null);
    expect(screen.getByText('Invalid Reset Link')).toBeInTheDocument();
  });

  it('navigates to /login on button click', () => {
    renderWithToken(null);
    fireEvent.click(screen.getByRole('button', { name: /back to login/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('does not render the password form', () => {
    renderWithToken(null);
    expect(screen.queryByPlaceholderText(/minimum 8 characters/i)).not.toBeInTheDocument();
  });
});

// ─── form state ──────────────────────────────────────────────────────────────

describe('form state — token present', () => {
  it('renders the password form', () => {
    renderWithToken('abc123');
    expect(screen.getByText('Set New Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/minimum 8 characters/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/re-enter your password/i)).toBeInTheDocument();
  });

  it('navigates to /login via the back link', () => {
    renderWithToken('abc123');
    fireEvent.click(screen.getByRole('button', { name: /back to login/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

// ─── client-side validation ──────────────────────────────────────────────────

describe('client-side validation', () => {
  it('blocks submission and shows error when password is under 8 chars', async () => {
    renderWithToken('abc123');
    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('blocks submission and shows error when passwords do not match', async () => {
    renderWithToken('abc123');
    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'different123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();
  });
});

// ─── strength indicator ──────────────────────────────────────────────────────

describe('password strength indicator', () => {
  it('is hidden when the field is empty', () => {
    renderWithToken('abc123');
    expect(screen.queryByText(/too short|good|strong/i)).not.toBeInTheDocument();
  });

  it('shows "Too short" for under 8 chars', () => {
    renderWithToken('abc123');
    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'abc' } });
    expect(screen.getByText('Too short')).toBeInTheDocument();
  });

  it('shows "Good" for 8–11 chars', () => {
    renderWithToken('abc123');
    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'password1' } });
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('shows "Strong" for 12+ chars', () => {
    renderWithToken('abc123');
    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'supersecurepass' } });
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });
});

// ─── successful submission ───────────────────────────────────────────────────

describe('successful submission', () => {
  it('transitions to success state', async () => {
    axiosInstance.post.mockResolvedValueOnce({});
    renderWithToken('abc123');

    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('Password Reset')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to login/i })).toBeInTheDocument();
  });

  it('calls /auth/reset-password with correct payload', async () => {
    axiosInstance.post.mockResolvedValueOnce({});
    renderWithToken('mytoken');

    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'mytoken',
        newPassword: 'newpassword123',
      });
    });
  });

  it('navigates to /login from success state', async () => {
    axiosInstance.post.mockResolvedValueOnce({});
    renderWithToken('abc123');

    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await screen.findByText('Password Reset');
    fireEvent.click(screen.getByRole('button', { name: /go to login/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

// ─── API error handling ──────────────────────────────────────────────────────

describe('API error handling', () => {
  it('shows generic error banner and stays on form for unknown errors', async () => {
    axiosInstance.post.mockRejectedValueOnce({ response: null });
    renderWithToken('abc123');

    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/minimum 8 characters/i)).toBeInTheDocument();
  });

  it.each([
    ['Token has expired', 'expired'],
    ['Invalid token provided', 'Invalid'],
    ['Token has already been used', 'already been used'],
  ])('transitions to error state for: %s', async (errorMsg) => {
    axiosInstance.post.mockRejectedValueOnce({ response: { data: { error: errorMsg } } });
    renderWithToken('abc123');

    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('Link Expired')).toBeInTheDocument();
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it('disables the button and shows Resetting... while in-flight', async () => {
    axiosInstance.post.mockReturnValueOnce(new Promise(() => {}));
    renderWithToken('abc123');

    fireEvent.change(screen.getByPlaceholderText(/minimum 8 characters/i), { target: { value: 'newpassword123' } });
    fireEvent.change(screen.getByPlaceholderText(/re-enter your password/i), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByRole('button', { name: /resetting/i })).toBeDisabled();
  });
});