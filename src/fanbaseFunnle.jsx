import React, { useState, useEffect, useCallback } from 'react';
import {
  Play, Heart, Vote, UserPlus, Star, Info, ArrowUp, ArrowDown,
  Headphones, Crown, CalendarDays, SlidersHorizontal, // ★ item 5
} from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import './fanbaseFunnel.scss';

const STAGE_ICONS = {
  plays: Headphones,
  listeners: Play,
  likers: Heart,
  voters: Vote,
  followers: UserPlus,
  supporters: Star,
};

const STAGE_TIPS = {
  plays:
    'Total counted plays of your songs in this window — every play past the 15s / 25% threshold, including replays. The Listeners bar below dedupes this down to unique people.',
  listeners:
    "Unique people who've played at least one of your songs past the count threshold (15s / 25%). One person counts once here, no matter how many times they replay.",
  likers: 'Listeners who liked at least one of your songs.',
  voters:
    'Listeners who spent a vote on you during an award cycle. Votes are scarce, so this is a stronger signal than a like.',
  followers: 'Listeners who followed you to keep up with new releases and wins.',
  supporters:
    'Listeners who chose you as their supported artist — the deepest commitment on Unis. Each member can back exactly one artist at a time.',
};

const REPEAT_TIP =
  'Total plays ÷ unique listeners. Above 1.0× means people replay your music instead of listening once and leaving — a sign your songs stick.';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All time' },
];

const PREV_LABEL = {
  today: 'vs yesterday',
  week: 'vs last week',
  month: 'vs last month',
  year: 'vs last year',
  all: '',
};

// ★ item 5d: gender buckets. NOTE — these `key` values are sent verbatim and
// matched case-insensitively against users.gender. Confirm they match what
// CreateAccountWizard actually stores (e.g. 'non-binary' vs 'nonbinary') and
// adjust here if needed.
const GENDER_OPTIONS = [
  { key: 'all', label: 'All genders' },
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'non-binary', label: 'Non-binary' },
  { key: 'unknown', label: 'Not specified' },
];

// ★ item 5d: age buckets (backend maps to a DOB age range or NULL check).
const AGE_OPTIONS = [
  { key: 'all', label: 'All ages' },
  { key: '13-17', label: '13–17' },
  { key: '18-24', label: '18–24' },
  { key: '25-34', label: '25–34' },
  { key: '35-44', label: '35–44' },
  { key: '45+', label: '45+' },
  { key: 'unknown', label: 'Not specified' },
];

const formatNumber = (n) => Number(n || 0).toLocaleString();

const formatSince = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const initialOf = (name) => (name ? name.charAt(0).toUpperCase() : '?');

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

// NOTE: assumes today = current calendar day, week = trailing 7 days,
// month = trailing 30, year = trailing 365 — matching the service. If the
// service windows change, have it return windowStart/windowEnd and format those.
const buildPeriodStamp = (period) => {
  const now = new Date();
  switch (period) {
    case 'today':
      return fmtFullDay(now);
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      const sameYear = start.getFullYear() === now.getFullYear();
      const left = `${MONTHS[start.getMonth()]} ${ordinal(start.getDate())}${
        sameYear ? '' : ` ${start.getFullYear()}`
      }`;
      const right = `${MONTHS[now.getMonth()]} ${ordinal(now.getDate())} ${now.getFullYear()}`;
      return `${left} – ${right}`;
    }
    case 'month':
      return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    case 'year':
      return `${now.getFullYear()}`;
    case 'all':
    default:
      return 'All time';
  }
};

