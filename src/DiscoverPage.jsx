import React, { useState, useEffect, useRef, useCallback, useContext } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { buildUrl } from "./utils/buildUrl";
import { apiCall } from "./components/axiosInstance"; // ★ song-detail + jurisdiction fetches (matches songPage/findpage)
import { PlayerContext } from "./context/playercontext"; // ★ requestPlay convention — Discover NEVER tracks plays
import Layout from "./layout";
import { JURISDICTION_IDS, JURISDICTION_NAMES } from "./utils/idMappings"; 

import "./DiscoverPage.scss"; // ★ ported next from the mockup; tokens + #root::before gradient are already global

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Type toggle. "user" = artists + listeners unified (backend search_all umbrella). ★
const TYPES = [
  { key: "all", label: "All" },
  { key: "user", label: "Users" },
  { key: "playlist", label: "Playlists" },
  { key: "song", label: "Songs" },
];
// Order of rails in the "All" view, and the per-type fetch set.
const RAIL_TYPES = ["user", "playlist", "song"];
const RAIL_LIMIT = 12;
const GRID_LIMIT = 30;

const RAIL_TITLES = {
  user: "Users",
  playlist: "Playlists",
  song: "Songs",
};

// ----------------------------------------------------------------------------
// helpers
// ----------------------------------------------------------------------------
const fmtDuration = (secs) => {
  const s = Number(secs);
  if (!s || s < 0) return null;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const fmtCount = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `${v}`;
};

// Build /v1/search URL for browse or query, with optional jurisdiction scope.
const buildSearchUrl = ({ q, type, jurisdictionId, limit, offset }) => {
  const params = new URLSearchParams();
  params.set("q", q || "");
  params.set("type", type || "all");
  if (jurisdictionId) params.set("jurisdictionId", jurisdictionId);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return `${API_BASE_URL}/v1/search?${params.toString()}`;
};

const fetchResults = async (opts) => {
  const res = await fetch(buildSearchUrl(opts)); // ★ raw fetch, mirrors SearchResultsPage
  if (!res.ok) throw new Error(`search ${res.status}`);
  const data = await res.json();
  return data.results || [];
};

// ----------------------------------------------------------------------------
// inline icons (kept local so the page is self-contained, like SearchResultsPage)
// ----------------------------------------------------------------------------
const Diamond = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M6 .8l3.3 3.4L6 11.2 2.7 4.2 6 .8z" /></svg>
);
const Crown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z" /></svg>
);
const Headphones = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 13v-1a8 8 0 0116 0v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><rect x="3" y="13" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="17" y="13" width="4" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8" /></svg>
);
const Play = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2v10l9-5-9-5z" /></svg>
);
const Plays = () => (
  <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1.5v7l6-3.5-6-3.5z" /></svg>
);
const Chevron = () => (
  <svg className="chev" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Arrow = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

// ----------------------------------------------------------------------------
// cards (1:1 with the mockup markup so the ported SCSS applies unchanged)
// ----------------------------------------------------------------------------
const UserCard = ({ item, onOpen }) => {
  const role = item.extra?.role === "listener" || item.type === "listener" ? "listener" : "artist";
  const tier = (item.extra?.level || "silver").toLowerCase();
  const art = buildUrl(item.artworkUrl);
  const initial = (item.name || "?").charAt(0).toUpperCase();
  return (
    <button className="dsc-user" data-role={role} onClick={() => onOpen(item)}>
      <div className="dsc-ava" data-tier={tier}>
        {role === "artist" ? <div className="dsc-crown"><Crown /></div> : <div className="dsc-hp"><Headphones /></div>}
        <div className="img">{art ? <img src={art} alt="" loading="lazy" /> : initial}</div>
      </div>
      <div className="dsc-role">{role === "artist" ? "Artist" : "Listener"} · {tier}</div>
      <div className="dsc-uname">{item.name}</div>
      <div className="dsc-points"><Diamond />{fmtCount(item.score)}</div>
    </button>
  );
};

const PlaylistCard = ({ item, onOpen }) => {
  const art = buildUrl(item.artworkUrl);
  const count = item.extra?.songCount;
  return (
    <button className="dsc-pl" onClick={() => onOpen(item)}>
      <div className="cover">{art && <img src={art} alt="" loading="lazy" />}</div>
      <div className="fade" />
      <div className="meta">
        <div className="ptitle">{item.name}</div>
        {item.subtitle && <div className="pcount">{item.subtitle}{count != null ? ` · ${count} tracks` : ""}</div>}
      </div>
    </button>
  );
};

const SongCard = ({ item, onOpen, onPlay }) => {
  const art = buildUrl(item.artworkUrl);
  const dur = fmtDuration(item.extra?.duration);
  return (
    <button className="dsc-song" onClick={() => onOpen(item)}>
      <div className="art">
        <div className="cover">{art && <img src={art} alt="" loading="lazy" />}</div>
        {dur && <span className="dur">{dur}</span>}
        <span
          className="play"
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onPlay(item); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onPlay(item); } }}
        >
          <Play />
        </span>
      </div>
      <div className="stitle">{item.name}</div>
      <div className="row">
        <span className="sart">{item.subtitle}</span>
        {item.score > 0 && <span className="dsc-plays"><Plays />{fmtCount(item.score)}</span>}
      </div>
    </button>
  );
};

