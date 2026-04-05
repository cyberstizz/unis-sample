import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { buildUrl } from "../utils/buildUrl";
import "./SearchBar.scss";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const SearchBar = () => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [trending, setTrending] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 250);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("unis_recent_searches") || "[]");
      setRecentSearches(stored.slice(0, 5));
    } catch { setRecentSearches([]); }
  }, []);

  useEffect(() => {
    if (focused && trending.length === 0) {
      fetch(`${API_BASE_URL}/v1/search/trending?limit=5`)
        .then((r) => r.json())
        .then(setTrending)
        .catch(() => {});
    }
  }, [focused]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions(null);
      setActiveIndex(-1);
      return;
    }
    setLoading(true);
    fetch(`${API_BASE_URL}/v1/search/suggestions?q=${encodeURIComponent(debouncedQuery)}&limit=10`)
      .then((r) => r.json())
      .then((data) => { setSuggestions(data); setActiveIndex(-1); })
      .catch(() => setSuggestions(null))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  const getFlatResults = useCallback(() => {
    if (!suggestions) return [];
    const flat = [];
    if (suggestions.topResult) flat.push(suggestions.topResult);
    (suggestions.artists || []).forEach((a) => {
      if (!suggestions.topResult || a.id !== suggestions.topResult.id) flat.push(a);
    });
    (suggestions.songs || []).forEach((s) => {
      if (!suggestions.topResult || s.id !== suggestions.topResult.id) flat.push(s);
    });
    (suggestions.jurisdictions || []).forEach((j) => {
      if (!suggestions.topResult || j.id !== suggestions.topResult.id) flat.push(j);
    });
    return flat;
  }, [suggestions]);

  const saveRecentSearch = (item) => {
    try {
      const stored = JSON.parse(localStorage.getItem("unis_recent_searches") || "[]");
      const filtered = stored.filter((s) => s.id !== item.id);
      const updated = [
        { id: item.id, name: item.name, type: item.type, artworkUrl: item.artworkUrl },
        ...filtered,
      ].slice(0, 5);
      localStorage.setItem("unis_recent_searches", JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {}
  };

  const handleSelect = (item) => {
    saveRecentSearch(item);
    setQuery("");
    setSuggestions(null);
    setFocused(false);
    inputRef.current?.blur();
    switch (item.type) {
      case "artist": navigate(`/artist/${item.id}`); break;
      case "song": navigate(`/song/${item.id}`); break;
      case "jurisdiction": navigate(`/jurisdiction/${item.id}`); break;
      default: break;
    }
  };

  const handleFullSearch = () => {
    if (query.trim().length < 1) return;
    setFocused(false);
    inputRef.current?.blur();
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const handleKeyDown = (e) => {
    const flat = getFlatResults();
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActiveIndex((p) => Math.min(p + 1, flat.length - 1)); break;
      case "ArrowUp": e.preventDefault(); setActiveIndex((p) => Math.max(p - 1, -1)); break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < flat.length) handleSelect(flat[activeIndex]);
        else handleFullSearch();
        break;
      case "Escape": setFocused(false); inputRef.current?.blur(); break;
      default: break;
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const removeRecent = (e, id) => {
    e.stopPropagation();
    const updated = recentSearches.filter((s) => s.id !== id);
    localStorage.setItem("unis_recent_searches", JSON.stringify(updated));
    setRecentSearches(updated);
  };

  const clearAllRecent = () => {
    localStorage.removeItem("unis_recent_searches");
    setRecentSearches([]);
  };

  const showDropdown = focused;
  const showZeroState = showDropdown && query.length < 2;
  const showResults = showDropdown && query.length >= 2 && suggestions;
  const hasResults = suggestions && suggestions.totalCount > 0;

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case "artist": return "usb-badge--artist";
      case "song": return "usb-badge--song";
      case "jurisdiction": return "usb-badge--jurisdiction";
      default: return "";
    }
  };

  const getPlaceholderIcon = (type) => {
    switch (type) {
      case "artist":
        return (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" /><path d="M3 18c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>);
      case "song":
        return (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M8 16V4l9-2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="5.5" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" /><circle cx="14.5" cy="14" r="2.5" stroke="currentColor" strokeWidth="1.5" /></svg>);
      case "jurisdiction":
        return (<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2C6.69 2 4 4.69 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.31-2.69-6-6-6z" stroke="currentColor" strokeWidth="1.5" /><circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" /></svg>);
      default: return null;
    }
  };

  const highlightMatch = (text, q) => {
    if (!q || q.length < 2) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <span key={i} className="usb-highlight">{part}</span> : <span key={i}>{part}</span>
    );
  };

  const renderResultRow = (item, index, isTopResult = false) => {
    const artworkSrc = buildUrl(item.artworkUrl);
    const isActive = index === activeIndex;
    return (
      <button
        key={`${item.type}-${item.id}`}
        className={`usb-row ${isTopResult ? "usb-row--top" : ""} ${isActive ? "usb-row--active" : ""}`}
        onClick={() => handleSelect(item)}
        onMouseEnter={() => setActiveIndex(index)}
      >
        <div className={`usb-artwork ${isTopResult ? "usb-artwork--lg" : ""}`}>
          {artworkSrc ? <img src={artworkSrc} alt="" loading="lazy" /> : <div className="usb-artwork__placeholder">{getPlaceholderIcon(item.type)}</div>}
        </div>
        <div className="usb-row__info">
          <span className="usb-row__name">{highlightMatch(item.name, query)}</span>
          {item.subtitle && <span className="usb-row__subtitle">{item.subtitle}</span>}
        </div>
        <span className={`usb-badge ${getTypeBadgeClass(item.type)}`}>{item.type}</span>
      </button>
    );
  };

  return (
    <div className={`usb-container ${focused ? "usb-container--focused" : ""}`} ref={dropdownRef}>
      <div className="usb-input-wrap">
        <svg className="usb-magnifier" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="11.2" y1="11.2" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="usb-field"
          placeholder="Search artists, songs, jurisdictions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
        {query.length > 0 && (
          <button className="usb-clear" onClick={() => { setQuery(""); setSuggestions(null); inputRef.current?.focus(); }} aria-label="Clear search">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {loading && <div className="usb-spinner" />}
      </div>

      {showDropdown && (
        <div className="usb-dropdown">
          {showZeroState && (
            <>
              {recentSearches.length > 0 && (
                <div className="usb-section">
                  <div className="usb-section__head">
                    <span className="usb-section__title">Recent</span>
                    <button className="usb-section__action" onClick={clearAllRecent}>Clear</button>
                  </div>
                  {recentSearches.map((item) => (
                    <button key={`recent-${item.id}`} className="usb-row" onClick={() => handleSelect(item)}>
                      <div className="usb-artwork">
                        {buildUrl(item.artworkUrl) ? <img src={buildUrl(item.artworkUrl)} alt="" loading="lazy" /> : <div className="usb-artwork__placeholder">{getPlaceholderIcon(item.type)}</div>}
                      </div>
                      <div className="usb-row__info"><span className="usb-row__name">{item.name}</span></div>
                      <button className="usb-recent-x" onClick={(e) => removeRecent(e, item.id)} aria-label="Remove">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      </button>
                    </button>
                  ))}
                </div>
              )}
              {trending.length > 0 && (
                <div className="usb-section">
                  <div className="usb-section__head"><span className="usb-section__title">Trending</span></div>
                  {trending.map((item) => (
                    <button key={`trending-${item.id}`} className="usb-row" onClick={() => handleSelect({ ...item, type: item.type || "song" })}>
                      <div className="usb-artwork">
                        {buildUrl(item.artworkUrl) ? <img src={buildUrl(item.artworkUrl)} alt="" loading="lazy" /> : <div className="usb-artwork__placeholder">{getPlaceholderIcon("song")}</div>}
                      </div>
                      <div className="usb-row__info">
                        <span className="usb-row__name">{item.name}</span>
                        <span className="usb-row__subtitle">{item.subtitle}</span>
                      </div>
                      <span className="usb-trending-arrow"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2L9 5H7V10H5V5H3L6 2Z" fill="currentColor" /></svg></span>
                    </button>
                  ))}
                </div>
              )}
              {recentSearches.length === 0 && trending.length === 0 && (
                <div className="usb-empty">Start typing to search artists, songs, and jurisdictions</div>
              )}
            </>
          )}

          {showResults && hasResults && (
            <>
              {suggestions.topResult && (
                <div className="usb-section">
                  <div className="usb-section__head"><span className="usb-section__title">Top Result</span></div>
                  {renderResultRow(suggestions.topResult, 0, true)}
                </div>
              )}
              {suggestions.artists?.length > 0 && (
                <div className="usb-section">
                  <div className="usb-section__head"><span className="usb-section__title">Artists</span></div>
                  {suggestions.artists.filter((a) => !suggestions.topResult || a.id !== suggestions.topResult.id).map((item, i) => renderResultRow(item, 1 + i))}
                </div>
              )}
              {suggestions.songs?.length > 0 && (
                <div className="usb-section">
                  <div className="usb-section__head"><span className="usb-section__title">Songs</span></div>
                  {suggestions.songs.filter((s) => !suggestions.topResult || s.id !== suggestions.topResult.id).map((item, i) => {
                    const offset = 1 + (suggestions.artists?.filter((a) => !suggestions.topResult || a.id !== suggestions.topResult.id).length || 0);
                    return renderResultRow(item, offset + i);
                  })}
                </div>
              )}
              {suggestions.jurisdictions?.length > 0 && (
                <div className="usb-section">
                  <div className="usb-section__head"><span className="usb-section__title">Jurisdictions</span></div>
                  {suggestions.jurisdictions.filter((j) => !suggestions.topResult || j.id !== suggestions.topResult.id).map((item, i) => {
                    const offset = 1 +
                      (suggestions.artists?.filter((a) => !suggestions.topResult || a.id !== suggestions.topResult.id).length || 0) +
                      (suggestions.songs?.filter((s) => !suggestions.topResult || s.id !== suggestions.topResult.id).length || 0);
                    return renderResultRow(item, offset + i);
                  })}
                </div>
              )}
              <button className="usb-see-all" onClick={handleFullSearch}>
                See all results for &ldquo;{query}&rdquo;
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </>
          )}

          {showResults && !hasResults && !loading && (
            <div className="usb-empty">No results for &ldquo;{query}&rdquo;</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;