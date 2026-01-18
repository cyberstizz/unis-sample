import React, { useState, useContext, useEffect, useRef } from 'react'; // <--- ADDED useRef
import { useParams } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import songArtwork from './assets/theQuiet.jpg';
import LyricsWizard from './lyricsWizard';  
import { FileText, Heart } from 'lucide-react';
import './songPage.scss';
import Layout from './layout';
import { PlayerContext } from './context/playercontext'; 
import VotingWizard from './votingWizard'; 
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';  

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
  const [isFollowing, setIsFollowing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showLyricsWizard, setShowLyricsWizard] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  // New states for lyrics editing modal (consistent with dashboard)
  const [editingLyrics, setEditingLyrics] = useState(false);
  const [currentLyrics, setCurrentLyrics] = useState('');

  // --- NEW: AMBIENT MODE STATE ---
  // Default to a transparent value or a safe fallback
  const [dominantColor, setDominantColor] = useState('rgba(255, 255, 255, 0.1)');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const navigate = useNavigate();

  // --- NEW: COLOR EXTRACTION LOGIC ---
  const extractColor = (url) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Crucial for external images
    img.src = url;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 1;
      canvas.height = 1;
      
      // Draw image at 1x1 to average all pixels
      ctx.drawImage(img, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      
      // Set color with transparency for the glow effect
      setDominantColor(`rgba(${r}, ${g}, ${b}, 0.6)`);
    };
  };

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

  // --- NEW: TRIGGER EXTRACTION WHEN ARTWORK LOADS ---
  useEffect(() => {
    if (song?.artwork) {
      extractColor(song.artwork);
    }
  }, [song?.artwork]);

  useEffect(() => {
    if (song?.id && userId) {
      // Check if already liked
      apiCall({ 
        url: `/v1/media/song/${song.id}/is-liked?userId=${userId}`,
        method: 'get'
      })
        .then(res => setIsLiked(res.data.isLiked || false))
        .catch(() => setIsLiked(false));
      
      // Get like count
      apiCall({ 
        url: `/v1/media/song/${song.id}/likes/count`,
        method: 'get'
      })
        .then(res => setLikeCount(res.data.count || 0))
        .catch(() => setLikeCount(0));
    }
  }, [song, userId]);

  const fetchSongData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiCall({ 
        method: 'get', 
        url: `/v1/media/song/${songId}`,
        useCache: false
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
        lyrics: songData.lyrics || '',
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
      
      setSong(normalized);
    } catch (err) {
      console.error('Failed to load song:', err);
      setError('Failed to load song details');
    } finally {
      setLoading(false);
    }
  };

  const handleVoteSuccess = () => {
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
      setSong(prevSong => ({
        ...prevSong,
        playCount: prevSong.playCount + 1,
        playsToday: prevSong.playsToday + 1
      }));

      try {
        const endpoint = `/v1/media/song/${song.id}/play?userId=${userId}`;
        await apiCall({ method: 'post', url: endpoint });
      } catch (err) {
        console.error('Failed to track song play:', err);
        setSong(prevSong => ({
          ...prevSong,
          playCount: prevSong.playCount - 1,
          playsToday: prevSong.playsToday - 1
        }));
      }
    }
  };

  const handleLike = async () => {
    if (!userId) {
      alert('Please log in to like songs');
      return;
    }
    
    if (!song?.id) {
      return;
    }
    
    try {
      if (isLiked) {
        // Unlike
        const res = await apiCall({
          method: 'delete',
          url: `/v1/media/song/${song.id}/like?userId=${userId}`
        });
        
        if (res.data.success) {
          setIsLiked(false);
          setLikeCount(prev => Math.max(0, prev - 1));
        }
      } else {
        // Like
        const res = await apiCall({
          method: 'post',
          url: `/v1/media/song/${song.id}/like?userId=${userId}`
        });
        
        if (res.data.success) {
          setIsLiked(true);
          setLikeCount(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      alert('Failed to update like. Please try again.');
    }
  };

  const handleFollow = async () => {
    // Optimistic UI update (switch immediately)
    const newStatus = !isFollowing;
    setIsFollowing(newStatus);

    try {
      if (newStatus) {
        // Follow the ARTIST of this song
        await apiCall({ method: 'post', url: `/v1/users/${song.artistId}/follow` });
      } else {
        // Unfollow
        await apiCall({ method: 'delete', url: `/v1/users/${song.artistId}/follow` });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      // Revert if failed
      setIsFollowing(!newStatus);
    }
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
    if (song?.artistId) {
      navigate(`/artist/${song.artistId}`);
    }
  };

  const isOwner = userId && song?.artistId === userId;


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
        {/* --- MODIFIED: Added ambient-card class and style prop --- */}
        <div 
          className="main-content-card ambient-card"
          style={{ '--ambient-glow': dominantColor }}
        >
          
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
            <button 
              onClick={handleLike} 
              className={`like-button ${isLiked ? 'liked' : ''}`}
              style={{
                background: isLiked ? '#163387' : 'transparent',
                border: '2px solid #163387',
                color: 'grey',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                borderRadius: '4px',
                transition: 'all 0.3s ease'
              }}
            >
              <Heart size={18} fill={isLiked ? 'white' : 'none'} />
              {isLiked ? 'Liked' : 'Like'}
            </button>
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
            <p><span style={{color: "blue"}}>Likes</span> {likeCount}</p>
            {song.playsToday > 100 && (
              <p style={{ color: 'green', fontWeight: 'bold' }}>
                {song.playsToday} plays today
              </p>
            )}
          </div>

          {/* Secondary Action Buttons */}
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

          {/* Lyrics Section - now always visible, cleaner display */}
         {song.lyrics && (
            <section className="lyrics-section" style={{ marginTop: '2rem' }}>
              <h2 style={{ color: "blue", marginBottom: '1rem' }}>Lyrics</h2>
              <p style={{ 
                whiteSpace: 'pre-wrap', 
                lineHeight: '1.6', 
                fontFamily: 'inherit',
                color: '#e0e0e0' 
              }}>
                {song.lyrics}
              </p>
            </section>
          )}

         {/* Edit Button (Only for owner) */}
         {isOwner && (
          <div className="owner-actions" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button 
              className="btn btn-primary" 
              onClick={() => setShowLyricsWizard(true)}
            >
              <FileText size={16} style={{ marginRight: '8px' }} />
              {song.lyrics ? 'Edit Lyrics' : 'Add Lyrics'}
            </button>
          </div>
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

      {showLyricsWizard && (
      <LyricsWizard
        show={showLyricsWizard}
        onClose={() => setShowLyricsWizard(false)}
        song={song}
        onSuccess={fetchSongData}
      />
    )}

      {/* Voting Wizard */}
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