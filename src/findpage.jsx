import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
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

const US_STATES_GEOJSON_URL =
  'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

const ACTIVE_JURISDICTIONS = ['Harlem', 'Uptown Harlem', 'Downtown Harlem'];
const HARLEM_PARENT_CHAIN = [
  'Unis', 'New York', 'New York City Metro', 'New York City',
  'Manhattan', 'Upper Manhattan', 'Harlem', 'Uptown Harlem', 'Downtown Harlem',
];

// ---------------------------------------------------------------------------
// MAP CONTROLLER
// ---------------------------------------------------------------------------
const MapController = ({ viewState, isMobile }) => {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => setTimeout(() => map.invalidateSize(), 100);
    invalidate();
    window.addEventListener('resize', invalidate);
    return () => window.removeEventListener('resize', invalidate);
  }, [map]);

  useEffect(() => {
    if (viewState.mode === 'US') {
      map.flyTo([37.8, -96], isMobile ? 3.2 : 4, { duration: 1.5 });
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

// ---------------------------------------------------------------------------
// FIND PAGE
// ---------------------------------------------------------------------------
const FindPage = () => {
  const navigate = useNavigate();
  const { playMedia } = useContext(PlayerContext);
  const { user } = useAuth();

  // Derive userId from AuthContext — no token decode needed
  const userId = user?.userId || null;

  const mapRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 600);

  const [viewState, setViewState] = useState({ mode: 'US', bounds: null, center: null, zoom: null });
  const [usGeoData, setUsGeoData] = useState(null);
  const [navigationStack, setNavigationStack] = useState([
    { name: 'United States', jurisdictionId: null, tier: 0 },
  ]);
  const [currentJurisdictions, setCurrentJurisdictions] = useState([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [topResults, setTopResults] = useState({ artists: [], songs: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSelectedJurisdiction, setHasSelectedJurisdiction] = useState(false);
  const [genre, setGenre] = useState('rap-hiphop');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  const defaultArtwork = {
    artists: [rapperOne, rapperTwo, rapperThree, rapperFree],
    songs: [songArtOne, songArtTwo, songArtThree, songArtFour],
  };

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

  // -------------------------------------------------------------------------
  // INIT
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    fetch(US_STATES_GEOJSON_URL)
      .then(res => res.json())
      .then(data => setUsGeoData(data))
      .catch(err => console.error('Failed to load US states:', err));
  }, []);

  // -------------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------------
  const isInHarlemChain = (name) => HARLEM_PARENT_CHAIN.includes(name);
  const isActiveJurisdiction = (name) => ACTIVE_JURISDICTIONS.includes(name);

  const parsePolygon = (polygon) => {
    if (!polygon) return null;
    try {
      return typeof polygon === 'string' ? JSON.parse(polygon) : polygon;
    } catch (e) {
      return null;
    }
  };

  const getBoundsFromPolygon = (polygon) => {
    const geometry = parsePolygon(polygon);
    if (!geometry?.coordinates) return null;
    const coords = geometry.coordinates[0];
    const lats = coords.map(c => c[1]);
    const lngs = coords.map(c => c[0]);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
  };

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
            isInHarlemChain: isInHarlemChain(j.name),
          },
          geometry,
        };
      })
      .filter(Boolean);
    return { type: 'FeatureCollection', features };
  }, []);

  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `${API_BASE_URL}${url}`;
  };

  // -------------------------------------------------------------------------
  // API — fetchChildren stays a standalone helper (used in multiple places)
  // -------------------------------------------------------------------------
  const fetchChildren = async (jurisdictionId) => {
    try {
      const res = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/${jurisdictionId}/children/detailed`,
      });
      return res.data || [];
    } catch {
      try {
        const fallback = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${jurisdictionId}/children`,
        });
        return (fallback.data || []).map(j => ({
          ...j,
          hasChildren: true,
          isActive: isActiveJurisdiction(j.name),
        }));
      } catch {
        return [];
      }
    }
  };

  // -------------------------------------------------------------------------
  // KEY FIX: fetchTopResults — was 2 sequential calls, now 1 call with a
  // resolved jurisdiction name. The caller is responsible for resolving the
  // jurisdictionId before calling this, so we can skip the byName lookup here
  // when we already have it.
  // -------------------------------------------------------------------------
  const fetchTopResultsById = async (jurisdictionId, displayName) => {
    setLoading(true);
    setError(null);
    setHasSelectedJurisdiction(true);

    try {
      const topsRes = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/${jurisdictionId}/tops`,
      });
      const rawData = topsRes.data;

      const topArtists = (rawData.topArtists || []).slice(0, 3).map((artist, i) => ({
        id: artist.userId || i,
        name: artist.username,
        votes: artist.score || 0,
        artwork: buildUrl(artist.photoUrl) || defaultArtwork.artists[i % 4],
      }));

      const topSongs = (rawData.topSongs || []).slice(0, 3).map((song, i) => ({
        id: song.songId || i,
        title: song.title,
        artist: song.artist?.username || 'Unknown',
        votes: song.score || 0,
        fileUrl: buildUrl(song.fileUrl),
        artwork: buildUrl(song.artworkUrl) || defaultArtwork.songs[i % 4],
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

  // Legacy name-based lookup — kept for handleBack which only has a name
  const fetchTopResultsByName = async (jurisdictionName) => {
    const resolvedName =
      !isActiveJurisdiction(jurisdictionName) && isInHarlemChain(jurisdictionName)
        ? 'Harlem'
        : jurisdictionName;

    try {
      const jurRes = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/byName/${encodeURIComponent(resolvedName)}`,
      });
      const jurId = jurRes.data?.[0]?.jurisdictionId;
      if (!jurId) throw new Error('Jurisdiction not found');
      await fetchTopResultsById(jurId, jurisdictionName);
    } catch (err) {
      console.error('fetchTopResultsByName error:', err);
      setError('Failed to load top results');
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // KEY FIX: handleStateClick — was 4 sequential calls:
  //   1. fetchJurisdictionByName("New York")
  //   2. fetchChildren(id)
  //   3. fetchTopResults → byName("New York") again  ← redundant
  //   4. fetchTopResults → tops(id)
  //
  // Now: byName + children fire in parallel. tops uses the id we already have.
  // Total: 2 parallel round trips instead of 4 sequential ones.
  // -------------------------------------------------------------------------
  const handleStateClick = async (feature, layer) => {
    const stateName = feature.properties.name;
    setHoveredState(stateName);

    if (stateName !== 'New York') {
      alert(`${stateName} coming to Unis soon!`);
      return;
    }

    setLoading(true);
    setHasSelectedJurisdiction(true);

    try {
      // Fire byName and (speculatively) nothing else yet — we need the ID first,
      // but children and tops both need it, so we get ID then fire both in parallel.
      const nyRes = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/byName/${encodeURIComponent('New York')}`,
      });
      const jurisdiction = nyRes.data?.[0];
      if (!jurisdiction) throw new Error('New York not found');

      // Now we have the ID — fire children and tops in parallel
      const [children] = await Promise.all([
        fetchChildren(jurisdiction.jurisdictionId),
        fetchTopResultsById(jurisdiction.jurisdictionId, 'New York'),
      ]);

      setNavigationStack([
        { name: 'United States', jurisdictionId: null, tier: 0 },
        { name: 'New York', jurisdictionId: jurisdiction.jurisdictionId, tier: 2 },
      ]);
      setCurrentJurisdictions(children);
      setSelectedJurisdiction(jurisdiction);

      const bounds = layer?.getBounds() || null;
      setViewState({ mode: 'STATE', bounds, center: null, zoom: null });
    } catch (err) {
      console.error('handleStateClick error:', err);
      setError('Failed to load New York data');
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // KEY FIX: handleJurisdictionClick — was sequential (fetchChildren, then
  // fetchTopResults → byName → tops). Now: if the jurisdiction is active we
  // already have its ID, so we call fetchTopResultsById directly and fire
  // children in parallel.
  // -------------------------------------------------------------------------
  const handleJurisdictionClick = async (jurisdiction) => {
    const { jurisdictionId, name, hasChildren, polygon } = jurisdiction;

    setSelectedJurisdiction(jurisdiction);
    setHoveredState(name);

    // Resolve the display jurisdiction (fall back to Harlem if not active)
    const resolvedName =
      !isActiveJurisdiction(name) && isInHarlemChain(name) ? 'Harlem' : name;

    // Fire children fetch and tops fetch in parallel
    const childrenPromise = hasChildren ? fetchChildren(jurisdictionId) : Promise.resolve([]);

    let topsPromise;
    if (resolvedName === name) {
      // We already have the ID — use it directly, no extra byName lookup
      topsPromise = fetchTopResultsById(jurisdictionId, name);
    } else {
      // Need to resolve "Harlem" ID — one extra call but unavoidable
      topsPromise = fetchTopResultsByName(name);
    }

    const [children] = await Promise.all([childrenPromise, topsPromise]);

    if (hasChildren && children.length > 0) {
      setNavigationStack(prev => [
        ...prev,
        { name, jurisdictionId, tier: prev[prev.length - 1].tier + 1 },
      ]);
      setCurrentJurisdictions(children);

      const bounds = getBoundsFromPolygon(polygon);
      if (bounds) {
        setViewState({ mode: 'JURISDICTION', bounds, center: null, zoom: null });
      }
    }
  };

  const handleBack = async () => {
    if (navigationStack.length <= 1) return;

    const newStack = [...navigationStack];
    newStack.pop();
    const previousLevel = newStack[newStack.length - 1];
    setNavigationStack(newStack);

    if (previousLevel.tier === 0) {
      setCurrentJurisdictions([]);
      setSelectedJurisdiction(null);
      setViewState({ mode: 'US', bounds: null, center: null, zoom: null });
      setHasSelectedJurisdiction(false);
      setTopResults({ artists: [], songs: [] });
      setHoveredState(null);
    } else {
      const [children] = await Promise.all([
        fetchChildren(previousLevel.jurisdictionId),
        fetchTopResultsByName(previousLevel.name),
      ]);
      setCurrentJurisdictions(children);

      try {
        const res = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${previousLevel.jurisdictionId}`,
          useCache: false,
        });
        setSelectedJurisdiction(res.data);
        const bounds = getBoundsFromPolygon(res.data.polygon);
        if (bounds) {
          setViewState({ mode: 'JURISDICTION', bounds, center: null, zoom: null });
        }
      } catch (err) {
        console.error('Failed to fetch parent:', err);
      }
    }
  };

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
          handleStateClick(
            { properties: { name: 'New York' } },
            { getBounds: () => [[40, -80], [45, -70]] }
          );
        } else {
          alert(`${finalState.name} coming to Unis soon!`);
        }
      }
    }, 500);
  };

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
        { type: 'song', url: media.fileUrl, title: media.title || media.name, artist: media.artist || media.name, artwork: media.artwork },
        []
      );
      trackingId = media.id;
    } else if (media.id && media.name) {
      try {
        const res = await apiCall({ method: 'get', url: `/v1/users/${media.id}/default-song` });
        const defaultSong = res.data;
        if (defaultSong?.fileUrl) {
          playMedia(
            {
              type: 'default-song',
              url: buildUrl(defaultSong.fileUrl),
              title: defaultSong.title,
              artist: media.name,
              artwork: buildUrl(defaultSong.artworkUrl) || media.artwork,
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
        { type: 'song', url: sampleSong, title: media.title || media.name, artist: media.artist || media.name, artwork: media.artwork },
        []
      );
      return;
    }

    if (trackingId && userId) {
      try {
        await apiCall({ method: 'post', url: `/v1/media/song/${trackingId}/play?userId=${userId}` });
      } catch (err) {
        console.error('Failed to track play:', err);
      }
    }
  };

  // -------------------------------------------------------------------------
  // DISPLAY
  // -------------------------------------------------------------------------
  const isAtUSLevel = () => viewState.mode === 'US';

  const displayTerritory =
    hoveredState ||
    selectedJurisdiction?.name ||
    (navigationStack.length > 1 ? navigationStack[navigationStack.length - 1].name : 'Select a state');

  const showComingSoon =
    selectedJurisdiction && !isInHarlemChain(selectedJurisdiction.name);

  const { artists, songs } = topResults;

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <Layout backgroundImage={backimage}>
      <div className="find-page-container">
        <div className="findFilters">
          <select value={genre} onChange={e => setGenre(e.target.value)} className="findfilter-select">
            <option value="rap-hiphop">Rap</option>
            <option value="rock">Rock</option>
            <option value="pop">Pop</option>
          </select>
          <button onClick={handleRandom} disabled={isAnimating || loading} className="random-button">
            {isAnimating ? 'Spinning...' : 'Random'}
          </button>
        </div>

        <div className="mapEverything">
          <p className="territory-name">{displayTerritory}</p>

          <button
            onClick={handleBack}
            className="back-button"
            style={{ visibility: isAtUSLevel() ? 'hidden' : 'visible', color: 'white' }}
          >
            ← Back
          </button>

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
              attributionControl={true}
            >
              <MapController viewState={viewState} isMobile={isMobile} />
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

              {isAtUSLevel() && usGeoData && (
                <GeoJSON
                  key="us-states"
                  data={usGeoData}
                  style={feature => {
                    const isSelected = feature.properties.name === selectedJurisdiction?.name;
                    const isHovered = feature.properties.name === hoveredState;
                    return {
                      fillColor: isSelected || isHovered ? '#163387' : '#EAEAEC',
                      fillOpacity: 1,
                      color: isSelected || isHovered ? '#FFFFFF' : '#999',
                      weight: isSelected || isHovered ? 2 : 1,
                    };
                  }}
                  onEachFeature={(feature, layer) => {
                    layer.on({
                      click: () => handleStateClick(feature, layer),
                      mouseover: e => {
                        setHoveredState(feature.properties.name);
                        e.target.setStyle({ fillColor: '#163387', color: '#163387', weight: 2 });
                        e.target.bringToFront();
                      },
                      mouseout: e => {
                        setHoveredState(null);
                        e.target.setStyle({ fillColor: '#EAEAEC', color: '#999', weight: 1 });
                      },
                    });
                  }}
                />
              )}

              {!isAtUSLevel() && currentJurisdictions.length > 0 && (
                <GeoJSON
                  key={`jurisdictions-${navigationStack.length}-${currentJurisdictions.length}`}
                  data={jurisdictionsToGeoJSON(currentJurisdictions)}
                  style={feature => {
                    const name = feature.properties?.name;
                    const isSelected = selectedJurisdiction?.name === name;
                    const isHovered = hoveredState === name;
                    const isActive = feature.properties?.isActive;
                    const inChain = feature.properties?.isInHarlemChain;
                    let fillColor = 'rgba(22, 51, 135, 0.3)';
                    if (isSelected || isHovered) fillColor = '#163387';
                    else if (isActive) fillColor = '#2E5AAC';
                    else if (inChain) fillColor = 'rgba(22, 51, 135, 0.5)';
                    return {
                      fillColor,
                      fillOpacity: isSelected || isHovered ? 0.9 : 0.7,
                      color: isActive || inChain ? '#FFFFFF' : '#999',
                      weight: isSelected ? 2 : 1,
                    };
                  }}
                  onEachFeature={(feature, layer) => {
                    const jurisdiction = currentJurisdictions.find(
                      j => j.jurisdictionId === feature.properties.jurisdictionId
                    );
                    layer.bindTooltip(feature.properties.name, {
                      permanent: true,
                      direction: 'center',
                      className: 'jurisdiction-label',
                    });
                    layer.on({
                      click: () => { if (jurisdiction) handleJurisdictionClick(jurisdiction); },
                      mouseover: e => {
                        setHoveredState(feature.properties.name);
                        e.target.setStyle({ fillColor: '#163387', fillOpacity: 1 });
                        e.target.bringToFront();
                      },
                      mouseout: e => {
                        setHoveredState(null);
                        const isActive = feature.properties?.isActive;
                        const inChain = feature.properties?.isInHarlemChain;
                        const isSelected = selectedJurisdiction?.name === feature.properties.name;
                        let fillColor = 'rgba(22, 51, 135, 0.3)';
                        if (isSelected) fillColor = '#163387';
                        else if (isActive) fillColor = '#2E5AAC';
                        else if (inChain) fillColor = 'rgba(22, 51, 135, 0.5)';
                        e.target.setStyle({ fillColor, fillOpacity: isSelected ? 0.9 : 0.7 });
                      },
                    });
                  }}
                />
              )}
            </MapContainer>
          </div>

          {isMobile && !isAtUSLevel() && currentJurisdictions.length > 0 && (
            <div className="jurisdiction-list-mobile">
              <p className="jurisdiction-list-title">Tap a region or select:</p>
              <ul className="jurisdiction-list">
                {currentJurisdictions.map(j => (
                  <li
                    key={j.jurisdictionId}
                    className={`jurisdiction-list-item ${selectedJurisdiction?.jurisdictionId === j.jurisdictionId ? 'selected' : ''} ${isInHarlemChain(j.name) ? 'in-chain' : ''}`}
                    onClick={() => handleJurisdictionClick(j)}
                  >
                    {j.name}
                    {isActiveJurisdiction(j.name) && <span className="active-badge">●</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="results-section" style={{ display: hasSelectedJurisdiction ? 'flex' : 'none' }}>
          {showComingSoon && (
            <div style={{
              width: '100%', textAlign: 'center', padding: '20px', marginBottom: '10px',
              backgroundColor: 'rgba(22, 51, 135, 0.1)', borderRadius: '8px',
            }}>
              <p style={{ color: '#163387', fontSize: '24px', margin: '0 0 10px 0' }}>
                {selectedJurisdiction?.name}
              </p>
              <p style={{ color: '#888', margin: 0 }}>
                Coming soon to Unis! Join the waitlist to be notified when this area launches.
              </p>
            </div>
          )}

          {!showComingSoon && (
            <>
              <div className="column">
                <h2
                  onClick={handleJurisdictionNavigate}
                  style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.target.style.color = '#163387')}
                  onMouseLeave={e => (e.target.style.color = 'inherit')}
                >
                  Top Songs in {displayTerritory}
                </h2>
                <ul className="results-list">
                  {loading ? (
                    <li className="result-item">
                      <div className="glass-content">
                        <p style={{ color: '#888', textAlign: 'center', width: '100%' }}>Loading...</p>
                      </div>
                    </li>
                  ) : songs.length > 0 ? (
                    songs.slice(0, 3).map((item, index) => (
                      <li key={item.id || index} className="result-item" style={{ animationDelay: `${index * 0.15}s` }}>
                        <div className="ambient-bg" style={{ backgroundImage: `url(${item.artwork})` }} />
                        <div className="glass-content">
                          <div className="rank">#{index + 1}</div>
                          <img src={item.artwork} alt={item.title} className="item-artwork" />
                          <div className="item-info">
                            <div className="item-title">{item.title}</div>
                            <div className="item-artist">{item.artist}</div>
                          </div>
                          <button onClick={() => handlePlay(item)} className="play-button">Play</button>
                          <button onClick={() => handleSongView(item.id)} className="view-button">View</button>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="result-item">
                      <div className="glass-content">
                        <p style={{ color: '#888', textAlign: 'center', width: '100%' }}>No songs yet</p>
                      </div>
                    </li>
                  )}
                </ul>
              </div>

              <div className="column">
                <h2
                  onClick={handleJurisdictionNavigate}
                  style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.target.style.color = '#163387')}
                  onMouseLeave={e => (e.target.style.color = 'inherit')}
                >
                  Top Artists in {displayTerritory}
                </h2>
                <ul className="results-list">
                  {loading ? (
                    <li className="result-item">
                      <div className="glass-content">
                        <p style={{ color: '#888', textAlign: 'center', width: '100%' }}>Loading...</p>
                      </div>
                    </li>
                  ) : artists.length > 0 ? (
                    artists.slice(0, 3).map((item, index) => (
                      <li key={item.id || index} className="result-item" style={{ animationDelay: `${(index * 0.15) + 0.2}s` }}>
                        <div className="ambient-bg" style={{ backgroundImage: `url(${item.artwork})` }} />
                        <div className="glass-content">
                          <div className="rank">#{index + 1}</div>
                          <img src={item.artwork} alt={item.name} className="item-artwork" />
                          <div className="item-info">
                            <div className="item-title">{item.name}</div>
                          </div>
                          <button onClick={() => handlePlay(item)} className="play-button">Play</button>
                          <button onClick={() => handleArtistView(item.id)} className="view-button">View</button>
                        </div>
                      </li>
                    ))
                  ) : (
                    <li className="result-item">
                      <div className="glass-content">
                        <p style={{ color: '#888', textAlign: 'center', width: '100%' }}>No artists yet</p>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default FindPage;