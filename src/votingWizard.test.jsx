// src/votingWizard.test.jsx
//
// Tests for VotingWizard — the 3-step vote confirmation flow.
//
// Covers:
//   - Step navigation (1 → 2 → 3)
//   - Name-forward / name-backward validation (case, smart quotes, emoji)
//   - Error code handling (409 duplicate, 403 ineligible, 500 server error)
//   - Jurisdiction resolution: object, string, missing (fetched from nominee)
//   - Dropdown = nominee's chain ∩ voter's eligible jurisdictions
//   - Upfront blockers: guest, phone not verified, no overlap
//   - Points shown match the backend (VOTE_POINTS)

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker, fixtures } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';
import { VOTE_POINTS } from './data/helpContent';
import VotingWizard from './votingWizard';

const API = 'http://localhost:8080/api';

// Stub canvas-confetti so it doesn't blow up in jsdom
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const UNIS = '00000000-0000-0000-0000-000000000001';
const HARLEM = '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3';
const UPTOWN = '52740de0-e4e9-4c9e-b68e-1e170f6788c4';
const DOWNTOWN = '4b09eaa2-03bc-4778-b7c2-db8b42c9e732';

const LISTENER_ID = fixtures.users.listener.userId;

const NOMINEE_PROFILE = {
  userId: 'nominee-001',
  username: 'Tony Fadd',
  jurisdiction: { jurisdictionId: HARLEM, name: 'Harlem' },
  genre: { genreId: '00000000-0000-0000-0000-000000000101', name: 'Rap' },
  photoUrl: 'https://cdn.test/tony.jpg',
};

const makeNominee = (overrides = {}) => ({
  id: 'nominee-001',
  name: 'Tony Fadd',
  type: 'artist',
  genreKey: 'rap',
  jurisdiction: { jurisdictionId: HARLEM, name: 'Harlem' },
  ...overrides,
});

// Profile handler serving both the signed-in voter and the nominee.
const profileHandler = ({ voter = {}, nominee = NOMINEE_PROFILE, nomineeId = 'nominee-001' } = {}) =>
  http.get(`${API}/v1/users/profile/:userId`, ({ params }) => {
    if (params.userId === LISTENER_ID) {
      return HttpResponse.json({
        ...fixtures.users.listener,
        phoneVerified: true,
        score: 7325,
        ...voter,
      });
    }
    if (params.userId === nomineeId) return HttpResponse.json(nominee);
    return new HttpResponse(null, { status: 404 });
  });

const renderWizard = (props = {}, as = 'listener') =>
  renderWithProviders(
    <VotingWizard
      show={true}
      onClose={() => {}}
      onVoteSuccess={() => {}}
      nominee={makeNominee()}
      userId={LISTENER_ID}
      filters={{}}
      {...props}
    />,
    { as }
  );

// Next is disabled until auth + the eligible race have loaded.
const clickNext = async (user) => {
  const next = screen.getByRole('button', { name: /next/i });
  await waitFor(() => expect(next).toBeEnabled());
  await user.click(next);
};

const goToStep3 = async () => {
  const user = userEvent.setup();
  await screen.findByText(/Tony Fadd/);
  await clickNext(user);
  await screen.findByText(/Final Confirmation/i);
  await clickNext(user);
  await screen.findByText(/Type the name/i);
  return user;
};

const typeNames = async (user, forward, backward) => {
  await user.type(screen.getByLabelText(/forward/i), forward);
  await user.type(screen.getByLabelText(/backward/i), backward);
};

