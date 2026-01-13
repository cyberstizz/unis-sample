import React, { useContext, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { Heart, Headphones, ChevronUp, ChevronDown } from 'lucide-react';
import PlaylistWizard from './playlistWizard';
import PlaylistManager from './playlistManager';
import UnisPlayButton from './UnisPlayButton';
import UnisPauseButton from './UnisPauseButton';
import { apiCall } from './components/axiosInstance';
import './player.scss';

const Player = () => {
  const { 
    isExpanded, 
    toggleExpand, 
    currentMedia, 
    next, 
    prev, 
    audioRef, 
    playlists, 
    openPlaylistManager,
    showPlaylistManager,
    closePlaylistManager
  } = useContext(PlayerContext);

  // --- LOCAL STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0); 
  const [duration, setDuration] = useState(0); 
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showPlaylistWizard, setShowPlaylistWizard] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [userId, setUserId] = useState(null);

  const seekbarRef = useRef(null);
  const navigate = useNavigate();

  // 1. Extract User ID from token (Your preferred method)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.userId);
      } catch (err) {
        console.error('Player: Failed to extract userId from token', err);
      }
    }
  }, []);

  // 2. Fetch Like Status when song changes
  useEffect(() => {
    let isMounted = true;
    if (currentMedia?.id && userId) {
      const songId = currentMedia.id || currentMedia.songId;
      
      // We check the backend for the real status
      apiCall({ 
        url: `/v1/media/song/${songId}/is-liked?userId=${userId}`,
        method: 'get'
      })
      .then(res => {
        if (isMounted) setIsLiked(res.data.isLiked || false);
      })
      .catch(() => {
        if (isMounted) setIsLiked(false);
      });
      
      apiCall({ 
        url: `/v1/media/song/${songId}/likes/count`,
        method: 'get'
      })
      .then(res => {
        if (isMounted) setLikeCount(res.data.count || 0);
      })
      .catch(() => {
        if (isMounted) setLikeCount(0);
      });
    }

    return () => { isMounted = false; };
  }, [currentMedia?.id, currentMedia?.songId, userId]);

  // 3. Navigation
  const handleNavigateToSong = (e) => {
    e.stopPropagation();
    const id = currentMedia?.id || currentMedia?.songId;
    if (id) navigate(`/song/${id}`);
  };

  const handleNavigateToArtist = (e) => {
    e.stopPropagation();
    if (currentMedia?.artistId) navigate(`/artist/${currentMedia.artistId}`);
  };

  // 4. Audio Listeners & Source Handling
  useEffect(() => {
    if (currentMedia && audioRef.current) {
      const media = audioRef.current;
      media.currentTime = 0;
      setCurrentTime(0);

      const mediaUrl = currentMedia.url || currentMedia.fileUrl || currentMedia.mediaUrl;
      if (!mediaUrl) return;

      media.src = mediaUrl;
      const handleCanPlay = () => {
        media.play().catch(err => console.error('Play failed:', err));
        setIsPlaying(true);
        media.removeEventListener('canplay', handleCanPlay);
      };
      media.addEventListener('canplay', handleCanPlay);
      media.load();
      return () => media.removeEventListener('canplay', handleCanPlay);
    }
  }, [currentMedia, audioRef]);

  useEffect(() => {
    const media = audioRef.current;
    if (!media) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => setCurrentTime(media.currentTime);
    const handleLoadedMetadata = () => setDuration(media.duration || 0);
    const handleEnded = () => { setIsPlaying(false); next(); };

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

  // 5. Functional Handlers
  const handlePlayPause = (e) => {
    e.stopPropagation();
    const media = audioRef.current;
    if (media.paused) media.play().catch(console.error);
    else media.pause();
  };

  const handlePrev = (e) => { e.stopPropagation(); prev(); };
  const handleNext = (e) => { e.stopPropagation(); next(); };

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!userId) return alert('Please log in to like songs');
    
    const songId = currentMedia.id || currentMedia.songId;
    try {
      const res = await apiCall({
        method: isLiked ? 'delete' : 'post',
        url: `/v1/media/song/${songId}/like?userId=${userId}`
      });
      if (res.data.success) {
        setIsLiked(!isLiked);
        setLikeCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);
      }
    } catch (err) {
      console.error('Like toggle failed:', err);
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    const fileUrl = currentMedia.url || currentMedia.fileUrl || currentMedia.mediaUrl;
    if (!fileUrl) return alert('Download not available');

    const artist = currentMedia.artist || 'Unknown Artist';
    const title = currentMedia.title || 'Untitled';
    const filename = `${artist} - ${title}.mp3`;

    try {
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
    } catch (err) {
      window.open(fileUrl, '_blank');
    }
  };

  const handleSeek = (e) => {
    const newTime = (e.target.value / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleSeekbarClick = (e) => {
    e.stopPropagation();
    const rect = seekbarRef.current.getBoundingClientRect();
    const percentage = ((e.clientX - rect.left) / rect.width) * 100;
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
    <div className={`player ${isExpanded ? 'expanded' : ''}`} style={isExpanded ? { backgroundImage: `url(${currentMedia.artwork || '/assets/placeholder.jpg'})` } : {}}>
      {isVideo ? (
        <video ref={audioRef} className={isExpanded ? "media-element" : "hidden-media"} style={isExpanded ? {} : { display: 'none' }}>
          <source src={currentMedia.url} type="video/mp4" />
        </video>
      ) : (
        <audio ref={audioRef} className="hidden-media" style={{ display: 'none' }}>
          <source src={currentMedia.url} type="audio/mpeg" />
        </audio>
      )}

      {isExpanded ? (
        <div className="expanded-view">
          <button className="minimize-button" onClick={(e) => { e.stopPropagation(); toggleExpand(); }}>Minimize</button>
          <div className="expanded-artwork">
            {!isVideo && <img src={currentMedia.artwork || '/assets/placeholder.jpg'} alt="Artwork" className="expanded-album-art" />}
          </div>
          <div className="info">
            <h2>{currentMedia.title}</h2>
            <p>{currentMedia.artist}</p>
          </div>
          <div className="time-info">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <input type="range" value={progress} onChange={handleSeek} className="expanded-seekbar" min="0" max="100" />
          <div className="controls">
            <button onClick={handlePrev}>⏮</button>
            <button onClick={handlePlayPause} className="play-pause-btn">{isPlaying ? <UnisPauseButton /> : <UnisPlayButton />}</button>
            <button onClick={handleNext}>⏭</button>
          </div>
          <div className="expanded-actions">
            <button onClick={handleLike} className={`like-button ${isLiked ? 'liked' : ''}`}>
              <Heart fill={isLiked ? "white" : "none"} />
            </button>
            <button onClick={handleDownload}>⬇</button>
          </div>
        </div>
      ) : (
        <>
          <div className="seekbar" ref={seekbarRef} onClick={handleSeekbarClick}>
            <div className="seekbar-track">
              <div className="seekbar-progress" style={{ width: `${progress}%` }}></div>
              <div className="seekbar-thumb" style={{ left: `calc(${progress}% - 6px)` }}></div>
            </div>
          </div>
          
          <div className={`mobile-actions-tray ${showMobileActions ? 'open' : ''}`}>
            <div className="tray-content">
              <button onClick={() => setShowPlaylistWizard(true)} className="tray-action"><span>➕</span><span className="label">Add to Playlist</span></button>
              <button onClick={openPlaylistManager} className="tray-action"><Headphones /><span className="label">Playlists</span></button>
              <button onClick={handleLike} className={`tray-action ${isLiked ? 'liked' : ''}`}>
                <Heart fill={isLiked ? "white" : "none"} /><span className="label">{isLiked ? 'Liked' : 'Like'}</span>
              </button>
              <button onClick={handleDownload} className="tray-action"><span>⬇</span><span className="label">Download</span></button>
            </div>
          </div>

          <div className="Unis-mini-player">
            <div className="song-info">
              <img src={currentMedia.artwork || '/assets/placeholder.jpg'} alt="Artwork" className="mini-artwork clickable" onClick={handleNavigateToSong} />
              <div className="mini-info">
                <p className="mini-title clickable" onClick={handleNavigateToSong}>{currentMedia.title}</p>
                <p className="mini-artist clickable" onClick={handleNavigateToArtist}>{currentMedia.artist}</p>
              </div>
            </div>
            
            <div className="mini-controls">
              <button className="trackToggle" onClick={handlePrev}>◀</button>
              <button onClick={handlePlayPause} className="play-pause-btn">{isPlaying ? <UnisPauseButton /> : <UnisPlayButton />}</button>
              <button className="trackToggle" onClick={handleNext}>▶</button>
            </div>
            
            <div className="like-download desktop-actions">
              <button onClick={() => setShowPlaylistWizard(true)}>➕</button>
              <button onClick={handleLike} className={`like-button ${isLiked ? 'liked' : ''}`}>
                <Heart size={18} fill={isLiked ? "white" : "none"} />
              </button>
              <button onClick={handleDownload}>⬇</button>
            </div>

            <button className="mobile-actions-toggle" onClick={toggleMobileActions}>
              {showMobileActions ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
          </div>
        </>
      )}

      <PlaylistWizard open={showPlaylistWizard} onClose={() => setShowPlaylistWizard(false)} selectedTrack={currentMedia} />
      <PlaylistManager open={showPlaylistManager} onClose={closePlaylistManager} />
    </div>
  );
};

export default Player;