import React, { useState, useContext, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import songArtwork from './assets/theQuiet.jpg';
import LyricsWizard from './lyricsWizard';
import { FileText, Heart } from 'lucide-react';
import './songPage.scss';
import Layout from './layout';
import { PlayerContext } from './context/playercontext';
import VotingWizard from './votingWizard';
import CommentSection from './commentSection';
import { useAuth } from './context/AuthContext';
import { buildUrl } from './utils/buildUrl';

const SongPage = () => {
  const { songId } = useParams();
  const { requestPlay, currentMedia } = useContext(PlayerContext);
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.userId;

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
  const [dominantColor, setDominantColor] = useState('rgba(255, 255, 255, 0.1)');
  const [ambientRGB, setAmbientRGB] = useState({ r: 80, g: 60, b: 40 });

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

  // ── Data fetching ──
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
          artistPhoto: buildUrl(songData.artist.photoUrl) || null,
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
          duration: songData.duration ? Math.round(songData.duration / 1000) : null,
          createdAt: songData.createdAt,
          genre: songData.genre?.name || 'Unknown',
          credits: { producer: 'N/A', writer: 'N/A', mix: 'N/A' },
          photos: [],
          videos: [],
        };

        setSong(normalized);
        setIsLiked(likedRes.data.isLiked || false);
        setLikeCount(likeCountRes.data.count || 0);
        if (normalized.artwork) extractColor(normalized.artwork);
      } catch (err) {
        console.error('Failed to load song:', err);
        setError('Failed to load song details');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [songId, userId]);

  useEffect(() => {
    if (!song?.id || !userId) return;
    if (!currentMedia) return;
    const playingId = currentMedia.id || currentMedia.songId;
    if (playingId !== song.id) return;

    // Optimistic bump
    setSong(prev => prev ? {
      ...prev,
      playCount: prev.playCount + 1,
      playsToday: prev.playsToday + 1,
    } : prev);

    // Backend POST
    apiCall({ method: 'post', url: `/v1/media/song/${song.id}/play?userId=${userId}` })
      .catch(err => {
        console.error('Failed to track song play:', err);
        setSong(prev => prev ? {
          ...prev,
          playCount: Math.max(0, prev.playCount - 1),
          playsToday: Math.max(0, prev.playsToday - 1),
        } : prev);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMedia?.id, currentMedia?.songId, song?.id, userId]);


  const HeroPlayIcon = () => (
    <svg viewBox="0 0 24 24" width="22" height="22"
      style={{ width: 22, height: 22, display: 'block', fill: '#FFFFFF', marginLeft: 2 }}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );

  const fetchSongData = async () => {
    try {
      const response = await apiCall({ method: 'get', url: `/v1/media/song/${songId}`, useCache: false });
      const songData = response.data;
      setSong(prev => ({ ...prev, lyrics: songData.lyrics || '', description: songData.description || prev.description }));
    } catch (err) { console.error('Failed to refresh song:', err); }
  };

  // ── Handlers — all identical to original ──
  const handleVoteSuccess = () => setShowVotingWizard(false);

  const handleVote = () => {
    setSelectedNominee({ id: song.id, name: song.title, type: 'song', jurisdiction: song.jurisdiction });
    setShowVotingWizard(true);
  };

  const handlePlay = async () => {
    const track = { id: song.id, songId: song.id, type: 'song', url: song.url, title: song.title, artist: song.artist, artwork: song.artwork, jurisdiction: song.jurisdiction };
    requestPlay(track);
  };

  const handleLike = async () => {
    if (!userId) { alert('Please log in to like songs'); return; }
    if (!song?.id) return;
    try {
      if (isLiked) {
        const res = await apiCall({ method: 'delete', url: `/v1/media/song/${song.id}/like?userId=${userId}` });
        if (res.data.success) { setIsLiked(false); setLikeCount(prev => Math.max(0, prev - 1)); }
      } else {
        const res = await apiCall({ method: 'post', url: `/v1/media/song/${song.id}/like?userId=${userId}` });
        if (res.data.success) { setIsLiked(true); setLikeCount(prev => prev + 1); }
      }
    } catch (error) { console.error('Failed to toggle like:', error); alert('Failed to update like. Please try again.'); }
  };

  const handleFollow = async () => {
    const newStatus = !isFollowing;
    setIsFollowing(newStatus);
    try {
      if (newStatus) await apiCall({ method: 'post', url: `/v1/users/${song.artistId}/follow` });
      else await apiCall({ method: 'delete', url: `/v1/users/${song.artistId}/follow` });
    } catch (err) { console.error('Failed to toggle follow:', err); setIsFollowing(!newStatus); }
  };

  const handleDontPlay = () => console.log('Added to do-not-play list');
  const handleReport = () => console.log('Report song');
  const handleShare = () => console.log('Share song');

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); }
    catch (err) { console.error('Failed to copy link:', err); }
  };

  const handleArtistClick = () => { if (song?.artistId) navigate(`/artist/${song.artistId}`); };

  const isOwner = userId && song?.artistId === userId;

  // ── Loading ──
  if (loading) {
    return (
      <Layout backgroundImage={songArtwork}>
        <div className="song-page-container">
          <div className="sp-loading">Loading song...</div>
        </div>
      </Layout>
    );
  }

  if (error || !song) {
    return (
      <Layout backgroundImage={songArtwork}>
        <div className="song-page-container">
          <div className="sp-error">{error || 'Song not found'}</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout backgroundImage={song.artwork}>
      <div className="song-page-container">
        <div className="sp-grid">

          {/* ━━━ LEFT / MAIN COLUMN ━━━ */}
          <div className="sp-main">

            {/* ── HERO ── */}
            <div className="sp-hero" style={{ '--ambient-r': ambientRGB.r, '--ambient-g': ambientRGB.g, '--ambient-b': ambientRGB.b }}>
              <div className="sp-hero-ambient" />
              <div className="sp-hero-content">
                <div className="sp-album-art">
                  <img src={song.artwork} alt={`${song.title} artwork`} />
                </div>
                <div className="sp-hero-info">
                  <div className="sp-jurisdiction" onClick={() => navigate(`/jurisdiction/${song.jurisdiction}`)}>
                    {song.jurisdiction}
                  </div>
                  <h1 className="sp-title">
                    {song.title}
                    {song.explicit && <span className="sp-explicit">Explicit</span>}
                  </h1>
                  <div className="sp-artist-row" onClick={handleArtistClick}>
                    <div className={`sp-artist-avatar ${song.artistPhoto ? '' : 'placeholder'}`}>
                      {song.artistPhoto
                        ? <img src={song.artistPhoto} alt={song.artist} />
                        : song.artist?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="sp-artist-name">{song.artist}</span>
                  </div>
                  <div className="sp-meta">
                    <span>{formatDuration(song.duration)}</span>
                    <span className="sp-dot" />
                    <span>{formatNumber(song.playCount)} plays</span>
                    <span className="sp-dot" />
                    <span>{formatDate(song.createdAt)}</span>
                    <span className="sp-genre-pill">{song.genre}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── PRIMARY ACTIONS — text buttons like original ── */}
            <div className="sp-primary-actions">
              <button onClick={handlePlay} className="sp-btn-play-circle" aria-label="Play">
                <HeroPlayIcon />
              </button>
              <button onClick={handleVote} className="sp-btn-vote">Vote</button>
              <button
                onClick={handleLike}
                className={`sp-btn-like ${isLiked ? 'liked' : ''}`}
              >
                <Heart size={16} fill={isLiked ? 'white' : 'none'} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} />
                {isLiked ? 'Liked' : 'Like'}
              </button>
            </div>

            {/* ── STATS ROW ── */}
            <div className="sp-stats-row">
              {song.playsToday > 100 && (
                <span className="sp-stat sp-stat-hot">{formatNumber(song.playsToday)} plays today</span>
              )}
            </div>

            {/* ── SECONDARY ACTIONS — text buttons like original ── */}
            <div className="sp-secondary-actions">
              <button onClick={handleDontPlay} className="sp-action-btn">Don't Play</button>
              <button onClick={handleReport} className="sp-action-btn">Report</button>
              <button onClick={handleCopyLink} className="sp-action-btn">
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            {/* ── LYRICS ── */}
            {(song.lyrics || isOwner) && (
              <div className="sp-lyrics-section">
                <div className="sp-lyrics-header">
                  <span className="sp-lyrics-label">Lyrics</span>
                  {isOwner && (
                    <button className="sp-lyrics-edit" onClick={() => setShowLyricsWizard(true)}>
                      <FileText size={13} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />
                      {song.lyrics ? 'Edit' : 'Add Lyrics'}
                    </button>
                  )}
                </div>
                {song.lyrics && <div className="sp-lyrics-body">{song.lyrics}</div>}
              </div>
            )}

            {/* ── COMMENTS ── */}
            <div className="sp-comments">
              <CommentSection songId={song.id} userId={userId} songArtistId={song.artistId} />
            </div>
          </div>

          {/* ━━━ RIGHT SIDEBAR ━━━ */}
          <aside className="sp-sidebar">
            <div className="sp-sidebar-ambient" style={{ backgroundImage: `url(${song.artwork})` }} />

            <div className="sp-sidebar-section">
              <div className="sp-sidebar-title">Song Details</div>
              <div className="sp-details-grid">
                <div className="sp-detail"><div className="sp-detail-label">Duration</div><div className="sp-detail-value">{formatDuration(song.duration)}</div></div>
                <div className="sp-detail"><div className="sp-detail-label">Uploaded</div><div className="sp-detail-value">{formatDate(song.createdAt)}</div></div>
                <div className="sp-detail"><div className="sp-detail-label">Plays</div><div className="sp-detail-value">{formatNumber(song.playCount)}</div></div>
                <div className="sp-detail"><div className="sp-detail-label">Likes</div><div className="sp-detail-value">{formatNumber(likeCount)}</div></div>
              </div>
            </div>

            <div className="sp-sidebar-section">
              <div className="sp-sidebar-title">Artist</div>
              <div className="sp-artist-card" onClick={handleArtistClick}>
                <div className={`sp-artist-card-avatar ${song.artistPhoto ? 'has-photo' : ''}`}>
                  {song.artistPhoto
                    ? <img src={song.artistPhoto} alt={song.artist} />
                    : song.artist?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="sp-artist-card-info">
                  <div className="sp-artist-card-name">{song.artist}</div>
                  <div className="sp-artist-card-jur">{song.jurisdiction}</div>
                </div>
                <button
                  className={`sp-sidebar-follow ${isFollowing ? 'following' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleFollow(); }}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            </div>

            {song.description && song.description !== 'No description available' && (
              <div className="sp-sidebar-section">
                <div className="sp-sidebar-title">About</div>
                <p className="sp-about-text">{song.description}</p>
              </div>
            )}

            <div className="sp-sidebar-section">
              <div className="sp-sidebar-title">Credits</div>
              <div className="sp-credits">
                <div className="sp-credit"><span className="sp-credit-role">Producer</span><span className="sp-credit-name">{song.credits.producer}</span></div>
                <div className="sp-credit"><span className="sp-credit-role">Writer</span><span className="sp-credit-name">{song.credits.writer}</span></div>
                <div className="sp-credit"><span className="sp-credit-role">Mix</span><span className="sp-credit-name">{song.credits.mix}</span></div>
              </div>
            </div>

            {song.photos.length > 0 && (
              <div className="sp-sidebar-section">
                <div className="sp-sidebar-title">Photos</div>
                <div className="sp-media-grid">
                  {song.photos.map((photo, idx) => (<figure key={idx}><img src={photo.src} alt={photo.caption} /><figcaption>{photo.caption}</figcaption></figure>))}
                </div>
              </div>
            )}

            {song.videos.length > 0 && (
              <div className="sp-sidebar-section">
                <div className="sp-sidebar-title">Videos</div>
                <div className="sp-video-list">
                  {song.videos.map((vid, idx) => (
                    <div key={idx} className="sp-video-item">
                      <iframe src={vid.url} title={vid.caption} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                      <p>{vid.caption}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {showLyricsWizard && <LyricsWizard show={showLyricsWizard} onClose={() => setShowLyricsWizard(false)} song={song} onSuccess={fetchSongData} />}

      <VotingWizard
        show={showVotingWizard} onClose={() => setShowVotingWizard(false)} onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee} userId={userId}
        filters={{ selectedGenre: song.genre.toLowerCase().replace('/', '-'), selectedType: 'song', selectedInterval: 'daily', selectedJurisdiction: song.jurisdiction.toLowerCase().replace(' ', '-') }}
      />
    </Layout>
  );
};

export default SongPage;