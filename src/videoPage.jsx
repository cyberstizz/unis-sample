// videoPage.jsx — Unis Video Page
//
// Modeled on YouTube's mobile watch page: sticky 16:9 player pinned to the
// top, tight metadata panel (title → meta → artist row → action chips →
// expandable description), comments directly below. No recommended section
// (a Unis-native version ships later). Videos are not votable and win no
// awards, so there is deliberately no Vote flow on this page.
//
// Playback rule: the inline video and the global audio player are mutually
// exclusive. Starting the video pauses the player; starting the player
// pauses the video.

import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import fallbackArtwork from './assets/theQuiet.jpg';
import { Heart, Flag, Link as LinkIcon, ChevronDown, ChevronUp } from 'lucide-react';
import './videoPage.scss';
import Layout from './layout';
import { PlayerContext } from './context/playercontext';
import CommentSection from './commentSection';
import { useAuth } from './context/AuthContext';
import { buildUrl } from './utils/buildUrl';

const VideoPage = () => {
  const { videoId } = useParams();
  const { isPlaying, togglePlayPause } = useContext(PlayerContext);
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.userId;

  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [ambientRGB, setAmbientRGB] = useState({ r: 80, g: 60, b: 40 });

  const videoRef = useRef(null);
  const hasTrackedPlayRef = useRef(false);

  // ── Ambient color from artwork (same technique as songPage) ──
  const extractColor = (url) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 1;
      canvas.height = 1;
      ctx.drawImage(img, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      setAmbientRGB({ r, g, b });
    };
  };

  // ── Formatters (identical conventions to songPage) ──
  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // ── Data fetching ──
  useEffect(() => {
    if (!videoId) return;
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const likedUrl = userId
          ? `/v1/media/video/${videoId}/is-liked?userId=${userId}`
          : `/v1/media/video/${videoId}/is-liked`;

        const [videoRes, likedRes, likeCountRes] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/media/video/${videoId}`, useCache: false }),
          apiCall({ method: 'get', url: likedUrl }).catch(() => ({ data: { isLiked: false } })),
          apiCall({ method: 'get', url: `/v1/media/video/${videoId}/likes/count` }).catch(() => ({ data: { count: 0 } })),
        ]);

        const videoData = videoRes.data;
        const normalized = {
          id: videoData.videoId,
          title: videoData.title,
          artist: videoData.artist?.username || 'Unknown Artist',
          artistId: videoData.artist?.userId || null,
          artistPhoto: buildUrl(videoData.artist?.photoUrl) || null,
          jurisdiction: videoData.jurisdiction?.name || 'Unknown',
          url: buildUrl(videoData.videoUrl) || null,
          poster: buildUrl(videoData.artworkUrl) || null,
          description: videoData.description || '',
          score: videoData.score,
          playCount: videoData.playCount || 0,
          playsToday: videoData.playsToday || 0,
          duration: videoData.duration ? Math.round(videoData.duration / 1000) : null,
          createdAt: videoData.createdAt,
          genre: videoData.genre?.name || null,
        };

        setVideo(normalized);
        setIsLiked(likedRes.data.isLiked || false);
        setLikeCount(likeCountRes.data.count || 0);
        if (normalized.poster) extractColor(normalized.poster);
      } catch (err) {
        console.error('Failed to load video:', err);
        setError('Failed to load video details');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [videoId, userId]);

  // Reset one-play-per-visit tracking when navigating between videos
  useEffect(() => {
    hasTrackedPlayRef.current = false;
    setDescExpanded(false);
  }, [videoId]);

  // ── Mutual exclusion: global player started → pause the inline video ──
  useEffect(() => {
    if (isPlaying && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  // ── Inline video started → pause the global player + track the play ──
  const handleVideoPlay = useCallback(() => {
    // Pause the global audio player if it's running
    if (isPlaying) {
      togglePlayPause();
    }

    // Track one play per page visit. The backend endpoint requires a user,
    // so guest plays are intentionally not tracked (same as songPage).
    if (hasTrackedPlayRef.current || !video?.id || !userId) return;
    hasTrackedPlayRef.current = true;

    // Optimistic bump
    setVideo(prev => prev ? {
      ...prev,
      playCount: prev.playCount + 1,
      playsToday: prev.playsToday + 1,
    } : prev);

    apiCall({ method: 'post', url: `/v1/media/video/${video.id}/play?userId=${userId}` })
      .catch(err => {
        console.error('Failed to track video play:', err);
        hasTrackedPlayRef.current = false;
        setVideo(prev => prev ? {
          ...prev,
          playCount: Math.max(0, prev.playCount - 1),
          playsToday: Math.max(0, prev.playsToday - 1),
        } : prev);
      });
  }, [isPlaying, togglePlayPause, video?.id, userId]);

  // ── Handlers ──
  const handleLike = async () => {
    if (!userId) { alert('Please log in to like videos'); return; }
    if (!video?.id) return;
    try {
      if (isLiked) {
        const res = await apiCall({ method: 'delete', url: `/v1/media/video/${video.id}/like?userId=${userId}` });
        if (res.data.success) { setIsLiked(false); setLikeCount(prev => Math.max(0, prev - 1)); }
      } else {
        const res = await apiCall({ method: 'post', url: `/v1/media/video/${video.id}/like?userId=${userId}` });
        if (res.data.success) { setIsLiked(true); setLikeCount(prev => prev + 1); }
      }
    } catch (error) { console.error('Failed to toggle like:', error); alert('Failed to update like. Please try again.'); }
  };

  const handleFollow = async () => {
    if (!video?.artistId) return;
    const newStatus = !isFollowing;
    setIsFollowing(newStatus);
    try {
      if (newStatus) await apiCall({ method: 'post', url: `/v1/users/${video.artistId}/follow` });
      else await apiCall({ method: 'delete', url: `/v1/users/${video.artistId}/follow` });
    } catch (err) { console.error('Failed to toggle follow:', err); setIsFollowing(!newStatus); }
  };

  const handleReport = () => console.log('Report video');

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }
    catch (err) { console.error('Failed to copy link:', err); }
  };

  const handleArtistClick = () => { if (video?.artistId) navigate(`/artist/${video.artistId}`); };

  // ── Loading ──
  if (loading) {
    return (
      <Layout backgroundImage={fallbackArtwork}>
        <div className="video-page-container">
          <div className="vp-loading">Loading video...</div>
        </div>
      </Layout>
    );
  }

  if (error || !video) {
    return (
      <Layout backgroundImage={fallbackArtwork}>
        <div className="video-page-container">
          <div className="vp-error">{error || 'Video not found'}</div>
        </div>
      </Layout>
    );
  }

  const hasDescription = Boolean(video.description && video.description.trim());

  return (
    <Layout backgroundImage={video.poster || fallbackArtwork}>
      <div
        className="video-page-container"
        style={{ '--ambient-r': ambientRGB.r, '--ambient-g': ambientRGB.g, '--ambient-b': ambientRGB.b }}
      >
        <div className="vp-column">

          {/* ━━━ STICKY PLAYER — pinned like YouTube mobile ━━━ */}
          <div className="vp-player-shell">
            <div className="vp-player-frame">
              {video.url ? (
                <video
                  ref={videoRef}
                  className="vp-video-el"
                  src={video.url}
                  poster={video.poster || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  onPlay={handleVideoPlay}
                  data-testid="vp-video"
                />
              ) : (
                <div className="vp-video-missing">Video unavailable</div>
              )}
            </div>
          </div>

          {/* ━━━ METADATA PANEL ━━━ */}
          <div className="vp-meta-panel">

            {/* Title */}
            <h1 className="vp-title">{video.title}</h1>

            {/* Meta line: plays • date • genre */}
            <div className="vp-meta-line">
              <span>{formatNumber(video.playCount)} plays</span>
              <span className="vp-dot" />
              <span>{formatDate(video.createdAt)}</span>
              {video.genre && <span className="vp-genre-pill">{video.genre}</span>}
              {video.playsToday > 100 && (
                <span className="vp-stat-hot">{formatNumber(video.playsToday)} today</span>
              )}
            </div>

            {/* Artist row — YouTube's channel row, Follow where Subscribe sits */}
            <div className="vp-artist-row">
              <div className="vp-artist-tap" onClick={handleArtistClick} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') handleArtistClick(); }}>
                <div className={`vp-artist-avatar ${video.artistPhoto ? '' : 'placeholder'}`}>
                  {video.artistPhoto
                    ? <img src={video.artistPhoto} alt={video.artist} />
                    : video.artist?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="vp-artist-text">
                  <span className="vp-artist-name">{video.artist}</span>
                  <span className="vp-artist-jur">{video.jurisdiction}</span>
                </div>
              </div>
              <button
                className={`vp-follow-btn ${isFollowing ? 'following' : ''}`}
                onClick={handleFollow}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            </div>

            {/* Action chips — horizontal scroll like YouTube */}
            <div className="vp-action-chips">
              <button
                onClick={handleLike}
                className={`vp-chip vp-chip-like ${isLiked ? 'liked' : ''}`}
              >
                <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                {formatNumber(likeCount)}
              </button>
              <button onClick={handleCopyLink} className="vp-chip">
                <LinkIcon size={15} aria-hidden="true" />
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </button>
              <button onClick={handleReport} className="vp-chip">
                <Flag size={15} aria-hidden="true" />
                Report
              </button>
            </div>

            {/* Expandable description — YouTube's "...more" card */}
            <div
              className={`vp-description-card ${descExpanded ? 'expanded' : ''}`}
              onClick={() => { if (!descExpanded) setDescExpanded(true); }}
            >
              <div className="vp-description-stats">
                <span>{formatNumber(video.playCount)} plays</span>
                <span className="vp-dot" />
                <span>{formatDate(video.createdAt)}</span>
                <span className="vp-dot" />
                <span>{formatDuration(video.duration)}</span>
              </div>
              {hasDescription ? (
                <p className={`vp-description-text ${descExpanded ? '' : 'clamped'}`}>
                  {video.description}
                </p>
              ) : (
                <p className="vp-description-text vp-description-empty">No description</p>
              )}
              <button
                className="vp-description-toggle"
                onClick={(e) => { e.stopPropagation(); setDescExpanded(prev => !prev); }}
              >
                {descExpanded
                  ? (<>Show less <ChevronUp size={13} aria-hidden="true" /></>)
                  : (<>...more <ChevronDown size={13} aria-hidden="true" /></>)}
              </button>
            </div>

            {/* ━━━ COMMENTS — directly below, exactly like the mobile watch page ━━━ */}
            <div className="vp-comments">
              <CommentSection videoId={video.id} userId={userId} artistId={video.artistId} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VideoPage;