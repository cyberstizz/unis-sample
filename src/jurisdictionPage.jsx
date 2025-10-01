import React from 'react';
import { Star, Music, Trophy, Play, Heart, Eye, MapPin } from 'lucide-react';
import './jurisdictionPage.scss'; 
import Layout from './layout';
import areaSymbol from './assets/apollopic.jpg';
import prominentArtistBg from './assets/songartworkfour.jpeg';
import albumArt from './assets/songartworktwo.jpeg';

const JurisdictionPage = ({ jurisdiction = 'Harlem' }) => {
  
  const data = {
    symbolImage: areaSymbol, 
    artistOfMonth: {
      name: 'Tony Fadd',
      image: prominentArtistBg,
      bio: 'Harlem\'s rising star blending hip-hop with soulful vibes.',
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
      thumbnail: prominentArtistBg, // Placeholder thumbnail
    })),
    topSongs: Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      rank: i + 1,
      title: `Song ${i + 1}`,
      artist: `Artist ${i + 1}`,
      plays: Math.floor(Math.random() * 10000),
      likes: Math.floor(Math.random() * 1000),
      thumbnail: prominentArtistBg, // Placeholder
    })),
  };

  return (
    <Layout backgroundImage={data.artistOfMonth.image}> {/* Prominent artist as bg */}
      <div className="jurisdiction-dashboard"> {/* Similar to .artist-dashboard */}
        <div className="dashboard-content">
          {/* Header */}
          <div className="dashboard-header">
            <h1 style={{padding: "auto"}}>{jurisdiction} Hub</h1>
            <p>Discover local talent, top tracks, and rising stars in {jurisdiction}</p>
          </div>

          {/* Jurisdiction Symbol Hero */}
          <div className="jurisdiction-hero card">
            <img 
              src={data.symbolImage} 
              alt={`${jurisdiction} symbol`}
              className="hero-image"
            />
            <div className="hero-overlay">
              <MapPin size={32} />
              <h2>Explore {jurisdiction}</h2>
              <p>Across a hundred and tength street!</p>
            </div>
          </div>

          {/* Highlights Grid (Artist of Month + Song of Week) */}
          <div className="highlights-grid"> {/* Like .stats-grid but 2-col */}
            <div className="highlight-card card">
              <div className="section-header">
                <h3><Trophy size={20} /> #1 Artist in Harlem</h3>
              </div>
              <div className="highlight-content">
                <img 
                  src={data.artistOfMonth.image} 
                  alt={data.artistOfMonth.name}
                  className="profile-image" 
                />
                <div className="highlight-info">
                  <h4>{data.artistOfMonth.name}</h4>
                  <p className="bio">{data.artistOfMonth.bio}</p>
                  <div className="item-stats"> {/* Reuse */}
                    <span><Heart size={14} /> {data.artistOfMonth.supporters.toLocaleString()} supporters</span>
                    <span><Eye size={14} /> {data.artistOfMonth.plays.toLocaleString()} plays</span>
                  </div>
                  <button className="btn btn-primary">Listen Now</button>
                </div>
              </div>
            </div>

            <div className="highlight-card card" style={{ backgroundImage: `url(${data.songOfWeek.image})`, backgroundSize: 'cover', backgroundPosition: 'center', }}>
              <div className="section-header" >
                <h3><Star size={20} /> #1 Song in Harlem</h3>
              </div>
              <div className="highlight-content">
                <div className="song-icon"> {/* Reuse from main-song-card */}
                  <Play size={28} fill="white" />
                </div>
                <div className="highlight-info">
                  <h4>{data.songOfWeek.title}</h4>
                  <p>by {data.songOfWeek.artist}</p>
                  <div className="item-stats">
                    <span><Eye size={14} /> {data.songOfWeek.plays.toLocaleString()} plays</span>
                    <span><Heart size={14} /> {data.songOfWeek.likes.toLocaleString()} likes</span>
                  </div>
                  <button className="btn btn-primary">Play</button>
                </div>
              </div>
            </div>
          </div>

          {/* Top Lists Grid */}
          <div className="content-grid"> {/* Reuse for 2-col layout */}
            {/* Top 30 Artists */}
            <div className="content-section card">
              <div className="section-header">
                <h3 className='specialThirty'><Music size={20} /> Top 30 Artists in Harlem</h3>
                <button className="link-button">View More</button>
              </div>
              <div className="content-list scrollable"> {/* Add scroll if needed */}
                {data.topArtists.map((artist) => (
                  <div key={artist.id} className="content-item top-item"> {/* Reuse + new for circle option */}
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
                <h3 className='specialThirty'><Play size={20} /> Top 30 Songs in Harlem</h3>
                <button className="link-button">View More</button>
              </div>
              <div className="content-list scrollable">
                {data.topSongs.map((song) => (
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
        </div>
      </div>
    </Layout>
  );
};

export default JurisdictionPage;