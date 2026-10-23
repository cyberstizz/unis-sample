// src/artistDashboard.test.jsx
//
// ★ Oct 2026 redesign: the dashboard is six tabs plus Settings. These tests
//   cover the shell (header, tabs, hash routing, keyboard), the Home tab
//   (setup card, this week, where you stand, supporters), and the behaviour
//   that moved into each tab (song delete rules, videos, trophy case, links,
//   agreement PDF, account actions).
//
//   Layout is mocked: the real header uses window.matchMedia in an effect,
//   which is what made all 21 of the old tests fail before this rewrite.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker, fixtures } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';

// jsPDF uses canvas APIs unavailable in jsdom
vi.mock('jspdf', () => {
  const mockPdf = {
    setTextColor: vi.fn(), setFontSize: vi.fn(), setFont: vi.fn(), text: vi.fn(), save: vi.fn(),
    addPage: vi.fn(), line: vi.fn(), rect: vi.fn(), setDrawColor: vi.fn(), setFillColor: vi.fn(),
    splitTextToSize: vi.fn((txt) => (Array.isArray(txt) ? txt : String(txt).split('\n'))),
    internal: { pageSize: { getWidth: vi.fn(() => 595.28), getHeight: vi.fn(() => 841.89) } },
  };
  return { jsPDF: vi.fn(() => mockPdf), default: vi.fn(() => mockPdf), __mockPdf: mockPdf };
});

// App chrome — tested on its own
vi.mock('./layout', () => ({ default: ({ children }) => <div data-testid="layout">{children}</div> }));

// Wizards / modals — tested independently (inline factories: vi.mock is hoisted)
vi.mock('./uploadWizard', () => ({ default: ({ show }) => (show ? <div data-testid="upload-wizard" /> : null) }));
vi.mock('./editProfileWizard', () => ({ default: ({ show }) => (show ? <div data-testid="edit-profile-wizard" /> : null) }));
vi.mock('./changeDefaultSongWizard', () => ({ default: ({ show }) => (show ? <div data-testid="change-default-wizard" /> : null) }));
vi.mock('./deleteAccountWizard', () => ({ default: ({ show }) => (show ? <div data-testid="delete-account-wizard" /> : null) }));
vi.mock('./editSongWizard', () => ({ default: ({ show }) => (show ? <div data-testid="edit-song-wizard" /> : null) }));
vi.mock('./lyricsWizard', () => ({ default: ({ show }) => (show ? <div data-testid="lyrics-wizard" /> : null) }));
vi.mock('./changePasswordWizard', () => ({ default: ({ show }) => (show ? <div data-testid="change-password-wizard" /> : null) }));
vi.mock('./phoneVerificationModal', () => ({ default: ({ show }) => (show ? <div data-testid="phone-verify-modal" /> : null) }));
vi.mock('./SongStatsModal', () => ({ default: ({ show }) => (show ? <div data-testid="song-stats-modal" /> : null) }));
vi.mock('./SongSalesModal', () => ({ default: ({ show }) => (show ? <div data-testid="song-sales-modal" /> : null) }));
vi.mock('./deleteSongModal', () => ({
  default: ({ show, onConfirm, onCancel, songTitle }) => show ? (
    <div data-testid="delete-song-modal">
      <span>Delete {songTitle}?</span>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ) : null,
}));

// Heavy section children — each fetches on its own; tested in their own specs
vi.mock('./TerritoryRankSection', () => ({ default: () => <div data-testid="territory-section" /> }));
vi.mock('./ReferralCodeCard', () => ({ default: () => <div data-testid="referral-code-card" /> }));
vi.mock('./ThemePicker', () => ({ default: () => <div data-testid="theme-picker" /> }));
vi.mock('./fanbaseFunnle', () => ({ default: () => <div data-testid="fanbase-funnel" /> }));
vi.mock('./SupporterSection', () => ({
  default: () => <div data-testid="supporter-section" />,
  BroadcastComposer: () => <div data-testid="broadcast-composer" />,
}));
vi.mock('./dempgraphicsSection', () => ({ default: () => <div data-testid="demographics-section" /> }));
vi.mock('./VoteHistorySection', () => ({ default: () => <div data-testid="vote-history-section" /> }));
vi.mock('./SupportedArtistPicker', () => ({ default: () => <div data-testid="supported-artist-picker" /> }));
vi.mock('./revenueSection', () => ({ default: () => <div data-testid="revenue-section" /> }));
vi.mock('./artistPhotosManager', () => ({ default: () => <div data-testid="artist-photos-manager" /> }));
// VerificationGate: render children so gated content still appears
vi.mock('./verificationGate', () => ({ default: ({ children }) => <>{children}</> }));

