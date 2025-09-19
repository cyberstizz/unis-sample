import React, { useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import Layout from './layout'; // Assume your Layout component
import backimage from './assets/randomrapper.jpeg';
import './mapDemo.scss'; // New SCSS for this page

const MapDemo = () => {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState([-97, 40]); // default US center
  const [isNYHighlighted, setIsNYHighlighted] = useState(false);
  const [genre, setGenre] = useState('rap-hiphop');
  const [category, setCategory] = useState('artist');
  const [jurisdiction, setJurisdiction] = useState('harlem-wide'); // Default; update on interactions if needed

  const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"; // US states topojson

  // Dummy data for top 3 (key: 'genre-category-jurisdiction')
  const dummyData = {
    'rap-hiphop-artist-harlem-wide': {
      artists: [
        { name: 'Artist 1', votes: 150, artwork: 'placeholder.jpg' },
        { name: 'Artist 2', votes: 120, artwork: 'placeholder.jpg' },
        { name: 'Artist 3', votes: 100, artwork: 'placeholder.jpg' },
      ],
      songs: [
        { title: 'Song A', artist: 'Artist X', votes: 140 },
        { title: 'Song B', artist: 'Artist Y', votes: 110 },
        { title: 'Song C', artist: 'Artist Z', votes: 90 },
      ],
    },
    // Add more for other genres/categories/jurisdictions as needed
    'rap-hiphop-song-harlem-wide': {
      artists: [
        { name: 'Artist 4', votes: 130, artwork: 'placeholder.jpg' },
        { name: 'Artist 5', votes: 100, artwork: 'placeholder.jpg' },
        { name: 'Artist 6', votes: 80, artwork: 'placeholder.jpg' },
      ],
      songs: [
        { title: 'Song D', artist: 'Artist P', votes: 120 },
        { title: 'Song E', artist: 'Artist Q', votes: 90 },
        { title: 'Song F', artist: 'Artist R', votes: 70 },
      ],
    },
    // Extend for rock, pop, uptown, downtown
  };

  const handleStateClick = (geo) => {
    if (geo.properties.name === "New York") {
      setCenter([-75, 43]); // NY center
      setZoom(5);
      setIsNYHighlighted(true);
      // Optionally update jurisdiction or fetch results here
    }
  };

  const getResults = () => {
    const key = `${genre}-${category}-${jurisdiction}`;
    return dummyData[key] || { artists: [], songs: [] };
  };

  const { artists, songs } = getResults();

  return (
    <Layout backgroundImage={backimage}>
      <div className="find-page-container">
        <header id="findHeader" className="header">
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
        </div>

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
                          fill: geo.properties.name === "New York" && isNYHighlighted ? '#163387' : '#EAEAEC', // Unis blue highlight
                          outline: "none",
                          stroke: "#999",
                        },
                        hover: {
                          fill: geo.properties.name === "New York" ? '#0D2359' : '#ddd', // Darker blue hover
                          outline: "none",
                        },
                        pressed: {
                          fill: '#0A1C4A', // Even darker pressed
                          outline: "none",
                        },
                      }}
                    />
                  ))
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>

        <div className="results-section">
          <div className="column">
            <h2>Top Songs for {jurisdiction.replace('_', ' ').toUpperCase()}</h2>
            <ul>
              {songs.map((song, index) => (
                <li key={index}>
                  {index + 1}. {song.title} by {song.artist} ({song.votes} votes)
                </li>
              ))}
            </ul>
          </div>
          <div className="column">
            <h2>Top Artists for {jurisdiction.replace('_', ' ').toUpperCase()}</h2>
            <ul>
              {artists.map((artist, index) => (
                <li key={index}>
                  {index + 1}. {artist.name} ({artist.votes} votes)
                  <img src={artist.artwork} alt={artist.name} className="artwork" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MapDemo;