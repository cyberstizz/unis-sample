import React, { useState, useEffect, useCallback } from 'react';
import {
  Play, Heart, Vote, UserPlus, Star, ArrowUp, ArrowDown,
  Headphones, CalendarDays, ChevronDown, X,
} from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import './fanbaseFunnel.scss';   // ★ reuse the funnel styling so this is a 1:1 match
import './songStatsModal.scss';  // modal shell only (overlay + close + sizing)

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
    'Total counted plays of this song in this window — every play past the 15s / 25% threshold, including replays. Listeners below dedupes this down to unique people.',
  listeners:
    "Unique people who've played this song past the count threshold (15s / 25%). One person counts once, no matter how many replays.",
  likers: 'People who liked this specific song.',
  voters: 'People who spent a vote on this song during an award cycle.',
  followers:
    'Your followers who have actually played this song. A follower who never played this track is not counted here.',
  supporters:
    'Your supporters who have actually played this song. A supporter who never played this track is not counted here.',
};

const REPEAT_TIP =
  'Total plays of this song ÷ unique listeners. Above 1.0× means people replay this track instead of hearing it once.';
const COMPLETION_TIP =
  'The share of plays that reached the finish, not skipped early. High completion means the track holds attention.';
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
const initialOf = (name) => (name ? name.charAt(0).toUpperCase() : '♪');

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

const TipValue = ({ tipKey, tip, openTip, onToggle, className = '', children }) => (
  <span
    className={`fanbase-tipwrap ${className}`}
    onClick={(e) => {
      e.stopPropagation();
      onToggle(tipKey);
    }}
  >
    {children}
    <span className={`fanbase-tip ${openTip === tipKey ? 'is-open' : ''}`} role="tooltip">
      {tip}
    </span>
  </span>
);

