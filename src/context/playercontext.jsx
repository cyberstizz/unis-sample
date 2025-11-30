// src/context/PlayerContext.js (updated for backend integration)
import React, { createContext, useState, useRef, useEffect } from 'react';
import playlistService from '../services/playlistService';

export const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(null);
  const [playlist, setPlaylist] = useState([]); // Current playing queue
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playlists, setPlaylists] = useState([]); // All user playlists from backend
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  // Load user playlists from backend on mount
  useEffect(() => {
    loadUserPlaylists();
  }, []);

  const loadUserPlaylists = async () => {
    try {
      setLoading(true);
      const data = await playlistService.getUserPlaylists();
      console.log('Raw playlist data from backend:', data);
      
      // Transform backend data to frontend format
      const transformed = data.map(pl => ({
        id: pl.playlistId,
        playlistId: pl.playlistId,
        name: pl.name,
        tracks: pl.tracks.map(track => ({
          id: track.songId,
          songId: track.songId,
          playlistItemId: track.playlistItemId, // Important for deletion and reordering
          title: track.title,
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
      audioRef.current.play();
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

  // Create new playlist (backend)
  const createPlaylist = async (name) => {
    try {
      await playlistService.createPlaylist(name);
      // Cache is auto-invalidated by axios interceptor
      await loadUserPlaylists(); // Reload all playlists
    } catch (error) {
      console.error('Failed to create playlist:', error);
      throw error;
    }
  };

  // Add track to playlist (backend)
  const addToPlaylist = async (playlistId, track) => {
    try {
      await playlistService.addTrackToPlaylist(playlistId, track.songId || track.id);
      await loadUserPlaylists(); // Reload all playlists
    } catch (error) {
      console.error('Failed to add track:', error);
      throw error;
    }
  };

  // Remove track from playlist (backend)
  const removeFromPlaylist = async (playlistId, playlistItemId) => {
    try {
      await playlistService.removeTrackFromPlaylist(playlistId, playlistItemId);
      await loadUserPlaylists(); // Reload all playlists
    } catch (error) {
      console.error('Failed to remove track:', error);
      throw error;
    }
  };

  // Reorder playlist (backend)
  const reorderPlaylist = async (playlistId, newOrderedTracks) => {
    try {
      const orderedIds = newOrderedTracks.map(t => t.playlistItemId);
      await playlistService.reorderPlaylist(playlistId, orderedIds);
      await loadUserPlaylists(); // Reload all playlists
    } catch (error) {
      console.error('Failed to reorder playlist:', error);
      throw error;
    }
  };

  // Delete playlist (backend)
  const deletePlaylist = async (playlistId) => {
    try {
      await playlistService.deletePlaylist(playlistId);
      await loadUserPlaylists(); // Reload all playlists
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      throw error;
    }
  };

  // Update playlist name (backend)
  const updatePlaylistName = async (playlistId, newName) => {
    try {
      await playlistService.updatePlaylist(playlistId, newName);
      await loadUserPlaylists(); // Reload all playlists
    } catch (error) {
      console.error('Failed to update playlist:', error);
      throw error;
    }
  };

  // Load playlist to player
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
      createPlaylist, 
      addToPlaylist, 
      removeFromPlaylist, 
      reorderPlaylist, 
      deletePlaylist,
      updatePlaylistName,
      loadPlaylist,
      refreshPlaylists: loadUserPlaylists
    }}>
      {children}
    </PlayerContext.Provider>
  );
};