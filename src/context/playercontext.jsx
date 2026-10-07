// src/context/PlayerContext.js
import React, { createContext, useState, useRef, useEffect, useCallback } from 'react';
import axiosInstance from '../components/axiosInstance';
import { saveQueueState, loadQueueState, clearAllQueueState } from '../utils/queuePersistence';

// ============================================================================
// CURRENT USER ID
// ============================================================================
// Decoded from the JWT rather than pulled from AuthContext on purpose.
// PlayerProvider is deliberately independent of AuthProvider — it already reads
// the token directly for playlist loading, and its test suite renders it
// standalone. Calling useAuth() here would make the provider throw outside an
// AuthProvider and couple playback to auth for nothing more than a storage-key
// namespace. Same decode logic AuthContext uses.
const getCurrentUserId = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1])).userId ?? null;
  } catch {
    return null;
  }
};

export const PlayerContext = createContext();

// Fisher-Yates shuffle — true random, not weighted
function fisherYatesShuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================================
// QUEUE ITEM IDENTITY
// ============================================================================
// Every queue entry carries its own `qid`, separate from the song's `id`.
//
// Why: the same song can legitimately sit in the queue more than once — queued
// on its own AND inside a playlist that was added later. Song id therefore
// can't identify a queue POSITION. Every lookup that used to match on song id
// (finding the current track after a reorder, un-shuffling, jumping to a row)
// now matches on qid.
//
// `id` stays the song id. player.jsx, play counting and rewards all rely on
// currentMedia.id being the song id, so it is never overwritten.
//
// `origin` records where an entry came from:
//   null                                   → queued on its own
//   { type: 'playlist', playlistId, name,  → arrived as part of a playlist
//     coverUrl, batchId }
// `batchId` is unique per "add this playlist" action, so adding the same
// playlist twice produces two distinct groups in the queue panel.
const newQid = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const toQueueItem = (track, origin = null) => ({ ...track, qid: newQid(), origin });

const ensureQid = (track) => (track && track.qid ? track : { ...track, qid: newQid(), origin: track?.origin ?? null });

// Upgrades a queue persisted before qids existed. Runs once at startup.
// If anything lacks a qid, the shuffle "original order" can't be matched back
// to the queue reliably, so it's reset to the current order (shuffle off).
// The user keeps every song and their place in the queue.
function migrateRestoredQueue(restored) {
  if (!restored) return null;
  const queue = Array.isArray(restored.queue) ? restored.queue : [];
  const original = Array.isArray(restored.originalQueue) ? restored.originalQueue : [];
  const allHaveQids = queue.every(t => t && t.qid) && original.every(t => t && t.qid);
  if (allHaveQids) return restored;

  const upgraded = queue.map(ensureQid);
  const idx = Math.min(Math.max(restored.currentIndex ?? 0, 0), Math.max(upgraded.length - 1, 0));
  return {
    ...restored,
    queue: upgraded,
    originalQueue: upgraded,
    isShuffled: false,
    currentIndex: idx,
    currentMedia: upgraded[idx] ?? restored.currentMedia ?? null,
  };
}

