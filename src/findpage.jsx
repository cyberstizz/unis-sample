import React, { useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import UnisMap from './map/UnisMap';
import { CANONICAL_GENRES } from './utils/idMappings';
import RankMove from './components/RankMove';
import { fetchStandings, describeBoard, playEntry } from './utils/standings';
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
const titleCase = (k) => k.charAt(0).toUpperCase() + k.slice(1);

// GENRE_NAMES is keyed by genre UUID, not by canonical key — looking it up by
// key returns undefined. The label comes from the key itself.
const GENRES = CANONICAL_GENRES.map((key) => ({ value: key, label: titleCase(key) }));

// Top results come from /v1/awards/standings (utils/standings.js): this
// week, in the selected genre, ranked by the same formula that decides
// awards. Changing the genre pill refetches for the place on screen.

const FindPage = () => {
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext);

  const [navigationStack, setNavigationStack] = useState([ROOT_CRUMB]);
  const [currentJurisdictions, setCurrentJurisdictions] = useState([]);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState(null);
  const [focusState, setFocusState] = useState(null);

  // The top three songs and artists for the place on screen, this week.
  const [rawTops, setRawTops] = useState({ artists: [], songs: [], status: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSelectedJurisdiction, setHasSelectedJurisdiction] = useState(false);
  const [genre, setGenre] = useState(CANONICAL_GENRES[0]);
  const genreRef = useRef(genre);
  const lastTopsIdRef = useRef(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [toast, setToast] = useState(null);
  const [spotlight, setSpotlight] = useState(null); // state lit during a random spin

  const toastTimer = useRef(null);
  const spinTimer = useRef(null);

  /* ------------------------------------------------------------- helpers */

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

      lastTopsIdRef.current = jurisdictionId;
      const wanted = genreRef.current;
      try {
        const [artistBoard, songBoard] = await Promise.all([
          fetchStandings({ type: 'artist', jurisdictionId, genre: wanted, period: 'weekly', limit: 3 }),
          fetchStandings({ type: 'song', jurisdictionId, genre: wanted, period: 'weekly', limit: 3 }),
        ]);
        // A newer place or genre was asked for while this was loading.
        if (lastTopsIdRef.current !== jurisdictionId || genreRef.current !== wanted) return;

        setRawTops({
          status: describeBoard(songBoard),
          artists: artistBoard.entries.filter((e) => e.points > 0).map((a) => ({
            id: a.id,
            rank: a.rank,
            name: a.name,
            votes: a.points,
            movement: a.movement,
            isNew: a.isNew,
            artwork: a.artwork,
          })),
          songs: songBoard.entries.filter((e) => e.points > 0).map((t) => ({
            id: t.id,
            rank: t.rank,
            title: t.name,
            artist: t.artistName || 'Unknown',
            artistId: t.artistId,
            votes: t.points,
            movement: t.movement,
            isNew: t.isNew,
            fileUrl: t.fileUrl,
            artwork: t.artwork,
          })),
        });
      } catch (err) {
        console.error('[findpage] standings fetch failed:', err?.message || err);
        setError('Top results are unavailable right now. Try again in a moment.');
        setRawTops({ artists: [], songs: [], status: null });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Genre changed: refetch the place on screen in the new genre.
  useEffect(() => {
    genreRef.current = genre;
    if (lastTopsIdRef.current && hasSelectedJurisdiction) {
      fetchTopResultsById(lastTopsIdRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre]);

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

  /**
   * Every state is enterable, live or not.
   *
   * Clicking California flies in and draws its regions exactly as New York
   * does, then shows the waitlist panel instead of charts. The point is that a
   * visitor sees their own state already mapped and subdivided — "this is
   * coming" reads very differently when you can see your own neighbourhood
   * outlined than when a click just produces a toast.
   *
   * The difference between live and dormant is depth, not access: a dormant
   * state opens one level and stops there, because that is as far as the
   * geometry goes. See handleTerritorySelect.
   */
  const handleStateSelect = useCallback(
    async (stateName) => {
      if (focusState === stateName) return;

      const isLive = ACTIVE_STATES.includes(stateName);

      setLoading(true);
      setHasSelectedJurisdiction(true);
      setError(null);

      try {
        const stateRes = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/byName/${encodeURIComponent(stateName)}`,
        });
        const jurisdiction = stateRes.data?.[0];

        // No row at all — nothing to fly to, so say so and stay put.
        if (!jurisdiction) {
          setLoading(false);
          setHasSelectedJurisdiction(false);
          showComingSoonToast(stateName);
          return;
        }

        // Charts are only fetched for live states. A dormant state has no
        // content to rank, so asking for its tops is a guaranteed empty
        // round trip on every click.
        const [children] = await Promise.all([
          fetchChildren(jurisdiction.jurisdictionId),
          isLive ? fetchTopResultsById(jurisdiction.jurisdictionId) : Promise.resolve(),
        ]);

        setFocusState(stateName);
        setNavigationStack([
          ROOT_CRUMB,
          { name: stateName, jurisdictionId: jurisdiction.jurisdictionId, tier: 2 },
        ]);
        setCurrentJurisdictions(children);
        setSelectedJurisdiction(jurisdiction);

        if (!isLive) {
          setRawTops({ artists: [], songs: [], status: null });
          setLoading(false);
        }
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

      // Inside a dormant state there is only one level of geometry, so a click
      // highlights the region and stops. Descending would fly the camera into
      // an empty frame.
      if (!ACTIVE_STATES.includes(focusState)) {
        showComingSoonToast(name);
        return;
      }

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
    [fetchChildren, fetchTopResultsById, fetchTopResultsByName, focusState, showComingSoonToast]
  );

  const resetToNational = useCallback(() => {
    setNavigationStack([ROOT_CRUMB]);
    setCurrentJurisdictions([]);
    setSelectedJurisdiction(null);
    setFocusState(null);
    setHasSelectedJurisdiction(false);
    setRawTops({ artists: [], songs: [], status: null });
    lastTopsIdRef.current = null;
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

  // Plays are counted by the Player after real listening — never here.
  const handlePlay = useCallback(
    (item, kind) => playEntry(
      kind === 'song'
        ? { type: 'song', id: item.id, name: item.title, artistName: item.artist, artistId: item.artistId, fileUrl: item.fileUrl, artwork: item.artwork }
        : { type: 'artist', id: item.id, name: item.name, artwork: item.artwork },
      requestPlay,
      'findpage'
    ),
    [requestPlay]
  );

  /* ------------------------------------------------------------- derived */

  // The visible three. Genre filtering happens on the server now.
  const topResults = useMemo(
    () => ({ artists: rawTops.artists.slice(0, 3), songs: rawTops.songs.slice(0, 3) }),
    [rawTops]
  );

  const genreLabel = titleCase(genre);

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

  const chartPlace = (() => {
    const key = String(displayTerritory || '').trim().toLowerCase().replace(/\s+/g, '-');
    return ['harlem', 'uptown-harlem', 'downtown-harlem'].includes(key) ? key : 'harlem';
  })();
  const openChart = () => navigate(`/charts?type=song&period=weekly&genre=${genre}&place=${chartPlace}`);

  /**
   * Artwork that is missing or fails to load falls back to a monogram, not to
   * stock photography. Showing a Midjourney rapper under a real artist's name
   * misrepresents them to anyone browsing the charts, and it made a broken CDN
   * path look like a working page — which is how a buildUrl bug went unnoticed.
   *
   * The failure is tracked in state rather than by swapping element.src so a
   * retry after remount is still possible and there is no chance of an
   * onError loop.
   */
  const [brokenArt, setBrokenArt] = useState(() => new Set());
  const markArtBroken = useCallback((key) => {
    setBrokenArt((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  const renderArtwork = (item, kind) => {
    const key = `${kind}-${item.id}`;
    const label = (kind === 'song' ? item.title : item.name) || '?';
    if (!item.artwork || brokenArt.has(key)) {
      return (
        <div className="item-artwork item-artwork--none" aria-hidden="true">
          {label.trim().charAt(0).toUpperCase()}
        </div>
      );
    }
    return (
      <img
        src={item.artwork}
        alt=""
        className="item-artwork"
        loading="lazy"
        onError={() => markArtBroken(key)}
      />
    );
  };

  const renderRow = (item, index, kind) => (
    <li
      key={item.id || index}
      className="result-item"
      style={{ animationDelay: `${index * 0.12 + (kind === 'artist' ? 0.18 : 0)}s` }}
    >
      {!!item.artwork && !brokenArt.has(`${kind}-${item.id}`) && (
        <div className="ambient-bg" style={{ backgroundImage: `url(${item.artwork})` }} />
      )}
      <div className="glass-content">
        <div className="rank">
          {item.rank || index + 1}
          <RankMove movement={item.movement} isNew={item.isNew} className="rank-move" />
        </div>
        {renderArtwork(item, kind)}
        <div className="item-info">
          <div className="item-title">{kind === 'song' ? item.title : item.name}</div>
          {kind === 'song' && <div className="item-artist">{item.artist}</div>}
        </div>
        <button
          type="button"
          onClick={() => handlePlay(item, kind)}
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
          {heading} {rawTops.status?.tone === 'final' ? 'last week' : 'this week'} in {displayTerritory}
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
              {renderColumn('Top songs', songs, 'song', `No ${genreLabel} songs charted here yet.`)}
              {renderColumn('Top artists', artists, 'artist', `No ${genreLabel} artists charted here yet.`)}
              <button type="button" className="findpage-fullchart" onClick={openChart}>
                See the full {genreLabel} chart for {displayTerritory}
              </button>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default FindPage;