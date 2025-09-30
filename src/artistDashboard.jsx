// ArtistDashboard.jsx
import React, { useState } from 'react';
import { Upload, Play, Image, Video, TrendingUp, Eye, Heart, Users, X } from 'lucide-react';
import './ArtistDashboard.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';

const ArtistDashboard = () => {
  const [showWelcomePopup, setShowWelcomePopup] = useState(true);
  




  // Placeholder data
  const profileData = {
    name: 'User Name',
    voteHistory: ['Voted for Artist X on Daily Rap', 'Voted for Song Y on Weekly Pop'],
    supportedArtists: ['Artist A', 'Artist B'], // For listeners
    stats: { playsDaily: 100, playsWeekly: 500, supporters: 250, trends: 'Up 20%' } ,
    messaging: 'Open', // Options for artists
    revenue: '$XXX forecast',
  };

  // Mock artist data - replace with actual data
  const artistData = {
    name: "Tony Fadd",
    profileImage: "https://via.placeholder.com/200",
    bio: "Creating unique sounds that blend electronic and acoustic elements. Inspired by life, love, and the pursuit of perfect harmony.",
    mainSong: {
      title: "Paranoid",
      views: 15420,
      likes: 892
    },
    totalViews: 45230,
    supporters: 3421,
    followers: 1823,
    songs: [
      { id: 1, title: "Paranoid", views: 15420, likes: 892 },
      { id: 2, title: "Midnight Dreams", views: 12340, likes: 745 },
      { id: 3, title: "Electric Soul", views: 9870, likes: 634 }
    ],
    images: [
      { id: 1, url: backimage, views: 2340 },
      { id: 2, url: backimage, views: 1890 },
      { id: 3, url: backimage, views: 1567 }
    ],
    videos: [
      { id: 1, title: "Behind the Scenes", views: 8920 },
      { id: 2, title: "Live Performance", views: 12450 }
    ]
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
          <h1>Artist Dashboard</h1>
          <p>Manage your content and track your performance</p>
        </div>

        {/* Stats Overview */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-content">
              <div className="stat-info">
                <p className="stat-label">Total Views</p>
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
                <p className="stat-label">Fans</p>
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
                <button className="btn btn-secondary">
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


      <section className="bio-section">
        <h2>Bio</h2>
        <textarea value={"your bio here"} onChange={null} className="bio-edit" />
        <button>Save Bio</button>
      </section>

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
              <button className="btn btn-primary btn-small">
                <Upload size={16} />
                Upload
              </button>
            </div>
            <div className="content-list">
              {artistData.songs.map((song) => (
                <div key={song.id} className="content-item">
                  <div className="item-header">
                    <h4>{song.title}</h4>
                    <button className="edit-button">Edit</button>
                  </div>
                  <div className="item-stats">
                    <span>
                      <Eye size={12} />
                      {song.views.toLocaleString()}
                    </span>
                    <span>
                      <Heart size={12} />
                      {song.likes.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Videos Section */}
          <div className="content-section card">
            <div className="section-header">
              <h3>
                <Video size={20} />
                Your Videos
              </h3>
              <button className="btn btn-primary btn-small">
                <Upload size={16} />
                Upload
              </button>
            </div>
            <div className="content-list">
              {artistData.videos.map((video) => (
                <div key={video.id} className="content-item">
                  <div className="item-header">
                    <h4>{video.title}</h4>
                    <button className="edit-button">Edit</button>
                  </div>
                  <div className="item-stats">
                    <span>
                      <Eye size={12} />
                      {video.views.toLocaleString()} views
                    </span>
                  </div>
                </div>
              ))}
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
            <button className="btn btn-primary btn-small">
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
    </div>
    </Layout>
  );
};

export default ArtistDashboard;