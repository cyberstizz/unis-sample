import React, { useState, useContext, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from './layout';
import AdSlot from './components/AdSlot';
import backimage from './assets/randomrapper.jpeg';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import { useFeedback } from './context/FeedbackContext';
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

/*
 * Which places are open comes from the backend, never from this file.
 * GET /v1/jurisdictions/open returns every jurisdiction whose voting_enabled
 * flag is on, each with its chain from the root down to itself:
 *   [{ jurisdictionId, name, chain: [{ jurisdictionId, name }, ...] }]
 * Opening a neighborhood is a one-line UPDATE in Supabase; nothing here changes.
 *
 *   open      the jurisdiction itself is open (live dot, charts)
 *   on a path the jurisdiction is open or sits above an open one. A state is
 *             live when it is on a path.
 */
const EMPTY_OPEN = buildOpenIndex([]);

function buildOpenIndex(list) {
  const openIds = new Set();
  const openNames = [];
  const pathIds = new Set();
  const pathNames = new Set();
  for (const o of list) {
    openIds.add(o.jurisdictionId);
    openNames.push(o.name);
    for (const link of o.chain || []) {
      pathIds.add(link.jurisdictionId);
      pathNames.add(link.name);
    }
  }
  return { list, openIds, openNames, pathIds, pathNames, liveStates: [...pathNames] };
}

/**
 * The one open place at or below `id`, and the steps to reach it.
 *   { target, steps }  steps run from just below `id` down to target; empty
 *                      when `id` is itself open
 *   null               `id` is not on any open path, or the way down splits
 *                      (two or more open places below it: the visitor picks)
 */
function openTargetBelow(index, id) {
  if (!id || !index.pathIds.has(id)) return null;
  const found = new Map();
  for (const o of index.list) {
    const chain = o.chain || [];
    const at = chain.findIndex((link) => link.jurisdictionId === id);
    if (at === -1) continue;
    const rest = chain.slice(at);
    const hit = rest.findIndex((link) => index.openIds.has(link.jurisdictionId));
    if (hit === -1) continue;
    const target = rest[hit];
    if (!found.has(target.jurisdictionId)) {
      found.set(target.jurisdictionId, { target, steps: rest.slice(1, hit + 1) });
    }
  }
  return found.size === 1 ? [...found.values()][0] : null;
}

/** Pause between levels of the automatic drill-down, so each one is seen. */
const DRILL_STEP_MS = 400;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const feedback = useFeedback();
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
  const [spotlight, setSpotlight] = useState(null); // state lit during a random spin

  const spinTimer = useRef(null);
  const unmountedRef = useRef(false);

  // Open places, from the backend (see buildOpenIndex).
  const [openIndex, setOpenIndex] = useState(EMPTY_OPEN);
  const openPromiseRef = useRef(null);

  // True while the map walks itself down to the open neighborhood. Taps are
  // ignored until it lands.
  const drillingRef = useRef(false);
  const [drilling, setDrilling] = useState(false);

  /* ------------------------------------------------------------- helpers */

  const isOpen = (j) => Boolean(j && openIndex.openIds.has(j.jurisdictionId));

  // Tapping a place Unis hasn't opened yet. The app-wide toast carries it now,
  // with the same "Join the waitlist" way out.
  const showComingSoonToast = useCallback(
    (name) => {
      feedback.info(`Unis isn't in ${name} yet`, {
        id: 'findpage-coming-soon',
        action: { label: 'Join the waitlist', onClick: () => navigate('/waitlist') },
      });
    },
    [feedback, navigate]
  );

  useEffect(
    () => () => {
      unmountedRef.current = true;
      if (spinTimer.current) clearInterval(spinTimer.current);
    },
    []
  );

  /** Loads the open list once. Resolves to the index, or null if it failed. */
  const loadOpenIndex = useCallback(() => {
    if (!openPromiseRef.current) {
      openPromiseRef.current = apiCall({ method: 'get', url: '/v1/jurisdictions/open' })
        .then((res) => {
          const index = buildOpenIndex(Array.isArray(res?.data) ? res.data : []);
          if (!unmountedRef.current) setOpenIndex(index);
          return index;
        })
        .catch((err) => {
          console.error('[findpage] open jurisdictions fetch failed:', err?.message || err);
          openPromiseRef.current = null; // try again on the next click
          return null;
        });
    }
    return openPromiseRef.current;
  }, []);

  useEffect(() => {
    loadOpenIndex();
  }, [loadOpenIndex]);

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

  /** No charts to show (a closed place, or a place where the way down splits). */
  const clearTops = useCallback(() => {
    lastTopsIdRef.current = null;
    setRawTops({ artists: [], songs: [], status: null });
    setLoading(false);
  }, []);

  /**
   * Walks the map down one level at a time to an open neighborhood, so the
   * visitor sees where it is instead of tapping through every level.
   * `siblings` are the places on screen now (they hold the full map data for
   * the first step); `steps` come from openTargetBelow. The last step's charts
   * are loaded on arrival.
   */
  const autoDrill = useCallback(
    async (siblings, steps) => {
      if (!steps.length) return;
      drillingRef.current = true;
      setDrilling(true);
      setLoading(true);
      setHasSelectedJurisdiction(true);
      let onScreen = siblings;
      try {
        for (let i = 0; i < steps.length; i += 1) {
          const step = steps[i];
          const isTarget = i === steps.length - 1;
          await wait(DRILL_STEP_MS);
          if (unmountedRef.current) return;

          const full = onScreen.find((j) => j.jurisdictionId === step.jurisdictionId) || step;
          setSelectedJurisdiction(full);

          const [children] = await Promise.all([
            full.hasChildren === false ? Promise.resolve([]) : fetchChildren(step.jurisdictionId),
            isTarget ? fetchTopResultsById(step.jurisdictionId) : Promise.resolve(),
          ]);
          if (unmountedRef.current) return;

          if (children.length > 0) {
            setNavigationStack((prev) => [
              ...prev,
              { name: step.name, jurisdictionId: step.jurisdictionId, tier: prev[prev.length - 1].tier + 1 },
            ]);
            setCurrentJurisdictions(children);
            onScreen = children;
          }
        }
      } finally {
        drillingRef.current = false;
        if (!unmountedRef.current) setDrilling(false);
      }
    },
    [fetchChildren, fetchTopResultsById]
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
      if (drillingRef.current || focusState === stateName) return;

      setLoading(true);
      setHasSelectedJurisdiction(true);
      setError(null);

      try {
        const [stateRes, index] = await Promise.all([
          apiCall({
            method: 'get',
            url: `/v1/jurisdictions/byName/${encodeURIComponent(stateName)}`,
          }),
          loadOpenIndex(),
        ]);
        const jurisdiction = stateRes.data?.[0];

        // Without the open list there's no telling live from dormant.
        if (!index) {
          setLoading(false);
          setHasSelectedJurisdiction(false);
          setError('The map could not load right now. Try again in a moment.');
          return;
        }

        // No row at all — nothing to fly to, so say so and stay put.
        if (!jurisdiction) {
          setLoading(false);
          setHasSelectedJurisdiction(false);
          showComingSoonToast(stateName);
          return;
        }

        const isLive = index.pathIds.has(jurisdiction.jurisdictionId);
        const way = isLive ? openTargetBelow(index, jurisdiction.jurisdictionId) : null;
        const opensHere = Boolean(way && way.steps.length === 0);

        // Charts only where there is something to rank: the state itself when
        // it is open. A dormant state, or one where the way down splits, has
        // none; when there's one way down, the drill loads the charts on arrival.
        const [children] = await Promise.all([
          fetchChildren(jurisdiction.jurisdictionId),
          opensHere ? fetchTopResultsById(jurisdiction.jurisdictionId) : Promise.resolve(),
        ]);

        setFocusState(stateName);
        setNavigationStack([
          ROOT_CRUMB,
          { name: stateName, jurisdictionId: jurisdiction.jurisdictionId, tier: 2 },
        ]);
        setCurrentJurisdictions(children);
        setSelectedJurisdiction(jurisdiction);

        if (way && way.steps.length > 0) {
          await autoDrill(children, way.steps);
        } else if (!opensHere) {
          clearTops();
        }
      } catch (err) {
        console.error('[findpage] state select failed:', err?.message || err);
        setError(`${stateName} could not be loaded. Try again in a moment.`);
        setLoading(false);
      }
    },
    [fetchChildren, fetchTopResultsById, showComingSoonToast, focusState, loadOpenIndex, autoDrill, clearTops]
  );

  const handleTerritorySelect = useCallback(
    async (jurisdiction) => {
      if (drillingRef.current) return;
      const { jurisdictionId, name, hasChildren } = jurisdiction;

      // Select immediately so the camera starts moving before data lands.
      setSelectedJurisdiction(jurisdiction);

      // Inside a dormant state there is only one level of geometry, so a click
      // highlights the region and stops. Descending would fly the camera into
      // an empty frame.
      if (!openIndex.pathNames.has(focusState)) {
        showComingSoonToast(name);
        return;
      }

      setHasSelectedJurisdiction(true);
      setError(null);

      // Open: its own charts. Above exactly one open place: walk down to it.
      // Closed, or the way down splits: no charts (the panel says why).
      const way = openTargetBelow(openIndex, jurisdictionId);
      const opensHere = Boolean(way && way.steps.length === 0);
      const drillTo = way && way.steps.length > 0 ? way.steps : null;

      if (drillTo) setLoading(true);
      const [children] = await Promise.all([
        hasChildren ? fetchChildren(jurisdictionId) : Promise.resolve([]),
        opensHere ? fetchTopResultsById(jurisdictionId) : Promise.resolve(),
      ]);
      if (!opensHere && !drillTo) clearTops();

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

      if (drillTo) await autoDrill(children, drillTo);
    },
    [fetchChildren, fetchTopResultsById, focusState, showComingSoonToast, openIndex, autoDrill, clearTops]
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

  // Going back up never auto-drills, so a visitor can look at New York without
  // being pulled back down to the neighborhood.
  const navigateToCrumb = useCallback(
    async (targetIndex) => {
      if (drillingRef.current) return;
      if (targetIndex >= navigationStack.length - 1) return;

      const target = navigationStack[targetIndex];
      if (target.tier === 0) {
        resetToNational();
        return;
      }

      setNavigationStack(navigationStack.slice(0, targetIndex + 1));

      // Charts for the one open place at or below this level, if there is
      // exactly one. Otherwise none (closed, or the way down splits).
      const way = openTargetBelow(openIndex, target.jurisdictionId);
      const [children] = await Promise.all([
        fetchChildren(target.jurisdictionId),
        way ? fetchTopResultsById(way.target.jurisdictionId) : Promise.resolve(clearTops()),
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
    [navigationStack, fetchChildren, fetchTopResultsById, resetToNational, openIndex, clearTops]
  );

  const handleBack = useCallback(() => {
    if (drillingRef.current || navigationStack.length <= 1) return;
    navigateToCrumb(navigationStack.length - 2);
  }, [navigationStack, navigateToCrumb]);

  const handleRandom = useCallback(() => {
    if (isAnimating || drillingRef.current) return;
    setIsAnimating(true);

    // Spin through a few states, then land. Live states (from the open list)
    // are entered; anything else surfaces the waitlist.
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
        if (openIndex.pathNames.has(landed)) handleStateSelect(landed);
        else showComingSoonToast(landed);
      }
    }, 110);
  }, [isAnimating, handleStateSelect, showComingSoonToast, openIndex]);

  const handleJurisdictionNavigate = () => {
    const name = selectedJurisdiction?.name;
    if (!name) return;
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

  // Not on any open path: nothing here yet.
  const showComingSoonPanel =
    Boolean(selectedJurisdiction) && !openIndex.pathIds.has(selectedJurisdiction.jurisdictionId);

  // On an open path but not open itself, with two or more open places below
  // it: the visitor picks one. (Unreachable while only Harlem is open.)
  const showPickPanel =
    !drilling &&
    Boolean(selectedJurisdiction) &&
    !showComingSoonPanel &&
    !isOpen(selectedJurisdiction) &&
    openTargetBelow(openIndex, selectedJurisdiction.jurisdictionId) === null;

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

        <div
          className="mapEverything"
          aria-busy={drilling}
          style={drilling ? { pointerEvents: 'none' } : undefined}
        >
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
              liveStates={openIndex.liveStates}
              liveTerritories={openIndex.openNames}
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
                      } ${isOpen(j) ? 'live' : ''}`}
                      onClick={() => handleTerritorySelect(j)}
                    >
                      {j.name}
                      {isOpen(j) && (
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
          ) : showPickPanel ? (
            <div className="coming-soon-message">
              <p className="coming-soon-title">{selectedJurisdiction?.name}</p>
              <p className="coming-soon-text">
                Pick a neighborhood on the map to see its charts.
              </p>
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

        {/* Ad space (none for Unis Plus) */}
        <AdSlot placement="find" />
      </div>
    </Layout>
  );
};

export default FindPage;