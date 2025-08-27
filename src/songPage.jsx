// src/components/SongPage.js
import React from 'react';
import unisLogo from './assets/unisLogo.svg'; // Adjust path
import './SongPage.scss';

const SongPage = () => {
  // Placeholder data
  const song = {
    title: 'Song Title',
    artist: 'Artist Name',
    voteCount: 120,
  };

  const handleVote = () => {
    // TODO: API vote
    console.log('Voted for song!');
  };

  return (
    <div className="song-page-container">
      <header className="header">
        <img src={unisLogo} alt="UNIS Logo" className="logo" />
        <h1>{song.title}</h1>
      </header>

      <section className="details">
        <p>By: {song.artist}</p> {/* Link to ArtistPage */}
        <p>Votes: {song.voteCount}</p>
        <button onClick={handleVote} className="vote-button">Vote</button>
      </section>

      <section className="player">
        <h2>Play Song</h2>
        {/* Placeholder for audio player */}
        <div className="mini-player">
          <button>Play/Pause</button>
          <div>Seek Bar</div>
        </div>
      </section>
    </div>
  );
};

export default SongPage;