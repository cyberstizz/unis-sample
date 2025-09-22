import React, { useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography
} from "react-simple-maps";
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import './mapDemo.scss';

const geoUrl =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const MapDemo = () => {
  const [isNYHighlighted, setIsNYHighlighted] = useState(false);
  const [genre, setGenre] = useState('rap-hiphop');
  const [category, setCategory] = useState('artist');
  const [jurisdiction, setJurisdiction] = useState('harlem-wide');

  const dummyData = {
    'rap-hiphop-artist-harlem-wide': {
      artists: [
        { name: 'Artist 1', votes: 150, artwork: 'placeholder.jpg' },
        { name: 'Artist 2', votes: 120, artwork: 'placeholder.jpg' },
      ],
      songs: [
        { title: 'Song A', artist: 'Artist X', votes: 140 },
        { title: 'Song B', artist: 'Artist Y', votes: 110 },
      ],
    }
  };

  const handleStateClick = (geo) => {
    if (geo.properties.name === "New York") {
      setIsNYHighlighted(true);
      // In future you could reveal sub-regions here
    }
  };

  const key = `${genre}-${category}-${jurisdiction}`;
  const { artists = [], songs = [] } = dummyData[key] || {};

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

        {/* Map Box */}
        <div className="map-box">
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{
              scale: 1100,          // controls size of US inside box
            }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => handleStateClick(geo)}
                    style={{
                      default: {
                        fill:
                          geo.properties.name === "New York" && isNYHighlighted
                            ? '#163387'
                            : '#EAEAEC',
                        stroke: '#999',
                        outline: 'none',
                      },
                      hover: {
                        fill: '#0D2359',
                        outline: 'none',
                      },
                      pressed: { fill: '#0A1C4A', outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>
          </ComposableMap>
          <p className="map-caption">Click a state to see top artists & songs</p>
        </div>

        <div className="results-section">
          <div className="column">
            <h2>Top Songs</h2>
            <ul>
              {songs.map((s, i) => (
                <li key={i}>{i + 1}. {s.title} by {s.artist} ({s.votes})</li>
              ))}
            </ul>
          </div>
          <div className="column">
            <h2>Top Artists</h2>
            <ul>
              {artists.map((a, i) => (
                <li key={i}>{i + 1}. {a.name} ({a.votes})</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MapDemo;
