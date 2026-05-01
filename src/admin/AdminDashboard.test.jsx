import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminDashboard from './AdminDashboard';
import { apiCall } from '../components/axiosInstance';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('./CronStatusPanel', () => ({ default: () => <div data-testid="cron-status-panel" /> }));
vi.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

import { useAuth } from '../context/AuthContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockOverview = {
  totalUsers: 1200,
  totalArtists: 340,
  totalSongs: 890,
  dauToday: 75,
  dauYesterday: 50,
  signupsToday: 12,
  playsToday: 430,
  openDmcaClaims: 3,
  activeSuspensions: 1,
};

const mockDauData = {
  '2026-04-01': 40,
  '2026-04-02': 55,
  '2026-04-03': 75,
};

const mockWaitlist = {
  totalPreRegistrations: 500,
  totalArtists: 80,
  signupsToday: 14,
  signupsByState: { NY: 200, CA: 150, TX: 100 },
  topRegions: [
    { metroRegion: 'Los Angeles', stateCode: 'CA', count: 150, threshold: 200, progressPercent: 75 },
    { metroRegion: 'Houston', stateCode: 'TX', count: 100, threshold: 200, progressPercent: 50 },
  ],
};

const setupApiMocks = (overrides = {}) => {
  apiCall.mockImplementation(({ url }) => {
    if (url === '/v1/admin/analytics/overview') return Promise.resolve({ data: overrides.overview ?? mockOverview });
    if (url === '/v1/admin/analytics/dau') return Promise.resolve({ data: overrides.dau ?? mockDauData });
    if (url === '/v1/admin/analytics/waitlist') return Promise.resolve({ data: overrides.waitlist ?? mockWaitlist });
    return Promise.resolve({ data: {} });
  });
};

const renderDashboard = (adminRole = 'moderator') => {
  useAuth.mockReturnValue({ user: { username: 'charleslamb', adminRole } });
  return render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
};

beforeEach(() => vi.clearAllMocks());

// ─── loading state ────────────────────────────────────────────────────────────

describe('loading state', () => {
  it('shows loading indicator while fetching', () => {
    apiCall.mockReturnValue(new Promise(() => {}));
    useAuth.mockReturnValue({ user: { username: 'charleslamb', adminRole: 'moderator' } });
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>);
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });
});

// ─── rendering after data loads ───────────────────────────────────────────────

describe('dashboard renders after fetch', () => {
  it('shows the page title and welcome message', async () => {
    setupApiMocks();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument());
    expect(screen.getByText(/Welcome, charleslamb/i)).toBeInTheDocument();
    expect(screen.getByText(/Role: moderator/i)).toBeInTheDocument();
  });

  it('renders all platform stat cards', async () => {
    setupApiMocks();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Total Users')).toBeInTheDocument());
    expect(screen.getByText('1200')).toBeInTheDocument();
    expect(screen.getByText('Total Artists')).toBeInTheDocument();
    expect(screen.getByText('Total Songs')).toBeInTheDocument();
    expect(screen.getByText('DAU Today')).toBeInTheDocument();
  });

  it('calculates and displays the DAU percentage change', async () => {
    setupApiMocks();
    renderDashboard();
    // dauToday=75, dauYesterday=50 → +50%
    await waitFor(() => expect(screen.getByText(/\+50% vs yesterday/i)).toBeInTheDocument());
  });

  it('shows "Same as yesterday" when DAU change is zero', async () => {
    setupApiMocks({ overview: { ...mockOverview, dauToday: 50, dauYesterday: 50 } });
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Same as yesterday')).toBeInTheDocument());
  });

  it('renders the DAU chart', async () => {
    setupApiMocks();
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('line-chart')).toBeInTheDocument());
  });

  it('renders the CronStatusPanel', async () => {
    setupApiMocks();
    renderDashboard();
    await waitFor(() => expect(screen.getByTestId('cron-status-panel')).toBeInTheDocument());
  });
});

// ─── waitlist banner ──────────────────────────────────────────────────────────

describe('waitlist banner', () => {
  it('renders when totalPreRegistrations > 0', async () => {
    setupApiMocks();
    renderDashboard();
    await waitFor(() => expect(screen.getByText('National Waitlist')).toBeInTheDocument());
    expect(screen.getByText('Waitlist Total')).toBeInTheDocument();
    expect(screen.getByText('Waitlist Artists')).toBeInTheDocument();
    expect(screen.getByText('Waitlist Today')).toBeInTheDocument();
    expect(screen.getByText('States Covered')).toBeInTheDocument();
  });

  it('does not render when totalPreRegistrations is 0', async () => {
    setupApiMocks({ waitlist: { totalPreRegistrations: 0 } });
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument());
    expect(screen.queryByText('National Waitlist')).not.toBeInTheDocument();
  });

  it('renders top regions with progress bars', async () => {
    setupApiMocks();
    renderDashboard();
    await waitFor(() => expect(screen.getByText(/Los Angeles, CA/i)).toBeInTheDocument());
    expect(screen.getByText(/Houston, TX/i)).toBeInTheDocument();
    expect(screen.getByText(/150\/200/)).toBeInTheDocument();
  });
});

// ─── quick nav buttons ────────────────────────────────────────────────────────

describe('quick nav buttons', () => {
  it('always renders Moderation Queue, Official Playlists, Full Analytics', async () => {
    setupApiMocks();
    renderDashboard('moderator');
    await waitFor(() => expect(screen.getByText('Moderation Queue')).toBeInTheDocument());
    expect(screen.getByText('Official Playlists')).toBeInTheDocument();
    expect(screen.getByText('Full Analytics')).toBeInTheDocument();
  });

  it('navigates to /admin/moderation on click', async () => {
    setupApiMocks();
    renderDashboard('moderator');
    await waitFor(() => screen.getByText('Moderation Queue'));
    await userEvent.click(screen.getByText('Moderation Queue'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/moderation');
  });

  it('shows User Management for admin role', async () => {
    setupApiMocks();
    renderDashboard('admin');
    await waitFor(() => expect(screen.getByText('User Management')).toBeInTheDocument());
  });

  it('hides User Management for moderator role', async () => {
    setupApiMocks();
    renderDashboard('moderator');
    await waitFor(() => screen.getByText('Admin Dashboard'));
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });

  it('shows Manage Roles and Audit Log only for super_admin', async () => {
    setupApiMocks();
    renderDashboard('super_admin');
    await waitFor(() => expect(screen.getByText('Manage Roles')).toBeInTheDocument());
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('hides Manage Roles and Audit Log for admin role', async () => {
    setupApiMocks();
    renderDashboard('admin');
    await waitFor(() => screen.getByText('Admin Dashboard'));
    expect(screen.queryByText('Manage Roles')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
  });
});

// ─── API failure ──────────────────────────────────────────────────────────────

describe('API failure', () => {
  it('exits loading state gracefully when all calls fail', async () => {
    apiCall.mockRejectedValue(new Error('Network error'));
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument());
    // Stat cards render with em dashes for null values
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});