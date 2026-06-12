import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Sparkles, RefreshCw } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './territoryRankSection.scss';

// Period vocabulary matches ArtistFanbaseService.VALID_PERIODS / the funnel toggle.
const PERIOD_ORDER = ['today', 'week', 'month', 'quarter', 'year', 'all'];
const PERIOD_LABELS = {
  today: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
  all: 'All-time',
};

const formatUpdated = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const TerritoryRankSection = ({ artistId, ambientImage }) => {
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
        if (res.data?.defaultPeriod) setPeriod(res.data.defaultPeriod);
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
  const updated = formatUpdated(data.computedAt);

  return (
    <div className="territory-rank">
      {ambientImage && (
        <div
          className="territory-rank__ambient"
          style={{ backgroundImage: `url(${ambientImage})` }}
          aria-hidden="true"
        />
      )}

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
                      #{j.genreRank} of {j.genreTotal} · {genreName}
                    </span>
                  )}
                </div>
              </div>

              <div className="territory-rank__score">
                {j.overallRank != null ? (
                  <>
                    <span className="territory-rank__hash">#</span>
                    <span className="territory-rank__num">{j.overallRank}</span>
                    <span className="territory-rank__of">of {j.overallTotal}</span>
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