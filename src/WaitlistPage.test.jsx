// src/WaitlistPage.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import * as axiosModule from './components/axiosInstance';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------

vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

import WaitlistPage from './WaitlistPage';

const API = 'http://localhost:8080/api';

// ---------------------------------------------------------------------------
// Selectors — the page has TWO state inputs now (datalist input + select).
// Tests should drive the <select> (more deterministic). The state <select>
// is always the first <select> on the page; the metro <select> appears
// after a state is selected and is the second <select>.
// ---------------------------------------------------------------------------
function getStateSelect() {
  const selects = document.querySelectorAll('select');
  return selects[0];
}
function getMetroSelect() {
  const selects = document.querySelectorAll('select');
  return selects[1];
}

// ---------------------------------------------------------------------------
// apiCall logger
// ---------------------------------------------------------------------------
let apiCallLog = [];

function setupApiCallLog() {
  apiCallLog = [];
  const originalApiCall = axiosModule.apiCall;
  vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    apiCallLog.push({ ...config });
    return originalApiCall(config);
  });
}

function callsMatching(urlMatcher, method) {
  return apiCallLog.filter(c => {
    const methodMatch = method ? (c.method || 'get').toLowerCase() === method.toLowerCase() : true;
    const urlMatch = typeof urlMatcher === 'string' ? c.url === urlMatcher : urlMatcher.test(c.url);
    return methodMatch && urlMatch;
  });
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  server.use(
    http.post(`${API}/v1/waitlist/register`, async ({ request }) => {
      const body = await request.json();
      return HttpResponse.json({
        referralCode: 'UNIS-TEST01',
        metroRegion: body.metroRegion,
        stateName: body.stateName,
        regionSignupCount: 5,
        regionThreshold: 100,
        regionProgressPercent: 5,
      });
    }),
    http.get(`${API}/v1/waitlist/check-referral/:code`, ({ params }) => {
      if (params.code === 'UNIS-VALID1') return HttpResponse.json({ valid: true });
      return HttpResponse.json({ valid: false });
    }),
    // FIX #10: Live region stats endpoint
    http.get(`${API}/v1/waitlist/region-stats`, ({ request }) => {
      const url = new URL(request.url);
      return HttpResponse.json({
        signupCount: 42,
        threshold: 100,
        progressPercent: 42,
        stateCode: url.searchParams.get('stateCode'),
        metroRegion: url.searchParams.get('metroRegion'),
      });
    })
  );
  setupApiCallLog();

  // Default stubs for clipboard + share APIs used by fixes #2 and #3
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.resolve()) },
      configurable: true,
    });
  } else {
    navigator.clipboard.writeText = vi.fn(() => Promise.resolve());
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper to fill valid form fields quickly
// ---------------------------------------------------------------------------
async function fillValidForm(user) {
  await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'test@example.com');
  await user.type(screen.getByPlaceholderText(/Choose a username/i), 'testuser');
  await user.type(screen.getByPlaceholderText(/Min 8 characters/i), 'password123');
  await user.type(screen.getByPlaceholderText(/Re-enter password/i), 'password123');

  await user.selectOptions(getStateSelect(), 'CA');

  await waitFor(() => {
    expect(document.querySelectorAll('select').length).toBe(2);
  });

  await user.selectOptions(getMetroSelect(), 'Los Angeles');
}

// ===========================================================================
// TESTS
// ===========================================================================