const VideoCard = ({ item, onOpen }) => {
  const art = buildUrl(item.artworkUrl);
  const dur = fmtDuration(item.extra?.duration);
  return (
    <button className="dsc-vid" onClick={() => onOpen(item)}>
      <div className="frame">
        <div className="cover">{art && <img src={art} alt="" loading="lazy" />}</div>
        <div className="scrim" />
        <div className="ply"><span><Play /></span></div>
        {dur && <span className="dur">{dur}</span>}
      </div>
      <div className="vtitle">{item.name}</div>
      <div className="vmeta">{item.subtitle}</div>
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

  const [activeType, setActiveType] = useState(searchParams.get("type") || "all");
  const [inputValue, setInputValue] = useState(searchParams.get("q") || "");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [scope, setScope] = useState(() => {
    const jid = searchParams.get("jid");
    const jname = searchParams.get("jname");
    return jid ? { id: jid, name: jname || "this area" } : null;
  });

  const [buckets, setBuckets] = useState({ user: [], playlist: [], song: [], video: [] });
  const [gridItems, setGridItems] = useState([]);
  const [gridOffset, setGridOffset] = useState(0);
  const [gridHasMore, setGridHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef(null);

  const scopeName = scope?.name || "Everywhere";

  // -- resolve default scope from the signed-in user's jurisdiction (if no URL scope) --
useEffect(() => {
  if (scope) return;
  const token = localStorage.getItem("token");
  const fallbackToHarlem = () =>
    setScope({ id: JURISDICTION_IDS.harlem, name: JURISDICTION_NAMES[JURISDICTION_IDS.harlem] || "Harlem" });

  if (!token) {
    fallbackToHarlem();
    return;
  }
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    apiCall({ method: "get", url: `/v1/users/profile/${payload.userId}` })
      .then((res) => {
        const j = res.data?.jurisdiction;
        if (j?.jurisdictionId) {
          setScope({ id: j.jurisdictionId, name: j.name || "your area" });
        } else {
          fallbackToHarlem();
        }
      })
      .catch(fallbackToHarlem);
  } catch (e) {
    fallbackToHarlem();
  }
}, [scope]);


  // -- debounce the input into the effective query, and reflect q/type/scope in the URL --
  useEffect(() => {
    const t = setTimeout(() => setQuery(inputValue.trim()), 300);
    return () => clearTimeout(t);
  }, [inputValue]);

  useEffect(() => {
    const next = {};
    if (query) next.q = query;
    if (activeType && activeType !== "all") next.type = activeType;
    if (scope?.id) { next.jid = scope.id; next.jname = scope.name; }
    setSearchParams(next, { replace: true });
  }, [query, activeType, scope, setSearchParams]);

  // -- main fetch: rails for "all", a single grid otherwise --
  useEffect(() => {
    let cancelled = false;
    const jurisdictionId = scope?.id || null;

    // Nothing to browse with no query and no scope (backend guard returns empty too).
    if (!query && !jurisdictionId) {
      setBuckets({ user: [], playlist: [], song: [], video: [] });
      setGridItems([]);
      setGridHasMore(false);
      return;
    }

    setLoading(true);

    if (activeType === "all") {
      Promise.all(
        RAIL_TYPES.map((type) =>
          fetchResults({ q: query, type, jurisdictionId, limit: RAIL_LIMIT, offset: 0 })
            .then((items) => [type, items])
            .catch(() => [type, []])
        )
      ).then((pairs) => {
        if (cancelled) return;
        const next = { user: [], playlist: [], song: [], video: [] };
        pairs.forEach(([type, items]) => { next[type] = items; });
        setBuckets(next);
        setLoading(false);
      });
    } else {
      setGridOffset(0);
      fetchResults({ q: query, type: activeType, jurisdictionId, limit: GRID_LIMIT, offset: 0 })
        .then((items) => {
          if (cancelled) return;
          setGridItems(items);
          setGridHasMore(items.length === GRID_LIMIT);
          setLoading(false);
        })
        .catch(() => { if (!cancelled) { setGridItems([]); setGridHasMore(false); setLoading(false); } });
    }

    return () => { cancelled = true; };
  }, [activeType, query, scope]);

  const loadMore = useCallback(() => {
    const jurisdictionId = scope?.id || null;
    const nextOffset = gridItems.length;
    setLoadingMore(true);
    fetchResults({ q: query, type: activeType, jurisdictionId, limit: GRID_LIMIT, offset: nextOffset })
      .then((items) => {
        setGridItems((prev) => [...prev, ...items]);
        setGridOffset(nextOffset);
        setGridHasMore(items.length === GRID_LIMIT);
      })
      .catch(() => setGridHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [activeType, query, scope, gridItems.length]);

// Static — these are the only jurisdictions live today. Add to this list as new ones launch.
const SCOPE_OPTIONS = [
  { id: null, name: "Everywhere", level: "All" }, // true global, no filter
  { id: JURISDICTION_IDS.harlem, name: "Harlem", level: "All active" }, // parent — rolls up children today
  { id: JURISDICTION_IDS["uptown-harlem"], name: "Uptown Harlem", level: "Neighborhood" },
  { id: JURISDICTION_IDS["downtown-harlem"], name: "Downtown Harlem", level: "Neighborhood" },
];

  // scope dropdown is now static — no fetch, no scopeOptions state needed
  const openScope = useCallback(() => {
    setScopeOpen((o) => !o);
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (scopeRef.current && !scopeRef.current.contains(e.target)) setScopeOpen(false); };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const chooseScope = (opt) => {
    setScope(opt ? { id: opt.id, name: opt.name } : null);
    setScopeOptions([]);
    setScopeOpen(false);
  };

  // -- navigation + play --
  const openItem = useCallback((item) => {
    switch (item.type) {
      case "artist": navigate(`/artist/${item.id}`); break;
      case "listener": navigate(`/user/${item.id}`); break; // ★ listener route lands with the listener page build-out
      case "song": navigate(`/song/${item.id}`); break;
      case "playlist": navigate(`/playlist/${item.id}`); break;
      case "video": navigate(`/video/${item.id}`); break;
      case "jurisdiction": navigate(`/jurisdiction/${item.id}`); break;
      default: break;
    }
  }, [navigate]);

  const playSong = useCallback(async (item) => {
    try {
      const res = await apiCall({ method: "get", url: `/v1/media/song/${item.id}`, useCache: false });
      const s = res.data || {};
      const full = buildUrl(s.fileUrl);
      const art = buildUrl(s.artworkUrl) || buildUrl(item.artworkUrl);
      // ★ requestPlay ONLY — Player.jsx owns play-tracking (15s/25%); no /play call here
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
      });
    } catch (e) {
      navigate(`/song/${item.id}`); // graceful fallback to the song page
    }
  }, [requestPlay, navigate]);

  const cardHandlers = { onOpen: openItem, onPlay: playSong };
  const railClass = (type) => `dsc-rail${type === "user" ? " users" : ""}`;
  const gridClass = (type) => {
    if (type === "user") return "dsc-grid users";
    if (type === "playlist") return "dsc-grid playlists";
    if (type === "song") return "dsc-grid songs";
    if (type === "video") return "dsc-grid videos";
    return "dsc-grid";
  };

  const hasAllResults = RAIL_TYPES.some((t) => buckets[t].length > 0);
  const showEmpty = !loading && (activeType === "all" ? !hasAllResults : gridItems.length === 0);

  return (
    <Layout>
      <div className="dsc-wrap">
        <p className="dsc-eyebrow">
          <span className="dot" /> {query ? `Results · "${query}"` : "Exploring · Live now"}
        </p>
        <h1 className="dsc-h1">Discover <em>{query ? `"${query}"` : scopeName}</em></h1>
        <p className="dsc-sub">
          {query
            ? `What matches "${query}" in ${scopeName}.`
            : "The people, playlists, songs and videos rising in your neighborhood right now."}
        </p>

        {/* controls */}
        <div className="dsc-controls">
          <div className="dsc-types" role="tablist" aria-label="Result type">
            {TYPES.map((t) => (
              <button
                key={t.key}
                className="dsc-type"
                role="tab"
                aria-selected={activeType === t.key}
                onClick={() => setActiveType(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="dsc-row2">
            <div className={`dsc-scope${scopeOpen ? " open" : ""}`} ref={scopeRef}>
              <button className="dsc-scope-btn" aria-haspopup="listbox" aria-expanded={scopeOpen} onClick={openScope}>
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M10 2c-3.3 0-6 2.7-6 6 0 4.5 6 10 6 10s6-5.5 6-10c0-3.3-2.7-6-6-6z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" /></svg>
                <span>{scopeName}</span>
                <Chevron />
              </button>
          <div className="dsc-scope-menu" role="listbox">
            {SCOPE_OPTIONS.map((o) => (
              <button
                key={o.id || "everywhere"}
                className="dsc-scope-item"
                aria-current={scope?.id === o.id || (!scope && !o.id)}
                onClick={() => chooseScope(o.id ? o : null)}
              >
                <span>{o.name}</span>
                {o.level && <span className="lvl">{o.level}</span>}
              </button>
            ))}
          </div>
            </div>

            <div className="dsc-search">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.3" /><line x1="11" y1="11" x2="14.4" y2="14.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search people, playlists, songs…"
                autoComplete="off"
                spellCheck="false"
                aria-label="Search Discover"
              />
            </div>
          </div>
        </div>

        {/* results */}
        {activeType === "all" ? (
          RAIL_TYPES.map((type) =>
            buckets[type].length > 0 ? (
              <section className="dsc-section" key={type}>
                <div className="dsc-sec-head">
                  <h2 className="dsc-sec-title">{RAIL_TITLES[type]} in <em>{scopeName}</em></h2>
                  <button className="dsc-seeall" onClick={() => setActiveType(type)}>See all <Arrow /></button>
                </div>
                <div className={railClass(type)}>
                  {buckets[type].map((item, i) => renderCard(item, i, cardHandlers))}
                </div>
              </section>
            ) : null
          )
        ) : (
          gridItems.length > 0 && (
            <section className="dsc-section">
              <div className="dsc-sec-head">
                <h2 className="dsc-sec-title">{RAIL_TITLES[activeType]} in <em>{scopeName}</em></h2>
              </div>
              <div className={gridClass(activeType)}>
                {gridItems.map((item, i) => renderCard(item, i, cardHandlers))}
              </div>
              {gridHasMore && (
                <div className="dsc-loadmore">
                  <button className="dsc-loadmore-btn" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </section>
          )
        )}

        {loading && (
          <div className="dsc-loading"><div className="dsc-loading__spinner" /></div>
        )}

        {showEmpty && (
          <div className="dsc-empty">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none" style={{ color: "var(--unis-text-4)" }}>
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
    </Layout>
  );
};

export default DiscoverPage;