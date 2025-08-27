// src/components/Player.js
import React, { useContext, useEffect } from 'react';
import { PlayerContext } from '../context/PlayerContext';
import './Player.scss';

const Player = () => {
  const { isExpanded, toggleExpand, currentMedia, next, prev, audioRef } = useContext(PlayerContext);

  useEffect(() => {
    if (currentMedia && audioRef.current) {
      audioRef.current.src = currentMedia.url;
      audioRef.current.play();
    }
  }, [currentMedia]);

  if (!currentMedia) return null; // Hide if no media

  const isVideo = currentMedia.type === 'video';

  return (
    <div className={`player ${isExpanded ? 'expanded' : ''}`} onClick={!isExpanded ? toggleExpand : null}>
      {isExpanded ? (
        <div className="expanded-view" style={{ backgroundImage: `url(${currentMedia.artwork})` }}>
          <button className="minimize-button" onClick={toggleExpand}>Minimize</button>
          {isVideo ? (
            <video ref={audioRef} controls className="media-element">
              <source src={currentMedia.url} type="video/mp4" />
            </video>
          ) : (
            <audio ref={audioRef} controls className="media-element">
              <source src={currentMedia.url} type="audio/mpeg" />
            </audio>
          )}
          <div className="info">
            <h2>{currentMedia.title}</h2>
            <p>{currentMedia.artist}</p>
          </div>
          <div className="controls">
            <button onClick={prev}>◀</button>
            <button onClick={() => audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause()}>⏯</button>
            <button onClick={next}>▶</button>
          </div>
        </div>
      ) : (
        <div className="mini-player">
          <img src={currentMedia.artwork} alt="Artwork" className="mini-artwork" />
          <div className="mini-info">
            <p>{currentMedia.title} - {currentMedia.artist}</p>
          </div>
          <div className="mini-controls">
            <button onClick={prev}>◀</button>
            <button onClick={() => audioRef.current.paused ? audioRef.current.play() : audioRef.current.pause()}>⏯</button>
            <button onClick={next}>▶</button>
          </div>
          {/* For video in mini: Audio plays, video hidden */}
          {isVideo ? (
            <video ref={audioRef} style={{ display: 'none' }}>
              <source src={currentMedia.url} type="video/mp4" />
            </video>
          ) : (
            <audio ref={audioRef} style={{ display: 'none' }}>
              <source src={currentMedia.url} type="audio/mpeg" />
            </audio>
          )}
        </div>
      )}
    </div>
  );
};

export default Player;