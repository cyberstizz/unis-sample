import React, { useState, useEffect, useRef, useCallback, useContext, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { buildUrl } from "./utils/buildUrl";
import { apiCall } from "./components/axiosInstance";
import { PlayerContext } from "./context/playercontext"; // requestPlay → PlayChoiceModal. Discover NEVER counts plays; Player.jsx owns the 15s/25% gate.
import { useAuth } from "./context/AuthContext";
import { JURISDICTION_IDS } from "./utils/idMappings";
import Layout from "./layout";

import "./DiscoverPage.scss";

// ----------------------------------------------------------------------------
// constants
// ----------------------------------------------------------------------------

// Type toggle. "user" = artists + listeners unified (search_all umbrella).
const TYPES = [
  { key: "all", label: "All" },
  { key: "user", label: "Users" },
  { key: "playlist", label: "Playlists" },
  { key: "song", label: "Songs" },
  { key: "video", label: "Videos" },
];

// Order of rails in the "All" view, and the per-type fetch set.
const RAIL_TYPES = ["user", "playlist", "song", "video"];
const RAIL_LIMIT = 12;
const GRID_LIMIT = 30;

const RAIL_TITLES = {
  all: "Everything",
  user: "Users",
  playlist: "Playlists",
  song: "Songs",
  video: "Videos",
};

// Static — these are the only jurisdictions live today. Add to this list as new
// ones launch. Module scope on purpose: it never changes, so it must not be
// re-allocated on every render.
const SCOPE_OPTIONS = [
  { id: null, name: "Everywhere", level: "All" },
  { id: JURISDICTION_IDS.harlem, name: "Harlem", level: "All active" },
  { id: JURISDICTION_IDS["uptown-harlem"], name: "Uptown Harlem", level: "Neighborhood" },
  { id: JURISDICTION_IDS["downtown-harlem"], name: "Downtown Harlem", level: "Neighborhood" },
];

const DEFAULT_SCOPE = SCOPE_OPTIONS.find((o) => o.id === JURISDICTION_IDS.harlem) || SCOPE_OPTIONS[0];

// Only ids we recognise are honoured from the URL. `jname` is deliberately NOT
// read from the query string any more — it was a raw display string rendered
// straight into the <h1>, so `?jname=<anything>` put attacker-chosen copy on
// the page. The name is now always derived from the id.
const scopeById = (id) => (id ? SCOPE_OPTIONS.find((o) => o.id === id) || null : null);

// These types cannot paginate server-side: the playlist and video endpoints
// return a full unpaginated list with no limit/offset. We page them in memory.
const CLIENT_PAGED = new Set(["playlist", "video"]);

const EMPTY_BUCKETS = { user: [], playlist: [], song: [], video: [] };

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------

// Durations are stored in MILLISECONDS everywhere in the backend
// (`Song.duration` and `Video.duration` are both `Integer // in milliseconds`).
// Normalisation to seconds happens once, at the edge, in the normalisers below —
// this function only ever sees seconds.
const fmtDuration = (secs) => {
  const s = Number(secs);
  if (!Number.isFinite(s) || s <= 0) return null;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const msToSecs = (ms) => {
  const v = Number(ms);
  return Number.isFinite(v) && v > 0 ? Math.round(v / 1000) : null;
};

const fmtCount = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `${v}`;
};

// ----------------------------------------------------------------------------
// normalisers — every source is flattened into one Result shape the cards read:
//   { id, name, subtitle, type, artworkUrl, score, extra }
// ----------------------------------------------------------------------------

// /v1/search already returns that shape. The only thing it gets wrong is the
// duration unit, which arrives as raw milliseconds inside `extra`.
const normalizeSearchResult = (r) => {
  if (!r || r.extra?.duration == null) return r;
  return { ...r, extra: { ...r.extra, duration: msToSecs(r.extra.duration) } };
};

// Videos are not in the search index, so they come from the media endpoints.
const normalizeVideo = (v) => ({
  id: v.videoId,
  name: v.title,
  subtitle: v.artist?.username || "Unknown artist",
  type: "video",
  artworkUrl: v.artworkUrl || null,
  score: v.playCount ?? v.score ?? 0,
  extra: {
    duration: msToSecs(v.duration),
    jurisdiction: v.jurisdiction?.name || null,
  },
});

// Playlists are not in the search index either — `search_all` has no playlist
// branch at all, which is why the Playlists rail was permanently empty. They
// have their own public discovery endpoints, so they are sourced the same way
// videos are.
const normalizePlaylist = (p) => ({
  id: p.playlistId,
  name: p.name,
  subtitle: p.creatorName || "Unis",
  type: "playlist",
  artworkUrl: p.coverImageUrl || p.firstFourArtworks?.[0] || null,
  score: p.followerCount ?? 0,
  extra: {
    songCount: p.songCount,
    playlistType: p.type,
  },
});

// ----------------------------------------------------------------------------
// fetchers — all go through apiCall so they inherit the axios baseURL, the auth
// header, the response cache and the 401 session teardown. The previous raw
// fetch() calls had none of that, and hardcoded a base URL that 404s in local
// dev (controllers live under /api; axiosInstance already knows this).
// ----------------------------------------------------------------------------

const fetchSearch = async ({ q, type, jurisdictionId, limit, offset }) => {
  const params = new URLSearchParams();
  params.set("q", q || "");
  params.set("type", type || "all");
  if (jurisdictionId) params.set("jurisdictionId", jurisdictionId);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const res = await apiCall({ method: "get", url: `/v1/search?${params.toString()}` });
  const items = (res.data?.results || []).map(normalizeSearchResult);
  console.log(`[Discover] search type=${type} q="${q}" scope=${jurisdictionId || "all"} → ${items.length} result(s)`);
  return items;
};

const fetchVideos = async ({ q, jurisdictionId }) => {
  const url = jurisdictionId
    ? `/v1/media/videos/jurisdiction/${jurisdictionId}?limit=100`
    : `/v1/media/videos/recent?limit=100`;

  const res = await apiCall({ method: "get", url });
  const items = (Array.isArray(res.data) ? res.data : []).map(normalizeVideo);
  console.log(`[Discover] videos scope=${jurisdictionId || "recent"} → ${items.length} result(s)`);

  // The video endpoints take no text query — filter in memory so the Videos
  // rail still responds to the search box.
  const needle = (q || "").trim().toLowerCase();
  if (!needle) return items;
  return items.filter(
    (v) => v.name?.toLowerCase().includes(needle) || v.subtitle?.toLowerCase().includes(needle)
  );
};

const fetchPlaylists = async ({ q, jurisdictionId }) => {
  const needle = (q || "").trim();
  const url = needle
    ? `/v1/playlists/search?q=${encodeURIComponent(needle)}`
    : `/v1/playlists/discover${jurisdictionId ? `?jurisdictionId=${jurisdictionId}` : ""}`;

  const res = await apiCall({ method: "get", url });
  let items = (Array.isArray(res.data) ? res.data : []).map(normalizePlaylist);
  console.log(`[Discover] playlists ${needle ? `q="${needle}"` : `scope=${jurisdictionId || "all"}`} → ${items.length} result(s)`);

  // /playlists/search is global — it has no jurisdiction parameter — so a
  // scoped query has to be narrowed here until the endpoint grows one.
  if (needle && jurisdictionId) {
    items = items.filter((p) => !p.extra?.jurisdictionId || p.extra.jurisdictionId === jurisdictionId);
  }
  return items;
};

// Single entry point so the rails and the grid don't care where a type lives.
const fetchByType = (opts) => {
  if (opts.type === "video") return fetchVideos(opts);
  if (opts.type === "playlist") return fetchPlaylists(opts);
  return fetchSearch(opts);
};

// ----------------------------------------------------------------------------
// inline icons
// ----------------------------------------------------------------------------
const Diamond = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 .8l3.3 3.4L6 11.2 2.7 4.2 6 .8z" /></svg>
);
const Crown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" /></svg>
);
const Headphones = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 13v-1a8 8 0 0116 0v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><rect x="3" y="13" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="17" y="13" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" /></svg>
);
const Play = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3 2v10l9-5-9-5z" /></svg>
);
const Plays = () => (
  <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1.5v7l6-3.5-6-3.5z" /></svg>
);
const Chevron = () => (
  <svg className="chev" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Arrow = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// ----------------------------------------------------------------------------
// cards
// ----------------------------------------------------------------------------
const UserCard = ({ item, onOpen }) => {
  const role = item.extra?.role === "listener" || item.type === "listener" ? "listener" : "artist";
  const tier = (item.extra?.level || "silver").toLowerCase();
  const art = buildUrl(item.artworkUrl);
  const initial = (item.name || "?").charAt(0).toUpperCase();
  const roleLabel = role === "artist" ? "Artist" : "Listener";
  return (
    <button
      className="dsc-user"
      data-role={role}
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`${item.name}, ${roleLabel}, ${tier} tier, ${fmtCount(item.score)} points`}
    >
      <span className="dsc-ava" data-tier={tier}>
        {role === "artist" ? <span className="dsc-crown"><Crown /></span> : <span className="dsc-hp"><Headphones /></span>}
        <span className="img">{art ? <img src={art} alt="" loading="lazy" decoding="async" /> : initial}</span>
      </span>
      <span className="dsc-role" aria-hidden="true">{roleLabel} · {tier}</span>
      <span className="dsc-uname">{item.name}</span>
      <span className="dsc-points" aria-hidden="true"><Diamond />{fmtCount(item.score)}</span>
    </button>
  );
};

