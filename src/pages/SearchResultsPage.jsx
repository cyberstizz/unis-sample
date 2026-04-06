import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { buildUrl } from "../utils/buildUrl";
import Layout from "../layout";
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

  // Fetch results
  useEffect(() => {
    if (!query) return;
    setLoading(true);
    setResults([]);

    const primaryUrl = `${API_BASE_URL}/v1/search?q=${encodeURIComponent(query)}&type=${activeTab}&limit=30&offset=0`;
    const fallbackUrl = `${API_BASE_URL}/v1/search/suggestions?q=${encodeURIComponent(query)}&limit=30`;

    fetch(primaryUrl)
      .then((r) => {
        console.log("[SearchResults] primary response status:", r.status);
        if (!r.ok) throw new Error(`Status ${r.status}`);
        return r.json();
      })
      .then((data) => {
        console.log("[SearchResults] primary data:", data);
        const items = data.results || [];
        if (items.length > 0) {
          setResults(filterByTab(items, activeTab));
          setLoading(false);
          return;
        }
        throw new Error("No results from primary");
      })
      .catch((err) => {
        console.warn("[SearchResults] primary failed, trying suggestions:", err.message);
        fetch(fallbackUrl)
          .then((r) => r.json())
          .then((data) => {
            console.log("[SearchResults] fallback data:", data);
            const flat = [];
            (data.artists || []).forEach((item) => flat.push(item));
            (data.songs || []).forEach((item) => flat.push(item));
            (data.jurisdictions || []).forEach((item) => flat.push(item));
            setResults(filterByTab(flat, activeTab));
          })
          .catch((fallbackErr) => {
            console.error("[SearchResults] fallback also failed:", fallbackErr);
            setResults([]);
          })
          .finally(() => setLoading(false));
      });
  }, [query, activeTab]);

  const filterByTab = (items, tab) => {
    if (tab === "all") return items;
    return items.filter((item) => item.type === tab);
  };

  const handleSelect = (item) => {
    switch (item.type) {
      case "artist": navigate(`/artist/${item.id}`); break;
      case "song": navigate(`/song/${item.id}`); break;
      case "jurisdiction": navigate(`/jurisdiction/${item.id}`); break;
      default: break;
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const badgeClass = (type) => {
    switch (type) {
      case "artist": return "srp-badge--artist";
      case "song": return "srp-badge--song";
      case "jurisdiction": return "srp-badge--jurisdiction";
      default: return "";
    }
  };

  const placeholderIcon = (type) => {
    switch (type) {
      case "artist":
        return (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 26c0-5.52 4.48-10 10-10s10 4.48 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case "song":
        return (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M11 22V6l12-3v16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="7.5" cy="22" r="3.5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="19.5" cy="19" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      case "jurisdiction":
        return (
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 3C9.58 3 6 6.58 6 11c0 6.3 8 14 8 14s8-7.7 8-14c0-4.42-3.58-8-8-8z" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="14" cy="11" r="3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      default: return null;
    }
  };

  const highlightMatch = (text, q) => {
    if (!text || !q || q.length < 2) return text || "";
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <span key={i} className="srp-highlight">{part}</span>
        : <span key={i}>{part}</span>
    );
  };

  // Empty query
  if (!query) {
    return (
      <Layout>
        <div className="srp-page">
          <div className="srp-empty">
            <div className="srp-empty__icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="21" cy="21" r="14" stroke="currentColor" strokeWidth="2.5" />
                <line x1="31" y1="31" x2="43" y2="43" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="srp-empty__text">Search for artists, songs, and jurisdictions</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="srp-page">
        {/* Back + Title */}
        <div className="srp-header">
          <button className="srp-back" onClick={handleBack}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9L11 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>

          <h1 className="srp-title">
            Results for <span className="srp-title__query">"{query}"</span>
          </h1>

          {/* Tabs */}
          <div className="srp-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`srp-tab ${activeTab === tab.key ? "srp-tab--active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="srp-results">
          {results.map((item, index) => {
            const artworkSrc = buildUrl(item.artworkUrl);

            return (
              <button
                key={`${item.type}-${item.id}-${index}`}
                className="srp-card"
                onClick={() => handleSelect(item)}
              >
                <div className={`srp-card__artwork ${item.type === "artist" ? "srp-card__artwork--round" : ""}`}>
                  {artworkSrc ? (
                    <img src={artworkSrc} alt="" loading="lazy" />
                  ) : (
                    <div className="srp-card__placeholder">
                      {placeholderIcon(item.type)}
                    </div>
                  )}
                </div>

                <div className="srp-card__info">
                  <span className="srp-card__name">{highlightMatch(item.name, query)}</span>
                  {item.subtitle && <span className="srp-card__subtitle">{item.subtitle}</span>}
                </div>

                <div className="srp-card__meta">
                  <span className={`srp-badge ${badgeClass(item.type)}`}>{item.type}</span>
                  {item.score > 0 && (
                    <span className="srp-card__score">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M5.5 0.5L6.9 3.8L10.5 4.2L7.7 6.6L8.5 10.2L5.5 8.4L2.5 10.2L3.3 6.6L0.5 4.2L4.1 3.8L5.5 0.5Z" fill="currentColor" />
                      </svg>
                      {item.score}
                    </span>
                  )}
                </div>

                <svg className="srp-card__arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="srp-loading">
            <div className="srp-loading__spinner" />
          </div>
        )}

        {/* No results */}
        {!loading && results.length === 0 && (
          <div className="srp-empty">
            <div className="srp-empty__icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="21" cy="21" r="14" stroke="currentColor" strokeWidth="2.5" />
                <line x1="31" y1="31" x2="43" y2="43" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="18" x2="27" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
                <line x1="15" y1="24" x2="23" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
              </svg>
            </div>
            <p className="srp-empty__text">No results for "{query}"</p>
            <p className="srp-empty__hint">Try a different search term or check your spelling</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SearchResultsPage;