// src/verificationGate.test.jsx
//
// VerificationGate locks a feature behind a verified phone number — voting,
// commenting, the referral card. It is one of the things that keeps bots from
// earning or voting.
//
// Rules:
//   • a verified user sees the feature as normal
//   • an unverified signed-in user sees it locked, with a "Verify phone" button
//   • a guest sees it as-is (the sign-in prompt handles guests)
//   • after verifying, the user is re-read so the lock opens by itself

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./verificationGate.scss', () => ({}));

const authState = vi.hoisted(() => ({ user: null, refreshUser: vi.fn() }));
vi.mock('./context/AuthContext', () => ({ useAuth: () => authState }));

// The modal has its own suite; this stub exposes the three things the gate uses.
vi.mock('./phoneVerificationModal', () => ({
  default: ({ show, onClose, onVerified }) => (show ? (
    <div data-testid="phone-modal">
      <button onClick={onVerified}>modal-verified</button>
      <button onClick={onClose}>modal-close</button>
    </div>
  ) : null),
}));

import VerificationGate from './verificationGate';

const Feature = () => <button>Cast vote</button>;

beforeEach(() => {
  authState.user = null;
  authState.refreshUser = vi.fn().mockResolvedValue(undefined);
});

describe('VerificationGate — who gets through', () => {
  it('a verified user sees the feature with no lock', () => {
    authState.user = { userId: 'u1', phoneVerified: true };
    render(<VerificationGate><Feature /></VerificationGate>);
    expect(screen.getByRole('button', { name: 'Cast vote' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify phone' })).not.toBeInTheDocument();
    expect(document.querySelector('.vgate')).toBeNull();
  });

  it('a guest sees the feature as-is — signing in is handled elsewhere', () => {
    render(<VerificationGate><Feature /></VerificationGate>);
    expect(screen.getByRole('button', { name: 'Cast vote' })).toBeInTheDocument();
    expect(document.querySelector('.vgate')).toBeNull();
  });

  it.each([false, undefined, null])('a signed-in user with phoneVerified=%p is locked out', (phoneVerified) => {
    authState.user = { userId: 'u1', phoneVerified };
    render(<VerificationGate><Feature /></VerificationGate>);
    expect(screen.getByRole('button', { name: 'Verify phone' })).toBeInTheDocument();
    // The feature is still drawn (blurred) but hidden from assistive tech and unreachable by role.
    expect(screen.queryByRole('button', { name: 'Cast vote' })).not.toBeInTheDocument();
    expect(document.querySelector('.vgate__content')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('VerificationGate — the locked state', () => {
  beforeEach(() => { authState.user = { userId: 'u1', phoneVerified: false }; });

  it('shows the default title and explanation', () => {
    render(<VerificationGate><Feature /></VerificationGate>);
    expect(screen.getByText('Verify your phone to unlock this')).toBeInTheDocument();
    expect(screen.getByText(/a quick phone check keeps unis bot-free/i)).toBeInTheDocument();
  });

  it('uses the title and message it is given', () => {
    render(
      <VerificationGate title="Verify to refer & earn" message="One minute, once.">
        <Feature />
      </VerificationGate>
    );
    expect(screen.getByText('Verify to refer & earn')).toBeInTheDocument();
    expect(screen.getByText('One minute, once.')).toBeInTheDocument();
  });

  it('compact mode keeps the title and button but drops the explanation', () => {
    render(<VerificationGate compact><Feature /></VerificationGate>);
    expect(document.querySelector('.vgate')).toHaveClass('vgate--compact');
    expect(screen.getByText('Verify your phone to unlock this')).toBeInTheDocument();
    expect(screen.queryByText(/a quick phone check/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify phone' })).toBeInTheDocument();
  });

  it('the modal is closed until Verify phone is pressed', async () => {
    const user = userEvent.setup();
    render(<VerificationGate><Feature /></VerificationGate>);
    expect(screen.queryByTestId('phone-modal')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verify phone' }));
    expect(screen.getByTestId('phone-modal')).toBeInTheDocument();
  });

  it('closing the modal leaves the feature locked', async () => {
    const user = userEvent.setup();
    render(<VerificationGate><Feature /></VerificationGate>);
    await user.click(screen.getByRole('button', { name: 'Verify phone' }));
    await user.click(screen.getByRole('button', { name: 'modal-close' }));

    expect(screen.queryByTestId('phone-modal')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify phone' })).toBeInTheDocument();
    expect(authState.refreshUser).not.toHaveBeenCalled();
  });
});

describe('VerificationGate — after verifying', () => {
  beforeEach(() => { authState.user = { userId: 'u1', phoneVerified: false }; });

  it('re-reads the signed-in user', async () => {
    const user = userEvent.setup();
    render(<VerificationGate><Feature /></VerificationGate>);
    await user.click(screen.getByRole('button', { name: 'Verify phone' }));
    await user.click(screen.getByRole('button', { name: 'modal-verified' }));
    await waitFor(() => expect(authState.refreshUser).toHaveBeenCalledTimes(1));
  });

  it('opens by itself once the user comes back verified', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<VerificationGate><Feature /></VerificationGate>);
    await user.click(screen.getByRole('button', { name: 'Verify phone' }));
    await user.click(screen.getByRole('button', { name: 'modal-verified' }));

    authState.user = { userId: 'u1', phoneVerified: true };
    rerender(<VerificationGate><Feature /></VerificationGate>);
    expect(screen.getByRole('button', { name: 'Cast vote' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verify phone' })).not.toBeInTheDocument();
  });

  it('a failed re-read is not fatal — the gate stays up and nothing throws', async () => {
    authState.refreshUser = vi.fn().mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    render(<VerificationGate><Feature /></VerificationGate>);
    await user.click(screen.getByRole('button', { name: 'Verify phone' }));
    await user.click(screen.getByRole('button', { name: 'modal-verified' }));

    await waitFor(() => expect(authState.refreshUser).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Verify phone' })).toBeInTheDocument();
  });

  it('works when the auth context offers no refresh function', async () => {
    authState.refreshUser = undefined;
    const user = userEvent.setup();
    render(<VerificationGate><Feature /></VerificationGate>);
    await user.click(screen.getByRole('button', { name: 'Verify phone' }));
    await user.click(screen.getByRole('button', { name: 'modal-verified' }));
    expect(screen.getByRole('button', { name: 'Verify phone' })).toBeInTheDocument();
  });
});
