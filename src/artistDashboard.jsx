import React, { useState, useEffect, useContext, useCallback } from 'react';
import LyricsWizard from './lyricsWizard';
import { Upload, Play, FileText, Vote, Eye, Heart, Users, X, Download, Music, Trash2, Edit3, History } from 'lucide-react';
import UploadWizard from './uploadWizard';
import ChangeDefaultSongWizard from './changeDefaultSongWizard';
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
import EditSongWizard from './editSongWizard';
import DeleteSongModal from './deleteSongModal';
import VoteHistoryModal from './voteHistoryModal';
import ReferralCodeCard from './ReferralCodeCard';
import ThemePicker from './ThemePicker';
import './artistDashboard.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { useAuth } from './context/AuthContext';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import { jsPDF } from 'jspdf';
import ChangePasswordWizard from './changePasswordWizard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// ---------------------------------------------------------------------------
// Small inline loader shown per-section while data is in flight
// ---------------------------------------------------------------------------
const SectionLoader = ({ label = 'Loading...' }) => (
  <div style={{ padding: '20px', textAlign: 'center', color: '#aaa' }}>
    <div className="spinner" style={{
      width: 24, height: 24, border: '3px solid rgba(255,255,255,0.1)',
      borderTop: '3px solid var(--unis-primary, #6c63ff)', borderRadius: '50%',
      animation: 'spin 0.8s linear infinite', margin: '0 auto 8px'
    }} />
    <p style={{ margin: 0, fontSize: '0.85rem' }}>{label}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// ---------------------------------------------------------------------------
// Inline error shown per-section when a fetch fails
// ---------------------------------------------------------------------------
const SectionError = ({ message = 'Failed to load.', onRetry }) => (
  <div style={{ padding: '20px', textAlign: 'center', color: '#ff6b6b' }}>
    <p style={{ margin: '0 0 8px' }}>{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn btn-secondary btn-small">
        Retry
      </button>
    )}
  </div>
);

const ArtistDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { playMedia } = useContext(PlayerContext);

  // ---- Core data (Tier 1 — must load before the page feels "ready") ------
  const [userProfile, setUserProfile] = useState(null);
  const [songs, setSongs] = useState([]);
  const [defaultSong, setDefaultSong] = useState(null);
  const [coreLoading, setCoreLoading] = useState(true);
  const [coreError, setCoreError] = useState(null);

  // ---- Secondary data (Tier 2 — can trickle in with spinners) ------------
  const [supporters, setSupporters] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [totalPlays, setTotalPlays] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const [supportedArtist, setSupportedArtist] = useState(null);

  const [voteHistory, setVoteHistory] = useState([]);
  const [votesLoading, setVotesLoading] = useState(true);
  const [votesError, setVotesError] = useState(null);

  const [awards, setAwards] = useState([]);
  const [awardsPage, setAwardsPage] = useState(0);
  const [hasMoreAwards, setHasMoreAwards] = useState(true);
  const [awardsLoading, setAwardsLoading] = useState(true);
  const [awardsError, setAwardsError] = useState(null);

  // ---- UI state ----------------------------------------------------------
  const [showWelcomePopup, setShowWelcomePopup] = useState(true);
  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDefaultSongWizard, setShowDefaultSongWizard] = useState(false);
  const [showDeleteWizard, setShowDeleteWizard] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [songToDelete, setSongToDelete] = useState(null);
  const [showLyricsWizard, setShowLyricsWizard] = useState(false);
  const [lyricsSong, setLyricsSong] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showVoteHistory, setShowVoteHistory] = useState(false);
  const [editingLyricsSong, setEditingLyricsSong] = useState(null);
  const [currentLyrics, setCurrentLyrics] = useState('');
  const [loadingMoreAwards, setLoadingMoreAwards] = useState(false);

  // -----------------------------------------------------------------------
  // Fetch helpers (wrapped in useCallback so they can be used as retry fns)
  // -----------------------------------------------------------------------
  const fetchCore = useCallback(async (userId) => {
    setCoreLoading(true);
    setCoreError(null);
    try {
      const [profileRes, songsRes, defaultSongRes] = await Promise.all([
        apiCall({ url: `/v1/users/profile/${userId}`, method: 'get', useCache: false }),
        apiCall({ url: `/v1/media/songs/artist/${userId}`, method: 'get', useCache: false }),
        apiCall({ url: `/v1/users/${userId}/default-song`, method: 'get', useCache: false }).catch(() => ({ data: null })),
      ]);

      const profile = profileRes.data;
      setUserProfile(profile);
      setTotalPlays(profile.totalPlays || 0);
      setTotalVotes(profile.totalVotes || 0);
      setSongs(songsRes.data || []);
      setDefaultSong(defaultSongRes.data);

      // Supported artist depends on profile — fire after profile resolves but
      // don't block the page on it.
      if (profile.supportedArtistId) {
        apiCall({ url: `/v1/users/profile/${profile.supportedArtistId}`, useCache: false })
          .then(artistRes => setSupportedArtist(artistRes.data))
          .catch(err => console.error('Failed to fetch supported artist:', err));
      }
    } catch (err) {
      console.error('Core data fetch failed:', err);
      setCoreError('Failed to load your dashboard. Please try again.');
    } finally {
      setCoreLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (userId) => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const [supportersRes, followersRes] = await Promise.all([
        apiCall({ url: `/v1/users/${userId}/supporters/count`, method: 'get', useCache: false }),
        apiCall({ url: `/v1/users/${userId}/followers/count`, method: 'get', useCache: false }).catch(() => ({ data: { count: 0 } })),
      ]);
      setSupporters(supportersRes.data.count || 0);
      setFollowers(followersRes.data.count || 0);
    } catch (err) {
      console.error('Stats fetch failed:', err);
      setStatsError('Could not load stats.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchVotes = useCallback(async () => {
    setVotesLoading(true);
    setVotesError(null);
    try {
      const res = await apiCall({ url: '/v1/vote/history?limit=50', useCache: false });
      setVoteHistory(res.data || []);
    } catch (err) {
      console.error('Vote history fetch failed:', err);
      setVotesError('Could not load vote history.');
    } finally {
      setVotesLoading(false);
    }
  }, []);

  const fetchAwards = useCallback(async (userId) => {
    setAwardsLoading(true);
    setAwardsError(null);
    try {
      const res = await apiCall({
        url: `/v1/awards/artist/${userId}?limit=10&offset=0`,
        method: 'get', useCache: false
      });
      const data = res.data || [];
      setAwards(data);
      setAwardsPage(0);
      setHasMoreAwards(data.length === 10);
    } catch (err) {
      console.error('Awards fetch failed:', err);
      setAwardsError('Could not load awards.');
      setAwards([]);
    } finally {
      setAwardsLoading(false);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Main effect: kick off all fetches. Tier 1 and Tier 2 run in parallel
  // but resolve independently — Tier 2 sections show spinners until ready.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (authLoading || !user?.userId) return;

    const userId = user.userId;

    // All tiers start at the same time — no waterfalls between tiers.
    fetchCore(userId);
    fetchStats(userId);
    fetchVotes();
    fetchAwards(userId);
  }, [user, authLoading, fetchCore, fetchStats, fetchVotes, fetchAwards]);

  // -----------------------------------------------------------------------
  // Early returns
  // -----------------------------------------------------------------------
  if (authLoading) return <div>Loading...</div>;
  if (!user) return <div>Please log in to view dashboard.</div>;

  if (coreLoading) {
    return (
      <Layout backgroundImage={backimage}>
        <div className="artist-dashboard" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <SectionLoader label="Loading your dashboard..." />
        </div>
      </Layout>
    );
  }

  if (coreError) {
    return (
      <Layout backgroundImage={backimage}>
        <div className="artist-dashboard" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <SectionError message={coreError} onRetry={() => fetchCore(user.userId)} />
        </div>
      </Layout>
    );
  }

  // Core data loaded — safe to derive display values
  const displayName = userProfile.username || 'Artist';
  const displayPhoto = userProfile.photoUrl
    ? (userProfile.photoUrl.startsWith('http') ? userProfile.photoUrl : `${API_BASE_URL}${userProfile.photoUrl}`)
    : backimage;
  const displayBio = userProfile.bio || 'No bio yet. Click Edit to add one.';

  // -----------------------------------------------------------------------
  // Handlers (unchanged logic, just reorganised)
  // -----------------------------------------------------------------------
  const refetchDefaultSong = () => {
    apiCall({ url: `/v1/users/${user.userId}/default-song`, method: 'get', useCache: false })
      .then(res => setDefaultSong(res.data))
      .catch(() => setDefaultSong(null));
  };

  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  const playSupportedArtistSong = async () => {
    if (!supportedArtist?.defaultSong) {
      alert('This artist has not set a featured song yet.');
      return;
    }
    const song = supportedArtist.defaultSong;
    const songId = song.songId || song.id;
    const songUrl = buildUrl(song.fileUrl);
    const artworkUrl = buildUrl(song.artworkUrl) || buildUrl(supportedArtist.photoUrl);
    if (!songUrl) return;
    const mediaObject = {
      type: 'song', id: songId, url: songUrl, title: song.title,
      artist: supportedArtist.username, artwork: artworkUrl
    };
    try {
      await apiCall({ method: 'post', url: `/v1/media/song/${songId}/play?userId=${user.userId}` });
    } catch (err) {
      console.error('Failed to track play:', err);
    }
    playMedia(mediaObject, [mediaObject]);
  };

  const downloadOwnershipContract = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    doc.setTextColor(240, 240, 240);
    doc.setFontSize(80);
    doc.setFont('helvetica', 'bold');
    for (let i = 0; i < 10; i++) {
      doc.text('UNIS', 100 + i * 100, 200 + i * 80, { angle: 45 });
    }
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIS ARTIST OWNERSHIP & REVENUE SHARE AGREEMENT', 40, 80, { textAlign: 'center', maxWidth: 500 });
    doc.setFontSize(12);
    doc.text(`This Agreement is entered into as of ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 60, 180);
    doc.text('Between:', 60, 220);
    doc.text('UNIS MUSIC PLATFORM ("Unis"), a digital music discovery service,', 80, 240);
    doc.text('and', 80, 260);
    doc.text(`${displayName} ("Artist"), an independent creator.`, 80, 280);
    doc.save(`unis_ownership_agreement_${displayName.replace(/\s/g, '_')}.pdf`);
  };

  const handleUploadSuccess = () => {
    setShowUploadWizard(false);
    apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get', useCache: false })
      .then(res => setSongs(res.data || []));
  };

  const handleProfileUpdate = () => {
    apiCall({ url: `/v1/users/profile/${user.userId}`, method: 'get', useCache: false })
      .then(res => setUserProfile(res.data))
      .catch(err => console.error('Failed to refresh profile:', err));
  };

  const handleSocialMediaUpdate = async (platform, url) => {
    try {
      const field = `${platform}Url`;
      await apiCall({ method: 'put', url: `/v1/users/profile/${user.userId}`, data: { [field]: url } });
      handleProfileUpdate();
      alert(`${platform} link updated successfully!`);
    } catch (err) {
      console.error('Failed to update social media:', err);
      alert('Failed to update link');
    }
  };

  const handleDeleteSongClick = (song) => {
    if (songs.length <= 1) {
      alert('You must have at least one song. Upload another song before deleting this one.');
      return;
    }
    if (defaultSong?.songId === song.songId) {
      alert('This is your featured song. Please change your featured song before deleting it.');
      setShowDefaultSongWizard(true);
      return;
    }
    setSongToDelete(song);
  };

  const handleConfirmDelete = async () => {
    if (!songToDelete) return;
    setDeletingSongId(songToDelete.songId);
    try {
      await apiCall({ method: 'delete', url: `/v1/media/song/${songToDelete.songId}` });
      const res = await apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get', useCache: false });
      setSongs(res.data || []);
      setSongToDelete(null);
    } catch (err) {
      console.error('Failed to delete song:', err);
      alert('Failed to delete song. Please try again.');
    } finally {
      setDeletingSongId(null);
    }
  };

  const handleSaveLyrics = async () => {
    if (!editingLyricsSong) return;
    try {
      await apiCall({ method: 'put', url: `/v1/media/song/${editingLyricsSong.songId}`, data: { lyrics: currentLyrics } });
      setSongs(prev => prev.map(s => s.songId === editingLyricsSong.songId ? { ...s, lyrics: currentLyrics } : s));
      setEditingLyricsSong(null);
    } catch (err) {
      console.error('Failed to save lyrics:', err);
      alert('Failed to save lyrics. Please try again.');
    }
  };

  const loadMoreAwards = async () => {
    setLoadingMoreAwards(true);
    try {
      const nextPage = awardsPage + 1;
      const res = await apiCall({
        url: `/v1/awards/artist/${user.userId}?limit=10&offset=${nextPage * 10}`,
        method: 'get', useCache: false
      });
      const newAwards = res.data || [];
      setAwards(prev => [...prev, ...newAwards]);
      setAwardsPage(nextPage);
      setHasMoreAwards(newAwards.length === 10);
    } catch (err) {
      console.error('Failed to load more awards:', err);
    } finally {
      setLoadingMoreAwards(false);
    }
  };

  const formatAwardDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getAwardEmoji = (determinationMethod) => {
    switch (determinationMethod) {
      case 'VOTES': return '🏆';
      case 'SCORE': return '⭐';
      case 'SENIORITY': return '👑';
      case 'FALLBACK': return '🎖️';
      default: return '🏅';
    }
  };

  const formatIsrc = (isrc) => {
    if (!isrc || isrc.length !== 12) return isrc || '';
    return `${isrc.slice(0, 2)}-${isrc.slice(2, 5)}-${isrc.slice(5, 7)}-${isrc.slice(7)}`;
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Layout backgroundImage={backimage}>
      <div className="artist-dashboard">

        {showWelcomePopup && (
          <div className="welcome-popup-overlay">
            <div className="welcome-popup">
              <button onClick={() => setShowWelcomePopup(false)} className="close-button"><X size={24} /></button>
              <div className="popup-content">
                <div className="icon-circle"><Heart size={40} fill="white" /></div>
                <h2>Thank You!</h2>
                <p>Your contribution to the UNIS community makes us stronger. Keep creating!</p>
              </div>
              <button onClick={() => setShowWelcomePopup(false)} className="welcome-button">You're Welcome</button>
            </div>
          </div>
        )}

        <div className="dashboard-content">

          <div className="dashboard-header">
            <h1 className='dashboard-h1'>Dashboard</h1>
          </div>

          {/* Profile */}
          <div className="profile-section card">
            <div className="profile-content">
              <img src={displayPhoto} alt={displayName} className="profile-image profile-image-bordered" />
              <div className="profile-info">
                <h2 className="artist-name">{displayName}</h2>
                <p className="artist-bio">{displayBio}</p>
                <div className="profile-header">
                  <button className="btn btn-primary" onClick={() => setShowEditProfile(true)}>Edit Profile</button>
                </div>
                <div className="profile-actions">
                  <button className="btn btn-secondary" onClick={downloadOwnershipContract}>
                    <Download size={16} /> Download Ownership Contract
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          {statsLoading ? (
            <SectionLoader label="Loading stats..." />
          ) : statsError ? (
            <SectionError message={statsError} onRetry={() => fetchStats(user.userId)} />
          ) : (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-content">
                  <div className="stat-info"><p className="stat-label">Score</p><p className="stat-value">{(userProfile.score || 0).toLocaleString()}</p></div>
                  <div className="stat-icon stat-icon-blue"><Eye size={28} /></div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-content">
                  <div className="stat-info"><p className="stat-label">Supporters</p><p className="stat-value">{supporters.toLocaleString()}</p></div>
                  <div className="stat-icon stat-icon-purple"><Users size={28} /></div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-content">
                  <div className="stat-info"><p className="stat-label">Followers</p><p className="stat-value">{followers.toLocaleString()}</p></div>
                  <div className="stat-icon stat-icon-green"><Heart size={28} /></div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-content">
                  <div className="stat-info"><p className="stat-label">Plays</p><p className="stat-value">{totalPlays.toLocaleString()}</p></div>
                  <div className="stat-icon stat-icon-red"><Play size={28} /></div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-content">
                  <div className="stat-info"><p className="stat-label">Songs</p><p className="stat-value">{songs.length}</p></div>
                  <div className="stat-icon stat-icon-orange"><Music size={28} /></div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-content">
                  <div className="stat-info"><p className="stat-label">Votes</p><p className="stat-value">{totalVotes.toLocaleString()}</p></div>
                  <div className="stat-icon stat-icon-black"><Vote size={28} /></div>
                </div>
              </div>
            </div>
          )}

          {/* Featured Song */}
          <div className="main-song-section card">
            <div className="section-header">
              <h3>Featured Song</h3>
              <button className="link-button" onClick={() => setShowDefaultSongWizard(true)} style={{ fontWeight: '600', color: 'var(--unis-primary)' }}>
                Change Featured
              </button>
            </div>
            <div className="main-song-card">
              <div className="song-icon"><Play size={28} fill="white" /></div>
              <div className="song-info">
                <h4>{defaultSong?.title || 'No featured song set'}</h4>
                {defaultSong && (
                  <div className="song-stats">
                    <span><Eye size={14} /> {defaultSong.playCount || 0} plays</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Songs */}
          <div className="content-section card">
            <div className="section-header">
              <h3><Play size={20} /> Songs</h3>
              <button className="btn btn-primary btn-small" onClick={() => setShowUploadWizard(true)}>
                <Upload size={16} /> Upload
              </button>
            </div>
            <div className="content-list">
              {songs.length > 0 ? songs.map((song, index) => (
                <div key={song.songId || song.id || index} className="content-item">
                  <div className="item-header">
                    <h4>{song.title}</h4>
                    <div className="item-actions">
                      <button className="edit-button" onClick={() => setEditingSong(song)}><Edit3 size={16} /></button>
                      <button className="lyrics-button" onClick={() => { setLyricsSong(song); setShowLyricsWizard(true); }}><FileText size={16} /></button>
                      <button className="delete-button" onClick={() => handleDeleteSongClick(song)} disabled={deletingSongId === song.songId}>
                        {deletingSongId === song.songId ? '...' : <Trash2 size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="item-stats">
                    <span><Play size={12} /> {song.playCount || song.plays || 0} plays</span>
                    {song.isrc ? (
                      <span style={{ color: '#A9A9A9', fontSize: '12px', marginLeft: '8px' }}>ISRC: {formatIsrc(song.isrc)}</span>
                    ) : (
                      <span style={{ color: '#f59e0b', fontSize: '11px', marginLeft: '8px' }}>No ISRC</span>
                    )}
                  </div>
                </div>
              )) : <p>No songs yet — upload your first!</p>}
            </div>
          </div>

          {/* Social Media */}
          <div className="social-media-section card">
            <div className="section-header"><h3>Social Media Links</h3></div>
            <div className="social-links-edit">
              <div className="social-link-item">
                <label>📷 Instagram</label>
                <input type="text" placeholder="https://instagram.com/yourprofile" defaultValue={userProfile.instagramUrl || ''} onBlur={(e) => handleSocialMediaUpdate('instagram', e.target.value)} className="social-input" />
              </div>
              <div className="social-link-item">
                <label>𝕏 Twitter / X</label>
                <input type="text" placeholder="https://twitter.com/yourprofile" defaultValue={userProfile.twitterUrl || ''} onBlur={(e) => handleSocialMediaUpdate('twitter', e.target.value)} className="social-input" />
              </div>
              <div className="social-link-item">
                <label>🎵 TikTok</label>
                <input type="text" placeholder="https://tiktok.com/@yourprofile" defaultValue={userProfile.tiktokUrl || ''} onBlur={(e) => handleSocialMediaUpdate('tiktok', e.target.value)} className="social-input" />
              </div>
            </div>
          </div>

          {/* Supported Artist */}
          {supportedArtist && (
            <div className="supported-artist-section card" style={{ marginTop: '2rem' }}>
              <div className="section-header"><h3><Heart size={20} /> I Support</h3></div>
              <div className="artist-support-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '15px' }}>
                <img src={supportedArtist.photoUrl ? buildUrl(supportedArtist.photoUrl) : backimage} alt={supportedArtist.username} className="artist-photo" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }} />
                <div className="artist-info" style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#e0e0e0' }}>{supportedArtist.username}</h4>
                  {supportedArtist.defaultSong ? (
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
                      <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem', marginRight: '15px' }}>
                        <Music size={12} style={{ display: 'inline', marginRight: '5px' }} />
                        {supportedArtist.defaultSong.title}
                      </p>
                      <button onClick={playSupportedArtistSong} style={{ background: 'transparent', border: '1px solid #aaa', borderRadius: '50%', padding: '5px', cursor: 'pointer', color: 'white' }}>
                        <Play size={14} fill="white" />
                      </button>
                    </div>
                  ) : (
                    <p style={{ color: '#777', fontStyle: 'italic', fontSize: '0.9rem' }}>No featured song set</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Vote History */}
          <div className="vote-history-section card" style={{ marginTop: '1.5rem' }}>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3><History size={20} /> Vote History</h3>
              {!votesLoading && !votesError && (
                <button className="btn btn-secondary btn-small" onClick={() => setShowVoteHistory(true)}>View Full History</button>
              )}
            </div>
            {votesLoading ? (
              <SectionLoader label="Loading vote history..." />
            ) : votesError ? (
              <SectionError message={votesError} onRetry={fetchVotes} />
            ) : (
              <div style={{ padding: '15px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--unis-primary)' }}>{voteHistory.length}</div>
                <p style={{ color: '#aaa', margin: '5px 0' }}>Total Votes Cast</p>
                <p style={{ fontSize: '0.9rem', color: '#777', marginTop: '10px' }}>
                  {voteHistory.length > 0 ? 'Keep voting to support the best talent!' : 'No votes yet. Go explore and support your favorites!'}
                </p>
              </div>
            )}
          </div>

          {/* Awards */}
          <div className="awards-section card" style={{ marginTop: '1.5rem' }}>
            <div className="section-header"><h3>🏆 Awards Won</h3></div>
            {awardsLoading ? (
              <SectionLoader label="Loading awards..." />
            ) : awardsError ? (
              <SectionError message={awardsError} onRetry={() => fetchAwards(user.userId)} />
            ) : (
              <div className="content-list">
                {awards.length > 0 ? (
                  <>
                    {awards.map((award, index) => (
                      <div key={index} className="content-item" style={{
                        background: 'linear-gradient(135deg, var(--unis-primary-subtle), rgba(0,0,0,0))',
                        borderLeft: '4px solid var(--unis-primary)'
                      }}>
                        <div className="item-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.5rem' }}>{getAwardEmoji(award.determinationMethod)}</span>
                            <div>
                              <h4 style={{ margin: 0, color: '#e0e0e0' }}>{award.interval?.name || 'Award'} Winner</h4>
                              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#aaa' }}>
                                {award.jurisdiction?.name || 'Location'}{award.genre?.name && ` • ${award.genre.name}`}
                              </p>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.85rem', color: '#888' }}>{formatAwardDate(award.awardDate)}</span>
                        </div>
                        <div className="item-stats" style={{ marginTop: '8px' }}>
                          <span style={{ color: 'var(--unis-primary)', fontWeight: '600' }}>{award.votesCount || 0} votes</span>
                          <span style={{ color: '#666' }}>•</span>
                          <span style={{ color: '#888' }}>{award.engagementScore || 0} score</span>
                          {award.determinationMethod && (
                            <>
                              <span style={{ color: '#666' }}>•</span>
                              <span style={{ color: '#6c757d', fontSize: '0.8rem', fontWeight: '500' }}>
                                Won by {award.determinationMethod.toLowerCase()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {hasMoreAwards && (
                      <div style={{ textAlign: 'center', padding: '15px' }}>
                        <button className="btn btn-secondary btn-small" onClick={loadMoreAwards} disabled={loadingMoreAwards} style={{ minWidth: '120px' }}>
                          {loadingMoreAwards ? 'Loading...' : 'Load More'}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#777' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🏆</div>
                    <p style={{ fontSize: '1.1rem', marginBottom: '5px' }}>No awards yet</p>
                    <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '10px' }}>Keep creating and engaging with your audience to earn awards!</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Referral Code — artist */}
          <ReferralCodeCard userId={user?.userId} isArtist={true} />

          {/* Theme Picker */}
          <ThemePicker userId={user?.userId} />

          {/* Danger Zone */}
          <div className="card" style={{ border: '2px solid #dc3545', marginTop: '3rem' }}>
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <h3 style={{ color: '#dc3545', marginBottom: '0.5rem' }}>Danger Zone</h3>
              <p style={{ color: '#721c24', marginBottom: '1rem' }}>Once you delete your account, there is no going back.</p>
              <button onClick={() => setShowChangePassword(true)}
                style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', marginRight: '12px' }}>
                Change Password
              </button>
              <button className="btn btn-primary" style={{ background: '#dc3545', border: 'none' }} onClick={() => setShowDeleteWizard(true)}>
                Delete Account
              </button>
            </div>
          </div>

        </div>

        {/* Wizards */}
        {showUploadWizard && <UploadWizard show={showUploadWizard} onClose={() => setShowUploadWizard(false)} onUploadSuccess={handleUploadSuccess} userProfile={userProfile} />}
        {showEditProfile && <EditProfileWizard show={showEditProfile} onClose={() => setShowEditProfile(false)} userProfile={userProfile} mode="profile" onSuccess={handleProfileUpdate} />}
        {showDefaultSongWizard && <ChangeDefaultSongWizard show={showDefaultSongWizard} onClose={() => setShowDefaultSongWizard(false)} songs={songs} currentDefaultSongId={defaultSong?.songId} onSuccess={() => refetchDefaultSong()} />}
        {showDeleteWizard && <DeleteAccountWizard show={showDeleteWizard} onClose={() => setShowDeleteWizard(false)} />}
        {editingSong && <EditSongWizard show={!!editingSong} onClose={() => setEditingSong(null)} song={editingSong} onSuccess={() => { apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get', useCache: false }).then(res => setSongs(res.data || [])); }} />}
        {showLyricsWizard && <LyricsWizard show={showLyricsWizard} onClose={() => { setShowLyricsWizard(false); setLyricsSong(null); }} song={lyricsSong} onSuccess={() => { apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get', useCache: false }).then(res => setSongs(res.data || [])); }} />}

        <VoteHistoryModal show={showVoteHistory} onClose={() => setShowVoteHistory(false)} votes={voteHistory} useDummyData={false} />
        <DeleteSongModal show={!!songToDelete} songTitle={songToDelete?.title} onConfirm={handleConfirmDelete} onCancel={() => setSongToDelete(null)} isDeleting={!!deletingSongId} />

        {editingLyricsSong && (
          <div className="modal-overlay" onClick={() => setEditingLyricsSong(null)}>
            <div className="modal-content lyrics-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit Lyrics — {editingLyricsSong.title}</h3>
                <button className="close-button" onClick={() => setEditingLyricsSong(null)}><X size={24} /></button>
              </div>
              <div className="modal-body">
                <textarea className="lyrics-textarea" value={currentLyrics} onChange={(e) => setCurrentLyrics(e.target.value)} rows={20} placeholder="Enter lyrics here..." />
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleSaveLyrics}>Save Lyrics</button>
                <button className="btn btn-secondary" onClick={() => setEditingLyricsSong(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <ChangePasswordWizard show={showChangePassword} onClose={() => setShowChangePassword(false)} />

      </div>
    </Layout>
  );
};

export default ArtistDashboard;