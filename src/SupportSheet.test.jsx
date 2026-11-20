// src/SupportSheet.test.jsx
//
// SupportSheet — sending an artist money directly ("name your price").
//
// Flow:
//   amount  pick $3 / $5 / $10 / $25 or type one, optional note
//           → POST /v1/support/{artistId}/intent { amount (cents), note, source }
//   pay     Stripe's card form → stripe.confirmPayment
//           → POST /v1/support/{artistId}/confirm { paymentIntentId }
//   done    thank-you, onSuccess, the sheet closes itself
//
// Money rules checked here: $1 minimum, $100 maximum per payment, amounts
// sent in cents, and success is only reported after the server has recorded
// the payment. Stripe is stubbed — nothing here talks to Stripe.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as axiosModule from './components/axiosInstance';

vi.mock('./support.scss', () => ({}));

const { feedback, stripe } = vi.hoisted(() => ({
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  stripe: { confirmPayment: vi.fn() },
}));
vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));
vi.mock('@stripe/stripe-js/pure', () => ({ loadStripe: vi.fn(() => Promise.resolve({})) }));
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children, options }) => (
    <div data-testid="stripe-elements" data-secret={options.clientSecret}>{children}</div>
  ),
  PaymentElement: () => <div data-testid="card-form" />,
  useStripe: () => stripe,
  useElements: () => ({ id: 'elements' }),
}));

import SupportSheet from './SupportSheet';

let apiSpy;
let answers;

const calls = (pattern) => apiSpy.mock.calls.map(([c]) => c).filter((c) => pattern.test(c.url));

function renderSheet(props = {}) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <SupportSheet isOpen onClose={onClose} onSuccess={onSuccess} artistId="artist-1" artistName="Tony Fadd" {...props} />
  );
  return { onClose, onSuccess, user, ...utils };
}

const continueButton = () => screen.getByRole('button', { name: /continue|one sec/i });
const customBox = () => screen.getByPlaceholderText('Custom amount');
const noteBox = () => screen.getByPlaceholderText('Add a note (optional)');
const payButton = () => screen.getByRole('button', { name: /send \$|processing/i });
const errorText = () => document.querySelector('.usp-error');

async function reachPayStep(user) {
  await user.click(continueButton());
  await screen.findByTestId('card-form');
}

beforeEach(() => {
  vi.clearAllMocks();
  answers = {
    intent: { data: { clientSecret: 'pi_secret_123' } },
    confirm: { data: { supportId: 77 } },
  };
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async ({ url }) => {
    const answer = /\/intent$/.test(url) ? answers.intent : answers.confirm;
    if (answer instanceof Error || answer?.response) throw answer;
    return answer;
  });
  stripe.confirmPayment.mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'succeeded' } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===========================================================================
