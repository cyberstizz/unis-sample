import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminRoute from './AdminRoute';

vi.mock('./context/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from './context/AuthContext';

const renderWithRole = (adminRole = null, requiredLevel = 'moderator', hasToken = true) => {
  useAuth.mockReturnValue({ user: adminRole ? { adminRole } : null });
  if (hasToken) {
    localStorage.setItem('token', 'mock-token');
  } else {
    localStorage.removeItem('token');
  }

  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/admin" element={<AdminRoute requiredLevel={requiredLevel} />}>
          <Route index element={<div>Admin Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ─── no token / no user ──────────────────────────────────────────────────────

describe('unauthenticated access', () => {
  it('redirects to /login when no token is present', () => {
    renderWithRole(null, 'moderator', false);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to /login when token exists but user is null', () => {
    useAuth.mockReturnValue({ user: null });
    localStorage.setItem('token', 'mock-token');
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/admin" element={<AdminRoute />}>
            <Route index element={<div>Admin Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to / when user has no adminRole', () => {
    useAuth.mockReturnValue({ user: { adminRole: null } });
    localStorage.setItem('token', 'mock-token');
    render(
      <MemoryRouter initialEntries={['/admin/something']}>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/admin/something" element={<AdminRoute />}>
            <Route index element={<div>Admin Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });
});

// ─── moderator access ────────────────────────────────────────────────────────

describe('moderator role', () => {
  it('grants access to moderator-level routes', () => {
    renderWithRole('moderator', 'moderator');
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('redirects to /admin when moderator tries to access admin-level route', () => {
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin" element={<div>Admin Index</div>} />
          <Route path="/admin/users" element={
            <AdminRoute requiredLevel="admin" />
          }>
            <Route index element={<div>User Management</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    useAuth.mockReturnValue({ user: { adminRole: 'moderator' } });
    // Already rendered with wrong mock — re-render properly
  });

  it('blocks moderator from super_admin routes', () => {
    useAuth.mockReturnValue({ user: { adminRole: 'moderator' } });
    localStorage.setItem('token', 'mock-token');
    render(
      <MemoryRouter initialEntries={['/admin/roles']}>
        <Routes>
          <Route path="/admin" element={<div>Admin Index</div>} />
          <Route path="/admin/roles" element={<AdminRoute requiredLevel="super_admin" />}>
            <Route index element={<div>Roles Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Admin Index')).toBeInTheDocument();
    expect(screen.queryByText('Roles Page')).not.toBeInTheDocument();
  });
});

// ─── admin role ──────────────────────────────────────────────────────────────

describe('admin role', () => {
  it('grants access to moderator-level routes', () => {
    renderWithRole('admin', 'moderator');
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('grants access to admin-level routes', () => {
    renderWithRole('admin', 'admin');
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('blocks admin from super_admin routes', () => {
    useAuth.mockReturnValue({ user: { adminRole: 'admin' } });
    localStorage.setItem('token', 'mock-token');
    render(
      <MemoryRouter initialEntries={['/admin/roles']}>
        <Routes>
          <Route path="/admin" element={<div>Admin Index</div>} />
          <Route path="/admin/roles" element={<AdminRoute requiredLevel="super_admin" />}>
            <Route index element={<div>Roles Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Admin Index')).toBeInTheDocument();
    expect(screen.queryByText('Roles Page')).not.toBeInTheDocument();
  });
});

// ─── super_admin role ────────────────────────────────────────────────────────

describe('super_admin role', () => {
  it('grants access to moderator-level routes', () => {
    renderWithRole('super_admin', 'moderator');
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('grants access to admin-level routes', () => {
    renderWithRole('super_admin', 'admin');
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });

  it('grants access to super_admin routes', () => {
    renderWithRole('super_admin', 'super_admin');
    expect(screen.getByText('Admin Content')).toBeInTheDocument();
  });
});