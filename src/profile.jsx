// src/components/Profile.js
import React, { useState } from 'react';
import unisLogo from './assets/unisLogo.svg'; // Adjust path
import './Profile.scss';

const Profile = ({ isArtist = false }) => { // Prop for role; true for artist, false for listener
  const [showPopup, setShowPopup] = useState(isArtist); // Popup for artists on load
  const [bio, setBio] = useState('Your bio here...'); // Editable bio

  // Placeholder data
  const profileData = {
    name: 'User Name',
    voteHistory: ['Voted for Artist X on Daily Rap', 'Voted for Song Y on Weekly Pop'],
    supportedArtists: isArtist ? null : ['Artist A', 'Artist B'], // For listeners
    stats: isArtist ? { playsDaily: 100, playsWeekly: 500, supporters: 250, trends: 'Up 20%' } : null,
    messaging: 'Open', // Options for artists
    revenue: isArtist ? '$XXX forecast' : null,
  };

  const handleBioChange = (e) => setBio(e.target.value);

  return (
    <div className="profile-container">
      <header className="header">
        <img src={unisLogo} alt="UNIS Logo" className="logo" />
        <h1>{profileData.name}'s Profile</h1>
      </header>

      {showPopup && isArtist && (
        <div className="popup">
          <p>Thank you for making Unis possible with your creative work!</p>
          <p>You were only 83 votes from advancing last week.</p>
          <button onClick={() => setShowPopup(false)}>Close</button>
        </div>
      )}

      <section className="bio-section">
        <h2>Bio</h2>
        <textarea value={bio} onChange={handleBioChange} className="bio-edit" />
        <button>Save Bio</button>
      </section>

      <section className="vote-history">
        <h2>Vote History</h2>
        <ul>
          {profileData.voteHistory.map((vote, index) => <li key={index}>{vote}</li>)}
        </ul>
      </section>

      {isArtist ? (
        <>
          <section className="stats">
            <h2>Stats</h2>
            <p>Plays (Daily/Weekly): {profileData.stats.playsDaily} / {profileData.stats.playsWeekly}</p>
            <p>Supporters: {profileData.stats.supporters}</p>
            <p>Trends: {profileData.stats.trends}</p>
          </section>

          <section className="messaging-settings">
            <h2>Messaging Settings</h2>
            <select defaultValue={profileData.messaging}>
              <option>Open</option>
              <option>Permission</option>
              <option>Paid</option>
            </select>
          </section>

          <section className="revenue">
            <h2>Revenue & Forecasts</h2>
            <p>{profileData.revenue}</p>
          </section>
        </>
      ) : (
        <section className="supported-artists">
          <h2>Supported Artists</h2>
          <ul>
            {profileData.supportedArtists.map((artist, index) => <li key={index}>{artist}</li>)}
          </ul>
        </section>
      )}

      <section className="settings">
        <h2>Settings</h2>
        <button>Change Password</button>
        <button>Logout</button>
        {/* Add more as needed */}
      </section>

      <section className="messages">
        <h2>Messages</h2>
        <p>No messages yet. (MVP stub)</p>
      </section>
    </div>
  );
};

export default Profile;