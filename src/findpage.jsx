import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
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
import 'leaflet/dist/leaflet.css';

// External GeoJSON for US states (initial view)
const US_STATES_GEOJSON_URL = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

// Active jurisdictions - only these have real artist/song data
const ACTIVE_JURISDICTIONS = ['Harlem', 'Uptown Harlem', 'Downtown Harlem'];

// Harlem's parent chain - these jurisdictions show Harlem data
const HARLEM_PARENT_CHAIN = [
  'Unis', 'New York', 'New York City Metro', 'New York City', 
  'Manhattan', 'Upper Manhattan', 'Harlem', 'Uptown Harlem', 'Downtown Harlem'
];

// --- COMPONENT: MAP CONTROLLER ---
const MapController = ({ viewState, isMobile }) => {
  const map = useMap();
  
  useEffect(() => {
    const invalidateSize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };
    invalidateSize();
    window.addEventListener('resize', invalidateSize);
    return () => window.removeEventListener('resize', invalidateSize);
  }, [map]);

  useEffect(() => {
    if (viewState.mode === 'US') {
      if (isMobile) {
        map.flyTo([37.8, -96], 3.2, { duration: 1.5 });
      } else {
        map.flyTo([37.8, -96], 4, { duration: 1.5 });
      }
    } else if (viewState.mode === 'STATE' && viewState.bounds) {
      map.flyToBounds(viewState.bounds, { padding: [50, 50], duration: 1.5 });
    } else if (viewState.mode === 'JURISDICTION' && viewState.bounds) {
      map.flyToBounds(viewState.bounds, { padding: [30, 30], duration: 1.5 });
    } else if (viewState.mode === 'JURISDICTION' && viewState.center) {
      map.flyTo(viewState.center, viewState.zoom || 12, { duration: 1.5 });
    }
  }, [viewState, map, isMobile]);
  
  return null;
};

