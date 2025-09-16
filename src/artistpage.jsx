import React, { useState } from 'react';
import unisLogo from './assets/unisLogo.svg';
import Layout from './layout';
import './artistpage.scss';
import theQuiet from './assets/theQuiet.jpg';

const ArtistPage = ({ isOwnProfile = false }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [bio, setBio] = useState('Artist bio here...');

  const artist = {
    name: 'Artist Name',
    genre: 'Rap/Hip-Hop',
    rank: '#5 in Uptown Harlem (Rap)',
    jurisdiction: 'Uptown Harlem',
    followers: 1200,
    supporters: 450,
    bio: bio,
    songs: ['Song 1', 'Song 2', 'Song 3', 'Song 4', 'Song 5'],
    videos: ['Video 1', 'Video 2'],
    photos: ['Photo 1', 'Photo 2'], // Placeholder for new Photos section
    bestSong: 'Song 1 - Fans\' Pick', // Placeholder for Fans Pick
    socialLinks: [
      { icon: '📸', label: 'Instagram', url: 'https://instagram.com/artist' },
      { icon: '🐦', label: 'Twitter', url: 'https://twitter.com/artist' },
      { icon: '🎵', label: 'Spotify', url: 'https://spotify.com/artist' },
    ], // Placeholder for Social Media Links
    voteCount: 150,
  };

  const handleFollow = () => setIsFollowing(!isFollowing);
  const handleBioChange = (e) => setBio(e.target.value);

  return (
    <Layout backgroundImage={theQuiet}> {/* random image for MVP */}
      <div className="artist-page-container">
        {/* Header - Kept intact */}
        <header className="artist-header">
          <div className="artist-info">
            <div className="artist-top">
              <p className="artist-name">{artist.name}</p>
              <p className="artist-jurisdiction">{artist.jurisdiction}</p>
            </div>
            <p className="artist-genre">{artist.genre}</p>
            <div className="follow-actions">
              <button onClick={handleFollow} className="follow-button">
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              {!isOwnProfile && <button className="vote-button">Vote</button>}
            </div>
          </div>
        </header>

        <div className="content-wrapper">
          {/* Artist Info (Stats Grid) */}
          <section className="stats-grid">
            <div className="stat-item">
              <p className="stat-value">{artist.rank}</p>
              <p className="stat-label">Rank</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{artist.followers}</p>
              <p className="stat-label">Followers</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{artist.supporters}</p>
              <p className="stat-label">Supporters</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{artist.voteCount}</p>
              <p className="stat-label">Votes</p>
            </div>
          </section>

          {/* Fans Pick Section */}
          <section className="fans-pick-section card">
            <h2>Fans Pick</h2>
            <ul>
              <li>{artist.bestSong}</li>
            </ul>
          </section>

          {/* Music (Songs) Section */}
          <section className="music-section card">
            <h2>Music</h2>
            <ul>
              {artist.songs.slice(0, 5).map((song, index) => (
                <li key={index}>
                  <span>{song}</span>
                  {isOwnProfile && <button className="edit-button">Edit/Remove</button>}
                </li>
              ))}
            </ul>
            {isOwnProfile && artist.songs.length < 5 && <button className="upload-button">Upload Song</button>}
          </section>

          {/* Bio Section */}
          <section className="bio-section card">
            <h2>Bio</h2>
            {isOwnProfile ? (
              <textarea value={bio} onChange={handleBioChange} className="bio-edit" />
            ) : (
              <p>{artist.bio}</p>
            )}
            {isOwnProfile && <button className="save-button">Save Bio</button>}
          </section>

          {/* Videos Section */}
          <section className="videos-section card">
            <h2>Videos</h2>
            <ul>
              {artist.videos.map((video, index) => (
                <li key={index}>
                  <span>{video}</span>
                  {isOwnProfile && <button className="edit-button">Edit/Remove</button>}
                </li>
              ))}
            </ul>
            {isOwnProfile && <button className="upload-button">Upload Video</button>}
          </section>

          {/* Photos Section (New) */}
          <section className="photos-section card">
            <h2>Photos</h2>
            <ul>
              {artist.photos.map((photo, index) => (
                <li key={index}>
                  <span>{photo}</span>
                  {isOwnProfile && <button className="edit-button">Edit/Remove</button>}
                </li>
              ))}
            </ul>
            {isOwnProfile && <button className="upload-button">Upload Photo</button>}
          </section>

          {/* Social Media Links (New) */}
          <section className="social-section card">
            <h2>Social Media</h2>
            <div className="social-links">
              {artist.socialLinks.map((link, index) => (
                <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="social-link">
                  <span>{link.icon}</span> {link.label}
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default ArtistPage;