// src/context/PlayerContext.js (updated for playlists)
import React, { createContext, useState, useRef, useEffect } from 'react';

export const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(null);
  const [playlist, setPlaylist] = useState([]); // Current playlist
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playlists, setPlaylists] = useState([]); // All user playlists
  const audioRef = useRef(null);

  // Load default playlist on mount (MVP: mock feed data)
  useEffect(() => {
    const defaultPlaylist = [
      // Mock feed items; replace with real feed fetch
      { type: 'song', url: 'path/to/song1.mp3', title: 'Song 1', artist: 'Artist A', artwork: 'art1.jpg' },
      // Add 10-20 from feed
    ];
    setPlaylist(defaultPlaylist);
    setPlaylists([{ id: 'default', name: 'Default Feed Playlist', tracks: defaultPlaylist, isDefault: true }]); // Save as playlist
    // Load from localStorage if exists
    const savedPlaylists = JSON.parse(localStorage.getItem('unisPlaylists')) || [];
    if (savedPlaylists.length) setPlaylists(savedPlaylists);
  }, []);

  // Save playlists to localStorage
  useEffect(() => {
    localStorage.setItem('unisPlaylists', JSON.stringify(playlists));
  }, [playlists]);

  const playMedia = (media, newPlaylist = []) => {
    setCurrentMedia(media);
    if (newPlaylist.length) {
      setPlaylist(newPlaylist);
      setCurrentIndex(0);
    } else {
      setCurrentIndex(playlist.findIndex(p => p.id === media.id) || 0);
    }
    if (audioRef.current) {
      audioRef.current.src = media.url;
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

  // Create new playlist
  const createPlaylist = (name) => {
    const newPlaylist = { id: Date.now().toString(), name, tracks: [] };
    setPlaylists([...playlists, newPlaylist]);
  };

  // Add track to playlist
  const addToPlaylist = (playlistId, track) => {
    setPlaylists(playlists.map(pl => 
      pl.id === playlistId ? { ...pl, tracks: [...pl.tracks, track] } : pl
    ));
  };

  // Remove track
  const removeFromPlaylist = (playlistId, trackId) => {
    setPlaylists(playlists.map(pl => 
      pl.id === playlistId ? { ...pl, tracks: pl.tracks.filter(t => t.id !== trackId) } : pl
    ));
  };

  // Reorder (simple swap for MVP)
  const reorderPlaylist = (playlistId, oldIndex, newIndex) => {
    setPlaylists(playlists.map(pl => {
      if (pl.id === playlistId) {
        const newTracks = [...pl.tracks];
        const [moved] = newTracks.splice(oldIndex, 1);
        newTracks.splice(newIndex, 0, moved);
        return { ...pl, tracks: newTracks };
      }
      return pl;
    }));
  };

  // Load playlist to player
  const loadPlaylist = (pl) => {
    setPlaylist(pl.tracks);
    setCurrentIndex(0);
    if (pl.tracks.length) setCurrentMedia(pl.tracks[0]);
  };

  return (
    <PlayerContext.Provider value={{ 
      isExpanded, toggleExpand, currentMedia, playMedia, next, prev, audioRef,
      playlists, createPlaylist, addToPlaylist, removeFromPlaylist, reorderPlaylist, loadPlaylist 
    }}>
      {children}
    </PlayerContext.Provider>
  );
};