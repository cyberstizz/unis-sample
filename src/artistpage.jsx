import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import Layout from './layout';
import './artistpage.scss';
import theQuiet from './assets/theQuiet.jpg';
import VotingWizard from './votingWizard';
import { Users, Heart } from 'lucide-react';

const ArtistPage = ({ isOwnProfile = false }) => {
  const { artistId } = useParams();
  const { playMedia } = useContext(PlayerContext);
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Follower states
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  
  const [bio, setBio] = useState('');
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [defaultSong, setDefaultSong] = useState(null);
  const [userId, setUserId] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  const navigate = useNavigate();

  // 1. Extract User ID from Token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.userId);
        console.log('🔑 Extracted userId from token:', payload.userId);
      } catch (err) {
        console.error('❌ Failed to get userId from token:', err);
      }
    }
  }, []);

  // 2. Fetch Artist Data & Follower Count
  useEffect(() => {
    fetchArtistData();
  }, [artistId]);

  // 3. Check if "I" am following "Them" (Only runs when we have both IDs)
  useEffect(() => {
    if (userId && artistId && userId !== artistId) {
      console.log('🔍 Checking follow status for artistId:', artistId);
      checkFollowStatus();
    }
  }, [userId, artistId]);

  const checkFollowStatus = async () => {
    try {
      const res = await apiCall({ 
        method: 'get', 
        url: `/v1/users/${artistId}/is-following` 
      });
      console.log('✅ Follow status:', res.data.isFollowing);
      setIsFollowing(res.data.isFollowing);
    } catch (err) {
      console.error('❌ Failed to check follow status:', err);
    }
  };

  const fetchArtistData = async () => {
    setLoading(true);
    setError('');
    
    try {
      // 1. Fetch Profile
      const artistRes = await apiCall({ method: 'get', url: `/v1/users/profile/${artistId}` });
      const artistData = artistRes.data;
      setArtist(artistData);
      setBio(artistData.bio || 'No bio available');

      // 2. Fetch Real Follower Count
      try {
        const countRes = await apiCall({ method: 'get', url: `/v1/users/${artistId}/followers/count` });
        console.log('📊 Follower count response:', countRes.data);
        setFollowerCount(countRes.data.count || 0);
      } catch (err) {
        console.warn('⚠️ Could not fetch follower count', err);
      }

      // 3. Fetch Songs
      const songsRes = await apiCall({ method: 'get', url: `/v1/media/songs/artist/${artistId}` });
      setSongs(songsRes.data || []);

      // 4. Fetch Videos
      const videosRes = await apiCall({ method: 'get', url: `/v1/media/videos/artist/${artistId}` });
      setVideos(videosRes.data || []);

      // 5. Fetch Default Song
      try {
        const defaultSongRes = await apiCall({ method: 'get', url: `/v1/users/${artistId}/default-song` });
        setDefaultSong(defaultSongRes.data);
      } catch (err) {
        setDefaultSong(null);
      }

    } catch (err) {
      console.error('❌ Failed to load artist:', err);
      setError('Failed to load artist details');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Real Follow Logic with Better Logging
  const handleFollow = async () => {
    console.log('🔵 FOLLOW BUTTON CLICKED');
    console.log('Current artistId:', artistId);
    console.log('Current userId:', userId);
    console.log('Previous isFollowing state:', isFollowing);
    
    // 1. Optimistic Update (UI changes immediately)
    const previousState = isFollowing;
    const previousCount = followerCount;

    setIsFollowing(!previousState);
    setFollowerCount(prev => (!previousState ? prev + 1 : prev - 1));

    try {
      if (!previousState) {
        // Follow
        console.log('📤 Sending FOLLOW request to:', `/v1/users/${artistId}/follow`);
        const response = await apiCall({ method: 'post', url: `/v1/users/${artistId}/follow` });
        console.log('✅ Follow successful:', response.data);
      } else {
        // Unfollow
        console.log('📤 Sending UNFOLLOW request to:', `/v1/users/${artistId}/follow`);
        const response = await apiCall({ method: 'delete', url: `/v1/users/${artistId}/follow` });
        console.log('✅ Unfollow successful:', response.data);
      }
    } catch (err) {
      console.error('❌ Failed to toggle follow:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      
      // Revert if API fails
      setIsFollowing(previousState);
      setFollowerCount(previousCount);
      alert("Something went wrong. Please try again.");
    }
  };

  const handleBioChange = (e) => setBio(e.target.value);

  const handleSaveBio = async () => {
    try {
      await apiCall({
        method: 'put',
        url: `/v1/users/profile/${artistId}/bio`,
        data: { bio }
      });
      alert('Bio updated successfully');
    } catch (err) {
      alert('Failed to update bio');
    }
  };

  const handleVoteSuccess = (id) => {
    setShowVotingWizard(false);
  };

  const handleVote = () => {
    setSelectedNominee({
      id: artistId,
      name: artist.username,
    });
    setShowVotingWizard(true);
  };

  const handlePlayDefault = async () => {
    if (defaultSong && defaultSong.fileUrl) {
      const fullUrl = buildUrl(defaultSong.fileUrl);
      
      playMedia(
        { 
          type: 'song', 
          url: fullUrl, 
          title: defaultSong.title, 
          artist: artist.username, 
          artwork: buildUrl(defaultSong.artworkUrl) || buildUrl(artist.photoUrl)
        },
        []
      );

      if (defaultSong.songId && userId) {
        try {
          await apiCall({ method: 'post', url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}` });
        } catch (err) {
          console.error('Failed to track default song play:', err);
        }
      }
    } else {
      alert('No default song available for this artist');
    }
  };

  const handleSongClick = (songId) => {
    navigate(`/song/${songId}`);
  };

  if (loading) return (
    <Layout backgroundImage={theQuiet}>
      <div style={{ textAlign: 'center', padding: '50px', color: 'white' }}>Loading...</div>
    </Layout>
  );

  if (error || !artist) return (
    <Layout backgroundImage={theQuiet}>
      <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>Artist not found</div>
    </Layout>
  );

  const artistPhoto = artist.photoUrl ? `${API_BASE_URL}${artist.photoUrl}` : theQuiet;
  const topSong = songs.length > 0 ? songs.reduce((prev, current) => (current.score || 0) > (prev.score || 0) ? current : prev, songs[0]) : null;

  // FIXED: Proper check for showing action buttons
  const isCurrentUser = userId === artistId;
  const showActionButtons = !isOwnProfile && !isCurrentUser;

  console.log('🎯 Render checks:', { userId, artistId, isCurrentUser, showActionButtons, isFollowing });

  return (
    <Layout backgroundImage={artistPhoto}>
      <div className="artist-page-container">
        <header className="artist-header">
          <div className="artist-info">
            <div className="artist-top">
              <img src={artistPhoto} alt={artist.username} className="artist-profile-image" />
              <p className="artist-name">{artist.username}</p>
              <p className="artist-jurisdiction" onClick={() => navigate(`/jurisdiction/${artist.jurisdiction.name}`)} style={{cursor: 'pointer'}}>
                {artist.jurisdiction?.name || 'Unknown'}
              </p>
            </div>
            
            <p className="artist-genre">{artist.genre?.name || 'Unknown Genre'}</p>

            {/* Follower Stats */}
            <div className="artist-stats" style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginBottom: '15px', color: '#ccc' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                 <Users size={16} /> {followerCount} Followers
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                 <Heart size={16} /> {artist.score || 0} Score
              </span>
            </div>

            {/* FIXED: All action buttons in one conditional block */}
            {showActionButtons && (
              <div className="follow-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', padding: '0 12px' }}>
                
                {/* Follow Button - Now properly conditional */}
                <button 
                  onClick={handleFollow} 
                  className={`action-btn ${isFollowing ? 'following' : ''}`}
                  style={{
                      padding: '12px 30px',
                      borderRadius: '50px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: '1px solid #C0C0C0',
                      background: isFollowing ? '#163387' : 'transparent',
                      color: isFollowing ? 'white' : '#C0C0C0',
                      textAlign: 'center',
                      transition: 'all 0.3s ease'
                  }}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>

                {/* Other action buttons */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleVote} className="vote-button" style={{ flex: 1 }}>Vote</button>
                  <button 
                    onClick={handlePlayDefault} 
                    className="play-button"
                    disabled={!defaultSong}
                    style={{ flex: 1 }}
                  >
                    Play
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="content-wrapper">
          {/* Fans Pick Section */}
          {topSong && (
            <section className="fans-pick-section card">
              <div className="section-header"><h2>Fans Pick</h2></div>
              <div className="fans-pick-item">
                <img src={buildUrl(topSong.artworkUrl) || artistPhoto} alt={topSong.title} className="song-artwork" />
                <div className="item-info"><h4>{topSong.title}</h4></div>
                <button 
                  className="btn btn-primary btn-small"
                  onClick={() => {
                     const song = songs.find(s => s.songId === topSong.songId);
                     if(song) playMedia({ type: 'song', url: buildUrl(song.fileUrl), title: song.title, artist: artist.username, artwork: buildUrl(song.artworkUrl) || artistPhoto }, []);
                  }}
                >
                  Play
                </button>
              </div>
            </section>
          )}

          {/* Music Section */}
          <section className="music-section card">
            <div className="section-header"><h2>Music</h2></div>
            <div className="songs-list">
              {songs.slice(0, 5).map((song) => (
                <div key={song.songId} className="song-item">
                  <img src={buildUrl(song.artworkUrl) || artistPhoto} alt={song.title} className="song-artwork" />
                  <div className="item-info">
                    <h4 onClick={() => handleSongClick(song.songId)} style={{ cursor: 'pointer' }}>{song.title}</h4>
                  </div>
                  <button 
                    className="btn btn-primary btn-small"
                    onClick={() => playMedia({ type: 'song', url: buildUrl(song.fileUrl), title: song.title, artist: artist.username, artwork: buildUrl(song.artworkUrl) || artistPhoto }, [])}
                  >
                    Play
                  </button>
                </div>
              ))}
              {songs.length === 0 && <p className="empty-message">No songs yet</p>}
            </div>
          </section>

          {/* Bio Section */}
          <section className="bio-section card">
            <div className="section-header"><h2>Bio</h2></div>
            {isOwnProfile ? (
              <>
                <textarea value={bio} onChange={handleBioChange} className="bio-edit" />
                <button onClick={handleSaveBio} className="save-button">Save Bio</button>
              </>
            ) : (
              <p className="bio-text">{bio}</p>
            )}
          </section>

          {/* Social Media Links */}
          <section className="social-section card">
            <div className="section-header"><h2>Social Media</h2></div>
            <div className="social-links">
              <a href={artist.instagramUrl || '#'} target="_blank" rel="noreferrer" className="social-link">📷 Instagram</a>
              <a href={artist.twitterUrl || '#'} target="_blank" rel="noreferrer" className="social-link">𝕏 Twitter</a>
              <a href={artist.tiktokUrl || '#'} target="_blank" rel="noreferrer" className="social-link">🎵 TikTok</a>
            </div>
          </section>
        </div>
      </div>

      <VotingWizard
        show={showVotingWizard}
        onClose={() => setShowVotingWizard(false)}
        onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee}
        filters={{
          selectedGenre: artist.genre?.name?.toLowerCase().replace('/', '-') || 'unknown',
          selectedType: 'artist',
          selectedInterval: 'daily',
          selectedJurisdiction: artist.jurisdiction?.name?.toLowerCase().replace(' ', '-') || 'unknown',
        }}
      />
    </Layout>
  );
};

export default ArtistPage;