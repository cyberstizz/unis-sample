import React, { useState, useContext, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import songArtwork from './assets/theQuiet.jpg';
import './songPage.scss';
import Layout from './layout';
import { PlayerContext } from './context/playercontext'; 
import VotingWizard from './votingWizard'; 
import { useNavigate } from 'react-router-dom';


const SongPage = () => {
  const { songId } = useParams();
  const { playMedia } = useContext(PlayerContext); 
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [showVotingWizard, setShowVotingWizard] = useState(false); 
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [userId, setUserId] = useState(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.userId);
        console.log('User ID extracted from token:', payload.userId);
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
      const response = await apiCall({ 
        method: 'get', 
        url: `/v1/media/song/${songId}` 
      });
      
      const songData = response.data;
      console.log('Raw song data from backend:', songData);
      
      const normalized = {
        id: songData.songId,
        title: songData.title,
        artist: songData.artist.username,
        artistId: songData.artist.userId,
        jurisdiction: songData.jurisdiction?.name || 'Unknown',
        artwork: songData.artworkUrl ? `${API_BASE_URL}${songData.artworkUrl}` : songArtwork,
        url: songData.fileUrl ? `${API_BASE_URL}${songData.fileUrl}` : null,
        description: songData.description || 'No description available',
        score: songData.score,
        playCount: songData.playCount || 0,
        playsToday: songData.playsToday || 0,
        explicit: songData.explicit || false,
        lyrics: songData.lyrics || null,
        voteCount: 0,
        duration: songData.duration,
        createdAt: songData.createdAt,
        genre: songData.genre?.name || 'Unknown',
        credits: {
          producer: 'N/A',
          writer: 'N/A',
          mix: 'N/A',
        },
        photos: [],
        videos: [],
      };
      
      console.log('Normalized song data:', normalized);
      console.log('Normalized playsToday:', normalized.playsToday);
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
  };

  const handleVote = () => {
    setSelectedNominee({
      id: song.id,
      name: song.title,
    });
    setShowVotingWizard(true);
  };

  const handlePlay = async () => {
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

    if (song.id && userId) {
      // Optimistically update play count immediately (no page refresh)
      setSong(prevSong => ({
        ...prevSong,
        playCount: prevSong.playCount + 1,
        playsToday: prevSong.playsToday + 1
      }));

      try {
        const endpoint = `/v1/media/song/${song.id}/play?userId=${userId}`;
        console.log('Tracking song play:', { endpoint, songId: song.id, userId });
        await apiCall({ method: 'post', url: endpoint });
        console.log('Song play tracked successfully');
        // No need to refetch - we already updated the UI optimistically
      } catch (err) {
        console.error('Failed to track song play:', err);
        // Revert the optimistic update if the API call failed
        setSong(prevSong => ({
          ...prevSong,
          playCount: prevSong.playCount - 1,
          playsToday: prevSong.playsToday - 1
        }));
      }
    } else {
      console.warn('Could not track play - missing song.id or userId:', { songId: song.id, userId });
    }
  };

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    console.log(isFollowing ? 'Unfollowed' : 'Followed');
  };

  const handleDontPlay = () => {
    console.log('Added to do-not-play list');
  };

  const handleReport = () => {
    console.log('Report song');
  };

  const handleShare = () => {
    console.log('Share song');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (comment.trim()) {
      setComments([...comments, comment]);
      setComment('');
    }
  };

  const handleArtistClick = () => {
    if (song.artistId) {
      navigate(`/artist/${song.artistId}`);
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
          
          {/* Title with Explicit Badge */}
          <h1 className="track-title">
            {song.title}
            {song.explicit && (
              <span 
                style={{
                  marginLeft: '12px',
                  background: 'rgba(255, 0, 0, 0.85)',
                  color: 'white',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.5em',
                  fontWeight: 'bold',
                  verticalAlign: 'middle'
                }}
              >
                EXPLICIT
              </span>
            )}
          </h1>

          <img
            src={song.artwork}
            alt={`${song.title} artwork`}
            className="song-artwork"
          />

          <div className="follow-actions">
            <button onClick={handlePlay} className="play-button">Play</button>
            <button onClick={handleVote} className="vote-button">Vote</button>
          </div>

          <p 
            className="artist-name" 
            style={{ color: "white", cursor: "pointer" }}
            onClick={handleArtistClick}
          >
            {song.artist}
          </p>
          <p className="jurisdiction" onClick={() => navigate(`/jurisdiction/${song.jurisdiction}`)} style={{cursor: 'pointer'}}>
            {song.jurisdiction}
          </p>
          <p className="genre">{song.genre}</p>

          <div className="stats">
            <p><span style={{color: "blue"}}>Plays</span> {song.playCount}</p>
            {song.playsToday > 100 && (
              <p style={{ color: 'green', fontWeight: 'bold' }}>
                {song.playsToday} plays today
              </p>
            )}
          </div>

          {/* NEW: Secondary Action Buttons - Added after stats, before lyrics */}
          <div className="secondary-actions">
            <button onClick={handleFollow} className={`action-btn ${isFollowing ? 'following' : ''}`}>
              {isFollowing ? 'Following' : 'Follow'}
            </button>
            <button onClick={handleDontPlay} className="action-btn">Don't Play</button>
            <button onClick={handleReport} className="action-btn">Report</button>
            <button onClick={handleShare} className="action-btn">Share</button>
            <button onClick={handleCopyLink} className="action-btn">
              {copySuccess ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          {/* NEW: Lyrics Section - Added after stats and buttons, before About */}
          {song.lyrics && (
            <section className="lyrics-section">
              <button 
                onClick={() => setShowLyrics(!showLyrics)}
                className="lyrics-toggle-btn"
              >
                {showLyrics ? '▼ Hide Lyrics' : '▶ Show Lyrics'}
              </button>
              
              {showLyrics && (
                <div className="lyrics-content">
                  {song.lyrics}
                </div>
              )}
            </section>
          )}

          <section className="description-section">
            <h2 style={{color: "blue"}}>About</h2>
            <p>{song.description}</p>
          </section>

          <section className="credits-section">
            <h2 style={{color: "blue"}}>Credits</h2>
            <p><strong style={{color: "blue"}}>Producer:</strong> {song.credits.producer}</p>
            <p><strong style={{color: "blue"}}>Writer:</strong> {song.credits.writer}</p>
            <p><strong style={{color: "blue"}}>Mix Engineer:</strong> {song.credits.mix}</p>
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
        userId={userId}
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