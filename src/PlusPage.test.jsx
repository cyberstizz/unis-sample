// src/PlusPage.test.jsx
//
// Tests for the Unis Plus page (/plus) — the paid, ad-free plan.
//
// The split shown here is the one promised to members and artists (final,
// Nov 13 2026): the supported artist gets half the $4.99 first, whatever was
// played; of the rest after Stripe's fees, half goes to the artists played
// and half to the Community Share. plusSplit mirrors CommunityShareService on
// the backend — if a number here has to change, the backend changes with it.
//
// Covers:
//   • plusSplit: the documented $4.99 breakdown, and that every cent is
//     accounted for at any price
//   • the three states of the plan card: not on sale, on sale, member
//     (renewing, canceled, payment failed)
//   • checkout and Manage plan: the request, the busy state, and the rule
//     that the browser is only ever sent to a real Stripe address
//   • returning from checkout: canceled, success, and waiting for Plus to
//     switch on
//   • the supported artist: hero, chip, "credited so far", and the picker for
//     someone who supports nobody yet
//   • the "Where your $4.99 goes" table

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as axiosModule from './components/axiosInstance';

vi.mock('./plusPage.scss', () => ({}));
vi.mock('./layout', () => ({ default: ({ children }) => <div data-testid="layout">{children}</div> }));
vi.mock('./components/PlusMark', () => ({ default: () => <span data-testid="plus-mark" /> }));
vi.mock('./SupportedArtistPicker', () => ({
  default: ({ show, onSuccess, onClose, currentArtistId, userId }) => (show ? (
    <div data-testid="picker" data-user={userId} data-current={String(currentArtistId)}>
      <button onClick={onSuccess}>picker-success</button>
      <button onClick={onClose}>picker-close</button>
    </div>
  ) : null),
}));

const { authState, feedback, plus } = vi.hoisted(() => ({
  authState: { user: null, refreshUser: vi.fn() },
  feedback: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  plus: { refreshPlusStatus: vi.fn() },
}));
vi.mock('./context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('./context/FeedbackContext', async (importOriginal) => ({
  ...(await importOriginal()),
  useFeedback: () => feedback,
}));
vi.mock('./utils/plusStatus', async (importOriginal) => ({
  ...(await importOriginal()),
  refreshPlusStatus: plus.refreshPlusStatus,
}));

import PlusPage, { plusSplit } from './PlusPage';

// ---------------------------------------------------------------------------
const ON_SALE = { available: true, priceCents: 499, plus: false, status: null };
const MEMBER = {
  available: true, priceCents: 499, plus: true, status: 'active',
  paidThrough: '2026-12-17T12:00:00Z', cancelAtPeriodEnd: false,
};
const LISTENER = { userId: 'user-1', username: 'charles', supportedArtistId: null, jurisdiction: { jurisdictionId: 'jur-1', name: 'Harlem' } };
const SUPPORTER = { ...LISTENER, supportedArtistId: 'artist-1' };

let apiSpy;
let backend;
let assign;

const posts = () => apiSpy.mock.calls.map(([c]) => c).filter((c) => c.method === 'post');

function renderPage(path = '/plus') {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={[path]}><PlusPage /></MemoryRouter>);
  return { user };
}

async function renderLoaded(path) {
  const utils = renderPage(path);
  await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument());
  return utils;
}

const planCard = () => document.querySelector('.plus-card');

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = LISTENER;
  authState.refreshUser = vi.fn();
  plus.refreshPlusStatus.mockResolvedValue(ON_SALE);
  backend = {
    profile: { username: 'Tony Fadd', photoUrl: 'https://cdn.test/tony.jpg', jurisdiction: { name: 'Harlem' }, genre: { name: 'Rap' } },
    rank: { periods: { week: [{ jurisdictionName: 'Uptown Harlem', overallRank: 3 }] } },
    defaultSong: { artworkUrl: 'https://cdn.test/art.jpg' },
    checkout: { url: 'https://checkout.stripe.com/c/pay/cs_123' },
    portal: { url: 'https://billing.stripe.com/p/session/abc' },
    fail: {},
  };
  apiSpy = vi.spyOn(axiosModule, 'apiCall').mockImplementation(async ({ url }) => {
    const answer = (key, data) => { if (backend.fail[key]) throw backend.fail[key]; return { data }; };
    if (/\/v1\/users\/profile\//.test(url)) return answer('profile', backend.profile);
    if (/\/territory-rank$/.test(url)) return answer('rank', backend.rank);
    if (/\/default-song$/.test(url)) return answer('defaultSong', backend.defaultSong);
    if (url === '/v1/plus/checkout') return answer('checkout', backend.checkout);
    if (url === '/v1/plus/portal') return answer('portal', backend.portal);
    throw new Error(`Unexpected request: ${url}`);
  });
  assign = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, assign }, writable: true, configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===========================================================================