describe('WaitlistPage — initial render', () => {
  it('renders the page title and subtitle', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(screen.getByRole('heading', { name: /Join the Unis Waitlist/i })).toBeInTheDocument();
    expect(screen.getByText(/Unis isn't in your area yet/i)).toBeInTheDocument();
  });

  it('renders the user type toggle with LISTENER selected by default', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    const listenerBtn = screen.getByRole('button', { name: /^Listener$/i });
    const artistBtn = screen.getByRole('button', { name: /^Artist$/i });
    expect(listenerBtn).toHaveStyle({ fontWeight: '600' });
    expect(artistBtn).toHaveStyle({ fontWeight: '400' });
  });

  it('renders all required form fields', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(screen.getByPlaceholderText(/your@email\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Choose a username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Min 8 characters/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Re-enter password/i)).toBeInTheDocument();
  });

  it('renders optional display name field', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(screen.getByPlaceholderText(/Your display name/i)).toBeInTheDocument();
  });

  it('renders state dropdown as the first <select> on the page', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(getStateSelect()).toBeInTheDocument();
    expect(document.querySelectorAll('select').length).toBe(1);
  });

  it('does NOT render metro dropdown until a state is selected', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(screen.queryByText(/Metro \/ Region/i)).not.toBeInTheDocument();
  });

  it('renders referral code field as optional', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(screen.getByPlaceholderText(/UNIS-XXXXXX/i)).toBeInTheDocument();
  });

  it('renders the submit button labeled "Join the Waitlist"', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(screen.getByRole('button', { name: /Join the Waitlist/i })).toBeInTheDocument();
  });

  it('renders the Terms of Service and Privacy Policy disclaimer', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(screen.getByText(/By joining, you agree to Unis/i)).toBeInTheDocument();
  });
});

describe('WaitlistPage — user type toggle', () => {
  it('switches from LISTENER to ARTIST when Artist button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.click(screen.getByRole('button', { name: /^Artist$/i }));

    expect(screen.getByRole('button', { name: /^Artist$/i })).toHaveStyle({ fontWeight: '600' });
    expect(screen.getByRole('button', { name: /^Listener$/i })).toHaveStyle({ fontWeight: '400' });
  });

  it('changes display name placeholder to "Your artist name" when ARTIST selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.click(screen.getByRole('button', { name: /^Artist$/i }));

    expect(screen.getByPlaceholderText(/Your artist name/i)).toBeInTheDocument();
  });

  it('switches back to LISTENER correctly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.click(screen.getByRole('button', { name: /^Artist$/i }));
    await user.click(screen.getByRole('button', { name: /^Listener$/i }));

    expect(screen.getByPlaceholderText(/Your display name/i)).toBeInTheDocument();
  });
});

describe('WaitlistPage — state / metro cascading dropdowns', () => {
  it('shows metro dropdown once a state is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');

    await waitFor(() => {
      expect(document.querySelectorAll('select').length).toBe(2);
    });
    expect(screen.getByText(/Metro \/ Region/i)).toBeInTheDocument();
  });

  it("shows California's metros (LA, SF Bay Area, etc.)", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Los Angeles' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'San Francisco Bay Area' })).toBeInTheDocument();
    });
  });

  it('includes "Other" as the last metro option', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Other' })).toBeInTheDocument();
    });
  });

  it('resets metro when state changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Los Angeles');
    expect(getMetroSelect()).toHaveValue('Los Angeles');

    await user.selectOptions(getStateSelect(), 'NY');
    await waitFor(() => {
      expect(getMetroSelect()).toHaveValue('');
    });
  });

  it('shows freetext city input when metro is "Other"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Other');

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Shreveport, Bakersfield/i)).toBeInTheDocument();
    });
  });

  it('hides freetext city input when metro is NOT "Other"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Los Angeles');

    expect(screen.queryByPlaceholderText(/Shreveport, Bakersfield/i)).not.toBeInTheDocument();
  });

  it('clears freetext city when switching FROM Other to a regular metro', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Other');

    const cityInput = await screen.findByPlaceholderText(/Shreveport, Bakersfield/i);
    await user.type(cityInput, 'Fresno-adjacent');

    await user.selectOptions(getMetroSelect(), 'Los Angeles');

    expect(screen.queryByPlaceholderText(/Shreveport, Bakersfield/i)).not.toBeInTheDocument();
  });
});

