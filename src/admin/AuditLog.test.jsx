// src/pages/__tests__/AuditLog.test.jsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AuditLog from './AuditLog';
import { apiCall } from '../components/axiosInstance';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));
vi.mock('../layout', () => ({ default: ({ children }) => <div data-testid="layout">{children}</div> }));

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeAction = (id, overrides = {}) => ({
  actionId: id,
  actionType: 'BAN_USER',
  targetType: 'User',
  performedBy: { username: 'admin1' },
  createdAt: '2025-04-01T12:00:00Z',
  reason: null,
  ...overrides,
});

const makePage = (actions, totalPages = 1) => ({
  data: { content: actions, totalPages },
});

beforeEach(() => vi.clearAllMocks());

// ─── tests ───────────────────────────────────────────────────────────────────

describe('AuditLog', () => {

  // ── loading state ──────────────────────────────────────────────────────────

  it('shows loading indicator while fetching', () => {
    apiCall.mockResolvedValue(makePage([]));
    render(<AuditLog />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // ── empty state ────────────────────────────────────────────────────────────

  it('shows empty state message when no actions are returned', async () => {
    apiCall.mockResolvedValue(makePage([]));
    render(<AuditLog />);
    await waitFor(() =>
      expect(screen.getByText('No actions recorded yet.')).toBeInTheDocument()
    );
  });

  // ── action rows ────────────────────────────────────────────────────────────

  it('renders the page heading', async () => {
    apiCall.mockResolvedValue(makePage([]));
    render(<AuditLog />);
    await waitFor(() =>
      expect(screen.getByText('Audit Log')).toBeInTheDocument()
    );
  });

  it('renders action type, target type, and performer username', async () => {
    apiCall.mockResolvedValue(makePage([
      makeAction(1, { actionType: 'BAN_USER', targetType: 'User', performedBy: { username: 'adminX' } }),
    ]));
    render(<AuditLog />);
    await waitFor(() => {
      expect(screen.getByText('BAN_USER')).toBeInTheDocument();
      expect(screen.getByText(/on User · by adminX/)).toBeInTheDocument();
    });
  });

  it('falls back to "Unknown" when performedBy is null', async () => {
    apiCall.mockResolvedValue(makePage([
      makeAction(1, { performedBy: null }),
    ]));
    render(<AuditLog />);
    await waitFor(() =>
      expect(screen.getByText(/by Unknown/)).toBeInTheDocument()
    );
  });

  it('renders the reason when present', async () => {
    apiCall.mockResolvedValue(makePage([
      makeAction(1, { reason: 'Violated community guidelines' }),
    ]));
    render(<AuditLog />);
    await waitFor(() =>
      expect(screen.getByText('Violated community guidelines')).toBeInTheDocument()
    );
  });

  it('does not render a reason row when reason is null', async () => {
    apiCall.mockResolvedValue(makePage([
      makeAction(1, { reason: null }),
    ]));
    render(<AuditLog />);
    await waitFor(() => screen.getByText('BAN_USER'));
    expect(screen.queryByTestId('reason')).not.toBeInTheDocument();
  });

  it('renders multiple action rows', async () => {
    apiCall.mockResolvedValue(makePage([
      makeAction(1, { actionType: 'BAN_USER' }),
      makeAction(2, { actionType: 'DELETE_SONG' }),
      makeAction(3, { actionType: 'RESOLVE_DMCA' }),
    ]));
    render(<AuditLog />);
    await waitFor(() => {
      expect(screen.getByText('BAN_USER')).toBeInTheDocument();
      expect(screen.getByText('DELETE_SONG')).toBeInTheDocument();
      expect(screen.getByText('RESOLVE_DMCA')).toBeInTheDocument();
    });
  });

  // ── API call ───────────────────────────────────────────────────────────────

  it('calls the API with page=0 and size=20 on initial mount', async () => {
    apiCall.mockResolvedValue(makePage([]));
    render(<AuditLog />);
    await waitFor(() => expect(apiCall).toHaveBeenCalledWith({
      url: '/v1/admin/audit?page=0&size=20',
      method: 'get',
    }));
  });

  // ── pagination — hidden when single page ───────────────────────────────────

  it('hides pagination controls when totalPages is 1', async () => {
    apiCall.mockResolvedValue(makePage([makeAction(1)], 1));
    render(<AuditLog />);
    await waitFor(() => screen.getByText('BAN_USER'));
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('hides pagination controls when totalPages is 0', async () => {
    apiCall.mockResolvedValue(makePage([], 0));
    render(<AuditLog />);
    await waitFor(() => screen.getByText('No actions recorded yet.'));
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
  });

  // ── pagination — visible when multiple pages ───────────────────────────────

  it('shows pagination controls when totalPages > 1', async () => {
    apiCall.mockResolvedValue(makePage([makeAction(1)], 3));
    render(<AuditLog />);
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });
  });

  it('disables Previous button on the first page', async () => {
    apiCall.mockResolvedValue(makePage([makeAction(1)], 3));
    render(<AuditLog />);
    await waitFor(() =>
      expect(screen.getByText('Previous')).toBeDisabled()
    );
  });

  it('enables Next button when not on the last page', async () => {
    apiCall.mockResolvedValue(makePage([makeAction(1)], 3));
    render(<AuditLog />);
    await waitFor(() =>
      expect(screen.getByText('Next')).not.toBeDisabled()
    );
  });

  it('advances to page 2 and fetches with page=1 when Next is clicked', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue(makePage([makeAction(1)], 3));
    render(<AuditLog />);
    await waitFor(() => screen.getByText('Next'));

    await user.click(screen.getByText('Next'));

    await waitFor(() =>
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
    );
    expect(apiCall).toHaveBeenLastCalledWith({
      url: '/v1/admin/audit?page=1&size=20',
      method: 'get',
    });
  });

  it('disables Next button on the last page', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue(makePage([makeAction(1)], 2));
    render(<AuditLog />);
    await waitFor(() => screen.getByText('Next'));

    await user.click(screen.getByText('Next'));

    await waitFor(() =>
      expect(screen.getByText('Next')).toBeDisabled()
    );
  });

  it('goes back to page 1 when Previous is clicked from page 2', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue(makePage([makeAction(1)], 3));
    render(<AuditLog />);
    await waitFor(() => screen.getByText('Next'));

    await user.click(screen.getByText('Next'));
    await waitFor(() => screen.getByText('Page 2 of 3'));

    await user.click(screen.getByText('Previous'));
    await waitFor(() =>
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    );
  });

  // ── error resilience ───────────────────────────────────────────────────────

  it('exits loading state without crashing when the API call fails', async () => {
    apiCall.mockRejectedValue(new Error('Network error'));
    render(<AuditLog />);
    await waitFor(() =>
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Audit Log')).toBeInTheDocument();
  });

  it('shows empty state after an API failure since actions defaults to []', async () => {
    apiCall.mockRejectedValue(new Error('Network error'));
    render(<AuditLog />);
    await waitFor(() =>
      expect(screen.getByText('No actions recorded yet.')).toBeInTheDocument()
    );
  });
});