describe('plusSplit — where a month\'s fee goes', () => {
  it('on $4.99: fees 49¢, supported artist $2.50, artists played $1.00, Community Share $1.00', () => {
    expect(plusSplit(499)).toEqual({
      price: 499, fees: 49, net: 450, supported: 250, played: 100, artists: 350, pot: 100,
    });
  });

  it('the supported artist gets half of what was paid, to the cent', () => {
    expect(plusSplit(499).supported).toBe(250);
    expect(plusSplit(999).supported).toBe(500);
    expect(plusSplit(1000).supported).toBe(500);
  });

  it('every cent is accounted for at any price', () => {
    for (let cents = 0; cents <= 3000; cents += 1) {
      const s = plusSplit(cents);
      expect(s.fees + s.supported + s.played + s.pot).toBe(s.price);
      expect(s.artists).toBe(s.supported + s.played);
      [s.fees, s.net, s.supported, s.played, s.pot].forEach((part) => expect(part).toBeGreaterThanOrEqual(0));
    }
  });

  it('the rest after fees and the supported artist is halved, the odd cent going to the Community Share', () => {
    const s = plusSplit(501); // net 452, supported 251, rest 201
    expect(s.played).toBe(100);
    expect(s.pot).toBe(101);
  });

  it('artists always receive at least as much as the Community Share', () => {
    [199, 499, 999, 1499].forEach((cents) => {
      const s = plusSplit(cents);
      expect(s.artists).toBeGreaterThanOrEqual(s.pot);
    });
  });

  it('on a tiny price the fees take what there is and nobody goes negative', () => {
    expect(plusSplit(30)).toEqual({ price: 30, fees: 30, net: 0, supported: 0, played: 0, artists: 0, pot: 0 });
  });

  it.each([0, -5, null, undefined, 'abc'])('%p is treated as nothing', (value) => {
    expect(plusSplit(value)).toEqual({ price: 0, fees: 0, net: 0, supported: 0, played: 0, artists: 0, pot: 0 });
  });
});

