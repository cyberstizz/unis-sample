// src/components/FindPage.js (rename from MapDemo.js)
import React, { useState, useEffect, useContext } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from 'react-simple-maps';
import { useNavigate } from 'react-router-dom';
import Layout from './layout'; // Assume your Layout component
import backimage from './assets/randomrapper.jpeg';
import { PlayerContext } from './context/playercontext'; // For play button
import sampleSong from './assets/tonyfadd_paranoidbuy1get1free.mp3'; // Placeholder MP3
import './FindPage.scss'; // Updated SCSS

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"; // US states

// Hardcoded simple Harlem polygons (approximations; replace with accurate GeoJSON)
const harlemGeo = {
  type: 'FeatureCollection',
  features: [
    { // Uptown Harlem (approx)
      type: 'Feature',
      properties: { name: 'Uptown Harlem' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.96, 40.81], [-73.94, 40.83], [-73.93, 40.82], [-73.95, 40.80], [-73.96, 40.81]
        ]]
      }
    },
    { // Downtown Harlem (approx)
      type: 'Feature',
      properties: { name: 'Downtown Harlem' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.95, 40.78], [-73.93, 40.80], [-73.92, 40.79], [-73.94, 40.77], [-73.95, 40.78]
        ]]
      }
    },
    { // Harlem-wide (combined approx)
      type: 'Feature',
      properties: { name: 'Harlem-wide' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.96, 40.78], [-73.92, 40.83], [-73.93, 40.82], [-73.95, 40.77], [-73.96, 40.78]
        ]]
      }
    },
  ]
};

const FindPage = () => {
  const navigate = useNavigate();
  const { playMedia } = useContext(PlayerContext);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState([-97, 40]); // US center
  const [selectedState, setSelectedState] = useState(null); // For name display
  const [selectedHarlem, setSelectedHarlem] = useState(null); // For Harlem sub-area
  const [genre, setGenre] = useState('rap-hiphop');
  const [category, setCategory] = useState('artist');
  const [isAnimating, setIsAnimating] = useState(false);
const [isNYHighlighted, setIsNYHighlighted] = useState(false);


  // Dummy data for top 3 (key: 'genre-category')
  const dummyData = {
    'rap-hiphop-artist': {
      artists: [
        { name: 'Artist 1', votes: 150, artwork: 'https://placehold.co/60x60?text=Artist1' },
        { name: 'Artist 2', votes: 120, artwork: 'https://placehold.co/60x60?text=Artist2' },
        { name: 'Artist 3', votes: 100, artwork: 'https://placehold.co/60x60?text=Artist3' },
      ],
      songs: [
        { title: 'Song A', artist: 'Artist X', votes: 140, artwork: 'https://placehold.co/60x60?text=SongA' },
        { title: 'Song B', artist: 'Artist Y', votes: 110, artwork: 'https://placehold.co/60x60?text=SongB' },
        { title: 'Song C', artist: 'Artist Z', votes: 90, artwork: 'https://placehold.co/60x60?text=SongC' },
      ],
    },
    // Add 20 dummy images via placehold.co (text labels for uniqueness; repeat pattern for more)
    // Examples: Artist4 to Artist20 similar
    // For brevity, extend in code as needed
  };

  // State centers for random toggle (sample US states)
  const stateCenters = [
    { name: 'New York', center: [-75, 43] },
    { name: 'California', center: [-120, 37] },
    { name: 'Texas', center: [-99, 31] },
    { name: 'Florida', center: [-82, 27] },
    { name: 'Illinois', center: [-89, 40] },
    // Add more for variety
  ];

  const handleStateClick = (geo) => {
    if (geo.properties.name === "New York") {
      setSelectedState('New York');
      setCenter([-74, 40.7]); // NYC center
      setZoom(10); // Zoom to NYC
      setSelectedHarlem('harlem-wide'); // Default Harlem sub
    }
  };

  const handleHarlemClick = (geo) => {
    setSelectedHarlem(geo.properties.name);
    // Further zoom if needed
  };

  const handleRandom = () => {
    setIsAnimating(true);
    let count = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * stateCenters.length);
      setCenter(stateCenters[randomIndex].center);
      setZoom(5);
      setSelectedState(stateCenters[randomIndex].name);
      count++;
      if (count >= 10) { // Cycle 10 times (~5s at 500ms interval)
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 500); // 0.5s per cycle
  };

  const getResults = () => {
    const key = `${genre}-${category}`;
    return dummyData[key] || { artists: [], songs: [] };
  };

  const { artists, songs } = getResults();

  const handlePlay = (media) => {
    playMedia(
      { type: 'song', url: sampleSong, title: media.title || media.name, artist: media.artist, artwork: media.artwork },
      [] // Empty playlist for single play
    );
  };

  const handleView = (id, type) => {
    navigate(type === 'artist' ? `/artist/${id}` : `/song/${id}`);
  };

  return (
    <Layout backgroundImage={backimage}>
      <div className="find-page-container">
        <header className="header">
          <h1>Search for Artists or Songs</h1>
        </header>

        <div className="filters">
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className="filter-select">
            <option value="rap-hiphop">Rap/Hip-Hop</option>
            <option value="rock">Rock</option>
            <option value="pop">Pop</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-select">
            <option value="artist">Artist</option>
            <option value="song">Song</option>
          </select>
          <button onClick={handleRandom} disabled={isAnimating} className="random-button">
            Random
          </button>
        </div>

        {selectedState && <p className="territory-name">{selectedState}{selectedHarlem ? ` - ${selectedHarlem}` : ''}</p>}

        <div className="map-container">
          <ComposableMap projection="geoAlbersUsa">
            <ZoomableGroup center={center} zoom={zoom}>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => handleStateClick(geo)}
                      style={{
                        default: {
                          fill: geo.properties.name === "New York" && isNYHighlighted ? '#163387' : '#EAEAEC', // Unis blue
                          outline: "none",
                          stroke: "#999",
                        },
                        hover: {
                          fill: geo.properties.name === "New York" ? '#0D2359' : '#ddd',
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
              {/* Harlem layer (shown on zoom) */}
              {zoom > 5 && (
                <Geographies geography={harlemGeo}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.properties.name}
                        geography={geo}
                        onClick={() => handleHarlemClick(geo)}
                        style={{
                          default: {
                            fill: geo.properties.name === selectedHarlem ? '#163387' : 'transparent',
                            stroke: '#C0C0C0',
                            strokeWidth: 1,
                          },
                          hover: {
                            fill: '#0D2359',
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

        <div className="results-section">
          <div className="column">
            <h2>Top Songs</h2>
            <ul className="results-list">
              {songs.slice(0, 3).map((item, index) => (
                <li key={index} className="result-item">
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
                  <button onClick={() => handleView(item.id, 'song')} className="view-button">View</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="column">
            <h2>Top Artists</h2>
            <ul className="results-list">
              {artists.slice(0, 3).map((item, index) => (
                <li key={index} className="result-item">
                  <div className="rank">#{index + 1}</div>
                  <img src={item.artwork} alt={item.name} className="item-artwork" />
                  <div className="item-info">
                    <div className="item-title">{item.name}</div>
                  </div>
                  <div className="item-votes">
                    <span>{item.votes} Votes</span>
                  </div>
                  <button onClick={() => handlePlay(item)} className="play-button">Play</button>
                  <button onClick={() => handleView(item.id, 'artist')} className="view-button">View</button>
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