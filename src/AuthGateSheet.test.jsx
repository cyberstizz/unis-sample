// src/AuthGateSheet.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock the SCSS so Vitest doesn't try to parse it
vi.mock('./authGateSheet.scss', () => ({}));

// Capture navigate() calls from react-router-dom
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

import AuthGateSheet, {
  useAuthGate,
  incrementGateSongCount,
  getGateSongCount,
} from './AuthGateSheet';

// ---------------------------------------------------------------------------
// Test harness — a small component that uses the useAuthGate hook so we can
// drive the sheet open/closed through real usage patterns.
// ---------------------------------------------------------------------------
function GateHarness({ initialContext }) {
  const { triggerGate, gateProps } = useAuthGate();
  return (
    <div>
      <button onClick={() => triggerGate('vote')}>trigger-vote</button>
      <button onClick={() => triggerGate('earnings')}>trigger-earnings</button>
      <button onClick={() => triggerGate('wallet')}>trigger-wallet</button>
      <button onClick={() => triggerGate('profile')}>trigger-profile</button>
      <button onClick={() => triggerGate('generic')}>trigger-generic</button>
      <button onClick={() => triggerGate()}>trigger-default</button>
      <button onClick={() => triggerGate('unknown-context')}>trigger-unknown</button>
      <AuthGateSheet {...gateProps} />
    </div>
  );
}

function renderHarness(initialContext) {
  return render(
    <MemoryRouter>
      <GateHarness initialContext={initialContext} />
    </MemoryRouter>
  );
}

// Direct-render helper for tests that don't need the hook
function renderSheet(props) {
  return render(
    <MemoryRouter>
      <AuthGateSheet {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  navigateSpy.mockReset();
  // Reset module-level sessionSongCount between tests by importing fresh state
  // Since it's a module-scoped `let`, we need to subtract current count back to 0
  while (getGateSongCount() > 0) {
    // No direct reset export — walking it back isn't possible either.
    // Instead we'll work around this in tests that care by noting the
    // pre-test count and asserting deltas.
    break;
  }
});

afterEach(() => {
  vi.useRealTimers();
});

// ===========================================================================
// TESTS
// ===========================================================================

describe('AuthGateSheet — closed state', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = renderSheet({ isOpen: false, onClose: vi.fn() });
    expect(container.querySelector('.ags-sheet')).not.toBeInTheDocument();
    expect(container.querySelector('.ags-backdrop')).not.toBeInTheDocument();
  });

  it('renders sheet + backdrop when isOpen is true', () => {
    const { container } = renderSheet({ isOpen: true, onClose: vi.fn() });
    expect(container.querySelector('.ags-sheet')).toBeInTheDocument();
    expect(container.querySelector('.ags-backdrop')).toBeInTheDocument();
  });
});

