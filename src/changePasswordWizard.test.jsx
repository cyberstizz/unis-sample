// src/changePasswordWizard.test.jsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

vi.mock('./components/axiosInstance', () => ({
  default: {
    put: vi.fn(),
  },
}));

vi.mock('./context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import axiosInstance from './components/axiosInstance';
import { useAuth } from './context/AuthContext';

// Adjust casing/path only if your actual filename differs.
import ChangePasswordWizard from './changePasswordWizard';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function renderChangePasswordWizard(overrides = {}) {
  const props = {
    show: true,
    onClose: vi.fn(),
    ...overrides,
  };

  const result = render(<ChangePasswordWizard {...props} />);

  return {
    ...result,
    props,
  };
}

function getPasswordInputs() {
  const inputs = document.querySelectorAll('input[type="password"]');

  return {
    currentPasswordInput: inputs[0],
    newPasswordInput: inputs[1],
    confirmPasswordInput: inputs[2],
  };
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  useAuth.mockReturnValue({
    user: {
      userId: 'user-123',
      username: 'testuser',
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// VISIBILITY / BASIC RENDER
// ===========================================================================

describe('ChangePasswordWizard — visibility and render', () => {
  it('renders nothing when show is false', () => {
    const { container } = renderChangePasswordWizard({ show: false });

    expect(container.firstChild).toBeNull();
  });

  it('renders the change password form when show is true', () => {
    renderChangePasswordWizard();

    expect(screen.getByRole('heading', { name: /change password/i })).toBeInTheDocument();
    expect(screen.getByText(/current password/i)).toBeInTheDocument();
    expect(screen.getByText(/new password/i)).toBeInTheDocument();
    expect(screen.getByText(/confirm new password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// VALIDATION
// ===========================================================================

describe('ChangePasswordWizard — validation', () => {
  it('shows an error when the new password is shorter than 8 characters', async () => {
    const user = userEvent.setup();

    renderChangePasswordWizard();

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput } = getPasswordInputs();

    await user.type(currentPasswordInput, 'old-password');
    await user.type(newPasswordInput, 'short');
    await user.type(confirmPasswordInput, 'short');

    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(
      screen.getByText(/new password must be at least 8 characters/i)
    ).toBeInTheDocument();

    expect(axiosInstance.put).not.toHaveBeenCalled();
  });

  it('shows an error when new password and confirmation do not match', async () => {
    const user = userEvent.setup();

    renderChangePasswordWizard();

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput } = getPasswordInputs();

    await user.type(currentPasswordInput, 'old-password');
    await user.type(newPasswordInput, 'new-password-123');
    await user.type(confirmPasswordInput, 'different-password-123');

    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(axiosInstance.put).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// SUBMIT SUCCESS
// ===========================================================================

describe('ChangePasswordWizard — submit success', () => {
  it('submits the current and new password to the authenticated user password endpoint', async () => {
    const user = userEvent.setup();

    axiosInstance.put.mockResolvedValueOnce({ data: {} });

    renderChangePasswordWizard();

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput } = getPasswordInputs();

    await user.type(currentPasswordInput, 'old-password');
    await user.type(newPasswordInput, 'new-password-123');
    await user.type(confirmPasswordInput, 'new-password-123');

    await user.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => {
      expect(axiosInstance.put).toHaveBeenCalledWith(
        '/v1/users/profile/user-123/password',
        {
          oldPassword: 'old-password',
          newPassword: 'new-password-123',
        }
      );
    });
  });

  it('shows the success step after the password is changed', async () => {
    const user = userEvent.setup();

    axiosInstance.put.mockResolvedValueOnce({ data: {} });

    renderChangePasswordWizard();

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput } = getPasswordInputs();

    await user.type(currentPasswordInput, 'old-password');
    await user.type(newPasswordInput, 'new-password-123');
    await user.type(confirmPasswordInput, 'new-password-123');

    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(await screen.findByRole('heading', { name: /password changed/i })).toBeInTheDocument();
    expect(screen.getByText(/your password has been updated successfully/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// SUBMIT FAILURE
// ===========================================================================

describe('ChangePasswordWizard — submit failure', () => {
  it('shows a specific error when the current password is incorrect', async () => {
    const user = userEvent.setup();

    axiosInstance.put.mockRejectedValueOnce({
      response: {
        data: 'Old password incorrect',
      },
    });

    renderChangePasswordWizard();

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput } = getPasswordInputs();

    await user.type(currentPasswordInput, 'wrong-old-password');
    await user.type(newPasswordInput, 'new-password-123');
    await user.type(confirmPasswordInput, 'new-password-123');

    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(
      await screen.findByText(/current password is incorrect/i)
    ).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: /password changed/i })).not.toBeInTheDocument();
  });

  it('shows a generic failure message for non-password API errors', async () => {
    const user = userEvent.setup();

    axiosInstance.put.mockRejectedValueOnce({
      response: {
        data: 'Server exploded',
      },
    });

    renderChangePasswordWizard();

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput } = getPasswordInputs();

    await user.type(currentPasswordInput, 'old-password');
    await user.type(newPasswordInput, 'new-password-123');
    await user.type(confirmPasswordInput, 'new-password-123');

    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(
      await screen.findByText(/failed to change password\. please try again/i)
    ).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: /password changed/i })).not.toBeInTheDocument();
  });

  it('shows a generic failure message when the error has no response data', async () => {
    const user = userEvent.setup();

    axiosInstance.put.mockRejectedValueOnce(new Error('Network error'));

    renderChangePasswordWizard();

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput } = getPasswordInputs();

    await user.type(currentPasswordInput, 'old-password');
    await user.type(newPasswordInput, 'new-password-123');
    await user.type(confirmPasswordInput, 'new-password-123');

    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(
      await screen.findByText(/failed to change password\. please try again/i)
    ).toBeInTheDocument();
  });
});

// ===========================================================================
// CLOSE / RESET
// ===========================================================================

describe('ChangePasswordWizard — close and reset', () => {
  it('Cancel closes the wizard and resets fields/errors', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { rerender } = render(
      <ChangePasswordWizard show={true} onClose={onClose} />
    );

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput } = getPasswordInputs();

    await user.type(currentPasswordInput, 'old-password');
    await user.type(newPasswordInput, 'short');
    await user.type(confirmPasswordInput, 'short');

    await user.click(screen.getByRole('button', { name: /change password/i }));

    expect(screen.getByText(/new password must be at least 8 characters/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<ChangePasswordWizard show={true} onClose={onClose} />);

    const inputsAfterReset = getPasswordInputs();

    expect(inputsAfterReset.currentPasswordInput).toHaveValue('');
    expect(inputsAfterReset.newPasswordInput).toHaveValue('');
    expect(inputsAfterReset.confirmPasswordInput).toHaveValue('');
    expect(screen.queryByText(/new password must be at least 8 characters/i)).not.toBeInTheDocument();
  });

  it('clicking the backdrop closes the wizard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = renderChangePasswordWizard({ onClose });

    const backdrop = container.firstChild;

    await user.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the modal does not close the wizard', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container } = renderChangePasswordWizard({ onClose });

    const modal = container.firstChild.firstChild;

    await user.click(modal);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('Done closes the wizard after success', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    axiosInstance.put.mockResolvedValueOnce({ data: {} });

    renderChangePasswordWizard({ onClose });

    const { currentPasswordInput, newPasswordInput, confirmPasswordInput } = getPasswordInputs();

    await user.type(currentPasswordInput, 'old-password');
    await user.type(newPasswordInput, 'new-password-123');
    await user.type(confirmPasswordInput, 'new-password-123');

    await user.click(screen.getByRole('button', { name: /change password/i }));

    await screen.findByRole('heading', { name: /password changed/i });

    await user.click(screen.getByRole('button', { name: /done/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});