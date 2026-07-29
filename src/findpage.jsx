import React, { useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import sampleSong from './assets/tonyfadd_paranoidbuy1get1free.mp3';
import rapperOne from './assets/rapperphotoOne.jpg';
import rapperTwo from './assets/rapperphototwo.jpg';
import rapperThree from './assets/rapperphotothree.jpg';
import rapperFree from './assets/rapperphotofour.jpg';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';
import { apiCall } from './components/axiosInstance';
import UnisMap from './map/UnisMap';
import { CANONICAL_GENRES, GENRE_NAMES } from './utils/idMappings';
import './findpage.scss';

/**
 * FindPage — territory discovery.
 *
 * The map here is src/map/UnisMap.jsx, which replaced leaflet, react-leaflet,
 * react-simple-maps and topojson-client. There is no tile provider, no API
 * key, no attribution requirement, and nothing fetched from a third party at
 * render time. State outlines ship pre-projected in the bundle; jurisdiction
 * polygons come from our own API and are projected into the same coordinate
 * system on arrival.
 */

/** Jurisdictions with voting live today. */
const ACTIVE_JURISDICTIONS = ['Harlem', 'Uptown Harlem', 'Downtown Harlem'];

/** States Unis has launched in. Everything else short-circuits client-side. */
const ACTIVE_STATES = ['New York'];

/** The path down to Harlem. Anything on it resolves to Harlem's results. */
const HARLEM_PARENT_CHAIN = [
  'Unis', 'New York', 'New York City Metro', 'New York City',
  'Manhattan', 'Upper Manhattan', 'Harlem', 'Uptown Harlem', 'Downtown Harlem',
];

const ROOT_CRUMB = { name: 'United States', jurisdictionId: null, tier: 0 };

// Iterate CANONICAL_GENRES, never GENRE_IDS — the latter carries legacy
// aliases and is what produced the duplicate options in createAccountWizard.
const GENRES = CANONICAL_GENRES.map((key) => ({
  value: key,
  label: GENRE_NAMES?.[key] || key.charAt(0).toUpperCase() + key.slice(1),
}));

// KNOWN GAP — the genre control is currently inert on this page.
// /v1/jurisdictions/{id}/tops takes no genre parameter; both callers (here and
// jurisdictionPage) hit it bare. Genre filtering exists on
// /v1/vote/leaderboards, which does accept genreId. Until /tops grows the same
// parameter, changing the genre pill updates local state and nothing else.
// To wire it once the backend supports it: add `?genreId=${getGenreId(genre)}`
// to the tops URL and add `genre` to fetchTopResultsById's dependency array.

const FindPage = () => {
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext);
  const { user } = useAuth();

  const userId = user?.userId || null;

  const [navigationStack, setNavigationStack] = useState([ROOT_CRUMB]);
  const [currentJurisdictions, setCurrentJurisdictions] = useState([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(null);
  const [focusState, setFocusState] = useState(null);

  const [topResults, setTopResults] = useState({ artists: [], songs: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSelectedJurisdiction, setHasSelectedJurisdiction] = useState(false);
  const [genre, setGenre] = useState(CANONICAL_GENRES[0]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [toast, setToast] = useState(null);
  const [spotlight, setSpotlight] = useState(null); // state lit during a random spin

  const toastTimer = useRef(null);
  const spinTimer = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  const defaultArtwork = useMemo(
    () => ({
      artists: [rapperOne, rapperTwo, rapperThree, rapperFree],
      songs: [songArtOne, songArtTwo, songArtThree, songArtFour],
    }),
    []
  );

  /* ------------------------------------------------------------- helpers */

  const buildUrl = useCallback(
    (url) => {
      if (!url) return null;
      return url.startsWith('http://') || url.startsWith('https://')
        ? url
        : `${API_BASE_URL}${url}`;
    },
    [API_BASE_URL]
  );

  const isInHarlemChain = (name) => HARLEM_PARENT_CHAIN.includes(name);
  const isActiveJurisdiction = (name) => ACTIVE_JURISDICTIONS.includes(name);

  const showComingSoonToast = useCallback((name) => {
    setToast({ name });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (spinTimer.current) clearInterval(spinTimer.current);
    },
    []
  );

  /* --------------------------------------------------------- ad tracking */
  // SecurityConfig maps POST /api/v1/earnings/track-view to .authenticated(),
  // so calling it as a guest is a guaranteed 403 in the console on every visit.
  // An ad view cannot be credited to an anonymous user anyway — there is no
  // account to attribute the earning to — so skip it when logged out.
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await apiCall({ url: '/v1/earnings/track-view', method: 'post' });
      } catch (err) {
        if (!cancelled) console.warn('[findpage] track-view failed:', err?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /* ------------------------------------------------------------- the API */

  const fetchChildren = useCallback(async (jurisdictionId) => {
    try {
      const res = await apiCall({
        method: 'get',
        url: `/v1/jurisdictions/${jurisdictionId}/children/detailed`,
      });
      return res.data || [];
    } catch (err) {
      console.warn(`[findpage] children/detailed failed for ${jurisdictionId}:`, err?.message || err);
      try {
        const fallback = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${jurisdictionId}/children`,
        });
        return (fallback.data || []).map((j) => ({ ...j, hasChildren: true }));
      } catch (fallbackErr) {
        console.error(`[findpage] children fetch failed:`, fallbackErr?.message || fallbackErr);
        return [];
      }
    }
  }, []);

  const fetchTopResultsById = useCallback(
    async (jurisdictionId) => {
      setLoading(true);
      setError(null);
      setHasSelectedJurisdiction(true);

      try {
        const res = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${jurisdictionId}/tops`,
        });
        const raw = res.data || {};

        setTopResults({
          artists: (raw.topArtists || []).slice(0, 3).map((a, i) => ({
            id: a.userId || i,
            name: a.username,
            votes: a.score || 0,
            artwork: buildUrl(a.photoUrl) || defaultArtwork.artists[i % 4],
          })),
          songs: (raw.topSongs || []).slice(0, 3).map((s, i) => ({
            id: s.songId || i,
            title: s.title,
            artist: s.artist?.username || 'Unknown',
            artistId: s.artist?.userId,
            votes: s.score || 0,
            fileUrl: buildUrl(s.fileUrl),
            artwork: buildUrl(s.artworkUrl) || defaultArtwork.songs[i % 4],
          })),
        });
      } catch (err) {
        console.error('[findpage] tops fetch failed:', err?.message || err);
        setError('Top results are unavailable right now. Try again in a moment.');
        setTopResults({ artists: [], songs: [] });
      } finally {
        setLoading(false);
      }
    },
    [buildUrl, defaultArtwork]
  );

  /** Name-based lookup, for paths where only a name survived (back, crumbs). */
  const fetchTopResultsByName = useCallback(
    async (jurisdictionName) => {
      const resolved =
        !isActiveJurisdiction(jurisdictionName) && isInHarlemChain(jurisdictionName)
          ? 'Harlem'
          : jurisdictionName;

      try {
        const res = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/byName/${encodeURIComponent(resolved)}`,
        });
        const id = res.data?.[0]?.jurisdictionId;
        if (!id) throw new Error(`no jurisdiction named ${resolved}`);
        await fetchTopResultsById(id);
      } catch (err) {
        console.error('[findpage] byName lookup failed:', err?.message || err);
        setError('Top results are unavailable right now. Try again in a moment.');
        setLoading(false);
      }
    },
    [fetchTopResultsById]
  );

  /* -------------------------------------------------------- interactions */

  const handleStateSelect = useCallback(
    async (stateName) => {
      if (!ACTIVE_STATES.includes(stateName)) {
        showComingSoonToast(stateName);
        return;
      }
      if (focusState === stateName) return;

      setLoading(true);
      setHasSelectedJurisdiction(true);

      try {
        const stateRes = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/byName/${encodeURIComponent(stateName)}`,
        });
        const jurisdiction = stateRes.data?.[0];

        if (!jurisdiction) {
          setLoading(false);
          setHasSelectedJurisdiction(false);
          showComingSoonToast(stateName);
          return;
        }

        // One ID gets us both calls in parallel — no redundant byName lookup.
        const [children] = await Promise.all([
          fetchChildren(jurisdiction.jurisdictionId),
          fetchTopResultsById(jurisdiction.jurisdictionId),
        ]);

        setFocusState(stateName);
        setNavigationStack([
          ROOT_CRUMB,
          { name: stateName, jurisdictionId: jurisdiction.jurisdictionId, tier: 2 },
        ]);
        setCurrentJurisdictions(children);
        setSelectedJurisdiction(jurisdiction);
      } catch (err) {
        console.error('[findpage] state select failed:', err?.message || err);
        setError(`${stateName} could not be loaded. Try again in a moment.`);
        setLoading(false);
      }
    },
    [fetchChildren, fetchTopResultsById, showComingSoonToast, focusState]
  );

  const handleTerritorySelect = useCallback(
    async (jurisdiction) => {
      const { jurisdictionId, name, hasChildren } = jurisdiction;

      // Select immediately so the camera starts moving before data lands.
      setSelectedJurisdiction(jurisdiction);

      const resolvedName =
        !isActiveJurisdiction(name) && isInHarlemChain(name) ? 'Harlem' : name;

      const childrenPromise = hasChildren ? fetchChildren(jurisdictionId) : Promise.resolve([]);
      const topsPromise =
        resolvedName === name
          ? fetchTopResultsById(jurisdictionId)
          : fetchTopResultsByName(name);

      const [children] = await Promise.all([childrenPromise, topsPromise]);

      // Descend only when there is somewhere to descend to. A leaf stays put
      // and simply becomes the selection — the old build silently ignored
      // leaf clicks, so the map never moved for them.
      if (hasChildren && children.length > 0) {
        setNavigationStack((prev) => [
          ...prev,
          { name, jurisdictionId, tier: prev[prev.length - 1].tier + 1 },
        ]);
        setCurrentJurisdictions(children);
      }
    },
    [fetchChildren, fetchTopResultsById, fetchTopResultsByName]
  );

  const resetToNational = useCallback(() => {
    setNavigationStack([ROOT_CRUMB]);
    setCurrentJurisdictions([]);
    setSelectedJurisdiction(null);
    setFocusState(null);
    setHasSelectedJurisdiction(false);
    setTopResults({ artists: [], songs: [] });
    setError(null);
  }, []);

  const navigateToCrumb = useCallback(
    async (targetIndex) => {
      if (targetIndex >= navigationStack.length - 1) return;

      const target = navigationStack[targetIndex];
      if (target.tier === 0) {
        resetToNational();
        return;
      }

      setNavigationStack(navigationStack.slice(0, targetIndex + 1));

      const [children] = await Promise.all([
        fetchChildren(target.jurisdictionId),
        fetchTopResultsByName(target.name),
      ]);
      setCurrentJurisdictions(children);

      try {
        const res = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${target.jurisdictionId}`,
        });
        setSelectedJurisdiction(res.data);
      } catch (err) {
        console.warn('[findpage] crumb detail fetch failed:', err?.message || err);
      }
    },
    [navigationStack, fetchChildren, fetchTopResultsByName, resetToNational]
  );

  const handleBack = useCallback(() => {
    if (navigationStack.length <= 1) return;
    navigateToCrumb(navigationStack.length - 2);
  }, [navigationStack, navigateToCrumb]);

  const handleRandom = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);

    // Spin through a few states, then land. Only New York can actually be
    // entered today, so anything else surfaces the waitlist.
    const pool = ['California', 'Texas', 'Georgia', 'Illinois', 'New York', 'Florida'];
    let count = 0;

    spinTimer.current = setInterval(() => {
      count += 1;
      // Light up a different state each tick so the map visibly spins. Without
      // this the button said "Spinning" for 900ms while nothing moved.
      setSpotlight(pool[count % pool.length]);

      if (count >= 8) {
        clearInterval(spinTimer.current);
        setIsAnimating(false);
        const landed = pool[Math.floor(Math.random() * pool.length)];
        setSpotlight(null);
        if (landed === 'New York') handleStateSelect('New York');
        else showComingSoonToast(landed);
      }
    }, 110);
  }, [isAnimating, handleStateSelect, showComingSoonToast]);

  const handleJurisdictionNavigate = () => {
    const name = selectedJurisdiction?.name || 'Harlem';
    navigate(`/jurisdiction/${encodeURIComponent(name)}`);
  };

  const handleArtistView = (id) => navigate(`/artist/${id}`);
  const handleSongView = (id) => navigate(`/song/${id}`);

  const handlePlay = useCallback(
    async (media) => {
      let trackingId = null;

      if (media.fileUrl) {
        requestPlay({
          type: 'song',
          id: media.id,
          songId: media.id,
          url: media.fileUrl,
          fileUrl: media.fileUrl,
          title: media.title || media.name,
          artist: media.artist || media.name,
          artistId: media.artistId,
          artwork: media.artwork,
          artworkUrl: media.artwork,
        });
        trackingId = media.id;
      } else if (media.id && media.name) {
        try {
          const res = await apiCall({ method: 'get', url: `/v1/users/${media.id}/default-song` });
          const song = res.data;
          if (!song?.fileUrl) return;

          const fullUrl = buildUrl(song.fileUrl);
          const fullArtwork = buildUrl(song.artworkUrl) || media.artwork;

          requestPlay({
            type: 'song',
            id: song.songId,
            songId: song.songId,
            url: fullUrl,
            fileUrl: fullUrl,
            title: song.title,
            artist: media.name,
            artistId: media.id,
            artwork: fullArtwork,
            artworkUrl: fullArtwork,
          });
          trackingId = song.songId;
        } catch (err) {
          console.error('[findpage] default song fetch failed:', err?.message || err);
          return;
        }
      } else {
        requestPlay({
          type: 'song',
          id: media.id,
          songId: media.id,
          url: sampleSong,
          fileUrl: sampleSong,
          title: media.title || media.name,
          artist: media.artist || media.name,
          artistId: media.artistId,
          artwork: media.artwork,
          artworkUrl: media.artwork,
        });
        return;
      }

      if (trackingId && userId) {
        try {
          await apiCall({
            method: 'post',
            url: `/v1/media/song/${trackingId}/play?userId=${userId}`,
          });
        } catch (err) {
          console.error('[findpage] play tracking failed:', err?.message || err);
        }
      }
    },
    [requestPlay, buildUrl, userId]
  );

  /* ------------------------------------------------------------- derived */

  const mapMode = useMemo(() => {
    if (navigationStack.length <= 1) return 'US';
    if (navigationStack.length === 2) return 'STATE';
    return 'TERRITORY';
  }, [navigationStack]);

  const atNationalLevel = mapMode === 'US';

  const displayTerritory =
    selectedJurisdiction?.name ||
    navigationStack[navigationStack.length - 1]?.name ||
    'Select a state';

  const showComingSoonPanel =
    selectedJurisdiction && !isInHarlemChain(selectedJurisdiction.name);

  const { artists, songs } = topResults;

  const renderRow = (item, index, kind) => (
    <li
      key={item.id || index}
      className="result-item"
      style={{ animationDelay: `${index * 0.12 + (kind === 'artist' ? 0.18 : 0)}s` }}
    >
      <div className="ambient-bg" style={{ backgroundImage: `url(${item.artwork})` }} />
      <div className="glass-content">
        <div className="rank">{index + 1}</div>
        <img src={item.artwork} alt="" className="item-artwork" />
        <div className="item-info">
          <div className="item-title">{kind === 'song' ? item.title : item.name}</div>
          {kind === 'song' && <div className="item-artist">{item.artist}</div>}
        </div>
        <button
          type="button"
          onClick={() => handlePlay(item)}
          className="findpage-play-button"
          aria-label={`Play ${kind === 'song' ? item.title : item.name}`}
        >
          Play
        </button>
        <button
          type="button"
          onClick={() => (kind === 'song' ? handleSongView(item.id) : handleArtistView(item.id))}
          className="findpage-view-button"
        >
          View
        </button>
      </div>
    </li>
  );

  const renderColumn = (heading, items, kind, emptyCopy) => (
    <div className="column">
      <h2>
        <button type="button" className="column-link" onClick={handleJurisdictionNavigate}>
          {heading} in {displayTerritory}
        </button>
      </h2>
      <ul className="results-list">
        {loading ? (
          <li className="result-item is-skeleton" aria-hidden="true">
            <div className="glass-content" />
          </li>
        ) : items.length > 0 ? (
          items.slice(0, 3).map((item, i) => renderRow(item, i, kind))
        ) : (
          <li className="result-item is-empty">
            <div className="glass-content">
              <p>{emptyCopy}</p>
            </div>
          </li>
        )}
      </ul>
    </div>
  );

  /* -------------------------------------------------------------- render */

  return (
    <Layout backgroundImage={backimage}>
      <div className="find-page-container">
        <div className="findFilters">
          <div className="genre-seg" role="group" aria-label="Genre">
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="genre-seg-native"
              aria-label="Genre"
            >
              {GENRES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            {GENRES.map((g) => (
              <button
                key={g.value}
                type="button"
                className={`genre-pill ${genre === g.value ? 'active' : ''}`}
                aria-pressed={genre === g.value}
                onClick={() => setGenre(g.value)}
              >
                {g.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRandom}
            disabled={isAnimating || loading}
            className="random-button"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="random-icon"
            >
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
            </svg>
            {isAnimating ? 'Spinning' : 'Surprise me'}
          </button>
        </div>

        <div className="mapEverything">
          <nav className="crumbs" aria-label="Territory path">
            {navigationStack.map((level, i) => {
              const isLast = i === navigationStack.length - 1;
              return (
                <span key={`${level.name}-${i}`} className="crumb-group">
                  {isLast ? (
                    <span className="here" aria-current="page">
                      {level.name}
                    </span>
                  ) : (
                    <button type="button" className="crumb" onClick={() => navigateToCrumb(i)}>
                      {level.name}
                    </button>
                  )}
                  {!isLast && (
                    <span className="sep" aria-hidden="true">
                      ›
                    </span>
                  )}
                </span>
              );
            })}
          </nav>

          <div className="hero">
            <p className="territory-name">{displayTerritory}</p>
            <div className="eq" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <button
            type="button"
            onClick={handleBack}
            className="back-button"
            style={{ visibility: atNationalLevel ? 'hidden' : 'visible' }}
          >
            ← Back
          </button>

          <div className="map-frame">
            <UnisMap
              mode={mapMode}
              focusState={focusState}
              spotlight={spotlight}
              territories={currentJurisdictions}
              selectedId={selectedJurisdiction?.jurisdictionId || null}
              liveStates={ACTIVE_STATES}
              liveTerritories={ACTIVE_JURISDICTIONS}
              onStateSelect={handleStateSelect}
              onTerritorySelect={handleTerritorySelect}
              loading={loading}
            />

            <div className="map-key" role="note" aria-label="Map key">
              <span className="key-item">
                <span className="key-dot key-dot--live" aria-hidden="true" />
                Live on Unis
              </span>
              <span className="key-item">
                <span className="key-dot key-dot--dark" aria-hidden="true" />
                Not open yet
              </span>
            </div>

            <div className={`map-toast ${toast ? 'show' : ''}`} role="status" aria-live="polite">
              {toast && (
                <>
                  <span className="map-toast-text">Unis isn't in {toast.name} yet</span>
                  <button
                    type="button"
                    className="map-toast-cta"
                    onClick={() => navigate('/waitlist')}
                  >
                    Join the waitlist
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Always rendered, not mobile-only. It is the keyboard path into
              territories and the fallback when a polygon is missing. */}
          {currentJurisdictions.length > 0 && (
            <div className="region-rail">
              <p className="region-rail-title">Regions in {navigationStack[navigationStack.length - 1]?.name}</p>
              <ul className="region-list">
                {currentJurisdictions.map((j) => (
                  <li key={j.jurisdictionId}>
                    <button
                      type="button"
                      className={`region-chip ${
                        selectedJurisdiction?.jurisdictionId === j.jurisdictionId ? 'selected' : ''
                      } ${isActiveJurisdiction(j.name) ? 'live' : ''}`}
                      onClick={() => handleTerritorySelect(j)}
                    >
                      {j.name}
                      {isActiveJurisdiction(j.name) && (
                        <span className="live-dot" aria-label="live" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <p className="find-error" role="alert">
            {error}
          </p>
        )}

        <div
          className="results-section"
          style={{ display: hasSelectedJurisdiction ? 'flex' : 'none' }}
        >
          {showComingSoonPanel ? (
            <div className="coming-soon-message">
              <p className="coming-soon-title">{selectedJurisdiction?.name}</p>
              <p className="coming-soon-text">
                No charts here yet. Join the waitlist and we'll tell you the day it opens.
              </p>
              <button type="button" className="map-toast-cta" onClick={() => navigate('/waitlist')}>
                Join the waitlist
              </button>
            </div>
          ) : (
            <>
              {renderColumn('Top songs', songs, 'song', 'No songs charted here yet.')}
              {renderColumn('Top artists', artists, 'artist', 'No artists charted here yet.')}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default FindPage;