const FanbaseFunnel = ({ artistId, artistPhoto, artistName, ambientImage }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openTip, setOpenTip] = useState(null);
  const [period, setPeriod] = useState('all');

  // ★ item 5d/5e: drill-down filter state
  const [gender, setGender] = useState('all');
  const [age, setAge] = useState('all');
  const [jurisdictionId, setJurisdictionId] = useState('all');

  const ambient = ambientImage || artistPhoto || null;

  const fetchFanbase = useCallback(async (id, p, filters = {}) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period: p });
      if (filters.gender && filters.gender !== 'all') params.set('gender', filters.gender);
      if (filters.age && filters.age !== 'all') params.set('age', filters.age);
      if (filters.jurisdictionId && filters.jurisdictionId !== 'all') {
        params.set('jurisdictionId', filters.jurisdictionId);
      }
      const res = await apiCall({
        url: `/v1/artist-analytics/artist/${id}/fanbase?${params.toString()}`,
        method: 'get',
        useCache: false,
      });
      setData(res.data || null);
    } catch (err) {
      console.error('Fanbase analytics fetch failed:', err);
      setError('Could not load your fanbase analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFanbase(artistId, period, { gender, age, jurisdictionId });
  }, [artistId, period, gender, age, jurisdictionId, fetchFanbase]);

  useEffect(() => {
    if (!openTip) return undefined;
    const handleOutside = (e) => {
      if (!e.target.closest('.fanbase-help')) setOpenTip(null);
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, [openTip]);

  const toggleTip = (key) => setOpenTip((prev) => (prev === key ? null : key));

  // ★ item 5c: funnel now arrives with Plays as the first stage from the backend.
  const funnel = data?.funnel || [];
  const repeatRatio = data?.repeatListenRatio || 0;
  const uniqueListeners = data?.uniqueListeners || 0;
  const topOfFunnel = funnel.length
    ? Math.max(...funnel.map((s) => Number(s.value || 0)))
    : 0;

  const supporters = funnel.find((s) => s.key === 'supporters')?.value || 0;
  const recentSupporters = data?.recentSupporters || [];
  const growth = data?.supporterGrowth || [];
  const availableJurisdictions = data?.availableJurisdictions || [];
  const hasAnyFanbase = funnel.some((s) => Number(s.value || 0) > 0);
  const maxGrowth = growth.reduce((m, g) => Math.max(m, Number(g.count || 0)), 0);
  const prevLabel = PREV_LABEL[period] || '';
  const periodStamp = buildPeriodStamp(period);

  const retry = () => fetchFanbase(artistId, period, { gender, age, jurisdictionId });

  return (
    <section className="fanbase" aria-labelledby="fanbase-title">
      {ambient && (
        <div
          className="fanbase-ambient"
          style={{ backgroundImage: `url(${ambient})` }}
          aria-hidden="true"
        />
      )}

      <div className="fanbase__head">
        <div className="fanbase__title-wrap">
          <div className="fanbase__artist-avatar">
            {artistPhoto ? (
              <img
                src={artistPhoto}
                alt={artistName || 'Artist'}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <span className="fanbase__artist-avatar-fallback">
                {initialOf(artistName)}
              </span>
            )}
          </div>

          <div>
            <span className="artist-section__eyebrow">Audience funnel</span>
            <h2 id="fanbase-title">
              Your <em>momentum</em>
            </h2>
          </div>
        </div>

        {hasAnyFanbase && uniqueListeners > 0 && (
          <div className="fanbase__ratio">
            <div className="fanbase__ratio-row">
              <strong>{repeatRatio.toFixed(2)}×</strong>
              <span className="fanbase-help fanbase-help--below">
                <button
                  type="button"
                  className="fanbase-help__btn"
                  aria-label="What is the repeat-listen rate?"
                  aria-expanded={openTip === 'repeat'}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTip('repeat');
                  }}
                >
                  <Info size={13} />
                </button>
                <span
                  className={`fanbase-tip ${openTip === 'repeat' ? 'is-open' : ''}`}
                  role="tooltip"
                >
                  {REPEAT_TIP}
                </span>
              </span>
            </div>
            <span className="fanbase__ratio-label">Repeat-listen rate</span>
          </div>
        )}
      </div>

      {/* ★ item 5: one-liner now ABOVE the toggle */}
      <p className="fanbase__lede">Your advanced audience funnel</p>

      {/* ★ period: centered segmented toggle (item 5a) */}
      <div className="fanbase__periods" role="tablist" aria-label="Time range">
        {PERIODS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={period === opt.key}
            className={`fanbase__period ${period === opt.key ? 'is-active' : ''}`}
            onClick={() => setPeriod(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ★ item 5b: active-window stamp */}
      <div className="fanbase__datestamp" aria-live="polite">
        <CalendarDays size={13} />
        <span>{periodStamp}</span>
      </div>

      {/* ★ item 5d/5e: drill-down filters */}
      <div className="fanbase__filters">
        <span className="fanbase__filters-label">
          <SlidersHorizontal size={13} /> Drill down
        </span>

        <label className="fanbase__filter">
          <span>Gender</span>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="fanbase__filter">
          <span>Age</span>
          <select value={age} onChange={(e) => setAge(e.target.value)}>
            {AGE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>

        {availableJurisdictions.length > 0 && (
          <label className="fanbase__filter">
            <span>Location</span>
            <select value={jurisdictionId} onChange={(e) => setJurisdictionId(e.target.value)}>
              <option value="all">All locations</option>
              {availableJurisdictions.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <div className="fanbase__state">
          <div className="fanbase__spinner" aria-hidden="true" />
          <p>Loading your fanbase…</p>
        </div>
      ) : error ? (
        <div className="fanbase__state fanbase__state--error">
          <p>{error}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      ) : (
        <>
          <div className="fanbase__funnel">
            {funnel.map((stage, index) => {
              const Icon = STAGE_ICONS[stage.key] || Star;
              const value = Number(stage.value || 0);
              const prevStage = index > 0 ? funnel[index - 1] : null;
              const prevVal = prevStage ? Number(prevStage.value || 0) : null;
              const isFromPlays = prevStage?.key === 'plays';

              // ★ item 5c: plays→listeners is events→people (a dedup, not a
              // drop-off), so suppress the misleading "% continue" there.
              const conversion =
                prevVal && prevVal > 0 && !isFromPlays
                  ? Math.round((value / prevVal) * 100)
                  : null;

              const width =
                topOfFunnel > 0
                  ? Math.max(8, Math.round((value / topOfFunnel) * 100))
                  : 8;
              const tip = STAGE_TIPS[stage.key];
              const isSupporter = stage.key === 'supporters';

              const delta = stage.delta;
              const hasDelta = delta !== null && delta !== undefined;
              const deltaUp = hasDelta && delta > 0;
              const deltaDown = hasDelta && delta < 0;

              return (
                <div className="fanbase-stage" key={stage.key}>
                  {index > 0 && (
                    <div className="fanbase-stage__connector">
                      {conversion !== null ? (
                        <span>{conversion}% continue</span>
                      ) : (
                        <span className="is-muted">—</span>
                      )}
                    </div>
                  )}

                  <div
                    className={`fanbase-stage__bar ${isSupporter ? 'is-supporter' : ''}`}
                    style={{ width: `${width}%` }}
                  >
                    <span className="fanbase-stage__icon">
                      <Icon size={16} />
                    </span>
                    <span className="fanbase-stage__label">{stage.label}</span>

                    <strong className="fanbase-stage__value">
                      {formatNumber(value)}
                    </strong>

                    {hasDelta && (
                      <span
                        className={`fanbase-stage__delta ${
                          deltaUp ? 'is-up' : deltaDown ? 'is-down' : 'is-flat'
                        }`}
                        title={`${delta > 0 ? '+' : ''}${delta} ${prevLabel}`}
                      >
                        {deltaUp && <ArrowUp size={12} />}
                        {deltaDown && <ArrowDown size={12} />}
                        {deltaUp ? '+' : ''}
                        {delta}
                      </span>
                    )}

                    {tip && (
                      <span
                        className={`fanbase-help ${isSupporter ? 'fanbase-help--invert' : ''}`}
                      >
                        <button
                          type="button"
                          className="fanbase-help__btn"
                          aria-label={`What does "${stage.label}" mean?`}
                          aria-expanded={openTip === stage.key}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTip(stage.key);
                          }}
                        >
                          <Info size={13} />
                        </button>
                        <span
                          className={`fanbase-tip ${openTip === stage.key ? 'is-open' : ''}`}
                          role="tooltip"
                        >
                          {tip}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!hasAnyFanbase && (
            <div className="fanbase__empty">
              <Star size={26} />
              <h3>
                {period === 'all' && gender === 'all' && age === 'all' && jurisdictionId === 'all'
                  ? 'Your fanbase starts here'
                  : 'No activity for this slice'}
              </h3>
              <p>
                {period === 'all' && gender === 'all' && age === 'all' && jurisdictionId === 'all'
                  ? "As listeners discover, like, vote for, follow, and support you, this is where you'll watch casual plays turn into a real community."
                  : 'Try a wider time range or fewer filters — early on, demographic data is sparse.'}
              </p>
            </div>
          )}

          {growth.length > 0 && (
            <div className="fanbase__growth">
              <div className="fanbase__growth-head">
                <span className="artist-section__eyebrow">Last 30 days</span>
                <h3>New supporters</h3>
              </div>
              <div
                className="fanbase__sparkline"
                role="img"
                aria-label="New supporters over the last 30 days"
              >
                {growth.map((g, i) => {
                  const c = Number(g.count || 0);
                  const h = maxGrowth > 0 ? Math.max(6, (c / maxGrowth) * 100) : 6;
                  return (
                    <span
                      key={i}
                      className="fanbase__bar"
                      style={{ height: `${h}%` }}
                      title={`${g.day}: ${c} new`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="fanbase__supporters">
            <div className="fanbase__supporters-head">
              <span className="artist-section__eyebrow">Who's backing you</span>
              <h3>
                {supporters > 0
                  ? `${formatNumber(supporters)} ${supporters === 1 ? 'supporter' : 'supporters'}`
                  : 'Your supporters'}
              </h3>
            </div>

            {/* ★ item 5f: #1 supporter spotlight (actual supporter, by plays) */}
            {data?.topSupporter && (
              <div className="fanbase__topfan">
                <span className="fanbase__topfan-badge">
                  <Crown size={11} /> #1 Supporter
                </span>
                {data.topSupporter.photoUrl ? (
                  <img
                    src={buildUrl(data.topSupporter.photoUrl)}
                    alt={data.topSupporter.username || 'Top supporter'}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="fanbase__topfan-placeholder">
                    {initialOf(data.topSupporter.username)}
                  </span>
                )}
                <div className="fanbase__topfan-meta">
                  <strong>{data.topSupporter.username || 'Supporter'}</strong>
                  <small>
                    {data.topSupporter.plays != null
                      ? `${formatNumber(data.topSupporter.plays)} plays · `
                      : ''}
                    since {formatSince(data.topSupporter.since)}
                  </small>
                </div>
              </div>
            )}

            {recentSupporters.length > 0 ? (
              <div className="fanbase__supporter-grid">
                {recentSupporters.map((s) => (
                  <div className="fanbase-supporter" key={s.userId}>
                    {s.photoUrl ? (
                      <img
                        src={buildUrl(s.photoUrl)}
                        alt={s.username}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="fanbase-supporter__placeholder">
                        {initialOf(s.username)}
                      </div>
                    )}
                    <strong>{s.username || 'Supporter'}</strong>
                    <small>since {formatSince(s.since)}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="fanbase__empty fanbase__empty--soft">
                <p>
                  No supporters yet. When a listener chooses to support you,
                  they'll appear here by name — the start of your real
                  community.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default FanbaseFunnel;