import ArtistDashboard from './artistDashboard';
import cacheService from './services/cacheService';

const API = 'http://localhost:8080/api';
const ARTIST_ID = fixtures.users.artist.userId;

const makeProfile = (overrides = {}) => ({
  userId: ARTIST_ID,
  username: 'testartist',
  bio: 'I am an artist.',
  photoUrl: '/uploads/artist.jpg',
  role: 'artist',
  score: 890,
  level: 'Gold',
  totalPlays: 12345,
  totalVotes: 67,
  jurisdiction: { jurisdictionId: 'jur-harlem', name: 'Harlem' },
  genre: { name: 'Rap' },
  instagramUrl: '', tiktokUrl: '', twitterUrl: '', youtubeUrl: '', contactEmail: '',
  ...overrides,
});

const summaryFor = (profileOverrides = {}, rest = {}) => ({
  profile: makeProfile(profileOverrides),
  referralCode: 'REF123',
  supportedArtist: null,
  pendingSupportedArtist: null,
  voteHistory: { totalCount: 0 },
  ...rest,
});

const WEEK = {
  funnel: [
    { key: 'plays', label: 'Plays', value: 1284, delta: 196 },
    { key: 'listeners', label: 'Listeners', value: 312, delta: -4 },
    { key: 'followers', label: 'Followers', value: 31, delta: 0 },
    { key: 'supporters', label: 'Supporters', value: 4, delta: 2 },
  ],
};

const RANK = {
  status: 'ok',
  defaultPeriod: 'week',
  genreName: 'Rap',
  periods: {
    week: [
      { jurisdictionId: 'j1', jurisdictionName: 'Uptown Harlem', overallRank: 3, genreRank: 2 },
      { jurisdictionId: 'j2', jurisdictionName: 'Harlem', overallRank: 8, genreRank: 5 },
    ],
  },
};

const SUPPORTERS = {
  supportersCount: 42,
  recentSupporters: [{ userId: 'u-1', username: 'Malik' }, { userId: 'u-2', username: 'Dre' }],
  supporterGrowth: [{ count: 3 }],
};

function installCore({
  summary = summaryFor(),
  defaultSong = { songId: 'song-1', title: 'My Track', playCount: 100 },
  songs,
  awards = [],
  songAwards = [],
  earnings = { currentBalance: '38.20', payoutThreshold: 50, referralCount: 0 },
  stripe = { onboardingComplete: false, payoutsEnabled: false },
  videos = [],
  authUser = {},
} = {}) {
  server.use(
    http.get(`${API}/v1/users/profile/:userId`, () => HttpResponse.json({ ...fixtures.users.artist, ...authUser })),
    http.get(`${API}/v1/users/profile-summary/:id`, () => HttpResponse.json(summary)),
    http.get(`${API}/v1/media/songs/artist/:id`, () =>
      HttpResponse.json(songs || [{ songId: 'song-1', title: 'My Track', playCount: 100, isrc: 'USRC17607839' }])),
    http.get(`${API}/v1/users/:id/default-song`, () => HttpResponse.json(defaultSong)),
    http.get(`${API}/v1/users/:id/supporters/count`, () => HttpResponse.json({ count: 42 })),
    http.get(`${API}/v1/users/:id/followers/count`, () => HttpResponse.json({ count: 88 })),
    http.get(`${API}/v1/users/:id/total-plays`, () => HttpResponse.json({ totalPlays: 12345 })),
    http.get(`${API}/v1/users/:id/total-votes`, () => HttpResponse.json({ totalVotes: 67 })),
    http.get(`${API}/v1/earnings/my-summary`, () => HttpResponse.json(earnings)),
    http.get(`${API}/v1/stripe/status`, () => HttpResponse.json(stripe)),
    http.get(`${API}/v1/stripe/payouts`, () => HttpResponse.json([])),
    http.get(`${API}/v1/awards/artist/:id/songs`, () => HttpResponse.json(songAwards)),
    http.get(`${API}/v1/awards/artist/:id`, () => HttpResponse.json(awards)),
    http.get(`${API}/v1/artist-analytics/artist/:id/fanbase`, () => HttpResponse.json(WEEK)),
    http.get(`${API}/v1/artist-analytics/artist/:id/territory-rank`, () => HttpResponse.json(RANK)),
    http.get(`${API}/v1/artist-analytics/artist/:id/supporters`, () => HttpResponse.json(SUPPORTERS)),
    http.get(`${API}/v1/media/videos/artist/:id`, () => HttpResponse.json(videos)),
  );
}

