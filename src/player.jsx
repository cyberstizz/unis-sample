import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import AuthGateSheet, { useAuthGate, incrementGateSongCount } from './AuthGateSheet';
import { Heart, Headphones, Vote, ChevronUp, ChevronDown, ListMusic, Lock } from 'lucide-react';
import PlaylistWizard from './playlistWizard';
import PlaylistManager from './playlistManager';
import VotingWizard from './votingWizard';
import { apiCall } from './components/axiosInstance';
import { useReward } from './context/RewardContext';
import QueuePanel from './QueuePanel';
import DownloadModal from './DownloadModal';
import PocketLockOverlay from './PocketLockOverlay';
import './player.scss';

// ─── Inline SVG icons ───
const PlayIcon = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    style={{ width: size, height: size, display: 'block', fill: '#FFFFFF', flexShrink: 0 }}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ size = 24 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    style={{ width: size, height: size, display: 'block', fill: '#FFFFFF', flexShrink: 0 }}>
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
    closePlaylistManager,
    queue,
  } = useContext(PlayerContext);

  const { isGuest } = useAuth();
  const { triggerGate, gateProps } = useAuthGate();
  const { showReward } = useReward();

  // --- LOCAL STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [specificVoteData, setSpecificVoteData] = useState(null);
  const [volume, setVolume] = useState(0.7);
  const [showQueue, setShowQueue] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Wizards State
  const [showPlaylistWizard, setShowPlaylistWizard] = useState(false);
  const [showVoteWizard, setShowVoteWizard] = useState(false);

  const [showMobileActions, setShowMobileActions] = useState(false);
  const [userId, setUserId] = useState(null);

  // Pocket Lock — visual scaffold only for step 1.
  // Full overlay + intro modal comes next.
  const [pocketLockEnabled, setPocketLockEnabled] = useState(false);
  const [showPocketLockIntro, setShowPocketLockIntro] = useState(false);

  const seekbarRef = useRef(null);
  const mobileTrayRef = useRef(null);
  const mobileActionsToggleRef = useRef(null);
  const playRewardedRef = useRef(false);
  const activeRewardSongIdRef = useRef(null);

  // ★ PLAY-FLOW (change 1 of 3): refs to carry the play row id + last listened %
  // currentPlayIdRef holds the play_id returned by the backend when a play is
  // counted, so we can later tell the backend that play completed.
  // lastPercentRef tracks how far through the song the listener got.
  const currentPlayIdRef = useRef(null);
  const lastPercentRef = useRef(0);

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
      artist: currentMedia.artist,
      artwork: currentMedia.artwork,
      artworkUrl: currentMedia.artworkUrl,
      imageUrl: currentMedia.imageUrl,
    };
  }, [currentMedia]);


  // ★ PLAY-FLOW (change 3 of 3): tell the backend the current play finished.
  // Safe to call any time: if no play was counted (e.g. the listener skipped
  // before the 15s/25% threshold), currentPlayIdRef is null and this no-ops.
  // Sending is guarded so the same play can't be completed twice.
  const completeCurrentPlay = () => {
    const playId = currentPlayIdRef.current;
    if (!playId) return;
    currentPlayIdRef.current = null; // guard against double-send
    apiCall({
      method: 'post',
      url: '/v1/media/play/complete',
      data: {
        playId,
        percentPlayed: Math.round(lastPercentRef.current * 100) / 100,
      },
    }).catch((err) => console.error('Play completion failed:', err));
  };


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

  // Track guest song count for AuthGateSheet nudge
  useEffect(() => {
    if (isGuest && currentMedia) {
      incrementGateSongCount();
    }
  }, [currentMedia?.id, isGuest]);

  // 2. Fetch Like Status — skip for guests
  useEffect(() => {
    let isMounted = true;
    if (currentMedia?.id && userId) {
      const songId = currentMedia.id || currentMedia.songId;

      apiCall({
        url: `/v1/media/song/${songId}/is-liked?userId=${userId}`,
        method: 'get'
      })
      .then(res => { if (isMounted) setIsLiked(res.data.isLiked || false); })
      .catch(() => { if (isMounted) setIsLiked(false); });

      apiCall({
        url: `/v1/media/song/${songId}/likes/count`,
        method: 'get'
      })
      .then(res => { if (isMounted) setLikeCount(res.data.count || 0); })
      .catch(() => { if (isMounted) setLikeCount(0); });
    }

    return () => { isMounted = false; };
  }, [currentMedia?.id, currentMedia?.songId, userId]);

  // Reward + track a real song play only after meaningful listening.
  // This effect resets the per-song tracking flags whenever the song changes.
  // ★ PLAY-FLOW: it now also finalizes the OUTGOING song's play before resetting,
  // so skipping to the next track still records how far the listener got.
  useEffect(() => {
    const songId = currentMedia?.id || currentMedia?.songId;

    if (!songId || activeRewardSongIdRef.current === songId) return;

    completeCurrentPlay(); // ★ PLAY-FLOW: finalize the previous track first

    activeRewardSongIdRef.current = songId;
    playRewardedRef.current = false;
  }, [currentMedia?.id, currentMedia?.songId]);

  useEffect(() => {
    if (!currentMedia || isGuest || !userId) return;

    const mediaIsVideo = currentMedia.type === 'video';
    if (mediaIsVideo) return;

    const songId = currentMedia.id || currentMedia.songId;
    if (!songId || playRewardedRef.current) return;

    const reachedMinimumTime = currentTime >= 15;
    const reachedMeaningfulPercent =
      duration > 0 && currentTime >= Math.min(duration * 0.25, 30);

    if (!reachedMinimumTime && !reachedMeaningfulPercent) return;

    playRewardedRef.current = true;

    const trackRealPlay = async () => {
      try {
        // ★ PLAY-FLOW (change 2 of 3): send `source` and capture the returned
        // playId. Everything else here (the 15s/25% gate above, the reward
        // below, guest handling) is unchanged.
        const res = await apiCall({
          method: 'post',
          url: `/v1/media/song/${songId}/play?userId=${userId}&source=${encodeURIComponent(currentMedia.source || 'player')}`,
        });

        currentPlayIdRef.current = res?.data?.playId || null; // ★ PLAY-FLOW

        showReward({
          points: 1,
          label: 'Play counted',
          type: 'play',
          anchor: 'player',
        });
      } catch (err) {
        console.error('Failed to track rewarded play:', err);

        // Allow retry if the backend failed.
        playRewardedRef.current = false;
      }
    };

    trackRealPlay();
  }, [
    currentMedia,
    currentTime,
    duration,
    isGuest,
    userId,
    showReward,
  ]);


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

  // 4. Audio Listeners — load + play when the track changes
  useEffect(() => {
    if (currentMedia && audioRef.current) {
      const media = audioRef.current;
      media.currentTime = 0;
      setCurrentTime(0);
      lastPercentRef.current = 0; // ★ PLAY-FLOW: reset progress for the new track

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

  // 4b. Audio Listeners — play/pause/time/end events
  useEffect(() => {
    const media = audioRef.current;
    if (!media) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleTimeUpdate = () => {
      setCurrentTime(media.currentTime);
      // ★ PLAY-FLOW: keep the last listened % up to date for completion tracking
      if (media.duration && isFinite(media.duration)) {
        lastPercentRef.current = (media.currentTime / media.duration) * 100;
      }
    };

    const handleLoadedMetadata = () => setDuration(media.duration || 0);

    const handleEnded = () => {
      setIsPlaying(false);
      lastPercentRef.current = 100;   // ★ PLAY-FLOW: finished = 100%
      completeCurrentPlay();          // ★ PLAY-FLOW: record completion
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

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, audioRef]);

  const isVideo = currentMedia?.type === 'video';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 5. Functional Handlers
  const handlePlayPause = (e) => {
    e.stopPropagation();
    const media = audioRef.current;
    if (!media) return;
    if (media.paused) media.play().catch(console.error);
    else media.pause();
  };

  const handlePrev = (e) => { e.stopPropagation(); prev(); };
  const handleNext = (e) => { e.stopPropagation(); next(); };

  const handleLike = async (e) => {
    e.stopPropagation();

    if (isGuest) {
      triggerGate('generic');
      return;
    }

    const songId = currentMedia.id || currentMedia.songId;
    if (!songId || !userId) return;

    const wasLiked = isLiked;

    try {
      const res = await apiCall({
        method: wasLiked ? 'delete' : 'post',
        url: `/v1/media/song/${songId}/like?userId=${userId}`,
      });

      if (res.data.success) {
        const nextLiked = !wasLiked;

        setIsLiked(nextLiked);
        setLikeCount((prev) => (wasLiked ? Math.max(0, prev - 1) : prev + 1));

        // Only reward adding a like, not removing one.
        if (nextLiked) {
          showReward({
            points: 2,
            label: 'Like counted',
            type: 'like',
            anchor: 'player',
          });
        }
      }
    } catch (err) {
      console.error('Like toggle failed:', err);
    }
  };


  const handleVoteClick = async (e) => {
    e.stopPropagation();
    if (isGuest) { triggerGate('vote'); return; }

    const safeId = currentMedia.id || currentMedia.songId;
    const safeTitle = currentMedia.title || currentMedia.name || "Unknown Song";
    const safeArtist = currentMedia.artist || currentMedia.artistName || "Unknown Artist";

    if (!safeId) {
      console.error("Player Error: Current song has no ID.");
      return alert("Cannot vote on this track (Missing ID).");
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

      setSpecificVoteData({
        nominee: {
          id: safeId,
          name: safeTitle,
          type: 'song',
          jurisdiction: jurisdictionName,
          genreKey: songData.genre?.name || 'rap-hiphop',
          artist: safeArtist,
          artwork: currentMedia.artwork,
          artworkUrl: songData.artworkUrl || currentMedia.artworkUrl,
          imageUrl: songData.imageUrl || currentMedia.imageUrl,
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

  const handleAddToPlaylist = (e) => {
    if (e) e.stopPropagation();
    if (isGuest) { triggerGate('generic'); return; }
    setShowPlaylistWizard(true);
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    if (isGuest) { triggerGate('generic'); return; }
    setShowDownloadModal(true);
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

  useEffect(() => {
    if (!showMobileActions) return;

    const handleOutsidePointerDown = (event) => {
      const target = event.target;

      if (mobileTrayRef.current?.contains(target)) return;
      if (mobileActionsToggleRef.current?.contains(target)) return;

      setShowMobileActions(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
    };
  }, [showMobileActions]);

  const handlePocketLockToggle = (e) => {
    e.stopPropagation();

    const introSeen = localStorage.getItem('unis-pocket-lock-intro-seen') === 'true';

    // If lock is already on, tapping the tile turns it off immediately.
    if (pocketLockEnabled) {
      setPocketLockEnabled(false);
      return;
    }

    // First-time experience: show the premium intro before enabling.
    if (!introSeen) {
      setShowPocketLockIntro(true);
      return;
    }

    setPocketLockEnabled(true);
  };

  const handleUsePocketLock = (e) => {
    e.stopPropagation();
    localStorage.setItem('unis-pocket-lock-intro-seen', 'true');
    setShowPocketLockIntro(false);
    setPocketLockEnabled(true);
  };

  const handlePocketLockUnlock = () => {
    setPocketLockEnabled(false);
  };

  const handleCreatePatternLater = (e) => {
    e.stopPropagation();

    // For this step, we acknowledge the choice but still use the simple lock.
    // The actual pattern setup screen comes after the overlay is working.
    localStorage.setItem('unis-pocket-lock-intro-seen', 'true');
    setShowPocketLockIntro(false);
    setPocketLockEnabled(true);
  };

  const handleDismissPocketLockIntro = (e) => {
    e.stopPropagation();
    setShowPocketLockIntro(false);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Shared modal block — rendered in BOTH branches below
  const modalsAndPanels = (
    <>
      {pocketLockEnabled && currentMedia && (
        <PocketLockOverlay
          currentMedia={currentMedia}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          onUnlock={handlePocketLockUnlock}
          formatTime={formatTime}
        />
      )}
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
      <DownloadModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        song={currentMedia ? {
          id: currentMedia.id || currentMedia.songId,
          title: currentMedia.title || 'Untitled',
          artist: currentMedia.artist || 'Unknown Artist',
          artworkUrl: currentMedia.artwork,
          downloadUrl: currentMedia.url || currentMedia.fileUrl || currentMedia.mediaUrl,
          downloadPolicy: currentMedia.downloadPolicy || 'free',
          downloadPrice: currentMedia.downloadPrice || null,
          fileName: `${currentMedia.artist || 'Artist'} - ${currentMedia.title || 'Track'}.mp3`,
        } : {}}
      />
      {showPocketLockIntro && (
    <div className="pocket-lock-intro-backdrop" onClick={handleDismissPocketLockIntro}>
      <div
        className="pocket-lock-intro-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pocket-lock-intro-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pocket-lock-intro-orb">
          <Lock size={26} />
        </div>

        <div className="pocket-lock-intro-copy">
          <span className="pocket-lock-intro-kicker">Pocket protection</span>

          <h2 id="pocket-lock-intro-title">
            Lock your screen while Unis keeps playing.
          </h2>

          <p>
            Pocket Lock helps prevent accidental taps when your phone is in your pocket.
            Your music keeps playing, but the app stays protected until you unlock it.
          </p>
        </div>

        <div className="pocket-lock-intro-preview" aria-hidden="true">
          <div className="pocket-lock-preview-phone">
            <div className="pocket-lock-preview-art">
              {currentMedia?.artwork && (
                <img src={currentMedia.artwork} alt="" />
              )}
            </div>
            <div className="pocket-lock-preview-lines">
              <span />
              <span />
            </div>
            <div className="pocket-lock-preview-pill" />
          </div>
        </div>

        <div className="pocket-lock-intro-actions">
          <button
            type="button"
            className="pocket-lock-intro-primary"
            onClick={handleUsePocketLock}
          >
            Use Pocket Lock
          </button>

          <button
            type="button"
            className="pocket-lock-intro-secondary"
            onClick={handleCreatePatternLater}
          >
            Create Pattern
          </button>

          <button
            type="button"
            className="pocket-lock-intro-ghost"
            onClick={handleDismissPocketLockIntro}
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  )}
      <AuthGateSheet {...gateProps} />
    </>
  );

  // No song playing yet → render ONLY the modals (so sidebar/etc. can open them)
  if (!currentMedia) {
    return modalsAndPanels;
  }

  // Song is playing → render the full player + modals
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
        <div
          ref={mobileTrayRef}
          className={`mobile-actions-tray ${showMobileActions ? 'open' : ''}`}
        >
        <div className="tray-shell">
          <div className="tray-handle" aria-hidden="true" />

          <div className="tray-header">
            <div>
              <span className="tray-kicker">Now playing tools</span>
              <strong>Control the moment</strong>
            </div>

            <span className="tray-status-pill">
              {queue.length > 0 ? `${queue.length} in queue` : 'Live session'}
            </span>
          </div>

          <div className="tray-content">
            <button type="button" onClick={handleVoteClick} className="tray-action tray-action-featured">
              <span className="tray-icon">
                <Vote size={20} />
              </span>
              <span className="tray-copy">
                <span className="label">Vote</span>
                <span className="hint">Influence</span>
              </span>
            </button>

            <button type="button" onClick={handleAddToPlaylist} className="tray-action">
              <span className="tray-icon">
                <PlusIcon />
              </span>
              <span className="tray-copy">
                <span className="label">Add</span>
                <span className="hint">Playlist</span>
              </span>
            </button>

            <button
              type="button"
              onClick={handleLike}
              className={`tray-action ${isLiked ? 'liked' : ''}`}
            >
              <span className="tray-icon">
                <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
              </span>
              <span className="tray-copy">
                <span className="label">{isLiked ? 'Liked' : 'Like'}</span>
                <span className="hint">{likeCount > 0 ? `${likeCount} total` : 'Support'}</span>
              </span>
            </button>

            <button type="button" onClick={handleDownload} className="tray-action">
              <span className="tray-icon">
                <DownloadIcon size={18} />
              </span>
              <span className="tray-copy">
                <span className="label">Download</span>
                <span className="hint">Offline</span>
              </span>
            </button>

            <button
              type="button"
              onClick={handlePocketLockToggle}
              className={`tray-action tray-action-lock ${pocketLockEnabled ? 'locked' : ''}`}
              aria-pressed={pocketLockEnabled}
              title={pocketLockEnabled ? 'Pocket Lock on' : 'Pocket Lock off'}
            >
              <span className="tray-icon">
                <Lock size={19} />
              </span>

              <span className="tray-copy">
                <span className="label">Lock</span>
                <span className="hint">{pocketLockEnabled ? 'Protected' : 'Pocket'}</span>
              </span>
            </button>
          </div>
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
                <button className="player-btn" onClick={handleAddToPlaylist} title="Add to playlist or queue">
                  <PlusIcon />
                </button>
              </div>
              <div className="player-progress">
                <span className="player-time">{formatTime(currentTime)}</span>
                <div className="progress-bar" ref={seekbarRef} onClick={handleSeekbarClick}>
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="player-time">{formatTime(duration)}</span>
              </div>
            </div>

            {/* RIGHT — Queue + Download + Volume */}
            <div className="player-right">
              <button
                className={`player-btn player-queue-btn ${showQueue ? 'active' : ''}`}
                onClick={() => setShowQueue(!showQueue)}
                title={`Queue${queue.length > 0 ? ` (${queue.length})` : ''}`}
              >
                <ListMusic size={16} />
                {queue.length > 0 && (
                  <span className="player-queue-badge">{queue.length}</span>
                )}
              </button>
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
            <div className="mobile-right-cluster">
              <button className="mobile-actions-toggle" ref={mobileActionsToggleRef} onClick={toggleMobileActions}>
                {showMobileActions ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </button>
              <button
                className={`mobile-queue-btn ${showQueue ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setShowQueue(!showQueue); }}
                title={`Queue${queue.length > 0 ? ` (${queue.length})` : ''}`}
              >
                <ListMusic size={18} />
                {queue.length > 0 && (
                  <span className="mobile-queue-badge">{queue.length}</span>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* --- WIZARDS & PANELS --- */}
      {modalsAndPanels}
    </div>
  );
};

export default Player;