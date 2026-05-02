// src/pages/__tests__/DmcaClaimDetail.test.jsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DmcaClaimDetail from './DmcaClaimDetail';
import { apiCall } from '../components/axiosInstance';
import { useAuth } from '../context/AuthContext';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock router hooks
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useParams: vi.fn(),
    useNavigate: vi.fn(),
  };
});

const { useParams, useNavigate } = await import('react-router-dom');

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeClaim = (overrides = {}) => ({
  claimId: 'claim-12345-abcde',
  claimantName: 'John Doe',
  claimantEmail: 'john@example.com',
  claimantPhone: '555-0123',
  claimantCompany: 'Music Inc.',
  copyrightOwner: 'Artist Rights Org',
  workDescription: 'Hit song XYZ',
  originalWorkUrl: 'https://original.com/song',
  infringingUrl: 'https://unis.com/infringing',
  status: 'submitted',
  createdAt: '2026-04-15T10:00:00Z',
  resolvedAt: null,
  resolutionNotes: null,
  ...overrides,
});

const makeCounterNotice = (overrides = {}) => ({
  respondentName: 'Jane Smith',
  statement: 'This is fair use and my content should be restored.',
  filedAt: '2026-04-20T14:30:00Z',
  restoreEligibleAt: '2026-04-27T14:30:00Z',
  ...overrides,
});

const makeAction = (overrides = {}) => ({
  actionId: 'act-1',
  actionType: 'STATUS_UPDATED',
  performedBy: { username: 'admin1' },
  createdAt: '2026-04-18T09:15:00Z',
  reason: 'Initial review started',
  ...overrides,
});

const makeFullData = (overrides = {}) => ({
  claim: makeClaim(),
  counterNotice: null,
  actionHistory: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: { username: 'admin1' } });
  useParams.mockReturnValue({ claimId: 'claim-12345-abcde' });
  useNavigate.mockReturnValue(vi.fn());
});

// Helper to render with router
const renderWithRouter = () => {
  return render(
    <MemoryRouter initialEntries={['/admin/dmca/claims/claim-12345-abcde']}>
      <Routes>
        <Route path="/admin/dmca/claims/:claimId" element={<DmcaClaimDetail />} />
      </Routes>
    </MemoryRouter>
  );
};

// ─── tests ───────────────────────────────────────────────────────────────────

describe('DmcaClaimDetail', () => {

  // ── loading & error states ─────────────────────────────────────────────────

  it('shows loading indicator while fetching', () => {
    apiCall.mockResolvedValue({ data: makeFullData() });
    renderWithRouter();
    expect(screen.getByText('Loading claim...')).toBeInTheDocument();
  });

  it('shows "Claim not found" when data is missing', async () => {
    apiCall.mockResolvedValue({ data: { claim: null } });
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByText('Claim not found.')).toBeInTheDocument()
    );
  });

  // ── successful data render ─────────────────────────────────────────────────

  it('renders all claimant and claim detail fields correctly', async () => {
    apiCall.mockResolvedValue({ data: makeFullData() });
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('DMCA Claim Detail')).toBeInTheDocument();
      expect(screen.getByText('Reference: DMCA-CLAIM-12')).toBeInTheDocument(); // partial ID
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Hit song XYZ')).toBeInTheDocument();
    expect(screen.getByText('https://unis.com/infringing')).toBeInTheDocument();
    expect(screen.getByText('submitted')).toBeInTheDocument();
  });

  // ── counter-notice section ─────────────────────────────────────────────────

  it('renders counter-notice section when present', async () => {
    apiCall.mockResolvedValue({
      data: makeFullData({
        counterNotice: makeCounterNotice(),
      })
    });
    renderWithRouter();

    await waitFor(() =>
      expect(screen.getByText('Counter-Notice Filed')).toBeInTheDocument()
    );

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('This is fair use and my content should be restored.')).toBeInTheDocument();
  });

  // ── action buttons & status updates ────────────────────────────────────────

  it('shows Start Review button for submitted claims and calls correct API', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    useNavigate.mockReturnValue(mockNavigate);

    apiCall
      .mockResolvedValueOnce({ data: makeFullData({ claim: makeClaim({ status: 'submitted' }) }) })
      .mockResolvedValueOnce({}); // patch response

    renderWithRouter();

    await waitFor(() =>
      expect(screen.getByText('Start Review')).toBeInTheDocument()
    );

    await user.click(screen.getByText('Start Review'));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        url: '/v1/admin/dmca/claims/claim-12345-abcde/status',
        method: 'patch',
        data: { status: 'reviewing', notes: '' },
      });
    });
  });

  it('shows Uphold and Reject buttons for reviewing claims', async () => {
    apiCall.mockResolvedValue({
      data: makeFullData({ claim: makeClaim({ status: 'reviewing' }) })
    });
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText('Uphold (Remove Content)')).toBeInTheDocument();
      expect(screen.getByText('Reject Claim')).toBeInTheDocument();
    });
  });

  it('calls takedown endpoint when Uphold is clicked', async () => {
    const user = userEvent.setup();
    apiCall
      .mockResolvedValueOnce({ data: makeFullData({ claim: makeClaim({ status: 'reviewing' }) }) })
      .mockResolvedValueOnce({}) // status patch
      .mockResolvedValueOnce({}) // takedown
      .mockResolvedValueOnce({ data: makeFullData({ claim: makeClaim({ status: 'upheld' }) }) }); // refetch

    renderWithRouter();

    await waitFor(() => screen.getByText('Uphold (Remove Content)'));

    await user.click(screen.getByText('Uphold (Remove Content)'));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        url: '/v1/admin/dmca/claims/claim-12345-abcde/takedown',
        method: 'post',
      });
    });
  });

  // ── action history ─────────────────────────────────────────────────────────

  it('renders action history when actions exist', async () => {
    apiCall.mockResolvedValue({
      data: makeFullData({
        actionHistory: [makeAction(), makeAction({ actionType: 'CLAIM_REJECTED', reason: 'False claim' })],
      })
    });
    renderWithRouter();

    await waitFor(() =>
      expect(screen.getByText('Action History')).toBeInTheDocument()
    );

    expect(screen.getByText('STATUS_UPDATED')).toBeInTheDocument();
    expect(screen.getByText('CLAIM_REJECTED')).toBeInTheDocument();
    expect(screen.getByText('False claim')).toBeInTheDocument();
  });

  // ── navigation ─────────────────────────────────────────────────────────────

  it('has a working back button', async () => {
    const user = userEvent.setup();
    const mockNavigate = vi.fn();
    useNavigate.mockReturnValue(mockNavigate);

    apiCall.mockResolvedValue({ data: makeFullData() });
    renderWithRouter();

    await waitFor(() => screen.getByText('Back to Moderation Queue'));

    await user.click(screen.getByText('Back to Moderation Queue'));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/moderation');
  });
});