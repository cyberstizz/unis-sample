// src/pages/__tests__/AnalyticsPage.test.jsx

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AnalyticsPage from './AnalyticsPage';
import { apiCall } from '../components/axiosInstance';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));
vi.mock('../layout', () => ({ default: ({ children }) => <div data-testid="layout">{children}</div> }));

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ─── fixtures ────────────────────────────────────────────────────────────────

const DAU_DATA    = { '2025-04-01': 120, '2025-04-02': 135 };
const SIGNUP_DATA = { '2025-04-01': 10,  '2025-04-02': 18  };
const PLAY_DATA   = { '2025-04-01': 300, '2025-04-02': 420 };
const VOTE_DATA   = { Harlem: 50, Brooklyn: 30 };

const REFERRAL_STATS = {
  totalReferrals: 42,
  maxChainDepth: 3,
  topReferrers: [
    { username: 'UserA', referral_count: 15 },
    { username: 'UserB', referral_count: 9  },
  ],
};

const DMCA_STATS = {
  averageResolutionDays: 4.7,
  claimsByStatus: { PENDING: 3, RESOLVED: 12 },
};

const WAITLIST_OVERVIEW = {
  totalPreRegistrations: 500,
  totalPending: 420,
  totalConverted: 80,
  totalArtists: 60,
  totalListeners: 440,
  signupsToday: 7,
  topRegions: [
    { metroRegion: 'Chicago',  stateCode: 'IL', count: 80,  threshold: 100, progressPercent: 80  },
    { metroRegion: 'Atlanta',  stateCode: 'GA', count: 100, threshold: 100, progressPercent: 100 },
    { metroRegion: 'Portland', stateCode: 'OR', count: 40,  threshold: 100, progressPercent: 40  },
  ],
  topReferrers: [
    { username: 'WaitUser1', metroRegion: 'Chicago', stateCode: 'IL', referralCount: 20 },
    { username: 'WaitUser2', metroRegion: 'Atlanta', stateCode: 'GA', referralCount: 12 },
  ],
  signupsByState: { IL: 120, GA: 95, OR: 40 },
};

const WAITLIST_DAILY = { '2025-04-01': 8, '2025-04-02': 14 };

const mockApiSuccess = () => {
  apiCall
    .mockResolvedValueOnce({ data: DAU_DATA })
    .mockResolvedValueOnce({ data: SIGNUP_DATA })
    .mockResolvedValueOnce({ data: PLAY_DATA })
    .mockResolvedValueOnce({ data: VOTE_DATA })
    .mockResolvedValueOnce({ data: REFERRAL_STATS })
    .mockResolvedValueOnce({ data: DMCA_STATS })
    .mockResolvedValueOnce({ data: WAITLIST_OVERVIEW })
    .mockResolvedValueOnce({ data: WAITLIST_DAILY });
};

beforeEach(() => vi.clearAllMocks());

// ─── tests ───────────────────────────────────────────────────────────────────

