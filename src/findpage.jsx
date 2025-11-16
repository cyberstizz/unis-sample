import React, { useState, useEffect, useContext } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { useNavigate } from 'react-router-dom';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { PlayerContext } from './context/playercontext';
import sampleSong from './assets/tonyfadd_paranoidbuy1get1free.mp3';
import './findpage.scss'; 
import rapperOne from './assets/rapperphotoOne.jpg';
import rapperTwo from './assets/rapperphototwo.jpg';
import rapperThree from './assets/rapperphotothree.jpg';
import rapperFree from './assets/rapperphotofour.jpg';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';
import { apiCall } from './components/axiosInstance';
import { JURISDICTION_IDS } from './utils/idMappings';

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

// Updated geo with DB-matching names (capitalized)
const harlemGeo = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Uptown Harlem' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.954, 40.812], [-73.935, 40.832], [-73.930, 40.825], [-73.948, 40.805], [-73.954, 40.812]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Downtown Harlem' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.958, 40.799], [-73.940, 40.819], [-73.935, 40.812], [-73.953, 40.792], [-73.958, 40.799]
        ]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Harlem' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.958, 40.792], [-73.930, 40.832], [-73.925, 40.825], [-73.953, 40.785], [-73.958, 40.792]
        ]]
      }
    },
  ]
};

