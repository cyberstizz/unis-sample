import React, { useCallback, useContext, useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import AuthGateSheet, { useAuthGate, incrementGateSongCount } from './AuthGateSheet';
import {
  Heart, Vote, ChevronUp, ChevronDown, ListMusic, Lock, MessageCircle, X, Mic2,
  MoreHorizontal, Maximize2, Disc3, UserRound,
} from 'lucide-react';
import PlaylistWizard from './playlistWizard';
import PlaylistManager from './playlistManager';
import VotingWizard from './votingWizard';
import CommentSection from './commentSection'; // ★ comments: reuse the songPage comment section
import { apiCall } from './components/axiosInstance';
import { getVisitorId } from './utils/visitorId';
import { useReward } from './context/RewardContext';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import QueuePanel from './QueuePanel';
import DownloadModal from './DownloadModal';
import PocketLockOverlay from './PocketLockOverlay';
import LyricsView from './components/LyricsView'; // timed lyrics view (mic button)
import useArtworkPalette from './hooks/useArtworkPalette';
import useScrollMotion from './hooks/useScrollMotion';
import './player.scss';

// ─────────────────────────────────────────────────────────────
// Player
//
// Three surfaces share one set of handlers:
//
//   • Phones and tablets (≤1024px): a floating mini player. At rest it is a
//     card tinted with the artwork's colours, with a thin progress strip on
//     its bottom edge. While the page scrolls it turns to glass and tucks in,
//     and settles back 0.7s after scrolling stops. On pages with a big
//     artwork hero (song, artist, jurisdiction, playlist) it stays glass.
//     The arrow opens the song actions tray (Vote, Like, Add, Download,
//     Lyrics, Comments, Pocket Lock), dressed in the same artwork blend.
//   • Computers (≥1025px): the same card as a floating dock beside the
//     sidebar. Its strip thickens into a scrubber on hover.
//   • Now Playing: the full-screen player, opened by tapping the mini player,
//     the dock's artwork or expand button, or anything that calls the
//     context's toggleExpand (Messages does). Its tray switches between the
//     main view, lyrics and the queue, and More holds the rest.
//
// Colour rule: the artwork paints the surfaces, white runs the transport,
// the listener's theme colour marks Unis actions (Vote, active tray items).
//
// Play counting, likes, votes, downloads, Pocket Lock, comments and the
// queue behave exactly as before — only how you reach them changed.
// ─────────────────────────────────────────────────────────────

// ─── Inline SVG icons ───
// Transport glyphs (previous / play-pause / next). Drawn on one 24 grid with
// rounded corners to match the Unis icon set and the wordmark. The play
// triangle sits a hair right of centre, because a triangle's visual weight
// is on its flat side and a mathematically centred one looks off.
// Colours come from player.scss, not from here.

// Play and pause are stacked, and the button crossfades between them
// (player.scss → .pp-glyph), so the change feels like one morph.
const PlayPauseGlyph = ({ playing, dark = false }) => (
  <span className={`pp-glyph ${dark ? 'pp-glyph--dark' : ''}`} data-playing={playing ? 'true' : 'false'} aria-hidden="true">
    <svg className="pp-glyph__play" viewBox="0 0 24 24" focusable="false">
      <path d="M8.6 6.32v11.36a1.3 1.3 0 0 0 1.97 1.11l9.27-5.68a1.3 1.3 0 0 0 0-2.22L10.57 5.21A1.3 1.3 0 0 0 8.6 6.32z" />
    </svg>
    <svg className="pp-glyph__pause" viewBox="0 0 24 24" focusable="false">
      <rect x="6.6" y="5.2" width="3.9" height="13.6" rx="1.3" />
      <rect x="13.5" y="5.2" width="3.9" height="13.6" rx="1.3" />
    </svg>
  </span>
);

// Skip back: bar + triangle. The bar means "to the start of the track /
// the track before"; two triangles would mean rewind (scrubbing), which
// these buttons don't do.
const PrevIcon = () => (
  <svg className="skip-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect x="5.2" y="5.8" width="2.3" height="12.4" rx="1.15" />
    <path d="M18.8 7.24v9.52a1.2 1.2 0 0 1-1.84 1.01l-7.06-4.76a1.2 1.2 0 0 1 0-2.02l7.06-4.76a1.2 1.2 0 0 1 1.84 1.01z" />
  </svg>
);

// Skip forward: the same glyph, mirrored, so the two are exact twins.
const NextIcon = () => (
  <svg className="skip-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <g transform="matrix(-1 0 0 1 24 0)">
      <rect x="5.2" y="5.8" width="2.3" height="12.4" rx="1.15" />
      <path d="M18.8 7.24v9.52a1.2 1.2 0 0 1-1.84 1.01l-7.06-4.76a1.2 1.2 0 0 1 0-2.02l7.06-4.76a1.2 1.2 0 0 1 1.84 1.01z" />
    </g>
  </svg>
);

const PlusIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ width: size, height: size, display: 'block' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const DownloadIcon = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ width: size, height: size, display: 'block' }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const VolumeIcon = ({ level }) => {
  if (level === 0) {
    return (
      <svg viewBox="0 0 24 24" width="17" height="17" style={{ width: 17, height: 17, display: 'block' }} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" style={{ width: 17, height: 17, display: 'block' }} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      {level > 0.3 && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
    </svg>
  );
};

const VideoMark = () => (
  <span className="unp-video-mark" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="14" height="14"><path d="M8 5v14l11-7z" fill="#fff" /></svg>
  </span>
);

const Spinner = () => <span className="unp-spinner" aria-hidden="true" />;

// Pages with a big artwork hero: the mini player stays glass on these so
// the art shows through.
const ART_HERO_ROUTE = /^\/(song|artist|jurisdiction|playlist)\//;

const DESKTOP_QUERY = '(min-width: 1025px)';
const useIsDesktop = () => {
  const [desktop, setDesktop] = useState(
    () => (typeof window !== 'undefined' && !!window.matchMedia?.(DESKTOP_QUERY)?.matches),
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia?.(DESKTOP_QUERY);
    if (!mq) return undefined;
    const update = () => setDesktop(!!mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return desktop;
};

const jurisdictionNameOf = (m) => {
  if (!m?.jurisdiction) return '';
  return typeof m.jurisdiction === 'string' ? m.jurisdiction : (m.jurisdiction.name || '');
};


const Player = () => {
  const {
    isExpanded,
    toggleExpand,
    currentMedia,
    next,
    prev,
    repeatMode,        // ★ REPEAT: read loop mode so `ended` can honor it
    audioRef,
    showPlaylistManager,
    closePlaylistManager,
    queue,
    consumePendingResume,
  } = useContext(PlayerContext);

  const { isGuest } = useAuth();
  const { triggerGate, gateProps } = useAuthGate();
  const { showReward } = useReward();
  const feedback = useFeedback();
  const location = useLocation();
  const isDesktop = useIsDesktop();

  // --- LOCAL STATE ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [specificVoteData, setSpecificVoteData] = useState(null);
  const [volume, setVolume] = useState(0.7);
  const [showQueue, setShowQueue] = useState(false); // desktop queue drawer
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Wizards State
  const [showPlaylistWizard, setShowPlaylistWizard] = useState(false);
  const [showVoteWizard, setShowVoteWizard] = useState(false);

  const [trayOpen, setTrayOpen] = useState(false);     // phone: song actions tray
  const [npMode, setNpMode] = useState('main');        // Now Playing: main | lyrics | queue
  const [npMore, setNpMore] = useState(false);         // Now Playing: More sheet
  const [showComments, setShowComments] = useState(false); // ★ comments: slide-up comment sheet
  const [showLyrics, setShowLyrics] = useState(false); // desktop lyrics view (mic button)
  const [userId, setUserId] = useState(null);

  // Pocket Lock — visual scaffold only for step 1.
  // Full overlay + intro modal comes next.
  const [pocketLockEnabled, setPocketLockEnabled] = useState(false);
  const [showPocketLockIntro, setShowPocketLockIntro] = useState(false);

  const trayRef = useRef(null);
  const trayToggleRef = useRef(null);
  const miniOpenRef = useRef(null);
  const npCloseRef = useRef(null);
  const gestureRef = useRef({ x: 0, y: 0, swiped: false });
  const wasOpenRef = useRef(false);
  const playRewardedRef = useRef(false);
  const activeRewardSongIdRef = useRef(null);

  // ★ PLAY-FLOW (change 1 of 3): refs to carry the play row id + last listened %
  // currentPlayIdRef holds the play_id returned by the backend when a play is
  // counted, so we can later tell the backend that play completed.
  // lastPercentRef tracks how far through the song the listener got.
  const currentPlayIdRef = useRef(null);
  const lastPercentRef = useRef(0);
  // True when currentPlayIdRef holds a logged-out play (anonymous_plays).
  const currentPlayIsAnonRef = useRef(false);

  const navigate = useNavigate();
  const hasMedia = !!currentMedia;

  // --- LOOK: artwork colours + motion ---
  const artSrc = currentMedia?.artwork || currentMedia?.artworkUrl || null;
  const palette = useArtworkPalette(artSrc);
  const moving = useScrollMotion({ enabled: !!currentMedia && !isExpanded });
  const pinnedGlass = ART_HERO_ROUTE.test(location.pathname);
  const glass = moving || pinnedGlass;
  const tucked = moving && !isDesktop;

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
    const percentPlayed = Math.round(lastPercentRef.current * 100) / 100;
    if (currentPlayIsAnonRef.current) {
      currentPlayIsAnonRef.current = false;
      apiCall({
        method: 'post',
        url: '/v1/media/anonymous-play/complete',
        data: { playId, visitorId: getVisitorId(), percentPlayed },
      }).catch((err) => console.error('Logged-out play completion failed:', err));
      return;
    }
    apiCall({
      method: 'post',
      url: '/v1/media/play/complete',
      data: {
        playId,
        percentPlayed,
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
    if (!currentMedia) return;
    // Logged-out listeners pass the same 15s/25% gate, but their play goes to
    // anonymous_plays: no points, no play count, no awards — metrics only.
    const loggedOut = isGuest || !userId;

    const mediaIsVideo = currentMedia.type === 'video';
    if (mediaIsVideo) return;

    const songId = currentMedia.id || currentMedia.songId;
    if (!songId || playRewardedRef.current) return;

    const reachedMinimumTime = currentTime >= 15;
    const reachedMeaningfulPercent =
      duration > 0 && currentTime >= Math.min(duration * 0.25, 30);

    if (!reachedMinimumTime && !reachedMeaningfulPercent) return;

    playRewardedRef.current = true;

    const trackLoggedOutPlay = async () => {
      try {
        const res = await apiCall({
          method: 'post',
          url: `/v1/media/song/${songId}/anonymous-play?visitorId=${encodeURIComponent(getVisitorId())}&source=${encodeURIComponent(currentMedia.source || 'player')}`,
        });
        currentPlayIdRef.current = res?.data?.playId || null;
        currentPlayIsAnonRef.current = Boolean(res?.data?.playId);
      } catch (err) {
        // Never interrupts listening; this play just isn't counted.
        console.error('Failed to record logged-out play:', err);
      }
    };

    if (loggedOut) {
      trackLoggedOutPlay();
      return;
    }

    const trackRealPlay = async () => {
      try {
        // ★ PLAY-FLOW (change 2 of 3): send `source` and capture the returned
        // playId. Everything else here (the 15s/25% gate above, the reward
        // below, guest handling) is unchanged.
        const res = await apiCall({
          method: 'post',
          url: `/v1/media/song/${songId}/play?source=${encodeURIComponent(currentMedia.source || 'player')}`,
        });

        currentPlayIdRef.current = res?.data?.playId || null; // ★ PLAY-FLOW
        currentPlayIsAnonRef.current = false;

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


  // 4. Audio Listeners — load + play when the track changes
  useEffect(() => {
    if (currentMedia && audioRef.current) {
      const media = audioRef.current;

      const mediaUrl = currentMedia.url || currentMedia.fileUrl || currentMedia.mediaUrl;
      if (!mediaUrl) return;

      // ★ QUEUE PERSISTENCE: on the first load after a page refresh the queue
      //   was restored from localStorage, and this effect fires as if a brand
      //   new track had been selected. Two things must NOT happen in that case:
      //
      //     1. Resetting currentTime to 0 — it would discard the saved offset.
      //     2. Autoplaying — playback that isn't tied to a user gesture is
      //        blocked by every modern browser, so play() rejects, and the old
      //        code called setIsPlaying(true) regardless. The UI would show a
      //        playing state over silence.
      //
      //   consumePendingResume() returns the saved offset exactly once, so
      //   every subsequent track change falls through to normal behaviour.
      const pendingResume = consumePendingResume?.() ?? null;

      if (pendingResume) {
        const resumeAt = pendingResume.currentTime || 0;
        lastPercentRef.current = 0;
        media.src = mediaUrl;

        const handleResumeReady = () => {
          // Guard the offset against a track whose duration shrank (re-encode,
          // replaced upload). Seeking past the end leaves the element stalled.
          const safeOffset =
            Number.isFinite(media.duration) && media.duration > 0
              ? Math.min(resumeAt, Math.max(0, media.duration - 1))
              : resumeAt;
          media.currentTime = safeOffset;
          setCurrentTime(safeOffset);
          setIsPlaying(false); // restored paused — user presses play
          media.removeEventListener('loadedmetadata', handleResumeReady);
        };

        media.addEventListener('loadedmetadata', handleResumeReady);
        media.load();
        console.log(`[Player] Restored playback position at ${resumeAt.toFixed(1)}s (paused)`);
        return () => media.removeEventListener('loadedmetadata', handleResumeReady);
      }

      // --- Normal track change: start from the top and play ---
      media.currentTime = 0;
      setCurrentTime(0);
      lastPercentRef.current = 0; // ★ PLAY-FLOW: reset progress for the new track

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

  // 4b. Audio Listeners — play/pause/time/end/buffering events
  // Re-attached when the media element changes (first song, audio ⇄ video).
  useEffect(() => {
    const media = audioRef.current;
    if (!media) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => { setIsPlaying(false); setIsBuffering(false); };
    const handleWaiting = () => setIsBuffering(true);
    const handleReady = () => setIsBuffering(false);

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
      if (repeatMode === 'one' && media) { // ★ REPEAT: loop-one replays this track
        media.currentTime = 0;
        media.play().catch(() => {});
        return;                       // ★ REPEAT: do NOT advance
      }
      next();                          // ★ REPEAT: 'all' loop is handled inside next()
    };

    media.addEventListener('play', handlePlay);
    media.addEventListener('pause', handlePause);
    media.addEventListener('waiting', handleWaiting);
    media.addEventListener('playing', handleReady);
    media.addEventListener('canplay', handleReady);
    media.addEventListener('timeupdate', handleTimeUpdate);
    media.addEventListener('loadedmetadata', handleLoadedMetadata);
    media.addEventListener('ended', handleEnded);

    return () => {
      media.removeEventListener('play', handlePlay);
      media.removeEventListener('pause', handlePause);
      media.removeEventListener('waiting', handleWaiting);
      media.removeEventListener('playing', handleReady);
      media.removeEventListener('canplay', handleReady);
      media.removeEventListener('timeupdate', handleTimeUpdate);
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
      media.removeEventListener('ended', handleEnded);
    };
  }, [next, audioRef, repeatMode, currentMedia?.type, hasMedia]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, audioRef]);

  // --- Now Playing open / close ---
  const openNowPlaying = (mode = 'main') => {
    setTrayOpen(false);
    setNpMore(false);
    setNpMode(mode);
    if (!isExpanded) toggleExpand();
  };

  const closeNowPlaying = () => {
    setNpMore(false);
    if (isExpanded) toggleExpand();
  };

  // Focus moves into Now Playing when it opens and back to the mini player
  // when it closes. The view resets to "main" once the slide-out finishes.
  useEffect(() => {
    if (isExpanded && currentMedia) {
      wasOpenRef.current = true;
      const raf = requestAnimationFrame(() => npCloseRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(raf);
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      setNpMore(false);
      miniOpenRef.current?.focus?.({ preventScroll: true });
      const t = setTimeout(() => setNpMode('main'), 420);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Body flags: lock page scroll under Now Playing, and let the song
  // notification hide itself while Now Playing or the tray is open.
  useEffect(() => {
    const on = !!isExpanded && !!currentMedia;
    document.body.classList.toggle('unp-np-open', on);
    return () => document.body.classList.remove('unp-np-open');
  }, [isExpanded, currentMedia]);

  useEffect(() => {
    document.body.classList.toggle('unp-tray-open', trayOpen);
    return () => document.body.classList.remove('unp-tray-open');
  }, [trayOpen]);

  // Where things that float above the player (song notification, points
  // pill, cookie banner) should sit: the player's top edge + a 10px gap.
  useEffect(() => {
    const root = document.documentElement;
    if (!currentMedia) {
      root.style.removeProperty('--unp-stack');
      return;
    }
    const stack = isExpanded ? 104 : isDesktop ? 96 : tucked ? 76 : 88;
    root.style.setProperty('--unp-stack', `${stack}px`);
  }, [currentMedia, isExpanded, isDesktop, tucked]);

  useEffect(() => () => document.documentElement.style.removeProperty('--unp-stack'), []);

  // The tray gets out of the way as soon as the page moves.
  useEffect(() => {
    if (moving && trayOpen) setTrayOpen(false);
  }, [moving, trayOpen]);

  // Esc closes the tray, then the More sheet, then Now Playing — but never
  // while a wizard, sheet or modal opened from the player is on top.
  useEffect(() => {
    const modalOnTop = showVoteWizard || showComments || showPlaylistWizard || showDownloadModal
      || showPocketLockIntro || showPlaylistManager;
    if (modalOnTop || (!trayOpen && !isExpanded)) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (trayOpen) { setTrayOpen(false); trayToggleRef.current?.focus(); return; }
      if (npMore) { setNpMore(false); return; }
      if (isExpanded) toggleExpand();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trayOpen, npMore, isExpanded, toggleExpand, showVoteWizard, showComments, showPlaylistWizard,
    showDownloadModal, showPocketLockIntro, showPlaylistManager]);

  // Tap outside the tray closes it.
  useEffect(() => {
    if (!trayOpen) return;

    const handleOutsidePointerDown = (event) => {
      const target = event.target;

      if (trayRef.current?.contains(target)) return;
      if (trayToggleRef.current?.contains(target)) return;

      setTrayOpen(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
    };
  }, [trayOpen]);

  const isVideo = currentMedia?.type === 'video';
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 3. Navigation
  const handleNavigateToSong = (e) => {
    e?.stopPropagation?.();
    const id = currentMedia?.id || currentMedia?.songId;
    if (!id) return;
    closeNowPlaying();
    navigate(`/song/${id}`);
  };

  const handleNavigateToArtist = (e) => {
    e?.stopPropagation?.();
    if (!currentMedia?.artistId) return;
    closeNowPlaying();
    navigate(`/artist/${currentMedia.artistId}`);
  };

  // 5. Functional Handlers
  const handlePlayPause = (e) => {
    e?.stopPropagation?.();
    const media = audioRef.current;
    if (!media) return;
    if (media.paused) media.play().catch(console.error);
    else media.pause();
  };

  const handlePrev = (e) => { e?.stopPropagation?.(); prev(); };
  const handleNext = (e) => { e?.stopPropagation?.(); next(); };

  const handleLike = async (e) => {
    e?.stopPropagation?.();

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
        url: `/v1/media/song/${songId}/like`, // the server takes the user from the login
      });

      if (res.data.success) {
        const nextLiked = !wasLiked;

        setIsLiked(nextLiked);
        setLikeCount((prev) => (wasLiked ? Math.max(0, prev - 1) : prev + 1));

        // Only reward adding a like, not removing one — and only when points
        // were really added. A like pays once per person per track, ever, so
        // a re-like comes back with pointsAwarded: 0 and shows no pill.
        const earned = res.data.pointsAwarded;
        const title = currentMedia.title ? `“${currentMedia.title}”` : 'this song';
        if (nextLiked && (earned === undefined || earned > 0)) {
          // The points pill is the confirmation here — no toast on top.
          showReward({
            // Matches the backend: ScoreUpdateService.onLike gives the liker +1
            // (the +2 goes to the song itself, not the listener).
            points: earned || 1,
            label: 'Like counted',
            type: 'like',
            anchor: 'player',
          });
        } else if (nextLiked) {
          feedback.success(`Liked ${title}`, { id: 'player-like' });
        } else {
          feedback.info(`Removed ${title} from your likes`, { id: 'player-like' });
        }
      } else {
        feedback.error(wasLiked ? "Couldn't remove your like. Try again." : "Couldn't like this song. Try again.");
      }
    } catch (err) {
      console.error('Like toggle failed:', err);
      feedback.error(errorMessage(err, wasLiked ? "Couldn't remove your like. Try again." : "Couldn't like this song. Try again."));
    }
  };


  const handleVoteClick = async (e) => {
    e?.stopPropagation?.();
    setTrayOpen(false);
    if (isGuest) { triggerGate('vote'); return; }

    const safeId = currentMedia.id || currentMedia.songId;
    const safeTitle = currentMedia.title || currentMedia.name || "Unknown Song";
    const safeArtist = currentMedia.artist || currentMedia.artistName || "Unknown Artist";

    if (!safeId) {
      console.error("Player Error: Current song has no ID.");
      feedback.error("Can't vote on this track right now. Open its song page and vote from there.");
      return;
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
          jurisdictionId: songData.jurisdiction?.jurisdictionId || null, // ★ ironclad: real UUID, no slug re-mapping
          genreId: songData.genre?.genreId || null, // ★ ironclad
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
    e?.stopPropagation?.();
    setTrayOpen(false);
    setNpMore(false);
    if (isGuest) { triggerGate('generic'); return; }
    setShowPlaylistWizard(true);
  };

  const handleDownload = (e) => {
    e?.stopPropagation?.();
    setTrayOpen(false);
    setNpMore(false);
    if (isGuest) { triggerGate('generic'); return; }
    setShowDownloadModal(true);
  };

  const handleOpenComments = (e) => {
    e?.stopPropagation?.();
    setTrayOpen(false);
    setNpMore(false);
    setShowComments(true);
  };

  const handleSeek = (e) => {
    const media = audioRef.current;
    if (!media || !duration) return;
    const newTime = (Number(e.target.value) / 100) * duration;
    media.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e) => {
    const v = Math.max(0, Math.min(1, Number(e.target.value) / 100));
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const toggleTray = (e) => {
    e?.stopPropagation?.();
    setTrayOpen((v) => !v);
  };

  // Mini player gestures: swipe sideways to skip, swipe up to open Now
  // Playing, tap to open it. Buttons do all of this too.
  const onMiniPointerDown = (e) => {
    gestureRef.current = { x: e.clientX, y: e.clientY, swiped: false };
  };
  const onMiniPointerUp = (e) => {
    const g = gestureRef.current;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      g.swiped = true;
      try { navigator.vibrate?.(8); } catch { /* not supported */ }
      if (dx < 0) next(); else prev();
    } else if (dy < -40 && Math.abs(dy) > Math.abs(dx)) {
      g.swiped = true;
      openNowPlaying('main');
    }
  };
  const onMiniClick = () => {
    if (gestureRef.current.swiped) { gestureRef.current.swiped = false; return; }
    openNowPlaying('main');
  };

  // Now Playing tray: tapping the active view goes back to the main view.
  const switchNpMode = (mode) => setNpMode((cur) => (cur === mode ? 'main' : mode));

  const handlePocketLockToggle = (e) => {
    e?.stopPropagation?.();
    setTrayOpen(false);
    setNpMore(false);

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

  // ── Lyrics ──
  // Computers: the lyrics view over the page, with the dock still in reach.
  // Phones (and inside Now Playing anywhere): Now Playing's lyrics view.
  const closeLyrics = useCallback(() => setShowLyrics(false), []);
  const toggleLyrics = (e) => {
    e?.stopPropagation?.();
    setTrayOpen(false);
    if (isDesktop && !isExpanded) {
      setShowLyrics((v) => !v);
      return;
    }
    openNowPlaying('lyrics');
  };
  const lyricsSeek = (t) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };
  const lyricsTogglePlay = () => {
    const media = audioRef.current;
    if (!media) return;
    if (media.paused) media.play().catch(console.error);
    else media.pause();
  };

  // Shared modal block — rendered in BOTH branches below. Its layer sits above
  // Now Playing, so wizards and sheets opened from it appear on top.
  const modalsAndPanels = (
    <div className="unp-layer unp-layer--modals">
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
      <QueuePanel
        open={showQueue}
        onClose={() => setShowQueue(false)}
        isLiked={isLiked}
        onToggleLike={currentMedia ? handleLike : undefined}
      />
      <VotingWizard
        show={showVoteWizard}
        onClose={() => {
          setShowVoteWizard(false);
          setSpecificVoteData(null);
        }}
        onVoteSuccess={() => setShowVoteWizard(false)}
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
      {/* ★ comments: slide-up sheet reusing the songPage CommentSection */}
      {showComments && currentMedia && (
        <div
          className="player-comments-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Comments"
        >
          <div className="player-comments-sheet__head">
            <span className="player-comments-sheet__title">
              <MessageCircle size={15} aria-hidden="true" /> Comments
            </span>
            <button
              type="button"
              className="player-comments-sheet__close"
              onClick={() => setShowComments(false)}
              aria-label="Close comments"
            >
              <X size={16} />
            </button>
          </div>
          <div className="player-comments-sheet__body">
            <CommentSection
              songId={currentMedia.id || currentMedia.songId}
              userId={userId}
              songArtistId={currentMedia.artistId}
            />
          </div>
        </div>
      )}
      <AuthGateSheet {...gateProps} />
    </div>
  );

  // No song playing yet → render ONLY the modals (so sidebar/etc. can open them)
  if (!currentMedia) {
    return modalsAndPanels;
  }

  const title = currentMedia.title || 'Untitled';
  const artist = currentMedia.artist || currentMedia.artistName || 'Unknown Artist';
  const artUrl = artSrc || '/assets/placeholder.jpg';
  const jurisdiction = jurisdictionNameOf(currentMedia);
  const origin = currentMedia.origin;
  const fromPlaylist = origin?.type === 'playlist' && origin.name;
  const fromKicker = fromPlaylist ? 'Playing from' : 'Now playing';
  const fromLabel = fromPlaylist ? origin.name : (jurisdiction || 'Unis');
  const queueCount = queue.length;
  const playLabel = isBuffering ? 'Loading' : isPlaying ? 'Pause' : 'Play';
  const timeText = `${formatTime(currentTime)} of ${formatTime(duration)}`;

  const paletteVars = {
    '--unp-glow': palette.glow,
    '--unp-deep': palette.deep,
    '--unp-rest-1': palette.rest1,
    '--unp-rest-2': palette.rest2,
    '--unp-glass': palette.glass,
    '--unp-art': `url("${artUrl}")`,
    '--unp-progress': `${progress}%`,
  };

  const voteIcon = <Vote size={19} aria-hidden="true" />;

  // ── Phones / tablets: the mini player ──
  const mini = (
    <div className="unp-mini" role="region" aria-label="Player">
      <div className="unp-surface__tint" aria-hidden="true" />
      <div className="unp-mini__row">
        <button
          ref={miniOpenRef}
          type="button"
          className="unp-mini__open"
          onPointerDown={onMiniPointerDown}
          onPointerUp={onMiniPointerUp}
          onClick={onMiniClick}
          aria-label={`Open Now Playing: ${title} by ${artist}`}
        >
          <span className="unp-mini__art">
            <img src={artUrl} alt="" />
            {isVideo && <VideoMark />}
          </span>
          <span className="unp-mini__text">
            <span className="unp-mini__title">{title}</span>
            <span className="unp-mini__artist">{artist}</span>
          </span>
        </button>
        <button
          ref={trayToggleRef}
          type="button"
          className={`unp-mini__btn unp-mini__arrow ${trayOpen ? 'is-open' : ''}`}
          onClick={toggleTray}
          aria-expanded={trayOpen}
          aria-controls="unp-tray"
          aria-label={trayOpen ? 'Close song actions' : 'Song actions: vote, like, add and more'}
        >
          <ChevronUp size={22} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="unp-mini__btn unp-mini__queue"
          onClick={() => openNowPlaying('queue')}
          aria-label={`Queue${queueCount ? `, ${queueCount} songs` : ''}`}
        >
          <ListMusic size={21} aria-hidden="true" />
          {queueCount > 0 && <span className="unp-badge">{queueCount}</span>}
        </button>
        <button
          type="button"
          className="unp-mini__btn unp-mini__play"
          onClick={handlePlayPause}
          aria-label={playLabel}
        >
          {isBuffering ? <Spinner /> : <PlayPauseGlyph playing={isPlaying} />}
        </button>
      </div>
      <div className="unp-strip" aria-hidden="true"><span /></div>
    </div>
  );

  // ── Phones / tablets: the song actions tray (opened by the arrow) ──
  const tray = (
    <div
      id="unp-tray"
      ref={trayRef}
      className={`unp-tray ${trayOpen ? 'is-open' : ''}`}
      role="dialog"
      aria-label="Song actions"
      aria-hidden={!trayOpen}
      inert={!trayOpen}
    >
      <div className="unp-blend" aria-hidden="true"><span className="unp-blend__art" /><span className="unp-blend__scrim" /></div>
      <div className="unp-tray__body">
        <div className="unp-tray__head">
          <span className="unp-tray__kicker">Song actions</span>
          <span className="unp-tray__status">{queueCount > 0 ? `${queueCount} in queue` : 'Live session'}</span>
        </div>
        <button type="button" className="unp-vote" onClick={handleVoteClick}>
          {voteIcon}<span>Vote for this song</span>
        </button>
        <div className="unp-tray__grid">
          <button type="button" className={`unp-tile ${isLiked ? 'is-on' : ''}`} onClick={handleLike} aria-pressed={isLiked}>
            <span className="unp-tile__icon"><Heart size={20} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" /></span>
            <span className="unp-tile__label">{isLiked ? 'Liked' : 'Like'}</span>
            <span className="unp-tile__hint">{likeCount > 0 ? `${likeCount} total` : 'Support'}</span>
          </button>
          <button type="button" className="unp-tile" onClick={handleAddToPlaylist}>
            <span className="unp-tile__icon"><PlusIcon size={20} /></span>
            <span className="unp-tile__label">Add</span>
            <span className="unp-tile__hint">Playlist</span>
          </button>
          <button type="button" className="unp-tile" onClick={handleDownload}>
            <span className="unp-tile__icon"><DownloadIcon size={19} /></span>
            <span className="unp-tile__label">Download</span>
            <span className="unp-tile__hint">Offline</span>
          </button>
          {!isVideo && (
            <button type="button" className="unp-tile" onClick={toggleLyrics}>
              <span className="unp-tile__icon"><Mic2 size={19} aria-hidden="true" /></span>
              <span className="unp-tile__label">Lyrics</span>
              <span className="unp-tile__hint">Sing along</span>
            </button>
          )}
          <button type="button" className="unp-tile" onClick={handleOpenComments}>
            <span className="unp-tile__icon"><MessageCircle size={19} aria-hidden="true" /></span>
            <span className="unp-tile__label">Comments</span>
            <span className="unp-tile__hint">Talk</span>
          </button>
          <button
            type="button"
            className={`unp-tile ${pocketLockEnabled ? 'is-on' : ''}`}
            onClick={handlePocketLockToggle}
            aria-pressed={pocketLockEnabled}
          >
            <span className="unp-tile__icon"><Lock size={19} aria-hidden="true" /></span>
            <span className="unp-tile__label">Lock</span>
            <span className="unp-tile__hint">{pocketLockEnabled ? 'Protected' : 'Pocket'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  // ── Computers: the dock ──
  const dock = (
    <div className="unp-dock" role="region" aria-label="Player">
      <div className="unp-surface__tint" aria-hidden="true" />
      <div className="unp-dock__row">
        <div className="unp-dock__left">
          <button type="button" className="unp-dock__art" onClick={() => openNowPlaying('main')} aria-label={`Open Now Playing: ${title}`}>
            <img src={artUrl} alt="" />
            {isVideo && <VideoMark />}
          </button>
          <div className="unp-dock__text">
            <button type="button" className="unp-link unp-dock__title" onClick={handleNavigateToSong}>{title}</button>
            <span className="unp-dock__sub">
              <button type="button" className="unp-link" onClick={handleNavigateToArtist}>{artist}</button>
              {jurisdiction && <> · <em className="unp-serif">{jurisdiction}</em></>}
            </span>
          </div>
          <button
            type="button"
            className={`unp-icon unp-like ${isLiked ? 'is-on' : ''}`}
            onClick={handleLike}
            aria-pressed={isLiked}
            aria-label={isLiked ? 'Unlike this song' : 'Like this song'}
          >
            <Heart size={19} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        </div>

        <div className="unp-dock__center">
          <span className="unp-time">{formatTime(currentTime)}</span>
          <button type="button" className="unp-vote unp-vote--sm" onClick={handleVoteClick}>
            <Vote size={16} aria-hidden="true" /><span>Vote</span>
          </button>
          <button type="button" className="unp-icon unp-skip" onClick={handlePrev} aria-label="Previous"><PrevIcon /></button>
          <button type="button" className="unp-play unp-play--md" onClick={handlePlayPause} aria-label={playLabel}>
            {isBuffering ? <Spinner /> : <PlayPauseGlyph playing={isPlaying} dark />}
          </button>
          <button type="button" className="unp-icon unp-skip" onClick={handleNext} aria-label="Next"><NextIcon /></button>
          <button type="button" className="unp-icon" onClick={handleAddToPlaylist} aria-label="Add to playlist or queue"><PlusIcon size={19} /></button>
          <span className="unp-time">{formatTime(duration)}</span>
        </div>

        <div className="unp-dock__right">
          {!isVideo && (
            <button
              type="button"
              className={`unp-icon ${showLyrics ? 'is-on' : ''}`}
              onClick={toggleLyrics}
              aria-label="Lyrics"
              aria-pressed={showLyrics}
            >
              <Mic2 size={18} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className={`unp-icon ${showQueue ? 'is-on' : ''}`}
            onClick={() => setShowQueue((v) => !v)}
            aria-label={`Queue${queueCount ? `, ${queueCount} songs` : ''}`}
            aria-pressed={showQueue}
          >
            <ListMusic size={19} aria-hidden="true" />
            {queueCount > 0 && <span className="unp-badge">{queueCount}</span>}
          </button>
          <button type="button" className="unp-icon" onClick={handleDownload} aria-label="Download"><DownloadIcon size={18} /></button>
          <button
            type="button"
            className="unp-icon"
            onClick={() => setVolume(volume === 0 ? 0.7 : 0)}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
          >
            <VolumeIcon level={volume} />
          </button>
          <input
            type="range"
            className="unp-range unp-volume"
            min="0"
            max="100"
            step="1"
            value={Math.round(volume * 100)}
            onChange={handleVolumeChange}
            aria-label="Volume"
            style={{ '--p': `${volume * 100}%` }}
          />
          <button type="button" className="unp-icon" onClick={() => openNowPlaying('main')} aria-label="Open full-screen player">
            <Maximize2 size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      <input
        type="range"
        className="unp-range unp-dock__seek"
        min="0"
        max="100"
        step="0.1"
        value={progress}
        onChange={handleSeek}
        aria-label="Seek"
        aria-valuetext={timeText}
      />
    </div>
  );

  // ── Now Playing ──
  const compactPlay = (
    <button type="button" className="unp-play unp-play--sm" onClick={handlePlayPause} aria-label={playLabel}>
      {isBuffering ? <Spinner /> : <PlayPauseGlyph playing={isPlaying} dark />}
    </button>
  );

  const transport = (size) => (
    <div className={`unp-np__transport unp-np__transport--${size}`}>
      <button type="button" className="unp-icon unp-skip unp-skip--lg" onClick={handlePrev} aria-label="Previous"><PrevIcon /></button>
      <button type="button" className={`unp-play unp-play--${size}`} onClick={handlePlayPause} aria-label={playLabel}>
        {isBuffering ? <Spinner /> : <PlayPauseGlyph playing={isPlaying} dark />}
      </button>
      <button type="button" className="unp-icon unp-skip unp-skip--lg" onClick={handleNext} aria-label="Next"><NextIcon /></button>
    </div>
  );

  const nowPlaying = (
    <div
      className={`unp-np unp-np--${npMode} ${isExpanded ? 'is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing"
      aria-hidden={!isExpanded}
      inert={!isExpanded}
    >
      <div className="unp-np__ambient" aria-hidden="true"><span className="unp-np__blob" /></div>
      <div className="unp-np__scrim" aria-hidden="true" />

      <div className="unp-np__inner">
        <header className="unp-np__top">
          <button ref={npCloseRef} type="button" className="unp-icon unp-icon--lg" onClick={closeNowPlaying} aria-label="Close Now Playing">
            <ChevronDown size={26} aria-hidden="true" />
          </button>
          <div className="unp-np__from">
            <span>{fromKicker}</span>
            <strong>{fromLabel}</strong>
          </div>
          <button
            type="button"
            className="unp-icon unp-icon--lg"
            onClick={() => setNpMore(true)}
            aria-label="More options"
            aria-haspopup="dialog"
            aria-expanded={npMore}
          >
            <MoreHorizontal size={24} aria-hidden="true" />
          </button>
        </header>

        {/* The stage is always mounted (it may hold the video element), and
            hidden by CSS outside the main view. */}
        <div className="unp-np__stage">
          {isVideo ? (
            <video ref={audioRef} crossOrigin="anonymous" playsInline className="unp-np__video">
              <source src={currentMedia.url} type="video/mp4" />
            </video>
          ) : (
            <img className="unp-np__art" src={artUrl} alt={`Artwork for ${title}`} />
          )}
        </div>

        {npMode === 'main' && (
          <>
            <div className="unp-np__meta">
              <div className="unp-np__names">
                <button type="button" className="unp-link unp-np__title" onClick={handleNavigateToSong}>{title}</button>
                <span className="unp-np__artist">
                  <button type="button" className="unp-link" onClick={handleNavigateToArtist}>{artist}</button>
                  {jurisdiction && <> · <em className="unp-serif">{jurisdiction}</em></>}
                </span>
              </div>
              <button
                type="button"
                className={`unp-like-pill ${isLiked ? 'is-on' : ''}`}
                onClick={handleLike}
                aria-pressed={isLiked}
                aria-label={isLiked ? `Unlike this song, ${likeCount} likes` : `Like this song, ${likeCount} likes`}
              >
                <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                <span>{likeCount}</span>
              </button>
            </div>

            <div className="unp-np__seek">
              <input
                type="range"
                className="unp-range unp-range--np"
                min="0"
                max="100"
                step="0.1"
                value={progress}
                onChange={handleSeek}
                aria-label="Seek"
                aria-valuetext={timeText}
              />
              <div className="unp-np__times">
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
              </div>
            </div>

            {transport('lg')}

            <button type="button" className="unp-vote unp-vote--lg" onClick={handleVoteClick}>
              {voteIcon}<span>Vote for this song</span>
            </button>
          </>
        )}

        {npMode !== 'main' && (
          <div className="unp-np__compact">
            <img className="unp-np__compact-art" src={artUrl} alt="" />
            <div className="unp-np__compact-text">
              <button type="button" className="unp-link unp-np__compact-title" onClick={handleNavigateToSong}>{title}</button>
              <button type="button" className="unp-link unp-np__compact-artist" onClick={handleNavigateToArtist}>{artist}</button>
            </div>
            {npMode === 'queue' && compactPlay}
            <button type="button" className="unp-vote-dot" onClick={handleVoteClick} aria-label="Vote for this song">
              <Vote size={18} aria-hidden="true" />
            </button>
          </div>
        )}

        {npMode === 'lyrics' && !isVideo && (
          <>
            <div className="unp-np__lyrics">
              <LyricsView
                embedded
                media={currentMedia}
                mediaRef={audioRef}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                onTogglePlay={lyricsTogglePlay}
                onPrev={() => prev()}
                onNext={() => next()}
                onSeek={lyricsSeek}
                onClose={() => setNpMode('main')}
              />
            </div>
            {transport('md')}
          </>
        )}

        {npMode === 'queue' && (
          <div className="unp-np__queue">
            <QueuePanel
              embedded
              open={isExpanded}
              onClose={closeNowPlaying}
              isLiked={isLiked}
              onToggleLike={handleLike}
            />
          </div>
        )}
      </div>

      <nav className="unp-np__dock" aria-label="Now Playing tools">
        {!isVideo && (
          <button
            type="button"
            className={`unp-dock-btn ${npMode === 'lyrics' ? 'is-on' : ''}`}
            onClick={() => switchNpMode('lyrics')}
            aria-pressed={npMode === 'lyrics'}
          >
            <Mic2 size={20} aria-hidden="true" /><span>Lyrics</span>
          </button>
        )}
        <button type="button" className="unp-dock-btn" onClick={handleOpenComments}>
          <MessageCircle size={20} aria-hidden="true" /><span>Comments</span>
        </button>
        <button
          type="button"
          className={`unp-dock-btn ${npMode === 'queue' ? 'is-on' : ''}`}
          onClick={() => switchNpMode('queue')}
          aria-pressed={npMode === 'queue'}
        >
          <ListMusic size={20} aria-hidden="true" /><span>{queueCount > 0 ? `Queue · ${queueCount}` : 'Queue'}</span>
        </button>
        <button type="button" className="unp-dock-btn" onClick={() => setNpMore(true)} aria-haspopup="dialog">
          <MoreHorizontal size={20} aria-hidden="true" /><span>More</span>
        </button>
      </nav>

      {npMore && (
        <div className="unp-more">
          <button type="button" className="unp-more__backdrop" onClick={() => setNpMore(false)} aria-label="Close options" />
          <div className="unp-more__sheet" role="dialog" aria-label="More options">
            <div className="unp-more__head">
              <img src={artUrl} alt="" />
              <div>
                <strong>{title}</strong>
                <span>{artist}</span>
              </div>
            </div>
            <div className="unp-more__grid">
              <button type="button" className="unp-more__item" onClick={handleAddToPlaylist}>
                <PlusIcon size={22} /><span>Add to playlist</span>
              </button>
              <button type="button" className="unp-more__item" onClick={handleDownload}>
                <DownloadIcon size={21} /><span>Download</span>
              </button>
              <button
                type="button"
                className={`unp-more__item ${pocketLockEnabled ? 'is-on' : ''}`}
                onClick={handlePocketLockToggle}
                aria-pressed={pocketLockEnabled}
              >
                <Lock size={21} aria-hidden="true" /><span>{pocketLockEnabled ? 'Pocket Lock on' : 'Pocket Lock'}</span>
              </button>
              <button type="button" className="unp-more__item" onClick={handleNavigateToSong}>
                <Disc3 size={21} aria-hidden="true" /><span>Song page</span>
              </button>
              <button type="button" className="unp-more__item" onClick={handleNavigateToArtist}>
                <UserRound size={21} aria-hidden="true" /><span>Artist page</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Song is playing → render the player + modals
  const rootClass = [
    'player',
    'unp',
    isExpanded ? 'expanded' : '',
    glass ? 'is-glass' : '',
    tucked ? 'is-tucked' : '',
    isPlaying ? 'is-playing' : 'is-paused',
    trayOpen ? 'is-tray-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClass} style={paletteVars}>
      {!isVideo && (
        <audio ref={audioRef} crossOrigin="anonymous" className="hidden-media" style={{ display: 'none' }}>
          <source src={currentMedia.url} type="audio/mpeg" />
        </audio>
      )}

      {showLyrics && isDesktop && !isExpanded && !isVideo && (
        <div className="unp-layer unp-layer--lyrics">
          <LyricsView
            media={currentMedia}
            mediaRef={audioRef}
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            full={false}
            onTogglePlay={lyricsTogglePlay}
            onPrev={() => prev()}
            onNext={() => next()}
            onSeek={lyricsSeek}
            onClose={closeLyrics}
          />
        </div>
      )}

      {isDesktop ? dock : mini}
      {!isDesktop && tray}
      {nowPlaying}

      {/* --- WIZARDS & PANELS --- */}
      {modalsAndPanels}
    </div>
  );
};

export default Player;
