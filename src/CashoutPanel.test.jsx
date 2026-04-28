// src/CashoutPanel.test.jsx

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Adjust this import path if your CashoutPanel lives somewhere else.
import CashoutPanel from './CashoutPanel';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function renderCashoutPanel(overrides = {}) {
  const props = {
    balance: 7523,
    pendingBalance: 1250,
    minimumPayout: 5000,
    stripeConnected: true,
    onRequestPayout: vi.fn().mockResolvedValue(undefined),
    onConnectStripe: vi.fn(),
    payoutHistory: [],
    ...overrides,
  };

  const result = render(<CashoutPanel {...props} />);

  return {
    ...result,
    props,
  };
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===========================================================================
// BALANCE DISPLAY
// ===========================================================================

describe('CashoutPanel — balance display', () => {
  it('renders the available balance formatted from cents', () => {
    renderCashoutPanel({ balance: 7523 });

    expect(screen.getByText(/available balance/i)).toBeInTheDocument();
    expect(screen.getByText('$75.23')).toBeInTheDocument();
  });

  it('renders pending balance when pendingBalance is greater than zero', () => {
    renderCashoutPanel({ pendingBalance: 1250 });

    expect(screen.getByText('$12.50 pending')).toBeInTheDocument();
  });

  it('does not render pending balance when pendingBalance is zero', () => {
    renderCashoutPanel({ pendingBalance: 0 });

    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
  });

  it('defaults missing balances to $0.00', () => {
    render(<CashoutPanel stripeConnected={false} />);

    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });
});

// ===========================================================================
// STRIPE CONNECT STATE
// ===========================================================================

describe('CashoutPanel — Stripe connection state', () => {
  it('shows Stripe onboarding CTA when Stripe is not connected', () => {
    renderCashoutPanel({
      stripeConnected: false,
      balance: 7523,
    });

    expect(
      screen.getByText(/connect your bank account via stripe/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', { name: /connect with stripe/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: /cash out/i })
    ).not.toBeInTheDocument();
  });

  it('calls onConnectStripe when the Stripe CTA is clicked', async () => {
    const user = userEvent.setup();
    const onConnectStripe = vi.fn();

    renderCashoutPanel({
      stripeConnected: false,
      onConnectStripe,
    });

    await user.click(screen.getByRole('button', { name: /connect with stripe/i }));

    expect(onConnectStripe).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// MINIMUM PAYOUT STATE
// ===========================================================================

describe('CashoutPanel — minimum payout state', () => {
  it('shows minimum payout shortfall when connected but below minimum', () => {
    renderCashoutPanel({
      stripeConnected: true,
      balance: 3200,
      minimumPayout: 5000,
    });

    expect(
      screen.getByText(/\$18\.00 more to reach the \$50\.00 minimum payout/i)
    ).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: /cash out/i })
    ).not.toBeInTheDocument();
  });

  it('shows Cash Out when connected and balance meets minimum payout', () => {
    renderCashoutPanel({
      stripeConnected: true,
      balance: 5000,
      minimumPayout: 5000,
    });

    expect(screen.getByRole('button', { name: /cash out/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// CONFIRMATION FLOW — FULL BALANCE
// ===========================================================================

describe('CashoutPanel — payout confirmation flow', () => {
  it('opens the confirmation panel when Cash Out is clicked', async () => {
    const user = userEvent.setup();

    renderCashoutPanel();

    await user.click(screen.getByRole('button', { name: /cash out/i }));

    expect(screen.getByText(/confirm payout/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /full balance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /custom amount/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /confirm \$75\.23 payout/i })
    ).toBeInTheDocument();
  });

  it('requests payout for the full available balance by default', async () => {
    const user = userEvent.setup();
    const onRequestPayout = vi.fn().mockResolvedValue(undefined);

    renderCashoutPanel({
      balance: 7523,
      onRequestPayout,
    });

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.click(screen.getByRole('button', { name: /confirm \$75\.23 payout/i }));

    await waitFor(() => {
      expect(onRequestPayout).toHaveBeenCalledWith(7523);
    });
  });

  it('shows a success message after payout request succeeds', async () => {
    const user = userEvent.setup();

    renderCashoutPanel({
      onRequestPayout: vi.fn().mockResolvedValue(undefined),
    });

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.click(screen.getByRole('button', { name: /confirm \$75\.23 payout/i }));

    expect(
      await screen.findByText(/payout requested/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/funds typically arrive in 1–2 business days/i)
    ).toBeInTheDocument();
  });

  it('resets the confirmation panel after a successful payout timeout', async () => {
    vi.useFakeTimers();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderCashoutPanel({
      onRequestPayout: vi.fn().mockResolvedValue(undefined),
    });

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.click(screen.getByRole('button', { name: /confirm \$75\.23 payout/i }));

    expect(await screen.findByText(/payout requested/i)).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(2000);

    await waitFor(() => {
      expect(screen.queryByText(/payout requested/i)).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /cash out/i })).toBeInTheDocument();
  });

  it('shows an error message when payout request fails', async () => {
    const user = userEvent.setup();

    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderCashoutPanel({
      onRequestPayout: vi.fn().mockRejectedValue(new Error('Payout failed')),
    });

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.click(screen.getByRole('button', { name: /confirm \$75\.23 payout/i }));

    expect(
      await screen.findByText(/payout failed\. please try again or contact support/i)
    ).toBeInTheDocument();
  });

  it('cancel closes the confirmation panel and returns to Cash Out state', async () => {
    const user = userEvent.setup();

    renderCashoutPanel();

    await user.click(screen.getByRole('button', { name: /cash out/i }));

    expect(screen.getByText(/confirm payout/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText(/confirm payout/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cash out/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// CUSTOM AMOUNT FLOW
// ===========================================================================

describe('CashoutPanel — custom amount flow', () => {
  it('shows custom amount input when Custom amount is selected', async () => {
    const user = userEvent.setup();

    renderCashoutPanel();

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.click(screen.getByRole('button', { name: /custom amount/i }));

    const input = screen.getByPlaceholderText('50.00');

    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('min', '50.00');
    expect(input).toHaveAttribute('max', '75.23');
    expect(input).toHaveAttribute('step', '0.01');
  });

  it('requests payout for a valid custom amount in cents', async () => {
    const user = userEvent.setup();
    const onRequestPayout = vi.fn().mockResolvedValue(undefined);

    renderCashoutPanel({
      balance: 7523,
      minimumPayout: 5000,
      onRequestPayout,
    });

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.click(screen.getByRole('button', { name: /custom amount/i }));

    await user.type(screen.getByPlaceholderText('50.00'), '60.25');

    await user.click(screen.getByRole('button', { name: /confirm \$60\.25 payout/i }));

    await waitFor(() => {
      expect(onRequestPayout).toHaveBeenCalledWith(6025);
    });
  });

  it('shows validation error when custom amount is below minimum payout', async () => {
    const user = userEvent.setup();
    const onRequestPayout = vi.fn();

    renderCashoutPanel({
      balance: 7523,
      minimumPayout: 5000,
      onRequestPayout,
    });

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.click(screen.getByRole('button', { name: /custom amount/i }));

    await user.type(screen.getByPlaceholderText('50.00'), '25');

    expect(screen.getByText(/minimum payout is \$50\.00/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', {
      name: /confirm \$25\.00 payout/i,
    });

    expect(confirmButton).toHaveStyle({ pointerEvents: 'none' });

    await user.click(confirmButton);

    expect(onRequestPayout).not.toHaveBeenCalled();
  });

  it('shows validation error when custom amount exceeds available balance', async () => {
    const user = userEvent.setup();
    const onRequestPayout = vi.fn();

    renderCashoutPanel({
      balance: 7523,
      minimumPayout: 5000,
      onRequestPayout,
    });

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.click(screen.getByRole('button', { name: /custom amount/i }));

    await user.type(screen.getByPlaceholderText('50.00'), '100');

    expect(
      screen.getByText(/cannot exceed your balance of \$75\.23/i)
    ).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', {
      name: /confirm \$100\.00 payout/i,
    });

    expect(confirmButton).toHaveStyle({ pointerEvents: 'none' });

    await user.click(confirmButton);

    expect(onRequestPayout).not.toHaveBeenCalled();
  });

  it('switching back to full balance clears the custom amount', async () => {
    const user = userEvent.setup();

    renderCashoutPanel();

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.click(screen.getByRole('button', { name: /custom amount/i }));

    const input = screen.getByPlaceholderText('50.00');
    await user.type(input, '60');

    expect(screen.getByRole('button', { name: /confirm \$60\.00 payout/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /full balance/i }));

    expect(screen.queryByPlaceholderText('50.00')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm \$75\.23 payout/i })).toBeInTheDocument();
  });

  it('cancel resets custom amount state', async () => {
    const user = userEvent.setup();

    renderCashoutPanel();

    await user.click(screen.getByRole('button', { name: /cash out/i }));
    await user.click(screen.getByRole('button', { name: /custom amount/i }));
    await user.type(screen.getByPlaceholderText('50.00'), '60');

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    await user.click(screen.getByRole('button', { name: /cash out/i }));

    expect(screen.queryByPlaceholderText('50.00')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm \$75\.23 payout/i })).toBeInTheDocument();
  });
});

// ===========================================================================
// PROCESSING STATE
// ===========================================================================

describe('CashoutPanel — processing state', () => {
  it('prevents duplicate payout clicks while processing', async () => {
    const user = userEvent.setup();

    let resolvePayout;
    const onRequestPayout = vi.fn(
      () =>
        new Promise((resolve) => {
          resolvePayout = resolve;
        })
    );

    renderCashoutPanel({
      onRequestPayout,
    });

    await user.click(screen.getByRole('button', { name: /cash out/i }));

    const confirmButton = screen.getByRole('button', {
      name: /confirm \$75\.23 payout/i,
    });

    await user.click(confirmButton);

    expect(onRequestPayout).toHaveBeenCalledTimes(1);

    // The button no longer has text while processing because it renders the spinner.
    const processingButton = document.querySelector('button[style*="pointer-events: none"]');
    expect(processingButton).not.toBeNull();

    await user.click(processingButton);

    expect(onRequestPayout).toHaveBeenCalledTimes(1);

    resolvePayout();

    await waitFor(() => {
      expect(screen.getByText(/payout requested/i)).toBeInTheDocument();
    });
  });
});

// ===========================================================================
// PAYOUT HISTORY
// ===========================================================================

describe('CashoutPanel — payout history', () => {
  it('does not render payout history section when payoutHistory is empty', () => {
    renderCashoutPanel({
      payoutHistory: [],
    });

    expect(screen.queryByText(/payout history/i)).not.toBeInTheDocument();
  });

  it('renders payout history rows with formatted dates, amounts, and statuses', () => {
    renderCashoutPanel({
      payoutHistory: [
        {
          id: 'po_1',
          amount: 5000,
          status: 'paid',
          date: '2026-04-01',
        },
        {
          id: 'po_2',
          amount: 2500,
          status: 'pending',
          date: '2026-04-15',
        },
        {
          id: 'po_3',
          amount: 1000,
          status: 'failed',
          date: '2026-04-20',
        },
        {
          id: 'po_4',
          amount: 750,
          status: 'canceled',
          date: '2026-04-22',
        },
      ],
    });

    expect(screen.getByText(/payout history/i)).toBeInTheDocument();

    expect(screen.getByText('Paid')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Canceled')).toBeInTheDocument();

    expect(screen.getByText('$50.00')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('$7.50')).toBeInTheDocument();

    expect(screen.getByText(/apr 1, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/apr 15, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/apr 20, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/apr 22, 2026/i)).toBeInTheDocument();
  });

  it('falls back to Pending display for unknown payout statuses', () => {
    renderCashoutPanel({
      payoutHistory: [
        {
          id: 'po_unknown',
          amount: 1234,
          status: 'mystery_status',
          date: '2026-04-01',
        },
      ],
    });

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('$12.34')).toBeInTheDocument();
  });
});