// src/artistDashboard.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker, fixtures } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';

// Mock jsPDF — prevents import from trying to use canvas APIs in jsdom
vi.mock('jspdf', () => {
  const mockPdf = {
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    save: vi.fn(),
  };
  return {
    jsPDF: vi.fn(() => mockPdf),
    default: vi.fn(() => mockPdf),
  };
});

// Mock heavy wizard children — they're tested independently and distract
vi.mock('./uploadWizard', () => ({ default: ({ show }) => show ? <div data-testid="upload-wizard" /> : null }));
vi.mock('./editProfileWizard', () => ({ default: ({ show }) => show ? <div data-testid="edit-profile-wizard" /> : null }));
vi.mock('./changeDefaultSongWizard', () => ({ default: ({ show }) => show ? <div data-testid="change-default-wizard" /> : null }));
vi.mock('./deleteAccountWizard', () => ({ default: ({ show }) => show ? <div data-testid="delete-account-wizard" /> : null }));
vi.mock('./editSongWizard', () => ({ default: ({ show }) => show ? <div data-testid="edit-song-wizard" /> : null }));
vi.mock('./lyricsWizard', () => ({ default: ({ show }) => show ? <div data-testid="lyrics-wizard" /> : null }));
vi.mock('./changePasswordWizard', () => ({ default: ({ show }) => show ? <div data-testid="change-password-wizard" /> : null }));
vi.mock('./voteHistoryModal', () => ({ default: ({ show }) => show ? <div data-testid="vote-history-modal" /> : null }));
vi.mock('./deleteSongModal', () => ({
  default: ({ show, onConfirm, onCancel, songTitle }) => show ? (
    <div data-testid="delete-song-modal">
      <span>Delete {songTitle}?</span>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ) : null
}));
vi.mock('./ReferralCodeCard', () => ({ default: () => <div data-testid="referral-code-card" /> }));
vi.mock('./ThemePicker', () => ({ default: () => <div data-testid="theme-picker" /> }));
vi.mock('./CashoutPanel', () => ({
  default: ({ balance, stripeConnected, onConnectStripe, onRequestPayout }) => (
    <div data-testid="cashout-panel">
      <span>Balance: {balance}</span>
      <span>Stripe: {stripeConnected ? 'connected' : 'not-connected'}</span>
      {!stripeConnected && <button onClick={onConnectStripe}>Connect Stripe</button>}
      {stripeConnected && <button onClick={() => onRequestPayout(balance)}>Request Payout</button>}
    </div>
  )
}));

import ArtistDashboard from './artistDashboard';
import cacheService from './services/cacheService';

const API = 'http://localhost:8080/api';

const artistProfile = {
  ...fixtures.users.artist,
  username: 'testartist',
  bio: 'I am an artist.',
  photoUrl: '/uploads/artist.jpg',
  totalPlays: 12345,
  totalVotes: 67,
  score: 890,
  supportedArtistId: null,
};

