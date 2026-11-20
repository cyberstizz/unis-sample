// src/phoneVerificationModal.test.jsx
//
// Phone verification — the check that unlocks voting, commenting and referral
// earnings, and keeps bots from doing any of them.
//
// Flow:
//   step 1  enter a mobile number  → POST /v1/phone/start { phoneNumber }
//   step 2  enter the texted code  → POST /v1/phone/check { code }
//   onVerified() is called only once the server says the code is right.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as axiosModule from './components/axiosInstance';

vi.mock('./phoneVerificationModal.scss', () => ({}));

const { feedback } = vi.hoisted(() => ({
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));

import PhoneVerificationModal from './phoneVerificationModal';

let apiSpy;
let answers;

function renderModal(props = {}) {
  const onClose = vi.fn();
  const onVerified = vi.fn();
  const user = userEvent.setup();
  const utils = render(<PhoneVerificationModal show onClose={onClose} onVerified={onVerified} {...props} />);
  return { onClose, onVerified, user, ...utils };
}

const phoneBox = () => screen.getByPlaceholderText('(212) 555-0134');
const codeBox = () => screen.getByPlaceholderText('123456');
const sendButton = () => screen.getByRole('button', { name: /send code|sending/i });
const verifyButton = () => screen.getByRole('button', { name: /^verify|verifying/i });
const errorText = () => document.querySelector('.pv-error');

async function reachCodeStep(user, number = '2125550134') {
  await user.type(phoneBox(), number);
  await user.click(sendButton());
  await screen.findByRole('heading', { name: /enter the code/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  answers = {
    start: { data: { phone: '(•••) •••-0134' } },
    check: { data: { verified: true } },
  };
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async ({ url }) => {
    const answer = url === '/v1/phone/start' ? answers.start : answers.check;
    if (answer instanceof Error || answer?.response) throw answer;
    return answer;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
describe('PhoneVerificationModal — visibility', () => {
  it('renders nothing when show=false', () => {
    const { container } = renderModal({ show: false });
    expect(container.firstChild).toBeNull();
  });

  it('is a labelled modal dialog that says what verifying unlocks', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Verify your phone number' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/unlocks voting, comments, and referral earnings/i)).toBeInTheDocument();
  });

  it('closes from the × and the overlay, but not from inside', async () => {
    const { user, onClose } = renderModal();
    await user.click(document.querySelector('.pv-modal'));
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(document.querySelector('.pv-overlay'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('starts over each time it is reopened', async () => {
    const { user, rerender } = renderModal();
    await reachCodeStep(user);

    rerender(<PhoneVerificationModal show={false} onClose={() => {}} />);
    rerender(<PhoneVerificationModal show onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: /verify your phone/i })).toBeInTheDocument();
    expect(phoneBox()).toHaveValue('');
  });
});

// ===========================================================================
describe('PhoneVerificationModal — step 1: the number', () => {
  it('Send code is disabled until something is typed', async () => {
    const { user } = renderModal();
    expect(sendButton()).toBeDisabled();
    await user.type(phoneBox(), '   ');
    expect(sendButton()).toBeDisabled();
    await user.type(phoneBox(), '2125550134');
    expect(sendButton()).toBeEnabled();
  });

  it('sends the number as typed', async () => {
    const { user } = renderModal();
    await user.type(phoneBox(), '(212) 555-0134');
    await user.click(sendButton());
    await waitFor(() => expect(apiSpy).toHaveBeenCalledWith({
      method: 'post', url: '/v1/phone/start', data: { phoneNumber: '(212) 555-0134' },
    }));
  });

  it('Enter sends it too', async () => {
    const { user } = renderModal();
    await user.type(phoneBox(), '2125550134{Enter}');
    await screen.findByRole('heading', { name: /enter the code/i });
    expect(apiSpy).toHaveBeenCalledTimes(1);
  });

  it('moves to the code step and shows the masked number', async () => {
    const { user } = renderModal();
    await reachCodeStep(user);
    expect(screen.getByText(/we texted a 6-digit code to \(•••\) •••-0134/i)).toBeInTheDocument();
    expect(codeBox()).toHaveFocus();
  });

  it('says "your phone" when the server sends no masked number', async () => {
    answers.start = { data: {} };
    const { user } = renderModal();
    await reachCodeStep(user);
    expect(screen.getByText(/we texted a 6-digit code to your phone/i)).toBeInTheDocument();
  });

  it('shows the server\'s reason when the number is refused', async () => {
    answers.start = { response: { data: { error: 'That number is already used by another account.' } } };
    const { user, onVerified } = renderModal();
    await user.type(phoneBox(), '2125550134');
    await user.click(sendButton());

    await waitFor(() => expect(errorText()).toHaveTextContent('That number is already used by another account.'));
    expect(screen.getByRole('heading', { name: /verify your phone/i })).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
    expect(sendButton()).toBeEnabled();
  });

  it('shows a plain message when there is no reason', async () => {
    answers.start = new Error('Network Error');
    const { user } = renderModal();
    await user.type(phoneBox(), '2125550134');
    await user.click(sendButton());
    await waitFor(() =>
      expect(errorText()).toHaveTextContent('Could not send a code. Check the number and try again.'));
  });

  it('a number that is already verified finishes straight away', async () => {
    answers.start = { data: { alreadyVerified: true } };
    const { user, onVerified, onClose } = renderModal();
    await user.type(phoneBox(), '2125550134');
    await user.click(sendButton());

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(feedback.info).toHaveBeenCalledWith('That number is already verified');
  });

  it('shows "Sending…" and ignores a second press while the text is going out', async () => {
    let finish;
    apiSpy.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const { user } = renderModal();
    await user.type(phoneBox(), '2125550134');
    await user.click(sendButton());

    expect(sendButton()).toHaveTextContent('Sending…');
    expect(sendButton()).toBeDisabled();
    await user.type(phoneBox(), '{Enter}');
    expect(apiSpy).toHaveBeenCalledTimes(1);

    finish({ data: { phone: '•••0134' } });
    await screen.findByRole('heading', { name: /enter the code/i });
  });
});

// ===========================================================================
describe('PhoneVerificationModal — step 2: the code', () => {
  it('accepts digits only', async () => {
    const { user } = renderModal();
    await reachCodeStep(user);
    await user.type(codeBox(), '12a-3 4b56');
    expect(codeBox()).toHaveValue('123456');
  });

  it('Verify is disabled until at least four digits are in', async () => {
    const { user } = renderModal();
    await reachCodeStep(user);
    await user.type(codeBox(), '123');
    expect(verifyButton()).toBeDisabled();
    await user.type(codeBox(), '4');
    expect(verifyButton()).toBeEnabled();
  });

  it('sends the code', async () => {
    const { user } = renderModal();
    await reachCodeStep(user);
    await user.type(codeBox(), '123456');
    await user.click(verifyButton());
    await waitFor(() => expect(apiSpy).toHaveBeenCalledWith({
      method: 'post', url: '/v1/phone/check', data: { code: '123456' },
    }));
  });

  it('a correct code confirms, reports back and closes', async () => {
    const { user, onVerified, onClose } = renderModal();
    await reachCodeStep(user);
    await user.type(codeBox(), '123456{Enter}');

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(feedback.success).toHaveBeenCalledWith(
      'Phone verified — voting, commenting and earnings are unlocked');
  });

  it('a wrong code says so and unlocks nothing', async () => {
    answers.check = { data: { verified: false } };
    const { user, onVerified, onClose } = renderModal();
    await reachCodeStep(user);
    await user.type(codeBox(), '000000');
    await user.click(verifyButton());

    await waitFor(() => expect(errorText()).toHaveTextContent("That code didn't match. Try again."));
    expect(onVerified).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it('an expired or invalid code shows the server\'s reason, or a plain one', async () => {
    answers.check = { response: { data: { error: 'Too many attempts. Request a new code.' } } };
    const { user, onVerified } = renderModal();
    await reachCodeStep(user);
    await user.type(codeBox(), '000000');
    await user.click(verifyButton());
    await waitFor(() => expect(errorText()).toHaveTextContent('Too many attempts. Request a new code.'));

    answers.check = new Error('Network Error');
    await user.click(verifyButton());
    await waitFor(() => expect(errorText()).toHaveTextContent('That code is invalid or has expired.'));
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('an answer with no "verified" flag is treated as not verified', async () => {
    answers.check = { data: {} };
    const { user, onVerified } = renderModal();
    await reachCodeStep(user);
    await user.type(codeBox(), '123456');
    await user.click(verifyButton());
    await waitFor(() => expect(errorText()).not.toBeNull());
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('Resend code clears the box and texts the same number again', async () => {
    const { user } = renderModal();
    await reachCodeStep(user, '2125550134');
    await user.type(codeBox(), '1234');
    await user.click(screen.getByRole('button', { name: 'Resend code' }));

    await waitFor(() => expect(apiSpy).toHaveBeenCalledTimes(2));
    expect(apiSpy).toHaveBeenLastCalledWith({
      method: 'post', url: '/v1/phone/start', data: { phoneNumber: '2125550134' },
    });
    expect(codeBox()).toHaveValue('');
  });

  it('Change number goes back with the number still filled in', async () => {
    const { user } = renderModal();
    await reachCodeStep(user, '2125550134');
    await user.click(screen.getByRole('button', { name: 'Change number' }));
    expect(screen.getByRole('heading', { name: /verify your phone/i })).toBeInTheDocument();
    expect(phoneBox()).toHaveValue('2125550134');
  });

  it('works without onVerified or onClose callbacks', async () => {
    const user = userEvent.setup();
    render(<PhoneVerificationModal show />);
    await reachCodeStep(user);
    await user.type(codeBox(), '123456');
    await user.click(verifyButton());
    await waitFor(() => expect(feedback.success).toHaveBeenCalled());
  });
});
