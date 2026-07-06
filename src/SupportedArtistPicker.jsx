import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Check, Clock, Sparkles, MapPin, ChevronLeft, Search } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import './SupportedArtistPicker.scss';
import useModalA11y from './hooks/useModalA11y';

// ★ item 12: same debounce the main SearchBar uses (250ms)
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// =============================================================================
// SupportedArtistPicker  (jurisdiction-first)
//
// Instead of loading every artist into one list, the user first picks an AREA
// from their own jurisdiction chain (home → … → Unis, via the breadcrumb
// endpoint), then sees only the top 4 artists in that area (the cached
// /trending?type=artist endpoint). This scales: a handful of areas, a handful
// of artists each — never the full roster.
//
// ★ item 12: after an area is picked, a search bar (same debounced
// /v1/search/suggestions mechanism as the main SearchBar) lets the user find
// ANY specific artist by name — top-4 keeps the list small, search keeps it
// complete, and no full roster is ever loaded.
//
// Submit semantics are unchanged: first-ever pick is immediate; changing an
// existing pick queues to month-end (backend returns status immediate|pending).
//
// Props:
//   show, onClose, userId, currentArtistId, onSuccess  (as before)
//   userJurisdictionId: UUID  — the user's home jurisdiction (drives the area
//                               list). If absent, falls back to top-level roots.
//   userJurisdictionName: str — ensures the home area shows first even if the
//                               breadcrumb returns ancestors only.
// =============================================================================
const SupportedArtistPicker = ({
  show,
  onClose,
  userId,
  currentArtistId,
  userJurisdictionId,
  userJurisdictionName,
  onSuccess,
}) => {
  const [jurisdictions, setJurisdictions] = useState([]);
  const [jLoading, setJLoading] = useState(true);
  const [selectedJur, setSelectedJur] = useState(null); // { id, name }
  const [artists, setArtists] = useState([]);
  const [aLoading, setALoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // ★ item 12: artist search within the picker
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 250);
  const searching = debouncedQuery.trim().length >= 2;

  const isFirstPick = !currentArtistId;
  const modalRef = useRef(null);
  useModalA11y({ active: show, onClose, modalRef });

  // Load the user's area chain when the modal opens.
  useEffect(() => {
    if (!show) return;
    let cancelled = false;

    setSelectedJur(null);
    setArtists([]);
    setSelectedId(null);
    setResult(null);
    setError(null);
    setQuery(''); // ★ item 12
    setSearchResults([]); // ★
    setJLoading(true);

    const url = userJurisdictionId
      ? `/v1/jurisdictions/${userJurisdictionId}/breadcrumb`
      : '/v1/jurisdictions/roots';

    apiCall({ url })
      .then((res) => {
        if (cancelled) return;
        const chain = (res.data || [])
          .map((j) => ({ id: j.jurisdictionId || j.id, name: j.name }))
          .filter((j) => j.id && j.name);
        // breadcrumb returns root→leaf; show the most local area first.
        // (If your chain ever looks inverted, remove this reverse.)
        if (userJurisdictionId) {
          chain.reverse();
          if (userJurisdictionName && !chain.some((j) => j.id === userJurisdictionId)) {
            chain.unshift({ id: userJurisdictionId, name: userJurisdictionName });
          }
        }
        setJurisdictions(chain);
      })
      .catch(() => !cancelled && setError('Could not load your areas. Please try again.'))
      .finally(() => !cancelled && setJLoading(false));

    return () => { cancelled = true; };
  }, [show, userJurisdictionId]);

  const selectJurisdiction = async (jur) => {
    setSelectedJur(jur);
    setSelectedId(null);
    setArtists([]);
    setError(null);
    setQuery(''); // ★ item 12: fresh area, fresh search
    setSearchResults([]); // ★
    setALoading(true);
    try {
      const res = await apiCall({ url: `/v1/jurisdictions/${jur.id}/trending?type=artist&limit=4` });
      // trending rows are [userId, username, score, photoUrl]
      const list = (res.data || [])
        .map((row) => ({ userId: row[0], username: row[1], score: row[2], photoUrl: row[3] }))
        .filter((a) => a.userId && a.userId !== userId);
      setArtists(list);
    } catch (_) {
      setError('Could not load top artists for this area.');
    } finally {
      setALoading(false);
    }
  };

  // ★ item 12: debounced artist search — the exact mechanism the main SearchBar
  // uses (/v1/search/suggestions), filtered to artists and excluding the user.
  useEffect(() => {
    if (!selectedJur || !searching) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }
    let cancelled = false;
    setSearchLoading(true);
    apiCall({
      url: `/v1/search/suggestions?q=${encodeURIComponent(debouncedQuery.trim())}&limit=10`,
    })
      .then((res) => {
        if (cancelled) return;
        const data = res.data || {};
        const pool = [
          ...(data.topResult ? [data.topResult] : []),
          ...(data.artists || []),
        ];
        const seen = new Set();
        const list = pool
          .filter((item) => item && item.type === 'artist')
          .map((item) => ({
            userId: item.id,
            username: item.name,
            score: item.score ?? null,
            photoUrl: item.artworkUrl || item.photoUrl || null,
          }))
          .filter((a) => {
            if (!a.userId || a.userId === userId || seen.has(a.userId)) return false;
            seen.add(a.userId);
            return true;
          });
        setSearchResults(list);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Artist search failed:', err); // ★ checklist: failure logging
        setSearchResults([]);
      })
      .finally(() => !cancelled && setSearchLoading(false));

    return () => { cancelled = true; };
  }, [debouncedQuery, searching, selectedJur, userId]);

  const selectedArtist = useMemo(
    () =>
      artists.find((a) => a.userId === selectedId)
      || searchResults.find((a) => a.userId === selectedId) // ★ item 12
      || null,
    [artists, searchResults, selectedId],
  );

  const handleSubmit = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiCall({
        method: 'put',
        url: `/v1/users/${userId}/supported-artist`,
        data: { artistId: selectedId },
      });
      setResult(res.data || { status: isFirstPick ? 'immediate' : 'pending' });
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update your supported artist. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  const formatEffective = (iso) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  };

  const renderSuccess = () => {
    const status = result?.status;
    const immediate = status === 'immediate';
    const effective = formatEffective(result?.effectiveDate);
    return (
      <div className="sap-success" role="status">
        <div className="sap-success__icon">
          {immediate ? <Sparkles size={28} /> : <Clock size={28} />}
        </div>
        <h3 className="sap-success__title">
          {immediate ? "You're now supporting them!" : 'Change queued'}
        </h3>
        <p className="sap-success__body">
          {immediate
            ? `${selectedArtist?.username || 'Your artist'} now receives a share of your ad revenue.`
            : `You'll start supporting ${selectedArtist?.username || 'them'}${effective ? ` on ${effective}` : ' next month'}. Your current artist keeps earning until then.`}
        </p>
        <button type="button" className="sap-btn sap-btn--primary" onClick={onClose}>
          Done
        </button>
      </div>
    );
  };

  return (
    <div className="sap-overlay" onClick={onClose}>
      <div
        className="sap-modal"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sap-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="sap-close" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>

        <div className="sap-header">
          <h2 id="sap-title" className="sap-header__title">
            {isFirstPick ? 'Choose your artist' : 'Change who you support'}
          </h2>
          <p className="sap-header__sub">
            {selectedJur
              ? `Top artists in ${selectedJur.name}`
              : isFirstPick
                ? 'Pick an area, then back one of its top artists.'
                : 'Pick an area, then choose a new artist. Changes take effect next month.'}
          </p>
        </div>

        {result ? (
          renderSuccess()
        ) : (
          <>
            {!selectedJur ? (
              <div className="sap-jur-list" role="listbox" aria-label="Areas">
                {jLoading ? (
                  <div className="sap-state"><div className="sap-spinner" aria-hidden="true" /><p>Loading your areas…</p></div>
                ) : error ? (
                  <div className="sap-state sap-state--error" role="alert"><p>{error}</p></div>
                ) : jurisdictions.length === 0 ? (
                  <div className="sap-state"><p>No areas found.</p></div>
                ) : (
                  jurisdictions.map((j) => (
                    <button key={j.id} type="button" className="sap-jur" onClick={() => selectJurisdiction(j)}>
                      <MapPin size={16} aria-hidden="true" />
                      <span className="sap-jur__name">{j.name}</span>
                      <span className="sap-jur__go">Top artists →</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="sap-back"
                  onClick={() => { setSelectedJur(null); setArtists([]); setSelectedId(null); setError(null); setQuery(''); setSearchResults([]); }}
                >
                  <ChevronLeft size={16} aria-hidden="true" /> All areas
                </button>

                {/* ★ item 12: find any artist by name — same debounced
                    suggestions mechanism as the main search bar */}
                <div className="sap-search">
                  <Search size={14} aria-hidden="true" />
                  <input
                    type="text"
                    className="sap-search__input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search for a specific artist…"
                    aria-label="Search for a specific artist"
                  />
                  {query && (
                    <button
                      type="button"
                      className="sap-search__clear"
                      onClick={() => setQuery('')}
                      aria-label="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="sap-list" role="listbox" aria-label="Artists">
                  {(searching ? searchLoading : aLoading) ? ( // ★ item 12
                    <div className="sap-state"><div className="sap-spinner" aria-hidden="true" /><p>{searching ? 'Searching…' : 'Loading top artists…'}</p></div>
                  ) : error && !searching ? (
                    <div className="sap-state sap-state--error" role="alert"><p>{error}</p></div>
                  ) : (searching ? searchResults : artists).length === 0 ? (
                    <div className="sap-state">
                      <p>{searching ? `No artists match “${debouncedQuery.trim()}”.` : 'No artists here yet. Try a broader area.'}</p>
                    </div>
                  ) : (
                    (searching ? searchResults : artists).map((artist) => { // ★ item 12
                      const isCurrent = artist.userId === currentArtistId;
                      const isSelected = artist.userId === selectedId;
                      const photo = buildUrl(artist.photoUrl);
                      const initial = (artist.username || '?').charAt(0).toUpperCase();
                      return (
                        <button
                          key={artist.userId}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`sap-row ${isSelected ? 'is-selected' : ''} ${isCurrent ? 'is-current' : ''}`}
                          onClick={() => setSelectedId(artist.userId)}
                        >
                          {photo ? (
                            <img src={photo} alt="" className="sap-row__avatar" />
                          ) : (
                            <div className="sap-row__avatar sap-row__avatar--ph" aria-hidden="true">{initial}</div>
                          )}
                          <div className="sap-row__info">
                            <span className="sap-row__name">{artist.username}</span>
                            <span className="sap-row__meta">
                              {artist.score != null ? `${artist.score} pts` : 'Artist'} {/* ★ item 12: no fake 0 pts on search rows */}
                              {isCurrent && <span className="sap-row__current-tag">Current</span>}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="sap-row__check" aria-hidden="true"><Check size={16} /></span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}

            <div className="sap-footer">
              <button type="button" className="sap-btn sap-btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="sap-btn sap-btn--primary"
                onClick={handleSubmit}
                disabled={!selectedId || submitting || (selectedId === currentArtistId)}
              >
                {submitting
                  ? 'Saving…'
                  : selectedId === currentArtistId
                    ? 'Already supported'
                    : isFirstPick ? 'Support this artist' : 'Queue change'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupportedArtistPicker;