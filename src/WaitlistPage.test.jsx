// src/WaitlistPage.test.jsx
// The visitor sign-up at /waitlist/join (WaitlistPage.jsx): people outside an
// open city create a visitor account (everything but the vote) and count
// toward their city's opening number.
//
// apiCall is mocked by URL; the router, feedback and theme logo are real
// enough to render the standalone page.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('./waitlistPage.scss', () => ({}));
vi.mock('./components/axiosInstance', () => ({ apiCall: vi.fn() }));
const feedback = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('./context/FeedbackContext', () => ({ useFeedback: () => feedback }));
vi.mock('./utils/themeLogo', () => ({ useThemeLogo: () => 'logo.png' }));

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));

import { apiCall } from './components/axiosInstance';
import WaitlistPage from './WaitlistPage';

// ── Fake server ──────────────────────────────────────────────────────────────
let server;
const resetServer = () => {
  server = {
    referral: { 'UNIS-FRIEND': { valid: true, referrerUsername: 'maya' } },
    taken: ['takenname'],
    progress: { signupCount: 42, threshold: 100, progressPercent: 42, readyToActivate: false },
    register: (body) => ({
      data: { referralCode: 'UNIS-NEW01', metroRegion: body.metroRegion, stateCode: body.stateCode, visitorHeld: false },
    }),
  };
  apiCall.mockImplementation(async ({ url, method, data }) => {
    if (url.startsWith('/v1/waitlist/check-referral/')) {
      const code = decodeURIComponent(url.split('/').pop());
      return { data: server.referral[code] || { valid: false } };
    }
    if (url.startsWith('/v1/users/check-username')) {
      const name = new URLSearchParams(url.split('?')[1]).get('username');
      return { data: { available: !server.taken.includes(name.toLowerCase()) } };
    }
    if (url.startsWith('/v1/waitlist/region-progress')) return { data: server.progress };
    if (url === '/v1/waitlist/register' && method === 'post') return server.register(data);
    if (url === '/auth/resend-verification') return { data: {} };
    throw new Error(`unexpected ${method} ${url}`);
  });
};

const calls = (prefix, method) => apiCall.mock.calls
  .map(([c]) => c)
  .filter((c) => c.url.startsWith(prefix) && (!method || c.method === method));

function renderPage(route = '/waitlist/join') {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[route]}>
      <Routes><Route path="/waitlist/join" element={<WaitlistPage />} /></Routes>
    </MemoryRouter>,
  );
  return { user };
}

const field = (label) => screen.getByLabelText(label);
const submit = () => screen.getByRole('button', { name: /create my visitor account|creating your account/i });

async function pickCity(user, state = 'CA', city = 'Los Angeles') {
  await user.selectOptions(field('State'), state);
  await user.selectOptions(field('City'), city);
}

async function fillValid(user, { city = 'Los Angeles', code = 'UNIS-FRIEND', dob = '2000-05-01' } = {}) {
  await pickCity(user, 'CA', city);
  await user.type(field('Email'), 'fan@example.com');
  await user.type(field('Username'), 'newfan');
  await user.type(field('Password'), 'password123');
  await user.type(field('Confirm password'), 'password123');
  if (dob) await user.type(field('Date of birth'), dob);
  if (code) await user.type(field('Referral code'), code);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetServer();
  window.scrollTo = vi.fn();
});

// =============================================================================
describe('WaitlistPage — the page', () => {
  it('pitches visitor accounts and shows the form', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Use Unis from anywhere.');
    expect(screen.getByRole('heading', { name: 'Create your visitor account' })).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it('says what is open now and what waits for the city', () => {
    renderPage();
    expect(screen.getByText('Open to you now')).toBeInTheDocument();
    expect(screen.getByText('Make playlists')).toBeInTheDocument();
    expect(screen.getByText('When your city opens')).toBeInTheDocument();
    expect(screen.getByText('Voting')).toBeInTheDocument();
  });

  it('starts as a Listener and switches to Artist', async () => {
    const { user } = renderPage();
    const listener = screen.getByRole('button', { name: 'Listener' });
    const artist = screen.getByRole('button', { name: 'Artist' });
    expect(listener).toHaveAttribute('aria-pressed', 'true');
    await user.click(artist);
    expect(artist).toHaveAttribute('aria-pressed', 'true');
    expect(listener).toHaveAttribute('aria-pressed', 'false');
  });

  it('links Harlem residents to the resident sign-up', () => {
    renderPage();
    const links = screen.getAllByRole('link', { name: /sign up as a resident/i });
    expect(links[0]).toHaveAttribute('href', '/login?signup=1');
  });

  it('links the Terms and Privacy Policy', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
  });

  it('Back goes to the pitch page', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(navigate).toHaveBeenCalledWith('/waitlist');
  });
});