describe('SupportSheet — opening and closing', () => {
  it('renders nothing when closed', () => {
    const { container } = renderSheet({ isOpen: false });
    expect(container.firstChild).toBeNull();
  });

  it('is a modal dialog naming the artist', () => {
    renderSheet();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Support Tony Fadd' })).toBeInTheDocument();
    expect(screen.getByText('Goes straight to the artist — name your price.')).toBeInTheDocument();
  });

  it('locks page scrolling while open and restores it after', () => {
    const { unmount } = renderSheet();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it.each([
    ['the × button', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['a press outside the sheet', () => fireEvent.mouseDown(document.querySelector('.usp'))],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('%s closes it after the slide-out', (_label, close) => {
    vi.useFakeTimers();
    const { onClose } = renderSheet();
    close();
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a press inside the sheet does not close it', () => {
    vi.useFakeTimers();
    const { onClose } = renderSheet();
    fireEvent.mouseDown(screen.getByRole('dialog'));
    act(() => { vi.advanceTimersByTime(500); });
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('SupportSheet — choosing an amount', () => {
  it('offers $3, $5, $10 and $25, with $10 picked to start', () => {
    renderSheet();
    ['$3', '$5', '$10', '$25'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '$10' })).toHaveClass('active');
    expect(continueButton()).toHaveTextContent('Continue — $10.00');
  });

  it('picking a preset updates the button', async () => {
    const { user } = renderSheet();
    await user.click(screen.getByRole('button', { name: '$25' }));
    expect(screen.getByRole('button', { name: '$25' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: '$10' })).not.toHaveClass('active');
    expect(continueButton()).toHaveTextContent('Continue — $25.00');
  });

  it('a typed amount takes over from the presets', async () => {
    const { user } = renderSheet();
    await user.type(customBox(), '7.50');
    expect(continueButton()).toHaveTextContent('Continue — $7.50');
    expect(document.querySelector('.usp-chip.active')).toBeNull();
  });

  it('picking a preset clears the typed amount', async () => {
    const { user } = renderSheet();
    await user.type(customBox(), '7.50');
    await user.click(screen.getByRole('button', { name: '$5' }));
    expect(customBox()).toHaveValue(null);
    expect(continueButton()).toHaveTextContent('Continue — $5.00');
  });

  it('Continue is disabled under the $1.00 minimum', async () => {
    const { user } = renderSheet();
    await user.type(customBox(), '0.99');
    expect(continueButton()).toBeDisabled();
    expect(continueButton()).toHaveTextContent('Continue — $0.99');

    await user.clear(customBox());
    await user.type(customBox(), '1');
    expect(continueButton()).toBeEnabled();
  });

  it('refuses more than $100 at once, without asking the server', async () => {
    const { user } = renderSheet();
    await user.type(customBox(), '100.01');
    await user.click(continueButton());
    expect(errorText()).toHaveTextContent('The most you can send at once is $100.');
    expect(apiSpy).not.toHaveBeenCalled();
  });

  it('exactly $100 is allowed', async () => {
    const { user } = renderSheet();
    await user.type(customBox(), '100');
    await reachPayStep(user);
    expect(calls(/\/intent$/)[0].data.amount).toBe(10000);
  });
});

// ===========================================================================
describe('SupportSheet — starting the payment', () => {
  it('sends the amount in cents, the note and where it came from', async () => {
    const { user } = renderSheet({ source: 'dm' });
    await user.click(screen.getByRole('button', { name: '$5' }));
    await user.type(noteBox(), '  love the new single  ');
    await reachPayStep(user);

    expect(calls(/\/intent$/)).toEqual([{
      method: 'post',
      url: '/v1/support/artist-1/intent',
      data: { amount: 500, note: 'love the new single', source: 'dm' },
    }]);
  });

  it('sends a null note when none is written, and defaults the source to the profile', async () => {
    const { user } = renderSheet();
    await reachPayStep(user);
    expect(calls(/\/intent$/)[0].data).toEqual({ amount: 1000, note: null, source: 'profile' });
  });

  it('converts a typed amount to whole cents', async () => {
    const { user } = renderSheet();
    await user.type(customBox(), '19.99');
    await reachPayStep(user);
    expect(calls(/\/intent$/)[0].data.amount).toBe(1999);
  });

  it('hands Stripe the secret the server returned', async () => {
    const { user } = renderSheet();
    await reachPayStep(user);
    expect(screen.getByTestId('stripe-elements')).toHaveAttribute('data-secret', 'pi_secret_123');
    expect(payButton()).toHaveTextContent('Send $10.00 support');
  });

  it('shows the server\'s reason when the payment cannot be started', async () => {
    answers.intent = { response: { data: { error: 'You\'ve reached today\'s support limit.' } } };
    const { user } = renderSheet();
    await user.click(continueButton());
    await waitFor(() => expect(errorText()).toHaveTextContent("You've reached today's support limit."));
    expect(screen.queryByTestId('card-form')).not.toBeInTheDocument();
    expect(continueButton()).toBeEnabled();
  });

  it('shows a plain message when there is no reason', async () => {
    answers.intent = new Error('Network Error');
    const { user } = renderSheet();
    await user.click(continueButton());
    await waitFor(() => expect(errorText()).toHaveTextContent('Could not start the payment.'));
  });

  it('Back returns to the amount with the choice kept', async () => {
    const { user } = renderSheet();
    await user.click(screen.getByRole('button', { name: '$25' }));
    await reachPayStep(user);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(continueButton()).toHaveTextContent('Continue — $25.00');
  });
});

// ===========================================================================
describe('SupportSheet — paying', () => {
  it('confirms with Stripe without leaving the page unless Stripe needs it', async () => {
    const { user } = renderSheet();
    await reachPayStep(user);
    await user.click(payButton());
    await waitFor(() => expect(stripe.confirmPayment).toHaveBeenCalledTimes(1));
    expect(stripe.confirmPayment).toHaveBeenCalledWith(expect.objectContaining({
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    }));
  });

  it('records the payment with the server once Stripe says it succeeded', async () => {
    const { user } = renderSheet();
    await reachPayStep(user);
    await user.click(payButton());
    await waitFor(() => expect(calls(/\/confirm$/)).toEqual([{
      method: 'post',
      url: '/v1/support/artist-1/confirm',
      data: { paymentIntentId: 'pi_123' },
    }]));
  });

  it('then thanks the supporter and reports the payment to the page', async () => {
    const { user, onSuccess } = renderSheet();
    await user.click(screen.getByRole('button', { name: '$5' }));
    await user.type(noteBox(), 'keep going');
    await reachPayStep(user);
    await user.click(payButton());

    expect(await screen.findByText('Support sent')).toBeInTheDocument();
    expect(screen.getByText('Thank you for backing Tony Fadd.')).toBeInTheDocument();
    expect(feedback.success).toHaveBeenCalledWith('Sent $5.00 to Tony Fadd. Thank you!');
    expect(onSuccess).toHaveBeenCalledWith({ supportId: 77, amount: 500, note: 'keep going' });
  });

  it('the sheet closes itself shortly after', async () => {
    const { user, onClose } = renderSheet();
    await reachPayStep(user);
    await user.click(payButton());
    await screen.findByText('Support sent');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1), { timeout: 3000 });
  });

  it('a declined card shows Stripe\'s reason and records nothing', async () => {
    stripe.confirmPayment.mockResolvedValue({ error: { message: 'Your card was declined.' } });
    const { user, onSuccess } = renderSheet();
    await reachPayStep(user);
    await user.click(payButton());

    await waitFor(() => expect(errorText()).toHaveTextContent('Your card was declined.'));
    expect(calls(/\/confirm$/)).toHaveLength(0);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(feedback.success).not.toHaveBeenCalled();
    expect(payButton()).toBeEnabled();
  });

  it('a payment that did not complete is not treated as paid', async () => {
    stripe.confirmPayment.mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'requires_action' } });
    const { user, onSuccess } = renderSheet();
    await reachPayStep(user);
    await user.click(payButton());

    await waitFor(() => expect(errorText()).toHaveTextContent('Payment was not completed.'));
    expect(calls(/\/confirm$/)).toHaveLength(0);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('if the card was charged but the server could not record it, it says so plainly', async () => {
    answers.confirm = new Error('down');
    const { user, onSuccess } = renderSheet();
    await reachPayStep(user);
    await user.click(payButton());

    await waitFor(() => expect(errorText()).toHaveTextContent(
      'Payment went through, but we couldn’t record it. Please reach out to support.'));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.queryByText('Support sent')).not.toBeInTheDocument();
  });

  it('shows "Processing…" and blocks Back while the payment is in flight', async () => {
    let finish;
    stripe.confirmPayment.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user } = renderSheet();
    await reachPayStep(user);
    await user.click(payButton());

    expect(payButton()).toHaveTextContent('Processing…');
    expect(payButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    await act(async () => { finish({ error: { message: 'x' } }); });
  });
});

// ===========================================================================
describe('SupportSheet — reopening', () => {
  it('starts fresh: $10, no note, no card form', async () => {
    const { user, rerender } = renderSheet();
    await user.click(screen.getByRole('button', { name: '$25' }));
    await user.type(noteBox(), 'hello');
    await reachPayStep(user);

    rerender(<SupportSheet isOpen={false} artistId="artist-1" artistName="Tony Fadd" />);
    rerender(<SupportSheet isOpen artistId="artist-1" artistName="Tony Fadd" />);

    expect(continueButton()).toHaveTextContent('Continue — $10.00');
    expect(noteBox()).toHaveValue('');
    expect(screen.queryByTestId('card-form')).not.toBeInTheDocument();
  });
});
