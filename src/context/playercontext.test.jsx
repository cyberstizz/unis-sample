// src/context/playercontext.test.jsx
//
// Comprehensive unit tests for PlayerContext — the nerve center of the app.
// Every queue operation, shuffle, play-choice flow, and cross-context event
// is locked down here.
//
// Design notes:
//   - We don't mount the full app. Instead, a test-only harness component
//     exposes context values as data attributes we can assert on.
//   - audioRef.play() is polyfilled in test/setup.js to return resolve()
//   - MSW handlers serve playlist endpoints with realistic shapes

import React, { useContext } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { PlayerProvider, PlayerContext } from './playercontext';
import { server } from '../test/mocks/server';
import { makeToken, fixtures } from '../test/mocks/handlers';

const API = 'http://localhost:8080/api';

// ─── Test harness: exposes context values through data-testid attributes ───
const Probe = ({ children }) => {
  const ctx = useContext(PlayerContext);
  return (
    <div>
      <div data-testid="queue-length">{ctx.queue.length}</div>
      <div data-testid="current-index">{ctx.currentIndex}</div>
      <div data-testid="current-id">{ctx.currentMedia?.id || 'null'}</div>
      <div data-testid="is-playing">{String(ctx.isPlaying)}</div>
      <div data-testid="is-shuffled">{String(ctx.isShuffled)}</div>
      <div data-testid="play-choice-open">{String(ctx.playChoiceModal.open)}</div>
      <div data-testid="play-choice-pending">{ctx.playChoiceModal.pendingSong?.id || 'null'}</div>
      <div data-testid="playlist-count">{ctx.playlists.length}</div>
      <div data-testid="queue-ids">{ctx.queue.map(t => t?.id || '?').join(',')}</div>
      {children}
    </div>
  );
};

// A capture ref to grab the context object from inside React tree
let latestCtx = null;
const CaptureCtx = () => {
  latestCtx = useContext(PlayerContext);
  return null;
};

function renderProvider() {
  return render(
    <PlayerProvider>
      <Probe>
        <CaptureCtx />
      </Probe>
    </PlayerProvider>
  );
}

const makeSong = (id, overrides = {}) => ({
  id,
  songId: id,
  title: `Song ${id}`,
  artist: 'Test Artist',
  url: `https://cdn.test/${id}.mp3`,
  artworkUrl: `https://cdn.test/${id}.jpg`,
  ...overrides,
});