// ===========================================================================
describe('PlusPage — the plan card', () => {
  it('shows Loading… until the status arrives', async () => {
    let finish;
    plus.refreshPlusStatus.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderPage();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await act(async () => { finish(ON_SALE); });
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('always asks the server for the status (never a cached one)', async () => {
    await renderLoaded();
    expect(plus.refreshPlusStatus).toHaveBeenCalled();
  });

  it('says "Coming soon" while Plus is not on sale, with no way to pay', async () => {
    plus.refreshPlusStatus.mockResolvedValue({ available: false, priceCents: null, plus: false, status: null });
    await renderLoaded();
    expect(within(planCard()).getByRole('heading', { name: 'Coming soon' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get unis plus/i })).not.toBeInTheDocument();
  });

  it('offers the plan at its price when on sale', async () => {
    await renderLoaded();
    expect(within(planCard()).getByRole('heading', { name: 'Go ad-free' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Unis Plus · $4.99/month' })).toBeEnabled();
    expect(within(planCard()).getByText(/\$2\.50 of every month goes to the artist you support/i)).toBeInTheDocument();
    expect(within(planCard()).getByText(/cancel any time/i)).toBeInTheDocument();
    expect(within(planCard()).getByText(/unis never sees your card/i)).toBeInTheDocument();
  });

  it('uses the server\'s price everywhere', async () => {
    plus.refreshPlusStatus.mockResolvedValue({ ...ON_SALE, priceCents: 999 });
    await renderLoaded();
    expect(screen.getByRole('button', { name: 'Get Unis Plus · $9.99/month' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Where your $9.99 goes' })).toBeInTheDocument();
  });

  it('a member sees the renewal date and Manage plan — not the buy button', async () => {
    plus.refreshPlusStatus.mockResolvedValue(MEMBER);
    await renderLoaded();
    expect(within(planCard()).getByRole('heading', { name: 'You’re ad-free' })).toBeInTheDocument();
    expect(within(planCard()).getByText(/your plan renews on december 17, 2026 for \$4\.99/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage plan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get unis plus/i })).not.toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('a canceled plan says when Plus ends and that there are no more charges', async () => {
    plus.refreshPlusStatus.mockResolvedValue({ ...MEMBER, cancelAtPeriodEnd: true });
    await renderLoaded();
    expect(within(planCard()).getByText(
      /your plan is canceled\. plus stays on until december 17, 2026, and you won’t be charged again/i)).toBeInTheDocument();
  });

  it('a failed payment is flagged, with where to fix the card', async () => {
    plus.refreshPlusStatus.mockResolvedValue({ ...MEMBER, status: 'past_due' });
    await renderLoaded();
    expect(document.querySelector('.plus-warn')).toHaveTextContent(/your last payment didn’t go through/i);
    expect(document.querySelector('.plus-warn')).toHaveTextContent(/update it in manage plan/i);
  });

  it('someone with an old plan can still reach its settings', async () => {
    plus.refreshPlusStatus.mockResolvedValue({ ...ON_SALE, status: 'canceled' });
    await renderLoaded();
    expect(screen.getByRole('button', { name: 'Manage a previous plan' })).toBeInTheDocument();
  });

  it.each([null, 'incomplete', 'incomplete_expired'])(
    'a checkout that was never finished (%p) is not a previous plan', async (status) => {
      plus.refreshPlusStatus.mockResolvedValue({ ...ON_SALE, status });
      await renderLoaded();
      expect(screen.queryByRole('button', { name: 'Manage a previous plan' })).not.toBeInTheDocument();
    });

  it('states the renewal and refund terms and links to the Terms', async () => {
    await renderLoaded();
    const fine = document.querySelector('.plus-fine');
    expect(fine).toHaveTextContent(/renews automatically each month at the price shown until you cancel/i);
    expect(fine).toHaveTextContent(/it doesn’t refund the current month/i);
    expect(within(fine).getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
  });
});

// ===========================================================================
describe('PlusPage — checkout and Manage plan', () => {
  it('Get Unis Plus starts checkout and sends the browser to Stripe', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /get unis plus/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_123'));
    expect(posts()).toEqual([{ method: 'post', url: '/v1/plus/checkout' }]);
  });

  it('Manage plan opens Stripe\'s billing page', async () => {
    plus.refreshPlusStatus.mockResolvedValue(MEMBER);
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Manage plan' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://billing.stripe.com/p/session/abc'));
    expect(posts()).toEqual([{ method: 'post', url: '/v1/plus/portal' }]);
  });

  it('shows a busy label and blocks a second press while Stripe is opening', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /get unis plus/i }));
    const button = await screen.findByRole('button', { name: 'Opening checkout…' });
    expect(button).toBeDisabled();
  });

  it.each([
    ['a look-alike domain', 'https://stripe.com.evil.example/pay'],
    ['a non-Stripe site', 'https://evil.example/checkout'],
    ['plain http', 'http://checkout.stripe.com/c/pay/cs_123'],
    ['a javascript: address', 'javascript:alert(1)'],
    ['a domain that only ends in "stripe.com"', 'https://notstripe.com/pay'],
    ['nothing at all', undefined],
  ])('never sends the browser to %s', async (_label, url) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.checkout = { url };
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /get unis plus/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Checkout couldn’t start. Please try again.');
    expect(assign).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /get unis plus/i })).toBeEnabled();
  });

  it.each([
    'https://checkout.stripe.com/c/pay/cs_123',
    'https://billing.stripe.com/p/session/abc',
    'https://stripe.com/pay',
  ])('accepts %s', async (url) => {
    backend.checkout = { url };
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /get unis plus/i }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(url));
  });

  it('shows the server\'s reason when checkout is refused', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.fail.checkout = { response: { status: 409, data: { error: 'You already have Unis Plus.' } } };
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /get unis plus/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You already have Unis Plus.');
    expect(assign).not.toHaveBeenCalled();
  });

  it('says so when plan settings cannot be opened', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    plus.refreshPlusStatus.mockResolvedValue(MEMBER);
    backend.fail.portal = new Error('down');
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: 'Manage plan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t open plan settings. Please try again.');
  });
});

