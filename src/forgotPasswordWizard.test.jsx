// src/forgotPasswordWizard.test.jsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

vi.mock('./components/axiosInstance', () => ({
  default: {
    post: vi.fn(),
  },
}));

import axiosInstance from './components/axiosInstance';

// Adjust casing/path only if your actual filename differs.
import ForgotPasswordWizard from './forgotPasswordWizard';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function renderForgotPasswordWizard(overrides = {}) {
  const props = {
    show: true,
    onClose: vi.fn(),
    ...overrides,
  };

  const result = render(<ForgotPasswordWizard {...props} />);

  return {
    ...result,
    props,
  };
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// VISIBILITY / BASIC RENDER
// ===========================================================================

describe('ForgotPasswordWizard — visibility and render', () => {
  it('renders nothing when show is false', () => {
    const { container } = renderForgotPasswordWizard({ show: false });

    expect(container.firstChild).toBeNull();
  });

  it('renders the forgot password form when show is true', () => {
    renderForgotPasswordWizard();

    expect(screen.getByRole('heading', { name: /forgot password/i })).toBeInTheDocument();
    expect(
      screen.getByText(/enter your email address and we'll send you a link/i)
    ).toBeInTheDocument();

    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// VALIDATION
// ===========================================================================

describe('ForgotPasswordWizard — validation', () => {
  it('shows an error when submitting with an empty email', async () => {
    const user = userEvent.setup();

    renderForgotPasswordWizard();

    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(
      screen.getByText(/please enter your email address/i)
    ).toBeInTheDocument();

    expect(axiosInstance.post).not.toHaveBeenCalled();
  });

  it('shows an error when submitting whitespace only', async () => {
    const user = userEvent.setup();

    renderForgotPasswordWizard();

    await user.type(screen.getByPlaceholderText(/enter your email/i), '   ');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(
      screen.getByText(/please enter your email address/i)
    ).toBeInTheDocument();

    expect(axiosInstance.post).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// SUBMIT SUCCESS / EMAIL ENUMERATION PROTECTION
// ===========================================================================

describe('ForgotPasswordWizard — submit behavior', () => {
  it('posts the entered email to /auth/forgot-password', async () => {
    const user = userEvent.setup();

    axiosInstance.post.mockResolvedValueOnce({ data: {} });

    renderForgotPasswordWizard();

    await user.type(screen.getByPlaceholderText(/enter your email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'user@example.com',
      });
    });
  });

  it('shows the check-your-email step after successful submit', async () => {
    const user = userEvent.setup();

    axiosInstance.post.mockResolvedValueOnce({ data: {} });

    renderForgotPasswordWizard();

    await user.type(screen.getByPlaceholderText(/enter your email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(
      await screen.findByRole('heading', { name: /check your email/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/user@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/we've sent a password reset link/i)).toBeInTheDocument();
    expect(screen.getByText(/the link expires in 1 hour/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument();
  });

  it('still shows the check-your-email step when the API fails', async () => {
    const user = userEvent.setup();

    axiosInstance.post.mockRejectedValueOnce(new Error('Network error'));

    renderForgotPasswordWizard();

    await user.type(screen.getByPlaceholderText(/enter your email/i), 'missing@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(
      await screen.findByRole('heading', { name: /check your email/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/missing@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/we've sent a password reset link/i)).toBeInTheDocument();
  });

  it('submits when Enter is pressed in the email input', async () => {
    const user = userEvent.setup();

    axiosInstance.post.mockResolvedValueOnce({ data: {} });

    renderForgotPasswordWizard();

    const emailInput = screen.getByPlaceholderText(/enter your email/i);

    await user.type(emailInput, 'enter@example.com');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'enter@example.com',
      });
    });

    expect(
      await screen.findByRole('heading', { name: /check your email/i })
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// LOADING STATE
// ===========================================================================

describe('ForgotPasswordWizard — loading state', () => {
  it('shows Sending... while the request is in flight', async () => {
    const user = userEvent.setup();

    let resolveRequest;
    axiosInstance.post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );

    renderForgotPasswordWizard();

    await user.type(screen.getByPlaceholderText(/enter your email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();

    resolveRequest({ data: {} });

    expect(
      await screen.findByRole('heading', { name: /check your email/i })
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// CLOSE BEHAVIOR
// ===========================================================================

describe('ForgotPasswordWizard — close behavior', () => {
  it('Cancel closes the wizard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderForgotPasswordWizard({ onClose });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Back to Login closes the wizard from the success step', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    axiosInstance.post.mockResolvedValueOnce({ data: {} });

    renderForgotPasswordWizard({ onClose });

    await user.type(screen.getByPlaceholderText(/enter your email/i), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await screen.findByRole('heading', { name: /check your email/i });

    await user.click(screen.getByRole('button', { name: /back to login/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop closes the wizard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = renderForgotPasswordWizard({ onClose });

    const backdrop = container.firstChild;

    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the modal does not close the wizard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = renderForgotPasswordWizard({ onClose });

    const modal = container.firstChild.firstChild;

    await user.click(modal);

    expect(onClose).not.toHaveBeenCalled();
  });
});