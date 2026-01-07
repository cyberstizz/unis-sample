import React, { useState, useEffect } from 'react';
import { Upload, Play, Image, Video, Eye, Heart, Users, X, Download, Music, Trash2, Edit3 } from 'lucide-react';
import UploadWizard from './uploadWizard';
import ChangeDefaultSongWizard from './changeDefaultSongWizard';
import EditProfileWizard from './editProfileWizard';
import DeleteAccountWizard from './deleteAccountWizard';
import EditSongWizard from './editSongWizard';
import DeleteSongModal from './deleteSongModal';
import './artistDashboard.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { jsPDF } from 'jspdf';  

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const ArtistDashboard = () => {
  const [userProfile, setUserProfile] = useState(null);
  const { user, loading: authLoading } = useAuth();
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

  useEffect(() => {
    if (!authLoading && user?.userId) {
      // Full profile
      apiCall({ url: `/v1/users/profile/${user.userId}`, method: 'get' })
        .then(res => {
          setUserProfile(res.data);
          console.log('User profile loaded:', res.data);
          console.log('Default song:', res.data.defaultSong);
        })
        .catch(err => console.error('Failed to fetch profile:', err));

      // Songs
      apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' })
        .then(res => {
          const songsData = res.data || [];
          setSongs(songsData);
          // Calculate total plays
          const plays = songsData.reduce((sum, s) => sum + (s.plays || 0), 0);
          setTotalPlays(plays);
        })
        .catch(err => console.error('Failed to fetch songs:', err));

      // Fetch supporters count
      apiCall({ url: `/v1/users/${user.userId}/supporters/count`, method: 'get' })
        .then(res => setSupporters(res.data.count || 0))
        .catch(err => console.error('Failed to fetch supporters:', err));

      // Fetch followers count (if endpoint exists)
      apiCall({ url: `/v1/users/${user.userId}/followers/count`, method: 'get' })
        .then(res => setFollowers(res.data.count || 0))
        .catch(err => {
          console.warn('Followers endpoint not available, using 0');
          setFollowers(0);
        });

      // Fetch default song separately (more reliable than profile.defaultSong)
      apiCall({ url: `/v1/users/${user.userId}/default-song`, method: 'get' })
        .then(res => {
          console.log('Default song loaded:', res.data);
          setDefaultSong(res.data);
        })
        .catch(err => {
          console.warn('No default song set yet');
          setDefaultSong(null);
        });
    }
  }, [user, authLoading]);

  if (authLoading) return <div>Loading...</div>;
  if (!user) return <div>Please log in to view dashboard.</div>;
  if (!userProfile) return <div>Loading your profile...</div>;

  // FROM userProfile
  const displayName = userProfile.username || 'Artist';
  const displayPhoto = userProfile.photoUrl
    ? `${API_BASE_URL}${userProfile.photoUrl}`
    : backimage;
  const displayBio = userProfile.bio || 'No bio yet. Click Edit to add one.';

  // Helper to refetch default song
  const refetchDefaultSong = () => {
    apiCall({ url: `/v1/users/${user.userId}/default-song`, method: 'get' })
      .then(res => setDefaultSong(res.data))
      .catch(() => setDefaultSong(null));
  };

  const downloadOwnershipContract = () => {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      // Watermark (faint UNIS diagonal)
      doc.setTextColor(240, 240, 240);  // Light gray
      doc.setFontSize(80);
      doc.setFont('helvetica', 'bold');
      for (let i = 0; i < 10; i++) {
        doc.text('UNIS', 100 + i*100, 200 + i*80, { angle: 45 });
      }

      // Reset color
      doc.setTextColor(0, 0, 0);

      // Title
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('UNIS ARTIST OWNERSHIP & REVENUE SHARE AGREEMENT', 40, 80, { textAlign: 'center', maxWidth: 500 });

    
      // Parties & Date
      doc.setFontSize(12);
      doc.text(`This Agreement is entered into as of ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 60, 180);
      doc.text('Between:', 60, 220);
      doc.text('UNIS MUSIC PLATFORM ("Unis"), a digital music discovery service,', 80, 240);
      doc.text('and', 80, 260);
      doc.text(`${displayName} ("Artist"), an independent creator.`, 80, 280);

      // Recitals (Legal Feel)
      doc.setFontSize(11);
      let y = 320;
      doc.text('WHEREAS, Artist is the sole owner of certain sound recordings and musical compositions;', 60, y);
      y += 20;
      doc.text('WHEREAS, Artist desires to make such works available on Unis for discovery and monetization;', 60, y);
      y += 20;
      doc.text('WHEREAS, Unis desires to promote independent Harlem talent while ensuring Artist retains full ownership;', 60, y);
      y += 40;

      // Section 1: Grant of License
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('1. Grant of Non-Exclusive License', 60, y);
      y += 20;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const licenseText = 'Artist hereby grants Unis a non-exclusive, royalty-free, worldwide license to reproduce, distribute, publicly perform, publicly display, and otherwise use the Uploaded Works (as defined below) on the Unis platform and associated services, including for promotional and advertising purposes.';
      doc.text(doc.splitTextToSize(licenseText, 480), 80, y);
      y += 80;

      // Section 2: Ownership
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('2. Ownership Retained by Artist', 60, y);
      y += 20;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const ownText = 'Artist retains 100% ownership of all rights in the sound recordings (masters) and underlying musical compositions (publishing). This Agreement does not transfer any ownership rights to Unis. Artist may exploit the Uploaded Works elsewhere without restriction.';
      doc.text(doc.splitTextToSize(ownText, 480), 80, y);
      y += 80;

      // Section 3: Revenue Share
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('3. Revenue Share', 60, y);
      y += 20;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const revText = 'Unis shall pay Artist 50% of Net Advertising Revenue attributable to streams/views of Uploaded Works. "Net Advertising Revenue" means gross revenue from advertisements minus platform costs, taxes, and compulsory royalties paid to performing rights organizations and mechanical licensing collectives.';
      doc.text(doc.splitTextToSize(revText, 480), 80, y);
      y += 80;

      // Section 4: Uploaded Works
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('4. Uploaded Works', 60, y);
      y += 20;
      doc.setFontSize(11);
      if (songs.length > 0) {
        doc.text('The following works are covered under this Agreement:', 80, y);
        y += 20;
        songs.forEach((song, i) => {
          doc.text(`${i+1}. "${song.title}" (Uploaded ${new Date(song.createdAt || Date.now()).toLocaleDateString()})`, 100, y);
          y += 20;
          if (y > 700) { doc.addPage(); y = 60; }  // New page if long
        });
      } else {
        doc.text('No works uploaded yet—all future uploads covered.', 80, y);
      }
      y += 40;

      // Section 5: Warranties & Termination
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('5. Artist Warranties & Termination', 60, y);
      y += 20;
      doc.setFontSize(11);
      doc.text('Artist warrants ownership/control of rights and indemnifies Unis from claims.', 80, y);
      y += 80;
      doc.text('This Agreement is perpetual but terminable by Artist with 30 days notice.', 80, y)
      y += 80;
      // Signature
      doc.setFontSize(12);
      doc.text('AGREED AND ACCEPTED:', 60, y);
      y += 40;
      doc.text(`Artist: ${displayName}`, 80, y);
      y += 20;
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 80, y);
      y += 60;
      doc.text('___________________________________', 80, y);
      y += 20;
      doc.text('Artist Signature (Typed Name)', 80, y);

      // Footer
      doc.setFontSize(10);
      doc.text('Unis Music Platform – Since 2025', 40, doc.internal.pageSize.height - 40, { align: 'center' });

      doc.save(`unis_ownership_agreement_${displayName.replace(/\s/g, '_')}.pdf`);
    };

  const handleUploadSuccess = () => {
    setShowUploadWizard(false);
    // Refetch songs
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
      // Refresh profile
      handleProfileUpdate();
      alert(`${platform} link updated successfully!`);
    } catch (err) {
      console.error('Failed to update social media:', err);
      alert('Failed to update link');
    }
  };

  const handleDeleteSongClick = (song) => {
    // Prevent deletion if it's the only song
    if (songs.length <= 1) {
      alert('You must have at least one song. Upload another song before deleting this one.');
      return;
    }

    // If this is the default/featured song, force user to change it first
    if (defaultSong?.songId === song.songId) {
      alert('This is your featured song. Please change your featured song before deleting it.');
      setShowDefaultSongWizard(true);
      return;
    }

    // Show the delete confirmation modal
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
      // Refresh songs list (plays count remains unchanged - historical data)
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

  return (
    <Layout backgroundImage={backimage}>
      <div className="artist-dashboard">

        {/* Welcome Popup */}
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

          {/* Header */}
          <div className="dashboard-header">
            <h1 className='dasboardh1'>Dashboard</h1>
          </div>

          <div className="profile-section card">
            <div className="profile-content">
              <img src={displayPhoto} alt={displayName} className="profile-image profile-image-bordered" />
              <div className="profile-info">
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

          {/* Stats Overview - Updated with real data */}
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
                    <span><Eye size={14} /> {defaultSong.plays || 0} plays</span>
                    <span><Heart size={14} /> {defaultSong.likes || 0} likes</span>
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
                      <button
                        className="edit-button"
                        onClick={() => setEditingSong(song)}
                        title="Edit song"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteSongClick(song)}
                        disabled={deletingSongId === song.songId}
                        title="Delete song"
                      >
                        {deletingSongId === song.songId ? '...' : <Trash2 size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="item-stats">
                    <span><Eye size={12} /> Score: {song.score || 0}</span>
                    <span><Heart size={12} /> {(song.duration / 60000).toFixed(1)} min</span>
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
            onSuccess={handleProfileUpdate}
          />
        )}

        {showDefaultSongWizard && (
          <ChangeDefaultSongWizard
            show={showDefaultSongWizard}
            onClose={() => setShowDefaultSongWizard(false)}
            songs={songs}
            currentDefaultSongId={defaultSong?.songId}
            onSuccess={() => {
              refetchDefaultSong();
            }}
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
              // Refresh songs list
              apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' })
                .then(res => setSongs(res.data || []));
            }}
          />
        )}

        <DeleteSongModal
          show={!!songToDelete}
          songTitle={songToDelete?.title}
          onConfirm={handleConfirmDelete}
          onCancel={() => setSongToDelete(null)}
          isDeleting={!!deletingSongId}
        />

      </div>
    </Layout>
  );
};

export default ArtistDashboard;