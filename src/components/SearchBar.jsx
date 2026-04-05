import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { buildUrl } from "../../utils/buildUrl";
import "./SearchBar.scss";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Debounce helper
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const SearchBar = ({ onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // State
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [trending, setTrending] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 250);

  // ── Load recent searches from localStorage ────────────────────────
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("unis_recent_searches") || "[]");
      setRecentSearches(stored.slice(0, 5));
    } catch {
      setRecentSearches([]);
    }
  }, []);

  // ── Load trending on focus ────────────────────────────────────────
  useEffect(() => {
    if (focused && trending.length === 0) {
      fetch(`${API_BASE_URL}/api/v1/search/trending?limit=5`)
        .then((r) => r.json())
        .then(setTrending)
        .catch(() => {});
    }
  }, [focused]);

  // ── Fetch suggestions on debounced query change ───────────────────
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions(null);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    fetch(`${API_BASE_URL}/api/v1/search/suggestions?q=${encodeURIComponent(debouncedQuery)}&limit=10`)
      .then((r) => r.json())
      .then((data) => {
        setSuggestions(data);
        setActiveIndex(-1);
      })
      .catch(() => setSuggestions(null))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // ── Build flat list for keyboard navigation ───────────────────────
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

  // ── Save to recent searches ───────────────────────────────────────
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

  // ── Navigate to result ────────────────────────────────────────────
  const handleSelect = (item) => {
    saveRecentSearch(item);
    setQuery("");
    setSuggestions(null);
    setFocused(false);
    inputRef.current?.blur();

    switch (item.type) {
      case "artist":
        navigate(`/artist/${item.id}`);
        break;
      case "song":
        navigate(`/song/${item.id}`);
        break;
      case "jurisdiction":
        navigate(`/jurisdiction/${item.id}`);
        break;
      default:
        break;
    }
  };

  // ── Full search (Enter key) ───────────────────────────────────────
  const handleFullSearch = () => {
    if (query.trim().length < 1) return;
    setFocused(false);
    inputRef.current?.blur();
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  // ── Keyboard navigation ───────────────────────────────────────────
  const handleKeyDown = (e) => {
    const flat = getFlatResults();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, flat.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < flat.length) {
          handleSelect(flat[activeIndex]);
        } else {
          handleFullSearch();
        }
        break;
      case "Escape":
        setFocused(false);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  // ── Click outside to close ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Remove a recent search ────────────────────────────────────────
  const removeRecent = (e, id) => {
    e.stopPropagation();
    const updated = recentSearches.filter((s) => s.id !== id);
    localStorage.setItem("unis_recent_searches", JSON.stringify(updated));
    setRecentSearches(updated);
  };

  // ── Clear all recent searches ─────────────────────────────────────
  const clearAllRecent = () => {
    localStorage.removeItem("unis_recent_searches");
    setRecentSearches([]);
  };

  // ── Determine what to show in dropdown ────────────────────────────
  const showDropdown = focused;
  const showZeroState = showDropdown && query.length < 2;
  const showResults = showDropdown && query.length >= 2 && suggestions;
  const hasResults = suggestions && suggestions.totalCount > 0;

  // ── Type badge color ──────────────────────────────────────────────
  const getTypeBadgeClass = (type) => {
    switch (type) {
      case "artist": return "badge-artist";
      case "song": return "badge-song";
      case "jurisdiction": return "badge-jurisdiction";
      default: return "";
    }
  };

  // ── Default artwork placeholder ───────────────────────────────────
  const getPlaceholderIcon = (type) => {
    switch (type) {
      case "artist":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 18c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case "song":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 16V4l9-2v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="5.5" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="14.5" cy="14" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case "jurisdiction":
        return (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C6.69 2 4 4.69 4 8c0 4.5 6 10 6 10s6-5.5 6-10c0-3.31-2.69-6-6-6z" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      default:
        return null;
    }
  };

  // ── Highlight matching text ───────────────────────────────────────
  const highlightMatch = (text, q) => {
    if (!q || q.length < 2) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="search-highlight">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // ── Render a single result row ────────────────────────────────────
  const renderResultRow = (item, index, isTopResult = false) => {
    const artworkSrc = buildUrl(item.artworkUrl);
    const isActive = index === activeIndex;

    return (
      <button
        key={`${item.type}-${item.id}`}
        className={`search-result-row ${isTopResult ? "top-result" : ""} ${isActive ? "active" : ""}`}
        onClick={() => handleSelect(item)}
        onMouseEnter={() => setActiveIndex(index)}
      >
        <div className={`result-artwork ${isTopResult ? "artwork-lg" : "artwork-sm"}`}>
          {artworkSrc ? (
            <img src={artworkSrc} alt="" loading="lazy" />
          ) : (
            <div className="artwork-placeholder">{getPlaceholderIcon(item.type)}</div>
          )}
        </div>
        <div className="result-info">
          <span className="result-name">{highlightMatch(item.name, query)}</span>
          {item.subtitle && <span className="result-subtitle">{item.subtitle}</span>}
        </div>
        <span className={`result-type-badge ${getTypeBadgeClass(item.type)}`}>
          {item.type}
        </span>
      </button>
    );
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className={`unis-search ${focused ? "is-focused" : ""}`} ref={dropdownRef}>
      {/* Search input */}
      <div className="search-input-wrapper">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
          <line x1="11.2" y1="11.2" x2="14.5" y2="14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search artists, songs, jurisdictions..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
        />
        {query.length > 0 && (
          <button
            className="search-clear"
            onClick={() => { setQuery(""); setSuggestions(null); inputRef.current?.focus(); }}
            aria-label="Clear search"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
        {loading && <div className="search-spinner" />}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="search-dropdown">
          {/* ── Zero State ──────────────────────────────────────── */}
          {showZeroState && (
            <>
              {/* Recent searches */}
              {recentSearches.length > 0 && (
                <div className="dropdown-section">
                  <div className="section-header">
                    <span className="section-title">Recent</span>
                    <button className="section-action" onClick={clearAllRecent}>Clear</button>
                  </div>
                  {recentSearches.map((item) => (
                    <button
                      key={`recent-${item.id}`}
                      className="search-result-row recent-row"
                      onClick={() => handleSelect(item)}
                    >
                      <div className="result-artwork artwork-sm">
                        {buildUrl(item.artworkUrl) ? (
                          <img src={buildUrl(item.artworkUrl)} alt="" loading="lazy" />
                        ) : (
                          <div className="artwork-placeholder">{getPlaceholderIcon(item.type)}</div>
                        )}
                      </div>
                      <div className="result-info">
                        <span className="result-name">{item.name}</span>
                      </div>
                      <button
                        className="recent-remove"
                        onClick={(e) => removeRecent(e, item.id)}
                        aria-label="Remove"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      </button>
                    </button>
                  ))}
                </div>
              )}

              {/* Trending */}
              {trending.length > 0 && (
                <div className="dropdown-section">
                  <div className="section-header">
                    <span className="section-title">Trending</span>
                  </div>
                  {trending.map((item) => (
                    <button
                      key={`trending-${item.id}`}
                      className="search-result-row trending-row"
                      onClick={() => handleSelect({ ...item, type: item.type || "song" })}
                    >
                      <div className="result-artwork artwork-sm">
                        {buildUrl(item.artworkUrl) ? (
                          <img src={buildUrl(item.artworkUrl)} alt="" loading="lazy" />
                        ) : (
                          <div className="artwork-placeholder">{getPlaceholderIcon("song")}</div>
                        )}
                      </div>
                      <div className="result-info">
                        <span className="result-name">{item.name}</span>
                        <span className="result-subtitle">{item.subtitle}</span>
                      </div>
                      <span className="trending-indicator">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M6 2L9 5H7V10H5V5H3L6 2Z" fill="currentColor" />
                        </svg>
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {recentSearches.length === 0 && trending.length === 0 && (
                <div className="dropdown-empty">
                  Start typing to search artists, songs, and jurisdictions
                </div>
              )}
            </>
          )}

          {/* ── Search Results ──────────────────────────────────── */}
          {showResults && hasResults && (
            <>
              {/* Top result */}
              {suggestions.topResult && (
                <div className="dropdown-section">
                  <div className="section-header">
                    <span className="section-title">Top Result</span>
                  </div>
                  {renderResultRow(suggestions.topResult, 0, true)}
                </div>
              )}

              {/* Artists */}
              {suggestions.artists?.length > 0 && (
                <div className="dropdown-section">
                  <div className="section-header">
                    <span className="section-title">Artists</span>
                  </div>
                  {suggestions.artists
                    .filter((a) => !suggestions.topResult || a.id !== suggestions.topResult.id)
                    .map((item, i) => {
                      const flatIndex = 1 + i;
                      return renderResultRow(item, flatIndex);
                    })}
                </div>
              )}

              {/* Songs */}
              {suggestions.songs?.length > 0 && (
                <div className="dropdown-section">
                  <div className="section-header">
                    <span className="section-title">Songs</span>
                  </div>
                  {suggestions.songs
                    .filter((s) => !suggestions.topResult || s.id !== suggestions.topResult.id)
                    .map((item, i) => {
                      const offset = 1 + (suggestions.artists?.filter(
                        (a) => !suggestions.topResult || a.id !== suggestions.topResult.id
                      ).length || 0);
                      return renderResultRow(item, offset + i);
                    })}
                </div>
              )}

              {/* Jurisdictions */}
              {suggestions.jurisdictions?.length > 0 && (
                <div className="dropdown-section">
                  <div className="section-header">
                    <span className="section-title">Jurisdictions</span>
                  </div>
                  {suggestions.jurisdictions
                    .filter((j) => !suggestions.topResult || j.id !== suggestions.topResult.id)
                    .map((item, i) => {
                      const offset = 1 +
                        (suggestions.artists?.filter((a) => !suggestions.topResult || a.id !== suggestions.topResult.id).length || 0) +
                        (suggestions.songs?.filter((s) => !suggestions.topResult || s.id !== suggestions.topResult.id).length || 0);
                      return renderResultRow(item, offset + i);
                    })}
                </div>
              )}

              {/* See all results */}
              <button className="search-see-all" onClick={handleFullSearch}>
                See all results for "{query}"
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}

          {/* ── No Results ──────────────────────────────────────── */}
          {showResults && !hasResults && !loading && (
            <div className="dropdown-empty">
              No results for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;