const FindPage = () => {
  const navigate = useNavigate();
  const { playMedia } = useContext(PlayerContext);
  const [userId, setUserId] = useState(null);
  const mapRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);

  // View state - similar to original but extended
  const [viewState, setViewState] = useState({ mode: 'US', bounds: null, center: null, zoom: null });
  const [usGeoData, setUsGeoData] = useState(null);
  
  // Navigation tracking
  const [navigationStack, setNavigationStack] = useState([
    { name: 'United States', jurisdictionId: null, tier: 0 }
  ]);
  
  // Current jurisdictions to display (from database)
  const [currentJurisdictions, setCurrentJurisdictions] = useState([]);

  // Selection state
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Results state
  const [topResults, setTopResults] = useState({ artists: [], songs: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSelectedJurisdiction, setHasSelectedJurisdiction] = useState(false);
  
  // Filter state
  const [genre, setGenre] = useState('rap-hiphop');
  
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // Default artwork
  const defaultArtwork = {
    artists: [rapperOne, rapperTwo, rapperThree, rapperFree],
    songs: [songArtOne, songArtTwo, songArtThree, songArtFour]
  };

  // States for random animation
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

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.userId);
      } catch (err) {
        console.error('Failed to get userId from token:', err);
      }
    }
  }, []);

  useEffect(() => {
    fetch(US_STATES_GEOJSON_URL)
      .then(res => res.json())
      .then(data => setUsGeoData(data))
      .catch(err => console.error('Failed to load US states:', err));
  }, []);

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  /**
   * Check if a jurisdiction is in Harlem's parent chain
   */
  const isInHarlemChain = (name) => {
    return HARLEM_PARENT_CHAIN.includes(name);
  };

  /**
   * Check if jurisdiction is active (has real data)
   */
  const isActiveJurisdiction = (name) => {
    return ACTIVE_JURISDICTIONS.includes(name);
  };

  /**
   * Parse polygon string to GeoJSON geometry
   */
  const parsePolygon = (polygon) => {
    if (!polygon) return null;
    try {
      return typeof polygon === 'string' ? JSON.parse(polygon) : polygon;
    } catch (e) {
      console.error('Failed to parse polygon:', e);
      return null;
    }
  };

  /**
   * Calculate bounds from polygon
   */
  const getBoundsFromPolygon = (polygon) => {
    const geometry = parsePolygon(polygon);
    if (!geometry || !geometry.coordinates) return null;
    
    const coords = geometry.coordinates[0];
    const lats = coords.map(c => c[1]);
    const lngs = coords.map(c => c[0]);
    
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ];
  };

  /**
   * Convert jurisdictions array to GeoJSON FeatureCollection
   */
  const jurisdictionsToGeoJSON = useCallback((jurisdictions) => {
    const features = jurisdictions
      .filter(j => j.polygon)
      .map(j => {
        const geometry = parsePolygon(j.polygon);
        if (!geometry) return null;
        
        return {
          type: 'Feature',
          properties: {
            jurisdictionId: j.jurisdictionId,
            name: j.name,
            bio: j.bio,
            hasChildren: j.hasChildren,
            isActive: isActiveJurisdiction(j.name),
            isInHarlemChain: isInHarlemChain(j.name)
          },
          geometry
        };
      })
      .filter(Boolean);
    
    return { type: 'FeatureCollection', features };
  }, []);

  // ==========================================================================
  // API CALLS
  // ==========================================================================

  /**
   * Fetch children of a jurisdiction
   */
  const fetchChildren = async (jurisdictionId) => {
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/${jurisdictionId}/children/detailed`,
      });
      return response.data || [];
    } catch (err) {
      console.error('Failed to fetch children:', err);
      // Fallback: try the simple children endpoint
      try {
        const fallbackResponse = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${jurisdictionId}/children`,
        });
        return (fallbackResponse.data || []).map(j => ({
          ...j,
          hasChildren: true, // Assume has children, will be corrected on click
          isActive: isActiveJurisdiction(j.name)
        }));
      } catch (fallbackErr) {
        console.error('Fallback fetch also failed:', fallbackErr);
        return [];
      }
    }
  };

  /**
   * Fetch jurisdiction by name
   */
  const fetchJurisdictionByName = async (name) => {
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/byName/${encodeURIComponent(name)}`,
      });
      return response.data;
    } catch (err) {
      console.error('Failed to fetch jurisdiction by name:', err);
      return null;
    }
  };

  /**
   * Fetch top results - always uses Harlem for non-active jurisdictions
   */
  const fetchTopResults = async (jurisdictionName) => {
    setLoading(true);
    setError(null);
    setHasSelectedJurisdiction(true);
    
    try {
      // Always fetch from Harlem since it's the only active jurisdiction with data
      const dataJurisdiction = 'Harlem';
      
      const jurResponse = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/byName/${encodeURIComponent(dataJurisdiction)}`,
      });
      
      const { jurisdictionId: jurId } = jurResponse.data;
      if (!jurId) throw new Error('Jurisdiction not found');

      const topsResponse = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/${jurId}/tops`,
      });
      
      const rawData = topsResponse.data;

      const topArtists = (rawData.topArtists || []).slice(0, 3).map((artist, i) => ({
        id: artist.userId || i,
        name: artist.username,
        votes: artist.score || 0,
        artwork: artist.photoUrl ? `${API_BASE_URL}${artist.photoUrl}` : defaultArtwork.artists[i % 4],
      }));

      const topSongs = (rawData.topSongs || []).slice(0, 3).map((song, i) => ({
        id: song.songId || i,
        title: song.title,
        artist: song.artist?.username || 'Unknown',
        votes: song.score || 0,
        fileUrl: song.fileUrl ? `${API_BASE_URL}${song.fileUrl}` : null,
        artwork: song.artworkUrl ? `${API_BASE_URL}${song.artworkUrl}` : defaultArtwork.songs[i % 4],
      }));

      setTopResults({ artists: topArtists, songs: topSongs });
    } catch (err) {
      console.error('Fetch tops error:', err);
      setError('Failed to load top results');
      setTopResults({ artists: [], songs: [] });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  /**
   * Handle clicking on a US state
   */
  const handleStateClick = async (feature, layer) => {
    const stateName = feature.properties.name;
    setHoveredState(stateName);

    if (stateName !== "New York") {
      alert(`${stateName} coming to Unis soon!`);
      return;
    }

    // Fetch New York from database
    const nyData = await fetchJurisdictionByName("New York");
    if (!nyData) {
      console.error('Failed to load New York data');
      return;
    }

    // Get children of New York (Tier 3)
    const children = await fetchChildren(nyData.jurisdictionId);
    
    // Update navigation
    setNavigationStack([
      { name: 'United States', jurisdictionId: null, tier: 0 },
      { name: 'New York', jurisdictionId: nyData.jurisdictionId, tier: 2 }
    ]);
    
    setCurrentJurisdictions(children);
    setSelectedJurisdiction({ name: 'New York', ...nyData.jurisdiction });
    
    // Set view state
    const bounds = layer ? layer.getBounds() : null;
    setViewState({ 
      mode: 'STATE', 
      bounds: bounds,
      center: null,
      zoom: null
    });
    
    // Fetch results (will show Harlem data)
    fetchTopResults('New York');
  };

  /**
   * Handle clicking on a jurisdiction polygon
   */
  const handleJurisdictionClick = async (jurisdiction) => {
    const { jurisdictionId, name, hasChildren, polygon } = jurisdiction;
    
    setSelectedJurisdiction(jurisdiction);
    setHoveredState(name);
    
    // If has children, drill down
    if (hasChildren) {
      const children = await fetchChildren(jurisdictionId);
      
      if (children.length > 0) {
        // Update navigation stack
        setNavigationStack(prev => [...prev, {
          name,
          jurisdictionId,
          tier: prev[prev.length - 1].tier + 1
        }]);
        
        setCurrentJurisdictions(children);
        
        // Calculate bounds from polygon
        const bounds = getBoundsFromPolygon(polygon);
        if (bounds) {
          setViewState({ mode: 'JURISDICTION', bounds, center: null, zoom: null });
        }
      }
    }
    
    // Always fetch results
    fetchTopResults(name);
  };

  /**
   * Handle back button
   */
  const handleBack = async () => {
    if (navigationStack.length <= 1) return;
    
    const newStack = [...navigationStack];
    newStack.pop();
    const previousLevel = newStack[newStack.length - 1];
    
    setNavigationStack(newStack);
    
    if (previousLevel.tier === 0) {
      // Back to US view
      setCurrentJurisdictions([]);
      setSelectedJurisdiction(null);
      setViewState({ mode: 'US', bounds: null, center: null, zoom: null });
      setHasSelectedJurisdiction(false);
      setTopResults({ artists: [], songs: [] });
      setHoveredState(null);
    } else {
      // Back to previous jurisdiction level
      const children = await fetchChildren(previousLevel.jurisdictionId);
      setCurrentJurisdictions(children);
      
      // Fetch parent jurisdiction for bounds
      try {
        const response = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${previousLevel.jurisdictionId}`,
        });
        setSelectedJurisdiction(response.data);
        
        const bounds = getBoundsFromPolygon(response.data.polygon);
        if (bounds) {
          setViewState({ mode: 'JURISDICTION', bounds, center: null, zoom: null });
        }
      } catch (err) {
        console.error('Failed to fetch parent:', err);
      }
      
      fetchTopResults(previousLevel.name);
    }
  };

  /**
   * Handle random button
   */
  const handleRandom = () => {
    setIsAnimating(true);
    let count = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * stateCenters.length);
      setHoveredState(stateCenters[randomIndex].name);
      count++;
      if (count >= 10) {
        clearInterval(interval);
        setIsAnimating(false);
        const finalIndex = Math.floor(Math.random() * stateCenters.length);
        const finalState = stateCenters[finalIndex];
        if (finalState.name === 'New York') {
          handleStateClick({ properties: { name: 'New York' } }, { getBounds: () => [[40, -80], [45, -70]] });
        } else {
          alert(`${finalState.name} coming to Unis soon!`);
        }
      }
    }, 500);
  };

  // ==========================================================================
  // NAVIGATION HELPERS
  // ==========================================================================

  const handleJurisdictionNavigate = () => {
    const name = selectedJurisdiction?.name || 'Harlem';
    navigate(`/jurisdiction/${encodeURIComponent(name)}`);
  };

  const handleArtistView = (id) => navigate(`/artist/${id}`);
  const handleSongView = (id) => navigate(`/song/${id}`);

  const handlePlay = async (media) => {
    let trackingId = null;

    if (media.fileUrl) {
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
      trackingId = media.id;
    } else if (media.id && media.name) {
      try {
        const response = await apiCall({
          method: 'get',
          url: `/v1/users/${media.id}/default-song`,
        });
        const defaultSong = response.data;
        
        if (defaultSong && defaultSong.fileUrl) {
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
          trackingId = defaultSong.songId;
        }
      } catch (err) {
        console.error('Default song fetch failed:', err);
        return;
      }
    } else {
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

    if (trackingId && userId) {
      try {
        await apiCall({ 
          method: 'post', 
          url: `/v1/media/song/${trackingId}/play?userId=${userId}` 
        });
      } catch (err) {
        console.error('Failed to track play:', err);
      }
    }
  };

  // ==========================================================================
  // DISPLAY HELPERS
  // ==========================================================================

  const isAtUSLevel = () => viewState.mode === 'US';
  
  const displayTerritory = hoveredState || selectedJurisdiction?.name || 
    (navigationStack.length > 1 ? navigationStack[navigationStack.length - 1].name : 'Select a state');

  const showHarlemDataNotice = selectedJurisdiction && 
    !isActiveJurisdiction(selectedJurisdiction.name) && 
    isInHarlemChain(selectedJurisdiction.name);

  const showComingSoon = selectedJurisdiction && 
    !isInHarlemChain(selectedJurisdiction.name);

  const { artists, songs } = topResults;

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Layout backgroundImage={backimage}>
      <div className="find-page-container">
        {/* Filters */}
        <div className="findFilters">
          <select 
            value={genre} 
            onChange={(e) => setGenre(e.target.value)} 
            className="findfilter-select"
          >
            <option value="rap-hiphop">Rap</option>
            <option value="rock">Rock</option>
            <option value="pop">Pop</option>
          </select>
          <button 
            onClick={handleRandom} 
            disabled={isAnimating || loading} 
            className="random-button"
          >
            {isAnimating ? 'Spinning...' : 'Random'}
          </button>
        </div>

        <div className='mapEverything'>
          {/* Territory Name */}
          <p className="territory-name">{displayTerritory}</p>

          {/* Back Button */}
          {!isAtUSLevel() && (
            <button onClick={handleBack} className="back-button">
              ← Back
            </button>
          )}

          {/* Map Container */}
          <div className="map-container">
            <MapContainer
              center={[37.8, -96]}
              zoom={isMobile ? 3.2 : 4}
              ref={mapRef}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              dragging={false}
              zoomControl={false}
              attributionControl={false}
            >
              <MapController viewState={viewState} isMobile={isMobile} />
              
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />

              {/* US States Layer */}
              {isAtUSLevel() && usGeoData && (
                <GeoJSON
                  key="us-states"
                  data={usGeoData}
                  style={(feature) => {
                    const isSelected = feature.properties.name === selectedJurisdiction?.name;
                    const isHovered = feature.properties.name === hoveredState;
                    return {
                      fillColor: isSelected || isHovered ? '#163387' : '#EAEAEC',
                      fillOpacity: 1,
                      color: isSelected || isHovered ? '#FFFFFF' : '#999',
                      weight: isSelected || isHovered ? 2 : 1
                    };
                  }}
                  onEachFeature={(feature, layer) => {
                    layer.on({
                      click: () => handleStateClick(feature, layer),
                      mouseover: (e) => {
                        setHoveredState(feature.properties.name);
                        e.target.setStyle({
                          fillColor: '#163387',
                          color: '#163387',
                          weight: 2
                        });
                        e.target.bringToFront();
                      },
                      mouseout: (e) => {
                        setHoveredState(null);
                        e.target.setStyle({
                          fillColor: '#EAEAEC',
                          color: '#999',
                          weight: 1
                        });
                      }
                    });
                  }}
                />
              )}

              {/* Jurisdiction Polygons */}
              {!isAtUSLevel() && currentJurisdictions.length > 0 && (
                <GeoJSON
                  key={`jurisdictions-${navigationStack.length}-${currentJurisdictions.length}`}
                  data={jurisdictionsToGeoJSON(currentJurisdictions)}
                  style={(feature) => {
                    const name = feature.properties?.name;
                    const isSelected = selectedJurisdiction?.name === name;
                    const isHovered = hoveredState === name;
                    const isActive = feature.properties?.isActive;
                    const inChain = feature.properties?.isInHarlemChain;
                    
                    let fillColor = 'rgba(22, 51, 135, 0.3)';
                    if (isSelected || isHovered) {
                      fillColor = '#163387';
                    } else if (isActive) {
                      fillColor = '#2E5AAC';
                    } else if (inChain) {
                      fillColor = 'rgba(22, 51, 135, 0.5)';
                    }
                    
                    return {
                      fillColor,
                      fillOpacity: isSelected || isHovered ? 0.9 : 0.7,
                      color: isActive || inChain ? '#FFFFFF' : '#999',
                      weight: isSelected ? 2 : 1
                    };
                  }}
                  onEachFeature={(feature, layer) => {
                    const jurisdiction = currentJurisdictions.find(
                      j => j.jurisdictionId === feature.properties.jurisdictionId
                    );
                    
                    layer.on({
                      click: () => {
                        if (jurisdiction) {
                          handleJurisdictionClick(jurisdiction);
                        }
                      },
                      mouseover: (e) => {
                        setHoveredState(feature.properties.name);
                        e.target.setStyle({
                          fillColor: '#163387',
                          fillOpacity: 1
                        });
                        e.target.bringToFront();
                      },
                      mouseout: (e) => {
                        setHoveredState(null);
                        const isActive = feature.properties?.isActive;
                        const inChain = feature.properties?.isInHarlemChain;
                        const isSelected = selectedJurisdiction?.name === feature.properties.name;
                        
                        let fillColor = 'rgba(22, 51, 135, 0.3)';
                        if (isSelected) {
                          fillColor = '#163387';
                        } else if (isActive) {
                          fillColor = '#2E5AAC';
                        } else if (inChain) {
                          fillColor = 'rgba(22, 51, 135, 0.5)';
                        }
                        
                        e.target.setStyle({
                          fillColor,
                          fillOpacity: isSelected ? 0.9 : 0.7
                        });
                      }
                    });
                  }}
                />
              )}
            </MapContainer>
          </div>
        </div>

        {/* Loading/Error */}
        {loading && <div className="loading">Loading tops...</div>}
        {error && <div className="error">{error}</div>}

        {/* Results Section - Always show when a jurisdiction is selected */}
        {hasSelectedJurisdiction && (
          <div className="results-section">
            {/* Notice for Harlem parent chain */}
            {showHarlemDataNotice && (
              <div style={{
                width: '100%',
                textAlign: 'center',
                padding: '10px',
                marginBottom: '10px',
                backgroundColor: 'rgba(22, 51, 135, 0.1)',
                borderRadius: '8px',
                color: '#888',
                fontSize: '14px'
              }}>
                Showing top results from Harlem (launch jurisdiction)
              </div>
            )}

            {/* Coming Soon Notice for non-Harlem chain */}
            {showComingSoon && (
              <div style={{
                width: '100%',
                textAlign: 'center',
                padding: '20px',
                marginBottom: '10px',
                backgroundColor: 'rgba(22, 51, 135, 0.1)',
                borderRadius: '8px'
              }}>
                <p style={{ color: '#163387', fontSize: '24px', margin: '0 0 10px 0' }}>
                  {selectedJurisdiction.name}
                </p>
                <p style={{ color: '#888', margin: 0 }}>
                  Coming soon to Unis! Join the waitlist to be notified when this area launches.
                </p>
              </div>
            )}

            {/* Only show results if in Harlem chain */}
            {!showComingSoon && (
              <>
                {/* Top Songs Column */}
                <div className="column">
                  <h2 
                    onClick={handleJurisdictionNavigate}
                    style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.target.style.color = '#163387'}
                    onMouseLeave={(e) => e.target.style.color = 'inherit'}
                  >
                    Top Songs in {displayTerritory}
                  </h2>
                  <ul className="results-list">
                    {songs.slice(0, 3).map((item, index) => (
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
                    {songs.length === 0 && !loading && (
                      <li className="result-item">
                        <p style={{ color: '#888', textAlign: 'center', width: '100%' }}>
                          No songs yet
                        </p>
                      </li>
                    )}
                  </ul>
                </div>

                {/* Top Artists Column */}
                <div className="column">
                  <h2 
                    onClick={handleJurisdictionNavigate}
                    style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={(e) => e.target.style.color = '#163387'}
                    onMouseLeave={(e) => e.target.style.color = 'inherit'}
                  >
                    Top Artists in {displayTerritory}
                  </h2>
                  <ul className="results-list">
                    {artists.slice(0, 3).map((item, index) => (
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
                    {artists.length === 0 && !loading && (
                      <li className="result-item">
                        <p style={{ color: '#888', textAlign: 'center', width: '100%' }}>
                          No artists yet
                        </p>
                      </li>
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default FindPage;