describe('WaitlistPage — client-side validation', () => {
  it('shows error when submitting with empty required fields', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    expect(screen.getByText(/Email, username, and password are required/i)).toBeInTheDocument();
  });

  it('shows error when password is shorter than 8 characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'test@example.com');
    await user.type(screen.getByPlaceholderText(/Choose a username/i), 'testuser');
    await user.type(screen.getByPlaceholderText(/Min 8 characters/i), 'short');
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'test@example.com');
    await user.type(screen.getByPlaceholderText(/Choose a username/i), 'testuser');
    await user.type(screen.getByPlaceholderText(/Min 8 characters/i), 'password123');
    await user.type(screen.getByPlaceholderText(/Re-enter password/i), 'different123');
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
  });

  it('shows error when state is not selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'test@example.com');
    await user.type(screen.getByPlaceholderText(/Choose a username/i), 'testuser');
    await user.type(screen.getByPlaceholderText(/Min 8 characters/i), 'password123');
    await user.type(screen.getByPlaceholderText(/Re-enter password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    expect(screen.getByText(/Please select your state/i)).toBeInTheDocument();
  });

  it('shows error when metro is not selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'test@example.com');
    await user.type(screen.getByPlaceholderText(/Choose a username/i), 'testuser');
    await user.type(screen.getByPlaceholderText(/Min 8 characters/i), 'password123');
    await user.type(screen.getByPlaceholderText(/Re-enter password/i), 'password123');

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));

    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    expect(screen.getByText(/Please select your metro area/i)).toBeInTheDocument();
  });

  it('shows error when metro is "Other" but no city name entered', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'test@example.com');
    await user.type(screen.getByPlaceholderText(/Choose a username/i), 'testuser');
    await user.type(screen.getByPlaceholderText(/Min 8 characters/i), 'password123');
    await user.type(screen.getByPlaceholderText(/Re-enter password/i), 'password123');

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Other');

    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    expect(screen.getByText(/Please enter your city or area name/i)).toBeInTheDocument();
  });

  it('clears error when user starts editing a field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));
    expect(screen.getByText(/Email, username, and password are required/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'a');

    expect(screen.queryByText(/Email, username, and password are required/i)).not.toBeInTheDocument();
  });
});

