import React, { useState, useContext, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import songArtwork from './assets/theQuiet.jpg';
import LyricsWizard from './lyricsWizard';
import {
  FileText, Heart, Play, Share2, Link2, Plus, MoreHorizontal,
  Flag, Ban, Check, Star, Eye, MessageCircle, Clock, Trophy,
  Music, User, MapPin, CheckCircle
} from 'lucide-react';
import './songPage.scss';
import Layout from './layout';
import { PlayerContext } from './context/playercontext';
import VotingWizard from './votingWizard';
import CommentSection from './commentSection';
import { useAuth } from './context/AuthContext';

const SongPage = () => {
  const { songId } = useParams();
  const { playMedia } = useContext(PlayerContext);
  const { user } = useAuth();
  const navigate = useNavigate();

  const userId = user?.userId;

  // ═══════════════════════════════════════════
  // STATE — identical to original
  // ═══════════════════════════════════════════

  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showLyricsWizard, setShowLyricsWizard] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [dominantColor, setDominantColor] = useState('rgba(255, 255, 255, 0.1)');

  // Ambient mode RGB channels (for CSS variable approach)
  const [ambientRGB, setAmbientRGB] = useState({ r: 80, g: 60, b: 40 });

  const moreMenuRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // ═══════════════════════════════════════════
  // HELPERS — identical to original
  // ═══════════════════════════════════════════

  const buildUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    const cleaned = url.trim();
    if (!cleaned) return '';

    if (cleaned.includes('r2.cloudflarestorage.com')) {
      const uploadsIndex = cleaned.indexOf('/uploads/');
      if (uploadsIndex !== -1) {
        const path = cleaned.slice(uploadsIndex);
        return `https://pub-fdce5bcbb7b14f3ead9299d58be5fbe6.r2.dev${path}`;
      }
    }

    if (cleaned.startsWith('http')) return cleaned;
    return `${API_BASE_URL}${cleaned}`;
  };

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
      setDominantColor(`rgba(${r}, ${g}, ${b}, 0.6)`);
      setAmbientRGB({ r, g, b });
    };
  };

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

  // ═══════════════════════════════════════════
  // DATA FETCHING — identical to original
  // ═══════════════════════════════════════════

  useEffect(() => {
    if (!songId) return;

    const fetchAll = async () => {
      setLoading(true);
      setError('');

      try {
        const likedUrl = userId
          ? `/v1/media/song/${songId}/is-liked?userId=${userId}`
          : `/v1/media/song/${songId}/is-liked`;

        const [songRes, likedRes, likeCountRes] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/media/song/${songId}`, useCache: false }),
          apiCall({ method: 'get', url: likedUrl }).catch(() => ({ data: { isLiked: false } })),
          apiCall({ method: 'get', url: `/v1/media/song/${songId}/likes/count` }).catch(() => ({ data: { count: 0 } })),
        ]);

        const songData = songRes.data;

        const normalized = {
          id: songData.songId,
          title: songData.title,
          artist: songData.artist.username,
          artistId: songData.artist.userId,
          jurisdiction: songData.jurisdiction?.name || 'Unknown',
          artwork: buildUrl(songData.artworkUrl) || songArtwork,
          url: buildUrl(songData.fileUrl) || null,
          description: songData.description || 'No description available',
          score: songData.score,
          playCount: songData.playCount || 0,
          playsToday: songData.playsToday || 0,
          explicit: songData.explicit || false,
          lyrics: songData.lyrics || '',
          voteCount: 0,
          duration: songData.duration,
          createdAt: songData.createdAt,
          genre: songData.genre?.name || 'Unknown',
          credits: { producer: 'N/A', writer: 'N/A', mix: 'N/A' },
          photos: [],
          videos: [],
        };

        setSong(normalized);
        setIsLiked(likedRes.data.isLiked || false);
        setLikeCount(likeCountRes.data.count || 0);

        if (normalized.artwork) {
          extractColor(normalized.artwork);
        }
      } catch (err) {
        console.error('Failed to load song:', err);
        setError('Failed to load song details');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [songId, userId]);

  const fetchSongData = async () => {
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/media/song/${songId}`,
        useCache: false,
      });
      const songData = response.data;
      setSong(prev => ({
        ...prev,
        lyrics: songData.lyrics || '',
        description: songData.description || prev.description,
      }));
    } catch (err) {
      console.error('Failed to refresh song:', err);
    }
  };

  // ═══════════════════════════════════════════
  // HANDLERS — identical to original
  // ═══════════════════════════════════════════

  const handleVoteSuccess = () => setShowVotingWizard(false);

  const handleVote = () => {
    setSelectedNominee({
      id: song.id,
      name: song.title,
      type: 'song',
      jurisdiction: song.jurisdiction,
    });
    setShowVotingWizard(true);
  };

  const handlePlay = async () => {
    const track = {
      id: song.id,
      songId: song.id,
      type: 'song',
      url: song.url,
      title: song.title,
      artist: song.artist,
      artwork: song.artwork,
      jurisdiction: song.jurisdiction,
    };
    playMedia(track, [track]);

    if (song.id && userId) {
      setSong(prev => ({
        ...prev,
        playCount: prev.playCount + 1,
        playsToday: prev.playsToday + 1,
      }));
      try {
        await apiCall({ method: 'post', url: `/v1/media/song/${song.id}/play?userId=${userId}` });
      } catch (err) {
        console.error('Failed to track song play:', err);
        setSong(prev => ({
          ...prev,
          playCount: prev.playCount - 1,
          playsToday: prev.playsToday - 1,
        }));
      }
    }
  };

  const handleLike = async () => {
    if (!userId) {
      alert('Please log in to like songs');
      return;
    }
    if (!song?.id) return;

    try {
      if (isLiked) {
        const res = await apiCall({
          method: 'delete',
          url: `/v1/media/song/${song.id}/like?userId=${userId}`,
        });
        if (res.data.success) {
          setIsLiked(false);
          setLikeCount(prev => Math.max(0, prev - 1));
        }
      } else {
        const res = await apiCall({
          method: 'post',
          url: `/v1/media/song/${song.id}/like?userId=${userId}`,
        });
        if (res.data.success) {
          setIsLiked(true);
          setLikeCount(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      alert('Failed to update like. Please try again.');
    }
  };

  const handleFollow = async () => {
    const newStatus = !isFollowing;
    setIsFollowing(newStatus);
    try {
      if (newStatus) {
        await apiCall({ method: 'post', url: `/v1/users/${song.artistId}/follow` });
      } else {
        await apiCall({ method: 'delete', url: `/v1/users/${song.artistId}/follow` });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      setIsFollowing(!newStatus);
    }
  };

  const handleDontPlay = () => {
    console.log('Added to do-not-play list');
    setShowMoreMenu(false);
  };

  const handleReport = () => {
    console.log('Report song');
    setShowMoreMenu(false);
  };

  const handleShare = () => {
    console.log('Share song');
    setShowMoreMenu(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
    setShowMoreMenu(false);
  };

  const handleArtistClick = () => {
    if (song?.artistId) navigate(`/artist/${song.artistId}`);
  };

  // Close more menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isOwner = userId && song?.artistId === userId;

  // ═══════════════════════════════════════════
  // RENDER — Loading State
  // ═══════════════════════════════════════════

  if (loading) {
    return (
      <Layout backgroundImage={songArtwork}>
        <div className="song-page-container">
          <div className="loading-skeleton">
            <div className="skeleton-art" />
            <div className="skeleton-info">
              <div className="skeleton-line w-20" />
              <div className="skeleton-line w-60 h-lg" />
              <div className="skeleton-line w-40" />
              <div className="skeleton-line w-80" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ═══════════════════════════════════════════
  // RENDER — Error State
  // ═══════════════════════════════════════════

  if (error || !song) {
    return (
      <Layout backgroundImage={songArtwork}>
        <div className="song-page-container">
          <div className="song-page-error">
            {error || 'Song not found'}
          </div>
        </div>
      </Layout>
    );
  }

  // ═══════════════════════════════════════════
  // RENDER — Main Song Page
  // ═══════════════════════════════════════════

  return (
    <Layout backgroundImage={song.artwork}>
      <div className="song-page-container">
        <div className="song-page-grid">

          {/* ━━━ LEFT / MAIN COLUMN ━━━ */}
          <div className="song-page-main">

            {/* ── HERO SECTION ── */}
            <div
              className="song-hero"
              style={{
                '--ambient-r': ambientRGB.r,
                '--ambient-g': ambientRGB.g,
                '--ambient-b': ambientRGB.b,
              }}
            >
              <div className="song-hero-ambient" />

              <div className="song-hero-content">
                {/* Album Art */}
                <div className="song-album-art">
                  <img src={song.artwork} alt={`${song.title} artwork`} />
                </div>

                {/* Song Info */}
                <div className="song-hero-info">
                  <div
                    className="song-jurisdiction-label"
                    onClick={() => navigate(`/jurisdiction/${song.jurisdiction}`)}
                  >
                    {song.jurisdiction}
                  </div>

                  <h1 className="song-title-display">
                    {song.title}
                    {song.explicit && (
                      <span className="song-explicit-badge">Explicit</span>
                    )}
                  </h1>

                  <div className="song-artist-row" onClick={handleArtistClick}>
                    <div className="song-artist-avatar placeholder">
                      {song.artist?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="song-artist-name">{song.artist}</span>
                  </div>

                  <div className="song-meta-row">
                    <span>{formatDuration(song.duration)}</span>
                    <div className="meta-dot" />
                    <span>{formatNumber(song.playCount)} plays</span>
                    <div className="meta-dot" />
                    <span>{formatDate(song.createdAt)}</span>
                    <span className="meta-genre">{song.genre}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── ACTION BAR ── */}
            <div className="song-action-bar">
              {/* Play */}
              <button className="action-play-btn" onClick={handlePlay} title="Play">
                <Play size={20} fill="white" />
              </button>

              {/* Vote */}
              <button
                className="action-text-btn"
                onClick={handleVote}
                title="Vote for this song"
              >
                <Star size={14} />
                Vote
              </button>

              {/* Like */}
              <button
                className={`action-icon-btn ${isLiked ? 'active-like' : ''}`}
                onClick={handleLike}
                title={isLiked ? 'Unlike' : 'Like'}
              >
                <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
              </button>

              {/* Share / Copy Link */}
              <button
                className={`action-icon-btn ${copySuccess ? 'active-vote' : ''}`}
                onClick={handleCopyLink}
                title={copySuccess ? 'Copied!' : 'Copy link'}
              >
                {copySuccess ? <Check size={16} /> : <Link2 size={16} />}
              </button>

              {/* Follow */}
              <button
                className={`action-text-btn ${isFollowing ? 'active' : ''}`}
                onClick={handleFollow}
                title={isFollowing ? 'Unfollow artist' : 'Follow artist'}
              >
                {isFollowing ? <CheckCircle size={14} /> : <Plus size={14} />}
                {isFollowing ? 'Following' : 'Follow'}
              </button>

              {/* More actions */}
              <div className="more-actions-container" ref={moreMenuRef}>
                <button
                  className="action-icon-btn"
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  title="More actions"
                >
                  <MoreHorizontal size={16} />
                </button>

                {showMoreMenu && (
                  <div className="more-actions-dropdown">
                    <button className="dropdown-item" onClick={handleShare}>
                      <Share2 size={15} />
                      Share
                    </button>
                    <button className="dropdown-item" onClick={handleDontPlay}>
                      <Ban size={15} />
                      Don't Play
                    </button>
                    <button className="dropdown-item danger" onClick={handleReport}>
                      <Flag size={15} />
                      Report
                    </button>
                  </div>
                )}
              </div>

              {/* Spacer */}
              <div className="action-bar-spacer" />

              {/* Stats */}
              <div className="action-bar-stats">
                <span className="stat-item">
                  <Heart size={13} />
                  {formatNumber(likeCount)}
                </span>
                <span className="stat-item">
                  <Eye size={13} />
                  {formatNumber(song.playCount)}
                </span>
                {song.playsToday > 100 && (
                  <span className="stat-item stat-hot">
                    {formatNumber(song.playsToday)} today
                  </span>
                )}
              </div>
            </div>

            {/* ── MAIN CONTENT AREA ── */}
            <div className="song-main-content">

              {/* Lyrics Section */}
              {(song.lyrics || isOwner) && (
                <div className="song-lyrics-section">
                  <div className="lyrics-header">
                    <span className="lyrics-title">Lyrics</span>
                    {isOwner && (
                      <button
                        className="lyrics-edit-btn"
                        onClick={() => setShowLyricsWizard(true)}
                      >
                        <FileText size={13} />
                        {song.lyrics ? 'Edit' : 'Add Lyrics'}
                      </button>
                    )}
                  </div>
                  {song.lyrics && (
                    <div className="lyrics-body">
                      {song.lyrics}
                    </div>
                  )}
                </div>
              )}

              {/* Comments — same component, same props */}
              <div className="song-comments-wrapper">
                <CommentSection
                  songId={song.id}
                  userId={userId}
                  songArtistId={song.artistId}
                />
              </div>
            </div>
          </div>

          {/* ━━━ RIGHT SIDEBAR ━━━ */}
          <aside className="song-right-sidebar">

            {/* Song Details */}
            <div className="sidebar-section">
              <div className="sidebar-section-title">Song details</div>
              <div className="song-details-grid">
                <div className="detail-card">
                  <div className="detail-label">Duration</div>
                  <div className="detail-value">{formatDuration(song.duration)}</div>
                </div>
                <div className="detail-card">
                  <div className="detail-label">Uploaded</div>
                  <div className="detail-value">{formatDate(song.createdAt)}</div>
                </div>
                <div className="detail-card">
                  <div className="detail-label">Plays</div>
                  <div className="detail-value">{formatNumber(song.playCount)}</div>
                </div>
                <div className="detail-card">
                  <div className="detail-label">Likes</div>
                  <div className="detail-value">{formatNumber(likeCount)}</div>
                </div>
              </div>
            </div>

            {/* Artist Card */}
            <div className="sidebar-section">
              <div className="sidebar-section-title">Artist</div>
              <div className="sidebar-artist-card" onClick={handleArtistClick}>
                <div className="artist-card-avatar">
                  {song.artist?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="artist-card-info">
                  <div className="artist-card-name">{song.artist}</div>
                  <div className="artist-card-jurisdiction">{song.jurisdiction}</div>
                </div>
                <button
                  className={`sidebar-follow-btn ${isFollowing ? 'following' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFollow();
                  }}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            </div>

            {/* About */}
            {song.description && song.description !== 'No description available' && (
              <div className="sidebar-section">
                <div className="sidebar-section-title">About</div>
                <div className="sidebar-about">
                  <p className="about-text">{song.description}</p>
                </div>
              </div>
            )}

            {/* Credits */}
            <div className="sidebar-section">
              <div className="sidebar-section-title">Credits</div>
              <div className="sidebar-credits">
                <div className="credit-item">
                  <span className="credit-role">Producer</span>
                  <span className="credit-name">{song.credits.producer}</span>
                </div>
                <div className="credit-item">
                  <span className="credit-role">Writer</span>
                  <span className="credit-name">{song.credits.writer}</span>
                </div>
                <div className="credit-item">
                  <span className="credit-role">Mix</span>
                  <span className="credit-name">{song.credits.mix}</span>
                </div>
              </div>
            </div>

            {/* Photos (conditional) */}
            {song.photos.length > 0 && (
              <div className="sidebar-section">
                <div className="sidebar-section-title">Photos</div>
                <div className="sidebar-media-section">
                  <div className="media-grid">
                    {song.photos.map((photo, idx) => (
                      <figure key={idx}>
                        <img src={photo.src} alt={photo.caption} />
                        <figcaption>{photo.caption}</figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Videos (conditional) */}
            {song.videos.length > 0 && (
              <div className="sidebar-section">
                <div className="sidebar-section-title">Videos</div>
                <div className="sidebar-media-section">
                  <div className="video-list">
                    {song.videos.map((vid, idx) => (
                      <div key={idx} className="video-item">
                        <iframe
                          src={vid.url}
                          title={vid.caption}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                        <p>{vid.caption}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>

        </div>
      </div>

      {/* ━━━ MODALS — identical to original ━━━ */}

      {showLyricsWizard && (
        <LyricsWizard
          show={showLyricsWizard}
          onClose={() => setShowLyricsWizard(false)}
          song={song}
          onSuccess={fetchSongData}
        />
      )}

      <VotingWizard
        show={showVotingWizard}
        onClose={() => setShowVotingWizard(false)}
        onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee}
        userId={userId}
        filters={{
          selectedGenre: song.genre.toLowerCase().replace('/', '-'),
          selectedType: 'song',
          selectedInterval: 'daily',
          selectedJurisdiction: song.jurisdiction.toLowerCase().replace(' ', '-'),
        }}
      />
    </Layout>
  );
};

export default SongPage;