import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, CalendarDays, Sparkles, RefreshCw } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './territoryRankSection.scss';

// ★ Dashboard shows Day / Week / Month / Year. All-time lives on the Discover page.
// ★ 'today' is computed nightly against the last COMPLETE day, so the Day tab
//   shows yesterday's standing — exactly what the backend already stages.
const PERIOD_ORDER = ['today', 'week', 'month', 'year'];
const PERIOD_LABELS = { today: 'Day', week: 'Week', month: 'Month', year: 'Year' };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const fmtFullDay = (d) => `${MONTHS[d.getMonth()]} ${ordinal(d.getDate())} ${d.getFullYear()}`;
const fmtShortDay = (d) => `${MONTHS[d.getMonth()].slice(0, 3)} ${ordinal(d.getDate())}`;

// ★ THE DATE FIX. The old chip printed `computedAt` — i.e. when the nightly job
//   last ran. That never changed when you toggled Day/Week/Month/Year, so the
//   selected period was never actually communicated. This builds the stamp from
//   the SELECTED PERIOD, using the same language as FanbaseFunnel's period chip.
//
//   Ranks are staged against complete days, so every window ends yesterday.
const buildPeriodStamp = (period) => {
  const end = new Date();
  end.setDate(end.getDate() - 1); // last complete day

  switch (period) {
    case 'today':
      return fmtFullDay(end);
    case 'week': {
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      return `${fmtShortDay(start)} – ${fmtShortDay(end)} ${end.getFullYear()}`;
    }
    case 'month':
      return `${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
    case 'year':
      return `${end.getFullYear()}`;
    default:
      return '';
  }
};

const PERIOD_SUBLINE = {
  today: 'Where you placed yesterday, across every territory you reach.',
  week: 'Where you placed over the last seven days, across every territory you reach.',
  month: 'Where you placed this month, across every territory you reach.',
  year: 'Where you placed this year, across every territory you reach.',
};

const formatComputed = (iso) => {
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
  const home = rows[0] || null;
  const computed = formatComputed(data.computedAt);
  const periodStamp = buildPeriodStamp(period);

  return (
    <div className="territory-rank">
      {/* ★ CAPTION REBUILD. Was a floating grey sentence with a dim pill. Now a
          proper header band: accent eyebrow, real subline weight, and the
          period stamp given the prominence it earns. */}
      <header className="territory-rank__caption">
        <span className="territory-rank__caption-eyebrow">Territory rank</span>
        <p className="territory-rank__caption-sub">{PERIOD_SUBLINE[period]}</p>
      </header>

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

      {/* ★ period stamp — reads exactly like the funnel's date chip, and it
          actually changes when you move the toggle. */}
      <div className="territory-rank__stampline" aria-live="polite">
        <span className="territory-rank__stamp">
          <CalendarDays size={12} /> {periodStamp}
        </span>
        {computed && (
          <span className="territory-rank__computed">Computed {computed}</span>
        )}
      </div>

      {home && home.overallRank != null && (
        <div className="territory-rank__headline">
          <span className="territory-rank__headline-lead">You&apos;re</span>
          <span className="territory-rank__headline-num">#{home.overallRank}</span>
          <span className="territory-rank__headline-in">in {home.jurisdictionName}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="territory-rank__empty">
          <p>No ranking yet for {periodStamp}.</p>
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