describe('WaitlistPage — referral code validation', () => {
  it('auto-uppercases the referral code as user types', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    const refInput = screen.getByPlaceholderText(/UNIS-XXXXXX/i);
    await user.type(refInput, 'unis-abc123');

    expect(refInput).toHaveValue('UNIS-ABC123');
  });

  it('checks referral validity on blur (code length >= 5)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    const refInput = screen.getByPlaceholderText(/UNIS-XXXXXX/i);
    await user.type(refInput, 'UNIS-VALID1');
    fireEvent.blur(refInput);

    await waitFor(() => {
      const checks = callsMatching(/\/waitlist\/check-referral\//);
      expect(checks.length).toBe(1);
      expect(checks[0].url).toContain('UNIS-VALID1');
    });
  });

  it('does NOT fire check when code is shorter than 5 chars', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    const refInput = screen.getByPlaceholderText(/UNIS-XXXXXX/i);
    await user.type(refInput, 'UNIS');
    fireEvent.blur(refInput);

    await new Promise(r => setTimeout(r, 100));
    const checks = callsMatching(/\/waitlist\/check-referral\//);
    expect(checks.length).toBe(0);
  });

  it('shows valid checkmark when referral is valid', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<WaitlistPage />, { as: 'guest' });

    const refInput = screen.getByPlaceholderText(/UNIS-XXXXXX/i);
    await user.type(refInput, 'UNIS-VALID1');
    fireEvent.blur(refInput);

    await waitFor(() => {
      const svgs = container.querySelectorAll('svg circle[stroke="#22c55e"]');
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  it('shows red X when referral is invalid', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<WaitlistPage />, { as: 'guest' });

    const refInput = screen.getByPlaceholderText(/UNIS-XXXXXX/i);
    await user.type(refInput, 'UNIS-WRONG1');
    fireEvent.blur(refInput);

    await waitFor(() => {
      const svgs = container.querySelectorAll('svg circle[stroke="#ef4444"]');
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  it('silently ignores referral check errors (no crash)', async () => {
    server.use(
      http.get(`${API}/v1/waitlist/check-referral/:code`, () =>
        new HttpResponse(null, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    const refInput = screen.getByPlaceholderText(/UNIS-XXXXXX/i);
    await user.type(refInput, 'UNIS-BROKEN');
    fireEvent.blur(refInput);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Join the Waitlist/i })).toBeInTheDocument();
    });
  });
});

describe('WaitlistPage — submit flow', () => {
  it('posts full payload to /v1/waitlist/register on successful submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(callsMatching('/v1/waitlist/register', 'post').length).toBe(1);
    });

    const payload = callsMatching('/v1/waitlist/register', 'post')[0].data;
    expect(payload).toMatchObject({
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      userType: 'LISTENER',
      stateCode: 'CA',
      stateName: 'California',
      metroRegion: 'Los Angeles',
    });
  });

  it('uses username as displayName when no displayName is provided', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      const payload = callsMatching('/v1/waitlist/register', 'post')[0].data;
      expect(payload.displayName).toBe('testuser');
    });
  });

  it('uses provided displayName over username when given', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.type(screen.getByPlaceholderText(/Your display name/i), 'Charles L.');
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      const payload = callsMatching('/v1/waitlist/register', 'post')[0].data;
      expect(payload.displayName).toBe('Charles L.');
    });
  });

  it('sends userType=ARTIST when Artist is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.click(screen.getByRole('button', { name: /^Artist$/i }));
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      const payload = callsMatching('/v1/waitlist/register', 'post')[0].data;
      expect(payload.userType).toBe('ARTIST');
    });
  });

  it('sends cityFreetext when metro is "Other"', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.type(screen.getByPlaceholderText(/your@email\.com/i), 'test@example.com');
    await user.type(screen.getByPlaceholderText(/Choose a username/i), 'testuser');
    await user.type(screen.getByPlaceholderText(/Min 8 characters/i), 'password123');
    await user.type(screen.getByPlaceholderText(/Re-enter password/i), 'password123');

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Other');

    await user.type(screen.getByPlaceholderText(/Shreveport, Bakersfield/i), 'Bakersfield');
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      const payload = callsMatching('/v1/waitlist/register', 'post')[0].data;
      expect(payload.cityFreetext).toBe('Bakersfield');
      expect(payload.metroRegion).toBe('Other');
    });
  });

  it('sends null for cityFreetext when not "Other" metro', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      const payload = callsMatching('/v1/waitlist/register', 'post')[0].data;
      expect(payload.cityFreetext).toBeNull();
    });
  });

  it('sends referredByCode when provided', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.type(screen.getByPlaceholderText(/UNIS-XXXXXX/i), 'UNIS-VALID1');
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      const payload = callsMatching('/v1/waitlist/register', 'post')[0].data;
      expect(payload.referredByCode).toBe('UNIS-VALID1');
    });
  });

  it('sends null referredByCode when omitted', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      const payload = callsMatching('/v1/waitlist/register', 'post')[0].data;
      expect(payload.referredByCode).toBeNull();
    });
  });

  it('shows "Joining..." loading text during submission', async () => {
    server.use(
      http.post(`${API}/v1/waitlist/register`, async () => {
        await new Promise(r => setTimeout(r, 200));
        return HttpResponse.json({
          referralCode: 'UNIS-TEST01', metroRegion: 'Los Angeles', stateName: 'California',
          regionSignupCount: 5, regionThreshold: 100, regionProgressPercent: 5,
        });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Joining\.\.\./i })).toBeInTheDocument();
    });
  });

  it('disables submit button during submission', async () => {
    server.use(
      http.post(`${API}/v1/waitlist/register`, async () => {
        await new Promise(r => setTimeout(r, 200));
        return HttpResponse.json({
          referralCode: 'UNIS-TEST01', metroRegion: 'LA', stateName: 'CA',
          regionSignupCount: 1, regionThreshold: 100, regionProgressPercent: 1,
        });
      })
    );

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Joining\.\.\./i })).toBeDisabled();
    });
  });

  it('surfaces server error message from error.response.data.error', async () => {
    server.use(
      http.post(`${API}/v1/waitlist/register`, () =>
        HttpResponse.json({ error: 'Email already registered' }, { status: 409 })
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/Email already registered/i)).toBeInTheDocument();
    });
  });

  it('shows generic error when server returns no specific message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.post(`${API}/v1/waitlist/register`, () =>
        new HttpResponse(null, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/Registration failed\. Please try again/i)).toBeInTheDocument();
    });
  });
});

