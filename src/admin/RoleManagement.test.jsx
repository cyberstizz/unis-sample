// src/pages/__tests__/RoleManagement.test.jsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import RoleManagement from './RoleManagement';
import { apiCall } from '../components/axiosInstance';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeRole = (overrides = {}) => ({
  adminRoleId: 'role-123',
  roleLevel: 'moderator',
  createdAt: '2026-04-01T10:00:00Z',
  isProtected: false,
  user: { username: 'moderator1' },
  ...overrides,
});

const makeRolesResponse = (roles = []) => ({ data: roles });

beforeEach(() => {
  vi.clearAllMocks();
  window.confirm = vi.fn(() => true);
});

// Updated render helper with BOTH providers
const renderWithProviders = () => {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <RoleManagement />
      </MemoryRouter>
    </AuthProvider>
  );
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('RoleManagement', () => {

  it('shows loading state initially', () => {
    apiCall.mockResolvedValue(makeRolesResponse());
    renderWithProviders();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('fetches and displays roles', async () => {
    const roles = [
      makeRole(),
      makeRole({ adminRoleId: 'role-456', roleLevel: 'admin', user: { username: 'adminUser' } }),
    ];

    apiCall.mockResolvedValue(makeRolesResponse(roles));
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('moderator1')).toBeInTheDocument();
      expect(screen.getByText('adminUser')).toBeInTheDocument();
    });
  });

  it('shows empty state when no roles exist', async () => {
    apiCall.mockResolvedValue(makeRolesResponse([]));
    renderWithProviders();

    await waitFor(() =>
      expect(screen.getByText('No admin roles assigned.')).toBeInTheDocument()
    );
  });

  // ── Grant Role Flow ────────────────────────────────────────────────────────

  it('toggles the grant role form', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue(makeRolesResponse([]));

    renderWithProviders();

    await waitFor(() => screen.getByText('Grant Role'));
    await user.click(screen.getByText('Grant Role'));

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste user UUID')).toBeInTheDocument();
  });

  it('grants a new role successfully', async () => {
    const user = userEvent.setup();
    apiCall
      .mockResolvedValueOnce(makeRolesResponse([]))
      .mockResolvedValueOnce({}) 
      .mockResolvedValueOnce(makeRolesResponse([makeRole()]));

    renderWithProviders();

    await waitFor(() => screen.getByText('Grant Role'));
    await user.click(screen.getByText('Grant Role'));

    await user.type(screen.getByPlaceholderText('Paste user UUID'), 'user-uuid-999');
    await user.selectOptions(screen.getByRole('combobox'), 'admin');

    await user.click(screen.getByText('Grant Role'));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        url: '/v1/admin/roles',
        method: 'post',
        data: { userId: 'user-uuid-999', roleLevel: 'admin' },
      });
    });
  });

  // ── Revoke Flow ────────────────────────────────────────────────────────────

  it('revokes a role after confirmation', async () => {
    const user = userEvent.setup();
    const role = makeRole({ adminRoleId: 'role-999', user: { username: 'badmod' } });

    apiCall
      .mockResolvedValueOnce(makeRolesResponse([role]))
      .mockResolvedValueOnce({});

    renderWithProviders();

    await waitFor(() => screen.getByText('Revoke'));
    await user.click(screen.getByText('Revoke'));

    expect(window.confirm).toHaveBeenCalledWith('Revoke admin role from badmod?');
  });

  it('does not show Revoke button for protected or super_admin roles', async () => {
    apiCall.mockResolvedValue(makeRolesResponse([
      makeRole({ roleLevel: 'super_admin' }),
      makeRole({ isProtected: true, roleLevel: 'moderator' }),
    ]));

    renderWithProviders();

    await waitFor(() => {
      expect(screen.queryByText('Revoke')).not.toBeInTheDocument();
    });
  });
});