// src/context/PlayerContext.js (fixed - no playlist load on login page)
import React, { createContext, useState, useRef, useEffect, useCallback } from 'react';
import playlistService from '../playlistService';

export const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);

  const audioRef = useRef(null);

  // FIXED: Only load playlists if user is authenticated
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      console.log('Token found, loading playlists');
      loadUserPlaylists();
    } else {
      console.log('No token found, skipping playlist load');
    }
  }, []);

  const loadUserPlaylists = async () => {
    // Double-check auth before making the call
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token, aborting playlist load');
      return;
    }

    try {
      setLoading(true);
      const data = await playlistService.getUserPlaylists();
      console.log('Raw playlist data from backend:', data);
      
      const transformed = data.map(pl => ({
        id: pl.playlistId,
        playlistId: pl.playlistId,
        name: pl.name,
        tracks: pl.tracks.map(track => ({
          ...track,
          id: track.songId,
          songId: track.songId,
          playlistItemId: track.playlistItemId,
          title: track.title,
          jurisdiction: track.jurisdiction,
          artist: track.artistName,
          artistName: track.artistName,
          artworkUrl: track.artworkUrl,
          artwork: track.artworkUrl,
          fileUrl: track.fileUrl,
          url: track.fileUrl,
          duration: track.duration
        }))
      }));
      console.log('Transformed playlists:', transformed);
      setPlaylists(transformed);
    } catch (error) {
      console.error('Failed to load playlists:', error);
      // Set empty array on error instead of leaving undefined
      setPlaylists([]);
    } finally {
      setLoading(false);
    }
  };

  const playMedia = (media, newPlaylist = []) => {
    setCurrentMedia(media);
    if (newPlaylist.length) {
      setPlaylist(newPlaylist);
      setCurrentIndex(0);
    } else {
      setCurrentIndex(playlist.findIndex(p => p.id === media.id) || 0);
    }
    if (audioRef.current) {
      audioRef.current.src = media.url || media.fileUrl;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Play failed:', err);
      });
    }
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const next = () => {
    const nextIndex = (currentIndex + 1) % playlist.length;
    setCurrentIndex(nextIndex);
    setCurrentMedia(playlist[nextIndex]);
  };

  const prev = () => {
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    setCurrentIndex(prevIndex);
    setCurrentMedia(playlist[prevIndex]);
  };

  const togglePlayPause = useCallback(() => {
    if (audioRef.current && currentMedia) {
      if (audioRef.current.paused) {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error('Play failed:', err);
        });
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [currentMedia]);

  // Sync isPlaying state with audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      if (playlist.length > 1) {
        next();
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [playlist]);

  // Global spacebar listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInputFocused = 
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable;

      if ((e.key === ' ' || e.keyCode === 32) && !isInputFocused) {
        e.preventDefault();
        togglePlayPause();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause]);

  const createPlaylist = async (name) => {
    try {
      await playlistService.createPlaylist(name);
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to create playlist:', error);
      throw error;
    }
  };

  const addToPlaylist = async (playlistId, track) => {
    try {
      await playlistService.addTrackToPlaylist(playlistId, track.songId || track.id);
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to add track:', error);
      throw error;
    }
  };

  const removeFromPlaylist = async (playlistId, playlistItemId) => {
    try {
      await playlistService.removeTrackFromPlaylist(playlistId, playlistItemId);
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to remove track:', error);
      throw error;
    }
  };

  const reorderPlaylist = async (playlistId, newOrderedTracks) => {
    try {
      const orderedIds = newOrderedTracks.map(t => t.playlistItemId);
      await playlistService.reorderPlaylist(playlistId, orderedIds);
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to reorder playlist:', error);
      throw error;
    }
  };

  const deletePlaylist = async (playlistId) => {
    try {
      await playlistService.deletePlaylist(playlistId);
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      throw error;
    }
  };

  const updatePlaylistName = async (playlistId, newName) => {
    try {
      await playlistService.updatePlaylist(playlistId, newName);
      await loadUserPlaylists();
    } catch (error) {
      console.error('Failed to update playlist:', error);
      throw error;
    }
  };

  const loadPlaylist = (pl) => {
    setPlaylist(pl.tracks);
    setCurrentIndex(0);
    if (pl.tracks.length) setCurrentMedia(pl.tracks[0]);
  };

  return (
    <PlayerContext.Provider value={{ 
      isExpanded, 
      toggleExpand, 
      currentMedia, 
      playMedia, 
      next, 
      prev, 
      audioRef,
      playlists, 
      loading,
      isPlaying,
      togglePlayPause,
      createPlaylist, 
      addToPlaylist, 
      removeFromPlaylist, 
      reorderPlaylist, 
      deletePlaylist,
      updatePlaylistName,
      loadPlaylist,
      refreshPlaylists: loadUserPlaylists,
      showPlaylistManager,
      openPlaylistManager: () => setShowPlaylistManager(true),
      closePlaylistManager: () => setShowPlaylistManager(false),
    }}>
      {children}
    </PlayerContext.Provider>
  );
};