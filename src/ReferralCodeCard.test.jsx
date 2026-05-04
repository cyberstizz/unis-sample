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

vi.mock('lucide-react', () => ({
  Copy: ({ size, ...props }) => <span data-testid="copy-icon" {...props}>CopyIcon</span>,
  Check: ({ size, ...props }) => <span data-testid="check-icon" {...props}>CheckIcon</span>,
  Gift: ({ size, ...props }) => <span data-testid="gift-icon" {...props}>GiftIcon</span>,
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
    apiCall.mockResolvedValue({
      data: 'UNIS123',
    });

    render(<ReferralCodeCard userId="user-1" />);

    expect(screen.getByText('Your Referral Code')).toBeInTheDocument();
    expect(screen.getByTestId('gift-icon')).toBeInTheDocument();

    expect(
      screen.getByText(
        /share this code with friends\. you earn \+5 points for every listener/i
      )
    ).toBeInTheDocument();

    expect(await screen.findByText('UNIS123')).toBeInTheDocument();
  });

  test('renders artist-specific referral copy when isArtist is true', async () => {
    apiCall.mockResolvedValue({
      data: 'ARTIST123',
    });

    render(<ReferralCodeCard userId="artist-1" isArtist />);

    expect(
      screen.getByText(/share this code with listeners and other artists/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/\+2 points for every artist/i)
    ).toBeInTheDocument();

    expect(await screen.findByText('ARTIST123')).toBeInTheDocument();
  });

  test('shows Loading while referral code is being fetched', () => {
    apiCall.mockReturnValue(new Promise(() => {}));

    render(<ReferralCodeCard userId="user-1" />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
  });

  test('calls apiCall with the correct referral-code endpoint', async () => {
    apiCall.mockResolvedValue({
      data: 'UNIS123',
    });

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
    apiCall.mockResolvedValue({
      data: 'PLAINCODE',
    });

    render(<ReferralCodeCard userId="user-1" />);

    expect(await screen.findByText('PLAINCODE')).toBeInTheDocument();
  });

  test('supports backend response with referralCode property', async () => {
    apiCall.mockResolvedValue({
      data: {
        referralCode: 'OBJECTCODE',
      },
    });

    render(<ReferralCodeCard userId="user-1" />);

    expect(await screen.findByText('OBJECTCODE')).toBeInTheDocument();
  });

  test('supports backend response with code property', async () => {
    apiCall.mockResolvedValue({
      data: {
        code: 'CODEPROP',
      },
    });

    render(<ReferralCodeCard userId="user-1" />);

    expect(await screen.findByText('CODEPROP')).toBeInTheDocument();
  });

  test('shows dash when no referral code is returned', async () => {
    apiCall.mockResolvedValue({
      data: {},
    });

    render(<ReferralCodeCard userId="user-1" />);

    expect(await screen.findByText('—')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy/i })).toBeDisabled();
  });

  test('does not call apiCall when userId is missing', () => {
    render(<ReferralCodeCard />);

    expect(apiCall).not.toHaveBeenCalled();
  });

  test('copies referral code to clipboard when Copy button is clicked', async () => {
    apiCall.mockResolvedValue({
      data: 'UNIS123',
    });

    render(<ReferralCodeCard userId="user-1" />);

    await screen.findByText('UNIS123');

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('UNIS123');
    });

    expect(await screen.findByText('Copied!')).toBeInTheDocument();
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
    // setTimeout has to be intercepted at scheduling time. If we enable
    // fake timers afterward, the real-timer at 2000ms is already pending
    // and fake-time advancement does nothing.
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    // The clipboard promise's .then() and setCopied(true) are microtasks,
    // not timers — flush them with an empty act() so React commits "Copied!".
    await act(async () => {});
    expect(screen.getByText('Copied!')).toBeInTheDocument();

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