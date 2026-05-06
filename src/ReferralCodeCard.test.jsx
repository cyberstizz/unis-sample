// src/ReferralCodeCard.test.jsx

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import ReferralCodeCard from './ReferralCodeCard';
import { apiCall } from './components/axiosInstance';

vi.mock('./components/axiosInstance', () => ({
  apiCall: vi.fn(),
}));

// Mock every lucide-react icon the component imports. Missing ANY of these
// causes the component to throw on render, which leaves the loading skeleton
// in the DOM and every assertion fails.
vi.mock('lucide-react', () => ({
  Copy: ({ size, ...props }) => <span data-testid="copy-icon" {...props}>CopyIcon</span>,
  Check: ({ size, ...props }) => <span data-testid="check-icon" {...props}>CheckIcon</span>,
  Gift: ({ size, ...props }) => <span data-testid="gift-icon" {...props}>GiftIcon</span>,
  Twitter: ({ size, ...props }) => <span data-testid="twitter-icon" {...props}>TwitterIcon</span>,
  Instagram: ({ size, ...props }) => <span data-testid="instagram-icon" {...props}>InstagramIcon</span>,
  Link2: ({ size, ...props }) => <span data-testid="link2-icon" {...props}>Link2Icon</span>,
  Sparkles: ({ size, ...props }) => <span data-testid="sparkles-icon" {...props}>SparklesIcon</span>,
}));

describe('ReferralCodeCard', () => {
  beforeEach(() => {
    // Note: fake timers are enabled per-test only (see "resets copied state
    // after 2 seconds"). Enabling them globally deadlocks RTL's findByText
    // polling, which uses setInterval under the hood.

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    apiCall.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('renders the header and listener referral copy', async () => {
    apiCall.mockResolvedValue({ data: 'UNIS123' });

    render(<ReferralCodeCard userId="user-1" />);

    // Component shows "Your Code" eyebrow + "Bring friends in." headline
    expect(await screen.findByText('Your Code')).toBeInTheDocument();
    expect(screen.getByText(/Bring friends in/i)).toBeInTheDocument();

    // Listener copy: "Every listener who joins UNIS with your code adds +5 points..."
    expect(
      screen.getByText(/every listener who joins/i)
    ).toBeInTheDocument();

    expect(await screen.findByText('UNIS123')).toBeInTheDocument();
  });

  test('renders artist-specific referral copy when isArtist is true', async () => {
    apiCall.mockResolvedValue({ data: 'ARTIST123' });

    render(<ReferralCodeCard userId="artist-1" isArtist />);

    expect(
      await screen.findByText(/share this code with listeners and other artists/i)
    ).toBeInTheDocument();

    // Artist "How it works" sidebar mentions +2 points per artist signup
    expect(
      screen.getByText(/points per artist signup/i)
    ).toBeInTheDocument();

    expect(await screen.findByText('ARTIST123')).toBeInTheDocument();
  });

  test('shows the loading skeleton while referral code is being fetched', () => {
    apiCall.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ReferralCodeCard userId="user-1" />);

    // Loading state renders a skeleton div, not literal "Loading..." text
    expect(container.querySelector('.referral-card--loading')).toBeInTheDocument();
    expect(container.querySelector('.referral-card__skeleton')).toBeInTheDocument();
  });

  test('calls apiCall with the correct referral-code endpoint', async () => {
    apiCall.mockResolvedValue({ data: 'UNIS123' });

    render(<ReferralCodeCard userId="user-1" />);

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith({
        url: '/v1/users/referral-code/user-1',
        method: 'get',
        useCache: false,
      });
    });
  });

  test('supports backend response as plain string', async () => {
    apiCall.mockResolvedValue({ data: 'PLAINCODE' });

    render(<ReferralCodeCard userId="user-1" />);

    expect(await screen.findByText('PLAINCODE')).toBeInTheDocument();
  });

  test('supports backend response with referralCode property', async () => {
    apiCall.mockResolvedValue({ data: { referralCode: 'OBJECTCODE' } });

    render(<ReferralCodeCard userId="user-1" />);

    expect(await screen.findByText('OBJECTCODE')).toBeInTheDocument();
  });

  test('supports backend response with code property', async () => {
    apiCall.mockResolvedValue({ data: { code: 'CODEPROP' } });

    render(<ReferralCodeCard userId="user-1" />);

    expect(await screen.findByText('CODEPROP')).toBeInTheDocument();
  });

  test('shows dash when no referral code is returned', async () => {
    apiCall.mockResolvedValue({ data: {} });

    render(<ReferralCodeCard userId="user-1" />);

    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
  });

  test('does not call apiCall when userId is missing', () => {
    render(<ReferralCodeCard />);

    expect(apiCall).not.toHaveBeenCalled();
  });

  test('copies referral code to clipboard when Copy button is clicked', async () => {
    apiCall.mockResolvedValue({ data: 'UNIS123' });

    render(<ReferralCodeCard userId="user-1" />);

    await screen.findByText('UNIS123');

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('UNIS123');
    });

    // Component renders "Copied" (no exclamation point) and the check icon
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  test('resets copied state after 2 seconds', async () => {
    apiCall.mockResolvedValue({ data: 'UNIS123' });
    render(<ReferralCodeCard userId="user-1" />);

    // Wait for async render under REAL timers (findByText polls via
    // setInterval, which deadlocks under fake timers).
    await screen.findByText('UNIS123');

    // Switch to fake timers BEFORE clicking. handleCopy schedules a
    // setTimeout(2000) inside its clipboard .then() callback, and that
    // setTimeout has to be intercepted at scheduling time.
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    // The clipboard promise's .then() and setCopied(true) are microtasks,
    // not timers — flush them with an empty act() so React commits "Copied".
    await act(async () => {});
    expect(screen.getByText('Copied')).toBeInTheDocument();

    // Now advance the 2-second cleanup timer; act flushes the resulting
    // setCopied(false) commit before we query the DOM.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();

    vi.useRealTimers();
  });

  test('logs an error and stops loading when referral code fetch fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    apiCall.mockRejectedValue(new Error('Network error'));

    render(<ReferralCodeCard userId="user-1" />);

    expect(await screen.findByText('—')).toBeInTheDocument();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to fetch referral code:',
      expect.any(Error)
    );
  });
});