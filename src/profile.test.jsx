// src/profile.test.jsx
//
// Rewritten for the current Profile shape:
//   - Single consolidated fetch to /v1/users/profile-summary/{userId}
//   - Collapsible sections (vote-history, referral, social, theme, account)
//   - Supported-artist picker + pending-change banner
//   - Vote history owned by VoteHistorySection (mocked here)
//   - PlayerContext uses requestPlay (not playMedia)
//
// Children are mocked. We test Profile's wiring, not the children's behavior.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker, fixtures } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';
import * as axiosModule from './components/axiosInstance';
import cacheService from './services/cacheService';

// ---------------------------------------------------------------------------
// MOCKS
// ---------------------------------------------------------------------------
vi.mock('./profile.scss', () => ({}));

vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

// ---- Hoisted spies ----
const {
  editWizardSpy,
  deleteWizardSpy,
  changePasswordSpy,
  referralCardSpy,
  themePickerSpy,
  socialLinksSpy,
  accountSettingsSpy,
  voteHistorySectionSpy,
  artistPickerSpy,
  collapsibleSpy,
  requestPlaySpy,
} = vi.hoisted(() => ({
  editWizardSpy:         vi.fn(),
  deleteWizardSpy:       vi.fn(),
  changePasswordSpy:     vi.fn(),
  referralCardSpy:       vi.fn(),
  themePickerSpy:        vi.fn(),
  socialLinksSpy:        vi.fn(),
  accountSettingsSpy:    vi.fn(),
  voteHistorySectionSpy: vi.fn(),
  artistPickerSpy:       vi.fn(),
  collapsibleSpy:        vi.fn(),
  requestPlaySpy:        vi.fn(),
}));

vi.mock('./editProfileWizard', () => ({
  default: (props) => {
    editWizardSpy(props);
    return props.show ? (
      <div data-testid="edit-wizard">
        <button onClick={props.onClose}>edit-close</button>
        <button onClick={() => props.onSuccess && props.onSuccess()}>edit-success</button>
      </div>
    ) : null;
  },
}));

vi.mock('./deleteAccountWizard', () => ({
  default: (props) => {
    deleteWizardSpy(props);
    return props.show ? (
      <div data-testid="delete-wizard">
        <button onClick={props.onClose}>delete-close</button>
      </div>
    ) : null;
  },
}));

vi.mock('./changePasswordWizard', () => ({
  default: (props) => {
    changePasswordSpy(props);
    return props.show ? (
      <div data-testid="change-password-wizard">
        <button onClick={props.onClose}>cp-close</button>
      </div>
    ) : null;
  },
}));

vi.mock('./ReferralCodeCard', () => ({
  default: (props) => {
    referralCardSpy(props);
    return (
      <div
        data-testid="referral-card"
        data-referralcode={props.referralCode}
        data-username={props.username}
        data-isartist={String(props.isArtist)}
      />
    );
  },
}));

vi.mock('./ThemePicker', () => ({
  default: (props) => {
    themePickerSpy(props);
    return <div data-testid="theme-picker" data-userid={props.userId} />;
  },
}));

vi.mock('./SocialLinksSection', () => ({
  default: (props) => {
    socialLinksSpy(props);
    return (
      <div data-testid="social-links" data-userid={props.userId}>
        <button onClick={() => props.onUpdated && props.onUpdated()}>social-updated</button>
      </div>
    );
  },
}));

vi.mock('./AccountSettings', () => ({
  default: (props) => {
    accountSettingsSpy(props);
    return (
      <div
        data-testid="account-settings"
        data-userid={props.userId}
        data-settings={JSON.stringify(props.settings || {})}
      >
        <button onClick={() => props.onUpdated && props.onUpdated()}>settings-updated</button>
      </div>
    );
  },
}));

// VoteHistorySection is fully mocked — it owns its own fetch which we
// don't want firing in Profile tests.
vi.mock('./VoteHistorySection', () => ({
  default: (props) => {
    voteHistorySectionSpy(props);
    return <div data-testid="vote-history-section" data-userid={props.userId} />;
  },
}));

