// src/pages/__tests__/CronStatusPanel.test.jsx

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CronStatusPanel from './CronStatusPanel';
import { apiCall } from '../components/axiosInstance';

vi.mock('../components/axiosInstance', () => ({ apiCall: vi.fn() }));

// ─── fixtures ────────────────────────────────────────────────────────────────

const makeExec = (overrides = {}) => ({
  executionId: 1,
  jobName: 'DAILY_AWARDS',
  status: 'SUCCESS',
  awardsCreated: 12,
  durationMs: 850,
  startedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
  errorMessage: null,
  ...overrides,
});

const makeCronData = (overrides = {}) => ({
  latestExecutions: [makeExec()],
  recentFailures: 0,
  allHealthy: true,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

// ─── tests ───────────────────────────────────────────────────────────────────

describe('CronStatusPanel', () => {

  // ── loading state ──────────────────────────────────────────────────────────

  it('shows loading indicator while fetching', () => {
    apiCall.mockResolvedValue({ data: makeCronData() });
    render(<CronStatusPanel />);
    expect(screen.getByText('Loading cron status...')).toBeInTheDocument();
  });

  // ── error state ────────────────────────────────────────────────────────────

  it('shows failure message when API call rejects', async () => {
    apiCall.mockRejectedValue(new Error('Network error'));
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('Failed to load cron data')).toBeInTheDocument()
    );
  });

  // ── healthy header ─────────────────────────────────────────────────────────

  it('renders the Scheduled Jobs heading', async () => {
    apiCall.mockResolvedValue({ data: makeCronData() });
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('Scheduled Jobs')).toBeInTheDocument()
    );
  });

  it('does not show failure badge when recentFailures is 0', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({ recentFailures: 0 }) });
    render(<CronStatusPanel />);
    await waitFor(() => screen.getByText('Scheduled Jobs'));
    expect(screen.queryByText(/failure/)).not.toBeInTheDocument();
  });

  it('shows singular failure badge when recentFailures is 1', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({ recentFailures: 1 }) });
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('1 failure this week')).toBeInTheDocument()
    );
  });

  it('shows plural failures badge when recentFailures is greater than 1', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({ recentFailures: 3 }) });
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('3 failures this week')).toBeInTheDocument()
    );
  });

  // ── empty executions ───────────────────────────────────────────────────────

  it('shows empty state when latestExecutions is an empty array', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({ latestExecutions: [] }) });
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText(/No cron executions recorded yet/)).toBeInTheDocument()
    );
  });

  // ── job rows ───────────────────────────────────────────────────────────────

  it('renders the human-readable job label', async () => {
    apiCall.mockResolvedValue({ data: makeCronData() });
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('Daily Awards')).toBeInTheDocument()
    );
  });

  it('renders the expected schedule for a job', async () => {
    apiCall.mockResolvedValue({ data: makeCronData() });
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('Every night at 12:01 AM')).toBeInTheDocument()
    );
  });

  it('renders awards created count for a SUCCESS job', async () => {
    apiCall.mockResolvedValue({ data: makeCronData() });
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('12')).toBeInTheDocument()
    );
  });

  it('does not render awards count for a FAILED job', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({
      latestExecutions: [makeExec({ status: 'FAILED', awardsCreated: 0 })],
    })});
    render(<CronStatusPanel />);
    await waitFor(() => screen.getByText('Daily Awards'));
    expect(screen.queryByText('awards')).not.toBeInTheDocument();
  });

  it('renders error message block for a FAILED job with errorMessage', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({
      latestExecutions: [makeExec({ status: 'FAILED', errorMessage: 'NullPointerException at line 42' })],
    })});
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('NullPointerException at line 42')).toBeInTheDocument()
    );
  });

  it('does not render error block for a FAILED job with no errorMessage', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({
      latestExecutions: [makeExec({ status: 'FAILED', errorMessage: null })],
    })});
    render(<CronStatusPanel />);
    await waitFor(() => screen.getByText('Daily Awards'));
    expect(screen.queryByText('NullPointerException')).not.toBeInTheDocument();
  });

  it('renders multiple job rows', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({
      latestExecutions: [
        makeExec({ executionId: 1, jobName: 'DAILY_AWARDS' }),
        makeExec({ executionId: 2, jobName: 'WEEKLY_AWARDS' }),
        makeExec({ executionId: 3, jobName: 'ANNUAL_AWARDS' }),
      ],
    })});
    render(<CronStatusPanel />);
    await waitFor(() => {
      expect(screen.getByText('Daily Awards')).toBeInTheDocument();
      expect(screen.getByText('Weekly Awards')).toBeInTheDocument();
      expect(screen.getByText('Annual Awards')).toBeInTheDocument();
    });
  });

  // ── formatDuration ─────────────────────────────────────────────────────────

  it('renders duration in ms when under 1 second', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({
      latestExecutions: [makeExec({ durationMs: 450 })],
    })});
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('450ms')).toBeInTheDocument()
    );
  });

  it('renders duration in seconds when 1000ms or more', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({
      latestExecutions: [makeExec({ durationMs: 2300 })],
    })});
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('2.3s')).toBeInTheDocument()
    );
  });

  it('renders em dash when durationMs is null', async () => {
    apiCall.mockResolvedValue({ data: makeCronData({
      latestExecutions: [makeExec({ durationMs: null })],
    })});
    render(<CronStatusPanel />);
    await waitFor(() =>
      expect(screen.getByText('—')).toBeInTheDocument()
    );
  });

  // ── expand / collapse history ──────────────────────────────────────────────

  it('fetches job history and renders RECENT EXECUTIONS when a job row is clicked', async () => {
    const user = userEvent.setup();
    apiCall
      .mockResolvedValueOnce({ data: makeCronData() })
      .mockResolvedValueOnce({ data: [
        { executionId: 10, status: 'SUCCESS', startedAt: new Date().toISOString(), awardsCreated: 5, durationMs: 400 },
      ]});

    render(<CronStatusPanel />);
    await waitFor(() => screen.getByText('Daily Awards'));

    await user.click(screen.getByText('Daily Awards'));

    await waitFor(() =>
      expect(screen.getByText('RECENT EXECUTIONS')).toBeInTheDocument()
    );
    expect(apiCall).toHaveBeenCalledWith({
      url: '/v1/admin/cron/history/DAILY_AWARDS',
      method: 'get',
    });
  });

  it('collapses history when the same job row is clicked again', async () => {
    const user = userEvent.setup();
    apiCall
      .mockResolvedValueOnce({ data: makeCronData() })
      .mockResolvedValueOnce({ data: [
        { executionId: 10, status: 'SUCCESS', startedAt: new Date().toISOString(), awardsCreated: 5, durationMs: 400 },
      ]});

    render(<CronStatusPanel />);
    await waitFor(() => screen.getByText('Daily Awards'));

    await user.click(screen.getByText('Daily Awards'));
    await waitFor(() => screen.getByText('RECENT EXECUTIONS'));

    await user.click(screen.getByText('Daily Awards'));
    await waitFor(() =>
      expect(screen.queryByText('RECENT EXECUTIONS')).not.toBeInTheDocument()
    );
  });

  // ── refresh button ─────────────────────────────────────────────────────────

  it('re-fetches cron status when Refresh is clicked', async () => {
    const user = userEvent.setup();
    apiCall.mockResolvedValue({ data: makeCronData() });
    render(<CronStatusPanel />);
    await waitFor(() => screen.getByText('Refresh'));

    await user.click(screen.getByText('Refresh'));

    await waitFor(() =>
      expect(apiCall).toHaveBeenCalledTimes(2)
    );
    expect(apiCall).toHaveBeenLastCalledWith({
      url: '/v1/admin/cron/status',
      method: 'get',
    });
  });
});