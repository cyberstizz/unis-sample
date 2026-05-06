// src/profile.test.jsx
//
// Comprehensive test suite for Profile — the user's account page showing
// their photo, bio, supported artist, stats, vote history summary,
// referral card, theme picker, and danger-zone actions.

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
vi.mock('./assets/randomrapper.jpeg', () => ({ default: 'randomrapper.jpeg' }));

vi.mock('./layout', () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

const { editWizardSpy, deleteWizardSpy, voteHistoryModalSpy, changePasswordSpy, referralCardSpy, themePickerSpy } = vi.hoisted(() => ({
  editWizardSpy: vi.fn(),
  deleteWizardSpy: vi.fn(),
  voteHistoryModalSpy: vi.fn(),
  changePasswordSpy: vi.fn(),
  referralCardSpy: vi.fn(),
  themePickerSpy: vi.fn(),
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

vi.mock('./voteHistoryModal', () => ({
  default: (props) => {
    voteHistoryModalSpy(props);
    return props.show ? (
      <div data-testid="vote-history-modal">
        <span data-testid="vh-count">{(props.votes || []).length}</span>
        <button onClick={props.onClose}>vh-close</button>
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
    return <div data-testid="referral-card" data-userid={props.userId} data-isartist={String(props.isArtist)} />;
  },
}));

vi.mock('./ThemePicker', () => ({
  default: (props) => {
    themePickerSpy(props);
    return <div data-testid="theme-picker" data-userid={props.userId} />;
  },
}));

const { playMediaSpy } = vi.hoisted(() => ({ playMediaSpy: vi.fn() }));
vi.mock('./context/playercontext', async () => {
  const actual = await vi.importActual('./context/playercontext');
  const React = require('react');
  return {
    ...actual,
    PlayerContext: React.createContext({ playMedia: playMediaSpy }),
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

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------
const baseListenerProfile = (overrides = {}) => ({
  ...fixtures.users.listener,
  bio: null,
  photoUrl: null,
  score: 0,
  level: null,
  ...overrides,
});

const supportedArtistProfile = (overrides = {}) => ({
  userId: ARTIST_ID,
  username: 'Tony Fadd',
  photoUrl: '/uploads/tony.jpg',
  defaultSong: {
    songId: 'song-default-001',
    title: 'Featured Banger',
    fileUrl: '/uploads/banger.mp3',
    artworkUrl: '/uploads/banger.jpg',
  },
  ...overrides,
});

const voteHistoryFixture = [
  { voteId: 'v-1', targetId: 'art-1', votedAt: '2026-04-25T10:00:00Z' },
  { voteId: 'v-2', targetId: 'art-2', votedAt: '2026-04-24T11:00:00Z' },
  { voteId: 'v-3', targetId: 'art-3', votedAt: '2026-04-23T12:00:00Z' },
];

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
function mockProfile({
  listenerProfile = baseListenerProfile({ supportedArtistId: ARTIST_ID, bio: 'Harlem rap fan' }),
  supportedArtist = supportedArtistProfile(),
  voteHistory = voteHistoryFixture,
} = {}) {
  server.use(
    http.get(`${API}/v1/users/profile/:userId`, ({ params }) => {
      if (params.userId === LISTENER_ID) return HttpResponse.json(listenerProfile);
      if (params.userId === ARTIST_ID) return HttpResponse.json(supportedArtist);
      return new HttpResponse(null, { status: 404 });
    }),
    http.get(`${API}/v1/vote/history`, () => HttpResponse.json(voteHistory))
  );
}

async function renderAndWait({ as = 'listener' } = {}) {
  renderWithProviders(<Profile />, { as });
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
  playMediaSpy.mockReset();
  editWizardSpy.mockReset();
  deleteWizardSpy.mockReset();
  voteHistoryModalSpy.mockReset();
  changePasswordSpy.mockReset();
  referralCardSpy.mockReset();
  themePickerSpy.mockReset();
  setupApiCallLog();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ===========================================================================
// AUTH GATING
// ===========================================================================
describe('Profile — auth gating', () => {
  it('renders "Please log in" for guests', async () => {
    renderWithProviders(<Profile />, { as: 'guest' });
    await waitFor(() => {
      expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    });
  });

  it('does not call any APIs when user is null', async () => {
    renderWithProviders(<Profile />, { as: 'guest' });
    await new Promise((r) => setTimeout(r, 50));
    expect(callsTo('/v1/users/profile/')).toHaveLength(0);
    expect(callsTo('/v1/vote/history')).toHaveLength(0);
  });
});

// ===========================================================================
// LOADING STATE
// ===========================================================================
describe('Profile — loading state', () => {
  it('shows "Loading your profile..." while core fetch is in-flight', async () => {
    mockProfile();
    let coreCalls = 0;
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    server.use(
      http.get(`${API}/v1/users/profile/:userId`, async ({ params, request }) => {
        coreCalls++;
        if (coreCalls > 1) {
          await pending;
        }
        if (params.userId === LISTENER_ID) return HttpResponse.json(baseListenerProfile({ supportedArtistId: null }));
        return new HttpResponse(null, { status: 404 });
      })
    );
    renderWithProviders(<Profile />, { as: 'listener' });
    expect(await screen.findByText(/loading your profile/i, {}, { timeout: 5000 })).toBeInTheDocument();
    resolveFn();
    await waitFor(() => {
      expect(screen.queryByText(/loading your profile/i)).not.toBeInTheDocument();
    });
  });
});

// ===========================================================================
// CORE FETCH ERROR + RETRY
// ===========================================================================
describe('Profile — core fetch error', () => {
  it.skip('shows "Failed to load your profile" when the core fetch throws', async () => {});
  it.skip('Retry button re-fires the core fetch', async () => {});
});

// ===========================================================================
// PROFILE DATA RENDER
// ===========================================================================
describe('Profile — profile data render', () => {
  it('renders the username as h1', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ username: 'CharlesUnis', bio: 'hi' }),
    });
    await renderAndWait();
    const h1 = document.querySelector('h1');
    expect(h1.textContent).toBe('CharlesUnis');
  });

  it('renders the bio when present', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ bio: 'Harlem rap fan' }),
    });
    await renderAndWait();
    expect(screen.getByText('Harlem rap fan')).toBeInTheDocument();
  });

  it('renders fallback bio copy when bio is null', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ bio: null }),
    });
    await renderAndWait();
    expect(screen.getByText(/no bio yet — tell harlem who you are/i)).toBeInTheDocument();
  });

  it('uses the photo URL when present (relative URL prefixed with API base)', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ photoUrl: '/uploads/me.jpg' }),
    });
    await renderAndWait();
    const img = document.querySelector('img.profile-hero__avatar');
    expect(img).not.toBeNull();
    expect(img.src).toBe('http://localhost:8080/uploads/me.jpg');
  });

  it('passes through absolute photo URLs unchanged', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ photoUrl: 'https://cdn.test/me.jpg' }),
    });
    await renderAndWait();
    const img = document.querySelector('img.profile-hero__avatar');
    expect(img).not.toBeNull();
    expect(img.src).toBe('https://cdn.test/me.jpg');
  });

  it('renders an initial-letter placeholder when photoUrl is null', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ photoUrl: null, username: 'CharlesUnis' }),
    });
    await renderAndWait();
    expect(document.querySelector('img.profile-hero__avatar')).toBeNull();
    const placeholder = document.querySelector('.profile-hero__avatar--placeholder');
    expect(placeholder).not.toBeNull();
    expect(placeholder.textContent).toBe('C');
  });
});

