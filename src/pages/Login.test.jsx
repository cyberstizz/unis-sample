// src/pages/Login.test.jsx
//
// Tests for the login page. Before launch this form is only reachable at the
// secret backstage path; signing in THERE is what grants the backstage pass.
//
// Covers:
//   • the form, its busy state, and what is sent to login()
//   • success → home; a wrong password → the error
//   • backstage pass: granted only when signing in on the backstage path
//   • staff accounts: the two-factor step, completing and cancelling it
//   • waitlisted accounts: the waitlist panel, progress, copy code, back
//   • "Create an account" (and ?signup=1), "Forgot Password?", guest browsing
//
// useAuth, the wizards and the two-factor panel are stubbed.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./Login.scss', () => ({}));
vi.mock('../assets/unisLogoThree.svg', () => ({ default: 'logo.svg' }));
vi.mock('../assets/space-bg.mp4', () => ({ default: 'space.mp4' }));

const { auth, navigateSpy, feedback, backstage } = vi.hoisted(() => ({
  auth: { login: vi.fn(), completeLogin: vi.fn() },
  navigateSpy: vi.fn(),
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  backstage: { isBackstagePath: vi.fn(() => false), grantBackstagePass: vi.fn() },
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navigateSpy,
}));
vi.mock('../prelaunch/prelaunchConfig', () => backstage);

vi.mock('../createAccountWizard', () => ({
  default: ({ show, onClose, onSuccess }) => (show ? (
    <div data-testid="signup-wizard">
      <button onClick={onSuccess}>wizard-success</button>
      <button onClick={onClose}>wizard-close</button>
    </div>
  ) : null),
}));
vi.mock('../forgotPasswordWizard', () => ({
  default: ({ show, onClose }) => (show ? (
    <div data-testid="forgot-wizard"><button onClick={onClose}>forgot-close</button></div>
  ) : null),
}));
vi.mock('../components/AdminTwoFactor', () => ({
  default: ({ mfa, onComplete, onCancel }) => (
    <div data-testid="two-factor" data-setup={String(!!mfa.setupRequired)} data-token={mfa.mfaToken}>
      <button onClick={() => onComplete('session-token')}>2fa-complete</button>
      <button onClick={onCancel}>2fa-cancel</button>
    </div>
  ),
}));

import Login from './Login';

const WAITLIST = {
  waitlist: true,
  username: 'maya',
  metroRegion: 'Atlanta',
  stateName: 'Georgia',
  referralCode: 'MAYA-7Q2',
  regionSignupCount: 30,
  regionThreshold: 120,
};

function renderLogin(path = '/login') {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={[path]}><Login /></MemoryRouter>);
  return { user };
}

const emailBox = () => screen.getByPlaceholderText('Email');
const passwordBox = () => screen.getByPlaceholderText('Password');
const loginButton = () => screen.getByRole('button', { name: /^login$|logging in/i });

