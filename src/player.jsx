import React, { useContext, useEffect, useState, useRef } from 'react';
import { PlayerContext } from './context/playercontext';
import { Heart, Maximize2, Headphones } from 'lucide-react';
import PlaylistWizard from './playlistWizard';
import PlaylistViewer from './playlistViewer';
import PlaylistManager from './playlistManager';
import './player.scss';

const Player = () => {
  // Get audioRef from context instead of creating a new one
  const { 
    isExpanded, 
    toggleExpand, 
    currentMedia, 
    next, 
    prev, 
    audioRef,  // ← Use the context's audioRef
    playlists, 
    addToPlaylist, 
    removeFromPlaylist, 
    reorderPlaylist, 
    loadPlaylist, 
    playMedia 
  } = useContext(PlayerContext);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const [isLiked, setIsLiked] = useState(false);
  const [showPlaylistWizard, setShowPlaylistWizard] = useState(false);
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);
  const [showPlaylistViewer, setShowPlaylistViewer] = useState(false);
  const [viewerTracks, setViewerTracks] = useState([]); 
  const [viewerTitle, setViewerTitle] = useState("Playlist");

  const seekbarRef = useRef(null);

  const openViewerFor = (playlistId) => {
    const pl = playlists?.find(p => p.id === playlistId) || playlists?.[0];
    if (!pl) {
      setViewerTracks([]);
      setViewerTitle("Playlist");
    } else {
      const normalized = (pl.tracks || []).map(t => ({
        id: t.id ?? t.songId ?? Date.now() + Math.random(),
        title: t.title ?? t.name ?? "Untitled",
        artist: (t.artist && (t.artist.username || t.artist.displayName)) || t.artistName || "Unknown Artist",
        artworkUrl: t.artworkUrl || t.artwork || "/assets/placeholder.jpg",
        fileUrl: t.fileUrl || t.url || t.audioUrl || "",
        duration: t.duration ?? t.length ?? 0
      }));
      setViewerTracks(normalized);
      setViewerTitle(pl.name || "Playlist");
    }
    setShowPlaylistViewer(true);
  };

  // Handle media changes (new song selected)
  useEffect(() => {
    if (currentMedia && audioRef.current) {
      const media = audioRef.current;
      
      // Reset time to 0 for new songs
      media.currentTime = 0;
      setCurrentTime(0);

      const mediaUrl = currentMedia.url || currentMedia.fileUrl || currentMedia.mediaUrl;
    
      if (!mediaUrl) {
        console.error('No valid media URL found in currentMedia:', currentMedia);
        return;
      }
    
      console.log('Setting media source:', mediaUrl);
      
      // Set new source
      media.src = mediaUrl;
      
      // Listen for when media is ready to play, then auto-start
      const handleCanPlay = () => {
        media.play().catch((error) => {
          console.error('Auto-play failed:', error);
        });
        setIsPlaying(true);
        media.removeEventListener('canplay', handleCanPlay);
      };
      
      media.addEventListener('canplay', handleCanPlay);
      media.load();
      
      return () => {
        media.removeEventListener('canplay', handleCanPlay);
      };
    }
  }, [currentMedia, audioRef]);

  // Set up audio event listeners
  useEffect(() => {
    const media = audioRef.current;
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
      next();
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
  }, [next, audioRef]);

  if (!currentMedia) return null;

  const isVideo = currentMedia.type === 'video';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handlePlayPause = (e) => {
    e.stopPropagation();
    const media = audioRef.current;
    
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

  const handleExpand = (e) => {
    e.stopPropagation();
    toggleExpand();
  };

  const handleSeek = (e) => {
    const newTime = (e.target.value / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeekbarClick = (e) => {
    e.stopPropagation();
    const seekbar = seekbarRef.current;
    const rect = seekbar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    const newTime = (percentage / 100) * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`player ${isExpanded ? 'expanded' : ''}`}
      style={isExpanded ? { backgroundImage: `url(${currentMedia.artwork || '/assets/placeholder.jpg'})` } : {}}
    >
      {/* Single audio/video element - now using context's audioRef */}
      {isVideo ? (
        <video 
          ref={audioRef}  
          className={isExpanded ? "media-element" : "hidden-media"}
          controls={isExpanded}
          style={isExpanded ? {} : { display: 'none' }}
        >
          <source src={currentMedia.url} type="video/mp4" />
        </video>
      ) : (
        <audio 
          ref={audioRef}  
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
              <Heart />
            </button>
            <button onClick={handleDownload}>⬇</button>
          </div>
        </div>
      ) : (
        <>
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
            
            <div className="mini-controls">
              <button onClick={handlePrev}>◀</button>
              <button onClick={handlePlayPause} className="play-pause-btn">
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button onClick={handleNext}>▶</button>
            </div>
            
            <div className="like-download">
              {/* <button className="expand-button" onClick={handleExpand}>
                <Maximize2 />
              </button> */}
              <button onClick={() => setShowPlaylistWizard(true)}>➕</button>
              <button onClick={() => setShowPlaylistManager(true)}>
                <Headphones />
              </button>
              <button onClick={handleLike} className={`like-button ${isLiked ? 'liked' : ''}`}>
                <Heart />
              </button>
              <button onClick={handleDownload}>⬇</button>
            </div>
          </div>
        </>
      )}

      <PlaylistWizard
        open={showPlaylistWizard}
        onClose={() => setShowPlaylistWizard(false)}
        selectedTrack={currentMedia}
      />

      <PlaylistManager
        open={showPlaylistManager}
        onClose={() => setShowPlaylistManager(false)}
      />
    </div>
  );
};

export default Player;