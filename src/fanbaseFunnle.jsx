import React, { useState, useEffect, useCallback } from 'react';
import {
  Play, Heart, Vote, UserPlus, Star, Info, ArrowUp, ArrowDown,
  Headphones, CalendarDays, ChevronDown,
} from 'lucide-react';
import { apiCall } from './components/axiosInstance';
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
const COMPLETION_TIP =
  'The share of plays that reached the finish across your catalog, not skipped early. High completion means your songs hold attention.';
const SOURCE_TIP =
  'Where plays came from — the screen or surface a listener was on when they pressed play.';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
];

const PREV_LABEL = {
  today: 'vs yesterday',
  week: 'vs last week',
  month: 'vs last month',
  year: 'vs last year',
  all: '',
};

// ★ item 5d: keys sent verbatim, matched case-insensitively vs users.gender.
const GENDER_OPTIONS = [
  { key: 'all', label: 'All genders' },
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'non-binary', label: 'Non-binary' },
  { key: 'unknown', label: 'Not specified' },
];

const AGE_OPTIONS = [
  { key: 'all', label: 'All ages' },
  { key: '13-17', label: '13–17' },
  { key: '18-24', label: '18–24' },
  { key: '25-34', label: '25–34' },
  { key: '35-44', label: '35–44' },
  { key: '45+', label: '45+' },
  { key: 'unknown', label: 'Not specified' },
];

const SOURCE_LABELS = {
  feed: 'Feed',
  profile: 'Profile',
  'profile-support': 'Profile (supported artist)',
  dashboard: 'Dashboard',
  'dashboard-support': 'Dashboard (supported artist)',
  search: 'Search',
  playlist: 'Playlist',
  jurisdiction: 'Jurisdiction pages',
  share: 'Shared link',
  shared: 'Shared link',
  song: 'Song page',
  artist: 'Artist page',
  unknown: 'Direct / unknown',
};