// ===========================================================================
describe('PlusPage — coming back from checkout', () => {
  it('a canceled checkout says they were not charged, and can be dismissed', async () => {
    const { user } = await renderLoaded('/plus?status=canceled');
    expect(screen.getByRole('status')).toHaveTextContent('Checkout was canceled. You weren’t charged.');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('after paying it says Plus is being turned on', async () => {
    await renderLoaded('/plus?status=success');
    expect(screen.getByRole('status')).toHaveTextContent('Payment received. Turning on Unis Plus…');
  });

  it('keeps checking, then welcomes them once Plus is on', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    plus.refreshPlusStatus.mockResolvedValueOnce(ON_SALE).mockResolvedValueOnce(ON_SALE).mockResolvedValue(MEMBER);
    renderPage('/plus?status=success');

    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(screen.getByRole('status')).toHaveTextContent('Turning on Unis Plus…');

    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Welcome to Unis Plus. Ads are gone on every device you sign in on.');
    expect(feedback.success).toHaveBeenCalledWith('Unis Plus is on — no more ads, and your artist earns more');
  });

  it('gives up after about 30 seconds and says Plus will switch on shortly — never that payment failed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage('/plus?status=success');
    await act(async () => { await vi.advanceTimersByTimeAsync(12 * 2500 + 100); });

    expect(feedback.info).toHaveBeenCalledWith('Payment received — Plus will switch on here shortly.');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your payment went through. Plus can take a minute to turn on; refresh this page shortly.');
    const before = plus.refreshPlusStatus.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(plus.refreshPlusStatus.mock.calls.length).toBe(before);
  });

  it('does not poll on an ordinary visit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderPage('/plus');
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(plus.refreshPlusStatus).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
describe('PlusPage — the supported artist', () => {
  beforeEach(() => { authState.user = SUPPORTER; });

  it('builds the hero around the artist the user supports', async () => {
    await renderLoaded();
    const hero = document.querySelector('.plus-hero');
    await waitFor(() => expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent('Back Tony Fadd every month.'));
    expect(hero).toHaveTextContent('$4.99 a month, no ads — and half of it, $2.50, goes straight to Tony Fadd every month');
  });

  it('links to the artist with their area, genre and rank this week', async () => {
    await renderLoaded();
    const link = await screen.findByRole('link', { name: 'Tony Fadd — view their page' });
    expect(link).toHaveAttribute('href', '/artist/artist-1');
    expect(link.querySelector('.plus-artist__sub')).toHaveTextContent('Uptown Harlem · Rap · #3 this week');
  });

  it('leaves the rank out when it cannot be read — the page still loads', async () => {
    backend.fail.rank = new Error('down');
    await renderLoaded();
    const link = await screen.findByRole('link', { name: 'Tony Fadd — view their page' });
    expect(link.querySelector('.plus-artist__sub')).toHaveTextContent(/^Harlem · Rap$/);
  });

  it('uses the featured song\'s artwork as the backdrop when the artist has no photo', async () => {
    backend.profile = { ...backend.profile, photoUrl: null };
    await renderLoaded();
    await screen.findByRole('link', { name: 'Tony Fadd — view their page' });
    expect(document.querySelector('.plus-hero__photo').style.backgroundImage).toContain('cdn.test/art.jpg');
    expect(document.querySelector('.plus-artist .plus-av__initial')).toHaveTextContent('T');
  });

  it('a member\'s hero says who they are backing', async () => {
    plus.refreshPlusStatus.mockResolvedValue({ ...MEMBER, supportedArtistId: 'artist-1' });
    await renderLoaded();
    const hero = document.querySelector('.plus-hero');
    await waitFor(() => expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent('You’re backing Tony Fadd'));
    expect(hero).toHaveTextContent('$2.50, half of your $4.99, reaches Tony Fadd every month');
    expect(hero).toHaveTextContent('$1.00 goes to the artists you do play');
  });

  it('shows what the plan has credited to that artist so far', async () => {
    plus.refreshPlusStatus.mockResolvedValue({ ...MEMBER, supportedArtistId: 'artist-1', creditedToSupportedCents: 750 });
    await renderLoaded();
    await screen.findByRole('link', { name: 'Tony Fadd — view their page' });
    const credited = document.querySelector('.plus-credited');
    expect(credited).toHaveTextContent('$7.50');
    expect(credited).toHaveTextContent('credited to Tony Fadd from your plan so far');
  });

  it('does not show another artist\'s credit after the user switches who they support', async () => {
    plus.refreshPlusStatus.mockResolvedValue({ ...MEMBER, supportedArtistId: 'artist-OLD', creditedToSupportedCents: 750 });
    await renderLoaded();
    await screen.findByRole('link', { name: 'Tony Fadd — view their page' });
    expect(document.querySelector('.plus-credited')).toBeNull();
  });

  it('explains what supporting does, naming the artist and their area', async () => {
    await renderLoaded();
    const heading = await screen.findByRole('heading', { name: 'What your support does' });
    const card = heading.closest('.plus-card');
    expect(card).toHaveTextContent('$2.50 reaches Tony Fadd whether or not you press play');
    expect(card).toHaveTextContent('counts toward their standing in Uptown Harlem');
  });

  it('falls back to the plain page when the artist cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    backend.fail.profile = new Error('down');
    await renderLoaded();
    await waitFor(() => expect(document.querySelector('.plus-hero h1')).toHaveTextContent('No ads. Your money backs the artists you play.'));
    expect(screen.queryByRole('heading', { name: 'What your support does' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get unis plus/i })).toBeInTheDocument();
  });
});

describe('PlusPage — someone who supports nobody yet', () => {
  it('explains the split in general terms', async () => {
    await renderLoaded();
    const hero = document.querySelector('.plus-hero');
    expect(hero).toHaveTextContent('No ads. Your money backs the artists you play.');
    expect(hero).toHaveTextContent('Half of it goes straight to the artist you support, whatever you play.');
    expect(apiSpy).not.toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringMatching(/\/v1\/users\/profile\//) }));
  });

  it('offers to pick an artist, saying what they would get', async () => {
    const { user } = await renderLoaded();
    const pick = screen.getByRole('button', { name: /pick an artist to support/i });
    expect(pick).toHaveTextContent('They’d get $2.50 of every month, whatever you play');

    await user.click(pick);
    const picker = screen.getByTestId('picker');
    expect(picker).toHaveAttribute('data-user', 'user-1');
    expect(picker).toHaveAttribute('data-current', 'null');
  });

  it('after a pick it re-reads the user and the plan', async () => {
    const { user } = await renderLoaded();
    await user.click(screen.getByRole('button', { name: /pick an artist to support/i }));
    const before = plus.refreshPlusStatus.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'picker-success' }));

    expect(authState.refreshUser).toHaveBeenCalledTimes(1);
    expect(plus.refreshPlusStatus.mock.calls.length).toBe(before + 1);
  });

  it('a guest sees the page but is not offered the picker', async () => {
    authState.user = null;
    await renderLoaded();
    expect(screen.queryByRole('button', { name: /pick an artist to support/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('picker')).not.toBeInTheDocument();
  });
});

// ===========================================================================
describe('PlusPage — "Where your $4.99 goes"', () => {
  const rows = () => Array.from(document.querySelectorAll('.plus-split tr'))
    .map((tr) => [tr.cells[0].textContent, tr.cells[1].textContent]);

  it('lists the four parts and their amounts', async () => {
    await renderLoaded();
    expect(screen.getByRole('heading', { name: 'Where your $4.99 goes' })).toBeInTheDocument();
    expect(rows()).toEqual([
      ['The artist you supporthalf of what you pay', '$2.50'],
      ['Stripe (card and billing fees)', '$0.49'],
      ['Artists you play that month half of the rest', '$1.00'],
      ['Unis’s part, into the Community Share the other half', '$1.00'],
    ]);
  });

  it('the four amounts add up to the price', async () => {
    await renderLoaded();
    const total = rows().reduce((sum, [, amount]) => sum + Math.round(parseFloat(amount.replace('$', '')) * 100), 0);
    expect(total).toBe(499);
  });

  it('names the supported artist in the first row', async () => {
    authState.user = SUPPORTER;
    await renderLoaded();
    await screen.findByRole('link', { name: 'Tony Fadd — view their page' });
    expect(rows()[0][0]).toContain('Tony Fadd');
  });

  it('spells out the rules that decide the artists\' half', async () => {
    await renderLoaded();
    const note = document.querySelector('.plus-split').closest('.plus-card').querySelector('.plus-muted');
    expect(note).toHaveTextContent('up to 50 plays a day count; your own songs don’t');
    expect(note).toHaveTextContent('If you didn’t play anyone, it goes to your supported artist as well');
    expect(note).toHaveTextContent('If you don’t support anyone, their half is split by your plays instead');
    expect(note).toHaveTextContent('To be paid, an artist needs a verified phone number');
    expect(note).toHaveTextContent('Amounts are credited when each month closes');
  });
});