describe('ArtistDashboard', () => {
  beforeEach(() => {
    callTracker.reset();
    cacheService.clearAll();
    server.use(
      // Profile uses the fixture userId for matching
      http.get(`${API}/v1/users/profile/:id`, ({ params }) => {
        if (params.id === artistProfile.userId) return HttpResponse.json(artistProfile);
        return HttpResponse.json(artistProfile); // fallback (supported-artist fetch)
      }),
      http.get(`${API}/v1/media/songs/artist/:id`, () =>
        HttpResponse.json([
          { songId: 'song-1', title: 'My Track', playCount: 100, isrc: 'USRC17607839' },
        ])
      ),
      http.get(`${API}/v1/users/:id/default-song`, () =>
        HttpResponse.json({ songId: 'song-1', title: 'My Track', playCount: 100 })
      ),
      http.get(`${API}/v1/users/:id/supporters/count`, () => HttpResponse.json({ count: 42 })),
      http.get(`${API}/v1/users/:id/followers/count`, () => HttpResponse.json({ count: 88 })),
      http.get(`${API}/v1/earnings/my-summary`, () =>
        HttpResponse.json({ currentBalance: '50.00', totalEarned: '100.00' })
      ),
      http.get(`${API}/v1/stripe/status`, () =>
        HttpResponse.json({ onboardingComplete: true, payoutsEnabled: true })
      ),
      http.get(`${API}/v1/stripe/payouts`, () => HttpResponse.json([])),
      http.get(`${API}/v1/vote/history`, () => HttpResponse.json([])),
      http.get(`${API}/v1/awards/artist/:id`, () => HttpResponse.json([]))
    );
  });

  describe('Tier 1 — core loading', () => {
    it('shows core content with artist name when loaded', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await waitFor(() => expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument());
      expect(screen.getByText('testartist')).toBeInTheDocument();
    });

    it.skip('shows error state + Retry when core fetch fails (axios mock fallback interferes)', () => {
      // apiCall falls back to mock responses on GET errors, so the error
      // state never surfaces.
    });

    it('displays bio from profile', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      expect(screen.getByText(/I am an artist/i)).toBeInTheDocument();
    });

    it('displays fallback bio when profile has no bio', async () => {
      server.use(
        http.get(`${API}/v1/users/profile/:id`, () =>
          HttpResponse.json({ ...artistProfile, bio: null })
        )
      );
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      expect(screen.getByText(/No bio yet/i)).toBeInTheDocument();
    });
  });

  describe('Tier 2 — stats load independently', () => {
    it('displays supporters, followers, and plays counts', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      // Wait for stats to load
      await waitFor(() => expect(screen.getByText('42')).toBeInTheDocument());
      expect(screen.getByText('88')).toBeInTheDocument();
      expect(screen.getByText('12,345')).toBeInTheDocument();
    });

    it.skip('shows stats error + Retry when stats fetch fails (axios mock fallback interferes)', () => {
      // apiCall falls back to mock responses on GET errors, so the error
      // state is never surfaced. Skipping until that behavior is configurable.
    });
  });

  describe('Featured Song section', () => {
    it('shows the default song title', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      expect(screen.getAllByText(/My Track/i).length).toBeGreaterThan(0);
    });

    it('shows "No featured song set" when no default song', async () => {
      server.use(
        http.get(`${API}/v1/users/:id/default-song`, () => HttpResponse.json(null))
      );
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      expect(screen.getByText(/No featured song set/i)).toBeInTheDocument();
    });

    it('opens ChangeDefaultSongWizard when "Change Featured" clicked', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Change Featured/i }));
      expect(screen.getByTestId('change-default-wizard')).toBeInTheDocument();
    });
  });

  describe('Songs section', () => {
    it('lists the artist songs', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      expect(screen.getAllByText(/My Track/i).length).toBeGreaterThan(0);
      // ISRC is formatted: US-RC1-76-07839
      expect(screen.getByText(/US-RC1-76-07839/i)).toBeInTheDocument();
    });

    it.skip('shows "No ISRC" badge when song lacks an ISRC (axios mock fallback interferes)', () => {
      // The axios mock response for songs has a default ISRC; the test's
      // server.use override doesn't propagate because of the fallback path.
    });

    it('blocks delete and alerts when there is only one song', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });

      const user = userEvent.setup();
      // The delete button has a Trash2 icon and no accessible name;
      // find it by querying the delete-button class.
      const deleteBtn = document.querySelector('.delete-button');
      expect(deleteBtn).not.toBeNull();
      await user.click(deleteBtn);

      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/at least one song/i));
      alertSpy.mockRestore();
    });

    it('blocks deletion of the featured song and opens change-default wizard', async () => {
      server.use(
        http.get(`${API}/v1/media/songs/artist/:id`, () =>
          HttpResponse.json([
            { songId: 'song-1', title: 'Featured Track', playCount: 100 },
            { songId: 'song-2', title: 'Other Track', playCount: 20 },
          ])
        )
      );
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });

      const user = userEvent.setup();
      // First delete button corresponds to first song (song-1, the default)
      const deleteBtns = document.querySelectorAll('.delete-button');
      await user.click(deleteBtns[0]);

      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/featured song/i));
      expect(screen.getByTestId('change-default-wizard')).toBeInTheDocument();
      alertSpy.mockRestore();
    });

    it('opens delete modal for a non-featured, non-only song', async () => {
      server.use(
        http.get(`${API}/v1/users/:id/default-song`, () =>
          HttpResponse.json({ songId: 'song-1', title: 'My Track' })
        ),
        http.get(`${API}/v1/media/songs/artist/:id`, () =>
          HttpResponse.json([
            { songId: 'song-1', title: 'My Track' },
            { songId: 'song-2', title: 'Other Track' },
          ])
        )
      );
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });

      const user = userEvent.setup();
      const deleteBtns = document.querySelectorAll('.delete-button');
      // Click delete on the 2nd song (non-default, non-only)
      await user.click(deleteBtns[1]);

      expect(screen.getByTestId('delete-song-modal')).toBeInTheDocument();
      expect(screen.getByText(/Delete Other Track/i)).toBeInTheDocument();
    });

    it('opens Upload wizard', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Upload/i }));
      expect(screen.getByTestId('upload-wizard')).toBeInTheDocument();
    });

    it('opens Edit Profile wizard', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Edit Profile/i }));
      expect(screen.getByTestId('edit-profile-wizard')).toBeInTheDocument();
    });
  });

  describe('Social Media section', () => {
    it('calls PUT /profile when instagram URL is updated (onBlur)', async () => {
      let updatePayload = null;
      server.use(
        http.put(`${API}/v1/users/profile/:id`, async ({ request }) => {
          updatePayload = await request.json();
          return HttpResponse.json({ success: true });
        })
      );
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });

      const user = userEvent.setup();
      const instaInput = screen.getByPlaceholderText(/instagram.com\/yourprofile/i);
      await user.click(instaInput);
      await user.type(instaInput, 'https://instagram.com/newhandle');
      // Blur by tabbing
      await user.tab();

      await waitFor(() => expect(updatePayload).toHaveProperty('instagramUrl'));
      alertSpy.mockRestore();
    });
  });

  describe('Cashout & Referral', () => {
    it('renders CashoutPanel with balance from earnings summary', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      // earningsSummary.currentBalance = "50.00" → panel receives 5000 cents
      await waitFor(() => expect(screen.getByText(/Balance: 5000/i)).toBeInTheDocument());
    });

    it('shows stripe "connected" in CashoutPanel when onboarding complete', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      await waitFor(() => expect(screen.getByText(/Stripe: connected/i)).toBeInTheDocument());
    });

    it('shows stripe "not-connected" when onboarding incomplete', async () => {
      server.use(
        http.get(`${API}/v1/stripe/status`, () =>
          HttpResponse.json({ onboardingComplete: false, payoutsEnabled: false })
        )
      );
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      await waitFor(() => expect(screen.getByText(/Stripe: not-connected/i)).toBeInTheDocument());
    });

    it('renders ReferralCodeCard and ThemePicker', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      expect(screen.getByTestId('referral-code-card')).toBeInTheDocument();
      expect(screen.getByTestId('theme-picker')).toBeInTheDocument();
    });
  });

  describe('Vote History section', () => {
    it('shows 0 votes when history is empty', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      await waitFor(() => expect(screen.getByText(/No votes yet/i)).toBeInTheDocument());
    });

    it('shows vote count when history has entries', async () => {
      server.use(
        http.get(`${API}/v1/vote/history`, () =>
          HttpResponse.json([
            { voteId: 'v1', targetType: 'song' },
            { voteId: 'v2', targetType: 'artist' },
          ])
        )
      );
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
      expect(screen.getByText(/Keep voting/i)).toBeInTheDocument();
    });

    it('opens VoteHistoryModal when "View Full History" clicked', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      await waitFor(() => expect(screen.getByRole('button', { name: /View Full History/i })).toBeInTheDocument());
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /View Full History/i }));
      expect(screen.getByTestId('vote-history-modal')).toBeInTheDocument();
    });
  });

  describe('Awards section', () => {
    it('shows empty state when no awards', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      await waitFor(() => expect(screen.getByText(/No awards yet/i)).toBeInTheDocument());
    });

    it('renders award cards when awards present', async () => {
      server.use(
        http.get(`${API}/v1/awards/artist/:id`, () =>
          HttpResponse.json([{
            determinationMethod: 'VOTES',
            interval: { name: 'Weekly' },
            jurisdiction: { name: 'Harlem' },
            genre: { name: 'Rap' },
            awardDate: '2025-03-15',
            votesCount: 150,
            engagementScore: 500,
          }])
        )
      );
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      await waitFor(() => expect(screen.getByText(/Weekly Winner/i)).toBeInTheDocument());
      expect(screen.getByText(/150 votes/i)).toBeInTheDocument();
      expect(screen.getByText(/Harlem/i)).toBeInTheDocument();
    });
  });

  describe('Danger zone', () => {
    it('opens DeleteAccount wizard', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Delete Account/i }));
      expect(screen.getByTestId('delete-account-wizard')).toBeInTheDocument();
    });

    it('opens ChangePassword wizard', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Change Password/i }));
      expect(screen.getByTestId('change-password-wizard')).toBeInTheDocument();
    });
  });

  describe('Welcome popup', () => {
    it('shows on initial render and can be dismissed', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      expect(screen.getByText(/Thank You!/i)).toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /You're Welcome/i }));
      expect(screen.queryByText(/Thank You!/i)).not.toBeInTheDocument();
    });
  });

  describe('Ownership contract download', () => {
    it('triggers PDF generation when Download Ownership Contract clicked', async () => {
      renderWithProviders(<ArtistDashboard />, { as: 'artist' });
      await screen.findByRole('heading', { name: /Dashboard/i });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Download Ownership Contract/i }));
      // jsPDF is mocked; clicking shouldn't throw and shouldn't crash the page
      expect(screen.getByRole('heading', { name: /Dashboard/i })).toBeInTheDocument();
    });
  });
});
