import React, { useState, useEffect, useCallback } from 'react';
import { Crown, Heart } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import './supportersSection.scss';

const formatNumber = (n) => Number(n || 0).toLocaleString();
const initialOf = (name) => (name ? name.charAt(0).toUpperCase() : '?');

const formatSince = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

// ★ item 5: supporters pulled out of the funnel into their own section.
// All-time / fixed-window — independent of the funnel's period & filters.
const SupportersSection = ({ artistId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSupporters = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall({
        url: `/v1/artist-analytics/artist/${id}/supporters`,
        method: 'get',
        useCache: false,
      });
      setData(res.data || null);
    } catch (err) {
      console.error('Supporters fetch failed:', err);
      setError('Could not load your supporters.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSupporters(artistId);
  }, [artistId, fetchSupporters]);

  const count = Number(data?.supportersCount || 0);
  const topSupporter = data?.topSupporter || null;
  const recentSupporters = data?.recentSupporters || [];
  const growth = data?.supporterGrowth || [];
  const maxGrowth = growth.reduce((m, g) => Math.max(m, Number(g.count || 0)), 0);

  return (
    <section className="sup" aria-labelledby="sup-title">
      <div className="sup__head">
        <span className="artist-section__eyebrow">Who's backing you</span>
        <h2 id="sup-title">
          Your <em>supporters</em>
        </h2>
      </div>

      {loading ? (
        <div className="sup__state">
          <div className="sup__spinner" aria-hidden="true" />
          <p>Loading your supporters…</p>
        </div>
      ) : error ? (
        <div className="sup__state sup__state--error">
          <p>{error}</p>
          <button type="button" onClick={() => fetchSupporters(artistId)}>Retry</button>
        </div>
      ) : (
        <>
          {topSupporter && (
            <div className="sup__topfan">
              <span className="sup__topfan-badge">
                <Crown size={11} /> #1 Supporter
              </span>
              {topSupporter.photoUrl ? (
                <img
                  src={buildUrl(topSupporter.photoUrl)}
                  alt={topSupporter.username || 'Top supporter'}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="sup__topfan-placeholder">
                  {initialOf(topSupporter.username)}
                </span>
              )}
              <div className="sup__topfan-meta">
                <strong>{topSupporter.username || 'Supporter'}</strong>
                <small>
                  {topSupporter.plays != null
                    ? `${formatNumber(topSupporter.plays)} plays · `
                    : ''}
                  since {formatSince(topSupporter.since)}
                </small>
              </div>
            </div>
          )}

          <div className="sup__count">
            <strong>{formatNumber(count)}</strong>
            <span>{count === 1 ? 'supporter' : 'supporters'} backing you</span>
          </div>

          {recentSupporters.length > 0 ? (
            <div className="sup__grid">
              {recentSupporters.map((s) => (
                <div className="sup-person" key={s.userId}>
                  {s.photoUrl ? (
                    <img
                      src={buildUrl(s.photoUrl)}
                      alt={s.username}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="sup-person__placeholder">{initialOf(s.username)}</div>
                  )}
                  <strong>{s.username || 'Supporter'}</strong>
                  <small>since {formatSince(s.since)}</small>
                </div>
              ))}
            </div>
          ) : (
            <div className="sup__empty">
              <Heart size={24} />
              <p>
                No supporters yet. When a listener chooses to support you, they'll appear
                here by name — the start of your real community.
              </p>
            </div>
          )}

          {growth.length > 0 && (
            <div className="sup__growth">
              <div className="sup__growth-head">
                <span className="artist-section__eyebrow">Last 30 days</span>
                <h3>New supporters</h3>
              </div>
              <div
                className="sup__sparkline"
                role="img"
                aria-label="New supporters over the last 30 days"
              >
                {growth.map((g, i) => {
                  const c = Number(g.count || 0);
                  const h = maxGrowth > 0 ? Math.max(6, (c / maxGrowth) * 100) : 6;
                  return (
                    <span
                      key={i}
                      className="sup__bar"
                      style={{ height: `${h}%` }}
                      title={`${g.day}: ${c} new`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default SupportersSection;