const SongStatsModal = ({ show, onClose, artistId, song }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openTip, setOpenTip] = useState(null);

  const [period, setPeriod] = useState('all');
  const [gender, setGender] = useState('all');
  const [age, setAge] = useState('all');
  const [jurisdictionId, setJurisdictionId] = useState('all');

  const songId = song?.songId || song?.id;
  const artworkUrl = buildUrl(song?.artworkUrl) || null;
  const ambient = artworkUrl; // ★ per-song ambient — its own artwork

  const fetchFunnel = useCallback(async (p, filters = {}) => {
    if (!artistId || !songId) return;
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
        url: `/v1/artist-analytics/artist/${artistId}/song/${songId}/funnel?${params.toString()}`,
        method: 'get',
        useCache: false,
      });
      setData(res.data || null);
    } catch (err) {
      console.error('Song funnel fetch failed:', err);
      setError('Could not load this song\u2019s stats.');
    } finally {
      setLoading(false);
    }
  }, [artistId, songId]);

  useEffect(() => {
    if (show) fetchFunnel(period, { gender, age, jurisdictionId });
  }, [show, period, gender, age, jurisdictionId, fetchFunnel]);

  // reset filters when the modal opens for a (different) song
  useEffect(() => {
    if (show) {
      setPeriod('all');
      setGender('all');
      setAge('all');
      setJurisdictionId('all');
    }
  }, [show, songId]);

  useEffect(() => {
    if (!openTip) return undefined;
    const handleOutside = (e) => {
      if (!e.target.closest('.fanbase-tipwrap')) setOpenTip(null);
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, [openTip]);

  if (!show) return null;

  const toggleTip = (key) => setOpenTip((prev) => (prev === key ? null : key));

  const funnel = data?.funnel || [];
  const repeatRatio = data?.repeatListenRatio || 0;
  const uniqueListeners = data?.uniqueListeners || 0;
  const topOfFunnel = funnel.length ? Math.max(...funnel.map((s) => Number(s.value || 0))) : 0;
  const availableJurisdictions = data?.availableJurisdictions || [];
  const hasAnyFanbase = funnel.some((s) => Number(s.value || 0) > 0);
  const prevLabel = PREV_LABEL[period] || '';
  const periodStamp = buildPeriodStamp(period);
  const noFilters = gender === 'all' && age === 'all' && jurisdictionId === 'all';

  const completion = data?.completion || {};
  const completionRate = Number(completion.completionRate || 0);
  const completedPlays = Number(completion.completedPlays || 0);
  const completionTotal = Number(completion.totalPlays || 0);
  const sources = data?.sources || [];
  const sourceTotal = sources.reduce((sum, s) => sum + Number(s.count || 0), 0);

  const genderLabel = GENDER_OPTIONS.find((o) => o.key === gender)?.label;
  const ageLabel = AGE_OPTIONS.find((o) => o.key === age)?.label;
  const jurisdictionLabel =
    availableJurisdictions.find((j) => String(j.id) === String(jurisdictionId))?.name;

  const retry = () => fetchFunnel(period, { gender, age, jurisdictionId });

  return (
    <div className="songstats-overlay" onClick={onClose}>
      <div
        className="songstats-shell"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Stats for ${song?.title || 'song'}`}
      >
        <button type="button" className="songstats-close" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>

        {/* identical structure to FanbaseFunnel, reusing its classes */}
        <section className="fanbase" aria-labelledby="songstats-title">
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
                {artworkUrl ? (
                  <img
                    src={artworkUrl}
                    alt={song?.title || 'Song'}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="fanbase__artist-avatar-fallback">{initialOf(song?.title)}</span>
                )}
              </div>

              <div>
                <span className="artist-section__eyebrow">Song deep-dive</span>
                <h2 id="songstats-title">
                  {song?.title || 'Song'} <em>stats</em>
                </h2>
              </div>
            </div>

            {hasAnyFanbase && uniqueListeners > 0 && (
              <div className="fanbase__ratio">
                <TipValue
                  tipKey="repeat"
                  tip={REPEAT_TIP}
                  openTip={openTip}
                  onToggle={toggleTip}
                  className="fanbase-tipwrap--below"
                >
                  <strong>{repeatRatio.toFixed(2)}×</strong>
                </TipValue>
                <span className="fanbase__ratio-label">Repeat-listen rate</span>
              </div>
            )}
          </div>

          <div className="fanbase__summary" aria-live="polite">
            <span className="fanbase__summary-chip fanbase__summary-chip--date">
              <CalendarDays size={12} /> {periodStamp}
            </span>
            {gender !== 'all' && <span className="fanbase__summary-chip">{genderLabel}</span>}
            {age !== 'all' && <span className="fanbase__summary-chip">{ageLabel}</span>}
            {jurisdictionId !== 'all' && jurisdictionLabel && (
              <span className="fanbase__summary-chip">{jurisdictionLabel}</span>
            )}
          </div>

          <div className="fanbase__controls">
            <select aria-label="Time interval" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>

            <select aria-label="Gender" value={gender} onChange={(e) => setGender(e.target.value)}>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>

            <select aria-label="Age" value={age} onChange={(e) => setAge(e.target.value)}>
              {AGE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>

            <select
              aria-label="Location"
              value={jurisdictionId}
              onChange={(e) => setJurisdictionId(e.target.value)}
              disabled={availableJurisdictions.length === 0}
            >
              <option value="all">All locations</option>
              {availableJurisdictions.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="fanbase__state">
              <div className="fanbase__spinner" aria-hidden="true" />
              <p>Loading stats…</p>
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
                    topOfFunnel > 0 ? Math.max(8, Math.round((value / topOfFunnel) * 100)) : 8;
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

                        {tip ? (
                          <TipValue
                            tipKey={stage.key}
                            tip={tip}
                            openTip={openTip}
                            onToggle={toggleTip}
                            className="fanbase-stage__valuewrap"
                          >
                            <strong className="fanbase-stage__value">{formatNumber(value)}</strong>
                          </TipValue>
                        ) : (
                          <strong className="fanbase-stage__value fanbase-stage__valuewrap">
                            {formatNumber(value)}
                          </strong>
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
                      ? 'No activity on this song yet'
                      : 'No activity for this slice'}
                  </h3>
                  <p>
                    {period === 'all' && noFilters
                      ? 'As listeners play, like, vote for, follow, and support around this track, the funnel fills in here.'
                      : 'Try a wider interval or fewer filters — early on, demographic data is sparse.'}
                  </p>
                </div>
              )}

              {hasAnyFanbase && (
                <AdvancedMetrics
                  openTip={openTip}
                  toggleTip={toggleTip}
                  completionRate={completionRate}
                  completedPlays={completedPlays}
                  completionTotal={completionTotal}
                  sources={sources}
                  sourceTotal={sourceTotal}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

// Advanced metrics block, identical to the funnel's.
const AdvancedMetrics = ({
  openTip, toggleTip, completionRate, completedPlays, completionTotal, sources, sourceTotal,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
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
              <TipValue
                tipKey="completion"
                tip={COMPLETION_TIP}
                openTip={openTip}
                onToggle={toggleTip}
                className="fanbase-tipwrap--below"
              >
                <span className="artist-section__eyebrow">Completion quality</span>
              </TipValue>
            </div>

            <div className="fanbase-completion">
              <strong>{completionRate.toFixed(1)}%</strong>
              <div className="fanbase-completion__bar">
                <span style={{ width: `${Math.min(100, completionRate)}%` }} />
              </div>
              <p>
                {formatNumber(completedPlays)} of {formatNumber(completionTotal)} plays finished the song.
              </p>
            </div>
          </div>

          <div className="fanbase-adv-card">
            <div className="fanbase-adv-card__head">
              <TipValue
                tipKey="source"
                tip={SOURCE_TIP}
                openTip={openTip}
                onToggle={toggleTip}
                className="fanbase-tipwrap--below"
              >
                <span className="artist-section__eyebrow">Where plays come from</span>
              </TipValue>
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
              <p className="fanbase-adv-empty">No play sources recorded for this slice yet.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SongStatsModal;