describe('PlayerContext', () => {
  beforeEach(() => {
    latestCtx = null;
  });

  // ========================================================================
  // requestPlay — smart entry point
  // ========================================================================
  describe('requestPlay', () => {
    it('plays immediately when queue is empty (no modal)', async () => {
      renderProvider();
      const song = makeSong('a');

      await act(async () => {
        latestCtx.requestPlay(song);
      });

      expect(screen.getByTestId('queue-length').textContent).toBe('1');
      expect(screen.getByTestId('current-id').textContent).toBe('a');
      expect(screen.getByTestId('play-choice-open').textContent).toBe('false');
    });

    it('opens the play-choice modal when queue has items', async () => {
      renderProvider();

      // Prime the queue
      await act(async () => {
        latestCtx.requestPlay(makeSong('a'));
      });

      // Second play should trigger the modal, NOT auto-play
      await act(async () => {
        latestCtx.requestPlay(makeSong('b'));
      });

      expect(screen.getByTestId('play-choice-open').textContent).toBe('true');
      expect(screen.getByTestId('play-choice-pending').textContent).toBe('b');
      expect(screen.getByTestId('current-id').textContent).toBe('a'); // still playing 'a'
      expect(screen.getByTestId('queue-length').textContent).toBe('1');
    });

    it('silently ignores null song', async () => {
      renderProvider();
      await act(async () => {
        latestCtx.requestPlay(null);
      });
      expect(screen.getByTestId('queue-length').textContent).toBe('0');
    });
  });

  // ========================================================================
  // confirmPlayNow / confirmAddToQueue / cancelPlayChoice
  // ========================================================================
  describe('play choice resolution', () => {
    beforeEach(async () => {
      renderProvider();
      // Two separate act() calls — the second must see the committed state
      // of the first, otherwise both see queue.length === 0.
      await act(async () => {
        latestCtx.requestPlay(makeSong('a'));
      });
      await act(async () => {
        latestCtx.requestPlay(makeSong('b')); // opens modal with b pending
      });
    });

    it('confirmPlayNow inserts pending song after current and jumps to it', async () => {
      await act(async () => {
        latestCtx.confirmPlayNow();
      });

      expect(screen.getByTestId('queue-length').textContent).toBe('2');
      expect(screen.getByTestId('queue-ids').textContent).toBe('a,b');
      expect(screen.getByTestId('current-id').textContent).toBe('b');
      expect(screen.getByTestId('current-index').textContent).toBe('1');
      expect(screen.getByTestId('play-choice-open').textContent).toBe('false');
    });

    it('confirmAddToQueue appends to end without jumping', async () => {
      await act(async () => {
        latestCtx.confirmAddToQueue();
      });

      expect(screen.getByTestId('queue-length').textContent).toBe('2');
      expect(screen.getByTestId('queue-ids').textContent).toBe('a,b');
      expect(screen.getByTestId('current-id').textContent).toBe('a'); // still on a
      expect(screen.getByTestId('current-index').textContent).toBe('0');
      expect(screen.getByTestId('play-choice-open').textContent).toBe('false');
    });

    it('cancelPlayChoice discards the pending song', async () => {
      await act(async () => {
        latestCtx.cancelPlayChoice();
      });

      expect(screen.getByTestId('queue-length').textContent).toBe('1');
      expect(screen.getByTestId('queue-ids').textContent).toBe('a');
      expect(screen.getByTestId('play-choice-open').textContent).toBe('false');
    });
  });

  // ========================================================================
  // Queue navigation: next / prev
  // ========================================================================
  describe('next() and prev()', () => {
    it('next advances through the queue', async () => {
      renderProvider();
      await act(async () => {
        latestCtx.playMedia(makeSong('a'), [makeSong('a'), makeSong('b'), makeSong('c')]);
      });

      expect(screen.getByTestId('current-id').textContent).toBe('a');

      await act(async () => { latestCtx.next(); });
      expect(screen.getByTestId('current-id').textContent).toBe('b');

      await act(async () => { latestCtx.next(); });
      expect(screen.getByTestId('current-id').textContent).toBe('c');
    });

    it('next at end of queue stops playback (no autoplay wraparound)', async () => {
      renderProvider();
      await act(async () => {
        latestCtx.playMedia(makeSong('a'), [makeSong('a'), makeSong('b')]);
        latestCtx.next(); // on 'b' now
      });

      await act(async () => { latestCtx.next(); }); // past end

      // Should stay on 'b', not wrap to 'a'. isPlaying should be false.
      expect(screen.getByTestId('current-id').textContent).toBe('b');
      expect(screen.getByTestId('is-playing').textContent).toBe('false');
    });

    it('prev wraps from index 0 back to end of queue', async () => {
      // Documenting current behavior: prev uses modulo, so going back from
      // index 0 wraps to the last song. This matches most music apps.
      renderProvider();
      await act(async () => {
        latestCtx.playMedia(makeSong('a'), [makeSong('a'), makeSong('b'), makeSong('c')]);
      });

      await act(async () => { latestCtx.prev(); });
      expect(screen.getByTestId('current-id').textContent).toBe('c');
    });

    it('next/prev are no-ops on empty queue', async () => {
      renderProvider();
      await act(async () => {
        latestCtx.next();
        latestCtx.prev();
      });
      expect(screen.getByTestId('current-id').textContent).toBe('null');
      expect(screen.getByTestId('queue-length').textContent).toBe('0');
    });
  });

  // ========================================================================
  // Queue management
  // ========================================================================
  describe('queue management', () => {
    beforeEach(async () => {
      renderProvider();
      await act(async () => {
        latestCtx.playMedia(
          makeSong('a'),
          [makeSong('a'), makeSong('b'), makeSong('c')]
        );
      });
    });

    it('playNext inserts after current song', async () => {
      await act(async () => {
        latestCtx.playNext(makeSong('x'));
      });
      expect(screen.getByTestId('queue-ids').textContent).toBe('a,x,b,c');
    });

    it('playLater appends to end', async () => {
      await act(async () => {
        latestCtx.playLater(makeSong('x'));
      });
      expect(screen.getByTestId('queue-ids').textContent).toBe('a,b,c,x');
    });

    it('removeFromQueue refuses to remove the currently playing track', async () => {
      await act(async () => {
        latestCtx.removeFromQueue(0); // try to remove 'a' while it's playing
      });
      expect(screen.getByTestId('queue-ids').textContent).toBe('a,b,c');
    });

    it('removeFromQueue removes a track after current and keeps index', async () => {
      await act(async () => {
        latestCtx.removeFromQueue(2); // remove 'c'
      });
      expect(screen.getByTestId('queue-ids').textContent).toBe('a,b');
      expect(screen.getByTestId('current-index').textContent).toBe('0');
    });

    it('removeFromQueue removing a track before current decrements index', async () => {
      // Move to index 1 (playing 'b')
      await act(async () => { latestCtx.next(); });
      expect(screen.getByTestId('current-index').textContent).toBe('1');

      await act(async () => {
        latestCtx.removeFromQueue(0); // remove 'a' while playing 'b'
      });

      expect(screen.getByTestId('queue-ids').textContent).toBe('b,c');
      expect(screen.getByTestId('current-index').textContent).toBe('0'); // still on 'b'
      expect(screen.getByTestId('current-id').textContent).toBe('b');
    });

    it('clearQueue resets everything', async () => {
      await act(async () => {
        latestCtx.clearQueue();
      });
      expect(screen.getByTestId('queue-length').textContent).toBe('0');
      expect(screen.getByTestId('current-id').textContent).toBe('null');
      expect(screen.getByTestId('is-playing').textContent).toBe('false');
      expect(screen.getByTestId('is-shuffled').textContent).toBe('false');
    });
  });

  // ========================================================================
  // Shuffle
  // ========================================================================
  describe('shuffle', () => {
    it('toggle on keeps current song at top, shuffles the rest', async () => {
      renderProvider();
      const originalOrder = ['a', 'b', 'c', 'd', 'e'];
      await act(async () => {
        latestCtx.playMedia(
          makeSong('a'),
          originalOrder.map(makeSong)
        );
      });

      await act(async () => { latestCtx.toggleShuffle(); });

      expect(screen.getByTestId('is-shuffled').textContent).toBe('true');
      expect(screen.getByTestId('current-index').textContent).toBe('0');
      expect(screen.getByTestId('current-id').textContent).toBe('a'); // still on 'a'

      // Queue still has all 5 tracks
      const ids = screen.getByTestId('queue-ids').textContent.split(',');
      expect(ids).toHaveLength(5);
      expect(ids[0]).toBe('a');
      expect(ids.sort()).toEqual(originalOrder.sort());
    });

    it('toggle off restores original order and updates index to current song', async () => {
      renderProvider();
      await act(async () => {
        latestCtx.playMedia(
          makeSong('a'),
          ['a', 'b', 'c', 'd', 'e'].map(makeSong)
        );
      });
      await act(async () => {
        latestCtx.toggleShuffle();
      });

      // Advance twice in shuffled order (separate acts — state commits between)
      await act(async () => { latestCtx.next(); });
      await act(async () => { latestCtx.next(); });

      const currentAfterShuffle = screen.getByTestId('current-id').textContent;

      // Unshuffle
      await act(async () => { latestCtx.toggleShuffle(); });

      expect(screen.getByTestId('is-shuffled').textContent).toBe('false');
      expect(screen.getByTestId('queue-ids').textContent).toBe('a,b,c,d,e');
      expect(screen.getByTestId('current-id').textContent).toBe(currentAfterShuffle);
    });
  });

  // ========================================================================
  // Login / logout events
  // ========================================================================
  describe('cross-context login/logout events', () => {
    it('loads playlists when unis:login fires', async () => {
      server.use(
        http.get(`${API}/v1/playlists/mine`, () =>
          HttpResponse.json([
            { playlistId: 'pl-1', name: 'Chill Mix', songCount: 5 },
            { playlistId: 'pl-2', name: 'Workout', songCount: 12 },
          ])
        ),
        http.get(`${API}/v1/playlists/following`, () => HttpResponse.json([]))
      );

      renderProvider();

      // Initially no playlists (no token)
      expect(screen.getByTestId('playlist-count').textContent).toBe('0');

      // Simulate login
      localStorage.setItem('token', makeToken(fixtures.users.listener.userId));
      await act(async () => {
        window.dispatchEvent(new CustomEvent('unis:login', {
          detail: { userId: fixtures.users.listener.userId }
        }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('playlist-count').textContent).toBe('2');
      }, { timeout: 2000 });
    });

    it('clears all state when unis:logout fires', async () => {
      renderProvider();

      // Set up some state
      await act(async () => {
        latestCtx.playMedia(makeSong('a'), [makeSong('a'), makeSong('b')]);
      });
      expect(screen.getByTestId('queue-length').textContent).toBe('2');

      // Fire logout
      await act(async () => {
        window.dispatchEvent(new CustomEvent('unis:logout'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('queue-length').textContent).toBe('0');
        expect(screen.getByTestId('current-id').textContent).toBe('null');
        expect(screen.getByTestId('playlist-count').textContent).toBe('0');
      });
    });

    it('playlist fetch on mount if token is already in localStorage', async () => {
      // Set token BEFORE mounting (simulates refresh-while-logged-in)
      localStorage.setItem('token', makeToken(fixtures.users.listener.userId));
      server.use(
        http.get(`${API}/v1/playlists/mine`, () =>
          HttpResponse.json([{ playlistId: 'pl-cached', name: 'Cached', songCount: 1 }])
        ),
        http.get(`${API}/v1/playlists/following`, () => HttpResponse.json([]))
      );

      renderProvider();

      await waitFor(() => {
        expect(screen.getByTestId('playlist-count').textContent).toBe('1');
      }, { timeout: 2000 });
    });
  });

  // ========================================================================
  // Playlist CRUD
  // ========================================================================
  describe('playlist CRUD', () => {
    beforeEach(() => {
      localStorage.setItem('token', makeToken(fixtures.users.listener.userId));
    });

    it('createPlaylist POSTs and refreshes the list', async () => {
      let createBody = null;
      server.use(
        http.post(`${API}/v1/playlists`, async ({ request }) => {
          createBody = await request.json();
          return HttpResponse.json({ playlistId: 'new-pl', name: createBody.name });
        }),
        http.get(`${API}/v1/playlists/mine`, () =>
          HttpResponse.json([{ playlistId: 'new-pl', name: 'My New List', songCount: 0 }])
        ),
        http.get(`${API}/v1/playlists/following`, () => HttpResponse.json([]))
      );

      renderProvider();
      await waitFor(() => expect(latestCtx).not.toBeNull());

      await act(async () => {
        await latestCtx.createPlaylist('My New List', 'personal', {
          visibility: 'private',
          description: 'Test desc',
        });
      });

      expect(createBody).toEqual({
        name: 'My New List',
        type: 'personal',
        visibility: 'private',
        description: 'Test desc',
        jurisdictionId: null,
        coverImageUrl: null,
      });
    });
  });
});
