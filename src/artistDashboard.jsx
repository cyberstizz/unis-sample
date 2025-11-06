import React, { useState, useEffect } from 'react';
import { Upload, Play, Image, Video, TrendingUp, Eye, Heart, Users, X } from 'lucide-react';
import UploadWizard from './UploadWizard';  
import './artistDashboard.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance'; 

const ArtistDashboard = () => {
  const [userProfile, setUserProfile] = useState(null);
  const { user, loading } = useAuth();
  const [showWelcomePopup, setShowWelcomePopup] = useState(true);
  const [showUploadWizard, setShowUploadWizard] = useState(false);  
  const [songs, setSongs] = useState([]);  
  const [videos, setVideos] = useState([]);  

  useEffect(() => {
    if (!loading && user) {
      setUserProfile(user);  
      // NEW: Fetch artist's songs/videos on load (use user.userId as artistId)
      if (user.userId) {
        apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' })
          .then(res => setSongs(res.data || []))
          .catch(err => console.error('Failed to fetch songs:', err));

        // Optional: Fetch videos too
        apiCall({ url: `/v1/media/videos/artist/${user.userId}`, method: 'get' })
          .then(res => setVideos(res.data || []))
          .catch(err => console.error('Failed to fetch videos:', err));
      }
    } else if (!loading && !user) {
      // Optional: Redirect to login
      window.location.href = '/login';
    }
  }, [user, loading]);

  console.log('Dashboard userProfile:', userProfile); 

  if (loading) {
    return <div>Loading profile...</div>;  // Guard render
  }

  if (!user) {
    return <div>Please log in to view dashboard.</div>;
  }

  // Placeholder data (keep for other sections)
  const profileData = {
    name: 'User Name',
    voteHistory: ['Voted for Artist X on Daily Rap', 'Voted for Song Y on Weekly Pop'],
    supportedArtists: ['Artist A', 'Artist B'], // For listeners
    stats: { playsDaily: 100, playsWeekly: 500, supporters: 250, trends: 'Up 20%' } ,
    messaging: 'Open', // Options for artists
    revenue: '$XXX forecast',
  };

  // Mock artist data - replace with actual data (keep for profile/main song)
  const artistData = {
    name: "Tony Fadd",
    profileImage: backimage,
    bio: "Creating unique sounds that blend electronic and acoustic elements. Inspired by life, love, and the pursuit of perfect harmony.",
    mainSong: {
      title: "Paranoid",
      views: 15420,
      likes: 892
    },
    totalViews: 45230,
    supporters: 3421,
    followers: 1823,
    images: [
      { id: 1, url: backimage, views: 2340 },
      { id: 2, url: backimage, views: 1890 },
      { id: 3, url: backimage, views: 1567 }
    ]
  };

  // Add: Placeholder for upload success (no-op for now)
  const handleUploadSuccess = (newMedia) => {
    console.log('Uploaded:', newMedia);  // Test log—add refresh later (refetch songs?)
    setShowUploadWizard(false);
    // Optional: Refetch songs to include new one
    if (newMedia && user.userId) {
      apiCall({ url: `/v1/media/songs/artist/${user.userId}`, method: 'get' })
        .then(res => setSongs(res.data || []));
    }
  };

  return (
    <Layout backgroundImage={backimage}>
    <div className="artist-dashboard">
      {/* Welcome Popup */}
      {showWelcomePopup && (
        <div className="welcome-popup-overlay">
          <div className="welcome-popup">
            <button 
              onClick={() => setShowWelcomePopup(false)}
              className="close-button"
            >
              <X size={24} />
            </button>
            <div className="popup-content">
              <div className="icon-circle">
                <Heart size={40} fill="white" />
              </div>
              <h2>Thank You!</h2>
              <p>
                Your contribution to the UNIS community makes us stronger. Keep creating amazing content!
              </p>
            </div>
            <button
              onClick={() => setShowWelcomePopup(false)}
              className="welcome-button"
            >
              You're Welcome
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard Content */}
      <div className="dashboard-content">
        {/* Header Section */}
        <div className="dashboard-header">
          <h1 style={{alignSelf: "center"}}>Dashboard</h1>
          <p>Manage your content and track your performance</p>
        </div>

        {/* Stats Overview */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-info">
                <p className="stat-label">Total Votes</p>
                <p className="stat-value">{artistData.totalViews.toLocaleString()}</p>
              </div>
              <div className="stat-icon stat-icon-blue">
                <Eye size={28} />
              </div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-info">
                <p className="stat-label">Supporters</p>
                <p className="stat-value">{artistData.supporters.toLocaleString()}</p>
              </div>
              <div className="stat-icon stat-icon-red">
                <Heart size={28} />
              </div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-info">
                <p className="stat-label">Total Plays</p>
                <p className="stat-value">{artistData.followers.toLocaleString()}</p>
              </div>
              <div className="stat-icon stat-icon-green">
                <Users size={28} />
              </div>
            </div>
          </div>
        </div>

        {/* Artist Profile Section */}
        <div className="profile-section card">
          <div className="profile-content">
            <img 
              src={artistData.profileImage} 
              alt={artistData.name}
              className="profile-image"
            />
            <div className="profile-info">
              <div className="profile-header">
                <h2>{artistData.name}</h2>
                <button className="btn btn-primary">Edit Profile</button>
              </div>
              <p className="bio">{artistData.bio}</p>
              <div className="profile-actions">
                <button className="btn btn-secondary" onClick={() => setShowUploadWizard(true)}>  {/* Add: Wire upload */}
                  <Upload size={16} />
                  Update Photo
                </button>
                <button className="btn btn-secondary">
                  Edit Bio
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* makeshift bio section to be edited*/}

      <section className="vote-history">
        <h2>Vote History</h2>
        <ul>
          {profileData.voteHistory.map((vote, index) => <li key={index}>{vote}</li>)}
        </ul>
      </section>

        {/* Main Song Section */}
        <div className="main-song-section card">
          <div className="section-header">
            <h3>Main Featured Song</h3>
            <button className="link-button">Change Featured</button>
          </div>
          <div className="main-song-card">
            <div className="song-icon">
              <Play size={28} fill="white" />
            </div>
            <div className="song-info">
              <h4>{artistData.mainSong.title}</h4>
              <div className="song-stats">
                <span>
                  <Eye size={14} />
                  {artistData.mainSong.views.toLocaleString()} views
                </span>
                <span>
                  <Heart size={14} />
                  {artistData.mainSong.likes.toLocaleString()} likes
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Management Grid */}
        <div className="content-grid">
          {/* Songs Analytics */}
          <div className="content-section card">
            <div className="section-header">
              <h3>
                <Play size={20} />
                Your Songs
              </h3>
              <button className="btn btn-primary btn-small" onClick={() => setShowUploadWizard(true)}>  {/* Add: Wire upload */}
                <Upload size={16} />
                Upload
              </button>
            </div>
            <div className="content-list">
              {/* FIXED: Map over real songs (title + score as proxy for "views/likes") */}
              {songs.length > 0 ? (
                songs.map((song) => (
                  <div key={song.songId} className="content-item">
                    <div className="item-header">
                      <h4>{song.title}</h4>
                      <button className="edit-button">Edit</button>
                    </div>
                    <div className="item-stats">
                      <span>
                        <Eye size={12} />
                        Score: {song.score || 0}
                      </span>
                      <span>
                        <Heart size={12} />
                        Duration: {(song.duration / 1000 / 60).toFixed(1)} min
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p>No songs yet—upload your first!</p>
              )}
            </div>
          </div>

          {/* Videos Section */}
          <div className="content-section card">
            <div className="section-header">
              <h3>
                <Video size={20} />
                Your Videos
              </h3>
              <button className="btn btn-primary btn-small" onClick={() => setShowUploadWizard(true)}>  {/* Add: Wire upload */}
                <Upload size={16} />
                Upload
              </button>
            </div>
            <div className="content-list">
              {/* NEW: Map over real videos (symmetric to songs) */}
              {videos.length > 0 ? (
                videos.map((video) => (
                  <div key={video.videoId} className="content-item">
                    <div className="item-header">
                      <h4>{video.title}</h4>
                      <button className="edit-button">Edit</button>
                    </div>
                    <div className="item-stats">
                      <span>
                        <Eye size={12} />
                        Score: {video.score || 0}
                      </span>
                      <span>
                        <Heart size={12} />
                        Duration: {(video.duration / 1000 / 60).toFixed(1)} min
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p>No videos yet—upload your first!</p>
              )}
            </div>
          </div>
        </div>

        {/* Images Gallery */}
        <div className="images-section card">
          <div className="section-header">
            <h3>
              <Image size={20} />
              Your Images
            </h3>
            <button className="btn btn-primary btn-small" onClick={() => setShowUploadWizard(true)}>  {/* Add: Wire upload */}
              <Upload size={16} />
              Upload
            </button>
          </div>
          <div className="images-grid">
            {artistData.images.map((image) => (
              <div key={image.id} className="image-item">
                <img 
                  src={image.url} 
                  alt="Artist content"
                />
                <div className="image-overlay">
                  <div className="overlay-content">
                    <p>
                      <Eye size={14} />
                      {image.views.toLocaleString()} views
                    </p>
                    <button className="link-button">Manage</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add: Wizard at bottom (pops on button click) */}
      {showUploadWizard && userProfile && (  // NEW: Guard on userProfile
        <UploadWizard
          show={showUploadWizard}
          onClose={() => setShowUploadWizard(false)}
          onUploadSuccess={handleUploadSuccess}
          userProfile={userProfile}  // FIXED: Pass real profile (was {{}})
        />
      )}
    </div>
    </Layout>
  );
};

export default ArtistDashboard;