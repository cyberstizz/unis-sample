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
    restoredRef.current = loadQueueState(getCurrentUserId()) ?? false;
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
  const [playChoiceModal, setPlayChoiceModal] = useState({ open: false, pendingSong: null });


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
  const [loading, setLoading] = useState(false);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);

  const audioRef = useRef(null);

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
    }

    // Strategy 2: listen for login/logout events
    const handleLogin = () => {
      loadUserPlaylists();
      loadFollowedPlaylists();
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

    window.addEventListener('unis:login', handleLogin);
    window.addEventListener('unis:logout', handleLogout);
    // The 401 interceptor tears the session down in-app without a redirect,
    // so it needs the same treatment as an explicit logout.
    window.addEventListener('unis:session-expired', handleLogout);

    return () => {
      window.removeEventListener('unis:login', handleLogin);
      window.removeEventListener('unis:logout', handleLogout);
      window.removeEventListener('unis:session-expired', handleLogout);
    };
  }, [loadUserPlaylists, loadFollowedPlaylists]);

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
    setCurrentMedia(media);

    if (newQueue.length > 0) {
      setQueue(newQueue);
      setOriginalQueue(newQueue);
      setIsShuffled(false);
      setCurrentIndex(newQueue.findIndex(t => (t.id || t.songId) === (media.id || media.songId)) || 0);
      setQueueSource(sourceName);
    } else {
      const idx = queue.findIndex(t => (t.id || t.songId) === (media.id || media.songId));
      if (idx >= 0) {
        setCurrentIndex(idx);
      }
    }

    if (audioRef.current) {
      audioRef.current.src = media.url || media.fileUrl;
      audioRef.current.play().then(() => setIsPlaying(true))
        .catch(err => console.error('Play failed:', err));
    }
  };

  const next = useCallback(() => {
    if (queue.length === 0) return;
    const nextIndex = currentIndex + 1;

  if (nextIndex >= queue.length) {
    if (repeatMode === 'all') {     
    setCurrentIndex(0);
    setCurrentMedia(queue[0]);
    return;
    }
    setIsPlaying(false);           
    return;
  }

    setCurrentIndex(nextIndex);
    setCurrentMedia(queue[nextIndex]);
  }, [queue, currentIndex, repeatMode]);

  const prev = useCallback(() => {
    if (queue.length === 0) return;
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    setCurrentIndex(prevIndex);
    setCurrentMedia(queue[prevIndex]);
  }, [queue, currentIndex]);

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

  const requestPlay = useCallback((song) => {
  if (!song) return;
 
  if (queue.length === 0) {
    // Empty queue: this song becomes the queue. No prompt.
    setQueue([song]);
    setOriginalQueue([song]);
    setCurrentIndex(0);
    setCurrentMedia(song);
    setQueueSource(null);
    if (audioRef.current) {
      audioRef.current.src = song.url || song.fileUrl;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Play failed:', err));
    }
    return;
  }
 
  // Queue non-empty → ask the user
  setPlayChoiceModal({ open: true, pendingSong: song });
}, [queue.length]);
 
  const confirmPlayNow = useCallback(() => {
    const song = playChoiceModal.pendingSong;
    if (!song) return;
  
    // Insert immediately after the current track, then jump to it and play.
    const insertIndex = currentIndex + 1;
    const newQueue = [...queue];
    newQueue.splice(insertIndex, 0, song);
  
    setQueue(newQueue);
    setOriginalQueue(prev => [...prev, song]);
    setCurrentIndex(insertIndex);
    setCurrentMedia(song);
  
    if (audioRef.current) {
      audioRef.current.src = song.url || song.fileUrl;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Play failed:', err));
    }
  
    setPlayChoiceModal({ open: false, pendingSong: null });
  }, [playChoiceModal.pendingSong, queue, currentIndex]);
  
  const confirmAddToQueue = useCallback(() => {
    const song = playChoiceModal.pendingSong;
    if (!song) return;
    setQueue(prev => [...prev, song]);
    setOriginalQueue(prev => [...prev, song]);
    setPlayChoiceModal({ open: false, pendingSong: null });
  }, [playChoiceModal.pendingSong]);
  
  const cancelPlayChoice = useCallback(() => {
    setPlayChoiceModal({ open: false, pendingSong: null });
  }, []);

  // ========================================================================
  // QUEUE MANAGEMENT — Play Next / Play Later / Clear / Save
  // ========================================================================

  const playNext = (song) => {
    const insertIndex = currentIndex + 1;
    const newQueue = [...queue];
    newQueue.splice(insertIndex, 0, song);
    setQueue(newQueue);
    setOriginalQueue([...originalQueue, song]);
  };

  const playLater = (song) => {
    setQueue(prev => [...prev, song]);
    setOriginalQueue(prev => [...prev, song]);
  };

  const removeFromQueue = (index) => {
    if (index === currentIndex) return;
    const newQueue = [...queue];
    newQueue.splice(index, 1);
    setQueue(newQueue);
    if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const reorderQueue = (newQueue) => {
    const currentSong = queue[currentIndex];
    setQueue(newQueue);
    const newIndex = newQueue.findIndex(t =>
      (t.id || t.songId) === (currentSong?.id || currentSong?.songId)
    );
    setCurrentIndex(newIndex >= 0 ? newIndex : 0);
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
    if (isShuffled) {
      const currentSong = queue[currentIndex];
      setQueue(originalQueue);
      setIsShuffled(false);
      const newIndex = originalQueue.findIndex(t =>
        (t.id || t.songId) === (currentSong?.id || currentSong?.songId)
      );
      setCurrentIndex(newIndex >= 0 ? newIndex : 0);
    } else {
      const currentSong = queue[currentIndex];
      const rest = queue.filter((_, i) => i !== currentIndex);
      const shuffledRest = fisherYatesShuffle(rest);
      const newQueue = [currentSong, ...shuffledRest];
      setQueue(newQueue);
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

  const loadPlaylist = async (pl) => {
    if (pl.tracks && pl.tracks.length > 0) {
      setQueue(pl.tracks);
      setOriginalQueue(pl.tracks);
      setCurrentIndex(0);
      setCurrentMedia(pl.tracks[0]);
      setQueueSource(pl.name);
      setIsShuffled(false);
      return;
    }

    const fullPlaylist = await loadPlaylistDetails(pl.playlistId || pl.id);
    if (fullPlaylist && fullPlaylist.tracks.length > 0) {
      setQueue(fullPlaylist.tracks);
      setOriginalQueue(fullPlaylist.tracks);
      setCurrentIndex(0);
      setCurrentMedia(fullPlaylist.tracks[0]);
      setQueueSource(fullPlaylist.name);
      setIsShuffled(false);
    }
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
      // Player state
      isExpanded,
      toggleExpand,
      currentMedia,
      isPlaying,
      togglePlayPause,
      requestPlay,
      playChoiceModal,
      confirmPlayNow,
      confirmAddToQueue,
      cancelPlayChoice,
      audioRef,

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
      playNext,
      playLater,
      removeFromQueue,
      reorderQueue,
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