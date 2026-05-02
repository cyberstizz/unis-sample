// src/pages/__tests__/UserManagement.test.jsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import UserManagement from './UserManagement';
import { apiCall } from '../components/axiosInstance';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeUser = (overrides = {}) => ({
  userId: 'u-123',
  username: 'testuser',
  email: 'test@example.com',
  role: 'listener',
  score: 420,
  photoUrl: null,
  ...overrides,
});

const makeUsersResponse = (users = [], totalPages = 1) => ({
  data: {
    content: users,
    totalPages,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

const renderWithProviders = () => {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/users/:userId" element={<div>User Detail Page</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('UserManagement', () => {

  it('renders header and search controls', () => {
    apiCall.mockResolvedValue(makeUsersResponse());
    renderWithProviders();

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by username or email...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument(); // role filter
  });

  it('fetches and displays users', async () => {
    const users = [
      makeUser({ username: 'alice', email: 'alice@example.com' }),
      makeUser({ username: 'bob', role: 'artist', score: 890 }),
    ];

    apiCall.mockResolvedValue(makeUsersResponse(users));
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.getByText('listener')).toBeInTheDocument();
      expect(screen.getByText('artist')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    apiCall.mockResolvedValue(makeUsersResponse());
    renderWithProviders();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // ── Search ───────────────────────────────────────────────────────────────

  it('searches users and resets to page 0', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue(makeUsersResponse());

    renderWithProviders();

    const searchInput = screen.getByPlaceholderText('Search by username or email...');
    await user.type(searchInput, 'alice');
    await user.click(screen.getByText('Search'));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('search=alice'),
          method: 'get',
        })
      );
    });
  });

  // ── Role Filter ───────────────────────────────────────────────────────────

  it('filters by role and resets page', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue(makeUsersResponse());

    renderWithProviders();

    await user.selectOptions(screen.getByRole('combobox'), 'artist');

    await waitFor(() => {
      expect(apiCall).toHaveBeenLastCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('role=artist'),
          method: 'get',
        })
      );
    });
  });

  // ── Navigation to Detail ──────────────────────────────────────────────────

  it('navigates to user detail when clicking a user row', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue(makeUsersResponse([makeUser({ username: 'clickable' })]));

    renderWithProviders();

    await waitFor(() => screen.getByText('clickable'));
    await user.click(screen.getByText('clickable'));

    await waitFor(() =>
      expect(screen.getByText('User Detail Page')).toBeInTheDocument()
    );
  });

  // ── Pagination ────────────────────────────────────────────────────────────

  it('renders pagination when there are multiple pages', async () => {
    apiCall.mockResolvedValue(makeUsersResponse([makeUser()], 5));

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });
  });

  it('handles pagination buttons correctly', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue(makeUsersResponse([makeUser()], 3));

    renderWithProviders();

    await waitFor(() => screen.getByText('Next'));

    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('page=1') })
      );
    });
  });

  it('disables Previous button on first page and Next on last page', async () => {
    apiCall.mockResolvedValue(makeUsersResponse([makeUser()], 1));

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeDisabled();
      expect(screen.getByText('Next')).toBeDisabled();
    });
  });

  it('shows empty state when no users are returned', async () => {
    apiCall.mockResolvedValue(makeUsersResponse([]));
    renderWithProviders();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      // If you have an explicit empty message, add it here. Otherwise this confirms no crash.
    });
  });
});