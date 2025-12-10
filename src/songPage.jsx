import React, { useState, useContext, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import songArtwork from './assets/theQuiet.jpg';
import './songPage.scss';
import Layout from './layout';
import { PlayerContext } from './context/playercontext'; 
import VotingWizard from './votingWizard'; 

const SongPage = () => {
  const { songId } = useParams();  // Get songId from URL
  const { playMedia } = useContext(PlayerContext); 
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [showVotingWizard, setShowVotingWizard] = useState(false); 
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [userId, setUserId] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            setUserId(payload.userId);
            console.log('User ID extracted from token:', payload.userId); // Debug log
          } catch (err) {
            console.error('Failed to get userId from token:', err);
          }
        }
      }, []);


  useEffect(() => {
    fetchSongData();
  }, [songId]);

  const fetchSongData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch song details - you'll need to create this endpoint in your backend
      const response = await apiCall({ 
        method: 'get', 
        url: `/v1/media/song/${songId}` 
      });
      
      const songData = response.data;
      
      // Normalize the data
      const normalized = {
        id: songData.songId,
        title: songData.title,
        artist: songData.artist.username,
        artistId: songData.artist.userId,
        jurisdiction: songData.jurisdiction?.name || 'Unknown',
        artwork: songData.artworkUrl ? `${API_BASE_URL}${songData.artworkUrl}` : songArtwork,
        url: songData.fileUrl ? `${API_BASE_URL}${songData.fileUrl}` : null,
        description: songData.description || 'No description available',
        playCount: songData.score || 0,  // Use score as play count for now
        todayPlayCount: 0,  // TODO: Add daily play count endpoint
        voteCount: 0,  // TODO: Add vote count endpoint
        duration: songData.duration,
        createdAt: songData.createdAt,
        genre: songData.genre?.name || 'Unknown',
        // TODO: Add these when backend supports them
        credits: {
          producer: 'N/A',
          writer: 'N/A',
          mix: 'N/A',
        },
        photos: [],
        videos: [],
      };
      
      setSong(normalized);
    } catch (err) {
      console.error('Failed to load song:', err);
      setError('Failed to load song details');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteSuccess = (id) => {
    console.log(`Vote confirmed for ID: ${id}`);
    setShowVotingWizard(false);
    // TODO: Refresh vote count
  };

  const handleVote = () => {
    setSelectedNominee({
      id: song.id,
      name: song.title,
    });
    setShowVotingWizard(true);
  };

  const handlePlay = () => {
    playMedia(
      { 
        type: 'song', 
        url: song.url, 
        title: song.title, 
        artist: song.artist, 
        artwork: song.artwork 
      },
      [{ 
        type: 'song', 
        url: song.url, 
        title: song.title, 
        artist: song.artist, 
        artwork: song.artwork 
      }]
    );
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (comment.trim()) {
      setComments([...comments, comment]);
      setComment('');
      // TODO: Save comment to backend
    }
  };

  if (loading) {
    return (
      <Layout backgroundImage={songArtwork}>
        <div style={{ textAlign: 'center', padding: '50px', color: 'white' }}>
          Loading song...
        </div>
      </Layout>
    );
  }

  if (error || !song) {
    return (
      <Layout backgroundImage={songArtwork}>
        <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>
          {error || 'Song not found'}
        </div>
      </Layout>
    );
  }

  return (
    <Layout backgroundImage={song.artwork}>
      <div className="song-page-container">
        <div className="main-content-card">
          
          <h1 className="track-title">{song.title}</h1>

          <img
            src={song.artwork}
            alt={`${song.title} artwork`}
            className="song-artwork"
          />

          <div className="follow-actions">
            <button onClick={handlePlay} className="play-button">Play</button>
            <button onClick={handleVote} className="vote-button">Vote</button>
          </div>

          <p className="artist-name">Artist: {song.artist}</p>
          <p className="jurisdiction">Jurisdiction: {song.jurisdiction}</p>
          <p className="genre">Genre: {song.genre}</p>

          <div className="stats">
            <p>Total Plays: {song.playCount}</p>
            <p>Today's Plays: {song.todayPlayCount}</p>
            <p>Votes: {song.voteCount}</p>
          </div>

          <section className="description-section">
            <h2>About</h2>
            <p>{song.description}</p>
          </section>

          <section className="credits-section">
            <h2>Credits</h2>
            <p><strong>Producer:</strong> {song.credits.producer}</p>
            <p><strong>Writer:</strong> {song.credits.writer}</p>
            <p><strong>Mix Engineer:</strong> {song.credits.mix}</p>
          </section>

          {song.photos.length > 0 && (
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
          )}

          {song.videos.length > 0 && (
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
          )}

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

      <VotingWizard
        show={showVotingWizard}
        onClose={() => setShowVotingWizard(false)}
        onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee}
        filters={{
          selectedGenre: song.genre.toLowerCase().replace('/', '-'),
          selectedType: 'song',
          selectedInterval: 'daily',
          selectedJurisdiction: song.jurisdiction.toLowerCase().replace(' ', '-'),
        }}
      />
    </Layout>
  );
};

export default SongPage;