// src/votingWizard.test.jsx
//
// Tests for VotingWizard — the 3-step vote confirmation flow.
//
// Covers:
//   - Step navigation (1 → 2 → 3)
//   - Name-forward / name-backward validation (case-insensitive)
//   - Error code handling (409 duplicate, 403 ineligible, 500 network)
//   - Jurisdiction breadcrumb fetching + auto-correction
//   - The 3 jurisdiction-resolution code paths: object, string, missing
//
// Documents bugs in [BUG #N] tests that will flip green once fixed.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker } from './test/mocks/handlers';
import { renderWithProviders } from './test/utils';
import VotingWizard from './votingWizard';

const API = 'http://localhost:8080/api';

// Stub canvas-confetti so it doesn't blow up in jsdom
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const makeNominee = (overrides = {}) => ({
  id: 'nominee-001',
  name: 'Tony Fadd',
  type: 'artist',
  genreKey: 'rap',
  jurisdiction: {
    jurisdictionId: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3',
    name: 'Harlem',
  },
  ...overrides,
});

describe('VotingWizard', () => {
  beforeEach(() => {
    callTracker.reset();
    // Default: breadcrumb returns the Harlem hierarchy
    server.use(
      http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, () =>
        HttpResponse.json([
          { jurisdictionId: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3', name: 'Harlem', votingEnabled: true },
          { jurisdictionId: '52740de0-e4e9-4c9e-b68e-1e170f6788c4', name: 'Uptown Harlem', votingEnabled: true },
          { jurisdictionId: '4b09eaa2-03bc-4778-b7c2-db8b42c9e732', name: 'Downtown Harlem', votingEnabled: true },
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
      renderWithProviders(
        <VotingWizard
          show={true}
          onClose={() => {}}
          onVoteSuccess={() => {}}
          nominee={makeNominee()}
          userId="u1"
          filters={{}}
        />
      );

      expect(await screen.findByText(/Tony Fadd/)).toBeInTheDocument();
      expect(screen.getByText(/Confirm Your Vote For/i)).toBeInTheDocument();
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
          return HttpResponse.json([
            { jurisdictionId: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3', name: 'Harlem', votingEnabled: true },
          ]);
        })
      );

      renderWithProviders(
        <VotingWizard
          show={true}
          onClose={() => {}}
          onVoteSuccess={() => {}}
          nominee={makeNominee({
            jurisdiction: { jurisdictionId: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3', name: 'Harlem' },
          })}
          userId="u1"
          filters={{}}
        />
      );

      await waitFor(() => {
        expect(breadcrumbCalledWith).toBe('1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3');
      });
    });

    it('resolves from a string jurisdiction name (Path 2)', async () => {
      let breadcrumbCalledWith = null;
      server.use(
        http.get(`${API}/v1/jurisdictions/:id/breadcrumb`, ({ params }) => {
          breadcrumbCalledWith = params.id;
          return HttpResponse.json([]);
        })
      );

      renderWithProviders(
        <VotingWizard
          show={true}
          onClose={() => {}}
          onVoteSuccess={() => {}}
          nominee={makeNominee({ jurisdiction: 'harlem' })}
          userId="u1"
          filters={{}}
        />
      );

      // Should look up 'harlem' in JURISDICTION_IDS → '1cf6ceb1-...'
      await waitFor(() => {
        expect(breadcrumbCalledWith).toBe('1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3');
      });
    });

    it('fetches from backend when jurisdiction is missing (Path 3)', async () => {
      let fetchedArtistDetail = false;
      server.use(
        http.get(`${API}/v1/users/:id`, ({ params }) => {
          if (params.id === 'nominee-001') {
            fetchedArtistDetail = true;
            return HttpResponse.json({
              jurisdiction: {
                jurisdictionId: '4b09eaa2-03bc-4778-b7c2-db8b42c9e732',
                name: 'Downtown Harlem',
              },
            });
          }
          return new HttpResponse(null, { status: 404 });
        })
      );

      renderWithProviders(
        <VotingWizard
          show={true}
          onClose={() => {}}
          onVoteSuccess={() => {}}
          nominee={makeNominee({ jurisdiction: null })}
          userId="u1"
          filters={{}}
        />
      );

      await waitFor(
        () => expect(fetchedArtistDetail).toBe(true),
        { timeout: 3000 }
      );
    });
  });

  // ========================================================================
  // Step navigation
  // ========================================================================
  describe('step navigation', () => {
    it('Next button advances step 1 → step 2', async () => {
      renderWithProviders(
        <VotingWizard
          show={true}
          onClose={() => {}}
          onVoteSuccess={() => {}}
          nominee={makeNominee()}
          userId="u1"
          filters={{}}
        />
      );

      await screen.findByText(/Tony Fadd/);
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() =>
        expect(screen.getByText(/Final Confirmation/i)).toBeInTheDocument()
      );
    });

    it('Back button returns from step 2 to step 1', async () => {
      renderWithProviders(
        <VotingWizard
          show={true}
          onClose={() => {}}
          onVoteSuccess={() => {}}
          nominee={makeNominee()}
          userId="u1"
          filters={{}}
        />
      );

      await screen.findByText(/Tony Fadd/);
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText(/Final Confirmation/i);

      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      await waitFor(() =>
        expect(screen.getByText(/Confirm Your Vote For/i)).toBeInTheDocument()
      );
    });

    it('advances step 2 → step 3 (security check)', async () => {
      renderWithProviders(
        <VotingWizard
          show={true}
          onClose={() => {}}
          onVoteSuccess={() => {}}
          nominee={makeNominee()}
          userId="u1"
          filters={{}}
        />
      );

      await screen.findByText(/Tony Fadd/);
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText(/Final Confirmation/i);
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() =>
        expect(screen.getByText(/Secure Your Vote/i)).toBeInTheDocument()
      );
    });
  });

  // ========================================================================
  // Security check: name forward + backward validation
  // ========================================================================
  describe('name-reversal security check', () => {
    const advanceToStep3 = async () => {
      const user = userEvent.setup();
      await screen.findByText(/Tony Fadd/);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText(/Final Confirmation/i);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText(/Secure Your Vote/i);
      return user;
    };

    it('rejects submission when name forward is wrong', async () => {
      renderWithProviders(
        <VotingWizard
          show={true} onClose={() => {}} onVoteSuccess={() => {}}
          nominee={makeNominee()} userId="u1" filters={{}}
        />
      );

      const user = await advanceToStep3();
      const inputs = screen.getAllByRole('textbox');
      await user.type(inputs[0], 'Wrong Name');
      await user.type(inputs[1], 'ddaF ynoT'); // reversed correctly
      await user.click(screen.getByRole('button', { name: /confirm vote/i }));

      await waitFor(() =>
        expect(screen.getByText(/Name Forward Invalid/i)).toBeInTheDocument()
      );
      expect(callTracker.get('vote-submit')).toBe(0);
    });

    it('rejects submission when name backward is wrong', async () => {
      renderWithProviders(
        <VotingWizard
          show={true} onClose={() => {}} onVoteSuccess={() => {}}
          nominee={makeNominee()} userId="u1" filters={{}}
        />
      );

      const user = await advanceToStep3();
      const inputs = screen.getAllByRole('textbox');
      await user.type(inputs[0], 'Tony Fadd');
      await user.type(inputs[1], 'Wrong Reversed');
      await user.click(screen.getByRole('button', { name: /confirm vote/i }));

      await waitFor(() =>
        expect(screen.getByText(/Name Backward Invalid/i)).toBeInTheDocument()
      );
      expect(callTracker.get('vote-submit')).toBe(0);
    });

    it('accepts case-insensitive matches', async () => {
      renderWithProviders(
        <VotingWizard
          show={true} onClose={() => {}} onVoteSuccess={() => {}}
          nominee={makeNominee()} userId="u1" filters={{}}
        />
      );

      const user = await advanceToStep3();
      const inputs = screen.getAllByRole('textbox');
      await user.type(inputs[0], 'tony fadd'); // lowercase
      await user.type(inputs[1], 'DDAF YNOT'); // uppercase reversed
      await user.click(screen.getByRole('button', { name: /confirm vote/i }));

      await waitFor(() => {
        expect(callTracker.get('vote-submit')).toBe(1);
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // 🔴 BUG DOCUMENTATION TEST — from QA_FINDINGS Finding 7
    // Username reversal via `split('').reverse().join('')` corrupts multi-byte
    // unicode characters (emoji, accented chars). Once fixed with a proper
    // grapheme-aware reverse, this test should flip green.
    // ═══════════════════════════════════════════════════════════════════════
    it.todo('[BUG] handles emoji usernames correctly on reversal');
  });

  // ========================================================================
  // Submit error codes
  // ========================================================================
  describe('submit error handling', () => {
    const submitValidVote = async (user) => {
      const inputs = screen.getAllByRole('textbox');
      await user.type(inputs[0], 'Tony Fadd');
      await user.type(inputs[1], 'ddaF ynoT');
      await user.click(screen.getByRole('button', { name: /confirm vote/i }));
    };

    const mountAndGoToStep3 = async () => {
      renderWithProviders(
        <VotingWizard
          show={true} onClose={() => {}} onVoteSuccess={() => {}}
          nominee={makeNominee()} userId="u1" filters={{}}
        />
      );
      const user = userEvent.setup();
      await screen.findByText(/Tony Fadd/);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText(/Final Confirmation/i);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText(/Secure Your Vote/i);
      return user;
    };

    it('shows success screen on 200 OK', async () => {
      server.use(
        http.post(`${API}/v1/vote/submit`, () => HttpResponse.json({ success: true }))
      );

      const user = await mountAndGoToStep3();
      await submitValidVote(user);

      await waitFor(() =>
        expect(screen.getByText(/Vote Recorded/i)).toBeInTheDocument()
      );
    });

    it('shows "Already Voted" on 409 duplicate', async () => {
      server.use(
        http.post(`${API}/v1/vote/submit`, () =>
          HttpResponse.json({ message: 'Duplicate vote' }, { status: 409 })
        )
      );

      const user = await mountAndGoToStep3();
      await submitValidVote(user);

      await waitFor(() =>
        expect(screen.getByText(/Already Voted/i)).toBeInTheDocument()
      );
    });

    it('shows ineligible error on 403', async () => {
      server.use(
        http.post(`${API}/v1/vote/submit`, () =>
          HttpResponse.json({ message: 'Not eligible' }, { status: 403 })
        )
      );

      const user = await mountAndGoToStep3();
      await submitValidVote(user);

      await waitFor(() =>
        expect(screen.getByText(/Vote Rejected/i)).toBeInTheDocument()
      );
    });

    it('shows network error on 500 / other', async () => {
      server.use(
        http.post(`${API}/v1/vote/submit`, () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 })
        )
      );

      const user = await mountAndGoToStep3();
      await submitValidVote(user);

      await waitFor(() =>
        expect(screen.getByText(/Connection Failed/i)).toBeInTheDocument()
      );
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

      renderWithProviders(
        <VotingWizard
          show={true} onClose={() => {}} onVoteSuccess={() => {}}
          nominee={makeNominee()} userId="user-abc" filters={{}}
        />
      );

      const user = userEvent.setup();
      await screen.findByText(/Tony Fadd/);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText(/Final Confirmation/i);
      await user.click(screen.getByRole('button', { name: /next/i }));
      await screen.findByText(/Secure Your Vote/i);

      const inputs = screen.getAllByRole('textbox');
      await user.type(inputs[0], 'Tony Fadd');
      await user.type(inputs[1], 'ddaF ynoT');
      await user.click(screen.getByRole('button', { name: /confirm vote/i }));

      await waitFor(() => {
        expect(capturedPayload).toBeTruthy();
      });

      expect(capturedPayload).toMatchObject({
        userId: 'user-abc',
        targetType: 'artist',
        targetId: 'nominee-001',
        genreId: '00000000-0000-0000-0000-000000000101', // rap
        jurisdictionId: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3', // harlem
        intervalId: '00000000-0000-0000-0000-000000000201', // daily
      });
      // voteDate should be today's date in YYYY-MM-DD
      expect(capturedPayload.voteDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
