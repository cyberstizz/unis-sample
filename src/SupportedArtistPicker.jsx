import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Clock, Sparkles } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import './SupportedArtistPicker.scss';

// =============================================================================
// SupportedArtistPicker
//
// Lets a user choose / change their supported artist. First-ever pick takes
// effect immediately; a change to an existing pick is QUEUED to month-end
// (the backend decides which and returns status: immediate | pending |
// cancelled). Overwrite semantics: picking again before the 1st just replaces
// the pending target.
//
// Props:
//   show:            boolean
//   onClose:         () => void
//   userId:          UUID
//   currentArtistId: UUID | null  (marks "current", drives immediate-vs-pending copy)
//   onSuccess:       () => void    (parent reload -> refreshes summary + pending banner)
// =============================================================================
const SupportedArtistPicker = ({ show, onClose, userId, currentArtistId, onSuccess }) => {
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { status, effectiveDate, pendingArtistId }

  const isFirstPick = !currentArtistId;

  useEffect(() => {
    if (!show) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setResult(null);
      setSelectedId(null);
      setQuery('');
      const startedAt = performance.now();
      try {
        const res = await apiCall({ url: '/v1/users/artists/with-preview' });
        if (cancelled) return;
        // Can't support yourself; exclude self from the list.
        const list = (res.data || []).filter((a) => a.userId !== userId);
        setArtists(list);
        const ms = Math.round(performance.now() - startedAt);
        console.log(`[ArtistPicker] action=load status=ok count=${list.length} durationMs=${ms}`);
      } catch (err) {
        if (cancelled) return;
        console.error('[ArtistPicker] action=load status=fail err=', err);
        setError('Could not load artists. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [show, userId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((a) => (a.username || '').toLowerCase().includes(q));
  }, [artists, query]);

  const selectedArtist = useMemo(
    () => artists.find((a) => a.userId === selectedId) || null,
    [artists, selectedId]
  );

  const handleSubmit = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    const startedAt = performance.now();
    try {
      const res = await apiCall({
        method: 'put',
        url: `/v1/users/${userId}/supported-artist`,
        data: { artistId: selectedId },
      });
      const ms = Math.round(performance.now() - startedAt);
      console.log(`[ArtistPicker] action=submit status=ok result=${res.data?.status} durationMs=${ms}`);
      setResult(res.data || { status: isFirstPick ? 'immediate' : 'pending' });
      onSuccess?.();
    } catch (err) {
      console.error('[ArtistPicker] action=submit status=fail err=', err);
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

  // ---- Success screen ----
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
          {immediate ? 'You\u2019re now supporting them!' : 'Change queued'}
        </h3>
        <p className="sap-success__body">
          {immediate
            ? `${selectedArtist?.username || 'Your artist'} now receives a share of your ad revenue.`
            : `You\u2019ll start supporting ${selectedArtist?.username || 'them'}${effective ? ` on ${effective}` : ' next month'}. Your current artist keeps earning until then.`}
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
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sap-title"
      >
        <button className="sap-close" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>

        <div className="sap-header">
          <h2 id="sap-title" className="sap-header__title">
            {isFirstPick ? 'Choose your artist' : 'Change who you support'}
          </h2>
          <p className="sap-header__sub">
            {isFirstPick
              ? 'Pick an artist to back \u2014 a share of your ad revenue goes to them.'
              : 'Changes take effect at the start of next month. Your current artist keeps earning until then.'}
          </p>
        </div>

        {result ? (
          renderSuccess()
        ) : (
          <>
            <div className="sap-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="text"
                placeholder="Search artists by name\u2026"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search artists"
              />
            </div>

            <div className="sap-list" role="listbox" aria-label="Artists">
              {loading ? (
                <div className="sap-state">
                  <div className="sap-spinner" aria-hidden="true" />
                  <p>Loading artists\u2026</p>
                </div>
              ) : error ? (
                <div className="sap-state sap-state--error" role="alert">
                  <p>{error}</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="sap-state">
                  <p>No artists match \u201C{query}\u201D.</p>
                </div>
              ) : (
                filtered.map((artist) => {
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
                        <div className="sap-row__avatar sap-row__avatar--ph" aria-hidden="true">
                          {initial}
                        </div>
                      )}
                      <div className="sap-row__info">
                        <span className="sap-row__name">{artist.username}</span>
                        <span className="sap-row__meta">
                          {artist.score ?? 0} pts
                          {isCurrent && <span className="sap-row__current-tag">Current</span>}
                        </span>
                      </div>
                      {isSelected && (
                        <span className="sap-row__check" aria-hidden="true">
                          <Check size={16} />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {error && !loading && (
              <div className="sap-inline-error" role="alert">{error}</div>
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
                  ? 'Saving\u2026'
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