vi.mock('./SupportedArtistPicker', () => ({
  default: (props) => {
    artistPickerSpy(props);
    return props.show ? (
      <div data-testid="artist-picker" data-currentartistid={props.currentArtistId || 'null'}>
        <button onClick={props.onClose}>picker-close</button>
        <button onClick={() => props.onSuccess && props.onSuccess()}>picker-success</button>
      </div>
    ) : null;
  },
}));

// CollapsibleSection is mocked to a passthrough that records props.
// Tests assert the right id/title/eyebrow without depending on toggle behavior.
vi.mock('./CollapsibleSection', () => ({
  default: (props) => {
    collapsibleSpy(props);
    return (
      <section data-testid={`collapsible-${props.id}`} data-id={props.id}>
        <div data-testid={`collapsible-${props.id}-children`}>{props.children}</div>
      </section>
    );
  },
}));

vi.mock('./context/playercontext', async () => {
  const actual = await vi.importActual('./context/playercontext');
  const React = require('react');
  return {
    ...actual,
    PlayerContext: React.createContext({ requestPlay: requestPlaySpy }),
  };
});

// Import AFTER mocks
import Profile from './profile';

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const API = 'http://localhost:8080/api';
const LISTENER_ID = 'user-listener-001';
const ARTIST_ID = 'user-artist-001';
const PENDING_ARTIST_ID = 'user-artist-002';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------
const baseSummary = (overrides = {}) => ({
  profile: {
    userId: LISTENER_ID,
    username: 'charles',
    email: 'charles@unis.com',
    bio: null,
    photoUrl: null,
    score: 0,
    level: null,
    role: 'listener',
    supportedArtistId: null,
    instagramUrl: null,
    twitterUrl: null,
    tiktokUrl: null,
    jurisdiction: null,
    createdAt: '2026-03-15T15:35:02Z',
  },
  supportedArtist: null,
  pendingSupportedArtist: null,
  voteHistory: { totalCount: 0, recent: [] },
  referralCode: 'CHARLES-ABC12',
  settings: {
    emailNotifications: true,
    publicProfile: true,
    showVoteHistory: false,
  },
  ...overrides,
});

const supportedArtist = (overrides = {}) => ({
  userId: ARTIST_ID,
  username: 'Tony Fadd',
  photoUrl: '/uploads/tony.jpg',
  defaultSong: {
    songId: 'song-default-001',
    title: 'Featured Banger',
    fileUrl: '/uploads/banger.mp3',
    artworkUrl: '/uploads/banger.jpg',
    duration: 180,
  },
  ...overrides,
});

// ---------------------------------------------------------------------------
// apiCall LOGGER
// ---------------------------------------------------------------------------
let apiCallLog = [];
function setupApiCallLog() {
  apiCallLog = [];
  const original = axiosModule.apiCall;
  vi.spyOn(axiosModule, 'apiCall').mockImplementation(async (config) => {
    apiCallLog.push({ ...config, timestamp: Date.now() });
    return original(config);
  });
}
function callsTo(urlSubstring, method) {
  return apiCallLog.filter((c) => {
    const m = method ? (c.method || 'get').toLowerCase() === method.toLowerCase() : true;
    return m && c.url && c.url.includes(urlSubstring);
  });
}

// ---------------------------------------------------------------------------
// MSW HELPERS
// ---------------------------------------------------------------------------
function mockSummary(summary = baseSummary()) {
  server.use(
    http.get(`${API}/v1/users/profile-summary/:userId`, ({ params }) => {
      if (params.userId === LISTENER_ID) return HttpResponse.json(summary);
      return new HttpResponse(null, { status: 404 });
    })
  );
}

