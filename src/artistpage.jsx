import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import Layout from './layout';
import './artistpage.scss';
import theQuiet from './assets/theQuiet.jpg';
import VotingWizard from './votingWizard';

const ArtistPage = ({ isOwnProfile = false }) => {
  const { artistId } = useParams();
  const navigate = useNavigate();
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [bio, setBio] = useState('');
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchArtistData();
  }, [artistId]);

  const fetchArtistData = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch artist profile
      const artistRes = await apiCall({ 
        method: 'get', 
        url: `/v1/users/artist/${artistId}` 
      });
      
      const artistData = artistRes.data;
      setArtist(artistData);
      setBio(artistData.bio || 'No bio available');

      // Fetch artist's songs
      const songsRes = await apiCall({ 
        method: 'get', 
        url: `/v1/media/songs/artist/${artistId}` 
      });
      setSongs(songsRes.data || []);

      // Fetch artist's videos
      const videosRes = await apiCall({ 
        method: 'get', 
        url: `/v1/media/videos/artist/${artistId}` 
      });
      setVideos(videosRes.data || []);

    } catch (err) {
      console.error('Failed to load artist:', err);
      setError('Failed to load artist details');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    // TODO: Call backend API to follow/unfollow
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
      console.error('Failed to update bio:', err);
      alert('Failed to update bio');
    }
  };

  const handleVoteSuccess = (id) => {
    console.log(`Vote confirmed for ID: ${id}`);
    setShowVotingWizard(false);
  };

  const handleVote = () => {
    setSelectedNominee({
      id: artistId,
      name: artist.username,
    });
    setShowVotingWizard(true);
  };

  const handleSongClick = (songId) => {
    navigate(`/song/${songId}`);
  };

  if (loading) {
    return (
      <Layout backgroundImage={theQuiet}>
        <div style={{ textAlign: 'center', padding: '50px', color: 'white' }}>
          Loading artist...
        </div>
      </Layout>
    );
  }

  if (error || !artist) {
    return (
      <Layout backgroundImage={theQuiet}>
        <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>
          {error || 'Artist not found'}
        </div>
      </Layout>
    );
  }

  const artistPhoto = artist.photoUrl 
    ? `${API_BASE_URL}${artist.photoUrl}` 
    : theQuiet;

  // Calculate stats (you'll need to add these fields to backend or calculate)
  const rank = `#${artist.rank || '?'}`;
  const followers = artist.followerCount || 0;
  const supporters = artist.supporterCount || 0;
  const voteCount = artist.voteCount || 0;

  // Get top song by score
  const topSong = songs.length > 0 
    ? songs.reduce((prev, current) => 
        (current.score > prev.score) ? current : prev
      )
    : null;

  return (
    <Layout backgroundImage={artistPhoto}>
      <div className="artist-page-container">
        <header className="artist-header">
          <div className="artist-info">
            <div className="artist-top">
              <p className="artist-name">{artist.username}</p>
              <p className="artist-jurisdiction">
                {artist.jurisdiction?.name || 'Unknown'}
              </p>
            </div>
            <p className="artist-genre">
              {artist.genre?.name || 'Unknown Genre'}
            </p>
            <div className="follow-actions">
              <button onClick={handleFollow} className="follow-button">
                {isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              {!isOwnProfile && (
                <button onClick={handleVote} className="vote-button">
                  Vote
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="content-wrapper">
          {/* Stats Grid */}
          <section className="stats-grid">
            <div className="stat-item">
              <p className="stat-value">{rank}</p>
              <p className="stat-label">Rank</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{followers}</p>
              <p className="stat-label">Followers</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{supporters}</p>
              <p className="stat-label">Supporters</p>
            </div>
            <div className="stat-item">
              <p className="stat-value">{voteCount}</p>
              <p className="stat-label">Votes</p>
            </div>
          </section>

          {/* Fans Pick Section */}
          {topSong && (
            <section className="fans-pick-section card">
              <h2>Fans Pick</h2>
              <ul>
                <li 
                  onClick={() => handleSongClick(topSong.songId)}
                  style={{ cursor: 'pointer' }}
                >
                  {topSong.title} (Score: {topSong.score})
                </li>
              </ul>
            </section>
          )}

          {/* Music (Songs) Section */}
          <section className="music-section card">
            <h2>Music</h2>
            <ul>
              {songs.slice(0, 5).map((song) => (
                <li 
                  key={song.songId}
                  onClick={() => handleSongClick(song.songId)}
                  style={{ cursor: 'pointer' }}
                >
                  <span>{song.title}</span>
                  {isOwnProfile && (
                    <button className="edit-button">Edit/Remove</button>
                  )}
                </li>
              ))}
              {songs.length === 0 && <p>No songs yet</p>}
            </ul>
            {isOwnProfile && songs.length < 5 && (
              <button className="upload-button">Upload Song</button>
            )}
          </section>

          {/* Bio Section */}
          <section className="bio-section card">
            <h2>Bio</h2>
            {isOwnProfile ? (
              <>
                <textarea 
                  value={bio} 
                  onChange={handleBioChange} 
                  className="bio-edit" 
                />
                <button onClick={handleSaveBio} className="save-button">
                  Save Bio
                </button>
              </>
            ) : (
              <p>{bio}</p>
            )}
          </section>

          {/* Videos Section */}
          <section className="videos-section card">
            <h2>Videos</h2>
            <ul>
              {videos.map((video) => (
                <li key={video.videoId}>
                  <span>{video.title}</span>
                  {isOwnProfile && (
                    <button className="edit-button">Edit/Remove</button>
                  )}
                </li>
              ))}
              {videos.length === 0 && <p>No videos yet</p>}
            </ul>
            {isOwnProfile && (
              <button className="upload-button">Upload Video</button>
            )}
          </section>

          {/* Social Media Links */}
          <section className="social-section card">
            <h2>Social Media</h2>
            <div className="social-links">
              {artist.socialLinks?.map((link, index) => (
                <a 
                  key={index} 
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="social-link"
                >
                  <span>{link.icon}</span> {link.label}
                </a>
              )) || <p>No social links added</p>}
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