const PlaylistCard = ({ item, onOpen }) => {
  const art = buildUrl(item.artworkUrl);
  const count = item.extra?.songCount;
  return (
    <button
      className="dsc-pl"
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`Playlist ${item.name}${count != null ? `, ${count} tracks` : ""}`}
    >
      <span className="cover">{art && <img src={art} alt="" loading="lazy" decoding="async" />}</span>
      <span className="fade" />
      <span className="meta">
        <span className="ptitle">{item.name}</span>
        {item.subtitle && (
          <span className="pcount">{item.subtitle}{count != null ? ` · ${count} tracks` : ""}</span>
        )}
      </span>
    </button>
  );
};

// The play control is a SIBLING of the card button, not a child of it.
// It used to be a <span role="button" tabIndex={0}> nested inside the card's
// <button>, which is invalid HTML — nested interactive content is an automatic
// axe failure and screen readers announce a button inside a button.
const SongCard = ({ item, onOpen, onPlay }) => {
  const art = buildUrl(item.artworkUrl);
  const dur = fmtDuration(item.extra?.duration);
  return (
    <div className="dsc-song">
      <div className="art">
        <button
          className="art-open"
          type="button"
          onClick={() => onOpen(item)}
          aria-label={`Open ${item.name} by ${item.subtitle || "unknown artist"}`}
        >
          <span className="cover">{art && <img src={art} alt="" loading="lazy" decoding="async" />}</span>
        </button>
        {dur && <span className="dur">{dur}</span>}
        <button
          className="play"
          type="button"
          onClick={() => onPlay(item)}
          aria-label={`Play ${item.name}`}
        >
          <Play />
        </button>
      </div>
      <button className="stitle" type="button" onClick={() => onOpen(item)}>{item.name}</button>
      <div className="row">
        <span className="sart">{item.subtitle}</span>
        {item.score > 0 && (
          <span className="dsc-plays"><Plays />{fmtCount(item.score)}</span>
        )}
      </div>
    </div>
  );
};