// =============================================================================
describe('WaitlistPage — state and city', () => {
  it('lists states alphabetically, and the city waits for a state', () => {
    renderPage();
    const names = [...field('State').options].slice(1).map((o) => o.textContent);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toEqual(expect.arrayContaining(['California', 'New York', 'Texas']));
    expect(field('City')).toBeDisabled();
  });

  it('offers the state’s cities plus Other, and resets the city on a new state', async () => {
    const { user } = renderPage();
    await pickCity(user, 'CA', 'Los Angeles');
    const options = [...field('City').options].map((o) => o.textContent);
    expect(options).toContain('Los Angeles');
    expect(options[options.length - 1]).toBe('Other');
    await user.selectOptions(field('State'), 'TX');
    expect(field('City')).toHaveValue('');
  });

  it('asks for the city by name when it is Other', async () => {
    const { user } = renderPage();
    await pickCity(user, 'CA', 'Other');
    expect(field('Your city')).toBeInTheDocument();
    await user.selectOptions(field('City'), 'Los Angeles');
    expect(screen.queryByLabelText('Your city')).not.toBeInTheDocument();
  });

  it('opens with the state, city, code and artist type from the link', async () => {
    renderPage('/waitlist/join?state=ca&metro=Los%20Angeles&ref=unis-friend&type=artist');
    expect(field('State')).toHaveValue('CA');
    expect(field('City')).toHaveValue('Los Angeles');
    expect(field('Referral code')).toHaveValue('UNIS-FRIEND');
    expect(screen.getByRole('button', { name: 'Artist' })).toHaveAttribute('aria-pressed', 'true');
    // the code from the link is checked straight away
    expect(await screen.findByText('maya gets the credit for bringing you.')).toBeInTheDocument();
  });

  it('ignores a city from the link that isn’t in that state', () => {
    renderPage('/waitlist/join?state=CA&metro=Miami');
    expect(field('State')).toHaveValue('CA');
    expect(field('City')).toHaveValue('');
  });

  it('points New York City visitors who live in Harlem to the resident sign-up', async () => {
    const { user } = renderPage();
    await pickCity(user, 'NY', 'New York City');
    expect(screen.getByText('Live in Harlem? Harlem is open.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign up as a Harlem resident' })).toHaveAttribute('href', '/login?signup=1');
  });
});

// =============================================================================
describe('WaitlistPage — city meter', () => {
  it('asks for a city before showing a count', () => {
    renderPage();
    expect(screen.getAllByText('Pick your city to see how close it is to opening.').length).toBeGreaterThan(0);
  });

  it('shows how many more sign-ups the city needs', async () => {
    const { user } = renderPage();
    await pickCity(user);
    expect((await screen.findAllByText('58 more sign-ups and Unis opens in Los Angeles.')).length).toBeGreaterThan(0);
    expect(calls('/v1/waitlist/region-progress')[0].url).toBe('/v1/waitlist/region-progress?state=CA&metro=Los%20Angeles');
    expect(screen.getAllByRole('progressbar', { name: 'Los Angeles sign-ups' })[0]).toHaveAttribute('aria-valuenow', '42');
  });

  it('says when a city has hit its number', async () => {
    server.progress = { signupCount: 100, threshold: 100, progressPercent: 100, readyToActivate: true };
    const { user } = renderPage();
    await pickCity(user);
    expect((await screen.findAllByText('Los Angeles hit its number. It opens soon.')).length).toBeGreaterThan(0);
  });

  it('counts a typed-in city once they pause typing', async () => {
    const { user } = renderPage();
    await pickCity(user, 'CA', 'Other');
    await user.type(field('Your city'), 'Fresno');
    await waitFor(() => expect(calls('/v1/waitlist/region-progress').some((c) => c.url.endsWith('metro=Fresno'))).toBe(true));
  });
});