describe('WaitlistPage — success screen', () => {
  it('transitions to success screen after successful registration', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/You're on the waitlist!/i)).toBeInTheDocument();
    });
  });

  it('displays the user\'s referral code prominently', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText('UNIS-TEST01')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Your Referral Code/i).length).toBeGreaterThan(0);
  });

  it('displays the region metro and state names', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/Unis is coming to/i)).toBeInTheDocument();
    });
    expect(screen.getAllByText('Los Angeles').length).toBeGreaterThan(0);
    expect(screen.getAllByText('California').length).toBeGreaterThan(0);
  });

  it('displays the progress bar with signup count and percentage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/5 of 100 signups/i)).toBeInTheDocument();
      expect(screen.getByText('5%')).toBeInTheDocument();
    });
  });

  it('displays activation threshold explanation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/it will be activated/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/voting, earning, and discovering music/i)).toBeInTheDocument();
  });

  it('does NOT render the form fields on the success screen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/You're on the waitlist!/i)).toBeInTheDocument();
    });

    expect(screen.queryByPlaceholderText(/your@email\.com/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Choose a username/i)).not.toBeInTheDocument();
  });
});

describe('WaitlistPage — state list ordering', () => {
  it('sorts states alphabetically in the dropdown', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    const stateSelect = getStateSelect();
    const options = Array.from(stateSelect.options)
      .slice(1) // skip the placeholder
      .map(o => o.text);

    const sorted = [...options].sort();
    expect(options).toEqual(sorted);
  });

  it('includes major states (CA, NY, FL)', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(screen.getAllByRole('option', { name: 'California' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'New York' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option', { name: 'Florida' }).length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// NEW TESTS — UX FIXES #1 through #10
// ===========================================================================

describe('WaitlistPage — UX Fix #1: scroll-to-error on submit failure', () => {
  it('error banner has role="alert" for accessibility + screen readers', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/Email, username, and password are required/i);
  });

  it('error banner appears ABOVE the form card (top-of-form), not below submit', async () => {
    const user = userEvent.setup();
    const { container } = renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    const alert = container.querySelector('[role="alert"]');
    const formCard = container.querySelector('[style*="background: rgb(17, 17, 20)"]');
    expect(alert).toBeInTheDocument();
    // Alert comes before the form card in document order
    if (alert && formCard) {
      const relation = alert.compareDocumentPosition(formCard);
      expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});

describe('WaitlistPage — UX Fix #2: copy referral code button', () => {
  it('renders a Copy Code button on the success screen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copy referral code/i })).toBeInTheDocument();
    });
  });

  it('copies the referral code to clipboard when clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => expect(screen.getByText('UNIS-TEST01')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Copy referral code/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('UNIS-TEST01');
  });

  it('shows "Copied!" feedback for 2 seconds after copy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => expect(screen.getByText('UNIS-TEST01')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Copy referral code/i }));

    await waitFor(() => {
      expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('handles clipboard API failure gracefully (no crash)', async () => {
    navigator.clipboard.writeText = vi.fn(() => Promise.reject(new Error('denied')));

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => expect(screen.getByText('UNIS-TEST01')).toBeInTheDocument());

    // Should not throw
    await user.click(screen.getByRole('button', { name: /Copy referral code/i }));

    // The button is still visible and the page didn't crash
    expect(screen.getByRole('button', { name: /Copy referral code/i })).toBeInTheDocument();
  });
});

describe('WaitlistPage — UX Fix #3: share button', () => {
  it('renders a Share button on the success screen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Share referral code/i })).toBeInTheDocument();
    });
  });

  it('calls navigator.share with the referral URL when available', async () => {
    const shareMock = vi.fn(() => Promise.resolve());
    navigator.share = shareMock;

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => expect(screen.getByText('UNIS-TEST01')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Share referral code/i }));

    expect(shareMock).toHaveBeenCalled();
    const shareArg = shareMock.mock.calls[0][0];
    expect(shareArg.text).toContain('UNIS-TEST01');
    expect(shareArg.url).toContain('ref=UNIS-TEST01');

    delete navigator.share;
  });

  it('falls back to copy when navigator.share is not available', async () => {
    // Ensure navigator.share is undefined
    delete navigator.share;

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => expect(screen.getByText('UNIS-TEST01')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Share referral code/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('UNIS-TEST01');
  });

  it('silently handles user cancelling the native share', async () => {
    navigator.share = vi.fn(() => Promise.reject(new Error('AbortError')));

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => expect(screen.getByText('UNIS-TEST01')).toBeInTheDocument());

    // Should not throw
    await user.click(screen.getByRole('button', { name: /Share referral code/i }));

    expect(screen.getByRole('button', { name: /Share referral code/i })).toBeInTheDocument();

    delete navigator.share;
  });
});