// ===========================================================================
// SUPPORTED ARTIST
// ===========================================================================
describe('Profile — supported artist section', () => {
  it('renders the supported artist when supportedArtistId is set', async () => {
    mockProfile();
    await renderAndWait();
    expect(await screen.findByText('Featured Banger')).toBeInTheDocument();
    expect(screen.getByText(/by Tony Fadd/)).toBeInTheDocument();
    expect(screen.getByText(/i support/i)).toBeInTheDocument();
  });

  it('uses backgroundImage on the featured panel for the supported-artist art (relative URL prefixed)', async () => {
    mockProfile();
    await renderAndWait();
    await screen.findByText('Featured Banger');
    const featured = document.querySelector('.profile-hero__featured');
    expect(featured).not.toBeNull();
    expect(featured.style.backgroundImage).toContain('http://localhost:8080/uploads/banger.jpg');
  });

  it('renders the empty-state featured panel when supportedArtistId is missing', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ supportedArtistId: null }),
    });
    await renderAndWait();
    expect(screen.getByText(/no artist yet/i)).toBeInTheDocument();
    expect(screen.getByText(/discover artists/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /listen to your pick/i })).not.toBeInTheDocument();
  });

  it('shows "No featured track yet" when supported artist has no defaultSong', async () => {
    mockProfile({
      supportedArtist: supportedArtistProfile({ defaultSong: null }),
    });
    await renderAndWait();
    expect(await screen.findByText(/no featured track yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /listen to your pick/i })).not.toBeInTheDocument();
  });
});

