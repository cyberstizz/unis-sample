import React, { useState, useContext } from 'react';
import songArtwork from './assets/theQuiet.jpg';
import './songPage.scss';
import Layout from './layout';
import { PlayerContext } from './context/playercontext'; 
import sampleSong from './assets/tonyfadd_paranoidbuy1get1free.mp3'; 
import VotingWizard from './votingWizard'; 
import songArtOne from './assets/songartworkONe.jpeg';


const SongPage = () => {
  const { playMedia } = useContext(PlayerContext); 
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [showVotingWizard, setShowVotingWizard] = useState(false); 
  const [selectedNominee, setSelectedNominee] = useState(null); 

  const song = {
    title: 'Paranoid',
    artist: 'Artist Name',
    jurisdiction: 'Harlem-Wide',
    playCount: 5120,
    todayPlayCount: 64,
    voteCount: 120,
    artwork: songArtOne,
    description: 'This is a brief description of the song. It tells the story behind the music and the artist\'s inspiration.',
    credits: {
      producer: 'Producer Name',
      writer: 'Writer Name',
      mix: 'Mix Engineer Name',
    },
    photos: [
      { src: songArtwork, caption: 'Studio Session' },
      { src: songArtwork, caption: 'Live Performance' },
    ],
    videos: [
      { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', caption: 'Official Video' },
    ],
  };

  const handleVoteSuccess = (id) => {
    // Handle successful vote (e.g., update UI, API call)
    console.log(`Vote confirmed for ID: ${id}`);
    setShowVotingWizard(false);
  };

  const handleVote = () => {
    // Set the song as nominee and open wizard
    setSelectedNominee({
      id: 'song-id-placeholder', // Replace with real ID
      name: song.title, // Use title as "name" for wizard
      // Add other needed fields if wizard expects
    });
    setShowVotingWizard(true);
  };

  const handlePlay = () => {
    playMedia(
      { type: 'song', url: sampleSong, title: song.title, artist: song.artist, artwork: song.artwork },
      [ // Sample playlist (optional)
        { type: 'song', url: sampleSong, title: song.title, artist: song.artist, artwork: song.artwork },
      ]
    );
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
          
          {/* Track Title */}
          <h1 className="track-title">{song.title}</h1>

          {/* Photo */}
          <img
            src={song.artwork}
            alt={`${song.title} artwork`}
            className="song-artwork"
          />

          {/* Play and Vote Buttons (side by side) */}
          <div className="follow-actions">
            <button onClick={handlePlay} className="play-button">Play</button>
            <button onClick={handleVote} className="vote-button">Vote</button>
          </div>

          {/* Artist & Jurisdiction */}
          <p className="artist-name">Artist: {song.artist}</p>
          <p className="jurisdiction">Jurisdiction: {song.jurisdiction}</p>

          {/* Play Counts & Votes */}
          <div className="stats">
            <p>Total Plays: {song.playCount}</p>
            <p>Today’s Plays: {song.todayPlayCount}</p>
            <p>Votes: {song.voteCount}</p>
          </div>

          {/* About Section */}
          <section className="description-section">
            <h2>About</h2>
            <p>{song.description}</p>
          </section>

          {/* Credits */}
          <section className="credits-section">
            <h2>Credits</h2>
            <p><strong>Producer:</strong> {song.credits.producer}</p>
            <p><strong>Writer:</strong> {song.credits.writer}</p>
            <p><strong>Mix Engineer:</strong> {song.credits.mix}</p>
          </section>

          {/* Photos */}
          <section className="photos-section">
            <h2>Photos</h2>
            <div className="photo-gallery">
              {song.photos.map((photo, idx) => (
                <figure key={idx}>
                  <img src={photo.src} alt={photo.caption} />
                  <figcaption>{photo.caption}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          {/* Videos */}
          <section className="videos-section">
            <h2>Videos</h2>
            <div className="video-gallery">
              {song.videos.map((vid, idx) => (
                <div key={idx} className="video-wrapper">
                  <iframe
                    src={vid.url}
                    title={vid.caption}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <p>{vid.caption}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Comments */}
          <section className="comments-section">
            <h2>Comments</h2>
            <form onSubmit={handleCommentSubmit} className="comment-form">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
              />
              <button type="submit" className="submit-comment-button">
                Submit
              </button>
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

      {/* Voting Wizard */}
      <VotingWizard
        show={showVotingWizard}
        onClose={() => setShowVotingWizard(false)}
        onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee}
        filters={{ /* Pass current filters; hardcode or from state/context */
          selectedGenre: 'rap-hiphop', // Example; adjust as needed
          selectedType: 'song',
          selectedInterval: 'daily',
          selectedJurisdiction: song.jurisdiction.toLowerCase().replace(' ', '-'),
        }}
      />
    </Layout>
  );
};

export default SongPage;