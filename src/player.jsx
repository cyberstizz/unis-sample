import React, { useContext, useEffect, useState, useRef } from 'react';
import { PlayerContext } from './context/playercontext';
import './player.scss';

const Player = () => {
  const { isExpanded, toggleExpand, currentMedia, next, prev, audioRef } = useContext(PlayerContext);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const mediaRef = useRef(null);
  const [isLiked, setIsLiked] = useState(false); 

  useEffect(() => {
    if (currentMedia && mediaRef.current) {
      mediaRef.current.src = currentMedia.url;
      mediaRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  }, [currentMedia]);

  useEffect(() => {
    const media = mediaRef.current;
    if (media) {
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleTimeUpdate = () => {
        setCurrentTime(media.currentTime);
        setDuration(media.duration || 0);
      };
      const handleLoadedMetadata = () => setDuration(media.duration || 0);

      media.addEventListener('play', handlePlay);
      media.addEventListener('pause', handlePause);
      media.addEventListener('timeupdate', handleTimeUpdate);
      media.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        media.removeEventListener('play', handlePlay);
        media.removeEventListener('pause', handlePause);
        media.removeEventListener('timeupdate', handleTimeUpdate);
        media.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [mediaRef]);

  if (!currentMedia) return null;

  const isVideo = currentMedia.type === 'video';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handlePlayPause = (e) => {
    e.stopPropagation();
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

  const handleLike = (e) => {
    e.stopPropagation();
    setIsLiked(!isLiked); 
    console.log('Like toggled:', !isLiked);
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    console.log('Download pressed');
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
        <>
          {/* Seekbar at the top */}
          <div className="seekbar">
            <div className="seekbar-track">
              <div className="seekbar-progress" style={{ width: `${progress}%` }}></div>
              <div className="seekbar-thumb" style={{ left: `calc(${progress}% - 6px)` }}></div>
            </div>
          </div>
          <div className="mini-player">
            {/* Left: Song Info (artwork + info) */}
            <div className="song-info">
              <img src={currentMedia.artwork || '/assets/placeholder.jpg'} alt="Artwork" className="mini-artwork" />
              <div className="mini-info">
                <p>{currentMedia.title} - {currentMedia.artist}</p>
              </div>
            </div>
            {/* Middle: Controls */}
            <div className="mini-controls">
              <button onClick={handlePrev}>◀</button>
              <button onClick={handlePlayPause}>{mediaRef.current?.paused ? '▶' : '⏸'}</button>
              <button onClick={handleNext}>▶</button>
            </div>
            {/* Right: Like/Download */}
            <div className="like-download">
              <button onClick={handleLike} className={`like-button ${isLiked ? 'liked' : ''}`}>❤️
                <span className="heart-icon"></span> 
              </button>
              <button onClick={handleDownload}>⬇</button> {/* Download unchanged */}
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
        </>
      )}
    </div>
  );
};

export default Player;