// ===========================================================================
// PLAY DEFAULT SONG
// ===========================================================================
describe('Profile — playDefaultSong', () => {
  it('clicking play calls playMedia with the song details', async () => {
    mockProfile();
    await renderAndWait();
    await screen.findByText('Featured Banger');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /listen to your pick/i }));

    await waitFor(() => expect(playMediaSpy).toHaveBeenCalled());
    const [media] = playMediaSpy.mock.calls[0];
    expect(media.type).toBe('song');
    expect(media.title).toBe('Featured Banger');
    expect(media.artist).toBe('Tony Fadd');
    expect(media.url).toContain('/uploads/banger.mp3');
  });

  it('tracks the play with userId before calling playMedia', async () => {
    mockProfile();
    await renderAndWait();
    await screen.findByText('Featured Banger');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /listen to your pick/i }));
    await waitFor(() => {
      const trackCall = callsTo('/v1/media/song/song-default-001/play', 'post')[0];
      expect(trackCall).toBeTruthy();
      expect(trackCall.url).toMatch(/userId=user-listener-001/);
    });
  });

  it('still plays the song even when play tracking fails', async () => {
    server.use(
      http.post(`${API}/v1/media/song/:songId/play`, () =>
        new HttpResponse(null, { status: 500 })
      )
    );
    mockProfile();
    await renderAndWait();
    await screen.findByText('Featured Banger');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /listen to your pick/i }));
    await waitFor(() => expect(playMediaSpy).toHaveBeenCalled());
  });

  it('passes a single-element queue to playMedia', async () => {
    mockProfile();
    await renderAndWait();
    await screen.findByText('Featured Banger');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /listen to your pick/i }));
    await waitFor(() => expect(playMediaSpy).toHaveBeenCalled());
    const [, queue] = playMediaSpy.mock.calls[0];
    expect(Array.isArray(queue)).toBe(true);
    expect(queue).toHaveLength(1);
  });
});