async function renderAndWait() {
  renderWithProviders(<Profile />, { as: 'listener' });
  await waitFor(
    () => {
      const stillLoading = !!screen.queryByText(/loading your profile/i);
      const isError = !!screen.queryByText(/failed to load your profile/i);
      const guestMsg = !!screen.queryByText(/please log in/i);
      const hasH1 = !!document.querySelector('h1');
      if (stillLoading) throw new Error('still loading');
      if (guestMsg) throw new Error('still guest');
      if (!hasH1 && !isError) throw new Error('not yet rendered');
    },
    { timeout: 5000 }
  );
}

// ---------------------------------------------------------------------------
// LIFECYCLE
// ---------------------------------------------------------------------------
beforeEach(() => {
  cacheService.clearAll();
  callTracker.reset();
  requestPlaySpy.mockReset();
  editWizardSpy.mockReset();
  deleteWizardSpy.mockReset();
  changePasswordSpy.mockReset();
  referralCardSpy.mockReset();
  themePickerSpy.mockReset();
  socialLinksSpy.mockReset();
  accountSettingsSpy.mockReset();
  voteHistorySectionSpy.mockReset();
  artistPickerSpy.mockReset();
  collapsibleSpy.mockReset();
  setupApiCallLog();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// AUTH GATING
// ===========================================================================
describe('Profile — auth gating', () => {
  it('shows the sign-in prompt for guests (expired/absent session)', async () => {
    renderWithProviders(<Profile />, { as: 'guest' });
    await waitFor(() => {
      // Copy changed from "Please log in." to a fuller prompt, now backed by
      // the AuthGateSheet instead of a bare div.
      expect(screen.getByText(/please sign in to view your profile/i)).toBeInTheDocument();
    });
  });

  it('does not call profile-summary when user is null', async () => {
    renderWithProviders(<Profile />, { as: 'guest' });
    await new Promise((r) => setTimeout(r, 50));
    expect(callsTo('/v1/users/profile-summary/')).toHaveLength(0);
  });
});

// ===========================================================================
// LOADING / ERROR / RETRY
// ===========================================================================
describe('Profile — loading state', () => {
  it('shows "Loading your profile..." while the summary fetch is in-flight', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    server.use(
      http.get(`${API}/v1/users/profile-summary/:userId`, async () => {
        await pending;
        return HttpResponse.json(baseSummary());
      })
    );
    renderWithProviders(<Profile />, { as: 'listener' });
    expect(await screen.findByText(/loading your profile/i)).toBeInTheDocument();
    resolveFn();
    await waitFor(() => {
      expect(screen.queryByText(/loading your profile/i)).not.toBeInTheDocument();
    });
  });
});

describe('Profile — core fetch error', () => {
  it('shows the error state with a Retry button when the summary fetch fails', async () => {
    server.use(
      http.get(`${API}/v1/users/profile-summary/:userId`, () =>
        new HttpResponse(null, { status: 500 })
      )
    );
    renderWithProviders(<Profile />, { as: 'listener' });
    expect(await screen.findByText(/failed to load your profile/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('Retry re-fires the summary fetch', async () => {
    let callCount = 0;
    server.use(
      http.get(`${API}/v1/users/profile-summary/:userId`, () => {
        callCount++;
        if (callCount === 1) return new HttpResponse(null, { status: 500 });
        return HttpResponse.json(baseSummary());
      })
    );
    renderWithProviders(<Profile />, { as: 'listener' });
    await screen.findByText(/failed to load your profile/i);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => {
      expect(document.querySelector('h1')).not.toBeNull();
    });
    expect(callCount).toBeGreaterThanOrEqual(2);
  });
});

// ===========================================================================
// SINGLE-FETCH BEHAVIOR (replaces old "parallel fetch" assertions)
// ===========================================================================
describe('Profile — fetches profile-summary in a single call', () => {
  it('hits exactly one summary endpoint on mount', async () => {
    mockSummary();
    await renderAndWait();
    expect(callsTo('/v1/users/profile-summary/').length).toBe(1);
  });

  it('does not call the legacy /v1/users/profile/{id} endpoint', async () => {
    mockSummary();
    await renderAndWait();
    // Profile.jsx should never hit /v1/users/profile/{id} directly anymore
    expect(callsTo(`/v1/users/profile/${LISTENER_ID}`)).toHaveLength(0);
  });

  it('does not call /v1/vote/history directly (owned by VoteHistorySection)', async () => {
    mockSummary();
    await renderAndWait();
    expect(callsTo('/v1/vote/history')).toHaveLength(0);
  });
});

// ===========================================================================
// PROFILE DATA RENDER
// ===========================================================================
describe('Profile — profile data render', () => {
  it('renders the username as h1', async () => {
    mockSummary(baseSummary({ profile: { ...baseSummary().profile, username: 'CharlesUnis' } }));
    await renderAndWait();
    expect(document.querySelector('h1').textContent).toBe('CharlesUnis');
  });

  it('renders the bio when present', async () => {
    mockSummary(baseSummary({ profile: { ...baseSummary().profile, bio: 'Harlem rap fan' } }));
    await renderAndWait();
    expect(screen.getByText('Harlem rap fan')).toBeInTheDocument();
  });

  it('renders fallback bio copy when bio is null', async () => {
    mockSummary();
    await renderAndWait();
    expect(screen.getByText(/no bio yet/i)).toBeInTheDocument();
  });

  it('renders an initial-letter placeholder when photoUrl is null', async () => {
    mockSummary(baseSummary({ profile: { ...baseSummary().profile, username: 'CharlesUnis', photoUrl: null } }));
    await renderAndWait();
    expect(document.querySelector('img.profile-hero__avatar')).toBeNull();
    const placeholder = document.querySelector('.profile-hero__avatar--placeholder');
    expect(placeholder).not.toBeNull();
    expect(placeholder.textContent).toBe('C');
  });

  it('renders the photo when photoUrl is present', async () => {
    mockSummary(baseSummary({ profile: { ...baseSummary().profile, photoUrl: 'https://cdn.test/me.jpg' } }));
    await renderAndWait();
    const img = document.querySelector('img.profile-hero__avatar');
    expect(img).not.toBeNull();
    expect(img.src).toContain('me.jpg');
  });
});

// ===========================================================================
// STATS GRID
// ===========================================================================
describe('Profile — stats grid', () => {
  it('renders score from summary.profile', async () => {
    mockSummary(baseSummary({ profile: { ...baseSummary().profile, score: 1250 } }));
    await renderAndWait();
    expect(screen.getByText('1250')).toBeInTheDocument();
  });

  it('falls back to 0 when score is missing', async () => {
    mockSummary();
    await renderAndWait();
    const scoreCard = Array.from(document.querySelectorAll('.profile-hero__stat'))
      .find((c) => c.textContent.includes('Score'));
    expect(scoreCard.textContent).toMatch(/0/);
  });

  it('renders level when set', async () => {
    mockSummary(baseSummary({ profile: { ...baseSummary().profile, level: 'Gold' } }));
    await renderAndWait();
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('falls back to "Silver" when level is null', async () => {
    mockSummary();
    await renderAndWait();
    expect(screen.getAllByText(/Silver/).length).toBeGreaterThan(0);
  });

  it('renders Total Votes from voteHistory.totalCount', async () => {
    mockSummary(baseSummary({ voteHistory: { totalCount: 7, recent: [] } }));
    await renderAndWait();
    const totalVotesCard = Array.from(document.querySelectorAll('.profile-hero__stat'))
      .find((c) => c.textContent.includes('Total Votes'));
    expect(totalVotesCard.textContent).toMatch(/7/);
  });
});

// ===========================================================================
// SUPPORTED ARTIST HERO
// ===========================================================================
describe('Profile — supported artist hero', () => {
  it('renders the artist when supportedArtist is present', async () => {
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    expect(screen.getByText('Tony Fadd')).toBeInTheDocument();
  });

  it('renders the "You support" tag', async () => {
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    expect(screen.getByText(/you support/i)).toBeInTheDocument();
  });

  it('uses the ARTIST photo as the featured background (not the song artwork)', async () => {
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    const featured = document.querySelector('.profile-hero__featured');
    expect(featured).not.toBeNull();
    // Artist photo takes precedence over song artwork
    expect(featured.style.backgroundImage).toContain('tony.jpg');
    expect(featured.style.backgroundImage).not.toContain('banger.jpg');
  });

  it('falls back to song artwork only when artist has no photo', async () => {
    mockSummary(baseSummary({
      supportedArtist: supportedArtist({ photoUrl: null }),
    }));
    await renderAndWait();
    const featured = document.querySelector('.profile-hero__featured');
    expect(featured.style.backgroundImage).toContain('banger.jpg');
  });

  it('renders the empty-state hero when no supported artist', async () => {
    mockSummary();
    await renderAndWait();
    expect(screen.getByText(/no artist yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose an artist/i })).toBeInTheDocument();
  });

  it('hides the play button when supported artist has no defaultSong', async () => {
    mockSummary(baseSummary({
      supportedArtist: supportedArtist({ defaultSong: null }),
    }));
    await renderAndWait();
    expect(screen.queryByRole('button', { name: /listen to their pick/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// PLAY DEFAULT SONG
// ===========================================================================
describe('Profile — playDefaultSong', () => {
  it('clicking play calls requestPlay with the song details', async () => {
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^listen$/i }));
    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
    const [media] = requestPlaySpy.mock.calls[0];
    expect(media.type).toBe('song');
    expect(media.title).toBe('Featured Banger');
    expect(media.artist).toBe('Tony Fadd');
    expect(media.artistId).toBe(ARTIST_ID);
  });

  it('tracks the play before calling requestPlay', async () => {
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^listen$/i }));
    await waitFor(() => {
      const trackCall = callsTo('/v1/media/song/song-default-001/play', 'post')[0];
      expect(trackCall).toBeTruthy();
      expect(trackCall.url).toMatch(/userId=user-listener-001/);
    });
  });

  it('still plays even when play tracking fails', async () => {
    server.use(
      http.post(`${API}/v1/media/song/:songId/play`, () =>
        new HttpResponse(null, { status: 500 })
      )
    );
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^listen$/i }));
    await waitFor(() => expect(requestPlaySpy).toHaveBeenCalled());
  });
});

// ===========================================================================
// PENDING SUPPORTED-ARTIST BANNER
// ===========================================================================
describe('Profile — pending supported-artist banner', () => {
  const pending = {
    userId: PENDING_ARTIST_ID,
    username: 'Stizz',
    photoUrl: '/uploads/stizz.jpg',
    effectiveDate: '2026-07-01T00:00:00',
  };

  it('renders the banner when pendingSupportedArtist is present', async () => {
    mockSummary(baseSummary({
      supportedArtist: supportedArtist(),
      pendingSupportedArtist: pending,
    }));
    await renderAndWait();
    expect(screen.getByText('Stizz')).toBeInTheDocument();
    expect(screen.getByText(/switching to/i)).toBeInTheDocument();
  });

  it('does NOT render the banner when pendingSupportedArtist is null', async () => {
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    expect(screen.queryByText(/switching to/i)).not.toBeInTheDocument();
  });

  it('clicking Cancel calls the cancel-pending endpoint', async () => {
    mockSummary(baseSummary({
      supportedArtist: supportedArtist(),
      pendingSupportedArtist: pending,
    }));
    server.use(
      http.delete(`${API}/v1/users/:userId/supported-artist/pending`, () =>
        HttpResponse.json({ status: 'cancelled' })
      )
    );
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => {
      const cancelCall = callsTo('/supported-artist/pending', 'delete')[0];
      expect(cancelCall).toBeTruthy();
      expect(cancelCall.url).toContain(LISTENER_ID);
    });
  });

  it('reloads the summary after cancel', async () => {
    mockSummary(baseSummary({
      supportedArtist: supportedArtist(),
      pendingSupportedArtist: pending,
    }));
    server.use(
      http.delete(`${API}/v1/users/:userId/supported-artist/pending`, () =>
        HttpResponse.json({ status: 'cancelled' })
      )
    );
    await renderAndWait();
    const beforeCalls = callsTo('/v1/users/profile-summary/').length;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => {
      expect(callsTo('/v1/users/profile-summary/').length).toBeGreaterThan(beforeCalls);
    });
  });
});

// ===========================================================================
// SUPPORTED-ARTIST PICKER INTEGRATION
// ===========================================================================
describe('Profile — supported-artist picker', () => {
  it('renders the picker hidden by default', async () => {
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    expect(screen.queryByTestId('artist-picker')).not.toBeInTheDocument();
  });

  it('"Change" button opens the picker with currentArtistId set', async () => {
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^change$/i }));
    const picker = screen.getByTestId('artist-picker');
    expect(picker).toBeInTheDocument();
    expect(picker.dataset.currentartistid).toBe(ARTIST_ID);
  });

  it('"Choose an artist" button opens the picker with no current artist', async () => {
    mockSummary();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /choose an artist/i }));
    const picker = screen.getByTestId('artist-picker');
    expect(picker).toBeInTheDocument();
    expect(picker.dataset.currentartistid).toBe('null');
  });

  it('picker onSuccess reloads the summary', async () => {
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    const beforeCalls = callsTo('/v1/users/profile-summary/').length;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^change$/i }));
    await user.click(screen.getByRole('button', { name: /picker-success/i }));
    await waitFor(() => {
      expect(callsTo('/v1/users/profile-summary/').length).toBeGreaterThan(beforeCalls);
    });
  });

  it('picker onClose hides the picker', async () => {
    mockSummary(baseSummary({ supportedArtist: supportedArtist() }));
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^change$/i }));
    await user.click(screen.getByRole('button', { name: /picker-close/i }));
    expect(screen.queryByTestId('artist-picker')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// CHILD COMPONENT WIRING
// ===========================================================================
describe('Profile — child component wiring', () => {
  it('passes referralCode + username + isArtist=false to ReferralCodeCard', async () => {
    mockSummary();
    await renderAndWait();
    const card = screen.getByTestId('referral-card');
    expect(card.dataset.referralcode).toBe('CHARLES-ABC12');
    expect(card.dataset.username).toBe('charles');
    expect(card.dataset.isartist).toBe('false');
  });

  it('passes isArtist=true to ReferralCodeCard when role is artist', async () => {
    mockSummary(baseSummary({
      profile: { ...baseSummary().profile, role: 'artist' },
    }));
    await renderAndWait();
    expect(screen.getByTestId('referral-card').dataset.isartist).toBe('true');
  });

  it('passes userId to ThemePicker', async () => {
    mockSummary();
    await renderAndWait();
    expect(screen.getByTestId('theme-picker').dataset.userid).toBe(LISTENER_ID);
  });

  it('passes userId + profile to SocialLinksSection', async () => {
    mockSummary();
    await renderAndWait();
    const links = screen.getByTestId('social-links');
    expect(links.dataset.userid).toBe(LISTENER_ID);
    const lastCall = socialLinksSpy.mock.calls[socialLinksSpy.mock.calls.length - 1][0];
    expect(lastCall.profile).toBeTruthy();
    expect(lastCall.profile.username).toBe('charles');
  });

  it('passes userId + settings to AccountSettings', async () => {
    mockSummary();
    await renderAndWait();
    const settings = screen.getByTestId('account-settings');
    expect(settings.dataset.userid).toBe(LISTENER_ID);
    const parsed = JSON.parse(settings.dataset.settings);
    expect(parsed.emailNotifications).toBe(true);
    expect(parsed.publicProfile).toBe(true);
    expect(parsed.showVoteHistory).toBe(false);
  });

  it('passes userId to VoteHistorySection', async () => {
    mockSummary();
    await renderAndWait();
    expect(screen.getByTestId('vote-history-section').dataset.userid).toBe(LISTENER_ID);
  });

  it('AccountSettings.onUpdated reloads the summary', async () => {
    mockSummary();
    await renderAndWait();
    const beforeCalls = callsTo('/v1/users/profile-summary/').length;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /settings-updated/i }));
    await waitFor(() => {
      expect(callsTo('/v1/users/profile-summary/').length).toBeGreaterThan(beforeCalls);
    });
  });

  it('SocialLinksSection.onUpdated reloads the summary', async () => {
    mockSummary();
    await renderAndWait();
    const beforeCalls = callsTo('/v1/users/profile-summary/').length;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /social-updated/i }));
    await waitFor(() => {
      expect(callsTo('/v1/users/profile-summary/').length).toBeGreaterThan(beforeCalls);
    });
  });
});

