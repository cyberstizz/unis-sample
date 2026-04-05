import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { Heart, Headphones, Vote, ChevronUp, ChevronDown, ListMusic } from 'lucide-react';
import PlaylistWizard from './playlistWizard';
import PlaylistManager from './playlistManager';
import VotingWizard from './votingWizard'; 
import { apiCall } from './components/axiosInstance';
import QueuePanel from './QueuePanel';
import './player.scss';

// ─── Inline SVG icons with guaranteed visibility ───
// These use inline style to prevent ANY external CSS from overriding fill/dimensions.
const PlayIcon = ({ size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{ width: size, height: size, display: 'block', fill: '#FFFFFF', flexShrink: 0 }}
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ size = 24 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{ width: size, height: size, display: 'block', fill: '#FFFFFF', flexShrink: 0 }}
  >
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const PrevIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" style={{ width: 18, height: 18, fill: 'currentColor', display: 'block' }}>
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
  </svg>
);

const NextIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" style={{ width: 18, height: 18, fill: 'currentColor', display: 'block' }}>
    <path d="M16 6h2v12h-2zm-10 0l8.5 6L6 18z"/>
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" style={{ width: 18, height: 18, display: 'block' }} fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const DownloadIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ width: size, height: size, display: 'block' }} fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const VolumeIcon = ({ level }) => {
  if (level === 0) {
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" style={{ width: 16, height: 16, display: 'block' }} fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" style={{ width: 16, height: 16, display: 'block' }} fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      {level > 0.3 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
    </svg>
  );
};


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
  const [specificVoteData, setSpecificVoteData] = useState(null);
  const [volume, setVolume] = useState(0.7);
  const [showQueue, setShowQueue] = useState(false);

  
  // Wizards State
  const [showPlaylistWizard, setShowPlaylistWizard] = useState(false);
  const [showVoteWizard, setShowVoteWizard] = useState(false);
  
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [userId, setUserId] = useState(null);

  const seekbarRef = useRef(null);
  const navigate = useNavigate();

  // --- DERIVE VOTING DATA ---
  const voteNominee = useMemo(() => {
    if (!currentMedia) return null;
    return {
      id: currentMedia.id || currentMedia.songId,
      name: currentMedia.title,
      type: 'song',
      jurisdiction: currentMedia.jurisdiction, 
      genreKey: currentMedia.genreKey || 'rap-hiphop',
      artist: currentMedia.artist
    };
  }, [currentMedia]);

  // 1. Extract User ID
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

  // 2. Fetch Like Status
  useEffect(() => {
    let isMounted = true;
    if (currentMedia?.id && userId) {
      const songId = currentMedia.id || currentMedia.songId;
      
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

  // 4. Audio Listeners
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

  // Set initial volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, audioRef]);

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

  const handleVoteClick = async (e) => {
    e.stopPropagation();
    if (!userId) return alert('Please log in to vote');

    const safeId = currentMedia.id || currentMedia.songId;
    const safeTitle = currentMedia.title || currentMedia.name || "Unknown Song";
    const safeArtist = currentMedia.artist || currentMedia.artistName || "Unknown Artist";

    if (!safeId) {
      console.error("Player Error: Current song has no ID. Cannot fetch voting details.");
      return alert("Cannot vote on this track (Missing ID). Try playing it from a Playlist.");
    }

    setSpecificVoteData(null);

    try {
      const res = await apiCall({ 
        method: 'get', 
        url: `/v1/media/song/${safeId}`,
        useCache: false 
      });
      
      const songData = res.data;

      let jurisdictionName = 'Harlem'; 
      
      if (songData.jurisdiction) {
        if (typeof songData.jurisdiction === 'string') {
          jurisdictionName = songData.jurisdiction;
        } else if (songData.jurisdiction.name) {
          jurisdictionName = songData.jurisdiction.name;
        }
      }

      console.log("Voting Jurisdiction Resolved:", jurisdictionName);

      setSpecificVoteData({
        nominee: {
          id: safeId,
          name: safeTitle,
          type: 'song',
          jurisdiction: jurisdictionName,
          genreKey: songData.genre?.name || 'rap-hiphop',
          artist: safeArtist
        },
        filters: {
          selectedType: 'song',
          selectedGenre: (songData.genre?.name || 'rap-hiphop').toLowerCase().replace('/', '-'),
          selectedInterval: 'daily',
          selectedJurisdiction: jurisdictionName.toLowerCase().replace(/\s+/g, '-')
        }
      });
      
      setShowVoteWizard(true);

    } catch (err) {
      console.error("Vote fetch error:", err);
      setShowVoteWizard(true);
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
    const newTime = (Math.max(0, Math.min(100, percentage)) / 100) * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(percentage);
    if (audioRef.current) {
      audioRef.current.volume = percentage;
    }
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
            <button className="player-btn-play" onClick={handlePlayPause} title={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
            </button>
            <button onClick={handleNext}>⏭</button>
          </div>
          <div className="expanded-actions">
            <button onClick={handleLike} className={`like-button ${isLiked ? 'liked' : ''}`}>
              <Heart fill={isLiked ? "white" : "none"} />
            </button>
            <button onClick={handleVoteClick}>
              <Vote size={24} />
            </button>
            <button onClick={handleDownload}>⬇</button>
          </div>
        </div>
      ) : (
        <>
          {/* ═══════ MOBILE ACTIONS TRAY ═══════ */}
          <div className={`mobile-actions-tray ${showMobileActions ? 'open' : ''}`}>
            <div className="tray-content">
              <button onClick={handleVoteClick} className="tray-action">
                <Vote size={20} />
                <span className="label">Vote</span>
              </button>
              <button onClick={() => setShowPlaylistWizard(true)} className="tray-action"><span>➕</span><span className="label">Add</span></button>
              <button onClick={handleLike} className={`tray-action ${isLiked ? 'liked' : ''}`}>
                <Heart fill={isLiked ? "white" : "none"} /><span className="label">{isLiked ? 'Liked' : 'Like'}</span>
              </button>
              <button onClick={handleDownload} className="tray-action"><span>⬇</span><span className="label">Download</span></button>
            </div>
          </div>

          {/* ═══════ 3-COLUMN MINI PLAYER ═══════ */}
          <div className="Unis-mini-player">

            {/* LEFT — Track info */}
            <div className="player-track">
              <div className="player-art" onClick={handleNavigateToSong}>
                <img src={currentMedia.artwork || '/assets/placeholder.jpg'} alt="Artwork" />
              </div>
              <div className="player-track-info">
                <div className="player-track-title clickable" onClick={handleNavigateToSong}>{currentMedia.title}</div>
                <div className="player-track-artist clickable" onClick={handleNavigateToArtist}>{currentMedia.artist}</div>
              </div>
              <button className="player-heart" onClick={handleLike}>
                <Heart size={18} fill={isLiked ? "currentColor" : "none"} className={isLiked ? 'liked' : ''} />
              </button>
            </div>

            {/* CENTER — Controls + progress */}
            <div className="player-controls">
              <div className="player-buttons">
                <button className="player-btn" onClick={handleVoteClick} title="Vote for this song">
                  <Vote size={18} />
                </button>
                <button className="player-btn" onClick={handlePrev} title="Previous">
                  <PrevIcon />
                </button>

                {/* ─── THE PLAY/PAUSE BUTTON ─── */}
                <button 
                  className="player-btn-play" 
                  onClick={handlePlayPause} 
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
                </button>

                <button className="player-btn" onClick={handleNext} title="Next">
                  <NextIcon />
                </button>
                <button className="player-btn" onClick={() => setShowPlaylistWizard(true)} title="Add to playlist">
                  <PlusIcon />
                </button>
                <button onClick={() => setShowQueue(true)}><ListMusic size={20} /></button>
              </div>
              <div className="player-progress">
                <span className="player-time">{formatTime(currentTime)}</span>
                <div className="progress-bar" ref={seekbarRef} onClick={handleSeekbarClick}>
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="player-time">{formatTime(duration)}</span>
              </div>
            </div>

            {/* RIGHT — Volume + actions */}
            <div className="player-right">
              <button className="player-btn" onClick={handleDownload} title="Download">
                <DownloadIcon />
              </button>
              <button className="player-btn player-volume-icon" title="Volume" onClick={() => setVolume(volume === 0 ? 0.7 : 0)}>
                <VolumeIcon level={volume} />
              </button>
              <div className="volume-bar" onClick={handleVolumeChange}>
                <div className="volume-fill" style={{ width: `${volume * 100}%` }} />
              </div>
            </div>

            {/* MOBILE toggle */}
            <button className="mobile-actions-toggle" onClick={toggleMobileActions}>
              {showMobileActions ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
          </div>
        </>
      )}

      {/* --- WIZARDS --- */}
      <PlaylistWizard open={showPlaylistWizard} onClose={() => setShowPlaylistWizard(false)} selectedTrack={currentMedia} />
      <PlaylistManager open={showPlaylistManager} onClose={closePlaylistManager} />
      <QueuePanel open={showQueue} onClose={() => setShowQueue(false)} />
      <VotingWizard 
        show={showVoteWizard} 
        onClose={() => {
          setShowVoteWizard(false);
          setSpecificVoteData(null);
        }} 
        onVoteSuccess={(id) => setShowVoteWizard(false)}
        nominee={specificVoteData?.nominee || voteNominee}
        userId={userId}
        filters={specificVoteData?.filters || { selectedType: 'song' }} 
      />
    </div>
  );
};

export default Player;