describe('VotingWizard', () => {
  beforeEach(() => {
    callTracker.reset();
    server.use(
      profileHandler(),
      // Real API order: root → leaf.
      http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, () =>
        HttpResponse.json([
          { jurisdictionId: UNIS, name: 'Unis' },
          { jurisdictionId: HARLEM, name: 'Harlem' },
        ])
      ),
      // Where THIS voter can vote (voting-enabled ancestors of their home).
      http.get(`${API}/v1/vote/eligible-jurisdictions`, () =>
        HttpResponse.json([
          { jurisdictionId: UPTOWN, name: 'Uptown Harlem' },
          { jurisdictionId: HARLEM, name: 'Harlem' },
          { jurisdictionId: UNIS, name: 'Unis' },
        ])
      )
    );
  });

  // ========================================================================
  // Rendering
  // ========================================================================
  describe('rendering', () => {
    it('returns null when show is false', () => {
      const { container } = renderWithProviders(
        <VotingWizard show={false} onClose={() => {}} nominee={makeNominee()} userId="u1" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders nominee name in step 1', async () => {
      renderWizard();
      expect(await screen.findByText(/Tony Fadd/)).toBeInTheDocument();
      expect(screen.getByText(/Confirm Your Vote For/i)).toBeInTheDocument();
    });

    it('offers every defined interval, including Midterm', async () => {
      renderWizard({ filters: { selectedInterval: 'midterm' } });
      const select = await screen.findByLabelText(/interval/i);
      const labels = within(select).getAllByRole('option').map((o) => o.textContent);
      expect(labels).toEqual(['Day', 'Week', 'Month', 'Quarter', 'Midterm', 'Year']);
      expect(select).toHaveValue('midterm');
    });
  });

  // ========================================================================
  // Jurisdiction resolution — 3 code paths
  // ========================================================================
  describe('jurisdiction resolution', () => {
    it('resolves from a full jurisdiction object (Path 1)', async () => {
      let breadcrumbCalledWith = null;
      server.use(
        http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, ({ params }) => {
          breadcrumbCalledWith = params.id;
          return HttpResponse.json([{ jurisdictionId: HARLEM, name: 'Harlem' }]);
        })
      );

      renderWizard();
      await waitFor(() => expect(breadcrumbCalledWith).toBe(HARLEM));
    });

    it('resolves from a string jurisdiction name (Path 2)', async () => {
      let breadcrumbCalledWith = null;
      server.use(
        http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, ({ params }) => {
          breadcrumbCalledWith = params.id;
          return HttpResponse.json([]);
        })
      );

      renderWizard({ nominee: makeNominee({ jurisdiction: 'harlem' }) });
      await waitFor(() => expect(breadcrumbCalledWith).toBe(HARLEM));
    });

    it('fetches the nominee profile when jurisdiction is missing (Path 3)', async () => {
      let breadcrumbCalledWith = null;
      server.use(
        // Own id: profile responses are cached app-wide between tests.
        profileHandler({
          nomineeId: 'nominee-003',
          nominee: { ...NOMINEE_PROFILE, userId: 'nominee-003', jurisdiction: { jurisdictionId: DOWNTOWN, name: 'Downtown Harlem' } },
        }),
        http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, ({ params }) => {
          breadcrumbCalledWith = params.id;
          return HttpResponse.json([]);
        })
      );

      renderWizard({ nominee: makeNominee({ id: 'nominee-003', jurisdiction: null }) });
      await waitFor(() => expect(breadcrumbCalledWith).toBe(DOWNTOWN), { timeout: 3000 });
    });

    it('only offers jurisdictions both the nominee and the voter qualify for', async () => {
      server.use(
        // Nominee is from Downtown Harlem; voter lives in Uptown Harlem.
        http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, () =>
          HttpResponse.json([
            { jurisdictionId: UNIS, name: 'Unis' },
            { jurisdictionId: 'manhattan-id', name: 'Manhattan' }, // voting off
            { jurisdictionId: HARLEM, name: 'Harlem' },
            { jurisdictionId: DOWNTOWN, name: 'Downtown Harlem' },
          ])
        )
      );

      renderWizard({
        nominee: makeNominee({ jurisdiction: { jurisdictionId: DOWNTOWN, name: 'Downtown Harlem' } }),
      });

      const select = await screen.findByLabelText(/jurisdiction/i);
      await waitFor(() => expect(select).toBeEnabled());
      const labels = within(select).getAllByRole('option').map((o) => o.textContent);
      // Most local first; Downtown (voter not eligible) and Manhattan (voting
      // off) are gone.
      expect(labels).toEqual(['Harlem', 'Unis']);
      expect(select).toHaveValue(HARLEM);
    });

    it('blocks with a clear notice when there is no overlap', async () => {
      server.use(
        http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, () =>
          HttpResponse.json([{ jurisdictionId: DOWNTOWN, name: 'Downtown Harlem' }])
        )
      );

      renderWizard({
        nominee: makeNominee({ jurisdiction: { jurisdictionId: DOWNTOWN, name: 'Downtown Harlem' } }),
      });

      expect(await screen.findByText(/Outside your voting area/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('prefers the race the page was showing as the default', async () => {
      renderWizard({ filters: { selectedJurisdiction: 'harlem' } });
      const select = await screen.findByLabelText(/jurisdiction/i);
      await waitFor(() => expect(select).toHaveValue(HARLEM));
    });
  });

  // ========================================================================
  // Upfront blockers — shown on step 1, before any typing
  // ========================================================================
  describe('upfront blockers', () => {
    it('asks guests to sign in instead of letting them through', async () => {
      renderWizard({}, 'guest');
      expect(await screen.findByText(/Sign in to vote/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });

    it('asks unverified users to verify their phone on step 1', async () => {
      server.use(profileHandler({ voter: { phoneVerified: false } }));
      renderWizard();
      expect(await screen.findByText(/Verify your phone to vote/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    });
  });

  // ========================================================================
  // Step navigation
  // ========================================================================
  describe('step navigation', () => {
    it('Next button advances step 1 → step 2', async () => {
      renderWizard();
      const user = userEvent.setup();
      await screen.findByText(/Tony Fadd/);
      await clickNext(user);
      expect(await screen.findByText(/Final Confirmation/i)).toBeInTheDocument();
    });

    it('Back button returns from step 2 to step 1', async () => {
      renderWizard();
      const user = userEvent.setup();
      await screen.findByText(/Tony Fadd/);
      await clickNext(user);
      await screen.findByText(/Final Confirmation/i);

      await user.click(screen.getByRole('button', { name: /back/i }));
      expect(await screen.findByText(/Confirm Your Vote For/i)).toBeInTheDocument();
    });

    it('advances step 2 → step 3 (security check)', async () => {
      renderWizard();
      await goToStep3();
      expect(screen.getByRole('button', { name: /cast vote/i })).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Security check: name forward + backward validation
  // ========================================================================
  describe('name-reversal security check', () => {
    it('keeps Cast Vote disabled when name forward is wrong', async () => {
      renderWizard();
      const user = await goToStep3();
      await typeNames(user, 'Wrong Name', 'ddaF ynoT');

      expect(screen.getByRole('button', { name: /cast vote/i })).toBeDisabled();
      expect(callTracker.get('vote-submit')).toBe(0);
    });

    it('keeps Cast Vote disabled when name backward is wrong', async () => {
      renderWizard();
      const user = await goToStep3();
      await typeNames(user, 'Tony Fadd', 'Wrong Reversed');

      expect(screen.getByRole('button', { name: /cast vote/i })).toBeDisabled();
      expect(callTracker.get('vote-submit')).toBe(0);
    });

    it('accepts case-insensitive matches and stray spaces', async () => {
      renderWizard();
      const user = await goToStep3();
      await typeNames(user, '  tony fadd ', 'DDAF YNOT');
      await user.click(screen.getByRole('button', { name: /cast vote/i }));

      await waitFor(() => expect(callTracker.get('vote-submit')).toBe(1));
    });

    it("accepts iPhone smart quotes for a name like Don't Stop", async () => {
      renderWizard({ nominee: makeNominee({ name: "Don't Stop" }) });
      const user = userEvent.setup();
      await screen.findByText(/Don't Stop/);
      await clickNext(user);
      await screen.findByText(/Final Confirmation/i);
      await clickNext(user);
      await screen.findByText(/Type the name/i);

      await typeNames(user, 'Don’t Stop', 'potS t’noD');
      expect(screen.getByRole('button', { name: /cast vote/i })).toBeEnabled();
    });

    it('reverses emoji names per character, not per code unit', async () => {
      renderWizard({ nominee: makeNominee({ name: 'Lil 🔥' }) });
      const user = userEvent.setup();
      await screen.findByText('Lil 🔥');
      await clickNext(user);
      await screen.findByText(/Final Confirmation/i);
      await clickNext(user);
      await screen.findByText(/Type the name/i);

      expect(screen.getByText('🔥 liL')).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Submit results
  // ========================================================================
  describe('submit handling', () => {
    const submitValidVote = async (user) => {
      await typeNames(user, 'Tony Fadd', 'ddaF ynoT');
      await user.click(screen.getByRole('button', { name: /cast vote/i }));
    };

    it('shows the full-bleed success takeover with the real point value', async () => {
      server.use(
        http.post(`${API}/v1/vote/submit`, () => HttpResponse.json({ success: true }))
      );

      renderWizard();
      const user = await goToStep3();
      await submitValidVote(user);

      expect(await screen.findByText(/vote locked in/i)).toBeInTheDocument();
      expect(screen.getByText(/You backed/i)).toBeInTheDocument();
      // Same number the backend awards and the help center quotes.
      expect(screen.getAllByText(new RegExp(`\\+${VOTE_POINTS}`)).length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    });

    it('shows "Already Voted" on 409 duplicate', async () => {
      server.use(
        http.post(`${API}/v1/vote/submit`, () =>
          HttpResponse.json({ message: 'Duplicate vote' }, { status: 409 })
        )
      );

      renderWizard();
      const user = await goToStep3();
      await submitValidVote(user);

      expect(await screen.findByText(/Already Voted/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /change selection/i })).toBeInTheDocument();
    });

    it('shows ineligible error on 403', async () => {
      server.use(
        http.post(`${API}/v1/vote/submit`, () =>
          HttpResponse.json({ message: 'Not eligible' }, { status: 403 })
        )
      );

      renderWizard();
      const user = await goToStep3();
      await submitValidVote(user);

      expect(await screen.findByText(/Vote Rejected/i)).toBeInTheDocument();
    });

    it('shows the server error (not "Connection Failed") on 500', async () => {
      server.use(
        http.post(`${API}/v1/vote/submit`, () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 })
        )
      );

      renderWizard();
      const user = await goToStep3();
      await submitValidVote(user);

      expect(await screen.findByRole('heading', { name: /Server Error/i })).toBeInTheDocument();
      expect(screen.queryByText(/Connection Failed/i)).toBeNull();
    });
  });

  // ========================================================================
  // Submission payload correctness
  // ========================================================================
  describe('submission payload', () => {
    it('includes all required fields with correct UUIDs', async () => {
      let capturedPayload = null;
      server.use(
        http.post(`${API}/v1/vote/submit`, async ({ request }) => {
          capturedPayload = await request.json();
          return HttpResponse.json({ success: true });
        })
      );

      renderWizard();
      const user = await goToStep3();
      await typeNames(user, 'Tony Fadd', 'ddaF ynoT');
      await user.click(screen.getByRole('button', { name: /cast vote/i }));

      await waitFor(() => expect(capturedPayload).toBeTruthy());

      expect(capturedPayload).toMatchObject({
        userId: LISTENER_ID,
        targetType: 'artist',
        targetId: 'nominee-001',
        genreId: '00000000-0000-0000-0000-000000000101', // rap
        jurisdictionId: HARLEM,
        intervalId: '00000000-0000-0000-0000-000000000201', // daily
      });
      // The server stamps the date in the platform timezone.
      expect(capturedPayload.voteDate).toBeUndefined();
    });
  });
});