import React, { useState, useEffect } from 'react';
import { Upload, Play, Image, Video, Eye, Heart, Users, X, Download } from 'lucide-react';
import UploadWizard from './uploadWizard';
import ChangeDefaultSongWizard from './changeDefaultSongWizard'; 
import EditProfileWizard from './editProfileWizard';  
import DeleteAccountWizard from './deleteAccountWizard';
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
  const [videos, setVideos] = useState([]);
  const [showDefaultSongWizard, setShowDefaultSongWizard] = useState(false);
  const [showDeleteWizard, setShowDeleteWizard] = useState(false); 

  useEffect(() => {
    if (!authLoading && user?.userId) {
      // Full profile
      apiCall({ url: `/v1/users/profile/${user.userId}`, method: 'get' })
        .then(res => setUserProfile(res.data))
        .catch(err => console.error('Failed to fetch profile:', err));

      // Songs
      apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' })
        .then(res => setSongs(res.data || []))
        .catch(err => console.error('Failed to fetch songs:', err));

      // Videos
      apiCall({ url: `/v1/media/videos/artist/${user.userId}`, method: 'get' })
        .then(res => setVideos(res.data || []))
        .catch(err => console.error('Failed to fetch videos:', err));
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
  const defaultSong = userProfile.defaultSong;

  // Placeholder vote history
  const voteHistory = [
    'Voted for Artist X on Daily Rap',
    'Voted for Song Y on Weekly Pop'
  ];

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
      doc.text('UNIS ARTIST OWNERSHIP & REVENUE SHARE AGREEMENT', 40, 80, { align: 'center', maxWidth: 500 });

      // Subtitle
      doc.setFontSize(14);
      doc.setFont('helvetica', 'normal');
      doc.text('Empowering Independent Creators – You Own Your Music', 40, 120, { align: 'center', maxWidth: 500 });

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
      doc.text('Artist warrants ownership/control of rights and indemnifies Unis from claims. This Agreement is perpetual but terminable by Artist with 30 days notice.', 80, y);
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
      doc.text('Unis Music Platform – Empowering Harlem Creators Since 2025', 40, doc.internal.pageSize.height - 40, { align: 'center' });

      doc.save(`unis_ownership_agreement_${displayName.replace(/\s/g, '_')}.pdf`);
    };

  const handleUploadSuccess = () => {
    setShowUploadWizard(false);
    // Refetch songs
    apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' })
      .then(res => setSongs(res.data || []));
  };

  const handleProfileUpdate = () => {
    apiCall({ url: `/v1/users/profile/${user.userId}`, method: 'get' })
      .then(res => setUserProfile(res.data));
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
            <h1 style={{ alignSelf: "center" }}>Dashboard</h1>
            <p>Manage your content and track your performance</p>
          </div>


          <div className="profile-section card">
            <div className="profile-content">
              <img src={displayPhoto} alt={displayName} className="profile-image" />
              <div className="profile-info">
                <div className="profile-header">
                  <h2>{displayName}</h2> <br />
                  <button className="btn btn-primary" onClick={() => setShowEditProfile(true)}>
                    Edit Profile
                  </button>
                </div>
                <p className="bio">{displayBio}</p>
                <div className="profile-actions">
                  
                  <button className="btn btn-secondary" onClick={downloadOwnershipContract}>
                    <Download size={16} /> Download Ownership Contract
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Overview - Using real data where possible */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-info">
                  <p className="stat-label">Total Score</p>
                  <p className="stat-value">{(userProfile.score || 0).toLocaleString()}</p>
                </div>
                <div className="stat-icon stat-icon-blue"><Eye size={28} /></div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-info">
                  <p className="stat-label">Total Plays</p>
                  <p className="stat-value">
                    {songs.reduce((sum, s) => sum + (s.plays || 0), 0).toLocaleString()}
                  </p>
                </div>
                <div className="stat-icon stat-icon-red"><Heart size={28} /></div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="stat-info">
                  <p className="stat-label">Songs Uploaded</p>
                  <p className="stat-value">{songs.length}</p>
                </div>
                <div className="stat-icon stat-icon-green"><Users size={28} /></div>
              </div>
            </div>
          </div>

         

          {/* Main Featured Song */}
          <div className="main-song-section card">
            <div className="section-header">
              <h3>Main Featured Song</h3>
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

          {/* Songs & Videos Grid */}
          <div className="content-grid">
            {/* Songs */}
            <div className="content-section card">
              <div className="section-header">
                <h3><Play size={20} /> Your Songs</h3>
                <button className="btn btn-primary btn-small" onClick={() => setShowUploadWizard(true)}>
                  <Upload size={16} /> Upload
                </button>
              </div>
              <div className="content-list">
                {songs.length > 0 ? songs.map(song => (
                  <div key={song.songId} className="content-item">
                    <div className="item-header">
                      <h4>{song.title}</h4>
                      <button className="edit-button">Edit</button>
                    </div>
                    <div className="item-stats">
                      <span><Eye size={12} /> Score: {song.score || 0}</span>
                      <span><Heart size={12} /> {(song.duration / 60000).toFixed(1)} min</span>
                    </div>
                  </div>
                )) : <p>No songs yet — upload your first!</p>}
              </div>
            </div>

            {/* Videos */}
            <div className="content-section card">
              <div className="section-header">
                <h3><Video size={20} /> Your Videos</h3>
                <button className="btn btn-primary btn-small" onClick={() => setShowUploadWizard(true)}>
                  <Upload size={16} /> Upload
                </button>
              </div>
              <div className="content-list">
                {videos.length > 0 ? videos.map(video => (
                  <div key={video.videoId || video.songId} className="content-item">
                    <div className="item-header">
                      <h4>{video.title}</h4>
                      <button className="edit-button">Edit</button>
                    </div>
                    <div className="item-stats">
                      <span><Eye size={12} /> Score: {video.score || 0}</span>
                      <span><Heart size={12} /> {(video.duration / 60000).toFixed(1)} min</span>
                    </div>
                  </div>
                )) : <p>No videos yet.</p>}
              </div>
            </div>
          </div>

          {/* Images Gallery - temporarily using song artworks */}
          <div className="images-section card">
            <div className="section-header">
              <h3><Image size={20} /> Your Images</h3>
              <button className="btn btn-primary btn-small" onClick={() => setShowEditProfile(true)}>
                <Upload size={16} /> Upload
              </button>
            </div>
            <div className="images-grid">
              {songs.filter(s => s.artworkUrl).slice(0, 6).map((song, i) => (
                <div key={i} className="image-item">
                  <img src={`${API_BASE_URL}${song.artworkUrl}`} alt={song.title} />
                  <div className="image-overlay">
                    <div className="overlay-content">
                      <p><Eye size={14} /> {song.plays || 0} plays</p>
                      <button className="link-button">Manage</button>
                    </div>
                  </div>
                </div>
              ))}
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
          userProfile={userProfile}
          songs={songs}
          onSuccess={() => {
            //refetch after success
            apiCall({ url: `/v1/users/profile/${user.userId}`, method: 'get' })
              .then(res => setUserProfile(res.data));
          }}
        />
      )}

            {showDeleteWizard && (
        <DeleteAccountWizard
          show={showDeleteWizard}
          onClose={() => setShowDeleteWizard(false)}
        />
      )}

      </div>
    </Layout>
  );
};

export default ArtistDashboard;