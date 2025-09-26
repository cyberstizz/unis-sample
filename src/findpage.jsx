import React, { useState, useEffect, useContext } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { useNavigate } from 'react-router-dom';
import Layout from './layout'; // Assume your Layout component
import backimage from './assets/randomrapper.jpeg';
import { PlayerContext } from './context/playercontext'; // For play button
import sampleSong from './assets/tonyfadd_paranoidbuy1get1free.mp3'; // Placeholder MP3
import './findpage.scss'; 
import rapperOne from './assets/rapperphotoOne.jpg';
import rapperTwo from './assets/rapperphototwo.jpg';
import rapperThree from './assets/rapperphotothree.jpg';
import rapperFree from './assets/rapperphotofour.jpg';
import songArtOne from './assets/songartworkOne.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';


//adding a comment to make the file chane commit




const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"; // US states

// Refined Harlem GeoJSON (from search: approximate boundaries for Uptown, Downtown, Harlem-wide)
const harlemGeo = {
  type: 'FeatureCollection',
  features: [
    { // Uptown Harlem (approx: 125th to 155th St)
      type: 'Feature',
      properties: { name: 'Uptown Harlem' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.954, 40.812], [-73.935, 40.832], [-73.930, 40.825], [-73.948, 40.805], [-73.954, 40.812]
        ]]
      }
    },
    { // Downtown Harlem (approx: 110th to 125th St)
      type: 'Feature',
      properties: { name: 'Downtown Harlem' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.958, 40.799], [-73.940, 40.819], [-73.935, 40.812], [-73.953, 40.792], [-73.958, 40.799]
        ]]
      }
    },
    { // Harlem-wide (combined)
      type: 'Feature',
      properties: { name: 'Harlem-wide' },
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
  const [center, setCenter] = useState([-97, 40]); // US center
  const [selectedState, setSelectedState] = useState(null); // For name display
  const [hoveredState, setHoveredState] = useState(null); // For hover name
  const [selectedHarlem, setSelectedHarlem] = useState(null); // For Harlem sub-area
  const [isAnimating, setIsAnimating] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false); // For back button
  const [genre, setGenre] = useState('rap-hiphop');
  const [category, setCategory] = useState('artist');

  // Dummy data for top 3 (key: 'genre-category')
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

  // State centers for random toggle (sample US states)
  const stateCenters = [
    { name: 'New York', center: [-75, 43] },
    { name: 'California', center: [-120, 37] },
    { name: 'Texas', center: [-99, 31] },
    { name: 'Florida', center: [-82, 27] },
    { name: 'Illinois', center: [-89, 40] },
    // Add 5-10 more for better animation
    { name: 'Washington', center: [-120, 47] },
    { name: 'Arizona', center: [-111, 34] },
    { name: 'Colorado', center: [-105, 39] },
    { name: 'Ohio', center: [-82, 40] },
    { name: 'Georgia', center: [-83, 33] },
  ];

  const handleStateClick = (geo) => {
    if (geo.properties.name === "New York") {
      setSelectedState('New York');
      setCenter([-74, 40.7]); // NYC center
      setZoom(10); // Zoom to NYC
      setSelectedHarlem('harlem-wide'); // Default Harlem sub
      setIsZoomed(true); // Show back button
    } else {
      alert('Coming to Unis soon'); // Message for non-NY
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
    // Optional further zoom
  };

  const handleBack = () => {
    setCenter([-97, 40]); // US center
    setZoom(1);
    setSelectedState(null);
    setSelectedHarlem(null);
    setIsZoomed(false);
  };

  const handleRandom = () => {
    setIsAnimating(true);
    let count = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * stateCenters.length);
      setCenter(stateCenters[randomIndex].center);
      setZoom(5);
      setHoveredState(stateCenters[randomIndex].name); // Display during animation
      count++;
      if (count >= 10) { // 10 cycles = ~5s at 500ms
        clearInterval(interval);
        setIsAnimating(false);
        // Final state (random or NY for demo)
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

  const getResults = () => {
    const key = `${genre}-${category}`;
    return dummyData[key] || { artists: [], songs: [] };
  };

  const { artists, songs } = getResults();

  const handlePlay = (media) => {
    playMedia(
      { type: 'song', url: sampleSong, title: media.title || media.name, artist: media.artist, artwork: media.artwork },
      [] // Empty for single
    );
  };

  const handleArtistView = (id, type) => {
    navigate(`/artist`)
  };


  const handleSongView = (id, type) => {
    navigate(`/song`)
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
        
          <button onClick={handleRandom} disabled={isAnimating} className="random-button">
            Random
          </button>
        </div>

        {/* State name display */}
        <p className="territory-name">
          {hoveredState || selectedState || 'Hover a state'}
          {selectedHarlem ? ` - ${selectedHarlem}` : ''}
        </p>

        {/* Back button */}
        {isZoomed && <button onClick={handleBack} className="back-button">← Back</button>}

        <div className="map-container">
          <ComposableMap projection="geoAlbersUsa">
            <ZoomableGroup center={center} zoom={zoom} disablePanning={!isZoomed} disableZooming={!isZoomed}> {/* Disable pan/zoom in US mode */}
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
                          fill: geo.properties.name === selectedState ? '#163387' : '#EAEAEC', // Unis blue on select
                          outline: "none",
                          stroke: "#999",
                        },
                        hover: {
                          fill: '#163387', // Unis blue on hover
                          outline: "none",
                        },
                        pressed: {
                          fill: '#0A1C4A', // Darker pressed
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
                        onMouseEnter={() => setHoveredState(geo.properties.name)} // Hover name for Harlem too
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
                  <button onClick={() => handleSongView()} className="view-button">View</button>
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
                  <button onClick={() => handleArtistView()} className="view-button">View</button>
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