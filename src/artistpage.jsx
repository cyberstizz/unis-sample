// src/components/ArtistPage.js
import React, { useState } from 'react';
import unisLogo from './assets/unisLogo.svg'; // Adjust path
import './ArtistPage.scss';

const ArtistPage = ({ isOwnProfile = false }) => { // Prop to check if viewing own profile (artist role)
  const [showPopup, setShowPopup] = useState(isOwnProfile); // Show thanks popup for artists on load

  // Placeholder data
  const artist = {
    name: 'Artist Name',
    bio: 'Bio description here...',
    genre: 'Rap/Hip-Hop',
    voteCount: 150,
    projection: 'You were only 83 votes from 20th last week',
    songs: ['Song 1', 'Song 2', 'Song 3'],
    plays: { daily: 100, weekly: 500, monthly: 2000, yearly: 10000 },
    supporters: 250,
    trends: 'Up 20% this week',
    votingHistory: ['Voted for Artist X last week'],
    events: ['Event 1 on Date'],
    messaging: 'Open', // Options: Open, Permission, Paid
  };

  const handleVote = () => {
    // TODO: API vote
    console.log('Voted!');
  };

  const handleUpload = () => {
    // TODO: Upload logic
    console.log('Uploading song...');
  };

  return (
    <div className="artist-page-container">
      <header className="header">
        <img src={unisLogo} alt="UNIS Logo" className="logo" />
        <h1>{artist.name}</h1>
      </header>

      {showPopup && isOwnProfile && (
        <div className="popup">
          <p>Thank you for making Unis possible with your creative work!</p>
          <p>{artist.projection}</p>
          <button onClick={() => setShowPopup(false)}>Close</button>
        </div>
      )}

      <section className="bio">
        <h2>Bio</h2>
        <p>{artist.bio}</p>
        <p>Genre: {artist.genre}</p>
        <p>Votes: {artist.voteCount}</p>
        <button onClick={handleVote} className="vote-button">Vote</button>
      </section>

      <section className="songs">
        <h2>Songs</h2>
        <ul>
          {artist.songs.map((song, index) => (
            <li key={index}>{song} <button>Play</button></li> // Link to SongPage
          ))}
        </ul>
        {isOwnProfile && (
          <div className="upload-section">
            <h3>Upload/Edit Songs</h3>
            <input type="file" />
            <button onClick={handleUpload}>Upload</button>
          </div>
        )}
      </section>

      {isOwnProfile && (
        <>
          <section className="analytics">
            <h2>Analytics</h2>
            <p>Plays: Daily {artist.plays.daily} | Weekly {artist.plays.weekly} | Monthly {artist.plays.monthly} | Yearly {artist.plays.yearly}</p>
            <p>Supporters: {artist.supporters}</p>
            <p>Trends: {artist.trends}</p>
          </section>

          <section className="history">
            <h2>Voting History</h2>
            <ul>
              {artist.votingHistory.map((vote, index) => <li key={index}>{vote}</li>)}
            </ul>
          </section>

          <section className="events">
            <h2>Events</h2>
            <ul>
              {artist.events.map((event, index) => <li key={index}>{event}</li>)}
            </ul>
            <button>Add Event</button>
          </section>

          <section className="messaging">
            <h2>Messaging Settings</h2>
            <select defaultValue={artist.messaging}>
              <option>Open</option>
              <option>Permission</option>
              <option>Paid</option>
            </select>
          </section>

          <section className="revenue">
            <h2>Revenue Reports</h2>
            <p>Forecast: $XXX</p>
          </section>
        </>
      )}
    </div>
  );
};

export default ArtistPage;