describe('WaitlistPage — UX Fix #4: motivating "N more to unlock" copy', () => {
  it('shows "N more to unlock!" on the success screen instead of neutral count', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    // server returns 5 of 100 → remaining = 95
    await waitFor(() => {
      expect(screen.getByText(/95 more to unlock/i)).toBeInTheDocument();
    });
  });

  it('shows "Region activated — you\'re in!" when threshold is met', async () => {
    server.use(
      http.post(`${API}/v1/waitlist/register`, () =>
        HttpResponse.json({
          referralCode: 'UNIS-FULL01',
          metroRegion: 'Los Angeles',
          stateName: 'California',
          regionSignupCount: 100,
          regionThreshold: 100,
          regionProgressPercent: 100,
        })
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/Region activated/i)).toBeInTheDocument();
    });
  });
});

describe('WaitlistPage — UX Fix #5: referral code benefit explanation', () => {
  it('shows helper text explaining referral benefit when field is empty', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(screen.getByText(/Got a code from a friend/i)).toBeInTheDocument();
    expect(screen.getByText(/you both benefit when your regions activate/i)).toBeInTheDocument();
  });

  it('shows success message after valid referral is entered', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    const refInput = screen.getByPlaceholderText(/UNIS-XXXXXX/i);
    await user.type(refInput, 'UNIS-VALID1');
    fireEvent.blur(refInput);

    await waitFor(() => {
      expect(screen.getByText(/you'll help boost their region too/i)).toBeInTheDocument();
    });
  });
});

describe('WaitlistPage — UX Fix #6: clickable TOS + Privacy links', () => {
  it('renders Terms of Service as a clickable link to /terms', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    const tosLink = screen.getByRole('link', { name: /Terms of Service/i });
    expect(tosLink).toHaveAttribute('href', '/terms');
  });

  it('renders Privacy Policy as a clickable link to /privacy', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });
    expect(privacyLink).toHaveAttribute('href', '/privacy');
  });

  it('opens both links in a new tab with rel="noopener noreferrer"', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    const tosLink = screen.getByRole('link', { name: /Terms of Service/i });
    const privacyLink = screen.getByRole('link', { name: /Privacy Policy/i });

    expect(tosLink).toHaveAttribute('target', '_blank');
    expect(tosLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(privacyLink).toHaveAttribute('target', '_blank');
    expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('WaitlistPage — UX Fix #7: "what happens next" email confirmation copy', () => {
  it('shows "we\'ll email you the moment your region activates" on success', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/email you the moment your region activates/i)).toBeInTheDocument();
    });
  });

  it('reassures about no spam / no forwarding', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Join the Waitlist/i }));

    await waitFor(() => {
      expect(screen.getByText(/No spam, no forwarding/i)).toBeInTheDocument();
    });
  });
});

describe('WaitlistPage — UX Fix #8: display name context helper', () => {
  it('shows helper text explaining where display name appears', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(
      screen.getByText(/Shown on votes, comments, and your public profile/i)
    ).toBeInTheDocument();
  });

  it('mentions defaulting to username', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(screen.getByText(/Defaults to your username/i)).toBeInTheDocument();
  });
});

