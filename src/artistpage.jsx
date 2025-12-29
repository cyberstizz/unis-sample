import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import Layout from './layout';
import './artistpage.scss';
import theQuiet from './assets/theQuiet.jpg';
import VotingWizard from './votingWizard';


const ArtistPage = ({ isOwnProfile = false }) => {
  const { artistId } = useParams();
  const { playMedia } = useContext(PlayerContext);
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
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
    fetchArtistData();
  }, [artistId]);

  const fetchArtistData = async () => {
    setLoading(true);
    setError('');
    console.log('Fetching artist data for ID:', artistId);
    
    try {
      // Fetch artist profile - FIXED: Use correct route
      console.log('Calling: GET /v1/users/profile/' + artistId);
      const artistRes = await apiCall({ 
        method: 'get', 
        url: `/v1/users/profile/${artistId}` 
      });
      
      const artistData = artistRes.data;
      console.log('Artist profile loaded:', artistData);
      
      if (!artistData || !artistData.username) {
        throw new Error('Artist data is missing required fields');
      }
      
      setArtist(artistData);
      setBio(artistData.bio || 'No bio available');

      // Fetch artist's songs
      console.log('Calling: GET /v1/media/songs/artist/' + artistId);
      const songsRes = await apiCall({ 
        method: 'get', 
        url: `/v1/media/songs/artist/${artistId}` 
      });
      const songsData = songsRes.data || [];
      console.log('Songs loaded:', songsData);
      setSongs(Array.isArray(songsData) ? songsData : []);

      // Fetch artist's videos
      console.log('Calling: GET /v1/media/videos/artist/' + artistId);
      const videosRes = await apiCall({ 
        method: 'get', 
        url: `/v1/media/videos/artist/${artistId}` 
      });
      const videosData = videosRes.data || [];
      console.log('Videos loaded:', videosData);
      setVideos(Array.isArray(videosData) ? videosData : []);

      // Fetch default song
      try {
        console.log('Calling: GET /v1/users/' + artistId + '/default-song');
        const defaultSongRes = await apiCall({
          method: 'get',
          url: `/v1/users/${artistId}/default-song`
        });
        console.log('Default song loaded:', defaultSongRes.data);
        setDefaultSong(defaultSongRes.data);
      } catch (err) {
        console.warn('No default song available');
        setDefaultSong(null);
      }

    } catch (err) {
      console.error('Failed to load artist:', err);
      console.error('Error message:', err.message);
      setError(err.message || 'Failed to load artist details');
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

  //Handle playing default song
  const handlePlayDefault = async () => {
      if (defaultSong && defaultSong.fileUrl) {
        const fullUrl = buildUrl(defaultSong.fileUrl);
        console.log('Playing default song:', defaultSong.title, fullUrl);
        
        // Play the song
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

        // Track the play
        if (defaultSong.songId && userId) {
          try {
            const endpoint = `/v1/media/song/${defaultSong.songId}/play?userId=${userId}`;
            console.log('Tracking default song play:', { endpoint, songId: defaultSong.songId, userId });
            await apiCall({ method: 'post', url: endpoint });
            console.log('Default song play tracked successfully');
          } catch (err) {
            console.error('Failed to track default song play:', err);
          }
        } else {
          console.warn('Could not track play - missing songId or userId:', { 
            songId: defaultSong.songId, 
            userId 
          });
        }
      } else {
        alert('No default song available for this artist');
      }
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

  // Calculate stats
  const rank = `#${artist.rank || '?'}`;
  const followers = artist.followerCount || 0;
  const supporters = artist.supporterCount || 0;
  const voteCount = artist.voteCount || 0;

  // FIXED: Get top song with safety check
  const topSong = songs.length > 0 && Array.isArray(songs)
    ? songs.reduce((prev, current) => {
        const prevScore = prev.score || 0;
        const currentScore = current.score || 0;
        return currentScore > prevScore ? current : prev;
      }, songs[0])
    : null;

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
            <p className="artist-genre">
              {artist.genre?.name || 'Unknown Genre'}
            </p>
            <div className="follow-actions">
             
              {!isOwnProfile && (
                <>
                  <button onClick={handleVote} className="vote-button">
                    Vote
                  </button>
                  {/* ADDED: Play Default Song button */}
                  <button 
                    onClick={handlePlayDefault} 
                    className="play-button"
                    disabled={!defaultSong}
                  >
                    Play
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="content-wrapper">
      

          {/* Fans Pick Section */}
          {topSong && (
            <section className="fans-pick-section card">
              <div className="section-header">
                <h2>Fans Pick</h2>
              </div>
              <div className="fans-pick-item">
                <img 
                  src={buildUrl(topSong.artworkUrl) || artistPhoto} 
                  alt={topSong.title}
                  className="song-artwork"
                />
                <div className="item-info">
                  <h4>{topSong.title}</h4>
                </div>
                <button 
                  className="btn btn-primary btn-small"
                  onClick={async () => {
                    const song = songs.find(s => s.songId === topSong.songId);
                    if (song && song.fileUrl) {
                      const fullUrl = buildUrl(song.fileUrl);
                      
                      playMedia(
                        { 
                          type: 'song', 
                          url: fullUrl, 
                          title: song.title, 
                          artist: artist.username, 
                          artwork: buildUrl(song.artworkUrl) || artistPhoto
                        },
                        []
                      );

                      // Track the play
                      if (song.songId && userId) {
                        try {
                          await apiCall({ 
                            method: 'post', 
                            url: `/v1/media/song/${song.songId}/play?userId=${userId}` 
                          });
                          console.log('Fans pick play tracked');
                        } catch (err) {
                          console.error('Failed to track play:', err);
                        }
                      }
                    }
                  }}
                >
                  Play
                </button>
              </div>
            </section>
          )}

          {/* Music (Songs) Section */}
          <section className="music-section card">
            <div className="section-header">
              <h2>Music</h2>
            </div>
            <div className="songs-list">
              {songs.slice(0, 5).map((song) => (
                <div key={song.songId} className="song-item">
                  <img 
                    src={buildUrl(song.artworkUrl) || artistPhoto} 
                    alt={song.title}
                    className="song-artwork"
                  />
                  <div className="item-info">
                    <h4 onClick={() => handleSongClick(song.songId)} style={{ cursor: 'pointer' }}>
                      {song.title}
                    </h4>
                  </div>
                  <button 
                    className="btn btn-primary btn-small"
                    onClick={async () => {
                      if (song.fileUrl) {
                        const fullUrl = buildUrl(song.fileUrl);
                        
                        playMedia(
                          { 
                            type: 'song', 
                            url: fullUrl, 
                            title: song.title, 
                            artist: artist.username, 
                            artwork: buildUrl(song.artworkUrl) || artistPhoto
                          },
                          []
                        );

                        // Track the play
                        if (song.songId && userId) {
                          try {
                            await apiCall({ 
                              method: 'post', 
                              url: `/v1/media/song/${song.songId}/play?userId=${userId}` 
                            });
                            console.log(`Song play tracked for ${song.songId}`);
                          } catch (err) {
                            console.error('Failed to track play:', err);
                          }
                        }
                      }
                    }}
                  >
                    Play
                  </button>
                  {isOwnProfile && (
                    <button className="edit-button">Edit/Remove</button>
                  )}
                </div>
              ))}
              {songs.length === 0 && <p className="empty-message">No songs yet</p>}
            </div>
            {isOwnProfile && songs.length < 5 && (
              <button className="upload-button">Upload Song</button>
            )}
          </section>

          {/* Bio Section */}
          <section className="bio-section card">
            <div className="section-header">
              <h2>Bio</h2>
            </div>
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
              <p className="bio-text">{bio}</p>
            )}
          </section>

          {/* Videos Section */}
          {/* <section className="videos-section card">
            <div className="section-header">
              <h2>Videos</h2>
            </div>
            <ul>
              {videos.map((video) => (
                <li key={video.videoId}>
                  <span>{video.title}</span>
                  {isOwnProfile && (
                    <button className="edit-button">Edit/Remove</button>
                  )}
                </li>
              ))}
              {videos.length === 0 && <p className="empty-message">No videos yet</p>}
            </ul>
            {isOwnProfile && (
              <button className="upload-button">Upload Video</button>
            )}
          </section> */}

          {/* Social Media Links */}
          <section className="social-section card">
            <div className="section-header">
              <h2>Social Media</h2>
            </div>
            <div className="social-links">
              {/* Top 3 social media platforms with icons */}
              <a 
                href={artist.instagramUrl || '#'} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="social-link"
                onClick={(e) => {
                  if (!artist.instagramUrl) {
                    e.preventDefault();
                    alert('Instagram link not set. Click Edit Profile to add your social links.');
                  }
                }}
              >
                <span className="social-icon instagram-icon">📷</span> Instagram
              </a>
              
              <a 
                href={artist.twitterUrl || '#'} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="social-link"
                onClick={(e) => {
                  if (!artist.twitterUrl) {
                    e.preventDefault();
                    alert('Twitter/X link not set. Click Edit Profile to add your social links.');
                  }
                }}
              >
                <span className="social-icon twitter-icon">𝕏</span> Twitter / X
              </a>
              
              <a 
                href={artist.tiktokUrl || '#'} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="social-link"
                onClick={(e) => {
                  if (!artist.tiktokUrl) {
                    e.preventDefault();
                    alert('TikTok link not set. Click Edit Profile to add your social links.');
                  }
                }}
              >
                <span className="social-icon tiktok-icon">🎵</span> TikTok
              </a>

              {/* Custom social links if any */}
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
              ))}
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