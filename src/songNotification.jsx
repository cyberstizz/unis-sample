import React, { useContext, useEffect, useState } from 'react';
import { PlayerContext } from './context/playercontext';
import './songNotification.scss';


// Deterministic bar pattern for the equalizer animation — heights in %,
// delays in seconds. 24 bars fill the notification width.
const EQ_BARS = [
  { h: 42, d: 0.00 }, { h: 88, d: 0.13 }, { h: 60, d: 0.26 }, { h: 100, d: 0.39 },
  { h: 50, d: 0.52 }, { h: 76, d: 0.09 }, { h: 36, d: 0.22 }, { h: 94, d: 0.35 },
  { h: 64, d: 0.48 }, { h: 82, d: 0.05 }, { h: 46, d: 0.18 }, { h: 70, d: 0.31 },
  { h: 90, d: 0.44 }, { h: 54, d: 0.01 }, { h: 98, d: 0.14 }, { h: 40, d: 0.27 },
  { h: 74, d: 0.40 }, { h: 58, d: 0.53 }, { h: 86, d: 0.10 }, { h: 48, d: 0.23 },
  { h: 68, d: 0.36 }, { h: 96, d: 0.49 }, { h: 44, d: 0.06 }, { h: 78, d: 0.19 },
];

const SongNotification = () => {
  const { currentMedia, isPlaying } = useContext(PlayerContext);
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

        <div
          className="ambient-bg"
          style={{ backgroundImage: `url(${artworkSrc})` }}
        />

        <div className="glass-content">
          <img
            src={artworkSrc}
            alt="Artwork"
            className="notification-artwork"
          />

          <div className="notification-info">
            <h3>{currentMedia.title || 'Unknown Track'}</h3>

            <p className="artistName">
              {currentMedia.artist || 'Unknown Artist'}
            </p>

            <div
              className={`notification-waveform ${isPlaying ? 'is-playing' : ''}`}
              aria-hidden="true"
            >
              {EQ_BARS.map((bar, i) => (
                <span
                  key={i}
                  className="eq-bar"
                  style={{ '--h': `${bar.h}%`, '--d': `${bar.d}s` }}
                />
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default SongNotification;