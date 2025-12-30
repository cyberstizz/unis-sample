import React, { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { Heart, Maximize2, Headphones, ChevronUp, ChevronDown } from 'lucide-react';
import PlaylistWizard from './playlistWizard';
import PlaylistViewer from './playlistViewer';
import PlaylistManager from './playlistManager';
import UnisPlayButton from './UnisPlayButton';
import './player.scss';
import UnisPauseButton from './UnisPauseButton';

const Player = () => {

  const { 
    isExpanded, 
    toggleExpand, 
    currentMedia, 
    next, 
    prev, 
    audioRef, 
    playlists, 
    addToPlaylist, 
    removeFromPlaylist, 
    reorderPlaylist, 
    loadPlaylist, 
    playMedia,
    showPlaylistManager,
    closePlaylistManager,
    openPlaylistManager
  } = useContext(PlayerContext);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const [isLiked, setIsLiked] = useState(false);
  const [showPlaylistWizard, setShowPlaylistWizard] = useState(false);
  const [showPlaylistViewer, setShowPlaylistViewer] = useState(false);
  const [viewerTracks, setViewerTracks] = useState([]); 
  const [viewerTitle, setViewerTitle] = useState("Playlist");
  const [showMobileActions, setShowMobileActions] = useState(false);

  const seekbarRef = useRef(null);
  const navigate = useNavigate();

  const handleNavigateToSong = (e) => {
    e.stopPropagation();
    if (currentMedia?.id || currentMedia?.songId) {
      const songId = currentMedia.id || currentMedia.songId;
      navigate(`/song/${songId}`);
    }
  };

  const handleNavigateToArtist = (e) => {
    e.stopPropagation();
    if (currentMedia?.artistId) {
      navigate(`/artist/${currentMedia.artistId}`);
    }
  };

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

  const handleDownload = async (e) => {
    e.stopPropagation();
    
    if (!currentMedia) {
      alert('No media to download');
      return;
    }

    // Get the file URL from current media
    const fileUrl = currentMedia.url || currentMedia.fileUrl || currentMedia.mediaUrl;
    
    if (!fileUrl) {
      alert('Download not available for this track');
      return;
    }

    // Create a clean filename: "Artist - Title.mp3"
    const artist = currentMedia.artist || currentMedia.artistName || 'Unknown Artist';
    const title = currentMedia.title || 'Untitled';
    const extension = fileUrl.split('.').pop().split('?')[0] || 'mp3';
    const filename = `${artist} - ${title}.${extension}`;

    // Show downloading feedback
    const button = e.currentTarget;
    const originalContent = button.innerHTML;
    button.innerHTML = '⏬';
    button.disabled = true;

    try {
      // Try fetch first (works for CORS-enabled files)
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      
      // Success feedback
      button.innerHTML = '✅';
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('Fetch download failed, trying direct link:', error);
      
      // Fallback: Direct download link
      try {
        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = filename;
        link.target = '_blank';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        button.innerHTML = '✅';
        setTimeout(() => {
          button.innerHTML = originalContent;
          button.disabled = false;
        }, 2000);
      } catch (fallbackError) {
        console.error('Download failed:', fallbackError);
        alert('Download failed. The file may not be accessible.');
        button.innerHTML = originalContent;
        button.disabled = false;
      }
    }
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

  const toggleMobileActions = (e) => {
    e.stopPropagation();
    setShowMobileActions(!showMobileActions);
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
              {isPlaying ? <UnisPauseButton /> : <UnisPlayButton />}
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
          
          {/* Mobile Actions Tray */}
          <div className={`mobile-actions-tray ${showMobileActions ? 'open' : ''}`}>
            <div className="tray-content">
              <button onClick={() => setShowPlaylistWizard(true)} className="tray-action">
                <span className="icon">➕</span>
                <span className="label">Add to Playlist</span>
              </button>
              <button onClick={openPlaylistManager} className="tray-action">
                <Headphones />
                <span className="label">Playlists</span>
              </button>
              <button onClick={handleLike} className={`tray-action ${isLiked ? 'liked' : ''}`}>
                <Heart />
                <span className="label">{isLiked ? 'Liked' : 'Like'}</span>
              </button>
              <button onClick={handleDownload} className="tray-action">
                <span className="icon">⬇</span>
                <span className="label">Download</span>
              </button>
            </div>
          </div>

          <div className="mini-player">
            <div className="song-info">
              <img 
                src={currentMedia.artwork || '/assets/placeholder.jpg'} 
                alt="Artwork" 
                className="mini-artwork clickable" 
                onClick={handleNavigateToSong}
              />
              <div className="mini-info">
                <p className="mini-title clickable" onClick={handleNavigateToSong}>
                  {currentMedia.title}
                </p>
                <p className="mini-artist clickable" onClick={handleNavigateToArtist}>
                  {currentMedia.artist}
                </p>
              </div>
            </div>
            
            <div className="mini-controls">
              <button className="trackToggle" onClick={handlePrev}>◀</button>
              <button onClick={handlePlayPause} className="play-pause-btn">
                {isPlaying ? <UnisPauseButton /> : <UnisPlayButton />}
              </button>
              <button className="trackToggle" onClick={handleNext}>▶</button>
            </div>
            
            {/* Desktop Actions */}
            <div className="like-download desktop-actions">
              <button onClick={() => setShowPlaylistWizard(true)}>➕</button>
              <button onClick={openPlaylistManager}>
                <Headphones />
              </button>
              <button onClick={handleLike} className={`like-button ${isLiked ? 'liked' : ''}`}>
                <Heart />
              </button>
              <button onClick={handleDownload}>⬇</button>
            </div>

            {/* Mobile Toggle Button */}
            <button className="mobile-actions-toggle" onClick={toggleMobileActions}>
              {showMobileActions ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
          </div>
        </>
      )}

      <PlaylistWizard
        open={showPlaylistWizard}
        onClose={() => setShowPlaylistWizard(false)}
        selectedTrack={currentMedia}
      />

      {/* 🎯 CRITICAL FIX: Changed from setShowPlaylistViewer to closePlaylistManager */}
      <PlaylistManager
        open={showPlaylistManager}
        onClose={closePlaylistManager}
      />
    </div>
  );
};

export default Player;