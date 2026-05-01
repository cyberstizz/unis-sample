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
    vi.useFakeTimers();

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
    apiCall.mockResolvedValue({
      data: 'UNIS123',
    });

    render(<ReferralCodeCard userId="user-1" />);

    await screen.findByText('UNIS123');

    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    expect(await screen.findByText('Copied!')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
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