async function loadDashboard(opts, route = '/artistDashboard') {
  installCore(opts);
  renderWithProviders(<ArtistDashboard />, { as: 'artist', route });
  await screen.findByRole('heading', { level: 1, name: /testartist/i }, { timeout: 10000 });
}

const tab = (name) => screen.getByRole('tab', { name });

describe('ArtistDashboard', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    callTracker.reset();
    cacheService.clearAll();
    server.resetHandlers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    cacheService.clearAll();
  });

  describe('Header', () => {
    it('shows the artist name with tier and place chips', async () => {
      await loadDashboard();
      expect(screen.getByText('Gold tier')).toBeInTheDocument();
      expect(screen.getByText('Harlem · Rap')).toBeInTheDocument();
    });

    it('no longer opens a pop-up on every visit', async () => {
      await loadDashboard();
      expect(screen.queryByText(/Thank You!/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /You're Welcome/i })).not.toBeInTheDocument();
    });

    it('opens the upload wizard', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      const header = document.querySelector('.ad-head');
      await user.click(within(header).getByRole('button', { name: /^upload$/i }));
      expect(screen.getByTestId('upload-wizard')).toBeInTheDocument();
    });

    it('links to the public artist page', async () => {
      await loadDashboard();
      const links = screen.getAllByRole('link', { name: /view my page/i });
      expect(links[0]).toHaveAttribute('href', `/artist/${ARTIST_ID}`);
    });
  });

  describe('Tabs', () => {
    it('renders six tabs with Home selected', async () => {
      await loadDashboard();
      expect(screen.getAllByRole('tab')).toHaveLength(6);
      expect(tab('Home')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'ad-panel-home');
    });

    it('switches panels on click', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await user.click(tab('Fans'));
      expect(tab('Fans')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('fanbase-funnel')).toBeInTheDocument();
      expect(screen.getByTestId('supporter-section')).toBeInTheDocument();
      expect(screen.getByTestId('demographics-section')).toBeInTheDocument();
    });

    it('moves between tabs with the arrow keys', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      tab('Home').focus();
      await user.keyboard('{ArrowRight}');
      expect(tab('Music')).toHaveAttribute('aria-selected', 'true');
      expect(tab('Music')).toHaveFocus();
      await user.keyboard('{End}');
      expect(tab('Profile')).toHaveAttribute('aria-selected', 'true');
      await user.keyboard('{ArrowRight}');
      expect(tab('Home')).toHaveAttribute('aria-selected', 'true');
    });

    it('opens the tab named in the address', async () => {
      await loadDashboard(undefined, '/artistDashboard#earnings');
      expect(tab('Earnings')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('revenue-section')).toBeInTheDocument();
    });

    it('opens Settings from the gear button', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^settings$/i }));
      expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
      expect(screen.getByTestId('theme-picker')).toBeInTheDocument();
      expect(screen.getByTestId('vote-history-section')).toBeInTheDocument();
    });
  });

  describe('Home — setup card', () => {
    it('lists the phone step and opens verification from it', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      const step = (await screen.findByText('Verify your phone')).closest('li');
      await user.click(within(step).getByRole('button', { name: /verify/i }));
      expect(screen.getByTestId('phone-verify-modal')).toBeInTheDocument();
    });

    it('shows progress out of seven for an artist', async () => {
      await loadDashboard();
      expect(await screen.findByRole('img', { name: /of 7 setup steps done/i })).toBeInTheDocument();
    });

    it('disappears once every step is done', async () => {
      await loadDashboard({
        summary: summaryFor({ instagramUrl: 'https://instagram.com/me' }),
        songs: [
          { songId: 'song-1', title: 'My Track' },
          { songId: 'song-2', title: 'Second' },
        ],
        earnings: { currentBalance: '10.00', payoutThreshold: 50, referralCount: 2 },
        stripe: { onboardingComplete: true, payoutsEnabled: true },
        authUser: { phoneVerified: true },
      });
      await screen.findByText('This week');
      await waitFor(() => expect(screen.queryByText(/Finish setting/i)).not.toBeInTheDocument());
    });

    it('sends the links step to the Profile tab', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      const step = (await screen.findByText('Add your links')).closest('li');
      await user.click(within(step).getByRole('button', { name: /add links/i }));
      expect(tab('Profile')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Home — at a glance', () => {
    it('shows this week with changes and all-time totals', async () => {
      await loadDashboard();
      expect(await screen.findByText('1,284')).toBeInTheDocument();
      expect(screen.getByText('+196')).toBeInTheDocument();
      expect(screen.getByText('−4')).toBeInTheDocument();
      expect(screen.getByText('No change')).toBeInTheDocument();
      expect(screen.getByText('12,345 all time')).toBeInTheDocument();
      // ★ followers were fetched but never shown before the redesign
      expect(screen.getByText('88 all time')).toBeInTheDocument();
    });

    it('shows where the artist stands and the latest win', async () => {
      await loadDashboard({
        awards: [{ interval: { name: 'weekly' }, jurisdiction: { name: 'Uptown Harlem' }, awardDate: '2026-10-12' }],
      });
      expect(await screen.findByText('#3')).toBeInTheDocument();
      expect(screen.getByText('#2 in Rap')).toBeInTheDocument();
      expect(await screen.findByText(/Latest win: Artist of the Week, Uptown Harlem/)).toBeInTheDocument();
    });

    it('shows the featured song', async () => {
      await loadDashboard();
      expect(await screen.findByRole('heading', { name: 'My Track' })).toBeInTheDocument();
    });

    it('opens the broadcast composer from the supporters card', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await user.click(await screen.findByRole('button', { name: /message all supporters/i }));
      expect(screen.getByTestId('broadcast-composer')).toBeInTheDocument();
    });

    it('shows the share balance toward the payout minimum', async () => {
      await loadDashboard();
      expect(await screen.findByText('$38.20')).toBeInTheDocument();
      expect(screen.getByText(/\$11\.80 more and you can withdraw/)).toBeInTheDocument();
    });
  });

  describe('Music', () => {
    it('formats the ISRC in the songs list', async () => {
      await loadDashboard({ songs: [{ songId: 'song-1', title: 'My Track', isrc: 'USRC17607839' }] });
      const user = userEvent.setup();
      await user.click(tab('Music'));
      expect(await screen.findByText(/US-RC1-76-07839/i)).toBeInTheDocument();
    });

    it('blocks deleting the only song with a message', async () => {
      await loadDashboard({ songs: [{ songId: 'song-1', title: 'My Track' }] });
      const user = userEvent.setup();
      await user.click(tab('Music'));
      await user.click(screen.getByRole('button', { name: /delete my track/i }));
      expect(await screen.findByText(/You need at least one song/i)).toBeInTheDocument();
      expect(screen.queryByTestId('delete-song-modal')).not.toBeInTheDocument();
    });

    it('blocks deleting the featured song and opens the change-default wizard', async () => {
      await loadDashboard({
        songs: [
          { songId: 'song-1', title: 'My Track' },
          { songId: 'song-2', title: 'Second' },
        ],
      });
      const user = userEvent.setup();
      await user.click(tab('Music'));
      await user.click(screen.getByRole('button', { name: /delete my track/i }));
      expect(screen.getByTestId('change-default-wizard')).toBeInTheDocument();
    });

    it('opens the delete modal for a normal song', async () => {
      await loadDashboard({
        songs: [
          { songId: 'song-1', title: 'My Track' },
          { songId: 'song-2', title: 'Second' },
        ],
      });
      const user = userEvent.setup();
      await user.click(tab('Music'));
      await user.click(screen.getByRole('button', { name: /delete second/i }));
      expect(screen.getByTestId('delete-song-modal')).toHaveTextContent('Delete Second?');
    });

    it('lists the artist videos', async () => {
      await loadDashboard({ videos: [{ videoId: 'v-1', title: 'Live on 125th', playCount: 12, likes: 3 }] });
      const user = userEvent.setup();
      await user.click(tab('Music'));
      expect(await screen.findByText('Live on 125th')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /watch live on 125th/i })).toHaveAttribute('href', '/video/v-1');
    });
  });

  describe('Races', () => {
    it('shows the empty trophy case', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await user.click(tab('Races'));
      expect(await screen.findByText(/No artist awards yet/i)).toBeInTheDocument();
      expect(screen.getByTestId('territory-section')).toBeInTheDocument();
    });

    it('renders the short interval badge for an award', async () => {
      await loadDashboard({
        awards: [{ interval: { name: 'weekly' }, jurisdiction: { name: 'Harlem' }, genre: { name: 'Rap' }, awardDate: '2026-10-12' }],
      });
      const user = userEvent.setup();
      await user.click(tab('Races'));
      expect(await screen.findByText('Week')).toBeInTheDocument();
      expect(screen.getAllByText('Artist of the Week').length).toBeGreaterThan(0);
    });
  });

  describe('Profile', () => {
    it('saves every link with one PUT and confirms it', async () => {
      let payload = null;
      let calls = 0;
      server.use(
        http.put(`${API}/v1/users/profile/:id`, async ({ request }) => {
          calls += 1;
          payload = await request.json();
          return HttpResponse.json({ message: 'ok' });
        }),
      );
      await loadDashboard();
      const user = userEvent.setup();
      await user.click(tab('Profile'));
      await user.type(screen.getByLabelText('Instagram'), 'https://instagram.com/newhandle');
      // no scheme typed: the dashboard adds https:// (the backend requires it)
      await user.type(screen.getByLabelText('YouTube'), 'youtube.com/@me');
      await user.click(screen.getByRole('button', { name: /save links/i }));
      expect(await screen.findByText('Links saved.')).toBeInTheDocument();
      expect(calls).toBe(1);
      expect(payload).toMatchObject({
        instagramUrl: 'https://instagram.com/newhandle',
        youtubeUrl: 'https://youtube.com/@me',
        tiktokUrl: '',
        twitterUrl: '',
        contactEmail: '',
      });
    });

    it('shows the server message when a link is rejected', async () => {
      server.use(
        http.put(`${API}/v1/users/profile/:id`, () =>
          HttpResponse.json({ error: 'Enter a valid email address' }, { status: 400 })),
      );
      await loadDashboard();
      const user = userEvent.setup();
      await user.click(tab('Profile'));
      await user.type(screen.getByLabelText('Contact email'), 'not-an-email');
      await user.click(screen.getByRole('button', { name: /save links/i }));
      expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    });

    it('opens the edit profile wizard', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await user.click(tab('Profile'));
      await user.click(screen.getByRole('button', { name: /edit profile/i }));
      expect(screen.getByTestId('edit-profile-wizard')).toBeInTheDocument();
    });

    it('generates and saves the agreement PDF', async () => {
      const { __mockPdf } = await import('jspdf');
      await loadDashboard();
      const user = userEvent.setup();
      await user.click(tab('Profile'));
      await user.click(screen.getByRole('button', { name: /download agreement/i }));
      expect(__mockPdf.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('Settings — account', () => {
    it('opens the change-password wizard', async () => {
      await loadDashboard(undefined, '/artistDashboard#settings');
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /change password/i }));
      expect(screen.getByTestId('change-password-wizard')).toBeInTheDocument();
    });

    it('opens the delete-account wizard', async () => {
      await loadDashboard(undefined, '/artistDashboard#settings');
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /delete account/i }));
      expect(screen.getByTestId('delete-account-wizard')).toBeInTheDocument();
    });
  });
});
