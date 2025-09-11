// src/components/Player.js
import React, { useContext, useEffect, useState, useRef } from 'react';
import { PlayerContext } from './context/playercontext';
import './Player.scss';

const Player = () => {
  const { isExpanded, toggleExpand, currentMedia, next, prev, audioRef } = useContext(PlayerContext);
  const [isPlaying, setIsPlaying] = useState(false); // Track playback state
  const mediaRef = useRef(null); // Ref for media element (audio/video)

  useEffect(() => {
    if (currentMedia && mediaRef.current) {
      mediaRef.current.src = currentMedia.url;
      mediaRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {}); // Handle autoplay blocks
    }
  }, [currentMedia]);

  useEffect(() => {
    const media = mediaRef.current;
    if (media) {
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      media.addEventListener('play', handlePlay);
      media.addEventListener('pause', handlePause);
      return () => {
        media.removeEventListener('play', handlePlay);
        media.removeEventListener('pause', handlePause);
      };
    }
  }, [mediaRef]);

  if (!currentMedia) return null; // Hide if no media

  const isVideo = currentMedia.type === 'video';

  const handlePlayPause = (e) => {
    e.stopPropagation(); // Prevent expanding
    if (mediaRef.current.paused) {
      mediaRef.current.play().then(() => setIsPlaying(true));
    } else {
      mediaRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    prev();
  };

  const handleNext = (e) => {
    e.stopPropagation();
    next();
  };

  return (
    <div
      className={`player ${isExpanded ? 'expanded' : ''}`}
      onClick={!isExpanded ? toggleExpand : null}
      style={isExpanded ? { backgroundImage: `url(${currentMedia.artwork || '/assets/placeholder.jpg'})` } : {}}
    >
      {isExpanded ? (
        <div className="expanded-view">
          <button className="minimize-button" onClick={(e) => { e.stopPropagation(); toggleExpand(); }}>Minimize</button>
          {isVideo ? (
            <video ref={mediaRef} controls className="media-element">
              <source src={currentMedia.url} type="video/mp4" />
            </video>
          ) : (
            <audio ref={mediaRef} controls className="media-element">
              <source src={currentMedia.url} type="audio/mpeg" />
            </audio>
          )}
          <div className="info">
            <h2>{currentMedia.title}</h2>
            <p>{currentMedia.artist}</p>
          </div>
          <div className="controls">
            <button onClick={handlePrev}>◀</button>
            <button onClick={handlePlayPause}>{mediaRef.current?.paused ? '▶' : '⏸'}</button>
            <button onClick={handleNext}>▶</button>
          </div>
        </div>
      ) : (
        <div className="mini-player">
          <img src={currentMedia.artwork || '/assets/placeholder.jpg'} alt="Artwork" className="mini-artwork" />
          <div className="mini-info">
            <p>{currentMedia.title} - {currentMedia.artist}</p>
          </div>
          <div className="mini-controls">
            <button onClick={handlePrev}>◀</button>
            <button onClick={handlePlayPause}>{mediaRef.current?.paused ? '▶' : '⏸'}</button>
            <button onClick={handleNext}>▶</button>
          </div>
          {isVideo ? (
            <video ref={mediaRef} style={{ display: 'none' }}>
              <source src={currentMedia.url} type="video/mp4" />
            </video>
          ) : (
            <audio ref={mediaRef} style={{ display: 'none' }}>
              <source src={currentMedia.url} type="audio/mpeg" />
            </audio>
          )}
        </div>
      )}
    </div>
  );
};

export default Player;