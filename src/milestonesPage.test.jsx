// src/milestonesPage.test.jsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { renderWithProviders } from './test/utils';
import MilestonesPage from './milestonesPage';

const API = 'http://localhost:8080/api';

// Capture the query string the page sends so tests can assert on it
let lastAwardsQuery = null;

describe('MilestonesPage', () => {
  beforeEach(() => {
    lastAwardsQuery = null;
    server.use(
      http.get(`${API}/v1/awards/past`, ({ request }) => {
        const url = new URL(request.url);
        lastAwardsQuery = Object.fromEntries(url.searchParams);
        return HttpResponse.json([]);
      })
    );
  });

  describe('initial render', () => {
    it('renders all filter controls with correct defaults', () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      // 4 selects: location, genre, category, interval
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(4);
      // Default location = Downtown Harlem
      expect(screen.getByDisplayValue(/Downtown Harlem/i)).toBeInTheDocument();
      // Default genre = Rap
      expect(screen.getByDisplayValue(/^Rap$/i)).toBeInTheDocument();
      // Default category = Song
      expect(screen.getByDisplayValue(/^Song$/i)).toBeInTheDocument();
      // Default interval = Daily
      expect(screen.getByDisplayValue(/^Daily$/i)).toBeInTheDocument();
    });

    it('renders the View button', () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      expect(screen.getByRole('button', { name: /^View$/i })).toBeInTheDocument();
    });

    it('does not show a caption before View is clicked', () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      // No displayed context yet → no caption
      expect(screen.queryByText(/OF THE DAY/i)).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows "Select a date" error if View clicked without a date', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /^View$/i }));
      await waitFor(() => expect(screen.getByText(/Select a date/i)).toBeInTheDocument());
    });

    it('shows "No awards found" when API returns an empty array', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      // Set the date input directly
      const dateInput = document.querySelector('input[type="date"]');
      expect(dateInput).not.toBeNull();
      const user = userEvent.setup();
      await user.type(dateInput, '2025-11-15');

      await user.click(screen.getByRole('button', { name: /^View$/i }));
      await waitFor(() => expect(screen.getByText(/No awards found/i)).toBeInTheDocument());
    });

    it('surfaces API errors', async () => {
      server.use(
        http.get(`${API}/v1/awards/past`, () =>
          HttpResponse.json({ message: 'boom' }, { status: 500 })
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const dateInput = document.querySelector('input[type="date"]');
      const user = userEvent.setup();
      await user.type(dateInput, '2025-11-15');
      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(screen.getByText(/Failed to load milestones|No awards found/i)).toBeInTheDocument());
    });
  });

  describe('API call parameters', () => {
    it('sends daily interval with startDate=endDate', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const dateInput = document.querySelector('input[type="date"]');
      const user = userEvent.setup();
      await user.type(dateInput, '2025-11-15');
      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(lastAwardsQuery).not.toBeNull());
      expect(lastAwardsQuery.startDate).toBe('2025-11-15');
      expect(lastAwardsQuery.endDate).toBe('2025-11-15');
      expect(lastAwardsQuery.type).toBe('song');
    });

    it('sends weekly interval with Mon–Sun range', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const user = userEvent.setup();
      // Set date FIRST while in default daily mode (so native input[type=date] exists)
      const dateInput = document.querySelector('input[type="date"]');
      // Nov 15 2025 = Saturday. Monday = Nov 10, Sunday = Nov 16
      await user.type(dateInput, '2025-11-15');

      // Now change interval to weekly
      const intervalSelect = screen.getByDisplayValue(/^Daily$/i);
      await user.selectOptions(intervalSelect, 'weekly');

      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(lastAwardsQuery).not.toBeNull());
      expect(lastAwardsQuery.startDate).toBe('2025-11-10');
      expect(lastAwardsQuery.endDate).toBe('2025-11-16');
    });

    it('sends monthly interval as full month range', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const user = userEvent.setup();
      const dateInput = document.querySelector('input[type="date"]');
      await user.type(dateInput, '2025-11-15');

      const intervalSelect = screen.getByDisplayValue(/^Daily$/i);
      await user.selectOptions(intervalSelect, 'monthly');

      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(lastAwardsQuery).not.toBeNull());
      expect(lastAwardsQuery.startDate).toBe('2025-11-01');
      expect(lastAwardsQuery.endDate).toBe('2025-11-30');
    });

    it('sends quarterly interval with quarter boundary range', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const user = userEvent.setup();
      const dateInput = document.querySelector('input[type="date"]');
      // Nov 15 is in Q4 (Oct–Dec)
      await user.type(dateInput, '2025-11-15');

      const intervalSelect = screen.getByDisplayValue(/^Daily$/i);
      await user.selectOptions(intervalSelect, 'quarterly');

      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(lastAwardsQuery).not.toBeNull());
      expect(lastAwardsQuery.startDate).toBe('2025-10-01');
      expect(lastAwardsQuery.endDate).toBe('2025-12-31');
    });

    it('sends annual interval as full year range', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const user = userEvent.setup();
      const dateInput = document.querySelector('input[type="date"]');
      await user.type(dateInput, '2024-06-15');

      const intervalSelect = screen.getByDisplayValue(/^Daily$/i);
      await user.selectOptions(intervalSelect, 'annual');

      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(lastAwardsQuery).not.toBeNull());
      expect(lastAwardsQuery.startDate).toBe('2024-01-01');
      expect(lastAwardsQuery.endDate).toBe('2024-12-31');
    });

    it('sends midterm interval as half-year range (H2 example)', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const user = userEvent.setup();
      const dateInput = document.querySelector('input[type="date"]');
      await user.type(dateInput, '2025-11-15'); // H2

      const intervalSelect = screen.getByDisplayValue(/^Daily$/i);
      await user.selectOptions(intervalSelect, 'midterm');

      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(lastAwardsQuery).not.toBeNull());
      expect(lastAwardsQuery.startDate).toBe('2025-07-01');
      expect(lastAwardsQuery.endDate).toBe('2025-12-31');
    });

    it('includes jurisdictionId, genreId, and intervalId in the query', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const dateInput = document.querySelector('input[type="date"]');
      const user = userEvent.setup();
      await user.type(dateInput, '2025-11-15');
      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(lastAwardsQuery).not.toBeNull());
      expect(lastAwardsQuery.jurisdictionId).toBeTruthy();
      expect(lastAwardsQuery.genreId).toBeTruthy();
      expect(lastAwardsQuery.intervalId).toBeTruthy();
    });

    it('changes category=artist when Artist selected', async () => {
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const user = userEvent.setup();
      const categorySelect = screen.getByDisplayValue(/^Song$/i);
      await user.selectOptions(categorySelect, 'artist');

      const dateInput = document.querySelector('input[type="date"]');
      await user.type(dateInput, '2025-11-15');
      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(lastAwardsQuery).not.toBeNull());
      expect(lastAwardsQuery.type).toBe('artist');
    });
  });

  describe('winner display', () => {
    it('renders the winner with caption, stats, and artwork', async () => {
      server.use(
        http.get(`${API}/v1/awards/past`, () =>
          HttpResponse.json([
            {
              targetId: 'w1',
              targetType: 'song',
              song: { title: 'Champion Track', artist: { username: 'winner_artist' }, artworkUrl: '/art.jpg' },
              jurisdiction: { name: 'Downtown Harlem' },
              votesCount: 42,
              weightedPoints: 100,
              playsCount: 500,
              likesCount: 88,
              determinationMethod: 'WEIGHTED_VOTES',
              tiedCandidatesCount: 0,
            },
          ])
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const dateInput = document.querySelector('input[type="date"]');
      const user = userEvent.setup();
      await user.type(dateInput, '2025-11-15');
      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(screen.getByText('Champion Track')).toBeInTheDocument());
      expect(screen.getByText('winner_artist')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument(); // weightedPoints
      expect(screen.getByText('42')).toBeInTheDocument();  // votes
      expect(screen.getByText('500')).toBeInTheDocument(); // plays
      expect(screen.getByText('88')).toBeInTheDocument();  // likes
      expect(screen.getByText(/100 pts/)).toBeInTheDocument(); // WEIGHTED_VOTES badge
    });

    it('shows PLAYS tiebreaker badge when that is the determination method', async () => {
      server.use(
        http.get(`${API}/v1/awards/past`, () =>
          HttpResponse.json([{
            targetId: 'w1',
            targetType: 'song',
            song: { title: 'Tied Track' },
            jurisdiction: { name: 'Downtown Harlem' },
            votesCount: 10, weightedPoints: 50, playsCount: 999, likesCount: 5,
            determinationMethod: 'PLAYS', tiedCandidatesCount: 3,
          }])
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const dateInput = document.querySelector('input[type="date"]');
      const user = userEvent.setup();
      await user.type(dateInput, '2025-11-15');
      await user.click(screen.getByRole('button', { name: /^View$/i }));
      await waitFor(() => expect(screen.getByText(/3-way tie • 999 plays/)).toBeInTheDocument());
    });

    it('shows FALLBACK "No votes" badge', async () => {
      server.use(
        http.get(`${API}/v1/awards/past`, () =>
          HttpResponse.json([{
            targetId: 'w1',
            targetType: 'song',
            song: { title: 'Fallback Winner' },
            jurisdiction: { name: 'Downtown Harlem' },
            determinationMethod: 'FALLBACK',
          }])
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });
      const dateInput = document.querySelector('input[type="date"]');
      const user = userEvent.setup();
      await user.type(dateInput, '2025-11-15');
      await user.click(screen.getByRole('button', { name: /^View$/i }));
      await waitFor(() => expect(screen.getByText(/No votes/)).toBeInTheDocument());
    });
  });

  describe('results list (ranks 2+)', () => {
    it('renders runners-up under the winner', async () => {
      server.use(
        http.get(`${API}/v1/awards/past`, () =>
          HttpResponse.json([
            { targetId: 'w1', targetType: 'song', song: { title: 'First Place' }, jurisdiction: { name: 'Downtown Harlem' }, weightedPoints: 100 },
            { targetId: 'w2', targetType: 'song', song: { title: 'Second Place' }, jurisdiction: { name: 'Downtown Harlem' }, weightedPoints: 80 },
            { targetId: 'w3', targetType: 'song', song: { title: 'Third Place' }, jurisdiction: { name: 'Downtown Harlem' }, weightedPoints: 60 },
          ])
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const dateInput = document.querySelector('input[type="date"]');
      const user = userEvent.setup();
      await user.type(dateInput, '2025-11-15');
      await user.click(screen.getByRole('button', { name: /^View$/i }));

      await waitFor(() => expect(screen.getByText('Second Place')).toBeInTheDocument());
      expect(screen.getByText('Third Place')).toBeInTheDocument();
      // Winner is in the highlight section, not the list
      expect(screen.getByText('First Place')).toBeInTheDocument();
      // Ranks show on the runners-up
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('#3')).toBeInTheDocument();
    });
  });

  describe('caption display', () => {
    it('only updates caption when View is clicked (frozen context)', async () => {
      server.use(
        http.get(`${API}/v1/awards/past`, () =>
          HttpResponse.json([{
            targetId: 'w1',
            targetType: 'song',
            song: { title: 'Champion' },
            jurisdiction: { name: 'Downtown Harlem' },
          }])
        )
      );
      renderWithProviders(<MilestonesPage />, { as: 'listener' });

      const user = userEvent.setup();
      const dateInput = document.querySelector('input[type="date"]');
      await user.type(dateInput, '2025-11-15');
      await user.click(screen.getByRole('button', { name: /^View$/i }));

      // After View: caption reflects daily/rap/song
      await waitFor(() => expect(screen.getByText(/DOWNTOWN HARLEM RAP/i)).toBeInTheDocument());
      expect(screen.getByText(/SONG OF THE DAY/i)).toBeInTheDocument();

      // Change filters but DON'T click View — caption shouldn't change
      const intervalSelect = screen.getByDisplayValue(/^Daily$/i);
      await user.selectOptions(intervalSelect, 'weekly');

      // Still says "OF THE DAY", not "OF THE WEEK"
      expect(screen.getByText(/SONG OF THE DAY/i)).toBeInTheDocument();
      expect(screen.queryByText(/OF THE WEEK/i)).not.toBeInTheDocument();
    });
  });
});