const VideoCard = ({ item, onOpen }) => {
  const art = buildUrl(item.artworkUrl);
  const dur = fmtDuration(item.extra?.duration);
  return (
    <button
      className="dsc-vid"
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`Play video ${item.name} by ${item.subtitle || "unknown artist"}`}
    >
      <span className="frame">
        <span className="cover">{art && <img src={art} alt="" loading="lazy" decoding="async" />}</span>
        <span className="scrim" />
        <span className="ply"><span><Play /></span></span>
        {dur && <span className="dur">{dur}</span>}
      </span>
      <span className="vtitle">{item.name}</span>
      <span className="vmeta">{item.subtitle}</span>
    </button>
  );
};

const renderCard = (item, idx, { onOpen, onPlay }) => {
  const key = `${item.type}-${item.id}-${idx}`;
  switch (item.type) {
    case "artist":
    case "listener":
      return <UserCard key={key} item={item} onOpen={onOpen} />;
    case "playlist":
      return <PlaylistCard key={key} item={item} onOpen={onOpen} />;
    case "song":
      return <SongCard key={key} item={item} onOpen={onOpen} onPlay={onPlay} />;
    case "video":
      return <VideoCard key={key} item={item} onOpen={onOpen} />;
    default:
      return null;
  }
};

// ----------------------------------------------------------------------------
// page
// ----------------------------------------------------------------------------
const DiscoverPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext);
  const { user, authLoaded } = useAuth();

  const urlType = searchParams.get("type");
  const [activeType, setActiveType] = useState(
    TYPES.some((t) => t.key === urlType) ? urlType : "all"
  );
  const [inputValue, setInputValue] = useState(searchParams.get("q") || "");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  // A jid we don't recognise is treated as absent, not as "Everywhere" — an
  // unknown id in the URL should fall through to the profile/default scope
  // rather than silently widening the page to global.
  const [scope, setScope] = useState(() => scopeById(searchParams.get("jid")));
  const [scopeResolved, setScopeResolved] = useState(() => Boolean(scopeById(searchParams.get("jid"))));

  const [buckets, setBuckets] = useState(EMPTY_BUCKETS);
  const [gridItems, setGridItems] = useState([]);
  const [gridHasMore, setGridHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef(null);
  const scopeBtnRef = useRef(null);
  const tabsRef = useRef(null);

  // Full client-side result set for the types whose endpoints can't paginate.
  const clientPageRef = useRef([]);
  // Monotonic request id — the previous `cancelled` closure only guarded the
  // main effect, so a slow "load more" could append page 2 of an abandoned
  // query onto a completely different result set.
  const reqIdRef = useRef(0);

  const scopeName = scope?.name || "Everywhere";

  // -- resolve the default scope from the signed-in user's jurisdiction --
  // Reads AuthContext, which already holds the full profile. The old code
  // hand-decoded the JWT with atob() (which throws on base64url payloads) and
  // fired a *second* /v1/users/profile call on every mount.
  useEffect(() => {
    if (scopeResolved || !authLoaded) return;
    const jid = user?.jurisdiction?.jurisdictionId;
    const known = scopeById(jid);
    if (known) {
      console.log(`[Discover] scope resolved from profile → ${known.name}`);
      setScope(known);
    } else if (jid) {
      // A live jurisdiction we don't have a launch entry for yet — honour the
      // id, fall back to the profile's own display name.
      console.log(`[Discover] scope resolved from profile → ${user.jurisdiction.name || jid} (not in SCOPE_OPTIONS)`);
      setScope({ id: jid, name: user.jurisdiction.name || "your area" });
    } else {
      console.log(`[Discover] no profile jurisdiction, defaulting scope → ${DEFAULT_SCOPE.name}`);
      setScope(DEFAULT_SCOPE);
    }
    setScopeResolved(true);
  }, [authLoaded, user, scopeResolved]);

  // -- debounce the input into the effective query --
  useEffect(() => {
    const t = setTimeout(() => setQuery(inputValue.trim()), 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  // -- reflect q/type/scope in the URL --
  useEffect(() => {
    const next = {};
    if (query) next.q = query;
    if (activeType && activeType !== "all") next.type = activeType;
    if (scope?.id) next.jid = scope.id;
    setSearchParams(next, { replace: true });
  }, [query, activeType, scope, setSearchParams]);

  const scopeId = scope?.id || null;

  // -- main fetch: rails for "all", a single grid otherwise --
  useEffect(() => {
    if (!scopeResolved) return;

    const reqId = ++reqIdRef.current;
    const isCurrent = () => reqIdRef.current === reqId;

    // Nothing to browse with no query and no scope (the backend guard returns
    // empty for that combination too).
    if (!query && !scopeId) {
      setBuckets(EMPTY_BUCKETS);
      setGridItems([]);
      setGridHasMore(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    if (activeType === "all") {
      Promise.all(
        RAIL_TYPES.map((type) =>
          fetchByType({ q: query, type, jurisdictionId: scopeId, limit: RAIL_LIMIT, offset: 0 })
            .then((items) => [type, items.slice(0, RAIL_LIMIT), null])
            .catch((err) => {
              console.error(`[Discover] rail "${type}" failed:`, err);
              return [type, [], err];
            })
        )
      ).then((triples) => {
        if (!isCurrent()) return;
        const next = { ...EMPTY_BUCKETS };
        triples.forEach(([type, items]) => { next[type] = items; });
        setBuckets(next);
        // Only surface an error if every rail failed — one dead rail shouldn't
        // blank the page.
        setError(triples.every(([, , e]) => e) ? "We couldn't load Discover just now." : null);
        setLoading(false);
      });
      return;
    }

    clientPageRef.current = [];
    fetchByType({ q: query, type: activeType, jurisdictionId: scopeId, limit: GRID_LIMIT, offset: 0 })
      .then((items) => {
        if (!isCurrent()) return;
        if (CLIENT_PAGED.has(activeType)) {
          clientPageRef.current = items;
          setGridItems(items.slice(0, GRID_LIMIT));
          setGridHasMore(items.length > GRID_LIMIT);
        } else {
          setGridItems(items);
          setGridHasMore(items.length === GRID_LIMIT);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isCurrent()) return;
        console.error(`[Discover] grid "${activeType}" failed:`, err);
        setGridItems([]);
        setGridHasMore(false);
        setError("We couldn't load these results.");
        setLoading(false);
      });
  }, [activeType, query, scopeId, scopeResolved]);

  const loadMore = useCallback(() => {
    const reqId = reqIdRef.current;
    const isCurrent = () => reqIdRef.current === reqId;

    // Playlist and video endpoints return a fixed unpaginated list, so those
    // grids page in memory rather than re-requesting page one.
    if (CLIENT_PAGED.has(activeType)) {
      setGridItems((prev) => {
        const next = clientPageRef.current.slice(0, prev.length + GRID_LIMIT);
        setGridHasMore(clientPageRef.current.length > next.length);
        return next;
      });
      return;
    }

    const nextOffset = gridItems.length;
    setLoadingMore(true);
    fetchSearch({ q: query, type: activeType, jurisdictionId: scopeId, limit: GRID_LIMIT, offset: nextOffset })
      .then((items) => {
        if (!isCurrent()) {
          console.log("[Discover] discarded a stale load-more response");
          return;
        }
        setGridItems((prev) => [...prev, ...items]);
        setGridHasMore(items.length === GRID_LIMIT);
      })
      .catch((err) => {
        console.error("[Discover] load more failed:", err);
        if (isCurrent()) setGridHasMore(false);
      })
      .finally(() => setLoadingMore(false));
  }, [activeType, query, scopeId, gridItems.length]);

  // -- scope dropdown --
  const closeScope = useCallback((returnFocus) => {
    setScopeOpen(false);
    if (returnFocus) scopeBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!scopeOpen) return;
    // pointerdown, not click: a bubbled click from the trigger itself could
    // close the menu in the same tick it opened.
    const onPointerDown = (e) => {
      if (scopeRef.current && !scopeRef.current.contains(e.target)) setScopeOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") closeScope(true); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [scopeOpen, closeScope]);

  const chooseScope = useCallback((opt) => {
    console.log(`[Discover] scope changed → ${opt?.name || "Everywhere"}`);
    setScope(opt && opt.id ? opt : null);
    closeScope(true);
  }, [closeScope]);

  // -- tabs: roving arrow-key navigation, as the tab role contract requires --
  const onTabKeyDown = useCallback((e) => {
    const idx = TYPES.findIndex((t) => t.key === activeType);
    let next = null;
    if (e.key === "ArrowRight") next = (idx + 1) % TYPES.length;
    if (e.key === "ArrowLeft") next = (idx - 1 + TYPES.length) % TYPES.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = TYPES.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActiveType(TYPES[next].key);
    tabsRef.current?.querySelectorAll("[role='tab']")[next]?.focus();
  }, [activeType]);

  // -- navigation + play --
  const openItem = useCallback((item) => {
    switch (item.type) {
      case "artist": navigate(`/artist/${item.id}`); break;
      case "listener": navigate(`/user/${item.id}`); break;
      case "song": navigate(`/song/${item.id}`); break;
      case "playlist": navigate(`/playlist/${item.id}`); break;
      case "video": navigate(`/video/${item.id}`); break;
      case "jurisdiction": navigate(`/jurisdiction/${item.id}`); break;
      default: console.warn(`[Discover] no route for type "${item.type}"`); break;
    }
  }, [navigate]);

  const playSong = useCallback(async (item) => {
    try {
      const res = await apiCall({ method: "get", url: `/v1/media/song/${item.id}`, useCache: false });
      const s = res.data || {};
      const full = buildUrl(s.fileUrl);
      const art = buildUrl(s.artworkUrl) || buildUrl(item.artworkUrl);
      // requestPlay ONLY — it raises PlayChoiceModal when a queue exists, and
      // Player.jsx owns play tracking behind the 15s/25% gate. Counting here
      // would credit points for plays the user cancelled or merely queued.
      requestPlay({
        type: "song",
        id: item.id,
        songId: item.id,
        url: full,
        fileUrl: full,
        title: s.title || item.name,
        artist: s.artist || item.subtitle,
        artistId: s.artistId || item.extra?.artistId,
        artwork: art,
        artworkUrl: art,
        source: "discover",
      });
      console.log(`[Discover] requestPlay dispatched for song ${item.id}`);
    } catch (err) {
      console.error(`[Discover] could not load song ${item.id} for playback:`, err);
      navigate(`/song/${item.id}`);
    }
  }, [requestPlay, navigate]);

  const cardHandlers = useMemo(
    () => ({ onOpen: openItem, onPlay: playSong }),
    [openItem, playSong]
  );

  const railClass = (type) => `dsc-rail${type === "user" ? " users" : ""}`;
  const gridClass = (type) => {
    if (type === "user") return "dsc-grid users";
    if (type === "playlist") return "dsc-grid playlists";
    if (type === "song") return "dsc-grid songs";
    if (type === "video") return "dsc-grid videos";
    return "dsc-grid";
  };

  const hasAllResults = RAIL_TYPES.some((t) => buckets[t].length > 0);
  const showEmpty = !loading && !error && (activeType === "all" ? !hasAllResults : gridItems.length === 0);

  return (
    <Layout>
      <div className="dsc-wrap">
        <p className="dsc-eyebrow">
          <span className="dot" aria-hidden="true" /> {query ? `Results · "${query}"` : "Exploring · Live now"}
        </p>
        <h1 className="dsc-h1">Discover <em>{query || scopeName}</em></h1>
        <p className="dsc-sub">
          {query
            ? `What matches "${query}" in ${scopeName}.`
            : "The people, playlists, songs and videos rising in your neighborhood right now."}
        </p>

        {/* controls */}
        <div className="dsc-controls">
          <div className="dsc-types" role="tablist" aria-label="Result type" ref={tabsRef}>
            {TYPES.map((t) => (
              <button
                key={t.key}
                id={`dsc-tab-${t.key}`}
                className="dsc-type"
                type="button"
                role="tab"
                aria-selected={activeType === t.key}
                aria-controls="dsc-results"
                tabIndex={activeType === t.key ? 0 : -1}
                onKeyDown={onTabKeyDown}
                onClick={() => setActiveType(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="dsc-row2">
            <div className={`dsc-scope${scopeOpen ? " open" : ""}`} ref={scopeRef}>
              <button
                className="dsc-scope-btn"
                type="button"
                ref={scopeBtnRef}
                aria-haspopup="listbox"
                aria-expanded={scopeOpen}
                onClick={() => setScopeOpen((o) => !o)}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2c-3.3 0-6 2.7-6 6 0 4.5 6 10 6 10s6-5.5 6-10c0-3.3-2.7-6-6-6z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" /></svg>
                <span>{scopeName}</span>
                <Chevron />
              </button>
              {scopeOpen && (
                <ul className="dsc-scope-menu" role="listbox" aria-label="Jurisdiction">
                  {SCOPE_OPTIONS.map((o) => {
                    const selected = o.id ? scope?.id === o.id : !scope;
                    return (
                      <li key={o.id || "everywhere"} role="none">
                        <button
                          className="dsc-scope-item"
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => chooseScope(o)}
                        >
                          <span>{o.name}</span>
                          {o.level && <span className="lvl">{o.level}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="dsc-search">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.3" /><line x1="11" y1="11" x2="14.4" y2="14.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              <input
                type="search"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search people, playlists, songs, videos…"
                autoComplete="off"
                spellCheck="false"
                aria-label="Search Discover"
              />
            </div>
          </div>
        </div>

        {/* results */}
        <div id="dsc-results" role="tabpanel" aria-labelledby={`dsc-tab-${activeType}`} aria-busy={loading}>
          {activeType === "all" ? (
            RAIL_TYPES.map((type) =>
              buckets[type].length > 0 ? (
                <section className="dsc-section" key={type} aria-labelledby={`dsc-sec-${type}`}>
                  <div className="dsc-sec-head">
                    <h2 className="dsc-sec-title" id={`dsc-sec-${type}`}>
                      {RAIL_TITLES[type]} in <em>{scopeName}</em>
                    </h2>
                    <button className="dsc-seeall" type="button" onClick={() => setActiveType(type)}>
                      See all<span className="sr-only"> {RAIL_TITLES[type]}</span> <Arrow />
                    </button>
                  </div>
                  <div className={railClass(type)}>
                    {buckets[type].map((item, i) => renderCard(item, i, cardHandlers))}
                  </div>
                </section>
              ) : null
            )
          ) : (
            gridItems.length > 0 && (
              <section className="dsc-section" aria-labelledby="dsc-sec-grid">
                <div className="dsc-sec-head">
                  <h2 className="dsc-sec-title" id="dsc-sec-grid">
                    {RAIL_TITLES[activeType]} in <em>{scopeName}</em>
                  </h2>
                </div>
                <div className={gridClass(activeType)}>
                  {gridItems.map((item, i) => renderCard(item, i, cardHandlers))}
                </div>
                {gridHasMore && (
                  <div className="dsc-loadmore">
                    <button className="dsc-loadmore-btn" type="button" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}
              </section>
            )
          )}

          <div className="dsc-status" role="status" aria-live="polite">
            {loading && (
              <div className="dsc-loading">
                <div className="dsc-loading__spinner" aria-hidden="true" />
                <span className="sr-only">Loading results…</span>
              </div>
            )}

            {error && !loading && (
              <div className="dsc-empty">
                <h3>Something went wrong</h3>
                <p>{error} Please try again in a moment.</p>
              </div>
            )}

            {showEmpty && (
              <div className="dsc-empty">
                <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true" style={{ color: "var(--unis-text-4)" }}>
                  <circle cx="21" cy="21" r="14" stroke="currentColor" strokeWidth="2.5" />
                  <line x1="31" y1="31" x2="43" y2="43" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <h3>{query ? `Nothing here yet for "${query}"` : "Pick a neighborhood to explore"}</h3>
                <p>
                  {query
                    ? `Try another name, or clear the search to browse everyone in ${scopeName}.`
                    : "Choose a jurisdiction above to see who's rising there."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DiscoverPage;