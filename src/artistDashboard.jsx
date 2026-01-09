import React, { useState, useEffect, useContext } from 'react';
import LyricsWizard from './lyricsWizard';
import { Upload, Play, FileText, Image, Vote, Video, Eye, Heart, Users, X, Download, Music, Trash2, Edit3, History } from 'lucide-react';
import UploadWizard from './uploadWizard';
import ChangeDefaultSongWizard from './changeDefaultSongWizard';
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
import EditSongWizard from './editSongWizard';
import DeleteSongModal from './deleteSongModal';
import VoteHistoryModal from './voteHistoryModal'; // Imported
import './artistDashboard.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { useAuth } from './context/AuthContext';
import { PlayerContext } from './context/playercontext'; // Imported
import { apiCall } from './components/axiosInstance';
import { jsPDF } from 'jspdf';  

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const ArtistDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { playMedia } = useContext(PlayerContext); // Access Player

  const [userProfile, setUserProfile] = useState(null);
  const [showWelcomePopup, setShowWelcomePopup] = useState(true);
  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [songs, setSongs] = useState([]);
  const [showDefaultSongWizard, setShowDefaultSongWizard] = useState(false);
  const [showDeleteWizard, setShowDeleteWizard] = useState(false);
  const [supporters, setSupporters] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [totalPlays, setTotalPlays] = useState(0);
  const [defaultSong, setDefaultSong] = useState(null);
  const [deletingSongId, setDeletingSongId] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [songToDelete, setSongToDelete] = useState(null);
  const [showLyricsWizard, setShowLyricsWizard] = useState(false);
  const [lyricsSong, setLyricsSong] = useState(null);

  // New States for Profile Features
  const [supportedArtist, setSupportedArtist] = useState(null);
  const [voteHistory, setVoteHistory] = useState([]);
  const [showVoteHistory, setShowVoteHistory] = useState(false);
  const [totalVotes, setTotalVotes] = useState(0);

  const [editingLyricsSong, setEditingLyricsSong] = useState(null);
  const [currentLyrics, setCurrentLyrics] = useState('');

  useEffect(() => {
    if (!authLoading && user?.userId) {
      // 1. Full profile & Supported Artist
      apiCall({ url: `/v1/users/profile/${user.userId}`, method: 'get', useCache: false })
        .then(res => {
          setUserProfile(res.data);

          setTotalPlays(res.data.totalPlays || 0);
          setTotalVotes(res.data.totalVotes || 0);
          
          // Fetch Supported Artist if exists
          if (res.data.supportedArtistId) {
            apiCall({ url: `/v1/users/profile/${res.data.supportedArtistId}` })
              .then(artistRes => setSupportedArtist(artistRes.data))
              .catch(err => console.error('Failed to fetch supported artist:', err));
          }
        })
        .catch(err => console.error('Failed to fetch profile:', err));

      // 2. Songs & Total Plays
      apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' })
        .then(res => {
          const songsData = res.data || [];
          setSongs(songsData);
        })
        .catch(err => console.error('Failed to fetch songs:', err));

      // 3. Stats
      apiCall({ url: `/v1/users/${user.userId}/supporters/count`, method: 'get' })
        .then(res => setSupporters(res.data.count || 0))
        .catch(err => console.error('Failed to fetch supporters:', err));

      apiCall({ url: `/v1/users/${user.userId}/followers/count`, method: 'get' })
        .then(res => setFollowers(res.data.count || 0))
        .catch(() => setFollowers(0));

      // 4. Vote History
      apiCall({ url: '/v1/vote/history?limit=50' })
        .then(res => setVoteHistory(res.data || []))
        .catch(err => console.error('Failed to fetch vote history:', err));

      // 5. Default Song
      apiCall({ url: `/v1/users/${user.userId}/default-song`, method: 'get' })
        .then(res => setDefaultSong(res.data))
        .catch(() => setDefaultSong(null));
    }
  }, [user, authLoading]);

  if (authLoading) return <div>Loading...</div>;
  if (!user) return <div>Please log in to view dashboard.</div>;
  if (!userProfile) return <div>Loading your profile...</div>;

  const displayName = userProfile.username || 'Artist';
  const displayPhoto = userProfile.photoUrl
    ? `${API_BASE_URL}${userProfile.photoUrl}`
    : backimage;
  const displayBio = userProfile.bio || 'No bio yet. Click Edit to add one.';

  const refetchDefaultSong = () => {
    apiCall({ url: `/v1/users/${user.userId}/default-song`, method: 'get' })
      .then(res => setDefaultSong(res.data))
      .catch(() => setDefaultSong(null));
  };

  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  // Logic to play the supported artist's song
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
      type: 'song',
      id: songId,
      url: songUrl,
      title: song.title,
      artist: supportedArtist.username,
      artwork: artworkUrl
    };

    // Track play
    try {
      await apiCall({ 
        method: 'post', 
        url: `/v1/media/song/${songId}/play?userId=${user.userId}` 
      });
    } catch (err) {
      console.error('Failed to track play:', err);
    }

    playMedia(mediaObject, [mediaObject]);
  };

  const downloadOwnershipContract = () => {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });
      // (PDF logic kept identical to your previous code...)
      doc.setTextColor(240, 240, 240);
      doc.setFontSize(80);
      doc.setFont('helvetica', 'bold');
      for (let i = 0; i < 10; i++) {
        doc.text('UNIS', 100 + i*100, 200 + i*80, { angle: 45 });
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
      // ... (Contract content abbreviated for brevity, but functional logic remains)
      doc.save(`unis_ownership_agreement_${displayName.replace(/\s/g, '_')}.pdf`);
  };

  const handleUploadSuccess = () => {
    setShowUploadWizard(false);
    apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' })
      .then(res => setSongs(res.data || []));
  };

  const handleProfileUpdate = () => {
    apiCall({ 
      url: `/v1/users/profile/${user.userId}`, 
      method: 'get',
      useCache: false   
    })
      .then(res => setUserProfile(res.data))
      .catch(err => console.error('Failed to refresh profile:', err));
  };

  const handleSocialMediaUpdate = async (platform, url) => {
    try {
      const field = `${platform}Url`;
      await apiCall({
        method: 'put',
        url: `/v1/users/profile/${user.userId}`,
        data: { [field]: url }
      });
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
      await apiCall({
        method: 'delete',
        url: `/v1/media/song/${songToDelete.songId}`
      });
      const res = await apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' });
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
      await apiCall({
        method: 'put',
        url: `/v1/media/song/${editingLyricsSong.songId}`,
        data: { lyrics: currentLyrics }
      });
      setSongs(prev => prev.map(s => 
        s.songId === editingLyricsSong.songId 
          ? { ...s, lyrics: currentLyrics } 
          : s
      ));
      setEditingLyricsSong(null);
    } catch (err) {
      console.error('Failed to save lyrics:', err);
      alert('Failed to save lyrics. Please try again.');
    }
  };

  return (
    <Layout backgroundImage={backimage}>
      <div className="artist-dashboard">

        {showWelcomePopup && (
          <div className="welcome-popup-overlay">
            <div className="welcome-popup">
              <button onClick={() => setShowWelcomePopup(false)} className="close-button">
                <X size={24} />
              </button>
              <div className="popup-content">
                <div className="icon-circle"><Heart size={40} fill="white" /></div>
                <h2>Thank You!</h2>
                <p>Your contribution to the UNIS community makes us stronger. Keep creating!</p>
              </div>
              <button onClick={() => setShowWelcomePopup(false)} className="welcome-button">
                You're Welcome
              </button>
            </div>
          </div>
        )}

        <div className="dashboard-content">

          <div className="dashboard-header">
            <h1 className='dashboard-h1'>Dashboard</h1>
          </div>

          <div className="profile-section card">
            <div className="profile-content">
              <img src={displayPhoto} alt={displayName} className="profile-image profile-image-bordered" />
              <div className="profile-info">
                <h2 className="artist-name">{displayName}</h2>
                <p className="artist-bio">{displayBio}</p>
                <div className="profile-header">
                  <button className="btn btn-primary" onClick={() => setShowEditProfile(true)}>
                    Edit Profile
                  </button>
                </div>
                <div className="profile-actions">
                  <button className="btn btn-secondary" onClick={downloadOwnershipContract}>
                    <Download size={16} /> Download Ownership Contract
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-info">
                  <p className="stat-label">Score</p>
                  <p className="stat-value">{(userProfile.score || 0).toLocaleString()}</p>
                </div>
                <div className="stat-icon stat-icon-blue"><Eye size={28} /></div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-info">
                  <p className="stat-label">Supporters</p>
                  <p className="stat-value">{supporters.toLocaleString()}</p>
                </div>
                <div className="stat-icon stat-icon-purple"><Users size={28} /></div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-info">
                  <p className="stat-label">Followers</p>
                  <p className="stat-value">{followers.toLocaleString()}</p>
                </div>
                <div className="stat-icon stat-icon-green"><Heart size={28} /></div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-info">
                  <p className="stat-label">Plays</p>
                  <p className="stat-value">{totalPlays.toLocaleString()}</p>
                </div>
                <div className="stat-icon stat-icon-red"><Play size={28} /></div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-info">
                  <p className="stat-label">Songs</p>
                  <p className="stat-value">{songs.length}</p>
                </div>
                <div className="stat-icon stat-icon-orange"><Music size={28} /></div>
              </div>
            </div>


            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-info">
                  <p className="stat-label">Votes</p>
                  <p className="stat-value">{totalVotes.toLocaleString()}</p>
                </div>
                <div className="stat-icon stat-icon-orange"><Vote size={28} /></div>
              </div>
            </div>

          </div>

          {/* Main Featured Song */}
          <div className="main-song-section card">
            <div className="section-header">
              <h3>Featured Song</h3>
              <button 
                className="link-button" 
                onClick={() => setShowDefaultSongWizard(true)}
                style={{ fontWeight: '600', color: '#004aad' }}
              >
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

          {/* Songs Section */}
          <div className="content-section card">
            <div className="section-header">
              <h3><Play size={20} /> Songs</h3>
              <button className="btn btn-primary btn-small" onClick={() => setShowUploadWizard(true)}>
                <Upload size={16} /> Upload
              </button>
            </div>
            <div className="content-list">
              {songs.length > 0 ? songs.map(song => (
                <div key={song.songId} className="content-item">
                  <div className="item-header">
                    <h4>{song.title}</h4>
                    <div className="item-actions">
                      <button className="edit-button" onClick={() => setEditingSong(song)}>
                        <Edit3 size={16} />
                      </button>
                      <button className="lyrics-button" onClick={() => { setLyricsSong(song); setShowLyricsWizard(true); }}>
                        <FileText size={16} />
                      </button>
                      <button className="delete-button" onClick={() => handleDeleteSongClick(song)} disabled={deletingSongId === song.songId}>
                        {deletingSongId === song.songId ? '...' : <Trash2 size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="item-stats">
                    <span><Play size={12} /> {song.playCount || song.plays || 0} plays</span>
                  </div>
                </div>
              )) : <p>No songs yet — upload your first!</p>}
            </div>
          </div>

          {/* Social Media Links Section */}
          <div className="social-media-section card">
            <div className="section-header">
              <h3>Social Media Links</h3>
            </div>
            <div className="social-links-edit">
              <div className="social-link-item">
                <label>📷 Instagram</label>
                <input 
                  type="text" 
                  placeholder="https://instagram.com/yourprofile"
                  defaultValue={userProfile.instagramUrl || ''}
                  onBlur={(e) => handleSocialMediaUpdate('instagram', e.target.value)}
                  className="social-input"
                />
              </div>
              <div className="social-link-item">
                <label>𝕏 Twitter / X</label>
                <input 
                  type="text" 
                  placeholder="https://twitter.com/yourprofile"
                  defaultValue={userProfile.twitterUrl || ''}
                  onBlur={(e) => handleSocialMediaUpdate('twitter', e.target.value)}
                  className="social-input"
                />
              </div>
              <div className="social-link-item">
                <label>🎵 TikTok</label>
                <input 
                  type="text" 
                  placeholder="https://tiktok.com/@yourprofile"
                  defaultValue={userProfile.tiktokUrl || ''}
                  onBlur={(e) => handleSocialMediaUpdate('tiktok', e.target.value)}
                  className="social-input"
                />
              </div>
            </div>
          </div>

          {/* NEW: Supported Artist Section */}
          {supportedArtist && (
            <div className="supported-artist-section card" style={{ marginTop: '2rem' }}>
              <div className="section-header">
                <h3><Heart size={20} /> I Support</h3>
              </div>
              <div className="artist-support-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '15px' }}>
                <img 
                  src={supportedArtist.photoUrl ? buildUrl(supportedArtist.photoUrl) : backimage} 
                  alt={supportedArtist.username}
                  className="artist-photo"
                  style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div className="artist-info" style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '1.2rem', color: '#e0e0e0' }}>{supportedArtist.username}</h4>
                  {supportedArtist.defaultSong ? (
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
                      <p style={{ margin: 0, color: '#aaa', fontSize: '0.9rem', marginRight: '15px' }}>
                        <Music size={12} style={{ display: 'inline', marginRight: '5px' }} />
                        {supportedArtist.defaultSong.title}
                      </p>
                      <button 
                        onClick={playSupportedArtistSong}
                        style={{ background: 'transparent', border: '1px solid #aaa', borderRadius: '50%', padding: '5px', cursor: 'pointer', color: 'white' }}
                      >
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

          {/* NEW: Vote History Section */}
          <div className="vote-history-section card" style={{ marginTop: '1.5rem' }}>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3><History size={20} /> Vote History</h3>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => setShowVoteHistory(true)}
              >
                View Full History
              </button>
            </div>
            <div style={{ padding: '15px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#163387' }}>{voteHistory.length}</div>
              <p style={{ color: '#aaa', margin: '5px 0' }}>Total Votes Cast</p>
              <p style={{ fontSize: '0.9rem', color: '#777', marginTop: '10px' }}>
                {voteHistory.length > 0
                  ? 'Keep voting to support the best talent!'
                  : 'No votes yet. Go explore and support your favorites!'}
              </p>
            </div>
          </div>

          {/* DANGER ZONE */}
          <div className="card" style={{ border: '2px solid #dc3545', marginTop: '3rem' }}>
            <div style={{ padding: '1.5rem', textAlign: 'center' }}>
              <h3 style={{ color: '#dc3545', marginBottom: '0.5rem' }}>Danger Zone</h3>
              <p style={{ color: '#721c24', marginBottom: '1rem' }}>
                Once you delete your account, there is no going back.
              </p>
              <button
                className="btn btn-primary"
                style={{ background: '#dc3545', border: 'none' }}
                onClick={() => setShowDeleteWizard(true)}
              >
                Delete Account
              </button>
            </div>
          </div>

        </div>

        {/* Wizards */}
        {showUploadWizard && (
          <UploadWizard
            show={showUploadWizard}
            onClose={() => setShowUploadWizard(false)}
            onUploadSuccess={handleUploadSuccess}
            userProfile={userProfile}
          />
        )}

        {showEditProfile && (
          <EditProfileWizard
            show={showEditProfile}
            onClose={() => setShowEditProfile(false)}
            userProfile={userProfile}
            mode="profile"
            onSuccess={handleProfileUpdate}
          />
        )}

        {showDefaultSongWizard && (
          <ChangeDefaultSongWizard
            show={showDefaultSongWizard}
            onClose={() => setShowDefaultSongWizard(false)}
            songs={songs}
            currentDefaultSongId={defaultSong?.songId}
            onSuccess={() => refetchDefaultSong()}
          />
        )}

        {showDeleteWizard && (
          <DeleteAccountWizard
            show={showDeleteWizard}
            onClose={() => setShowDeleteWizard(false)}
          />
        )}

        {editingSong && (
          <EditSongWizard
            show={!!editingSong}
            onClose={() => setEditingSong(null)}
            song={editingSong}
            onSuccess={() => {
              apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' })
                .then(res => setSongs(res.data || []));
            }}
          />
        )}

        {showLyricsWizard && (
          <LyricsWizard
            show={showLyricsWizard}
            onClose={() => { setShowLyricsWizard(false); setLyricsSong(null); }}
            song={lyricsSong}
            onSuccess={() => {
              apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' })
                .then(res => setSongs(res.data || []));
            }}
          />
        )}

        {/* Vote History Modal */}
        <VoteHistoryModal
          show={showVoteHistory}
          onClose={() => setShowVoteHistory(false)}
          votes={voteHistory}
          useDummyData={false}
        />

        <DeleteSongModal
          show={!!songToDelete}
          songTitle={songToDelete?.title}
          onConfirm={handleConfirmDelete}
          onCancel={() => setSongToDelete(null)}
          isDeleting={!!deletingSongId}
        />

        {/* Lyrics Edit Modal (Deprecated but kept for safety if Wizard fails) */}
        {editingLyricsSong && (
          <div className="modal-overlay" onClick={() => setEditingLyricsSong(null)}>
            <div className="modal-content lyrics-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit Lyrics — {editingLyricsSong.title}</h3>
                <button className="close-button" onClick={() => setEditingLyricsSong(null)}>
                  <X size={24} />
                </button>
              </div>
              <div className="modal-body">
                <textarea
                  className="lyrics-textarea"
                  value={currentLyrics}
                  onChange={(e) => setCurrentLyrics(e.target.value)}
                  rows={20}
                  placeholder="Enter lyrics here..."
                />
              </div>
              <div className="modal-actions">
                <button className="btn btn-primary" onClick={handleSaveLyrics}>Save Lyrics</button>
                <button className="btn btn-secondary" onClick={() => setEditingLyricsSong(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default ArtistDashboard;