// src/components/SongNotification.js
import React, { useContext, useEffect, useState } from 'react';
import { PlayerContext } from './context/playercontext';
import './songNotification.scss';

const SongNotification = () => {
  const { currentMedia } = useContext(PlayerContext);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (currentMedia) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [currentMedia]);

  if (!show || !currentMedia) return null;

  const artworkSrc = currentMedia.artwork || '/default-artwork.png';

  return (
    <div className="song-notification">
      <div className="card">

        {/* Ambient blurred background sourced from artwork */}
        <div
          className="ambient-bg"
          style={{ backgroundImage: `url(${artworkSrc})` }}
        />

        {/* Foreground content */}
        <div className="glass-content">
          <img
            src={artworkSrc}
            alt="Artwork"
            className="notification-artwork"
          />
          <div className="notification-info">
            <h3>{currentMedia.title || 'Unknown Track'}</h3>
            <p className="artistName">{currentMedia.artist || 'Unknown Artist'}</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SongNotification;