describe('AnalyticsPage', () => {

  // ── loading state ──────────────────────────────────────────────────────────

  it('shows a loading indicator before data arrives', () => {
    apiCall.mockResolvedValue({ data: {} });
    render(<AnalyticsPage />);
    expect(screen.getByText(/loading analytics/i)).toBeInTheDocument();
  });

  // ── API calls ──────────────────────────────────────────────────────────────

  it('fires all 8 API calls on mount', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(8));

    const urls = apiCall.mock.calls.map(([{ url }]) => url);
    expect(urls).toEqual(expect.arrayContaining([
      '/v1/admin/analytics/dau',
      '/v1/admin/analytics/signups',
      '/v1/admin/analytics/plays',
      '/v1/admin/analytics/votes',
      '/v1/admin/analytics/referrals',
      '/v1/admin/analytics/dmca',
      '/v1/admin/analytics/waitlist',
      '/v1/admin/analytics/waitlist/daily?days=30',
    ]));
  });

  // ── waitlist — stat cards ──────────────────────────────────────────────────

  it('renders the National Waitlist heading', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => expect(screen.getByText('National Waitlist')).toBeInTheDocument());
  });

  it('renders all six waitlist stat card labels', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Total Pre-Registrations')).toBeInTheDocument();
      expect(screen.getByText('Pending Activation')).toBeInTheDocument();
      expect(screen.getByText('Converted')).toBeInTheDocument();
      expect(screen.getByText('Artists')).toBeInTheDocument();
      expect(screen.getByText('Listeners')).toBeInTheDocument();
      expect(screen.getByText('Today')).toBeInTheDocument();
    });
  });

  it('renders correct waitlist stat values', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('500')).toBeInTheDocument();
      expect(screen.getByText('420')).toBeInTheDocument();
      expect(screen.getByText('80')).toBeInTheDocument();
      expect(screen.getByText('60')).toBeInTheDocument();
      expect(screen.getByText('440')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });

  // ── waitlist — top regions ─────────────────────────────────────────────────

  it('renders the Top Regions section heading', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() =>
      expect(screen.getByText('Top Regions — Activation Progress')).toBeInTheDocument()
    );
  });

  it('renders each region name, state, and count/threshold', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Chicago, IL')).toBeInTheDocument();
      expect(screen.getByText('Atlanta, GA')).toBeInTheDocument();
      expect(screen.getByText('Portland, OR')).toBeInTheDocument();
      expect(screen.getByText('80 / 100')).toBeInTheDocument();
    });
  });

  it('shows READY TO ACTIVATE only for regions at 100%', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => {
      const badges = screen.getAllByText('READY TO ACTIVATE');
      expect(badges).toHaveLength(1); // only Atlanta
    });
  });

  it('shows correct progress percentages for all three regions', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument();
    });
  });

  // ── waitlist — referral leaders ────────────────────────────────────────────

  it('renders the Waitlist Referral Leaders heading', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() =>
      expect(screen.getByText('Waitlist Referral Leaders')).toBeInTheDocument()
    );
  });

  it('renders each waitlist referrer username and count', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('WaitUser1')).toBeInTheDocument();
      expect(screen.getByText('20 referrals')).toBeInTheDocument();
      expect(screen.getByText('WaitUser2')).toBeInTheDocument();
      expect(screen.getByText('12 referrals')).toBeInTheDocument();
    });
  });

  // ── waitlist — signups by state ────────────────────────────────────────────

  it('renders the Signups by State section with correct state count in header', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() =>
      expect(screen.getByText(/3 states/i)).toBeInTheDocument()
    );
    expect(screen.getByText('IL')).toBeInTheDocument();
    expect(screen.getByText('GA')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
  });

  // ── core analytics chart headings ──────────────────────────────────────────

  it('renders all four chart section headings', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Daily Active Users')).toBeInTheDocument();
      expect(screen.getByText('New Signups')).toBeInTheDocument();
      expect(screen.getByText('Play Counts')).toBeInTheDocument();
      expect(screen.getByText('Votes by Jurisdiction')).toBeInTheDocument();
    });
  });

  // ── referral stats card ────────────────────────────────────────────────────

  it('renders Referral Stats with total referrals, chain depth, and top referrers', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('Referral Stats')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText(/UserA/)).toBeInTheDocument();
      expect(screen.getByText(/15 referrals/)).toBeInTheDocument();
      expect(screen.getByText(/UserB/)).toBeInTheDocument();
      expect(screen.getByText(/9 referrals/)).toBeInTheDocument();
    });
  });

  // ── DMCA stats card ────────────────────────────────────────────────────────

  it('renders DMCA Stats with resolution time and claim statuses', async () => {
    mockApiSuccess();
    render(<AnalyticsPage />);
    await waitFor(() => {
      expect(screen.getByText('DMCA Stats')).toBeInTheDocument();
      expect(screen.getByText('4.7 days')).toBeInTheDocument();
      expect(screen.getByText(/PENDING/)).toBeInTheDocument();
      expect(screen.getByText(/RESOLVED/)).toBeInTheDocument();
    });
  });

  // ── empty / null-safe edge cases ───────────────────────────────────────────

  it('defaults all waitlist stat values to 0 when API returns empty objects', async () => {
    apiCall.mockResolvedValue({ data: {} });
    render(<AnalyticsPage />);
    await waitFor(() => {
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(6);
    });
  });

  it('omits Top Regions section when topRegions is absent from response', async () => {
    apiCall
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { totalPreRegistrations: 10 } })
      .mockResolvedValueOnce({ data: {} });

    render(<AnalyticsPage />);
    await waitFor(() => screen.getByText('National Waitlist'));
    expect(screen.queryByText('Top Regions — Activation Progress')).not.toBeInTheDocument();
  });

  // ── error resilience ───────────────────────────────────────────────────────

  it('exits loading state and still renders the page heading when Promise.all rejects', async () => {
    apiCall.mockRejectedValue(new Error('Network error'));
    render(<AnalyticsPage />);
    await waitFor(() =>
      expect(screen.queryByText(/loading analytics/i)).not.toBeInTheDocument()
    );
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });
});