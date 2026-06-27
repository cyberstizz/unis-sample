import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Sparkles, RefreshCw } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './territoryRankSection.scss';

// ★ Dashboard shows only Week / Month / Year. All-time lives on the Discover page.
const PERIOD_ORDER = ['week', 'month', 'year'];
const PERIOD_LABELS = { week: 'Week', month: 'Month', year: 'Year' };

const formatUpdated = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const TerritoryRankSection = ({ artistId }) => {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('year');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRank = useCallback(() => {
    if (!artistId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiCall({
      url: `/v1/artist-analytics/artist/${artistId}/territory-rank`,
      method: 'get',
      useCache: false,
    })
      .then((res) => {
        if (cancelled) return;
        setData(res.data || null);
        const dp = res.data?.defaultPeriod;
        if (dp && PERIOD_ORDER.includes(dp)) setPeriod(dp);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Territory rank fetch failed:', err);
        setError('Could not load territory rank.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [artistId]);

  useEffect(() => fetchRank(), [fetchRank]);

  // --- States -------------------------------------------------------------
  if (loading) {
    return (
      <div className="territory-rank territory-rank--center">
        <div className="territory-rank__spinner" />
        <p>Loading your rank…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="territory-rank territory-rank--center">
        <p className="territory-rank__error">{error}</p>
        <button type="button" className="territory-rank__retry" onClick={fetchRank}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Cold start: table not yet populated by the nightly job / manual trigger.
  if (data.status === 'calculating') {
    return (
      <div className="territory-rank territory-rank--center">
        <div className="territory-rank__cold">
          <Sparkles size={26} />
          <h3>Ranks are calculating</h3>
          <p>
            Your standing is computed once a night. Check back after tonight&apos;s
            update to see where you place — neighborhood to national.
          </p>
        </div>
      </div>
    );
  }

  const genreName = data.genreName || null;
  const rows = (data.periods && data.periods[period]) || [];
  const home = rows[0] || null; // ★ home / most-local jurisdiction
  const updated = formatUpdated(data.computedAt);

  return (
    <div className="territory-rank">
      <div className="territory-rank__head">
        <p className="territory-rank__caption">
          Your standing where you&apos;re from, ranked by points.
        </p>
        {updated && (
          <span className="territory-rank__updated">
            <Clock size={12} /> Updated {updated}
          </span>
        )}
      </div>

      <div className="territory-rank__toggle" role="tablist" aria-label="Rank period">
        {PERIOD_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === period}
            className={`territory-rank__toggle-btn ${p === period ? 'is-active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* ★ Big standout headline — immediate "I am this rank" read */}
      {home && home.overallRank != null && (
        <div className="territory-rank__headline">
          <span className="territory-rank__headline-lead">You&apos;re</span>
          <span className="territory-rank__headline-num">#{home.overallRank}</span>
          <span className="territory-rank__headline-in">in {home.jurisdictionName}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="territory-rank__empty">
          <p>No ranking yet for this period.</p>
        </div>
      ) : (
        <ol className="territory-rank__list">
          {rows.map((j, i) => (
            <li
              key={j.jurisdictionId}
              className={`territory-rank__row ${i === 0 ? 'is-home' : ''}`}
            >
              <div className="territory-rank__place">
                <span className="territory-rank__pin">
                  <MapPin size={15} />
                </span>
                <div className="territory-rank__place-text">
                  <strong>{j.jurisdictionName}</strong>
                  {j.genreRank != null && genreName && (
                    <span className="territory-rank__genre">
                      #{j.genreRank} · {genreName}
                    </span>
                  )}
                </div>
              </div>

              <div className="territory-rank__score">
                {j.overallRank != null ? (
                  <>
                    <span className="territory-rank__hash">#</span>
                    <span className="territory-rank__num">{j.overallRank}</span>
                  </>
                ) : (
                  <span className="territory-rank__none">—</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default TerritoryRankSection;