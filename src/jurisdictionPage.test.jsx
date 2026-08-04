// src/jurisdictionPage.test.jsx
//
// Integration tests for JurisdictionPage v5 — the identity page for one place.
// Covers the v4 → v5 regressions specifically:
//   • exactly ONE WinnersTimeline (v4 rendered it twice, once outside .jp)
//   • no hardcoded hero pills ("Harlem" / "Invite-Only" / "Active Poll: Live")
//   • stats are data-derived (artists charting, points this week)
//   • alert() → toast
//   • play tracking is effect-based off currentMedia (no credit for songs
//     that never start playing), and guests are never tracked

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from './test/mocks/server';
import { callTracker } from './test/mocks/handlers';
import { renderWithProviders, flushPromises } from './test/utils';
import cacheService from './services/cacheService';
import JurisdictionPage from './jurisdictionPage';

const API = 'http://localhost:8080/api';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ jurisdiction: 'Uptown Harlem' }),
    useNavigate: () => mockNavigate,
  };
});

// WinnersTimeline is its own component with its own suite — stub it here and
// capture the props the page passes, so the single-instance regression and the
// jurisdiction prop are both observable.
vi.mock('./winnersTimeline', () => ({
  default: (props) => (
    <div
      data-testid="winners-timeline"
      data-jurisdiction={props.jurisdiction}
      data-variant={props.variant}
    />
  ),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const JUR_ID = 'jur-uptown-001';

const jurFixture = [
  {
    jurisdictionId: JUR_ID,
    name: 'Uptown Harlem',
    hasChildren: false,
    bio: 'North of 130th Street — Sugar Hill, Hamilton Heights, and Strivers Row.',
  },
];

const topsFixture = {
  topArtists: [
    { userId: 'a1', username: 'rockle_gend', score: 320, genre: { name: 'Rap' }, photoUrl: '/uploads/a1.jpg' },
    { userId: 'a2', username: 'stizz', score: 210, genre: null, photoUrl: null },
  ],
  topSongs: [
    { songId: 's1', title: 'rock baby', score: 152, artist: { userId: 'a1', username: 'rockle_gend' }, fileUrl: '/uploads/s1.mp3', artworkUrl: '/uploads/s1.jpg' },
    { songId: 's2', title: 'no more heroes', score: 140, artist: { userId: 'a2', username: 'stizz' }, fileUrl: null, artworkUrl: null },
  ],
};

function useJurisdictionHandlers({ jur = jurFixture, tops = topsFixture } = {}) {
  server.use(
    http.get(`${API}/v1/jurisdictions/byName/:name`, () => HttpResponse.json(jur)),
    http.get(`${API}/v1/jurisdictions/:id/tops`, () => HttpResponse.json(tops))
  );
}

async function renderLoaded(options = { as: 'listener' }) {
  renderWithProviders(<JurisdictionPage />, options);
  await screen.findByRole('heading', { name: /Uptown Harlem/i, level: 1 });
}

describe('JurisdictionPage', () => {
  beforeEach(() => {
    callTracker.reset();
    mockNavigate.mockReset();
    cacheService.clearAll();
    useJurisdictionHandlers();
  });

  // ══════════════════════════════════════════════════════════════════════
  // Initial render
  // ══════════════════════════════════════════════════════════════════════
  describe('initial render', () => {
    it('shows the jurisdiction name, bio, top artist, and top track', async () => {
      await renderLoaded();

      expect(screen.getByText(/North of 130th Street/i)).toBeInTheDocument();
      // Top artist appears in the stats and in the artist board
      expect(screen.getAllByText('rockle_gend').length).toBeGreaterThan(0);
      // Top track appears in the stats, the featured card, and the track board
      expect(screen.getAllByText('rock baby').length).toBeGreaterThan(0);
    });

    it('derives "Artists charting" and "Points this week" from the tops data', async () => {
      await renderLoaded();

      const chartingStat = screen.getByText('Artists charting').closest('.jp-stat');
      expect(within(chartingStat).getByText('2')).toBeInTheDocument();

      const pointsStat = screen.getByText('Points this week').closest('.jp-stat');
      expect(within(pointsStat).getByText('530')).toBeInTheDocument(); // 320 + 210
    });

    it('labels a leaf jurisdiction "Neighborhood" and a parent "District"', async () => {
      await renderLoaded();
      expect(screen.getByText('Neighborhood')).toBeInTheDocument();

      // Re-render as a parent jurisdiction
      cacheService.clearAll();
      useJurisdictionHandlers({
        jur: [{ ...jurFixture[0], hasChildren: true }],
      });
      renderWithProviders(<JurisdictionPage />, { as: 'listener' });
      await waitFor(() => expect(screen.getByText('District')).toBeInTheDocument());
    });

    it('features the top song as "Song of the week"', async () => {
      await renderLoaded();

      expect(screen.getByText(/Song of the week/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Play song of the week: rock baby' })
      ).toBeInTheDocument();
    });

    it('shows an error state when the jurisdiction lookup returns nothing', async () => {
      useJurisdictionHandlers({ jur: [] });
      renderWithProviders(<JurisdictionPage />, { as: 'listener' });

      expect(await screen.findByText(/Couldn't load Uptown Harlem/i)).toBeInTheDocument();
    });

    it('shows empty-state invitations when the charts are empty', async () => {
      useJurisdictionHandlers({ tops: { topArtists: [], topSongs: [] } });
      renderWithProviders(<JurisdictionPage />, { as: 'listener' });

      await screen.findByRole('heading', { name: /Uptown Harlem/i, level: 1 });
      expect(screen.getByText(/No artists charting yet/i)).toBeInTheDocument();
      expect(screen.getByText(/No tracks charting yet/i)).toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // v4 → v5 regression guards
  // ══════════════════════════════════════════════════════════════════════
  describe('v5 regressions', () => {
    it('renders exactly ONE WinnersTimeline, scoped to this jurisdiction', async () => {
      await renderLoaded();

      const timelines = screen.getAllByTestId('winners-timeline');
      expect(timelines).toHaveLength(1);
      expect(timelines[0]).toHaveAttribute('data-jurisdiction', 'Uptown Harlem');
      expect(timelines[0]).toHaveAttribute('data-variant', 'embedded');
    });

    it('has no hardcoded hero pills or fake poll stat', async () => {
      await renderLoaded();

      expect(screen.queryByText('Invite-Only')).not.toBeInTheDocument();
      expect(screen.queryByText('Active Poll')).not.toBeInTheDocument();
      // The old code pinned a literal "Harlem" pill regardless of the page.
      // The only jurisdiction name on screen should be the real one.
      expect(screen.queryByText(/^Harlem$/)).not.toBeInTheDocument();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Play flow + effect-based tracking
  // ══════════════════════════════════════════════════════════════════════
  describe('playback and play tracking', () => {
    it('credits a play only after the requested track becomes current (listener)', async () => {
      const user = userEvent.setup();
      await renderLoaded({ as: 'listener' });

      await user.click(screen.getByRole('button', { name: 'Play rock baby' }));

      // Empty queue → requestPlay makes it current immediately → effect fires
      await waitFor(() => expect(callTracker.get('play:s1')).toBe(1));
    });

    it('never tracks plays for guests', async () => {
      const user = userEvent.setup();
      await renderLoaded({ as: 'guest' });

      await user.click(screen.getByRole('button', { name: 'Play rock baby' }));
      await flushPromises();

      expect(callTracker.get('play:s1')).toBe(0);
    });

    it('resolves an artist row play through their default song', async () => {
      server.use(
        http.get(`${API}/v1/users/:id/default-song`, () =>
          HttpResponse.json({
            songId: 'default-001',
            title: 'First Track',
            fileUrl: '/uploads/default.mp3',
            artworkUrl: '/uploads/default.jpg',
          })
        )
      );

      const user = userEvent.setup();
      await renderLoaded({ as: 'listener' });

      await user.click(screen.getByRole('button', { name: 'Play stizz' }));

      await waitFor(() => expect(callTracker.get('play:default-001')).toBe(1));
    });

    it('toasts instead of alerting when a track has no file', async () => {
      const user = userEvent.setup();
      await renderLoaded({ as: 'listener' });

      await user.click(screen.getByRole('button', { name: 'Play no more heroes' }));

      expect(await screen.findByRole('status')).toHaveTextContent(/isn't available right now/i);
      await flushPromises();
      expect(callTracker.get('play:s2')).toBe(0);
    });

    it('toasts when an artist has no default song', async () => {
      server.use(
        http.get(`${API}/v1/users/:id/default-song`, () => HttpResponse.json({}))
      );

      const user = userEvent.setup();
      await renderLoaded({ as: 'listener' });

      await user.click(screen.getByRole('button', { name: 'Play stizz' }));

      expect(await screen.findByRole('status')).toHaveTextContent(
        /stizz hasn't set a default song yet/i
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Navigation + keyboard accessibility
  // ══════════════════════════════════════════════════════════════════════
  describe('navigation', () => {
    it('Vote now and Explore tracks route to their pages', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('button', { name: /Vote now/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/voteawards');

      await user.click(screen.getByRole('button', { name: /Explore tracks/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/findpage');
    });

    it('chart rows navigate on click', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(screen.getByRole('button', { name: 'View rockle_gend' }));
      expect(mockNavigate).toHaveBeenCalledWith('/artist/a1');

      await user.click(screen.getByRole('button', { name: 'View rock baby' }));
      expect(mockNavigate).toHaveBeenCalledWith('/song/s1');
    });

    it('chart rows are keyboard-operable (Enter activates)', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      const row = screen.getByRole('button', { name: 'View stizz' });
      row.focus();
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith('/artist/a2');
    });

    it('the featured card opens the song page', async () => {
      const user = userEvent.setup();
      await renderLoaded();

      await user.click(
        screen.getByRole('button', { name: 'Song of the week: rock baby' })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/song/s1');
    });
  });
});