import React, { useState, useEffect, useCallback } from 'react';
import { Play, Heart, Vote, UserPlus, Star, Info, ArrowUp, ArrowDown, X } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './songStatsModal.scss';

const STAGE_ICONS = {
  listeners: Play,
  likers: Heart,
  voters: Vote,
  followers: UserPlus,
  supporters: Star,
};

// ★ tooltips clarify the per-song meaning (esp. followers/supporters).
const STAGE_TIPS = {
  listeners:
    "Unique people who've played this song past the count threshold (15s / 25%). Counted once each, no matter how many replays.",
  likers: 'People who liked this specific song.',
  voters: 'People who spent a vote on this song during an award cycle.',
  followers:
    'Your followers who have actually played this song. A follower who never played this track is not counted here.',
  supporters:
    'Your supporters who have actually played this song. A supporter who never played this track is not counted here.',
};

const REPEAT_TIP =
  'Total plays of this song ÷ unique listeners. Above 1.0× means people replay this track instead of hearing it once.';

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

const formatNumber = (n) => Number(n || 0).toLocaleString();

const SongStatsModal = ({ show, onClose, artistId, song }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openTip, setOpenTip] = useState(null);
  const [period, setPeriod] = useState('all');

  const songId = song?.songId || song?.id;

  const fetchFunnel = useCallback(
    async (p) => {
      if (!artistId || !songId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiCall({
          url: `/v1/artist-analytics/artist/${artistId}/song/${songId}/funnel?period=${p}`,
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
    },
    [artistId, songId]
  );

  useEffect(() => {
    if (show) fetchFunnel(period);
  }, [show, period, fetchFunnel]);

  // reset to all-time each time the modal opens fresh
  useEffect(() => {
    if (show) setPeriod('all');
  }, [show, songId]);

  useEffect(() => {
    if (!openTip) return;
    const handleOutside = (e) => {
      if (!e.target.closest('.songstats-help')) setOpenTip(null);
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, [openTip]);

  if (!show) return null;

  const toggleTip = (key) => setOpenTip((prev) => (prev === key ? null : key));

  const funnel = data?.funnel || [];
  const topOfFunnel = funnel.length > 0 ? Number(funnel[0].value || 0) : 0;
  const repeatRatio = data?.repeatListenRatio || 0;
  const uniqueListeners = data?.uniqueListeners || 0;
  const hasAny = funnel.some((s) => Number(s.value || 0) > 0);
  const prevLabel = PREV_LABEL[period] || '';

  return (
    <div className="songstats-overlay" onClick={onClose}>
      <div
        className="songstats-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Stats for ${song?.title || 'song'}`}
      >
        <button type="button" className="songstats-close" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>

        <div className="songstats-head">
          <div>
            <span className="artist-section__eyebrow">Song deep-dive</span>
            <h2>
              {song?.title || 'Song'} <em>stats</em>
            </h2>
          </div>

          {hasAny && uniqueListeners > 0 && (
            <div className="songstats-ratio">
              <div className="songstats-ratio__row">
                <strong>{repeatRatio.toFixed(2)}×</strong>
                <span className="songstats-help songstats-help--below">
                  <button
                    type="button"
                    className="songstats-help__btn"
                    aria-label="What is the repeat-listen rate?"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTip('repeat');
                    }}
                  >
                    <Info size={13} />
                  </button>
                  <span className={`songstats-tip ${openTip === 'repeat' ? 'is-open' : ''}`} role="tooltip">
                    {REPEAT_TIP}
                  </span>
                </span>
              </div>
              <span className="songstats-ratio__label">Repeat-listen rate</span>
            </div>
          )}
        </div>

        <div className="songstats-periods" role="tablist" aria-label="Time range">
          {PERIODS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={period === opt.key}
              className={`songstats-period ${period === opt.key ? 'is-active' : ''}`}
              onClick={() => setPeriod(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="songstats-state">
            <div className="songstats-spinner" aria-hidden="true" />
            <p>Loading stats…</p>
          </div>
        ) : error ? (
          <div className="songstats-state songstats-state--error">
            <p>{error}</p>
            <button type="button" onClick={() => fetchFunnel(period)}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="songstats-funnel">
              {funnel.map((stage, index) => {
                const Icon = STAGE_ICONS[stage.key] || Star;
                const value = Number(stage.value || 0);
                const prev = index > 0 ? Number(funnel[index - 1].value || 0) : null;
                const conversion = prev && prev > 0 ? Math.round((value / prev) * 100) : null;
                const width =
                  topOfFunnel > 0 ? Math.max(8, Math.round((value / topOfFunnel) * 100)) : 8;
                const tip = STAGE_TIPS[stage.key];
                const isSupporter = stage.key === 'supporters';
                const delta = stage.delta;
                const hasDelta = delta !== null && delta !== undefined;
                const deltaUp = hasDelta && delta > 0;
                const deltaDown = hasDelta && delta < 0;

                return (
                  <div className="songstats-stage" key={stage.key}>
                    {index > 0 && (
                      <div className="songstats-stage__connector">
                        {conversion !== null ? (
                          <span>{conversion}% continue</span>
                        ) : (
                          <span className="is-muted">—</span>
                        )}
                      </div>
                    )}

                    <div className={`songstats-stage__bar ${isSupporter ? 'is-supporter' : ''}`} style={{ width: `${width}%` }}>
                      <span className="songstats-stage__icon">
                        <Icon size={16} />
                      </span>
                      <span className="songstats-stage__label">{stage.label}</span>
                      <strong className="songstats-stage__value">{formatNumber(value)}</strong>

                      {hasDelta && (
                        <span
                          className={`songstats-stage__delta ${deltaUp ? 'is-up' : deltaDown ? 'is-down' : 'is-flat'}`}
                          title={`${delta > 0 ? '+' : ''}${delta} ${prevLabel}`}
                        >
                          {deltaUp && <ArrowUp size={12} />}
                          {deltaDown && <ArrowDown size={12} />}
                          {deltaUp ? '+' : ''}
                          {delta}
                        </span>
                      )}

                      {tip && (
                        <span className={`songstats-help ${isSupporter ? 'songstats-help--invert' : ''}`}>
                          <button
                            type="button"
                            className="songstats-help__btn"
                            aria-label={`What does "${stage.label}" mean?`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTip(stage.key);
                            }}
                          >
                            <Info size={13} />
                          </button>
                          <span className={`songstats-tip ${openTip === stage.key ? 'is-open' : ''}`} role="tooltip">
                            {tip}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!hasAny && (
              <div className="songstats-empty">
                <Star size={24} />
                <p>
                  {period === 'all'
                    ? 'No activity on this song yet. As listeners play, like, and vote, the funnel fills in here.'
                    : 'No activity in this period. Try a wider time range.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SongStatsModal;