// =============================================================================
describe('WaitlistPage — checks as you go', () => {
  it('checks the username when you leave the field', async () => {
    const { user } = renderPage();
    await user.type(field('Username'), 'newfan');
    await user.tab();
    expect(await screen.findByText(/^Available\./)).toBeInTheDocument();
  });

  it('says when a username is taken', async () => {
    const { user } = renderPage();
    await user.type(field('Username'), 'takenname');
    await user.tab();
    expect(await screen.findByText('That username is taken. Try another.')).toBeInTheDocument();
    expect(field('Username')).toHaveAttribute('aria-invalid', 'true');
  });

  it('uppercases the referral code and names who gets the credit', async () => {
    const { user } = renderPage();
    await user.type(field('Referral code'), 'unis-friend');
    expect(field('Referral code')).toHaveValue('UNIS-FRIEND');
    await user.tab();
    expect(await screen.findByText('maya gets the credit for bringing you.')).toBeInTheDocument();
  });

  it('flags a code that isn’t valid', async () => {
    const { user } = renderPage();
    await user.type(field('Referral code'), 'NOPE123');
    await user.tab();
    expect(await screen.findByText(/that code isn.t valid/i)).toBeInTheDocument();
    expect(field('Referral code')).toHaveAttribute('aria-invalid', 'true');
  });

  it('doesn’t check codes shorter than 3 characters', async () => {
    const { user } = renderPage();
    await user.type(field('Referral code'), 'AB');
    await user.tab();
    expect(calls('/v1/waitlist/check-referral/')).toHaveLength(0);
  });
});

// =============================================================================
describe('WaitlistPage — what stops a submit', () => {
  it.each([
    ['no state', async () => {}, 'Please pick your state.'],
    ['no city', async (user) => { await user.selectOptions(field('State'), 'CA'); }, 'Please pick your city.'],
    ['Other with no city typed', async (user) => { await pickCity(user, 'CA', 'Other'); }, 'Please type your city.'],
    ['missing email', async (user) => { await pickCity(user); }, 'Email, username and password are required.'],
  ])('%s', async (_label, setup, message) => {
    const { user } = renderPage();
    await setup(user);
    await user.click(submit());
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(calls('/v1/waitlist/register')).toHaveLength(0);
  });

  it('a short password', async () => {
    const { user } = renderPage();
    await fillValid(user);
    await user.clear(field('Password'));
    await user.type(field('Password'), 'short');
    await user.click(submit());
    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters.');
  });

  it('passwords that don’t match', async () => {
    const { user } = renderPage();
    await fillValid(user);
    await user.type(field('Confirm password'), 'x');
    await user.click(submit());
    expect(screen.getByRole('alert')).toHaveTextContent(/passwords don.t match/i);
  });

  it('no date of birth', async () => {
    const { user } = renderPage();
    await fillValid(user, { dob: '' });
    await user.click(submit());
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter your date of birth.');
  });

  it('under 13', async () => {
    const { user } = renderPage();
    const year = new Date().getFullYear() - 10;
    await fillValid(user, { dob: `${year}-01-01` });
    await user.click(submit());
    expect(screen.getByRole('alert')).toHaveTextContent('You need to be 13 or older to join Unis.');
  });

  it('no referral code', async () => {
    const { user } = renderPage();
    await fillValid(user, { code: '' });
    await user.click(submit());
    expect(screen.getByRole('alert')).toHaveTextContent(/a referral code is required/i);
  });

  it('a code already found invalid', async () => {
    const { user } = renderPage();
    await fillValid(user, { code: 'NOPE123' });
    await user.tab();
    await screen.findByText(/that code isn.t valid/i);
    await user.click(submit());
    expect(screen.getByRole('alert')).toHaveTextContent(/that code isn.t valid/i);
    expect(calls('/v1/waitlist/register')).toHaveLength(0);
  });

  it('a username already found taken', async () => {
    const { user } = renderPage();
    await fillValid(user);
    await user.clear(field('Username'));
    await user.type(field('Username'), 'takenname');
    await user.tab();
    await screen.findByText('That username is taken. Try another.');
    await user.click(submit());
    expect(screen.getByRole('alert')).toHaveTextContent('That username is taken. Try another.');
  });

  it('editing a field clears the message', async () => {
    const { user } = renderPage();
    await user.click(submit());
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.selectOptions(field('State'), 'CA');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// =============================================================================
describe('WaitlistPage — creating the account', () => {
  it('sends everything the server needs', async () => {
    const { user } = renderPage();
    await fillValid(user);
    await user.click(submit());
    await waitFor(() => expect(calls('/v1/waitlist/register', 'post')).toHaveLength(1));
    expect(calls('/v1/waitlist/register', 'post')[0].data).toEqual({
      email: 'fan@example.com',
      username: 'newfan',
      password: 'password123',
      dateOfBirth: '2000-05-01',
      userType: 'LISTENER',
      stateCode: 'CA',
      stateName: 'California',
      metroRegion: 'Los Angeles',
      cityFreetext: null,
      referredByCode: 'UNIS-FRIEND',
    });
  });

  it('sends a typed city for Other, and the artist type', async () => {
    const { user } = renderPage();
    await user.click(screen.getByRole('button', { name: 'Artist' }));
    await fillValid(user, { city: 'Other' });
    await user.type(field('Your city'), '  Fresno ');
    await user.click(submit());
    await waitFor(() => expect(calls('/v1/waitlist/register', 'post')).toHaveLength(1));
    const body = calls('/v1/waitlist/register', 'post')[0].data;
    expect(body.metroRegion).toBe('Other');
    expect(body.cityFreetext).toBe('Fresno');
    expect(body.userType).toBe('ARTIST');
  });

  it('shows a busy button while it works', async () => {
    let finish;
    server.register = () => new Promise((r) => { finish = r; });
    const { user } = renderPage();
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByRole('button', { name: 'Creating your account…' })).toBeDisabled();
    finish({ data: { referralCode: 'X', metroRegion: 'Los Angeles', stateCode: 'CA' } });
    await screen.findByText('Visitor account ready');
  });

  it('shows the server’s reason when it fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.register = () => Promise.reject({ response: { status: 409, data: { error: 'That email is already on Unis.' } } });
    const { user } = renderPage();
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('That email is already on Unis.');
  });

  it('falls back to a general message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.register = () => Promise.reject(new Error('down'));
    const { user } = renderPage();
    await fillValid(user);
    await user.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t create your account/i);
  });
});

