import React, { useState, useEffect, useContext, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
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
import 'leaflet/dist/leaflet.css';

const US_STATES_GEOJSON_URL = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

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

// --- COMPONENT: MAP CONTROLLER ---
// This component sits inside the map and handles the "FlyTo" animations
const MapController = ({ viewState }) => {
  const map = useMap();
  useEffect(() => {
    if (viewState.mode === 'US') {
      map.flyTo([37.8, -96], 4, { duration: 1.5 });
    } else if (viewState.mode === 'STATE' && viewState.bounds) {
      // Zoom to the bounds of the state (New York)
      map.flyToBounds(viewState.bounds, { padding: [50, 50], duration: 1.5 });
    } else if (viewState.mode === 'REGION' && viewState.center) {
      // Zoom deep into the neighborhood (Harlem)
      map.flyTo(viewState.center, 13, { duration: 1.5 });
    }
  }, [viewState, map]);
  return null;
};

const FindPage = () => {
  const navigate = useNavigate();
  const { playMedia } = useContext(PlayerContext);
  const [userId, setUserId] = useState(null);
  const mapRef = useRef(null); // For any additional programmatic control if needed

  // VIEW STATE: 'US' | 'STATE' | 'REGION' (from new code)
  const [viewState, setViewState] = useState({ mode: 'US', bounds: null, center: null });
  const [usGeoData, setUsGeoData] = useState(null);

  // Restored from original
  const [selectedState, setSelectedState] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [selectedHarlem, setSelectedHarlem] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false); // Maps to viewState.mode !== 'US'
  const [genre, setGenre] = useState('rap-hiphop');
  const [category, setCategory] = useState('artist');
  const [topResults, setTopResults] = useState({ artists: [], songs: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(null); // From new code, but merged with selectedHarlem/selectedState
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // Dummy fallback (restored from original)
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

  // Name mapper (restored from original)
  const mapGeoToDBName = (geoName) => {
    const map = {
      'uptown harlem': 'Uptown Harlem',
      'downtown harlem': 'Downtown Harlem',
      'harlem': 'Harlem',
    };
    return map[geoName.toLowerCase()] || geoName;
  };

  // State centers (restored from original, for random)
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


  // Now all the useEffects starting with the user
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

  // 1. Fetch US States on Mount (from new code)
  useEffect(() => {
    fetch(US_STATES_GEOJSON_URL)
      .then(res => res.json())
      .then(data => setUsGeoData(data));
  }, []);

  // Sync isZoomed with viewState (to preserve original logic if needed elsewhere)
  useEffect(() => {
    setIsZoomed(viewState.mode !== 'US');
  }, [viewState.mode]);

  // Fetch tops on select (restored from original)
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
        fileUrl: song.fileUrl ? `${API_BASE_URL}${song.fileUrl}` : null,  // NEW: Full URL for play
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

  // --- HANDLERS --- (Merged: Preserve new viewState logic, add original fetches/states)
  const handleStateClick = (feature, layer) => {
    const stateName = feature.properties.name;
    setHoveredState(stateName); // From original

    if (stateName === "New York") {
      setSelectedState('New York');
      // Create bounds from the polygon data to tell Leaflet where to zoom (from new)
      const bounds = layer.getBounds();
      setViewState({ mode: 'STATE', bounds: bounds });
      setSelectedHarlem('harlem-wide'); // From original
      setSelectedJurisdiction('Harlem'); // Align with new for display/fetch
      setIsZoomed(true);
      fetchTopResults('Harlem');  // From original
    } else {
      alert('Coming to Unis soon');
    }
  };

  const handleHarlemClick = (feature) => {
    const name = feature.properties.name;
    setSelectedHarlem(name); // From original
    setSelectedJurisdiction(name); // From new
    setHoveredState(name); // From original
    // Calculate center roughly or define it manually (from new, but per feature if needed)
    // For simplicity, use a general Harlem center; customize per sub-region if desired
    const centers = {
      'Uptown Harlem': [40.82, -73.94],
      'Downtown Harlem': [40.80, -73.95],
      'Harlem': [40.8116, -73.9465],
    };
    const center = centers[name] || [40.8116, -73.9465];
    setViewState({ mode: 'REGION', center: center });
    fetchTopResults(name);  // From original
  };

  const handleBack = () => {
    // From new: Reset viewState
    setViewState({ mode: 'US', bounds: null, center: null });
    // From original: Reset states and results
    setSelectedState(null);
    setSelectedHarlem(null);
    setSelectedJurisdiction(null);
    setIsZoomed(false);
    setTopResults({ artists: [], songs: [] });
    setHoveredState(null);
  };

  // Random handler (restored from original, adapted to viewState)
  const handleRandom = () => {
    setIsAnimating(true);
    let count = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * stateCenters.length);
      // In Leaflet, we can't directly set center/zoom like simple-maps, but for animation preview, we could flyTo
      // For now, simulate by updating hoveredState (visual cue); final lands on state
      setHoveredState(stateCenters[randomIndex].name);
      count++;
      if (count >= 10) {
        clearInterval(interval);
        setIsAnimating(false);
        const finalIndex = Math.floor(Math.random() * stateCenters.length);
        const finalState = stateCenters[finalIndex];
        setSelectedState(finalState.name);
        if (finalState.name === 'New York') {
          // Trigger NY click logic
          handleStateClick({ properties: { name: 'New York' } }, { getBounds: () => [[40, -80], [45, -70]] }); // Mock layer for bounds
        } else {
          alert('Coming to Unis soon');
        }
      }
    }, 500);
  };

  // Restored from original
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

  const handlePlay = async (media) => {
        let trackingId = null;
        let trackingType = null;

        // If it's a song with fileUrl, play it directly
        if (media.fileUrl) {
          console.log('Playing song directly:', media.title, media.fileUrl);
          
          playMedia(
            { 
              type: 'song', 
              url: media.fileUrl, 
              title: media.title || media.name, 
              artist: media.artist || media.name, 
              artwork: media.artwork 
            },
            []
          );
          
          // Track this play
          trackingId = media.id || media.songId;
          trackingType = 'song';
        }
        // If it's an artist, fetch and play default song
        else if (media.id && media.name) {
          console.log('Fetching default for artist:', media.name, media.id);
          try {
            const response = await apiCall({
              method: 'get',
              url: `/v1/users/${media.id}/default-song`,
            });
            const defaultSong = response.data;
            
            if (defaultSong && defaultSong.fileUrl) {
              console.log('Playing default song:', defaultSong.title, `${API_BASE_URL}${defaultSong.fileUrl}`);
              
              playMedia(
                { 
                  type: 'default-song', 
                  url: `${API_BASE_URL}${defaultSong.fileUrl}`, 
                  title: defaultSong.title, 
                  artist: media.name, 
                  artwork: defaultSong.artworkUrl ? `${API_BASE_URL}${defaultSong.artworkUrl}` : media.artwork 
                },
                []
              );
              
              // Track this play
              trackingId = defaultSong.songId;
              trackingType = 'song';
            } else {
              console.warn('No default song found for artist');
              return; // Exit without tracking
            }
          } catch (err) {
            console.error('Default song fetch failed:', err);
            return; // Exit without tracking
          }
        }
        // Fallback to sample only if no song/default available
        else {
          console.warn('Falling back to sample song');
          playMedia(
            { 
              type: 'song', 
              url: sampleSong, 
              title: media.title || media.name, 
              artist: media.artist || media.name, 
              artwork: media.artwork 
            },
            []
          );
          return; 
        }

        if (trackingId && trackingType && userId) {
          try {
            const endpoint = trackingType === 'song' 
              ? `/v1/media/song/${trackingId}/play?userId=${userId}`
              : `/v1/media/video/${trackingId}/play?userId=${userId}`;
            
            console.log('Tracking play:', { endpoint, trackingId, userId }); 
            await apiCall({ method: 'post', url: endpoint });
            console.log('Play tracked successfully for:', trackingId);
          } catch (err) {
            console.error('Failed to track play:', err);
          }
        } else {
          console.warn('Could not track play - missing data:', { trackingId, trackingType, userId });
        }
      };

  const handleArtistView = (id) => {
    navigate(`/artist/${id}`);
  };

  const handleSongView = (id) => {
    navigate(`/song/${id}`);
  };

  // Display name logic (merged: hovered or selected)
  const displayTerritory = hoveredState || selectedState || selectedHarlem || selectedJurisdiction || 'Select a state';

  return (
    <Layout backgroundImage={backimage}>
      <div className="find-page-container">
        {/* <header className="find-page-header">
          <h1>Search for Artists or Songs</h1>
        </header> */}

        <div className="findFilters">
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className="findfilter-selectt">
            <option value="rap-hiphop">Rap</option>
            <option value="rock">Rock</option>
            <option value="pop">Pop</option>
          </select>
          {/* <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-select">
            <option value="artist">Artists</option>
            <option value="song">Songs</option>
          </select> */}
          <button onClick={handleRandom} disabled={isAnimating || loading} className="random-button">
            {isAnimating ? 'Spinning...' : 'Random'}
          </button>
        </div>

        <div className='mapEverything'>

        {/* State name display (merged) */}
        <p className="territory-name">
          {displayTerritory}
        </p>

        {/* Back button (from new, using viewState) */}
        {viewState.mode !== 'US' && <button onClick={handleBack} className="back-button">← Back</button>}

        <div className="map-container" style={{ width: '100%', borderRadius: '15px', overflow: 'hidden' }}>
          <MapContainer
            center={[39.0, -96]}
            zoom={3.8}
            ref={mapRef}
            style={{ width: '100%' }}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            dragging={false} 
            zoomControl={false}
            attributionControl={false} // REMOVES THE COPYRIGHT TEXT
          >
            <MapController viewState={viewState} />
           
            {/* Visual Base Layer (Dark Mode Tiles) RESTORED BUT HIDDEN ATTRIBUTION */}
             <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            /> 

            {/* LAYER 1: US STATES */}
            {viewState.mode === 'US' && usGeoData && (
              <GeoJSON
                data={usGeoData}
                style={(feature) => {
                  const isSelected = feature.properties.name === selectedState;
                  return {
                    fillColor: isSelected ? '#163387' : '#EAEAEC',
                    fillOpacity: 1,       
                    color: isSelected ? '#FFFFFF' : '#999', // White border if selected       
                    weight: isSelected ? 2 : 1
                  };
                }}
                onEachFeature={(feature, layer) => {
                  layer.on({
                    click: () => handleStateClick(feature, layer),
                    mouseover: (e) => {
                      setHoveredState(feature.properties.name);
                      const layer = e.target;
                      layer.setStyle({ 
                        fillColor: '#163387',
                        color: '#163387',     
                        weight: 2
                      }); 
                      layer.bringToFront(); // Ensures the border sits on top of neighbors
                    },
                    mouseout: (e) => {
                      setHoveredState(null); 
                      const layer = e.target;
                      // Logic: If this is the SELECTED state, keep it Blue/White. 
                      // If it's NOT selected, turn it back to Gray/Silver.
                      const isSelected = feature.properties.name === selectedState;
                      layer.setStyle({ 
                        fillColor: isSelected ? '#163387' : '#EAEAEC',
                        color: isSelected ? '#FFFFFF' : '#999',
                        weight: isSelected ? 2 : 1
                      }); 
                    }
                  });
                }}
              />
            )}
            
            {/* LAYER 2: HARLEM */}
            {viewState.mode !== 'US' && (
              <GeoJSON
                data={harlemGeo}
                style={(feature) => ({
                  fillColor: (feature.properties.name === selectedHarlem || feature.properties.name === selectedJurisdiction) ? '#163387' : 'transparent', 
                  stroke: '#C0C0C0',
                  strokeWidth: 1,
                  fillOpacity: 0.7
                })}
                onEachFeature={(feature, layer) => {
                  layer.on({
                    click: () => handleHarlemClick(feature),
                    mouseover: (e) => {
                      setHoveredState(feature.properties.name);
                      e.target.setStyle({ fillColor: '#163387', fillOpacity: 1 });
                    },
                    mouseout: (e) => {
                      setHoveredState(null);
                      // Check if selected before resetting
                      const isSelected = (feature.properties.name === selectedHarlem || feature.properties.name === selectedJurisdiction);
                      if (!isSelected) {
                        e.target.setStyle({ fillOpacity: 0.7, fillColor: 'transparent' });
                      }
                    }
                  });
                }}
              />
            )}
          </MapContainer>
        </div>

        </div>
        {loading && <div className="loading">Loading tops...</div>}
        {error && <div className="error">{error}</div>}

        <div className="results-section">
          {/* Results lists... */}
          <div className="column">
            <h2>Top Songs in {displayTerritory}</h2>
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
            <h2>Top Artists in {displayTerritory}</h2>
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