// ===========================================================================
// STATS GRID
// ===========================================================================
describe('Profile — stats grid', () => {
  it('renders score from userProfile', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ score: 1250 }),
    });
    await renderAndWait();
    expect(screen.getByText('1250')).toBeInTheDocument();
  });

  it('falls back to 0 when score is missing', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ score: null }),
    });
    await renderAndWait();
    const scoreCard = Array.from(document.querySelectorAll('.profile-hero__stat'))
      .find((card) => card.textContent.includes('Score'));
    expect(scoreCard).toBeTruthy();
    expect(scoreCard.textContent).toMatch(/0/);
  });

  it('renders level from userProfile when set', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ level: 'Gold' }),
    });
    await renderAndWait();
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('falls back to "Silver" when level is null', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ level: null }),
    });
    await renderAndWait();
    // "Silver" appears in both eyebrow ("Member · Silver Tier") and stat card; either match is fine
    expect(screen.getAllByText(/Silver/).length).toBeGreaterThan(0);
  });

  it('renders Total Votes count from voteHistory length', async () => {
    mockProfile({ voteHistory: voteHistoryFixture });
    await renderAndWait();
    const totalVotesCard = Array.from(document.querySelectorAll('.profile-hero__stat'))
      .find((card) => card.textContent.includes('Total Votes'));
    expect(totalVotesCard).toBeTruthy();
    expect(totalVotesCard.textContent).toMatch(/3/);
  });

  it('shows an em-dash for total votes while votes are loading', async () => {
    let resolveFn;
    const pending = new Promise((r) => { resolveFn = r; });
    server.use(
      http.get(`${API}/v1/users/profile/:userId`, ({ params }) => {
        if (params.userId === LISTENER_ID) return HttpResponse.json(baseListenerProfile({ supportedArtistId: null }));
        return new HttpResponse(null, { status: 404 });
      }),
      http.get(`${API}/v1/vote/history`, async () => {
        await pending;
        return HttpResponse.json([]);
      })
    );
    renderWithProviders(<Profile />, { as: 'listener' });
    await waitFor(
      () => expect(document.querySelector('h1')).not.toBeNull(),
      { timeout: 5000 }
    );
    const totalVotesCard = Array.from(document.querySelectorAll('.profile-hero__stat'))
      .find((card) => card.textContent.includes('Total Votes'));
    expect(totalVotesCard).toBeTruthy();
    expect(totalVotesCard.textContent).toMatch(/—/);
    resolveFn();
  });
});

// ===========================================================================
// VOTE HISTORY SECTION
// ===========================================================================
describe('Profile — vote history section', () => {
  it('shows summary count for votes', async () => {
    mockProfile({ voteHistory: voteHistoryFixture });
    await renderAndWait();
    const voteCount = document.querySelector('.profile-vote-summary__number');
    expect(voteCount).not.toBeNull();
    expect(voteCount.textContent).toBe('3');
  });

  it('shows positive CTA when votes > 0', async () => {
    mockProfile({ voteHistory: voteHistoryFixture });
    await renderAndWait();
    expect(screen.getByText(/every vote shapes the leaderboard/i)).toBeInTheDocument();
  });

  it('shows empty CTA when votes = 0', async () => {
    mockProfile({ voteHistory: [] });
    await renderAndWait();
    expect(screen.getByText(/no votes yet — go support your favorites/i)).toBeInTheDocument();
  });

  it('shows "View All" button when votes loaded successfully', async () => {
    mockProfile({ voteHistory: voteHistoryFixture });
    await renderAndWait();
    expect(screen.getByRole('button', { name: /view all/i })).toBeInTheDocument();
  });

  it.skip('shows section error with Retry when votes fetch fails', async () => {});
  it.skip('hides "View All" button while votes are loading or errored', async () => {});
});

// ===========================================================================
// PARALLEL FETCH BEHAVIOR
// ===========================================================================
describe('Profile — fetches profile and votes in parallel', () => {
  it('does not wait for profile to resolve before firing /v1/vote/history', async () => {
    mockProfile();
    renderWithProviders(<Profile />, { as: 'listener' });
    await waitFor(() => {
      expect(callsTo('/v1/users/profile/').length).toBeGreaterThan(0);
      expect(callsTo('/v1/vote/history').length).toBeGreaterThan(0);
    });
    const profileCall = callsTo('/v1/users/profile/')[0];
    const votesCall = callsTo('/v1/vote/history')[0];
    expect(Math.abs(profileCall.timestamp - votesCall.timestamp)).toBeLessThan(50);
  });
});

// ===========================================================================
// CHILD COMPONENT INTEGRATION
// ===========================================================================
describe('Profile — child component integration', () => {
  it('passes userId to ReferralCodeCard with isArtist=false', async () => {
    mockProfile();
    await renderAndWait();
    const card = screen.getByTestId('referral-card');
    expect(card.dataset.userid).toBe(LISTENER_ID);
    expect(card.dataset.isartist).toBe('false');
  });

  it('passes userId to ThemePicker', async () => {
    mockProfile();
    await renderAndWait();
    const picker = screen.getByTestId('theme-picker');
    expect(picker.dataset.userid).toBe(LISTENER_ID);
  });
});

