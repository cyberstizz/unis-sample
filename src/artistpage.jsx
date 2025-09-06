import React, { useState } from 'react';
import unisLogo from './assets/unisLogo.svg';
import './ArtistPage.scss';
import Header from './header';

const ArtistPage = ({ isOwnProfile = false }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [bio, setBio] = useState('Artist bio here...');

  const artist = {
    name: 'Artist Name',
    genre: 'Rap/Hip-Hop',
    rank: '#5 in Uptown Harlem (Rap)',
    followers: 1200,
    supporters: 450,
    bio: bio,
    songs: ['Song 1', 'Song 2', 'Song 3', 'Song 4', 'Song 5'],
    videos: ['Video 1', 'Video 2'],
    events: ['Show at Venue X on Sep 10', 'Event Y on Sep 15'],
    voteCount: 150,
  };

  const handleFollow = () => setIsFollowing(!isFollowing);
  const handleBioChange = (e) => setBio(e.target.value);

  return (
    <React.Fragment>
    <Header />
    <div className="artist-page-container">
      <header className="header">
        <img src={unisLogo} alt="UNIS Logo" className="logo" />
        <div className="artist-info">
          <h1>{artist.name}</h1>
          <p className="artist-genre">{artist.genre}</p>
          <div className="follow-actions">
            <button onClick={handleFollow} className="follow-button">
              {isFollowing ? 'Unfollow' : 'Follow'}
            </button>
            {!isOwnProfile && (
              <button className="vote-button">Vote</button>
            )}
          </div>
        </div>
      </header>

      <div className="content-wrapper">
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

        <section className="bio-section card">
          <h2>Bio</h2>
          {isOwnProfile ? (
            <textarea value={bio} onChange={handleBioChange} className="bio-edit" />
          ) : (
            <p>{artist.bio}</p>
          )}
          {isOwnProfile && <button className="save-button">Save Bio</button>}
        </section>

        <section className="songs-section card">
          <h2>Songs (Up to 5)</h2>
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

        <section className="events-section card">
          <h2>Events/Shows</h2>
          <ul>
            {artist.events.map((event, index) => (
              <li key={index}>
                <span>{event}</span>
                {isOwnProfile && <button className="edit-button">Edit/Remove</button>}
              </li>
            ))}
          </ul>
          {isOwnProfile && <button className="add-button">Add Event</button>}
        </section>
      </div>
    </div>
    </React.Fragment>
  );
};

export default ArtistPage;