// ============================================================================
// URL BUILDER — extracted so Media Session metadata can use it too
// ============================================================================
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const buildUrl = (url) => {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

export const PlayerProvider = ({ children }) => {
  // ========================================================================
  // QUEUE PERSISTENCE — restore
  // ========================================================================
  //
  // Read localStorage synchronously during the first render via a lazy ref,
  // not in an effect. An effect runs after paint, so the player would flash
  // empty for a frame and then pop in.
  //
  // `false` is used as the "already attempted, found nothing" marker so a
  // genuine miss isn't retried on every render.
  const restoredRef = useRef(null);
  if (restoredRef.current === null) {
    restoredRef.current = migrateRestoredQueue(loadQueueState(getCurrentUserId())) ?? false;
  }
  const restored = restoredRef.current || null;

  // Playback offset that player.jsx should seek to on the first load after a
  // refresh. Consumed exactly once — otherwise every later track change would
  // try to seek to a stale offset.
  const pendingResumeRef = useRef(
    restored && restored.currentTime > 0 ? { currentTime: restored.currentTime } : null
  );

  const consumePendingResume = useCallback(() => {
    const pending = pendingResumeRef.current;
    pendingResumeRef.current = null;
    return pending;
  }, []);

  // --- Player state ---
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(restored?.currentMedia ?? null);
  const [currentIndex, setCurrentIndex] = useState(restored?.currentIndex ?? 0);
  // pendingSong       → a single song is waiting on "Play now / Add to queue"
  // pendingCollection → a whole playlist (or the rest of one) is waiting:
  //                     { tracks, origin, title, artwork, startTitle }
  const [playChoiceModal, setPlayChoiceModal] = useState({ open: false, pendingSong: null, pendingCollection: null });


  // --- Queue state (persisted across refreshes — see utils/queuePersistence.js) ---
  const [queue, setQueue] = useState(restored?.queue ?? []);
  const [queueSource, setQueueSource] = useState(restored?.queueSource ?? null);
  const [isShuffled, setIsShuffled] = useState(restored?.isShuffled ?? false);
  const [originalQueue, setOriginalQueue] = useState(restored?.originalQueue ?? []);
  const [autoplay, setAutoplay] = useState(restored?.autoplay ?? false);
  const [repeatMode, setRepeatMode] = useState(restored?.repeatMode ?? 'off');
  const cycleRepeat = useCallback(() => { // ★
    setRepeatMode(m => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  }, []);

  // --- Playlist library state ---
  const [playlists, setPlaylists] = useState([]);
  const [followedPlaylists, setFollowedPlaylists] = useState([]);

  // ── "Don't Play" list ──────────────────────────────────────────────────
  // songIds the user has blocked. Held as a Set for O(1) membership checks —
  // next()/prev() consult it on every queue advance, so a linear scan of an
  // array would be the wrong shape here. Loaded on login, cleared on logout,
  // and refreshed live via the 'unis:blocked-songs-changed' event that
  // songPage dispatches whenever the user toggles the button.
  const [blockedSongIds, setBlockedSongIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);

  const audioRef = useRef(null);
  // Set by prev() so the header logo knows a song change went BACKWARD
  // (it sways left for previous, right for everything else). Stamped with a
  // time so a stale marker can't leak into a later, unrelated song change.
  const navDirectionRef = useRef(null);

  // ========================================================================
  // QUEUE PERSISTENCE — save
  // ========================================================================

  // Everything the restore needs, gathered in one place so the debounced write
  // and the tab-close flush can't drift apart.
  const snapshotQueueState = useCallback(() => ({
    queue,
    originalQueue,
    currentIndex,
    currentMedia,
    queueSource,
    isShuffled,
    repeatMode,
    autoplay,
    // Read straight off the media element. currentTime ticks ~4x a second and
    // would cause a re-render storm if it were React state.
    currentTime: audioRef.current?.currentTime ?? 0,
  }), [queue, originalQueue, currentIndex, currentMedia, queueSource,
       isShuffled, repeatMode, autoplay]);

  // Debounced write. Queue mutations are user-paced, but drag-to-reorder fires
  // continuously, so a 500ms trailing debounce stops it writing every frame.
  useEffect(() => {
    const timer = setTimeout(() => {
      saveQueueState(getCurrentUserId(), snapshotQueueState());
    }, 500);
    return () => clearTimeout(timer);
  }, [snapshotQueueState]);

  // Flush immediately on tab close, otherwise the last ~500ms of changes are
  // lost. `pagehide` rather than `beforeunload` because it fires reliably on
  // mobile Safari, where beforeunload frequently does not.
  useEffect(() => {
    const flush = () => saveQueueState(getCurrentUserId(), snapshotQueueState());
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [snapshotQueueState]);

  // ========================================================================
  // PLAYLIST LOADING
  // ========================================================================

  const loadUserPlaylists = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      const res = await axiosInstance.get('/v1/playlists/mine');
      const data = res.data || [];

      const transformed = data.map(pl => ({
        id: pl.playlistId,
        playlistId: pl.playlistId,
        name: pl.name,
        type: pl.type || 'personal',
        visibility: pl.visibility || 'private',
        songCount: pl.songCount || 0,
        followerCount: pl.followerCount || 0,
        coverImageUrl: pl.coverImageUrl,
        firstFourArtworks: pl.firstFourArtworks || [],
        updatedAt: pl.updatedAt,
        tracks: []
      }));

      setPlaylists(transformed);
    } catch (error) {
      console.error('Failed to load playlists:', error);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Load the user's do-not-play list. Mirrors loadFollowedPlaylists' shape:
   *  token-guarded, non-throwing, logs on failure. A failure here must never
   *  break playback — worst case the user's blocks don't apply this session. */
  const loadBlockedSongs = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await axiosInstance.get('/v1/playlists/blocked-songs');
      const data = res.data || [];
      const ids = data
        .map(b => b.songId || b.song?.songId || b.id)
        .filter(Boolean);

      setBlockedSongIds(new Set(ids));
      console.log(`[player] loaded ${ids.length} blocked song(s)`);
    } catch (error) {
      console.error('Failed to load blocked songs:', error);
      // Deliberately leave the existing Set alone rather than emptying it —
      // a transient network blip shouldn't silently un-block a user's list.
    }
  }, []);

  const loadFollowedPlaylists = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await axiosInstance.get('/v1/playlists/following');
      const data = res.data || [];

      setFollowedPlaylists(data.map(pl => ({
        id: pl.playlistId,
        playlistId: pl.playlistId,
        name: pl.name,
        type: pl.type,
        visibility: pl.visibility,
        songCount: pl.songCount || 0,
        followerCount: pl.followerCount || 0,
        coverImageUrl: pl.coverImageUrl,
        creatorName: pl.creatorName,
        firstFourArtworks: pl.firstFourArtworks || [],
        tracks: []
      })));
    } catch (error) {
      console.error('Failed to load followed playlists:', error);
      setFollowedPlaylists([]);
    }
  }, []);

  // ========================================================================
  // INIT & EVENT LISTENERS — fixes the playlist fetching race condition
  // ========================================================================
  //
  // The bug: PlayerProvider mounts when the app first loads — sometimes BEFORE
  // the user has logged in. The useEffect below runs once on mount. If there's
  // no token at that moment, the fetch never fires. Then the user logs in,
  // gets a token, but PlayerContext has no idea anything changed and still
  // shows an empty playlists array.
  //
  // The fix uses two strategies layered together:
  //
  //   1. On mount, check for an existing token (handles refresh-while-logged-in)
  //   2. Listen for the 'unis:login' custom event from AuthContext
  //      (handles fresh logins without needing a page refresh)
  //
  // A third defense exists in openPlaylistManager() below — even if both of
  // these miss, opening the manager will trigger a fetch if needed.

  useEffect(() => {
    // Strategy 1: try once at mount in case user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      loadUserPlaylists();
      loadFollowedPlaylists();
      loadBlockedSongs();
    }

    // Strategy 2: listen for login/logout events
    const handleLogin = () => {
      loadUserPlaylists();
      loadFollowedPlaylists();
      loadBlockedSongs();
    };

    const handleLogout = () => {
      // Clear playlist state so the next user doesn't see stale data
      setPlaylists([]);
      setFollowedPlaylists([]);
      setQueue([]);
      setOriginalQueue([]);
      setCurrentMedia(null);
      setCurrentIndex(0);
      setQueueSource(null);
      setIsShuffled(false);
      // One user's do-not-play list must never leak into the next session
      // on a shared device.
      setBlockedSongIds(new Set());

      // Wipe the persisted copy too. Without this, clearing in-memory state
      // achieves nothing — the debounced writer would just save the empty
      // queue, or worse, the next account on this device would restore the
      // previous user's queue on load.
      clearAllQueueState();

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };

    // Fired by songPage the moment the user toggles "Don't Play". Without
    // this, a block taken mid-playlist wouldn't apply until a page reload.
    const handleBlockedChanged = () => loadBlockedSongs();

    window.addEventListener('unis:login', handleLogin);
    window.addEventListener('unis:logout', handleLogout);
    window.addEventListener('unis:blocked-songs-changed', handleBlockedChanged);
    // The 401 interceptor tears the session down in-app without a redirect,
    // so it needs the same treatment as an explicit logout.
    window.addEventListener('unis:session-expired', handleLogout);

    return () => {
      window.removeEventListener('unis:login', handleLogin);
      window.removeEventListener('unis:logout', handleLogout);
      window.removeEventListener('unis:blocked-songs-changed', handleBlockedChanged);
      window.removeEventListener('unis:session-expired', handleLogout);
    };
  }, [loadUserPlaylists, loadFollowedPlaylists, loadBlockedSongs]);

  /** Load full playlist with tracks (on-demand when user opens a playlist) */
  const loadPlaylistDetails = async (playlistId) => {
    try {
      const res = await axiosInstance.get(`/v1/playlists/${playlistId}`);
      return normalizePlaylistResponse(res.data);
    } catch (error) {
      console.error('Failed to load playlist details:', error);
      return null;
    }
  };

  // ========================================================================
  // PLAYBACK — Core
  // ========================================================================

  const playMedia = (media, newQueue = [], sourceName = null) => {
    if (!media) return;

    if (newQueue.length > 0) {
      // Legacy "replace the whole queue" path. Nothing in the app calls this
      // any more — playlists now pour INTO the queue instead of replacing it —
      // but it's kept so an older caller can't crash. Items still get qids.
      const items = newQueue.map(t => toQueueItem(t, null));
      const found = items.findIndex(t => (t.id || t.songId) === (media.id || media.songId));
      const startIdx = found >= 0 ? found : 0;
      setQueue(items);
      setOriginalQueue(items);
      setIsShuffled(false);
      setQueueSource(sourceName);
      setCurrentIndex(startIdx);
      setCurrentMedia(items[startIdx]);
      startAudio(items[startIdx]);
      return;
    }

    // Jump to a track already in the queue. Exact entry (qid) first; song id
    // only as a fallback for callers that pass a plain song object.
    let idx = media.qid ? queue.findIndex(t => t.qid === media.qid) : -1;
    if (idx < 0) idx = queue.findIndex(t => (t.id || t.songId) === (media.id || media.songId));
    if (idx >= 0) {
      setCurrentIndex(idx);
      setCurrentMedia(queue[idx]);
      startAudio(queue[idx]);
      return;
    }
    setCurrentMedia(media);
    startAudio(media);
  };

  /** True if the user has this track on their do-not-play list. */
  const isTrackBlocked = useCallback(
    (track) => !!track && blockedSongIds.has(track.id || track.songId),
    [blockedSongIds]
  );

  // ── next(): advance to the first track the user hasn't blocked ──────────
  // Note this governs QUEUE ADVANCEMENT only (skip button, track-ended,
  // autoplay). A song the user explicitly chooses still plays even if
  // blocked — clicking play on a song's own page is an unambiguous request,
  // and silently refusing it would read as a broken button. If you'd rather
  // hard-block direct plays too, the guard belongs in requestPlay, not here.
  const next = useCallback(() => {
    if (queue.length === 0) return;

    // Walk forward past any blocked tracks.
    let idx = currentIndex + 1;
    while (idx < queue.length && isTrackBlocked(queue[idx])) idx++;

    if (idx >= queue.length) {
      if (repeatMode === 'all') {
        // Wrap to the top and keep walking — but never past where we
        // started, otherwise a fully-blocked queue would loop forever.
        let wrapped = 0;
        while (wrapped <= currentIndex && isTrackBlocked(queue[wrapped])) wrapped++;

        if (wrapped > currentIndex || wrapped >= queue.length) {
          console.log('[player] every track in the queue is blocked — stopping');
          setIsPlaying(false);
          return;
        }

        setCurrentIndex(wrapped);
        setCurrentMedia(queue[wrapped]);
        return;
      }

      setIsPlaying(false);
      return;
    }

    if (idx !== currentIndex + 1) {
      console.log(`[player] skipped ${idx - currentIndex - 1} blocked track(s)`);
    }

    setCurrentIndex(idx);
    setCurrentMedia(queue[idx]);
  }, [queue, currentIndex, repeatMode, isTrackBlocked]);

  // ── prev(): walk backward with the same skip, wrapping at the top ───────
  const prev = useCallback(() => {
    if (queue.length === 0) return;

    let idx = currentIndex;
    let steps = 0;

    do {
      idx = (idx - 1 + queue.length) % queue.length;
      steps++;
    } while (isTrackBlocked(queue[idx]) && steps < queue.length);

    // Bailed out because the entire queue is blocked — stay where we are
    // rather than loading an unplayable track.
    if (isTrackBlocked(queue[idx])) {
      console.log('[player] every track in the queue is blocked — staying put');
      return;
    }

    navDirectionRef.current = { dir: -1, at: Date.now() };
    setCurrentIndex(idx);
    setCurrentMedia(queue[idx]);
  }, [queue, currentIndex, isTrackBlocked]);

  const togglePlayPause = useCallback(() => {
    if (audioRef.current && currentMedia) {
      if (audioRef.current.paused) {
        audioRef.current.play().then(() => setIsPlaying(true))
          .catch(err => console.error('Play failed:', err));
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [currentMedia]);

  // ========================================================================
  // QUEUE ENGINE
  // ========================================================================
  //
  // The model:
  //   • The queue is the ONE place playback happens.
  //   • A playlist is never loaded "instead of" the queue. It is poured INTO
  //     it — either right after the current song (Play now) or at the end
  //     (Add to queue) — exactly like a single song. Nothing the user has
  //     already queued is ever thrown away by playing something.
  //   • Once poured in, playlist songs are ordinary queue entries: they can be
  //     moved and removed freely. Editing the queue never touches the playlist.
  //
  // Un-shuffle order (`originalQueue`) is kept consistent on every change:
  //   shuffle off → it simply mirrors the queue
  //   shuffle on  → additions are appended to it, removals are dropped from it,
  //                 reorders leave it alone

  const startAudio = useCallback((item) => {
    if (!item || !audioRef.current) return;
    audioRef.current.src = item.url || item.fileUrl;
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(err => console.error('Play failed:', err));
  }, []);

  /** Jump to an exact position in the queue (used by the queue panel). */
  const playQueueIndex = useCallback((index) => {
    const item = queue[index];
    if (!item) return;
    setCurrentIndex(index);
    setCurrentMedia(item);
    startAudio(item);
  }, [queue, startAudio]);

  /**
   * Pour a collection of tracks into the queue.
   *   mode 'empty' → the queue was empty; the collection becomes the queue
   *   mode 'now'   → insert right after the current song and start playing
   *   mode 'end'   → append after everything already queued
   */
  const insertCollection = useCallback((collection, mode) => {
    const items = (collection?.tracks || []).map(t => toQueueItem(t, collection.origin));
    if (items.length === 0) return;

    // A specific row the user clicked ("play from here") plays even if it's on
    // their do-not-play list — that's an explicit choice. Otherwise start at the
    // first track they haven't blocked.
    let first = 0;
    if (!collection.startTitle) {
      const i = items.findIndex(t => !isTrackBlocked(t));
      first = i >= 0 ? i : 0;
    }

    if (mode === 'empty' || queue.length === 0) {
      setQueue(items);
      setOriginalQueue(items);
      setIsShuffled(false);
      setQueueSource(null);
      setCurrentIndex(first);
      setCurrentMedia(items[first]);
      startAudio(items[first]);
      return;
    }

    if (mode === 'now') {
      const insertAt = Math.min(currentIndex + 1, queue.length);
      const nq = [...queue];
      nq.splice(insertAt, 0, ...items);
      setQueue(nq);
      setOriginalQueue(isShuffled ? [...originalQueue, ...items] : nq);
      const target = insertAt + first;
      setCurrentIndex(target);
      setCurrentMedia(nq[target]);
      startAudio(nq[target]);
      return;
    }

    // 'end'
    const nq = [...queue, ...items];
    setQueue(nq);
    setOriginalQueue(isShuffled ? [...originalQueue, ...items] : nq);
  }, [queue, originalQueue, currentIndex, isShuffled, isTrackBlocked, startAudio]);

  /**
   * Ask to play a single song. Empty queue → it just plays. Otherwise the
   * PlayChoiceModal asks "Play now" or "Add to queue".
   */
  const requestPlay = useCallback((song) => {
    if (!song) return;

    if (queue.length === 0) {
      const item = toQueueItem(song, null);
      setQueue([item]);
      setOriginalQueue([item]);
      setIsShuffled(false);
      setQueueSource(null);
      setCurrentIndex(0);
      setCurrentMedia(item);
      startAudio(item);
      return;
    }

    setPlayChoiceModal({ open: true, pendingSong: song, pendingCollection: null });
  }, [queue.length, startAudio]);

  /**
   * Ask to play a playlist (or the rest of one, starting at a clicked row).
   * Same rules as a single song: empty queue → plays immediately; otherwise
   * the PlayChoiceModal asks "Play now" or "Add to queue".
   *
   *   tracks     – the playlist's tracks, in playlist order
   *   playlist   – { playlistId, name, coverUrl }
   *   startIndex – row the user clicked; omit to start at the top
   *   shuffle    – true for the playlist's Shuffle button
   */
  const requestPlayCollection = useCallback(({ tracks, playlist, startIndex = 0, shuffle = false }) => {
    const playable = (tracks || []).filter(t => t && (t.url || t.fileUrl));
    if (playable.length === 0) return;

    const from = Math.max(0, Math.min(startIndex, playable.length - 1));
    const ordered = shuffle ? fisherYatesShuffle(playable) : playable.slice(from);

    const origin = playlist ? {
      type: 'playlist',
      playlistId: playlist.playlistId || playlist.id,
      name: playlist.name || 'Playlist',
      coverUrl: playlist.coverUrl || null,
      batchId: newQid(),
    } : null;

    const collection = {
      tracks: ordered,
      origin,
      title: playlist?.name || 'Playlist',
      artwork: playlist?.coverUrl || ordered[0]?.artworkUrl || ordered[0]?.artwork || null,
      // Set only when the user clicked a specific row: "Starts with <song>"
      startTitle: !shuffle && from > 0 ? (ordered[0]?.title || null) : null,
      shuffled: shuffle,
    };

    if (queue.length === 0) {
      insertCollection(collection, 'empty');
      return;
    }

    setPlayChoiceModal({ open: true, pendingSong: null, pendingCollection: collection });
  }, [queue.length, insertCollection]);

  const closePlayChoice = () =>
    setPlayChoiceModal({ open: false, pendingSong: null, pendingCollection: null });

  const confirmPlayNow = useCallback(() => {
    const { pendingSong, pendingCollection } = playChoiceModal;
    closePlayChoice();

    if (pendingCollection) {
      insertCollection(pendingCollection, 'now');
      return;
    }
    if (!pendingSong) return;

    const item = toQueueItem(pendingSong, null);
    const insertAt = Math.min(currentIndex + 1, queue.length);
    const nq = [...queue];
    nq.splice(insertAt, 0, item);
    setQueue(nq);
    setOriginalQueue(isShuffled ? [...originalQueue, item] : nq);
    setCurrentIndex(insertAt);
    setCurrentMedia(item);
    startAudio(item);
  }, [playChoiceModal, insertCollection, queue, originalQueue, currentIndex, isShuffled, startAudio]);

  const confirmAddToQueue = useCallback(() => {
    const { pendingSong, pendingCollection } = playChoiceModal;
    closePlayChoice();

    if (pendingCollection) {
      insertCollection(pendingCollection, 'end');
      return;
    }
    if (!pendingSong) return;

    const item = toQueueItem(pendingSong, null);
    const nq = [...queue, item];
    setQueue(nq);
    setOriginalQueue(isShuffled ? [...originalQueue, item] : nq);
  }, [playChoiceModal, insertCollection, queue, originalQueue, isShuffled]);

  const cancelPlayChoice = useCallback(() => {
    closePlayChoice();
  }, []);

  // ========================================================================
  // QUEUE MANAGEMENT — Play Next / Play Later / Remove / Reorder / Clear / Save
  // ========================================================================

  // `origin` is optional — pass a playlist origin to tag a single song as
  // having come from a playlist.
  const playNext = (song, origin = null) => {
    if (!song) return;
    const item = toQueueItem(song, origin);
    const insertAt = Math.min(currentIndex + 1, queue.length);
    const nq = [...queue];
    nq.splice(insertAt, 0, item);
    setQueue(nq);
    setOriginalQueue(isShuffled ? [...originalQueue, item] : nq);
  };

  const playLater = (song, origin = null) => {
    if (!song) return;
    const item = toQueueItem(song, origin);
    const nq = [...queue, item];
    setQueue(nq);
    setOriginalQueue(isShuffled ? [...originalQueue, item] : nq);
  };

  /**
   * Remove entries by qid. The song that's currently playing is never removed
   * (stop it with the transport instead), so removing a whole playlist group
   * that contains the current song removes everything else in that group.
   */
  const removeQueueItems = useCallback((qids) => {
    const drop = new Set(qids || []);
    const current = queue[currentIndex];
    if (current) drop.delete(current.qid);
    if (drop.size === 0) return;

    const nq = queue.filter(t => !drop.has(t.qid));
    const newIndex = current ? nq.findIndex(t => t.qid === current.qid) : 0;
    setQueue(nq);
    setOriginalQueue(prev => prev.filter(t => !drop.has(t.qid)));
    setCurrentIndex(newIndex >= 0 ? newIndex : 0);
  }, [queue, currentIndex]);

  // Index-based removal kept for existing callers.
  const removeFromQueue = (index) => {
    const item = queue[index];
    if (item) removeQueueItems([item.qid]);
  };

  /** Replace the queue order. The current song is re-located by its entry id. */
  const reorderQueue = (newQueue) => {
    const current = queue[currentIndex];
    setQueue(newQueue);
    if (!isShuffled) setOriginalQueue(newQueue);
    const newIndex = current ? newQueue.findIndex(t => t.qid === current.qid) : -1;
    setCurrentIndex(newIndex >= 0 ? newIndex : 0);
  };

  /** Move one entry from one position to another (used by drag and drop). */
  const moveQueueItem = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= queue.length || toIndex >= queue.length) return;
    const nq = [...queue];
    const [moved] = nq.splice(fromIndex, 1);
    nq.splice(toIndex, 0, moved);
    reorderQueue(nq);
  };

  const clearQueue = () => {
    setQueue([]);
    setOriginalQueue([]);
    setCurrentIndex(0);
    setCurrentMedia(null);
    setQueueSource(null);
    setIsShuffled(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setIsPlaying(false);
  };

  const saveQueueAsPlaylist = async (name) => {
    if (queue.length === 0) throw new Error('Queue is empty');

    try {
      const createRes = await axiosInstance.post('/v1/playlists', { name });
      const newPlaylistId = createRes.data.playlistId;

      for (const track of queue) {
        const songId = track.songId || track.id;
        if (songId) {
          try {
            await axiosInstance.post(`/v1/playlists/${newPlaylistId}/tracks`, { songId });
          } catch (err) {
            console.warn(`Failed to add track ${songId}:`, err);
          }
        }
      }

      await loadUserPlaylists();
      return newPlaylistId;
    } catch (error) {
      console.error('Failed to save queue as playlist:', error);
      throw error;
    }
  };

  // ========================================================================
  // SHUFFLE
  // ========================================================================

  const toggleShuffle = () => {
    const current = queue[currentIndex];

    if (isShuffled) {
      setQueue(originalQueue);
      setIsShuffled(false);
      const newIndex = current ? originalQueue.findIndex(t => t.qid === current.qid) : -1;
      setCurrentIndex(newIndex >= 0 ? newIndex : 0);
    } else {
      const rest = queue.filter((_, i) => i !== currentIndex);
      const shuffledRest = fisherYatesShuffle(rest);
      setOriginalQueue(queue);              // snapshot the order to return to
      setQueue(current ? [current, ...shuffledRest] : shuffledRest);
      setIsShuffled(true);
      setCurrentIndex(0);
    }
  };

  // ========================================================================
  // PLAYLIST CRUD
  // ========================================================================

  const createPlaylist = async (name, type = 'personal', options = {}) => {
    try {
      await axiosInstance.post('/v1/playlists', {
        name,
        type,
        visibility: options.visibility || 'private',
        description: options.description || null,
        jurisdictionId: options.jurisdictionId || null,
        coverImageUrl: options.coverImageUrl || null
      });
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to create playlist:', error);
      throw error;
    }
  };

  const addToPlaylist = async (playlistId, track) => {
    try {
      const songId = track.songId || track.id;
      await axiosInstance.post(`/v1/playlists/${playlistId}/tracks`, { songId });
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to add track:', error);
      throw error;
    }
  };

  const removeFromPlaylist = async (playlistId, playlistItemId) => {
    try {
      await axiosInstance.delete(`/v1/playlists/${playlistId}/tracks/${playlistItemId}`);
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to remove track:', error);
      throw error;
    }
  };

  const reorderPlaylist = async (playlistId, newOrderedTracks) => {
    try {
      const orderedIds = newOrderedTracks.map(t => t.playlistItemId);
      await axiosInstance.put(`/v1/playlists/${playlistId}/reorder`, orderedIds);
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to reorder playlist:', error);
      throw error;
    }
  };

  const deletePlaylist = async (playlistId) => {
    try {
      await axiosInstance.delete(`/v1/playlists/${playlistId}`);
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      throw error;
    }
  };

  const updatePlaylist = async (playlistId, updates) => {
    try {
      const payload = typeof updates === 'string' ? { name: updates } : updates;
      await axiosInstance.put(`/v1/playlists/${playlistId}`, payload);
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to update playlist:', error);
      throw error;
    }
  };

  // ========================================================================
  // FOLLOW / UNFOLLOW
  // ========================================================================

  const followPlaylist = async (playlistId) => {
    try {
      await axiosInstance.post(`/v1/playlists/${playlistId}/follow`);
      await loadFollowedPlaylists();
    } catch (error) {
      console.error('Failed to follow playlist:', error);
      throw error;
    }
  };

  const unfollowPlaylist = async (playlistId) => {
    try {
      await axiosInstance.delete(`/v1/playlists/${playlistId}/follow`);
      await loadFollowedPlaylists();
    } catch (error) {
      console.error('Failed to unfollow playlist:', error);
      throw error;
    }
  };

  // ========================================================================
  // COMMUNITY PLAYLIST ACTIONS
  // ========================================================================

  const suggestSong = async (playlistId, songId) => {
    try {
      const res = await axiosInstance.post(`/v1/playlists/${playlistId}/suggest`, { songId });
      return res.data;
    } catch (error) {
      console.error('Failed to suggest song:', error);
      throw error;
    }
  };

  const voteOnSuggestion = async (playlistId, itemId, voteType) => {
    try {
      const res = await axiosInstance.post(
        `/v1/playlists/${playlistId}/tracks/${itemId}/vote`,
        { voteType }
      );
      return res.data;
    } catch (error) {
      console.error('Failed to vote:', error);
      throw error;
    }
  };

  // ========================================================================
  // BLOCKED SONGS
  // ========================================================================

  const blockSong = async (songId) => {
    try {
      await axiosInstance.post('/v1/playlists/blocked-songs', { songId });
    } catch (error) {
      console.error('Failed to block song:', error);
      throw error;
    }
  };

  const unblockSong = async (songId) => {
    try {
      await axiosInstance.delete(`/v1/playlists/blocked-songs/${songId}`);
    } catch (error) {
      console.error('Failed to unblock song:', error);
      throw error;
    }
  };

  // ========================================================================
  // LOAD PLAYLIST INTO QUEUE
  // ========================================================================

  // Pours a playlist into the queue (never replaces it). Kept for any caller
  // that still passes a playlist object; new code calls requestPlayCollection.
  const loadPlaylist = async (pl) => {
    if (!pl) return;
    const full = (pl.tracks && pl.tracks.length > 0)
      ? pl
      : await loadPlaylistDetails(pl.playlistId || pl.id);
    if (!full || !full.tracks || full.tracks.length === 0) return;

    requestPlayCollection({
      tracks: full.tracks,
      playlist: {
        playlistId: full.playlistId || full.id,
        name: full.name,
        coverUrl: full.coverImageUrl ? buildUrl(full.coverImageUrl) : null,
      },
    });
  };

  // ========================================================================
  // AUDIO EVENT SYNC
  // ========================================================================

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (repeatMode === 'one' && audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }
      setIsPlaying(false);
      next();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [next]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable) return;
      if (e.key === ' ' || e.keyCode === 32) {
        e.preventDefault();
        togglePlayPause();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause]);

  // ========================================================================
  // MEDIA SESSION API — Background playback & system media controls
  // ========================================================================
  //
  // This gives Unis native-feeling media controls on Android (notification
  // panel, lock screen) and desktop (keyboard media keys). It works in any
  // modern browser — no PWA or service worker required.
  //
  // Three useEffects, each with a single responsibility:
  //   1. Metadata — updates track info whenever currentMedia changes
  //   2. Action handlers — wires play/pause/next/prev to system controls
  //   3. Position state — keeps the notification seek bar accurate

  // --- 1. Metadata: track info shown in notification panel / lock screen ---
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentMedia) return;

    // Resolve artwork URL — must be absolute for the OS to fetch it
    const artworkUrl =
      buildUrl(currentMedia.artworkUrl || currentMedia.artwork || currentMedia.coverImageUrl)
      || `${window.location.origin}/default-artwork.png`;

    navigator.mediaSession.metadata = new MediaMetadata({
      title:  currentMedia.title  || currentMedia.name || 'Unknown Track',
      artist: currentMedia.artist || currentMedia.artistName || 'Unknown Artist',
      // Jurisdiction as "album" — lock screen shows the neighborhood. On brand.
      album:  currentMedia.jurisdictionName || currentMedia.jurisdiction || 'Unis',
      artwork: [
        { src: artworkUrl, sizes: '96x96',   type: 'image/png' },
        { src: artworkUrl, sizes: '128x128', type: 'image/png' },
        { src: artworkUrl, sizes: '192x192', type: 'image/png' },
        { src: artworkUrl, sizes: '256x256', type: 'image/png' },
        { src: artworkUrl, sizes: '384x384', type: 'image/png' },
        { src: artworkUrl, sizes: '512x512', type: 'image/png' },
      ],
    });
  }, [currentMedia]);

  // --- 2. Action handlers: system-level play/pause/next/prev buttons ---
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const audio = audioRef.current;

    const actionHandlers = {
      play: async () => {
        try { await audio?.play(); }
        catch (e) { console.warn('Media session play failed:', e); }
      },
      pause: () => {
        audio?.pause();
      },
      previoustrack: () => {
        // If more than 3 seconds in, restart the current track instead of going back
        if (audio && audio.currentTime > 3) {
          audio.currentTime = 0;
        } else {
          prev();
        }
      },
      nexttrack: () => {
        next();
      },
      seekto: (details) => {
        if (audio && details.seekTime != null) {
          audio.currentTime = details.seekTime;
        }
      },
    };

    // Register each handler safely — not all browsers support all actions
    for (const [action, handler] of Object.entries(actionHandlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {
        console.warn(`Media session: "${action}" not supported in this browser`);
      }
    }

    return () => {
      for (const action of Object.keys(actionHandlers)) {
        try { navigator.mediaSession.setActionHandler(action, null); }
        catch (_) { /* ignore */ }
      }
    };
  }, [next, prev]);

  // --- 3. Position state: keeps the notification seek bar accurate ---
  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    const audio = audioRef.current;
    if (!audio) return;

    const syncPosition = () => {
      if (!audio.duration || !isFinite(audio.duration)) return;
      try {
        navigator.mediaSession.setPositionState({
          duration:     audio.duration,
          playbackRate: audio.playbackRate,
          position:     Math.min(audio.currentTime, audio.duration),
        });
      } catch (_) {
        // Some browsers throw during track transitions when position > duration briefly
      }
    };

    // Throttle: update every ~1s instead of every 250ms timeupdate tick
    let lastSync = 0;
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSync >= 1000) {
        lastSync = now;
        syncPosition();
      }
    };

    // Also sync immediately when a new track starts playing
    const handleLoadedMetadata = () => syncPosition();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  // ========================================================================
  // HELPERS
  // ========================================================================

  const normalizePlaylistResponse = (data) => {
    if (!data) return null;
    return {
      ...data,
      id: data.playlistId,
      tracks: (data.tracks || []).map(t => ({
        ...t,
        id: t.songId,
        songId: t.songId,
        artist: t.artistName,
        artworkUrl: buildUrl(t.artworkUrl),
        artwork: buildUrl(t.artworkUrl),
        fileUrl: buildUrl(t.fileUrl),
        url: buildUrl(t.fileUrl),
      }))
    };
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  // ========================================================================
  // PLAYLIST MANAGER OPEN — with self-healing lazy fetch
  // ========================================================================
  //
  // Third line of defense: even if the mount-time fetch and the login event
  // both somehow missed, the moment the user opens the playlist manager we
  // check: do I have a token but no playlists? If so, fetch them right now.
  // This makes the system bulletproof.

  const openPlaylistManager = useCallback(() => {
    setShowPlaylistManager(true);

    const token = localStorage.getItem('token');
    if (token && playlists.length === 0 && !loading) {
      loadUserPlaylists();
      loadFollowedPlaylists();
    }
  }, [playlists.length, loading, loadUserPlaylists, loadFollowedPlaylists]);

  // ========================================================================
  // CONTEXT VALUE
  // ========================================================================

  return (
    <PlayerContext.Provider value={{
      navDirectionRef,
      // Player state
      isExpanded,
      toggleExpand,
      currentMedia,
      isPlaying,
      togglePlayPause,
      requestPlay,
      requestPlayCollection,
      playChoiceModal,
      confirmPlayNow,
      confirmAddToQueue,
      cancelPlayChoice,
      audioRef,

      // Do-not-play list. Exposed for a future "manage blocked songs" settings
      // screen and so any surface can reflect blocked state without refetching.
      blockedSongIds,
      isTrackBlocked,
      loadBlockedSongs,

      // Queue persistence — player.jsx calls this once on the first load after
      // a refresh so it can seek to the saved offset instead of restarting.
      consumePendingResume,

      // Playback
      playMedia,
      next,
      prev,

      // Queue
      queue,
      currentIndex,
      queueSource,
      playQueueIndex,
      playNext,
      playLater,
      removeFromQueue,
      removeQueueItems,
      reorderQueue,
      moveQueueItem,
      clearQueue,
      saveQueueAsPlaylist,

      // Shuffle
      isShuffled,
      toggleShuffle,
      
      // Repeat  // 
      repeatMode,
      cycleRepeat,

      // Autoplay
      autoplay,
      setAutoplay,

      // Playlist library
      playlists,
      followedPlaylists,
      loading,
      loadPlaylistDetails,
      createPlaylist,
      addToPlaylist,
      removeFromPlaylist,
      reorderPlaylist,
      deletePlaylist,
      updatePlaylist,
      updatePlaylistName: (id, name) => updatePlaylist(id, { name }),
      loadPlaylist,
      refreshPlaylists: loadUserPlaylists,

      // Following
      followPlaylist,
      unfollowPlaylist,
      loadFollowedPlaylists,

      // Community
      suggestSong,
      voteOnSuggestion,

      // Blocked songs
      blockSong,
      unblockSong,

      // Playlist manager modal
      showPlaylistManager,
      openPlaylistManager,
      closePlaylistManager: () => setShowPlaylistManager(false),

      // Legacy compat
      playlist: queue,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};