const FindPage = () => {
  const navigate = useNavigate();
  const { playMedia } = useContext(PlayerContext);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState([-97, 40]);
  const [selectedState, setSelectedState] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [selectedHarlem, setSelectedHarlem] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [genre, setGenre] = useState('rap-hiphop');
  const [category, setCategory] = useState('artist');
  const [topResults, setTopResults] = useState({ artists: [], songs: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // Dummy fallback (unchanged)
  const dummyData = {
    'rap-hiphop-artist': {
      artists: [
        { id: 1, name: 'Artist 1', votes: 150, artwork: rapperOne },
        { id: 2, name: 'Artist 2', votes: 120, artwork: rapperTwo },
        { id: 3, name: 'Artist 3', votes: 100, artwork: rapperThree },
      ],
      songs: [
        { id: 4, title: 'Song A', artist: 'Artist X', votes: 140, artwork: songArtOne },
        { id: 5, title: 'Song B', artist: 'Artist Y', votes: 110, artwork: songArtTwo },
        { id: 6, title: 'Song C', artist: 'Artist Z', votes: 90, artwork: songArtThree },
      ],
    },
    'rap-hiphop-song': {
      artists: [
        { id: 7, name: 'Artist 4', votes: 130, artwork: rapperFree },
        { id: 8, name: 'Artist 5', votes: 100, artwork: rapperTwo },
        { id: 9, name: 'Artist 6', votes: 80, artwork: rapperOne },
      ],
      songs: [
        { id: 10, title: 'Song D', artist: 'Artist P', votes: 120, artwork: songArtFour },
        { id: 11, title: 'Song E', artist: 'Artist Q', votes: 90, artwork: songArtThree },
        { id: 12, title: 'Song F', artist: 'Artist R', votes: 70, artwork: songArtTwo },
      ],
    },
  };

  // Name mapper (lowercase geo → DB capital)
  const mapGeoToDBName = (geoName) => {
    const map = {
      'uptown harlem': 'Uptown Harlem',
      'downtown harlem': 'Downtown Harlem',
      'harlem': 'Harlem',
    };
    return map[geoName.toLowerCase()] || geoName;
  };

  // State centers (unchanged)
  const stateCenters = [
    { name: 'New York', center: [-75, 43] },
    { name: 'California', center: [-120, 37] },
    { name: 'Texas', center: [-99, 31] },
    { name: 'Florida', center: [-82, 27] },
    { name: 'Illinois', center: [-89, 40] },
    { name: 'Washington', center: [-120, 47] },
    { name: 'Arizona', center: [-111, 34] },
    { name: 'Colorado', center: [-105, 39] },
    { name: 'Ohio', center: [-82, 40] },
    { name: 'Georgia', center: [-83, 33] },
  ];

  // Fetch tops on select (mimics JurisdictionPage)
  const fetchTopResults = async (jurisdictionName) => {
    if (!jurisdictionName) return;
    setLoading(true);
    setError(null);
    try {
      // Map to DB name (capital)
      const dbName = mapGeoToDBName(jurisdictionName);

      // Step 1: Get ID by name
      const jurResponse = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/byName/${encodeURIComponent(dbName)}`,
      });
      const { jurisdictionId: jurId } = jurResponse.data;
      if (!jurId) throw new Error('Jurisdiction not found');

      // Step 2: Get tops
      const topsResponse = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/${jurId}/tops`,
      });
      const rawData = topsResponse.data;

      // Normalize & slice to 3
      const topArtists3 = (rawData.topArtists || []).slice(0, 3).map((artist, i) => ({
        id: artist.userId || i,
        name: artist.username,
        votes: artist.score || 0,
        artwork: artist.photoUrl ? `${API_BASE_URL}${artist.photoUrl}` : rapperOne,
      }));

      const topSongs3 = (rawData.topSongs || []).slice(0, 3).map((song, i) => ({
        id: song.songId || i,
        title: song.title,
        artist: song.artist?.username || 'Unknown',
        votes: song.score || 0,
        artwork: song.artworkUrl ? `${API_BASE_URL}${song.artworkUrl}` : songArtOne,
      }));

      setTopResults({ artists: topArtists3, songs: topSongs3 });
    } catch (err) {
      console.error('Fetch tops error:', err);
      setError('Failed to load tops—using dummies.');
      const key = `${genre}-${category}`;
      const dummyKey = category === 'artist' ? 'artists' : 'songs';
      const dummy = dummyData[key]?.[dummyKey] || [];
      setTopResults({ artists: dummyData[`${genre}-artist`]?.artists || [], songs: dummyData[`${genre}-song`]?.songs || [] });
    } finally {
      setLoading(false);
    }
  };

  const handleStateClick = (geo) => {
    if (geo.properties.name === "New York") {
      setSelectedState('New York');
      setCenter([-74, 40.7]);
      setZoom(10);
      setSelectedHarlem('harlem-wide');
      setIsZoomed(true);
      fetchTopResults('Harlem');  // Use DB name 'Harlem'
    } else {
      alert('Coming to Unis soon');
    }
  };

  const handleStateHover = (geo) => {
    setHoveredState(geo.properties.name);
  };

  const handleStateLeave = () => {
    setHoveredState(null);
  };

  const handleHarlemClick = (geo) => {
    setSelectedHarlem(geo.properties.name);
    fetchTopResults(geo.properties.name);  // Mapper handles capital
  };

  const handleBack = () => {
    setCenter([-97, 40]);
    setZoom(1);
    setSelectedState(null);
    setSelectedHarlem(null);
    setIsZoomed(false);
    setTopResults({ artists: [], songs: [] });
  };

  const handleRandom = () => {
    setIsAnimating(true);
    let count = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * stateCenters.length);
      setCenter(stateCenters[randomIndex].center);
      setZoom(5);
      setHoveredState(stateCenters[randomIndex].name);
      count++;
      if (count >= 10) {
        clearInterval(interval);
        setIsAnimating(false);
        const finalIndex = Math.floor(Math.random() * stateCenters.length);
        setSelectedState(stateCenters[finalIndex].name);
        if (stateCenters[finalIndex].name === 'New York') {
          handleStateClick({ properties: { name: 'New York' } });
        } else {
          alert('Coming to Unis soon');
        }
      }
    }, 500);
  };

  const { artists = [], songs = [] } = topResults;

  const getResults = () => {
    const key = `${genre}-${category}`;
    const dummyKey = category === 'artist' ? 'artists' : 'songs';
    const dummy = dummyData[key]?.[dummyKey] || [];
    return {
      artists: artists.length > 0 ? artists : dummyData[`${genre}-artist`]?.artists || [],
      songs: songs.length > 0 ? songs : dummyData[`${genre}-song`]?.songs || [],
    };
  };

  const { artists: displayArtists, songs: displaySongs } = getResults();

  const handlePlay = (media) => {
    // If it's a song with a fileUrl, play it directly
    if (media.fileUrl) {
      playMedia(
        { type: 'song', url: media.fileUrl, title: media.title || media.name, artist: media.artist || media.name, artwork: media.artwork },
        []
      );
    }
    // If it's an artist with a default song, play that
    else if (media.defaultSong && media.defaultSong.fileUrl) {
      const defaultSong = media.defaultSong;
      playMedia(
        { 
          type: 'song', 
          url: `${API_BASE_URL}${defaultSong.fileUrl}`, 
          title: defaultSong.title, 
          artist: media.name, 
          artwork: defaultSong.artworkUrl ? `${API_BASE_URL}${defaultSong.artworkUrl}` : media.artwork 
        },
        []
      );
    }
    // Otherwise fall back to sample song
    else {
      playMedia(
        { type: 'song', url: sampleSong, title: media.title || media.name, artist: media.artist || media.name, artwork: media.artwork },
        []
      );
    }
  };

  const handleArtistView = (id) => {
    navigate(`/artist/${id}`);
  };

  const handleSongView = (id) => {
    navigate(`/song/${id}`);
  };

  return (
    <Layout backgroundImage={backimage}>
      <div className="find-page-container">
        <header className="find-page-header">
          <h1>Search for Artists or Songs</h1>
        </header>

        <div className="filters">
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className="filter-select">
            <option value="rap-hiphop">Rap/Hip-Hop</option>
            <option value="rock">Rock</option>
            <option value="pop">Pop</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-select">
            <option value="artist">Artists</option>
            <option value="song">Songs</option>
          </select>
          <button onClick={handleRandom} disabled={isAnimating || loading} className="random-button">
            {isAnimating ? 'Spinning...' : 'Random'}
          </button>
        </div>

        {/* State name display */}
        <p className="territory-name">
          {hoveredState || selectedState || 'Select a state'}
          {selectedHarlem ? ` - ${selectedHarlem}` : ''}
        </p>

        {/* Back button */}
        {isZoomed && <button onClick={handleBack} className="back-button">← Back</button>}

        <div className="map-container">
          <ComposableMap projection="geoAlbersUsa">
            <ZoomableGroup center={center} zoom={zoom} disablePanning={true} disableZooming={true}>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => handleStateClick(geo)}
                      onMouseEnter={() => handleStateHover(geo)}
                      onMouseLeave={handleStateLeave}
                      style={{
                        default: {
                          fill: geo.properties.name === selectedState ? '#163387' : '#EAEAEC',
                          outline: "none",
                          stroke: "#999",
                        },
                        hover: {
                          fill: '#163387',
                          outline: "none",
                        },
                        pressed: {
                          fill: '#0A1C4A',
                          outline: "none",
                        },
                      }}
                    />
                  ))
                }
              </Geographies>
              {/* Harlem layer on zoom */}
              {zoom > 5 && (
                <Geographies geography={harlemGeo}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.properties.name}
                        geography={geo}
                        onClick={() => handleHarlemClick(geo)}
                        onMouseEnter={() => setHoveredState(geo.properties.name)}
                        onMouseLeave={handleStateLeave}
                        style={{
                          default: {
                            fill: geo.properties.name === selectedHarlem ? '#163387' : 'transparent',
                            stroke: '#C0C0C0',
                            strokeWidth: 1,
                          },
                          hover: {
                            fill: '#163387',
                          },
                        }}
                      />
                    ))
                  }
                </Geographies>
              )}
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {loading && <div className="loading">Loading tops...</div>}
        {error && <div className="error">{error}</div>}

        <div className="results-section">
          <div className="column">
            <h2>Top Songs</h2>
            <ul className="results-list">
              {displaySongs.slice(0, 3).map((item, index) => (
                <li key={item.id || index} className="result-item">
                  <div className="rank">#{index + 1}</div>
                  <img src={item.artwork} alt={item.title} className="item-artwork" />
                  <div className="item-info">
                    <div className="item-title">{item.title}</div>
                    <div className="item-artist">{item.artist}</div>
                  </div>
                  <div className="item-votes">
                    <span>{item.votes} Votes</span>
                  </div>
                  <button onClick={() => handlePlay(item)} className="play-button">Play</button>
                  <button onClick={() => handleSongView(item.id)} className="view-button">View</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="column">
            <h2>Top Artists</h2>
            <ul className="results-list">
              {displayArtists.slice(0, 3).map((item, index) => (
                <li key={item.id || index} className="result-item">
                  <div className="rank">#{index + 1}</div>
                  <img src={item.artwork} alt={item.name} className="item-artwork" />
                  <div className="item-info">
                    <div className="item-title">{item.name}</div>
                  </div>
                  <div className="item-votes">
                    <span>{item.votes} Votes</span>
                  </div>
                  <button onClick={() => handlePlay(item)} className="play-button">Play</button>
                  <button onClick={() => handleArtistView(item.id)} className="view-button">View</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FindPage;