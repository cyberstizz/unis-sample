import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Music, Trophy, Play, Heart, Eye, MapPin } from 'lucide-react';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import './jurisdictionPage.scss'; 
import Layout from './layout';
import areaSymbol from './assets/apollopic.jpg';
import prominentArtistBg from './assets/songartworkfour.jpeg';
import albumArt from './assets/songartworktwo.jpeg';

const JurisdictionPage = ({ jurisdiction = 'Harlem' }) => {  
  const { jurisdiction: jurNameFromParams } = useParams();  
  const jurName = jurNameFromParams || jurisdiction;
  const navigate = useNavigate();
  const { playMedia } = useContext(PlayerContext);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);  
  const [userId, setUserId] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // Helper to build URLs
  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `${API_BASE_URL}${url}`;
  };

  // Get userId from token
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

  // Fetch jurisdiction data
  useEffect(() => {
    const fetchData = async () => {
      if (!jurName) {
        setError('No jurisdiction specified.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);

        // Step 1: Get jurisdiction ID by name
        const jurResponse = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/byName/${encodeURIComponent(jurName)}`,
        });
        const { jurisdictionId: jurId, jurisdiction: jurDetails } = jurResponse.data;
        if (!jurId) throw new Error('Jurisdiction not found');

        // Step 2: Get tops
        const topsResponse = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${jurId}/tops`,
        });
        const rawData = { ...topsResponse.data, jurisdiction: jurDetails };

        // Normalize - NO FALLBACKS, only real data
        const topArtist = rawData.topArtist || (rawData.topArtists || [])[0];
        const topSong = rawData.topSong || (rawData.topSongs || [])[0];

        const normalized = {
          symbolImage: rawData.jurisdiction.symbolUrl
            ? buildUrl(rawData.jurisdiction.symbolUrl)
            : areaSymbol,
          description: rawData.jurisdiction.bio || `Explore ${jurName}`,
          
          // Only set if exists
          artistOfMonth: topArtist ? {
            id: topArtist.userId,
            name: topArtist.username,
            image: buildUrl(topArtist.photoUrl) || prominentArtistBg,
            bio: topArtist.bio || "Rising star in the community.",
            supporters: topArtist.score || 0,
            plays: topArtist.score || 0,
          } : null,
          
          // Only set if exists
          songOfWeek: topSong ? {
            id: topSong.songId,
            title: topSong.title,
            artist: topSong.artist?.username || 'Unknown',
            artistId: topSong.artist?.userId,
            plays: topSong.plays || topSong.score || 0,
            likes: topSong.likes || 0,
            image: buildUrl(topSong.artworkUrl) || albumArt,
            fileUrl: buildUrl(topSong.fileUrl),
          } : null,
          
          // Only real artists, no dummies
          topArtists: (rawData.topArtists || []).map((artist, i) => ({
            id: artist.userId,
            rank: i + 1,
            name: artist.username,
            supporters: artist.score || 0,
            plays: artist.score || 0,
            thumbnail: buildUrl(artist.photoUrl) || prominentArtistBg,
          })),
          
          // Only real songs, no dummies
          topSongs: (rawData.topSongs || []).map((song, i) => ({
            id: song.songId,
            rank: i + 1,
            title: song.title,
            artist: song.artist?.username || 'Unknown',
            artistId: song.artist?.userId,
            plays: song.plays || song.score || 0,
            likes: song.likes || 0,
            thumbnail: buildUrl(song.artworkUrl) || prominentArtistBg,
            fileUrl: buildUrl(song.fileUrl),
          })),
        };
        
        setData(normalized);
      } catch (err) {
        console.error('Jurisdiction fetch error:', err);
        setError(`Failed to load data for ${jurName}.`);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jurName]);

  // Play top artist's default song
  const handlePlayTopArtist = async () => {
    if (!data?.artistOfMonth) return;
    
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/users/${data.artistOfMonth.id}/default-song`,
      });
      const defaultSong = response.data;
      
      if (defaultSong && defaultSong.fileUrl) {
        const fullUrl = buildUrl(defaultSong.fileUrl);
        
        playMedia(
          { 
            type: 'song', 
            url: fullUrl, 
            title: defaultSong.title, 
            artist: data.artistOfMonth.name, 
            artwork: buildUrl(defaultSong.artworkUrl) || data.artistOfMonth.image
          },
          []
        );

        // Track the play
        if (defaultSong.songId && userId) {
          try {
            await apiCall({ 
              method: 'post', 
              url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}` 
            });
            console.log('✅ Top artist play tracked');
          } catch (err) {
            console.error('❌ Failed to track play:', err);
          }
        }
      } else {
        alert('No default song available for this artist');
      }
    } catch (err) {
      console.error('Failed to fetch default song:', err);
      alert('Could not load artist\'s song');
    }
  };

  // Play top song
  const handlePlayTopSong = async () => {
    if (!data?.songOfWeek?.fileUrl) {
      alert('Song not available');
      return;
    }

    playMedia(
      { 
        type: 'song', 
        url: data.songOfWeek.fileUrl, 
        title: data.songOfWeek.title, 
        artist: data.songOfWeek.artist, 
        artwork: data.songOfWeek.image
      },
      []
    );

    // Track the play
    if (data.songOfWeek.id && userId) {
      try {
        await apiCall({ 
          method: 'post', 
          url: `/v1/media/song/${data.songOfWeek.id}/play?userId=${userId}` 
        });
        console.log('✅ Top song play tracked');
      } catch (err) {
        console.error('❌ Failed to track play:', err);
      }
    }
  };

  // Play artist from list
  const handlePlayArtist = async (artist) => {
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/users/${artist.id}/default-song`,
      });
      const defaultSong = response.data;
      
      if (defaultSong && defaultSong.fileUrl) {
        const fullUrl = buildUrl(defaultSong.fileUrl);
        
        playMedia(
          { 
            type: 'song', 
            url: fullUrl, 
            title: defaultSong.title, 
            artist: artist.name, 
            artwork: buildUrl(defaultSong.artworkUrl) || artist.thumbnail
          },
          []
        );

        // Track the play
        if (defaultSong.songId && userId) {
          try {
            await apiCall({ 
              method: 'post', 
              url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}` 
            });
            console.log('✅ Artist play tracked');
          } catch (err) {
            console.error('❌ Failed to track play:', err);
          }
        }
      } else {
        alert(`${artist.name} has no default song`);
      }
    } catch (err) {
      console.error('Failed to fetch default song:', err);
      alert('Could not load artist\'s song');
    }
  };

  // Play song from list
  const handlePlaySong = async (song) => {
    if (!song.fileUrl) {
      alert('Song not available');
      return;
    }

    playMedia(
      { 
        type: 'song', 
        url: song.fileUrl, 
        title: song.title, 
        artist: song.artist, 
        artwork: song.thumbnail
      },
      []
    );

    // Track the play
    if (song.id && userId) {
      try {
        await apiCall({ 
          method: 'post', 
          url: `/v1/media/song/${song.id}/play?userId=${userId}` 
        });
        console.log(`Song play tracked for ${song.id}`);
      } catch (err) {
        console.error('Failed to track play:', err);
      }
    }
  };

  // Navigate to pages
  const handleViewArtist = (artistId) => {
    navigate(`/artist/${artistId}`);
  };

  const handleViewSong = (songId) => {
    navigate(`/song/${songId}`);
  };

  if (loading) {
    return (
      <Layout backgroundImage={prominentArtistBg}>
        <div className="loading" style={{ textAlign: 'center', padding: '50px', color: 'white' }}>
          Loading {jurName}...
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout backgroundImage={prominentArtistBg}>
        <div className="error" style={{ textAlign: 'center', padding: '50px', color: 'red' }}>
          {error || `No data available for ${jurName}`}
        </div>
      </Layout>
    );
  }

  return (
    <Layout backgroundImage={data.artistOfMonth?.image || prominentArtistBg}>
      <div className="jurisdiction-dashboard">
        <div className="dashboard-content">
          {/* Header */}
          <div className="dashboard-header">
            <h1>{jurName}</h1>
            <p>Discover local talent, top tracks, and rising stars in {jurName}</p>
          </div>

          {/* Jurisdiction Symbol Hero */}
          <div className="jurisdiction-hero card">
            <img
              src={data.symbolImage}
              alt={`${jurName} symbol`}
              className="hero-image"
            />
            <div className="hero-overlay">
              <MapPin size={32} />
              <h2>Explore {jurName}</h2>
              <p>{data.description}</p>
            </div>
          </div>

          {/* Highlights Grid */}
          <div className="highlights-grid">
            {/* Top Artist */}
            {data.artistOfMonth && (
              <div className="highlight-card card">
                <div className="section-header">
                  <h3><Trophy size={20} /> #1 Artist in {jurName}</h3>
                </div>
                <div className="highlight-content">
                  <img
                    src={data.artistOfMonth.image}
                    alt={data.artistOfMonth.name}
                    className="profile-image"
                    onClick={() => handleViewArtist(data.artistOfMonth.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div className="highlight-info">
                    <h4 onClick={() => handleViewArtist(data.artistOfMonth.id)} style={{ cursor: 'pointer' }}>
                      {data.artistOfMonth.name}
                    </h4>
                    <p className="bio">{data.artistOfMonth.bio}</p>
                    <div className="item-stats">
                      <span><Heart size={14} /> {data.artistOfMonth.supporters.toLocaleString()} supporters</span>
                      <span><Eye size={14} /> {data.artistOfMonth.plays.toLocaleString()} plays</span>
                    </div>
                    <button className="btn btn-primary" onClick={handlePlayTopArtist}>
                      Listen Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Top Song */}
            {data.songOfWeek && (
              <div
                className="highlight-card card"
                style={{
                  backgroundImage: `url(${data.songOfWeek.image})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="section-header">
                  <h3><Star size={20} /> #1 Song in {jurName}</h3>
                </div>
                <div className="highlight-content">
                  <div className="song-icon">
                    <Play size={28} fill="white" />
                  </div>
                  <div className="highlight-info">
                    <h4 onClick={() => handleViewSong(data.songOfWeek.id)} style={{ cursor: 'pointer' }}>
                      {data.songOfWeek.title}
                    </h4>
                    <p>by {data.songOfWeek.artist}</p>
                    <div className="item-stats">
                      <span><Eye size={14} /> {data.songOfWeek.plays.toLocaleString()} plays</span>
                      <span><Heart size={14} /> {data.songOfWeek.likes.toLocaleString()} likes</span>
                    </div>
                    <button className="btn btn-primary" onClick={handlePlayTopSong}>
                      Play
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Lists Grid */}
          <div className="content-grid">
            {/* Top Artists */}
            <div className="content-section card">
              <div className="section-header">
                <h3 className="specialThirty">
                  <Music size={20} /> Top {data.topArtists.length} Artists in {jurName}
                </h3>
              </div>
              <div className="content-list scrollable">
                {data.topArtists.length > 0 ? (
                  data.topArtists.map((artist) => (
                    <div key={artist.id} className="content-item top-item">
                      <span className="rank-badge">{artist.rank}</span>
                      <img
                        src={artist.thumbnail}
                        alt={artist.name}
                        className="top-thumbnail"
                        onClick={() => handleViewArtist(artist.id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div className="item-header" onClick={() => handleViewArtist(artist.id)} style={{ cursor: 'pointer' }}>
                        <h4>{artist.name}</h4>
                      </div>
                      <div className="item-stats">
                        <span><Heart size={12} /> {artist.supporters.toLocaleString()}</span>
                        <span><Eye size={12} /> {artist.plays.toLocaleString()}</span>
                      </div>
                      <button 
                        className="btn btn-primary" 
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => handlePlayArtist(artist)}
                      >
                        Play
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ padding: '1rem', color: '#aaa' }}>No artists yet in {jurName}</p>
                )}
              </div>
            </div>

            {/* Top Songs */}
            <div className="content-section card">
              <div className="section-header">
                <h3 className="specialThirty">
                  <Play size={20} /> Top {data.topSongs.length} Songs in {jurName}
                </h3>
              </div>
              <div className="content-list scrollable">
                {data.topSongs.length > 0 ? (
                  data.topSongs.map((song) => (
                    <div key={song.id} className="content-item top-item">
                      <span className="rank-badge">{song.rank}</span>
                      <img
                        src={song.thumbnail}
                        alt={song.title}
                        className="top-thumbnail"
                        onClick={() => handleViewSong(song.id)}
                        style={{ cursor: 'pointer' }}
                      />
                      <div className="item-header" onClick={() => handleViewSong(song.id)} style={{ cursor: 'pointer' }}>
                        <h4>{song.title}</h4>
                        <p>by {song.artist}</p>
                      </div>
                      <div className="item-stats">
                        <span><Eye size={12} /> {song.plays.toLocaleString()}</span>
                        <span><Heart size={12} /> {song.likes.toLocaleString()}</span>
                      </div>
                      <button 
                        className="btn btn-primary" 
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => handlePlaySong(song)}
                      >
                        Play
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ padding: '1rem', color: '#aaa' }}>No songs yet in {jurName}</p>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="error-banner" style={{ textAlign: 'center', color: 'orange', padding: '10px' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default JurisdictionPage;