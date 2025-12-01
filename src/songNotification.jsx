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
      const timer = setTimeout(() => setShow(false), 3000); // Show for 3s
      return () => clearTimeout(timer);
    }
  }, [currentMedia]);

  if (!show || !currentMedia) return null;

  return (
    <div className="song-notification">
      <div className="card">      
        
        <img 
          src={currentMedia.artwork || '/default-artwork.png'} 
          alt="Artwork" 
          className="notification-artwork" 
        />
        <div className="notification-info">
          <h3>{currentMedia.title || 'Unknown Track'}</h3>
          <p>{currentMedia.artist || 'Unknown Artist'}</p>
        </div>
      </div>
    </div>
  );
};

export default SongNotification;