import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';  // Optional if using props
import { Star, Music, Trophy, Play, Heart, Eye, MapPin } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './jurisdictionPage.scss'; 
import Layout from './layout';
import areaSymbol from './assets/apollopic.jpg';
import prominentArtistBg from './assets/songartworkfour.jpeg';
import albumArt from './assets/songartworktwo.jpeg';
import backimage from './assets/randomrapper.jpeg';

const JurisdictionPage = ({ jurisdiction = 'Harlem' }) => {  // Keep prop as fallback
  const { jurisdiction: jurNameFromParams } = useParams();  // If routed; else use prop
  const jurName = jurNameFromParams || jurisdiction;  // Prioritize param
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fallbackData] = useState({
    symbolImage: areaSymbol,
    artistOfMonth: {
      name: 'Tony Fadd',
      image: prominentArtistBg,
      bio: "Harlem's rising star blending hip-hop with soulful vibes.",
      supporters: 3421,
      plays: 45230,
    },
    songOfWeek: {
      title: 'Paranoid',
      artist: 'Tony Fadd',
      plays: 15420,
      likes: 892,
      image: albumArt,
    },
    topArtists: Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      rank: i + 1,
      name: `Artist ${i + 1}`,
      supporters: Math.floor(Math.random() * 5000),
      plays: Math.floor(Math.random() * 10000),
      thumbnail: prominentArtistBg,
    })),
    topSongs: Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      rank: i + 1,
      title: `Song ${i + 1}`,
      artist: `Artist ${i + 1}`,
      plays: Math.floor(Math.random() * 10000),
      likes: Math.floor(Math.random() * 1000),
      thumbnail: prominentArtistBg,
    })),
  });
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

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

        // Step 2: Get tops (your method's Map)
        const topsResponse = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${jurId}/tops`,
        });
        const rawData = { ...topsResponse.data, jurisdiction: jurDetails };

        // Normalize (use your Map; slice [0] for #1 if not separate)
        const topArtist = rawData.topArtist || (rawData.topArtists || [])[0];
        const topSong = rawData.topSong || (rawData.topSongs || [])[0];

        const normalized = {
          symbolImage: rawData.jurisdiction.symbolUrl
            ? `${API_BASE_URL}${rawData.jurisdiction.symbolUrl}`
            : fallbackData.symbolImage,
          description: rawData.jurisdiction.bio || `Explore ${jurName}`,
          artistOfMonth: topArtist
            ? {
                name: topArtist.username,
                image: topArtist.photoUrl ? `${API_BASE_URL}${topArtist.photoUrl}` : prominentArtistBg,
                bio: topArtist.bio || "Rising star in the community.",
                supporters: topArtist.score || 0,
                plays: topArtist.score || 0,
              }
            : fallbackData.artistOfMonth,
          songOfWeek: topSong
            ? {
                title: topSong.title,
                artist: topSong.artist?.username || 'Unknown',
                plays: topSong.plays || topSong.score || 0,
                likes: topSong.likes || 0,
                image: topSong.artworkUrl ? `${API_BASE_URL}${topSong.artworkUrl}` : albumArt,
              }
            : fallbackData.songOfWeek,
          topArtists: (rawData.topArtists || []).map((artist, i) => ({
            id: artist.userId || i,
            rank: i + 1,
            name: artist.username,
            supporters: artist.score || 0,
            plays: artist.score || 0,
            thumbnail: artist.photoUrl ? `${API_BASE_URL}${artist.photoUrl}` : prominentArtistBg,
          })).concat(fallbackData.topArtists.slice((rawData.topArtists || []).length)),
          topSongs: (rawData.topSongs || []).map((song, i) => ({
            id: song.songId || i,
            rank: i + 1,
            title: song.title,
            artist: song.artist?.username || 'Unknown',
            plays: song.plays || song.score || 0,
            likes: song.likes || 0,
            thumbnail: song.artworkUrl ? `${API_BASE_URL}${song.artworkUrl}` : prominentArtistBg,
          })).concat(fallbackData.topSongs.slice((rawData.topSongs || []).length)),
        };
        setData(normalized);
      } catch (err) {
        console.error('Jurisdiction fetch error:', err);
        setError(`Failed to load data for ${jurName}. Using fallback.`);
        setData(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jurName]);

  const renderData = data || fallbackData;

  if (loading) {
    return (
      <Layout backgroundImage={prominentArtistBg}>
        <div className="loading" style={{ textAlign: 'center', padding: '50px' }}>
          Loading {jurName}...
        </div>
      </Layout>
    );
  }

  return (
    <Layout backgroundImage={renderData.artistOfMonth.image}>
      <div className="jurisdiction-dashboard">
        <div className="dashboard-content">
          {/* Header */}
          <div className="dashboard-header">
            <h1 style={{ padding: "auto" }}>{jurName}</h1>
            <p>Discover local talent, top tracks, and rising stars in {jurName}</p>
          </div>

          {/* Jurisdiction Symbol Hero */}
          <div className="jurisdiction-hero card">
            <img
              src={renderData.symbolImage}
              alt={`${jurName} symbol`}
              className="hero-image"
            />
            <div className="hero-overlay">
              <MapPin size={32} />
              <h2>Explore {jurName}</h2>
              <p>{renderData.description}</p>
            </div>
          </div>

          {/* Highlights Grid */}
          <div className="highlights-grid">
            <div className="highlight-card card">
              <div className="section-header">
                <h3><Trophy size={20} /> #1 Artist in {jurName}</h3>
              </div>
              <div className="highlight-content" style={{backgroundSize: "contain"}}>
                <img
                  src={renderData.artistOfMonth.image}
                  alt={renderData.artistOfMonth.name}
                  className="profile-image"
                />
                <div className="highlight-info">
                  <h4>{renderData.artistOfMonth.name}</h4>
                  <p className="bio">{renderData.artistOfMonth.bio}</p>
                  <div className="item-stats">
                    <span><Heart size={14} /> {renderData.artistOfMonth.supporters.toLocaleString()} supporters</span>
                    <span><Eye size={14} /> {renderData.artistOfMonth.plays.toLocaleString()} plays</span>
                  </div>
                  <button className="btn btn-primary">Listen Now</button>
                </div>
              </div>
            </div>

            <div
              className="highlight-card card"
              style={{
                backgroundImage: `url(${renderData.songOfWeek.image})`,
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
                  <h4>{renderData.songOfWeek.title}</h4>
                  <p>by {renderData.songOfWeek.artist}</p>
                  <div className="item-stats">
                    <span><Eye size={14} /> {renderData.songOfWeek.plays.toLocaleString()} plays</span>
                    <span><Heart size={14} /> {renderData.songOfWeek.likes.toLocaleString()} likes</span>
                  </div>
                  <button className="btn btn-primary">Play</button>
                </div>
              </div>
            </div>
          </div>

          {/* Top Lists Grid */}
          <div className="content-grid">
            {/* Top 30 Artists */}
            <div className="content-section card">
              <div className="section-header">
                <h3 className="specialThirty">
                  <Music size={20} /> Top 30 Artists in {jurName}
                </h3>
                <button className="link-button">View More</button>
              </div>
              <div className="content-list scrollable">
                {renderData.topArtists.map((artist) => (
                  <div key={artist.id} className="content-item top-item">
                    <span className="rank-badge">{artist.rank}</span>
                    <img
                      src={artist.thumbnail}
                      alt={artist.name}
                      className="top-thumbnail"
                    />
                    <div className="item-header">
                      <h4>{artist.name}</h4>
                    </div>
                    <div className="item-stats">
                      <span><Heart size={12} /> {artist.supporters.toLocaleString()}</span>
                      <span><Eye size={12} /> {artist.plays.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 30 Songs */}
            <div className="content-section card">
              <div className="section-header">
                <h3 className="specialThirty">
                  <Play size={20} /> Top 30 Songs in {jurName}
                </h3>
                <button className="link-button">View More</button>
              </div>
              <div className="content-list scrollable">
                {renderData.topSongs.map((song) => (
                  <div key={song.id} className="content-item top-item">
                    <span className="rank-badge">{song.rank}</span>
                    <img
                      src={song.thumbnail}
                      alt={song.title}
                      className="top-thumbnail"
                    />
                    <div className="item-header">
                      <h4>{song.title}</h4>
                      <p>by {song.artist}</p>
                    </div>
                    <div className="item-stats">
                      <span><Eye size={12} /> {song.plays.toLocaleString()}</span>
                      <span><Heart size={12} /> {song.likes.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
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