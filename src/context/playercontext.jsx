import React, { createContext, useState, useRef } from 'react';

export const PlayerContext = createContext();

export const PlayerProvider = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentMedia, setCurrentMedia] = useState(null); // {type: 'song'/'video', url, title, artist, artwork}
  const [playlist, setPlaylist] = useState([]); // Array of media objects
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioRef = useRef(null); // For <audio> or <video>

  const playMedia = (media, newPlaylist = []) => {
    setCurrentMedia(media);
    setPlaylist(newPlaylist.length ? newPlaylist : [media]);
    setCurrentIndex(0);
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
    if (audioRef.current) audioRef.current.src = playlist[nextIndex].url;
  };

  const prev = () => {
    const prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    setCurrentIndex(prevIndex);
    setCurrentMedia(playlist[prevIndex]);
    if (audioRef.current) audioRef.current.src = playlist[prevIndex].url;
  };

  return (
    <PlayerContext.Provider value={{ isExpanded, toggleExpand, currentMedia, playMedia, next, prev, audioRef }}>
      {children}
    </PlayerContext.Provider>
  );
};