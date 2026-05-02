// src/pages/__tests__/UserDetail.test.jsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import UserDetail from './UserDetail';
import { apiCall } from '../components/axiosInstance';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeUserData = (overrides = {}) => ({
  user: {
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    score: 420,
    level: 'gold',
    photoUrl: null,
    ...overrides.user,
  },
  isSuspended: false,
  suspensionHistory: [],
  adminRole: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
});

const renderWithProviders = (userId = 'user-123') => {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/admin/users/${userId}`]}>
        <Routes>
          <Route path="/admin/users/:userId" element={<UserDetail />} />
          <Route path="/admin/users" element={<div>Users List Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('UserDetail', () => {

  it('shows loading state', () => {
    apiCall.mockResolvedValue({ data: makeUserData() });
    renderWithProviders();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows "User not found" when data is missing', async () => {
    apiCall.mockResolvedValue({ data: null });
    renderWithProviders();

    await waitFor(() =>
      expect(screen.getByText('User not found.')).toBeInTheDocument()
    );
  });

  it('renders user profile information correctly', async () => {
    apiCall.mockResolvedValue({
      data: makeUserData({
        user: { username: 'coolguy', email: 'coolguy@example.com', score: 1337, level: 'diamond' }
      })
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('coolguy')).toBeInTheDocument();
      expect(screen.getByText('coolguy@example.com')).toBeInTheDocument();
      expect(screen.getByText('Score: 1337')).toBeInTheDocument();
      expect(screen.getByText('Level: diamond')).toBeInTheDocument();
    });
  });

  it('shows suspension warning when user is suspended', async () => {
    apiCall.mockResolvedValue({ data: makeUserData({ isSuspended: true }) });
    renderWithProviders();

    await waitFor(() =>
      expect(screen.getByText('⚠ ACCOUNT SUSPENDED')).toBeInTheDocument()
    );
  });

  // ── Actions ────────────────────────────────────────────────────────────────

  it('shows Suspend button for active users and opens form', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue({ data: makeUserData() });
    renderWithProviders();

    await waitFor(() => screen.getByText('Suspend Account'));
    await user.click(screen.getByText('Suspend Account'));

    expect(screen.getByPlaceholderText('Reason for suspension (required)')).toBeInTheDocument();
  });

  it('suspends user successfully', async () => {
    const user = userEvent.setup();
    apiCall
      .mockResolvedValueOnce({ data: makeUserData() })
      .mockResolvedValueOnce({}) // suspend call
      .mockResolvedValueOnce({ data: makeUserData({ isSuspended: true }) }); // refetch

    renderWithProviders();

    await waitFor(() => screen.getByText('Suspend Account'));
    await user.click(screen.getByText('Suspend Account'));

    await user.type(screen.getByPlaceholderText('Reason for suspension (required)'), 'Toxic behavior');
    await user.selectOptions(screen.getByRole('combobox'), 'permanent');

    await user.click(screen.getByText('Confirm Suspension'));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        url: '/v1/admin/users/user-123/suspend',
        method: 'post',
        data: { reason: 'Toxic behavior', suspensionType: 'permanent' },
      });
    });
  });

  it('shows alert when suspend reason is empty', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    apiCall.mockResolvedValue({ data: makeUserData() });
    renderWithProviders();

    await waitFor(() => screen.getByText('Suspend Account'));
    await user.click(screen.getByText('Suspend Account'));
    await user.click(screen.getByText('Confirm Suspension'));

    expect(alertSpy).toHaveBeenCalledWith('Reason is required');
  });

  it('unsuspends a suspended user', async () => {
    const user = userEvent.setup();
    apiCall
      .mockResolvedValueOnce({ data: makeUserData({ isSuspended: true }) })
      .mockResolvedValueOnce({}) // unsuspend
      .mockResolvedValueOnce({ data: makeUserData() }); // refetch

    renderWithProviders();

    await waitFor(() => screen.getByText('Lift Suspension'));
    await user.click(screen.getByText('Lift Suspension'));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        url: '/v1/admin/users/user-123/unsuspend',
        method: 'post',
        data: { reason: 'Suspension lifted by admin' },
      });
    });
  });

  it('shows and handles permanent delete for super_admin', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    apiCall.mockResolvedValue({ data: makeUserData() });

    // Mock current user as super_admin
    vi.spyOn(require('../context/AuthContext'), 'useAuth').mockReturnValue({
      user: { adminRole: 'super_admin' }
    });

    renderWithProviders();

    await waitFor(() => screen.getByText('Permanently Delete'));
    await user.click(screen.getByText('Permanently Delete'));

    expect(window.confirm).toHaveBeenCalled();
  });

  it('shows suspension history when available', async () => {
    apiCall.mockResolvedValue({
      data: makeUserData({
        suspensionHistory: [
          {
            suspensionId: 's1',
            reason: 'Spamming',
            suspensionType: 'permanent',
            createdAt: '2026-04-01T00:00:00Z'
          }
        ]
      })
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Suspension History')).toBeInTheDocument();
      expect(screen.getByText('Spamming')).toBeInTheDocument();
    });
  });

  it('navigates back to users list', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue({ data: makeUserData() });

    renderWithProviders();

    await waitFor(() => screen.getByText('Back to Users'));
    await user.click(screen.getByText('Back to Users'));

    await waitFor(() =>
      expect(screen.getByText('Users List Page')).toBeInTheDocument()
    );
  });
});