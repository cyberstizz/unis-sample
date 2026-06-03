import React, { useState, useEffect, useCallback } from 'react';
import { Play, Heart, Vote, UserPlus, Star } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import './fanbaseFunnel.scss';

/**
 * FanbaseFunnel
 * -------------
 * The conversion story Spotify can't tell: listener -> liker -> voter ->
 * follower -> supporter, plus the named people who actually back this artist.
 *
 * 100% live data from existing tables. Looks intentional at zero (pre-launch)
 * and scales up as real numbers arrive. Drop into ArtistDashboard like the
 * other child components:
 *
 *   <FanbaseFunnel artistId={user?.userId} />
 */

const STAGE_ICONS = {
  listeners: Play,
  likers: Heart,
  voters: Vote,
  followers: UserPlus,
  supporters: Star,
};

const formatNumber = (n) => Number(n || 0).toLocaleString();

const formatSince = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const initialOf = (name) => (name ? name.charAt(0).toUpperCase() : '?');

const FanbaseFunnel = ({ artistId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFanbase = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall({
        url: `/v1/artist-analytics/artist/${id}/fanbase`,
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
    fetchFanbase(artistId);
  }, [artistId, fetchFanbase]);

  const funnel = data?.funnel || [];
  const topOfFunnel = funnel.length > 0 ? Number(funnel[0].value || 0) : 0;
  const supporters = funnel.find((s) => s.key === 'supporters')?.value || 0;
  const recentSupporters = data?.recentSupporters || [];
  const growth = data?.supporterGrowth || [];
  const repeatRatio = data?.repeatListenRatio || 0;
  const uniqueListeners = data?.uniqueListeners || 0;
  const totalPlays = data?.totalPlays || 0;

  const hasAnyFanbase = funnel.some((s) => Number(s.value || 0) > 0);
  const maxGrowth = growth.reduce((m, g) => Math.max(m, Number(g.count || 0)), 0);

  return (
    <section className="fanbase" aria-labelledby="fanbase-title">
      <div className="fanbase__head">
        <div>
          <span className="artist-section__eyebrow">The Unis advantage</span>
          <h2 id="fanbase-title">
            Your <em>fanbase</em>
          </h2>
        </div>

        {hasAnyFanbase && uniqueListeners > 0 && (
          <div className="fanbase__ratio" title="Plays per unique listener">
            <strong>{repeatRatio.toFixed(2)}×</strong>
            <span>Repeat-listen rate</span>
          </div>
        )}
      </div>

      <p className="fanbase__lede">
        Most platforms stop at play counts. Unis shows you the journey from a
        first listen all the way to a real supporter — and exactly who those
        supporters are.
      </p>

      {loading ? (
        <div className="fanbase__state">
          <div className="fanbase__spinner" aria-hidden="true" />
          <p>Loading your fanbase…</p>
        </div>
      ) : error ? (
        <div className="fanbase__state fanbase__state--error">
          <p>{error}</p>
          <button type="button" onClick={() => fetchFanbase(artistId)}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ---------------- Conversion funnel ---------------- */}
          <div className="fanbase__funnel">
            {funnel.map((stage, index) => {
              const Icon = STAGE_ICONS[stage.key] || Star;
              const value = Number(stage.value || 0);
              const prev = index > 0 ? Number(funnel[index - 1].value || 0) : null;
              const conversion =
                prev && prev > 0 ? Math.round((value / prev) * 100) : null;
              const width =
                topOfFunnel > 0
                  ? Math.max(8, Math.round((value / topOfFunnel) * 100))
                  : 8;

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
                    className={`fanbase-stage__bar ${
                      stage.key === 'supporters' ? 'is-supporter' : ''
                    }`}
                    style={{ width: `${width}%` }}
                  >
                    <span className="fanbase-stage__icon">
                      <Icon size={16} />
                    </span>
                    <span className="fanbase-stage__label">{stage.label}</span>
                    <strong className="fanbase-stage__value">
                      {formatNumber(value)}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>

          {!hasAnyFanbase && (
            <div className="fanbase__empty">
              <Star size={26} />
              <h3>Your fanbase starts here</h3>
              <p>
                As listeners discover, like, vote for, follow, and support you,
                this is where you'll watch casual plays turn into a real
                community.
              </p>
            </div>
          )}

          {/* ---------------- Supporter growth (real data) ---------------- */}
          {growth.length > 0 && (
            <div className="fanbase__growth">
              <div className="fanbase__growth-head">
                <span className="artist-section__eyebrow">Last 30 days</span>
                <h3>New supporters</h3>
              </div>
              <div className="fanbase__sparkline" role="img" aria-label="New supporters over the last 30 days">
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

          {/* ---------------- Named supporters ---------------- */}
          <div className="fanbase__supporters">
            <div className="fanbase__supporters-head">
              <span className="artist-section__eyebrow">
                Who's backing you
              </span>
              <h3>
                {supporters > 0
                  ? `${formatNumber(supporters)} ${
                      supporters === 1 ? 'supporter' : 'supporters'
                    }`
                  : 'Your supporters'}
              </h3>
            </div>

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