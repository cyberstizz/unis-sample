// src/components/SongPage.js
import React, { useState } from 'react';
import songArtwork from './assets/theQuiet.jpg'; 
import './songPage.scss';
import Layout from './layout';

const SongPage = () => {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);

  // Placeholder data
  const song = {
    title: 'Song Title',
    artist: 'Artist Name',
    voteCount: 120,
    artwork: songArtwork,
    description: 'This is a brief description of the song. It tells the story behind the music and the artist\'s inspiration.',
    credits: {
      producer: 'Producer Name',
      writer: 'Writer Name',
      mix: 'Mix Engineer Name',
    },
  };

  const handleVote = () => {
    // TODO: API vote
    console.log('Voted for song!');
  };
  
  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (comment.trim()) {
      setComments([...comments, comment]);
      setComment('');
    }
  };

  return (
        <Layout backgroundImage={songArtwork}>
    <div className="song-page-container">
      <div className="main-content-card">
        <section className="song-player-section">
          <img src={song.artwork} alt={`${song.title} artwork`} className="song-artwork" />
          <div className="player-controls">
            <button className="play-button">▶️</button>
            <div className="seek-bar-container">
              <div className="seek-bar"></div>
            </div>
          </div>
          <div className="song-details">
            <h1>{song.title}</h1>
            <p className="artist-name">{song.artist}</p>
            <p className="vote-count">Votes: {song.voteCount}</p>
            <button onClick={handleVote} className="vote-button">Vote</button>
          </div>
        </section>

        <section className="description-section">
          <h2>Description</h2>
          <p>{song.description}</p>
        </section>

        <section className="credits-section">
          <h2>Credits</h2>
          <p><strong>Producer:</strong> {song.credits.producer}</p>
          <p><strong>Writer:</strong> {song.credits.writer}</p>
          <p><strong>Mix:</strong> {song.credits.mix}</p>
        </section>
        
        <section className="comments-section">
          <h2>Comments</h2>
          <form onSubmit={handleCommentSubmit} className="comment-form">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
            />
            <button type="submit" className="submit-comment-button">Submit</button>
          </form>
          <ul className="comments-list">
            {comments.map((c, index) => (
              <li key={index} className="comment-item">{c}</li>
            ))}
            {comments.length === 0 && <p className="no-comments">No comments yet.</p>}
          </ul>
        </section>
      </div>
    </div>
     </Layout>
  );
};

export default SongPage;