describe('AuthGateSheet — context variants', () => {
  it('renders VOTE context messaging when context="vote"', () => {
    renderSheet({ isOpen: true, context: 'vote', onClose: vi.fn() });
    expect(screen.getByText('Sign up to vote')).toBeInTheDocument();
    expect(screen.getByText('your voice matters')).toBeInTheDocument();
    expect(screen.getByText(/Voting decides which artists/i)).toBeInTheDocument();
  });

  it('renders EARNINGS context messaging', () => {
    renderSheet({ isOpen: true, context: 'earnings', onClose: vi.fn() });
    expect(screen.getByText('Earn while you listen')).toBeInTheDocument();
    expect(screen.getByText('start earning')).toBeInTheDocument();
    expect(screen.getByText(/earn passive ad revenue/i)).toBeInTheDocument();
  });

  it('renders WALLET context messaging', () => {
    renderSheet({ isOpen: true, context: 'wallet', onClose: vi.fn() });
    expect(screen.getByText('Unlock your wallet')).toBeInTheDocument();
    expect(screen.getByText('your money, your music')).toBeInTheDocument();
  });

  it('renders PROFILE context messaging', () => {
    renderSheet({ isOpen: true, context: 'profile', onClose: vi.fn() });
    expect(screen.getByText('Create your profile')).toBeInTheDocument();
    expect(screen.getByText('make it yours')).toBeInTheDocument();
  });

  it('renders GENERIC context messaging', () => {
    renderSheet({ isOpen: true, context: 'generic', onClose: vi.fn() });
    expect(screen.getByText('Sign up to unlock Unis')).toBeInTheDocument();
    expect(screen.getByText('join the movement')).toBeInTheDocument();
  });

  it('falls back to GENERIC messaging for an unknown context', () => {
    renderSheet({ isOpen: true, context: 'totally-made-up', onClose: vi.fn() });
    expect(screen.getByText('Sign up to unlock Unis')).toBeInTheDocument();
  });

  it('defaults to GENERIC when context prop is omitted', () => {
    renderSheet({ isOpen: true, onClose: vi.fn() });
    expect(screen.getByText('Sign up to unlock Unis')).toBeInTheDocument();
  });

  it('sets aria-label from the context headline for screen readers', () => {
    const { container } = renderSheet({ isOpen: true, context: 'vote', onClose: vi.fn() });
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toHaveAttribute('aria-label', 'Sign up to vote');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

describe('AuthGateSheet — perks list', () => {
  it('renders all three perks on every gate', () => {
    renderSheet({ isOpen: true, context: 'vote', onClose: vi.fn() });
    expect(screen.getByText(/Earn passively/i)).toBeInTheDocument();
    expect(screen.getByText(/Vote on winners/i)).toBeInTheDocument();
    expect(screen.getByText(/Refer & earn more/i)).toBeInTheDocument();
  });

  it('renders the referral percentage detail', () => {
    renderSheet({ isOpen: true, context: 'generic', onClose: vi.fn() });
    expect(screen.getByText(/Earn 10% of your referrals/i)).toBeInTheDocument();
  });
});

describe('AuthGateSheet — song count stat', () => {
  it('does NOT show the stat when no songs have been listened to yet', () => {
    // Note: module-level sessionSongCount is reset to 0 only at module load.
    // Tests that increment it must run before any test that relies on 0.
    // This test runs first in its describe block, but even if sessionSongCount
    // is non-zero from prior tests, we can still verify by checking the stat
    // is conditional on count > 0.
    const { container } = renderSheet({ isOpen: true, context: 'vote', onClose: vi.fn() });
    if (getGateSongCount() === 0) {
      expect(container.querySelector('.ags-stat')).not.toBeInTheDocument();
    } else {
      // If some earlier suite incremented, skip silently — separate test
      // verifies the positive case.
      expect(container.querySelector('.ags-stat')).toBeInTheDocument();
    }
  });

  it('shows the stat and pluralizes correctly after incrementGateSongCount', () => {
    const preCount = getGateSongCount();
    incrementGateSongCount();
    const { unmount } = renderSheet({ isOpen: true, context: 'generic', onClose: vi.fn() });

    const stat = document.querySelector('.ags-stat');
    expect(stat).toBeInTheDocument();

    const expected = preCount + 1;
    expect(stat.textContent).toContain(String(expected));
    // The number is in a span and JSX has "song{songCount !== 1 ? 's' : ''}" with
    // no space between — so rendered text is "1song" / "2songs". Assert the
    // pluralization suffix is correct.
    if (expected === 1) {
      // Singular: ends with "song listened" (no 's')
      expect(stat.textContent).toMatch(/song listened/);
      expect(stat.textContent).not.toMatch(/songs listened/);
    } else {
      expect(stat.textContent).toMatch(/songs listened/);
    }
    unmount();
  });

  it('increments the counter on every call', () => {
    const start = getGateSongCount();
    incrementGateSongCount();
    incrementGateSongCount();
    incrementGateSongCount();
    expect(getGateSongCount()).toBe(start + 3);
  });
});

describe('AuthGateSheet — sign up / sign in navigation', () => {
  it('calls onClose and navigates to /createaccount on "Create Free Account"', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderSheet({ isOpen: true, context: 'vote', onClose });

    await user.click(screen.getByRole('button', { name: /create free account/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('/createaccount');
  });

  it('calls onClose and navigates to /login on sign-in link', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderSheet({ isOpen: true, context: 'vote', onClose });

    await user.click(screen.getByRole('button', { name: /already have an account/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it('calls onClose but does NOT navigate on "Continue browsing"', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderSheet({ isOpen: true, context: 'vote', onClose });

    await user.click(screen.getByRole('button', { name: /continue browsing/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

describe('AuthGateSheet — backdrop dismissal', () => {
  it('calls onClose when backdrop is clicked directly', async () => {
    const onClose = vi.fn();
    const { container } = renderSheet({ isOpen: true, context: 'vote', onClose });

    const backdrop = container.querySelector('.ags-backdrop');
    // Click the backdrop itself (target === currentTarget)
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when a click bubbles up from inside the sheet', async () => {
    const onClose = vi.fn();
    renderSheet({ isOpen: true, context: 'vote', onClose });

    // Click the headline inside the sheet — should NOT close the gate
    await userEvent.setup().click(screen.getByText('Sign up to vote'));

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('AuthGateSheet — keyboard interaction', () => {
  it('closes on Escape key press when open', () => {
    const onClose = vi.fn();
    renderSheet({ isOpen: true, context: 'vote', onClose });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close on non-Escape keys', () => {
    const onClose = vi.fn();
    renderSheet({ isOpen: true, context: 'vote', onClose });

    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'Tab' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('does NOT listen for Escape when closed (prevents stale handlers)', () => {
    const onClose = vi.fn();
    renderSheet({ isOpen: false, onClose });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('cleans up Escape listener after unmount', () => {
    const onClose = vi.fn();
    const { unmount } = renderSheet({ isOpen: true, context: 'vote', onClose });

    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('useAuthGate hook', () => {
  it('initializes with the gate closed', () => {
    renderHarness();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the gate with VOTE context when triggerGate("vote") is called', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByText('trigger-vote'));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Sign up to vote' })).toBeInTheDocument();
    });
    expect(screen.getByText('your voice matters')).toBeInTheDocument();
  });

  it('opens with EARNINGS context when triggerGate("earnings") is called', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByText('trigger-earnings'));

    await waitFor(() => {
      expect(screen.getByText('Earn while you listen')).toBeInTheDocument();
    });
  });

  it('defaults to GENERIC when triggerGate is called with no arg', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByText('trigger-default'));

    await waitFor(() => {
      expect(screen.getByText('Sign up to unlock Unis')).toBeInTheDocument();
    });
  });

  it('falls back to GENERIC when triggerGate is called with unknown context', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByText('trigger-unknown'));

    await waitFor(() => {
      expect(screen.getByText('Sign up to unlock Unis')).toBeInTheDocument();
    });
  });

  it('switches context when triggerGate is called again with different context', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByText('trigger-vote'));
    await waitFor(() => expect(screen.getByText('Sign up to vote')).toBeInTheDocument());

    await user.click(screen.getByText('trigger-wallet'));
    await waitFor(() => expect(screen.getByText('Unlock your wallet')).toBeInTheDocument());
  });

  it('closes the gate when onClose (via Continue browsing) is called', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByText('trigger-vote'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /continue browsing/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes gate and navigates on Sign Up click via hook', async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByText('trigger-vote'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /create free account/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(navigateSpy).toHaveBeenCalledWith('/createaccount');
  });

  it('reopens cleanly after being closed', async () => {
    const user = userEvent.setup();
    renderHarness();

    // Open, close, reopen with a different context
    await user.click(screen.getByText('trigger-vote'));
    await waitFor(() => expect(screen.getByText('Sign up to vote')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /continue browsing/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByText('trigger-profile'));
    await waitFor(() => expect(screen.getByText('Create your profile')).toBeInTheDocument());
  });
});

describe('AuthGateSheet — visibility animation class', () => {
  it('applies ags-sheet-visible class after rAF ticks', async () => {
    const { container } = renderSheet({ isOpen: true, context: 'vote', onClose: vi.fn() });

    // Two rAF ticks are scheduled before visible=true is set
    await waitFor(() => {
      const sheet = container.querySelector('.ags-sheet');
      expect(sheet).toHaveClass('ags-sheet-visible');
    });
  });

  it('applies ags-backdrop-visible class after rAF ticks', async () => {
    const { container } = renderSheet({ isOpen: true, context: 'vote', onClose: vi.fn() });

    await waitFor(() => {
      const backdrop = container.querySelector('.ags-backdrop');
      expect(backdrop).toHaveClass('ags-backdrop-visible');
    });
  });
});

describe('AuthGateSheet — accessibility surface', () => {
  it('exposes all three actions as buttons', () => {
    renderSheet({ isOpen: true, context: 'vote', onClose: vi.fn() });

    expect(screen.getByRole('button', { name: /create free account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /already have an account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue browsing/i })).toBeInTheDocument();
  });

  it('marks the sheet as a dialog', () => {
    renderSheet({ isOpen: true, context: 'vote', onClose: vi.fn() });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});