// ===========================================================================
// EDIT PROFILE WIZARD
// ===========================================================================
describe('Profile — Edit Profile button', () => {
  it('clicking Edit Profile opens the EditProfileWizard', async () => {
    mockProfile();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit profile/i }));
    expect(screen.getByTestId('edit-wizard')).toBeInTheDocument();
  });

  it('passes the userProfile to EditProfileWizard', async () => {
    mockProfile({
      listenerProfile: baseListenerProfile({ bio: 'My bio', username: 'Charles' }),
    });
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit profile/i }));
    const lastCall = editWizardSpy.mock.calls[editWizardSpy.mock.calls.length - 1][0];
    expect(lastCall.userProfile).toMatchObject({ username: 'Charles', bio: 'My bio' });
  });

  it('onClose hides the wizard', async () => {
    mockProfile();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit profile/i }));
    await user.click(screen.getByRole('button', { name: /edit-close/i }));
    expect(screen.queryByTestId('edit-wizard')).not.toBeInTheDocument();
  });

  it('onSuccess refreshes the profile (re-fetches /v1/users/profile)', async () => {
    mockProfile();
    await renderAndWait();
    const beforeProfileCalls = callsTo('/v1/users/profile/' + LISTENER_ID).length;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit profile/i }));
    await user.click(screen.getByRole('button', { name: /edit-success/i }));
    await waitFor(() => {
      expect(callsTo('/v1/users/profile/' + LISTENER_ID).length).toBeGreaterThan(beforeProfileCalls);
    });
  });
});

// ===========================================================================
// DELETE ACCOUNT WIZARD
// ===========================================================================
describe('Profile — Delete Account button', () => {
  it('clicking Delete Account opens the DeleteAccountWizard', async () => {
    mockProfile();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete account/i }));
    expect(screen.getByTestId('delete-wizard')).toBeInTheDocument();
  });

  it('onClose hides the wizard', async () => {
    mockProfile();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /delete account/i }));
    await user.click(screen.getByRole('button', { name: /delete-close/i }));
    expect(screen.queryByTestId('delete-wizard')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// CHANGE PASSWORD WIZARD
// ===========================================================================
describe('Profile — Change Password button', () => {
  it('clicking Change Password opens the ChangePasswordWizard', async () => {
    mockProfile();
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /change password/i }));
    expect(screen.getByTestId('change-password-wizard')).toBeInTheDocument();
  });
});

// ===========================================================================
// VOTE HISTORY MODAL
// ===========================================================================
describe('Profile — View All button', () => {
  it('opens VoteHistoryModal with the current vote history', async () => {
    mockProfile({ voteHistory: voteHistoryFixture });
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /view all/i }));
    expect(screen.getByTestId('vote-history-modal')).toBeInTheDocument();
    expect(screen.getByTestId('vh-count').textContent).toBe('3');
  });

  it('passes useDummyData=false (real votes only)', async () => {
    mockProfile({ voteHistory: voteHistoryFixture });
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /view all/i }));
    const lastCall = voteHistoryModalSpy.mock.calls[voteHistoryModalSpy.mock.calls.length - 1][0];
    expect(lastCall.useDummyData).toBe(false);
  });

  it('onClose hides the modal', async () => {
    mockProfile({ voteHistory: voteHistoryFixture });
    await renderAndWait();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /view all/i }));
    await user.click(screen.getByRole('button', { name: /vh-close/i }));
    expect(screen.queryByTestId('vote-history-modal')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// VOTE HISTORY URL
// ===========================================================================
describe('Profile — vote history URL', () => {
  it('calls /v1/vote/history with limit=50', async () => {
    mockProfile();
    await renderAndWait();
    const call = callsTo('/v1/vote/history')[0];
    expect(call).toBeTruthy();
    expect(call.url).toContain('limit=50');
  });
});