const labelForSource = (s) => {
  if (!s) return SOURCE_LABELS.unknown;
  if (SOURCE_LABELS[s]) return SOURCE_LABELS[s];
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const formatNumber = (n) => Number(n || 0).toLocaleString();
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

// NOTE: mirrors the service windows (today=calendar day, week/month/year =
// trailing 7/30/365). If the service bounds change, return windowStart/End.
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
  const [gender, setGender] = useState('all');
  const [age, setAge] = useState('all');
  const [jurisdictionId, setJurisdictionId] = useState('all');
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  const funnel = data?.funnel || [];
  const repeatRatio = data?.repeatListenRatio || 0;
  const uniqueListeners = data?.uniqueListeners || 0;
  const topOfFunnel = funnel.length
    ? Math.max(...funnel.map((s) => Number(s.value || 0)))
    : 0;
  const availableJurisdictions = data?.availableJurisdictions || [];
  const hasAnyFanbase = funnel.some((s) => Number(s.value || 0) > 0);
  const prevLabel = PREV_LABEL[period] || '';
  const periodStamp = buildPeriodStamp(period);
  const noFilters = gender === 'all' && age === 'all' && jurisdictionId === 'all';

  // advanced data
  const completion = data?.completion || {};
  const completionRate = Number(completion.completionRate || 0);
  const completedPlays = Number(completion.completedPlays || 0);
  const completionTotal = Number(completion.totalPlays || 0);
  const sources = data?.sources || [];
  const sourceTotal = sources.reduce((sum, s) => sum + Number(s.count || 0), 0);

  // active-filter readout chips
  const genderLabel = GENDER_OPTIONS.find((o) => o.key === gender)?.label;
  const ageLabel = AGE_OPTIONS.find((o) => o.key === age)?.label;
  const jurisdictionLabel =
    availableJurisdictions.find((j) => String(j.id) === String(jurisdictionId))?.name;

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

      {/* ★ item 5: single-row control bar — interval + 3 drill-down selectors */}
      <div className="fanbase__controls">
        <label className="fanbase__control">
          <span>Interval</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="fanbase__control">
          <span>Gender</span>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="fanbase__control">
          <span>Age</span>
          <select value={age} onChange={(e) => setAge(e.target.value)}>
            {AGE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>

        <label className="fanbase__control fanbase__control--wide">
          <span>Location</span>
          <select
            value={jurisdictionId}
            onChange={(e) => setJurisdictionId(e.target.value)}
            disabled={availableJurisdictions.length === 0}
          >
            <option value="all">All locations</option>
            {availableJurisdictions.map((j) => (
              <option key={j.id} value={j.id}>{j.name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* ★ item 5: horizontal active-selection readout (replaces the old
          one-liner + datestamp + vertical filter stack) */}
      <div className="fanbase__summary" aria-live="polite">
        <span className="fanbase__summary-chip fanbase__summary-chip--date">
          <CalendarDays size={12} /> {periodStamp}
        </span>
        {gender !== 'all' && (
          <span className="fanbase__summary-chip">{genderLabel}</span>
        )}
        {age !== 'all' && (
          <span className="fanbase__summary-chip">{ageLabel}</span>
        )}
        {jurisdictionId !== 'all' && jurisdictionLabel && (
          <span className="fanbase__summary-chip">{jurisdictionLabel}</span>
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
                {period === 'all' && noFilters
                  ? 'Your fanbase starts here'
                  : 'No activity for this slice'}
              </h3>
              <p>
                {period === 'all' && noFilters
                  ? "As listeners discover, like, vote for, follow, and support you, this is where you'll watch casual plays turn into a real community."
                  : 'Try a wider interval or fewer filters — early on, demographic data is sparse.'}
              </p>
            </div>
          )}

          {/* ★ item 5: advanced metrics (same model as the per-song modal) */}
          {hasAnyFanbase && (
            <>
              <button
                type="button"
                className={`fanbase-advanced-toggle ${showAdvanced ? 'is-open' : ''}`}
                onClick={() => setShowAdvanced((v) => !v)}
                aria-expanded={showAdvanced}
              >
                <span>{showAdvanced ? 'Hide advanced metrics' : 'Advanced metrics'}</span>
                <ChevronDown size={16} />
              </button>

              {showAdvanced && (
                <div className="fanbase-advanced">
                  <div className="fanbase-adv-card">
                    <div className="fanbase-adv-card__head">
                      <span className="artist-section__eyebrow">Completion quality</span>
                      <span className="fanbase-help fanbase-help--below">
                        <button
                          type="button"
                          className="fanbase-help__btn"
                          aria-label="What is completion quality?"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTip('completion');
                          }}
                        >
                          <Info size={13} />
                        </button>
                        <span
                          className={`fanbase-tip ${openTip === 'completion' ? 'is-open' : ''}`}
                          role="tooltip"
                        >
                          {COMPLETION_TIP}
                        </span>
                      </span>
                    </div>

                    <div className="fanbase-completion">
                      <strong>{completionRate.toFixed(1)}%</strong>
                      <div className="fanbase-completion__bar">
                        <span style={{ width: `${Math.min(100, completionRate)}%` }} />
                      </div>
                      <p>
                        {formatNumber(completedPlays)} of {formatNumber(completionTotal)} plays
                        finished the song.
                      </p>
                    </div>
                  </div>

                  <div className="fanbase-adv-card">
                    <div className="fanbase-adv-card__head">
                      <span className="artist-section__eyebrow">Where plays come from</span>
                      <span className="fanbase-help fanbase-help--below">
                        <button
                          type="button"
                          className="fanbase-help__btn"
                          aria-label="What is the discovery source?"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTip('source');
                          }}
                        >
                          <Info size={13} />
                        </button>
                        <span
                          className={`fanbase-tip ${openTip === 'source' ? 'is-open' : ''}`}
                          role="tooltip"
                        >
                          {SOURCE_TIP}
                        </span>
                      </span>
                    </div>

                    {sources.length > 0 && sourceTotal > 0 ? (
                      <div className="fanbase-sources">
                        {sources.map((s) => {
                          const count = Number(s.count || 0);
                          const pct = Math.round((count / sourceTotal) * 100);
                          return (
                            <div className="fanbase-source-row" key={s.source}>
                              <div className="fanbase-source-row__top">
                                <span>{labelForSource(s.source)}</span>
                                <strong>
                                  {formatNumber(count)} <small>({pct}%)</small>
                                </strong>
                              </div>
                              <div className="fanbase-source-row__bar">
                                <span style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="fanbase-adv-empty">
                        No play sources recorded for this slice yet.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
};

export default FanbaseFunnel;