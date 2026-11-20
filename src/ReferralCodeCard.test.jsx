// src/ReferralCodeCard.test.jsx
//
// Tests for ReferralCodeCard. The card no longer fetches anything: Profile
// passes `referralCode`, `username` and `isArtist` as props, so the card shows
// exactly what the rest of the page has.
//
// Covers:
//   • listener copy (Community Share percentages + the phone-number note)
//   • artist copy (+5 per listener, +2 per artist) and no listener note
//   • the code, its accessible label, and the "no code" state
//   • Copy: writes the code, shows "Copied", resets after 2 seconds
//   • Copy failing: shows the code in a message so it can be copied by hand
//   • the card makes no request of its own

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import * as axiosModule from './components/axiosInstance';

vi.mock('./ReferralCodeCard.scss', () => ({}));

const { feedback } = vi.hoisted(() => ({
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));

import ReferralCodeCard from './ReferralCodeCard';

let writeText;

const copyButton = () => screen.getByRole('button', { name: /cop(y|ied)/i });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  vi.clearAllMocks();
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ReferralCodeCard — copy for listeners and artists', () => {
  it('shows the heading for everyone', () => {
    render(<ReferralCodeCard referralCode="UNIS123" />);
    expect(screen.getByText('Your Code')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Bring friends in. Earn points.');
    expect(screen.getByText('How it works')).toBeInTheDocument();
  });

  it('tells listeners how the monthly share pays: 10%, 5%, 2%', () => {
    render(<ReferralCodeCard referralCode="UNIS123" />);
    const desc = document.querySelector('.referral-card__desc');
    expect(desc).toHaveTextContent(/unis shares what it earns with the community, based on listening/i);
    expect(desc).toHaveTextContent('10% of their monthly share');
    expect(desc).toHaveTextContent('5% from the people they invite');
    expect(desc).toHaveTextContent('2% from the level after that');
  });

  it('tells listeners the people they invite need a verified phone number', () => {
    render(<ReferralCodeCard referralCode="UNIS123" />);
    expect(document.querySelector('.referral-card__note'))
      .toHaveTextContent(/need a verified phone number for their listening to count/i);
  });

  it('lists the listener "how it works" points', () => {
    render(<ReferralCodeCard referralCode="UNIS123" />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      '+5 points per friend who joins',
      "Boost your jurisdiction's ranking",
      'No expiration — share anytime',
    ]);
  });

  it('gives artists their own copy: +5 per listener, +2 per artist', () => {
    render(<ReferralCodeCard referralCode="ARTIST123" isArtist />);
    const desc = document.querySelector('.referral-card__desc');
    expect(desc).toHaveTextContent(/share this code with listeners and other artists/i);
    expect(desc).toHaveTextContent('+5 points for every listener');
    expect(desc).toHaveTextContent('+2 for every artist');
  });

  it('leaves the phone-number note off the artist card', () => {
    render(<ReferralCodeCard referralCode="ARTIST123" isArtist />);
    expect(document.querySelector('.referral-card__note')).toBeNull();
  });

  it('lists the artist "how it works" points', () => {
    render(<ReferralCodeCard referralCode="ARTIST123" isArtist />);
    const items = within(screen.getByRole('list')).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([
      '+5 points per listener signup',
      '+2 points per artist signup',
      'Boosts your reach across jurisdictions',
      'No expiration — share anytime',
    ]);
  });
});

describe('ReferralCodeCard — the code', () => {
  it('shows the code it was given', () => {
    render(<ReferralCodeCard referralCode="UNIS123" username="charles" />);
    expect(screen.getByLabelText('Your referral code: UNIS123')).toHaveTextContent('UNIS123');
    expect(copyButton()).toBeEnabled();
  });

  it('shows a dash and disables Copy when there is no code', () => {
    render(<ReferralCodeCard />);
    expect(screen.getByLabelText('Your referral code: not assigned')).toHaveTextContent('—');
    expect(copyButton()).toBeDisabled();
  });

  it('makes no request of its own — Profile supplies the code', () => {
    const apiSpy = vi.spyOn(axiosModule, 'apiCall');
    render(<ReferralCodeCard referralCode="UNIS123" />);
    expect(apiSpy).not.toHaveBeenCalled();
  });
});

describe('ReferralCodeCard — copying', () => {
  it('copies the code and says "Copied"', async () => {
    render(<ReferralCodeCard referralCode="UNIS123" />);
    fireEvent.click(copyButton());
    await flush();

    expect(writeText).toHaveBeenCalledWith('UNIS123');
    const button = screen.getByRole('button', { name: 'Copied' });
    expect(button).toHaveTextContent('Copied');
    expect(button).toHaveClass('is-copied');
  });

  it('goes back to "Copy" after 2 seconds', async () => {
    vi.useFakeTimers();
    render(<ReferralCodeCard referralCode="UNIS123" />);
    fireEvent.click(copyButton());
    await flush();
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1999); });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole('button', { name: 'Copy referral code to clipboard' })).toHaveTextContent('Copy');
  });

  it('when the clipboard refuses, shows the code so it can be copied by hand', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    writeText.mockRejectedValue(new Error('denied'));
    render(<ReferralCodeCard referralCode="UNIS123" />);
    fireEvent.click(copyButton());
    await flush();

    expect(feedback.info).toHaveBeenCalledWith('Copy your code: UNIS123');
    expect(screen.queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });
});
