// src/context/PlayerContext.js
import React, { createContext, useState, useRef, useEffect, useCallback } from 'react';
import axiosInstance from '../components/axiosInstance';

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

export const PlayerProvider = ({ children }) => {
  // --- Player state ---
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // --- Queue state (session-based, ephemeral) ---
  const [queue, setQueue] = useState([]);           // the active play queue
  const [queueSource, setQueueSource] = useState(null); // name of playlist/context that seeded the queue
  const [isShuffled, setIsShuffled] = useState(false);
  const [originalQueue, setOriginalQueue] = useState([]); // pre-shuffle order for un-shuffle
  const [autoplay, setAutoplay] = useState(false);

  // --- Playlist library state ---
  const [playlists, setPlaylists] = useState([]);
  const [followedPlaylists, setFollowedPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);

  const audioRef = useRef(null);

  // ========================================================================
  // INIT — Load playlists if authenticated
  // ========================================================================

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadUserPlaylists();
      loadFollowedPlaylists();
    }
  }, []);

  // ========================================================================
  // PLAYLIST LOADING
  // ========================================================================

  const loadUserPlaylists = async () => {
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
        // tracks are loaded on-demand when viewing a playlist, not in summary
        tracks: []
      }));

      setPlaylists(transformed);
    } catch (error) {
      console.error('Failed to load playlists:', error);
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFollowedPlaylists = async () => {
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
  };

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
      // End of queue
      if (autoplay) {
        // TODO: fetch recommended songs and continue
        setIsPlaying(false);
      } else {
        setIsPlaying(false);
      }
      return;
    }

    setCurrentIndex(nextIndex);
    setCurrentMedia(queue[nextIndex]);
  }, [queue, currentIndex, autoplay]);

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

  // ========================================================================
  // QUEUE MANAGEMENT — Play Next / Play Later / Clear / Save
  // ========================================================================

  /** Insert a song immediately after the currently playing track */
  const playNext = (song) => {
    const insertIndex = currentIndex + 1;
    const newQueue = [...queue];
    newQueue.splice(insertIndex, 0, song);
    setQueue(newQueue);
    setOriginalQueue([...originalQueue, song]);
  };

  /** Append a song to the end of the queue */
  const playLater = (song) => {
    setQueue(prev => [...prev, song]);
    setOriginalQueue(prev => [...prev, song]);
  };

  /** Remove a specific song from the queue by index */
  const removeFromQueue = (index) => {
    if (index === currentIndex) return; // can't remove currently playing
    const newQueue = [...queue];
    newQueue.splice(index, 1);
    setQueue(newQueue);
    // Adjust currentIndex if removed item was before current
    if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  /** Reorder the queue via drag-and-drop */
  const reorderQueue = (newQueue) => {
    const currentSong = queue[currentIndex];
    setQueue(newQueue);
    // Find where the current song ended up
    const newIndex = newQueue.findIndex(t =>
      (t.id || t.songId) === (currentSong?.id || currentSong?.songId)
    );
    setCurrentIndex(newIndex >= 0 ? newIndex : 0);
  };

  /** Clear the entire queue */
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

  /** Save the current queue as a new playlist */
  const saveQueueAsPlaylist = async (name) => {
    if (queue.length === 0) throw new Error('Queue is empty');

    try {
      // Create the playlist
      const createRes = await axiosInstance.post('/v1/playlists', { name });
      const newPlaylistId = createRes.data.playlistId;

      // Add each track
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
      // Un-shuffle: restore original order
      const currentSong = queue[currentIndex];
      setQueue(originalQueue);
      setIsShuffled(false);
      const newIndex = originalQueue.findIndex(t =>
        (t.id || t.songId) === (currentSong?.id || currentSong?.songId)
      );
      setCurrentIndex(newIndex >= 0 ? newIndex : 0);
    } else {
      // Shuffle: randomize but keep current song at position 0
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
      // updates can be { name, visibility, description, coverImageUrl }
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
    // If we have tracks already (from PlaylistViewer), use them
    if (pl.tracks && pl.tracks.length > 0) {
      setQueue(pl.tracks);
      setOriginalQueue(pl.tracks);
      setCurrentIndex(0);
      setCurrentMedia(pl.tracks[0]);
      setQueueSource(pl.name);
      setIsShuffled(false);
      return;
    }

    // Otherwise load from API
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

  // Global spacebar
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
  // HELPERS
  // ========================================================================

  const normalizePlaylistResponse = (data) => {
    if (!data) return null;
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
    const buildUrl = (url) => {
      if (!url) return null;
      return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    };

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
      audioRef,

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
      openPlaylistManager: () => setShowPlaylistManager(true),
      closePlaylistManager: () => setShowPlaylistManager(false),

      // Legacy compat — "playlist" was the old queue
      playlist: queue,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};