// ===========================================================================
// COLLAPSIBLE SECTION LAYOUT
// ===========================================================================
describe('Profile — collapsible section layout', () => {
  it('renders all five collapsible sections', async () => {
    mockSummary();
    await renderAndWait();
    expect(screen.getByTestId('collapsible-vote-history')).toBeInTheDocument();
    expect(screen.getByTestId('collapsible-referral')).toBeInTheDocument();
    expect(screen.getByTestId('collapsible-social-links')).toBeInTheDocument();
    expect(screen.getByTestId('collapsible-theme')).toBeInTheDocument();
    expect(screen.getByTestId('collapsible-account')).toBeInTheDocument();
  });

  it('mounts VoteHistorySection inside the vote-history collapsible', async () => {
    mockSummary();
    await renderAndWait();
    const panel = screen.getByTestId('collapsible-vote-history-children');
    expect(panel.querySelector('[data-testid="vote-history-section"]')).not.toBeNull();
  });

  it('mounts SocialLinksSection inside the social-links collapsible', async () => {
    mockSummary();
    await renderAndWait();
    const panel = screen.getByTestId('collapsible-social-links-children');
    expect(panel.querySelector('[data-testid="social-links"]')).not.toBeNull();
  });
});

// ===========================================================================
// WIZARDS
// ===========================================================================
describe('Profile — Edit Profile wizard', () => {
  it('opens on click', async () => {
    mockSummary();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit profile/i }));
    expect(screen.getByTestId('edit-wizard')).toBeInTheDocument();
  });

  it('receives the profile as userProfile prop', async () => {
    mockSummary();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit profile/i }));
    const lastCall = editWizardSpy.mock.calls[editWizardSpy.mock.calls.length - 1][0];
    expect(lastCall.userProfile.username).toBe('charles');
  });

  it('onSuccess reloads the summary', async () => {
    mockSummary();
    await renderAndWait();
    const beforeCalls = callsTo('/v1/users/profile-summary/').length;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit profile/i }));
    await user.click(screen.getByRole('button', { name: /edit-success/i }));
    await waitFor(() => {
      expect(callsTo('/v1/users/profile-summary/').length).toBeGreaterThan(beforeCalls);
    });
  });

  it('onClose hides the wizard', async () => {
    mockSummary();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit profile/i }));
    await user.click(screen.getByRole('button', { name: /edit-close/i }));
    expect(screen.queryByTestId('edit-wizard')).not.toBeInTheDocument();
  });
});

describe('Profile — Delete Account wizard', () => {
  it('opens on click', async () => {
    mockSummary();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByTestId('delete-wizard')).toBeInTheDocument();
  });
});

describe('Profile — Change Password wizard', () => {
  it('opens on click', async () => {
    mockSummary();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /change password/i }));
    expect(screen.getByTestId('change-password-wizard')).toBeInTheDocument();
  });
});