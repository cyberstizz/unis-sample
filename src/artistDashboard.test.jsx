// src/artistDashboard.test.jsx
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
  const mockPdf = { setTextColor: vi.fn(), setFontSize: vi.fn(), setFont: vi.fn(), text: vi.fn(), save: vi.fn() };
  return { jsPDF: vi.fn(() => mockPdf), default: vi.fn(() => mockPdf) };
});

// Wizards / modals — tested independently (inline factories: vi.mock is hoisted)
vi.mock('./uploadWizard', () => ({ default: ({ show }) => (show ? <div data-testid="upload-wizard" /> : null) }));
vi.mock('./editProfileWizard', () => ({ default: ({ show }) => (show ? <div data-testid="edit-profile-wizard" /> : null) }));
vi.mock('./changeDefaultSongWizard', () => ({ default: ({ show }) => (show ? <div data-testid="change-default-wizard" /> : null) }));
vi.mock('./deleteAccountWizard', () => ({ default: ({ show }) => (show ? <div data-testid="delete-account-wizard" /> : null) }));
vi.mock('./editSongWizard', () => ({ default: ({ show }) => (show ? <div data-testid="edit-song-wizard" /> : null) }));
vi.mock('./lyricsWizard', () => ({ default: ({ show }) => (show ? <div data-testid="lyrics-wizard" /> : null) }));
vi.mock('./changePasswordWizard', () => ({ default: ({ show }) => (show ? <div data-testid="change-password-wizard" /> : null) }));
vi.mock('./voteHistoryModal', () => ({ default: ({ show }) => (show ? <div data-testid="vote-history-modal" /> : null) }));
vi.mock('./SongStatsModal', () => ({ default: ({ show }) => (show ? <div data-testid="song-stats-modal" /> : null) }));
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
vi.mock('./SupporterSection', () => ({ default: () => <div data-testid="supporter-section" /> }));
vi.mock('./dempgraphicsSection', () => ({ default: () => <div data-testid="demographics-section" /> }));
vi.mock('./VoteHistorySection', () => ({ default: () => <div data-testid="vote-history-section" /> }));
vi.mock('./SupportedArtistPicker', () => ({ default: () => <div data-testid="supported-artist-picker" /> }));
vi.mock('./RevenueSection', () => ({ default: () => <div data-testid="revenue-section" /> }));
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

function installCore({ summary = summaryFor(), defaultSong = { songId: 'song-1', title: 'My Track', playCount: 100 }, songs, awards = [] } = {}) {
  server.use(
    http.get(`${API}/v1/users/profile-summary/:id`, () => HttpResponse.json(summary)),
    http.get(`${API}/v1/media/songs/artist/:id`, () =>
      HttpResponse.json(songs || [{ songId: 'song-1', title: 'My Track', playCount: 100, isrc: 'USRC17607839' }])),
    http.get(`${API}/v1/users/:id/default-song`, () => HttpResponse.json(defaultSong)),
    http.get(`${API}/v1/users/:id/supporters/count`, () => HttpResponse.json({ count: 42 })),
    http.get(`${API}/v1/users/:id/followers/count`, () => HttpResponse.json({ count: 88 })),
    http.get(`${API}/v1/users/:id/total-plays`, () => HttpResponse.json({ totalPlays: 12345 })),
    http.get(`${API}/v1/users/:id/total-votes`, () => HttpResponse.json({ totalVotes: 67 })),
    http.get(`${API}/v1/earnings/my-summary`, () => HttpResponse.json({ currentBalance: '50.00', totalEarned: '100.00' })),
    http.get(`${API}/v1/stripe/status`, () => HttpResponse.json({ onboardingComplete: true, payoutsEnabled: true })),
    http.get(`${API}/v1/stripe/payouts`, () => HttpResponse.json([])),
    http.get(`${API}/v1/vote/history`, () => HttpResponse.json([])),
    http.get(`${API}/v1/awards/artist/:id/songs`, () => HttpResponse.json([])),
    http.get(`${API}/v1/awards/artist/:id`, () => HttpResponse.json(awards)),
  );
}

// click every collapsed collapsible trigger so its content mounts
async function expandAll(user) {
  for (let i = 0; i < 12; i++) {
    const collapsed = screen.queryAllByRole('button', { expanded: false })
      .filter((b) => (b.className || '').includes('artist-collapsible__trigger'));
    if (!collapsed.length) break;
    // eslint-disable-next-line no-await-in-loop
    await user.click(collapsed[0]);
  }
}

async function loadDashboard(opts) {
  installCore(opts);
  renderWithProviders(<ArtistDashboard />, { as: 'artist' });
  await screen.findByRole('heading', { name: /testartist/i }, { timeout: 10000 });
}