describe('WaitlistPage — UX Fix #9: state dropdown with typeahead', () => {
  it('renders a typeahead input with datalist linked to state list', () => {
    const { container } = renderWithProviders(<WaitlistPage />, { as: 'guest' });
    const input = container.querySelector('input[list="state-list"]');
    expect(input).toBeInTheDocument();
  });

  it('renders a datalist with one option per state', () => {
    const { container } = renderWithProviders(<WaitlistPage />, { as: 'guest' });
    const datalist = container.querySelector('datalist#state-list');
    expect(datalist).toBeInTheDocument();
    // 50+ states in the list
    expect(datalist.querySelectorAll('option').length).toBeGreaterThan(40);
  });

  it('sets stateCode when user types a matching state name', async () => {
    const { container } = renderWithProviders(<WaitlistPage />, { as: 'guest' });

    const typeahead = container.querySelector('input[list="state-list"]');
    // Use fireEvent.change to set the final value atomically (jsdom doesn't
    // replay the full per-character typeahead matching that real browsers do).
    fireEvent.change(typeahead, { target: { value: 'California' } });

    await waitFor(() => {
      expect(getStateSelect()).toHaveValue('CA');
    });
  });

  it('also exposes the traditional <select> as a fallback', () => {
    renderWithProviders(<WaitlistPage />, { as: 'guest' });
    expect(getStateSelect()).toBeInTheDocument();
    expect(getStateSelect().tagName).toBe('SELECT');
  });
});

describe('WaitlistPage — UX Fix #10: live region stats before submit', () => {
  it('fetches /v1/waitlist/region-stats when state + metro are both selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Los Angeles');

    await waitFor(() => {
      const statsCalls = callsMatching(/\/waitlist\/region-stats/);
      expect(statsCalls.length).toBeGreaterThanOrEqual(1);
      expect(statsCalls[0].url).toContain('stateCode=CA');
      expect(statsCalls[0].url).toContain('metroRegion=');
    });
  });

  it('does NOT fetch stats when only state is selected (no metro yet)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');

    await new Promise(r => setTimeout(r, 150));
    expect(callsMatching(/\/waitlist\/region-stats/).length).toBe(0);
  });

  it('displays "N people already waiting" copy when stats return', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Los Angeles');

    await waitFor(() => {
      expect(screen.getByText(/42 people already waiting/i)).toBeInTheDocument();
    });
  });

  it('shows "58 more to unlock" as a strong motivator', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Los Angeles');

    await waitFor(() => {
      expect(screen.getByText(/58 more to unlock/i)).toBeInTheDocument();
    });
  });

  it('shows "You\'ll be the first from <metro>!" when count is 0', async () => {
    server.use(
      http.get(`${API}/v1/waitlist/region-stats`, () =>
        HttpResponse.json({ signupCount: 0, threshold: 100, progressPercent: 0 })
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Los Angeles');

    await waitFor(() => {
      expect(screen.getByText(/You'll be the first from Los Angeles/i)).toBeInTheDocument();
    });
  });

  it('silently handles region stats endpoint errors', async () => {
    server.use(
      http.get(`${API}/v1/waitlist/region-stats`, () =>
        new HttpResponse(null, { status: 500 })
      )
    );

    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Los Angeles');

    // Should not crash — page still renders submit button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Join the Waitlist/i })).toBeInTheDocument();
    });
  });

  it('refetches stats when metro changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WaitlistPage />, { as: 'guest' });

    await user.selectOptions(getStateSelect(), 'CA');
    await waitFor(() => expect(document.querySelectorAll('select').length).toBe(2));
    await user.selectOptions(getMetroSelect(), 'Los Angeles');

    await waitFor(() => {
      expect(callsMatching(/\/waitlist\/region-stats/).length).toBeGreaterThanOrEqual(1);
    });
    const firstCount = callsMatching(/\/waitlist\/region-stats/).length;

    await user.selectOptions(getMetroSelect(), 'San Diego');

    await waitFor(() => {
      expect(callsMatching(/\/waitlist\/region-stats/).length).toBeGreaterThan(firstCount);
    });
  });
});