import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { buildUrl } from "./utils/buildUrl";
import "./SearchResultsPage.scss";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const TABS = [
  { key: "all", label: "All" },
  { key: "artist", label: "Artists" },
  { key: "song", label: "Songs" },
  { key: "jurisdiction", label: "Jurisdictions" },
];

const SearchResultsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get("q") || "";
  const [activeTab, setActiveTab] = useState("all");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Fetch results
  useEffect(() => {
    if (!query) return;

    setLoading(true);
    setOffset(0);

    const url = `${API_BASE_URL}/api/v1/search?q=${encodeURIComponent(query)}&type=${activeTab}&limit=${limit}&offset=0`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setResults(data.results || []);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [query, activeTab]);

  // Load more
  const loadMore = () => {
    const newOffset = offset + limit;
    setLoading(true);

    const url = `${API_BASE_URL}/api/v1/search?q=${encodeURIComponent(query)}&type=${activeTab}&limit=${limit}&offset=${newOffset}`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setResults((prev) => [...prev, ...(data.results || [])]);
        setOffset(newOffset);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Navigate to result
  const handleSelect = (item) => {
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

  // Placeholder icon
  const getPlaceholderIcon = (type) => {
    switch (type) {
      case "artist":
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 21c0-4.42 3.58-8 8-8s8 3.58 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case "song":
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 18V5l10-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case "jurisdiction":
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (!query) {
    return (
      <div className="search-results-page">
        <div className="search-results-empty">Enter a search term to find artists, songs, and jurisdictions.</div>
      </div>
    );
  }

  return (
    <div className="search-results-page">
      {/* Header */}
      <div className="search-results-header">
        <h1 className="search-results-title">
          Results for <span className="search-query-text">"{query}"</span>
        </h1>

        {/* Tabs */}
        <div className="search-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`search-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="search-results-grid">
        {results.map((item) => {
          const artworkSrc = buildUrl(item.artworkUrl);

          return (
            <button
              key={`${item.type}-${item.id}`}
              className="search-result-card"
              onClick={() => handleSelect(item)}
            >
              <div className="card-artwork">
                {artworkSrc ? (
                  <img src={artworkSrc} alt="" loading="lazy" />
                ) : (
                  <div className="card-artwork-placeholder">{getPlaceholderIcon(item.type)}</div>
                )}
              </div>
              <div className="card-info">
                <span className="card-name">{item.name}</span>
                <span className="card-subtitle">{item.subtitle}</span>
                <div className="card-meta">
                  <span className={`card-type-badge badge-${item.type}`}>{item.type}</span>
                  {item.score > 0 && (
                    <span className="card-score">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M5 0.5L6.2 3.4L9.3 3.7L7 5.7L7.7 8.8L5 7.2L2.3 8.8L3 5.7L0.7 3.7L3.8 3.4L5 0.5Z" fill="currentColor" />
                      </svg>
                      {item.score}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Loading / Load more */}
      {loading && (
        <div className="search-results-loading">
          <div className="loading-spinner" />
        </div>
      )}

      {!loading && results.length >= limit && (
        <button className="search-load-more" onClick={loadMore}>
          Load more results
        </button>
      )}

      {!loading && results.length === 0 && (
        <div className="search-results-empty">
          No results found for "{query}". Try a different search term.
        </div>
      )}
    </div>
  );
};

export default SearchResultsPage;