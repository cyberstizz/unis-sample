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

            <div className="notification-waveform">
              <div className="wave-scroll">

                <svg
                  className="wave-svg"
                  viewBox="0 0 600 40"
                  preserveAspectRatio="none"
                >
                  <path
                    d="
                      M0 20
                      L20 20
                      L30 8
                      L40 32
                      L50 20
                      L70 20
                      L80 10
                      L90 30
                      L100 20
                      L120 20
                      L130 5
                      L140 35
                      L150 20
                      L170 20
                      L180 12
                      L190 28
                      L200 20
                      L220 20
                      L230 7
                      L240 33
                      L250 20
                      L270 20
                      L280 10
                      L290 30
                      L300 20
                      L320 20
                      L330 6
                      L340 34
                      L350 20
                      L370 20
                      L380 11
                      L390 29
                      L400 20
                      L420 20
                      L430 8
                      L440 32
                      L450 20
                      L470 20
                      L480 10
                      L490 30
                      L500 20
                      L520 20
                      L530 6
                      L540 34
                      L550 20
                      L600 20
                    "
                  />
                </svg>

                <svg
                  className="wave-svg"
                  viewBox="0 0 600 40"
                  preserveAspectRatio="none"
                >
                  <path
                    d="
                      M0 20
                      L20 20
                      L30 8
                      L40 32
                      L50 20
                      L70 20
                      L80 10
                      L90 30
                      L100 20
                      L120 20
                      L130 5
                      L140 35
                      L150 20
                      L170 20
                      L180 12
                      L190 28
                      L200 20
                      L220 20
                      L230 7
                      L240 33
                      L250 20
                      L270 20
                      L280 10
                      L290 30
                      L300 20
                      L320 20
                      L330 6
                      L340 34
                      L350 20
                      L370 20
                      L380 11
                      L390 29
                      L400 20
                      L420 20
                      L430 8
                      L440 32
                      L450 20
                      L470 20
                      L480 10
                      L490 30
                      L500 20
                      L520 20
                      L530 6
                      L540 34
                      L550 20
                      L600 20
                    "
                  />
                </svg>

              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default SongNotification;