// =============================================================================
describe('WaitlistPage — after sign-up', () => {
  async function signUp(extra = {}) {
    server.register = (body) => ({
      data: { referralCode: 'UNIS-NEW01', metroRegion: body.metroRegion, stateCode: body.stateCode, ...extra },
    });
    const view = renderPage();
    await fillValid(view.user);
    await view.user.click(submit());
    await screen.findByText(/your referral code/i);
    return view;
  }

  it('welcomes them in, with their code and how to confirm the email', async () => {
    await signUp();
    expect(screen.getByText('Visitor account ready')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('You’re in, Los Angeles.');
    expect(screen.getByText('UNIS-NEW01')).toBeInTheDocument();
    expect(screen.getByText('We sent a link to fan@example.com')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to Unis' })).toHaveAttribute('href', '/login');
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();
    expect(feedback.success).toHaveBeenCalledWith('Your visitor account is ready');
  });

  it('a held sign-up says the spot is held and offers no sign-in yet', async () => {
    await signUp({ visitorHeld: true });
    expect(screen.getByText('Your spot is held')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('You’re on the list, Los Angeles.');
    expect(screen.queryByRole('link', { name: 'Sign in to Unis' })).not.toBeInTheDocument();
    expect(feedback.success).toHaveBeenCalledWith('You’re on the list');
  });

  it('copies the code', async () => {
    const { user } = await signUp();
    // after userEvent.setup(), which installs its own clipboard
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('UNIS-NEW01');
    expect(feedback.success).toHaveBeenCalledWith('Copied UNIS-NEW01');
  });

  it('shows the code to copy by hand when the clipboard refuses', async () => {
    const { user } = await signUp();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(feedback.info).toHaveBeenCalledWith('Your code: UNIS-NEW01'));
  });

  it('shares a link with the code', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const { user } = await signUp();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({
      url: `${window.location.origin}/waitlist?ref=UNIS-NEW01`,
    }));
    delete navigator.share;
  });

  it('resends the confirmation email', async () => {
    const { user } = await signUp();
    await user.click(screen.getByRole('button', { name: 'Resend' }));
    await waitFor(() => expect(calls('/auth/resend-verification', 'post')[0].data).toEqual({ email: 'fan@example.com' }));
    expect(feedback.success).toHaveBeenCalledWith('Sent. Check your inbox and spam folder.');
  });

  it('counts the city again, fresh, now that they are in it', async () => {
    await signUp();
    await waitFor(() => expect(calls('/v1/waitlist/region-progress').some((c) => c.useCache === false)).toBe(true));
  });
});