async function signIn(user, email = 'charles@example.com', password = 'hunter22') {
  await user.type(emailBox(), email);
  await user.type(passwordBox(), password);
  await user.click(loginButton());
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.login.mockResolvedValue({ success: true, userId: 'user-1' });
  auth.completeLogin.mockResolvedValue({ success: true });
  backstage.isBackstagePath.mockReturnValue(false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===========================================================================
describe('Login — the form', () => {
  it('shows the email and password fields and the three other ways forward', () => {
    renderLogin();
    expect(emailBox()).toBeRequired();
    expect(passwordBox()).toBeRequired();
    expect(passwordBox()).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Forgot Password?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse as a guest' })).toBeInTheDocument();
  });

  it('sends the email and password to login()', async () => {
    const { user } = renderLogin();
    await signIn(user);
    expect(auth.login).toHaveBeenCalledWith({ email: 'charles@example.com', password: 'hunter22' });
  });

  it('does not submit with an empty field', async () => {
    const { user } = renderLogin();
    await user.type(emailBox(), 'charles@example.com');
    await user.click(loginButton());
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('locks the form and says "Logging in…" while signing in', async () => {
    let finish;
    auth.login.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user } = renderLogin();
    await signIn(user);

    expect(loginButton()).toHaveTextContent('Logging in…');
    expect(loginButton()).toBeDisabled();
    expect(emailBox()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeDisabled();

    await act(async () => { finish({ success: false, error: 'Invalid credentials' }); });
    expect(loginButton()).toBeEnabled();
  });
});

// ===========================================================================
describe('Login — success and failure', () => {
  it('goes home after a successful sign-in', async () => {
    const { user } = renderLogin();
    await signIn(user);
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/'));
  });

  it('shows the reason for a failed sign-in and stays put', async () => {
    auth.login.mockResolvedValue({ success: false, error: 'Invalid email or password' });
    const { user } = renderLogin();
    await signIn(user);
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('falls back to "Login failed" when no reason is given', async () => {
    auth.login.mockResolvedValue({ success: false });
    const { user } = renderLogin();
    await signIn(user);
    expect(await screen.findByText('Login failed')).toBeInTheDocument();
  });

  it('a new attempt clears the old error', async () => {
    auth.login.mockResolvedValueOnce({ success: false, error: 'Invalid email or password' });
    const { user } = renderLogin();
    await signIn(user);
    await screen.findByText('Invalid email or password');

    await user.click(loginButton());
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument();
  });

  // Known gap, left for a code fix. When login() answers
  // { data: { unverified: true } }, Login.jsx stores the address in
  // `unverifiedEmail` — but nothing ever renders it. The person presses Login,
  // the button re-enables, and the page shows no message and no way to resend
  // the email. `resendMsg` and `handleResendVerification` exist (they POST
  // /auth/resend-verification) but are not wired to any element.
  it.todo('[BUG] an unverified account should be told to verify, with a Resend button');

  it('an unverified account at least does not get a misleading error or a redirect', async () => {
    auth.login.mockResolvedValue({ success: false, error: 'x', data: { unverified: true, email: 'charles@example.com' } });
    const { user } = renderLogin();
    await signIn(user);
    await waitFor(() => expect(loginButton()).toBeEnabled());
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(document.querySelector('.login-error')).toBeNull();
  });
});

// ===========================================================================
describe('Login — backstage pass', () => {
  it('signing in on the backstage page grants the pass to that account', async () => {
    backstage.isBackstagePath.mockReturnValue(true);
    const { user } = renderLogin();
    await signIn(user);
    await waitFor(() => expect(backstage.grantBackstagePass).toHaveBeenCalledWith('user-1'));
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  it('signing in anywhere else grants no pass', async () => {
    const { user } = renderLogin();
    await signIn(user);
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/'));
    expect(backstage.grantBackstagePass).not.toHaveBeenCalled();
  });

  it('a failed sign-in on the backstage page grants no pass', async () => {
    backstage.isBackstagePath.mockReturnValue(true);
    auth.login.mockResolvedValue({ success: false, error: 'Invalid email or password' });
    const { user } = renderLogin();
    await signIn(user);
    await screen.findByText('Invalid email or password');
    expect(backstage.grantBackstagePass).not.toHaveBeenCalled();
  });
});

// ===========================================================================
describe('Login — staff two-factor', () => {
  beforeEach(() => {
    auth.login.mockResolvedValue({ success: false, mfa: { setupRequired: false, mfaToken: 'mfa-abc' } });
  });

  it('shows the two-factor step in place of the form', async () => {
    const { user } = renderLogin();
    await signIn(user);
    const panel = await screen.findByTestId('two-factor');
    expect(panel).toHaveAttribute('data-token', 'mfa-abc');
    expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('passes on whether the authenticator still has to be set up', async () => {
    auth.login.mockResolvedValue({ success: false, mfa: { setupRequired: true, mfaToken: 'mfa-abc' } });
    const { user } = renderLogin();
    await signIn(user);
    expect(await screen.findByTestId('two-factor')).toHaveAttribute('data-setup', 'true');
  });

  it('finishing the step completes the sign-in and goes home', async () => {
    const { user } = renderLogin();
    await signIn(user);
    await user.click(await screen.findByRole('button', { name: '2fa-complete' }));
    await waitFor(() => expect(auth.completeLogin).toHaveBeenCalledWith('session-token'));
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  it('if completing fails, the form comes back with the reason', async () => {
    auth.completeLogin.mockResolvedValue({ success: false, error: 'Code expired' });
    const { user } = renderLogin();
    await signIn(user);
    await user.click(await screen.findByRole('button', { name: '2fa-complete' }));

    expect(await screen.findByText('Code expired')).toBeInTheDocument();
    expect(screen.queryByTestId('two-factor')).not.toBeInTheDocument();
    expect(emailBox()).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('cancelling returns to the form with the password cleared', async () => {
    const { user } = renderLogin();
    await signIn(user);
    await user.click(await screen.findByRole('button', { name: '2fa-cancel' }));

    expect(screen.queryByTestId('two-factor')).not.toBeInTheDocument();
    expect(passwordBox()).toHaveValue('');
    expect(emailBox()).toHaveValue('charles@example.com');
  });
});

// ===========================================================================
describe('Login — waitlisted accounts', () => {
  beforeEach(() => {
    auth.login.mockResolvedValue({ success: false, error: 'Waitlisted', data: WAITLIST });
  });

  it('shows the waitlist panel instead of an error', async () => {
    const { user } = renderLogin();
    await signIn(user);
    expect(await screen.findByRole('heading', { name: "You're on the waitlist, maya!" })).toBeInTheDocument();
    expect(screen.getByText('Atlanta')).toBeInTheDocument();
    expect(screen.getByText('Georgia')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Email')).not.toBeInTheDocument();
    expect(document.querySelector('.login-error')).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('shows their referral code and how close the region is to opening', async () => {
    const { user } = renderLogin();
    await signIn(user);
    expect(await screen.findByText('MAYA-7Q2')).toBeInTheDocument();
    expect(screen.getByText('30 of 120 signups')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('never shows more than 100%', async () => {
    auth.login.mockResolvedValue({ success: false, data: { ...WAITLIST, regionSignupCount: 500 } });
    const { user } = renderLogin();
    await signIn(user);
    expect(await screen.findByText('100%')).toBeInTheDocument();
  });

  it('copies the referral code and confirms for two seconds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const { user } = renderLogin();
    await signIn(user);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(await screen.findByRole('button', { name: 'Copy Referral Code' }));

    expect(writeText).toHaveBeenCalledWith('MAYA-7Q2');
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy Referral Code' })).toBeInTheDocument(), { timeout: 3000 });
  });

  it('shows the code to copy by hand when the clipboard refuses', async () => {
    const { user } = renderLogin();
    await signIn(user);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true,
    });
    await user.click(await screen.findByRole('button', { name: 'Copy Referral Code' }));
    await waitFor(() => expect(feedback.info).toHaveBeenCalledWith('Copy your code: MAYA-7Q2'));
  });

  it('Back to Login returns to the form', async () => {
    const { user } = renderLogin();
    await signIn(user);
    await user.click(await screen.findByRole('button', { name: 'Back to Login' }));
    expect(emailBox()).toBeInTheDocument();
    expect(screen.queryByText('MAYA-7Q2')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('Login — other ways forward', () => {
  it('Create an account opens the sign-up wizard', async () => {
    const { user } = renderLogin();
    expect(screen.queryByTestId('signup-wizard')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByTestId('signup-wizard')).toBeInTheDocument();
  });

  it('?signup=1 opens the wizard straight away (poster and QR links)', () => {
    renderLogin('/login?signup=1');
    expect(screen.getByTestId('signup-wizard')).toBeInTheDocument();
  });

  it('finishing sign-up goes to the feed', async () => {
    const { user } = renderLogin('/login?signup=1');
    await user.click(screen.getByRole('button', { name: 'wizard-success' }));
    expect(navigateSpy).toHaveBeenCalledWith('/feed');
    expect(screen.queryByTestId('signup-wizard')).not.toBeInTheDocument();
  });

  it('closing the wizard stays on the login page', async () => {
    const { user } = renderLogin('/login?signup=1');
    await user.click(screen.getByRole('button', { name: 'wizard-close' }));
    expect(screen.queryByTestId('signup-wizard')).not.toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('Forgot Password? opens and closes the reset wizard', async () => {
    const { user } = renderLogin();
    await user.click(screen.getByRole('button', { name: 'Forgot Password?' }));
    expect(screen.getByTestId('forgot-wizard')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'forgot-close' }));
    expect(screen.queryByTestId('forgot-wizard')).not.toBeInTheDocument();
  });

  it('Browse as a guest goes home without signing in', async () => {
    const { user } = renderLogin();
    await user.click(screen.getByRole('button', { name: 'Browse as a guest' }));
    expect(navigateSpy).toHaveBeenCalledWith('/');
    expect(auth.login).not.toHaveBeenCalled();
  });
});