async function dismissWelcome(user) {
  const btn = screen.queryByRole('button', { name: /You're Welcome/i });
  if (btn) await user.click(btn);
}

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

  describe('Core loading', () => {
    it('shows the artist name once loaded', async () => {
      await loadDashboard();
      expect(screen.getByRole('heading', { name: /testartist/i })).toBeInTheDocument();
    });

    it('displays the bio', async () => {
      await loadDashboard();
      expect(screen.getByText(/I am an artist/i)).toBeInTheDocument();
    });

    it('shows a fallback when there is no bio', async () => {
      await loadDashboard({ summary: summaryFor({ bio: null }) });
      expect(screen.getByText(/No bio yet/i)).toBeInTheDocument();
    });
  });

  describe('Featured song', () => {
    it('shows the featured song title', async () => {
      await loadDashboard();
      expect(screen.getAllByText(/My Track/i).length).toBeGreaterThan(0);
    });

    it('shows the empty state when no featured song', async () => {
      await loadDashboard({ defaultSong: null });
      expect(screen.getByText(/No featured song/i)).toBeInTheDocument();
    });
  });

  describe('Stats', () => {
    it('shows supporters and plays counts', async () => {
      await loadDashboard();
      await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
      expect(screen.getByText('12,345')).toBeInTheDocument();
    });
  });

  describe('Welcome popup', () => {
    it('shows on load and dismisses', async () => {
      await loadDashboard();
      expect(screen.getByText(/Thank You/i)).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /You're Welcome/i }));
      expect(screen.queryByText(/Thank You/i)).not.toBeInTheDocument();
    });
  });

  describe('Header actions', () => {
    it('opens the upload wizard', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await dismissWelcome(user);
      await user.click(screen.getAllByRole('button', { name: /upload/i })[0]);
      expect(screen.getByTestId('upload-wizard')).toBeInTheDocument();
    });

    it('opens the edit profile wizard', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await dismissWelcome(user);
      await user.click(screen.getByRole('button', { name: /edit profile/i }));
      expect(screen.getByTestId('edit-profile-wizard')).toBeInTheDocument();
    });
  });

  describe('Growth checklist', () => {
    it('lists the phone-verification task when unverified', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      expect(await screen.findByText(/Verify your phone number/i)).toBeInTheDocument();
    });

    it('omits the phone task when the artist is verified', async () => {
      server.use(
        http.get(`${API}/v1/users/profile/:userId`, () =>
          HttpResponse.json({ ...fixtures.users.artist, phoneVerified: true })),
      );
      await loadDashboard();
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      expect(screen.queryByText(/Verify your phone number/i)).not.toBeInTheDocument();
    });
  });

  describe('Trophy case', () => {
    it('shows the empty state when there are no awards', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      expect(await screen.findByText(/No artist awards yet/i)).toBeInTheDocument();
    });

    it('renders the short interval badge for an award', async () => {
      await loadDashboard({
        awards: [{
          interval: { name: 'Weekly' },
          jurisdiction: { name: 'Harlem' },
          genre: { name: 'Rap' },
          awardDate: '2025-03-15',
        }],
      });
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      expect((await screen.findAllByText(/Artist of the Week/i)).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Week').length).toBeGreaterThan(0);
    });
  });

  describe('Danger zone', () => {
    it('opens the change-password wizard', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      await user.click(screen.getByRole('button', { name: /change password/i }));
      expect(screen.getByTestId('change-password-wizard')).toBeInTheDocument();
    });

    it('opens the delete-account wizard', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      await user.click(screen.getByRole('button', { name: /delete account/i }));
      expect(screen.getByTestId('delete-account-wizard')).toBeInTheDocument();
    });
  });

  describe('Songs — delete rules', () => {
    it('blocks deleting the only song with an alert', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      await loadDashboard();
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      await user.click(screen.getByRole('button', { name: 'Delete My Track' }));
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/at least one song/i));
      expect(screen.queryByTestId('delete-song-modal')).not.toBeInTheDocument();
      alertSpy.mockRestore();
    });

    it('blocks deleting the featured song and opens the change-default wizard', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      await loadDashboard({
        songs: [
          { songId: 'song-1', title: 'Featured Track', playCount: 100 },
          { songId: 'song-2', title: 'Other Track', playCount: 20 },
        ],
        defaultSong: { songId: 'song-1', title: 'Featured Track' },
      });
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      await user.click(screen.getByRole('button', { name: 'Delete Featured Track' }));
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/featured song/i));
      expect(screen.getByTestId('change-default-wizard')).toBeInTheDocument();
      alertSpy.mockRestore();
    });

    it('opens the delete modal for a normal song', async () => {
      await loadDashboard({
        songs: [
          { songId: 'song-1', title: 'Featured Track', playCount: 100 },
          { songId: 'song-2', title: 'Other Track', playCount: 20 },
        ],
        defaultSong: { songId: 'song-1', title: 'Featured Track' },
      });
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      await user.click(screen.getByRole('button', { name: 'Delete Other Track' }));
      expect(screen.getByTestId('delete-song-modal')).toBeInTheDocument();
      expect(screen.getByText(/Delete Other Track/i)).toBeInTheDocument();
    });
  });

  describe('ISRC formatting', () => {
    it('formats the ISRC in the songs list', async () => {
      await loadDashboard({ songs: [{ songId: 'song-1', title: 'My Track', isrc: 'USRC17607839' }] });
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      expect(await screen.findByText(/US-RC1-76-07839/i)).toBeInTheDocument();
    });
  });

  describe('Social media', () => {
    it('PUTs the profile when the instagram field blurs', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      let payload = null;
      server.use(
        http.put(`${API}/v1/users/profile/:id`, async ({ request }) => {
          payload = await request.json();
          return HttpResponse.json({ success: true });
        }),
      );
      await loadDashboard();
      const user = userEvent.setup();
      await dismissWelcome(user);
      await expandAll(user);
      const input = screen.getByPlaceholderText(/instagram\.com\/yourprofile/i);
      await user.click(input);
      await user.type(input, 'https://instagram.com/newhandle');
      await user.tab();
      await waitFor(() => expect(payload).toHaveProperty('instagramUrl'));
      expect(payload.instagramUrl).toMatch(/newhandle/);
      alertSpy.mockRestore();
    });
  });

  describe('Ownership contract', () => {
    it('triggers the PDF without crashing', async () => {
      await loadDashboard();
      const user = userEvent.setup();
      await dismissWelcome(user);
      await user.click(screen.getByRole('button', { name: /agreement/i }));
      expect(screen.getByRole('heading', { name: /testartist/i })).toBeInTheDocument();
    });
  });

});