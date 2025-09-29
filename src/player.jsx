import React, { useContext, useEffect, useState, useRef } from 'react';
import { PlayerContext } from './context/playercontext';
import './player.scss';

const Player = () => {
  const { isExpanded, toggleExpand, currentMedia, next, prev } = useContext(PlayerContext);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const [isLiked, setIsLiked] = useState(false);
  
  // Single audio ref that persists across mode changes
  const mediaRef = useRef(null);
  const seekbarRef = useRef(null);

  // Handle media changes (new song selected)
  useEffect(() => {
    if (currentMedia && mediaRef.current) {
      const media = mediaRef.current;
      
      // Reset time to 0 for new songs (this fixes the resume issue)
      media.currentTime = 0;
      setCurrentTime(0);
      
      // Set new source
      media.src = currentMedia.url;
      media.load();
      
      // Auto-play if there was a previous song playing
      if (isPlaying) {
        media.play().catch(console.error);
      }
    }
  }, [currentMedia]);

  // Set up audio event listeners
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      setCurrentTime(media.currentTime);
    };
    const handleLoadedMetadata = () => {
      setDuration(media.duration || 0);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      next(); // Auto-play next song
    };

    media.addEventListener('play', handlePlay);
    media.addEventListener('pause', handlePause);
    media.addEventListener('timeupdate', handleTimeUpdate);
    media.addEventListener('loadedmetadata', handleLoadedMetadata);
    media.addEventListener('ended', handleEnded);

    return () => {
      media.removeEventListener('play', handlePlay);
      media.removeEventListener('pause', handlePause);
      media.removeEventListener('timeupdate', handleTimeUpdate);
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
      media.removeEventListener('ended', handleEnded);
    };
  }, [next]);

  if (!currentMedia) return null;

  const isVideo = currentMedia.type === 'video';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handlePlayPause = (e) => {
    e.stopPropagation();
    const media = mediaRef.current;
    
    if (media.paused) {
      media.play().catch(console.error);
    } else {
      media.pause();
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
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    console.log('Download pressed');
  };

  // Handle seeking from range input (expanded mode)
  const handleSeek = (e) => {
    const newTime = (e.target.value / 100) * duration;
    mediaRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle seeking from mini-player seekbar click
  const handleSeekbarClick = (e) => {
    e.stopPropagation();
    const seekbar = seekbarRef.current;
    const rect = seekbar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    const newTime = (percentage / 100) * duration;
    
    mediaRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Format time for display
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`player ${isExpanded ? 'expanded' : ''}`}
      onClick={!isExpanded ? toggleExpand : null}
      style={isExpanded ? { backgroundImage: `url(${currentMedia.artwork || '/assets/placeholder.jpg'})` } : {}}
    >
      {/* Single audio/video element that persists across mode changes */}
      {isVideo ? (
        <video 
          ref={mediaRef} 
          className={isExpanded ? "media-element" : "hidden-media"}
          controls={isExpanded}
          style={isExpanded ? {} : { display: 'none' }}
        >
          <source src={currentMedia.url} type="video/mp4" />
        </video>
      ) : (
        <audio 
          ref={mediaRef} 
          className="hidden-media"
          style={{ display: 'none' }}
        >
          <source src={currentMedia.url} type="audio/mpeg" />
        </audio>
      )}

      {isExpanded ? (
        <div className="expanded-view">
          <button className="minimize-button" onClick={(e) => { 
            e.stopPropagation(); 
            toggleExpand(); 
          }}>
            Minimize
          </button>
          
          <div className="expanded-artwork">
            {!isVideo && (
              <img 
                src={currentMedia.artwork || '/assets/placeholder.jpg'} 
                alt="Album artwork" 
                className="expanded-album-art"
              />
            )}
          </div>
          
          <div className="info">
            <h2>{currentMedia.title}</h2>
            <p>{currentMedia.artist}</p>
          </div>

          <div className="time-info">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Seek bar in expanded */}
          <input
            type="range"
            value={progress}
            onChange={handleSeek}
            className="expanded-seekbar"
            min="0"
            max="100"
          />

          <div className="controls">
            <button onClick={handlePrev}>⏮</button>
            <button onClick={handlePlayPause} className="play-pause-btn">
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button onClick={handleNext}>⏭</button>
          </div>

          <div className="expanded-actions">
            <button onClick={handleLike} className={`like-button ${isLiked ? 'liked' : ''}`}>
              ❤️
            </button>
            <button onClick={handleDownload}>⬇</button>
          </div>
        </div>
      ) : (
        <>
          {/* Interactive Seekbar at the top */}
          <div 
            className="seekbar" 
            ref={seekbarRef}
            onClick={handleSeekbarClick}
          >
            <div className="seekbar-track">
              <div 
                className="seekbar-progress" 
                style={{ width: `${progress}%` }}
              ></div>
              <div 
                className="seekbar-thumb" 
                style={{ left: `calc(${progress}% - 6px)` }}
              ></div>
            </div>
          </div>
          
          <div className="mini-player">
            {/* Left: Song Info */}
            <div className="song-info">
              <img 
                src={currentMedia.artwork || '/assets/placeholder.jpg'} 
                alt="Artwork" 
                className="mini-artwork" 
              />
              <div className="mini-info">
                <p className="mini-title">{currentMedia.title}</p>
                <p className="mini-artist">{currentMedia.artist}</p>
              </div>
            </div>
            
            {/* Middle: Controls */}
            <div className="mini-controls">
              <button onClick={handlePrev}>⏮</button>
              <button onClick={handlePlayPause} className="play-pause-btn">
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button onClick={handleNext}>⏭</button>
            </div>
            
            {/* Right: Like/Download */}
            <div className="like-download">
              <button onClick={handleLike} className={`like-button ${isLiked ? 'liked' : ''}`}>
                ❤️
              </button>
              <button onClick={handleDownload}>⬇</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Player;