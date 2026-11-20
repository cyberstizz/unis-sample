// src/prelaunch/ComingSoon.test.jsx
//
// The Coming soon page — what the public sees at every app address until
// launch day. It has to do three things well: say when Unis opens (or that it
// is opening soon), let people sign up, and never offer a way into the app.
//
// Covers:
//   • status line and tab title, with and without a launch date
//   • the countdown only appears when a date is set
//   • sign-up: opens the wizard in pre-launch mode, carries a referral code,
//     ?autoSignup, and the "check your inbox" note afterwards
//   • a signed-up visitor sees their handle and Sign out — no way in
//   • there is no login link or button anywhere on the page
//   • Help / Terms / Privacy / waitlist links
//   • the skyline is the same on every load

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./ComingSoon.scss', () => ({}));
vi.mock('./LaunchCountdown', () => ({ default: () => <div data-testid="countdown" /> }));

const { authState, launch } = vi.hoisted(() => ({
  authState: { user: null, logout: vi.fn(), isGuest: true, theme: 'blue' },
  launch: { label: null },
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('./prelaunchConfig', () => ({ getLaunchLabel: () => launch.label }));

vi.mock('../createAccountWizard', () => ({
  default: ({ show, prelaunch, initialReferralCode, onClose, onSuccess }) => (show ? (
    <div data-testid="signup-wizard" data-prelaunch={String(!!prelaunch)} data-code={initialReferralCode}>
      <button onClick={onSuccess}>wizard-success</button>
      <button onClick={onClose}>wizard-close</button>
    </div>
  ) : null),
}));

import ComingSoon, { buildSkyline } from './ComingSoon';

function renderPage(props = {}) {
  const user = userEvent.setup();
  const utils = render(<MemoryRouter><ComingSoon {...props} /></MemoryRouter>);
  return { user, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = null;
  authState.isGuest = true;
  authState.theme = 'blue';
  launch.label = null;
  document.title = 'Unis';
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
describe('ComingSoon — when Unis opens', () => {
  it('with no launch date it says "Opening soon in Harlem" and shows no countdown', () => {
    renderPage();
    expect(document.querySelector('.cs-status')).toHaveTextContent('Opening soon in Harlem');
    expect(screen.queryByTestId('countdown')).not.toBeInTheDocument();
    expect(document.title).toBe('Unis — opening soon in Harlem');
  });

  it('with a launch date it names the day and shows the countdown', () => {
    launch.label = 'December 6th';
    renderPage();
    expect(document.querySelector('.cs-status')).toHaveTextContent('Launching December 6th');
    expect(screen.getByTestId('countdown')).toBeInTheDocument();
    expect(document.title).toBe('Unis — launching December 6th');
  });

  it('puts the tab title back when the page is left', () => {
    const { unmount } = renderPage();
    unmount();
    expect(document.title).toBe('Unis');
  });

  it('says what Unis is', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Harlem decideswhat plays next.');
    expect(screen.getByText(/local artists get heard and the people who live here vote on who’s best/i)).toBeInTheDocument();
  });

  it('shows the current year in the footer', () => {
    renderPage();
    expect(document.querySelector('.cs-foot')).toHaveTextContent(`© ${new Date().getFullYear()} Unis Music Corporation`);
  });
});

// ===========================================================================
describe('ComingSoon — signing up', () => {
  it('offers Sign up, How Unis works and the waitlist to a visitor', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How Unis works' })).toHaveAttribute('href', '/help');
    expect(screen.getByRole('link', { name: 'Not in Harlem? Join the waitlist' })).toHaveAttribute('href', '/waitlist');
  });

  it('Sign up opens the wizard in pre-launch mode', async () => {
    const { user } = renderPage();
    expect(screen.queryByTestId('signup-wizard')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(screen.getByTestId('signup-wizard')).toHaveAttribute('data-prelaunch', 'true');
  });

  it('a /join/CODE link opens the wizard at once with the code filled in', () => {
    renderPage({ autoSignup: true, initialReferralCode: 'HARLEM' });
    expect(screen.getByTestId('signup-wizard')).toHaveAttribute('data-code', 'HARLEM');
  });

  it('after signing up it asks them to verify their email, and removes Sign up', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    await user.click(screen.getByRole('button', { name: 'wizard-success' }));

    expect(screen.queryByTestId('signup-wizard')).not.toBeInTheDocument();
    expect(screen.getByText(/check your inbox and verify your email/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'How Unis works' })).toHaveLength(1);
  });

  it('closing the wizard without finishing leaves Sign up in place', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Sign up' }));
    await user.click(screen.getByRole('button', { name: 'wizard-close' }));
    expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
    expect(screen.queryByText(/check your inbox/i)).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('ComingSoon — someone already signed up', () => {
  beforeEach(() => {
    authState.user = { userId: 'user-1', username: 'maya' };
    authState.isGuest = false;
  });

  it('greets them by handle and says they will be emailed', () => {
    renderPage();
    const note = document.querySelector('.cs-note');
    expect(note).toHaveTextContent('You’re signed up as @maya. We’ll email you when Unis opens.');
    expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /waitlist/i })).not.toBeInTheDocument();
  });

  it('falls back to the display name, then to no name at all', () => {
    authState.user = { userId: 'user-1', displayName: 'Maya J' };
    const { unmount } = renderPage();
    expect(document.querySelector('.cs-note')).toHaveTextContent('as @Maya J');
    unmount();

    authState.user = { userId: 'user-1' };
    renderPage();
    expect(document.querySelector('.cs-note')).toHaveTextContent('You’re signed up. We’ll email you when Unis opens.');
  });

  it('Sign out signs them out', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(authState.logout).toHaveBeenCalledTimes(1);
  });

  it('still links to How Unis works', () => {
    renderPage();
    expect(screen.getAllByRole('link', { name: 'How Unis works' })).toHaveLength(1);
  });
});

// ===========================================================================
describe('ComingSoon — no way into the app', () => {
  it.each([
    ['a visitor', null],
    ['a signed-up listener', { userId: 'user-1', username: 'maya' }],
  ])('offers %s no login link or button', (_label, signedIn) => {
    authState.user = signedIn;
    authState.isGuest = !signedIn;
    renderPage();
    expect(screen.queryByRole('link', { name: /log ?in|sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log ?in|sign in/i })).not.toBeInTheDocument();
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs.every((href) => ['/help', '/terms', '/privacy', '/waitlist'].includes(href))).toBe(true);
  });

  it('links only to pages that are open before launch', () => {
    renderPage();
    const legal = screen.getByRole('navigation', { name: 'Legal' });
    expect(Array.from(legal.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')]))
      .toEqual([['Help', '/help'], ['Terms', '/terms'], ['Privacy', '/privacy']]);
  });
});

// ===========================================================================
describe('ComingSoon — logo', () => {
  it('a visitor always gets the blue logo, even if a theme was left behind', () => {
    authState.theme = 'orange';
    renderPage();
    expect(screen.getByAltText('UNIS').getAttribute('src')).toMatch(/unisLogoThree/);
  });

  it('a signed-in user gets their theme\'s logo', () => {
    authState.user = { userId: 'user-1', username: 'maya' };
    authState.isGuest = false;
    authState.theme = 'orange';
    renderPage();
    expect(screen.getByAltText('UNIS').getAttribute('src')).toMatch(/logo-orange/);
  });

  it('an unknown theme falls back to blue', () => {
    authState.user = { userId: 'user-1' };
    authState.isGuest = false;
    authState.theme = 'puce';
    renderPage();
    expect(screen.getByAltText('UNIS').getAttribute('src')).toMatch(/unisLogoThree/);
  });
});

// ===========================================================================
describe('ComingSoon — skyline', () => {
  it('draws 96 bars, hidden from screen readers', () => {
    renderPage();
    const skyline = document.querySelector('.cs-skyline');
    expect(skyline).toHaveAttribute('aria-hidden', 'true');
    expect(skyline.querySelectorAll('.cs-bar')).toHaveLength(96);
  });

  it('is identical on every load — no flicker between visits', () => {
    expect(buildSkyline()).toEqual(buildSkyline());
  });

  it('keeps every bar between 8% and 100% tall', () => {
    buildSkyline().forEach((bar) => {
      expect(bar.h).toBeGreaterThanOrEqual(0.08);
      expect(bar.h).toBeLessThanOrEqual(1);
      expect(bar.dur).toBeGreaterThanOrEqual(2.4);
      expect(bar.dur).toBeLessThanOrEqual(5);
    });
  });

  it('sweeps left to right', () => {
    const bars = buildSkyline();
    expect(bars[0].rise).toBe(0);
    expect(bars.at(-1).rise).toBe(1.1);
    for (let i = 1; i < bars.length; i += 1) expect(bars[i].rise).toBeGreaterThanOrEqual(bars[i - 1].rise);
  });

  it('draws as many bars as it is asked for', () => {
    expect(buildSkyline(12)).toHaveLength(12);
  });
});
