import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Map as MapIcon, ChevronRight, ArrowLeft, Headphones, Play,
  Heart, UserPlus, Star, CalendarDays,
} from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import ScrollSelect from './scrollSelect'; 
import './demographicsSection.scss';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All time' },
];

const METRICS = [
  { key: 'plays', label: 'Plays' },
  { key: 'listeners', label: 'Listeners' },
  { key: 'likes', label: 'Likes' },
  { key: 'followers', label: 'Followers' },
  { key: 'supporters', label: 'Supporters' },
];

// plays/listeners are tagged on the play event; the rest only exist as people
const BASIS_NOTE = {
  plays: 'Where listeners were when each play happened.',
  listeners: 'Where listeners were when they played your music.',
  likes: "Based on each member's home neighborhood on Unis.",
  followers: "Based on each follower's home neighborhood on Unis.",
  supporters: "Based on each supporter's home neighborhood on Unis.",
};

const STAT_DEFS = [
  { key: 'plays', label: 'Plays', icon: Headphones },
  { key: 'listeners', label: 'Listeners', icon: Play },
  { key: 'likes', label: 'Likes', icon: Heart },
  { key: 'followers', label: 'Followers', icon: UserPlus },
  { key: 'supporters', label: 'Supporters', icon: Star },
];

const MAX_SLICES = 6;
const formatNumber = (n) => Number(n || 0).toLocaleString();

const DemographicsSection = ({ artistId }) => {
  const [tab, setTab] = useState('areas');
  const [period, setPeriod] = useState('all');

  // ---- tab 1: pie ---------------------------------------------------------
  const [metric, setMetric] = useState('plays');
  const [pieData, setPieData] = useState(null);
  const [pieLoading, setPieLoading] = useState(true);
  const [pieError, setPieError] = useState(null);

  // ---- tab 2: territory explorer -----------------------------------------
  const [territory, setTerritory] = useState(null);
  const [terLoading, setTerLoading] = useState(true);
  const [terError, setTerError] = useState(null);
  // navigation stack of visited territories: [{id, name}]
  const [stack, setStack] = useState([]);

  const fetchPie = useCallback(async (id, p, m) => {
    if (!id) return;
    setPieLoading(true);
    setPieError(null);
    try {
      const res = await apiCall({
        url: `/v1/artist-analytics/artist/${id}/demographics/top-jurisdictions?period=${p}&metric=${m}`,
        method: 'get',
        useCache: false,
      });
      setPieData(res.data || null);
    } catch (err) {
      console.error('Demographics pie fetch failed:', err);
      setPieError('Could not load your top areas.');
    } finally {
      setPieLoading(false);
    }
  }, []);

  const fetchTerritory = useCallback(async (id, p, jurisdictionId) => {
    if (!id) return;
    setTerLoading(true);
    setTerError(null);
    try {
      const params = new URLSearchParams({ period: p });
      if (jurisdictionId) params.set('jurisdictionId', jurisdictionId);
      const res = await apiCall({
        url: `/v1/artist-analytics/artist/${id}/demographics/territory?${params.toString()}`,
        method: 'get',
        useCache: false,
      });
      setTerritory(res.data || null);
    } catch (err) {
      console.error('Territory fetch failed:', err);
      setTerError('Could not load this territory.');
    } finally {
      setTerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'areas') fetchPie(artistId, period, metric);
  }, [artistId, tab, period, metric, fetchPie]);

  useEffect(() => {
    if (tab === 'map') {
      const current = stack.length > 0 ? stack[stack.length - 1].id : null;
      fetchTerritory(artistId, period, current);
    }
  }, [artistId, tab, period, stack, fetchTerritory]);

  const drillInto = (child) => {
    setStack((prev) => [...prev, { id: child.id, name: child.name }]);
  };

  const goBack = () => {
    setStack((prev) => prev.slice(0, -1));
  };

  const jumpTo = (index) => {
    // index -1 = root
    setStack((prev) => (index < 0 ? [] : prev.slice(0, index + 1)));
  };

  // ---- pie derivations ----------------------------------------------------
  const rawSlices = pieData?.slices || [];
  const pieTotal = rawSlices.reduce((sum, s) => sum + Number(s.count || 0), 0);
  const topSlices = rawSlices.slice(0, MAX_SLICES);
  const otherCount = rawSlices
    .slice(MAX_SLICES)
    .reduce((sum, s) => sum + Number(s.count || 0), 0);
  const slices = otherCount > 0
    ? [...topSlices, { id: 'other', name: 'Other areas', count: otherCount }]
    : topSlices;

  // donut geometry
  const R = 70;
  const C = 2 * Math.PI * R;
  let acc = 0;

  const stats = territory?.stats || {};
  const children = territory?.children || [];
  const currentName =
    territory?.jurisdiction?.name || (stack.length ? stack[stack.length - 1].name : '…');

  return (
    <section className="demo" aria-labelledby="demo-title">
      <div className="demo__head">
        <div>
          <span className="artist-section__eyebrow">Demographics</span>
          <h2 id="demo-title">
            Where your <em>audience lives</em>
          </h2>
        </div>

        <div className="demo__tabs" role="tablist" aria-label="Demographics view">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'areas'}
            className={`demo__tab ${tab === 'areas' ? 'is-active' : ''}`}
            onClick={() => setTab('areas')}
          >
            <PieChart size={14} /> Top areas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'map'}
            className={`demo__tab ${tab === 'map' ? 'is-active' : ''}`}
            onClick={() => setTab('map')}
          >
            <MapIcon size={14} /> Territory explorer
          </button>
        </div>
      </div>

      {/* shared period control + (tab 1 only) metric control */}
      <div className="demo__controls">
        <select
          aria-label="Time interval"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {PERIODS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>

        {tab === 'areas' && (
          <select
            aria-label="Metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {METRICS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* ====================== TAB 1: TOP AREAS (PIE) ====================== */}
      {tab === 'areas' && (
        pieLoading ? (
          <div className="demo__state">
            <div className="demo__spinner" aria-hidden="true" />
            <p>Loading top areas…</p>
          </div>
        ) : pieError ? (
          <div className="demo__state demo__state--error">
            <p>{pieError}</p>
            <button type="button" onClick={() => fetchPie(artistId, period, metric)}>
              Retry
            </button>
          </div>
        ) : slices.length === 0 || pieTotal === 0 ? (
          <div className="demo__empty">
            <PieChart size={26} />
            <h3>No location data for this slice yet</h3>
            <p>
              As plays come in, the neighborhoods, cities, and states your audience
              comes from will appear here.
            </p>
          </div>
        ) : (
          <div className="demo__pie-layout">
            <div className="demo__donut-wrap">
              <svg viewBox="0 0 180 180" className="demo__donut" role="img"
                   aria-label={`Top areas by ${metric}`}>
                <g transform="rotate(-90 90 90)">
                  {slices.map((s, i) => {
                    const frac = Number(s.count || 0) / pieTotal;
                    const dash = frac * C;
                    const seg = (
                      <circle
                        key={s.id}
                        cx="90" cy="90" r={R}
                        fill="none"
                        strokeWidth="26"
                        strokeDasharray={`${dash} ${C - dash}`}
                        strokeDashoffset={-acc}
                        className={s.id === 'other' ? 'demo__seg demo__seg--other' : 'demo__seg'}
                        style={s.id === 'other' ? undefined : { opacity: 1 - i * 0.13 }}
                      />
                    );
                    acc += dash;
                    return seg;
                  })}
                </g>
                <text x="90" y="86" className="demo__donut-total">{formatNumber(pieTotal)}</text>
                <text x="90" y="104" className="demo__donut-label">
                  {METRICS.find((m) => m.key === metric)?.label}
                </text>
              </svg>
            </div>

            <div className="demo__legend">
              {slices.map((s, i) => {
                const pct = Math.round((Number(s.count || 0) / pieTotal) * 100);
                return (
                  <div className="demo__legend-row" key={s.id}>
                    <span
                      className={`demo__swatch ${s.id === 'other' ? 'demo__swatch--other' : ''}`}
                      style={s.id === 'other' ? undefined : { opacity: 1 - i * 0.13 }}
                    />
                    <span className="demo__legend-name">{s.name}</span>
                    <strong>{formatNumber(s.count)}</strong>
                    <small>{pct}%</small>
                  </div>
                );
              })}
              <p className="demo__basis">{BASIS_NOTE[metric]}</p>
            </div>
          </div>
        )
      )}

{/* ================== TAB 2: TERRITORY EXPLORER ================== */}
      {tab === 'map' && (
        terLoading ? (
          <div className="demo__state">
            <div className="demo__spinner" aria-hidden="true" />
            <p>Loading territory…</p>
          </div>
        ) : terError ? (
          <div className="demo__state demo__state--error">
            <p>{terError}</p>
            <button
              type="button"
              onClick={() =>
                fetchTerritory(artistId, period, stack.length ? stack[stack.length - 1].id : null)
              }
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* ★ drill control at the TOP — replaces the bottom chip grid */}
            <div className="demo__explorer-bar">
              {stack.length > 0 && (
                <button type="button" className="demo__back" onClick={goBack}>
                  <ArrowLeft size={13} /> Back
                </button>
              )}

              <div className="demo__explorer-select">
                <ScrollSelect
                  ariaLabel="Choose a sub-territory"
                  value={currentName}
                  placeholder={currentName}
                  visibleRows={3}
                  options={[
                    { value: currentName, label: `${currentName} (current)` },
                    ...children.map((c) => ({
                      value: c.id,
                      label: c.name,
                      trailing: c.hasChildren ? (
                        <ChevronRight size={13} className="demo__opt-chevron" />
                      ) : null,
                    })),
                  ]}
                  onChange={(val) => {
                    if (val === currentName) return; // re-selected current → no-op
                    const child = children.find((c) => c.id === val);
                    if (child) drillInto(child);
                  }}
                />
              </div>
            </div>

            {/* breadcrumb trail for orientation */}
            <div className="demo__crumbs">
              <button
                type="button"
                className="demo__crumb"
                onClick={() => jumpTo(-1)}
                disabled={stack.length === 0}
              >
                {stack.length === 0 ? currentName : 'Unis'}
              </button>
              {stack.map((s, i) => (
                <React.Fragment key={s.id}>
                  <ChevronRight size={12} />
                  <button
                    type="button"
                    className="demo__crumb"
                    onClick={() => jumpTo(i)}
                    disabled={i === stack.length - 1}
                  >
                    {s.name}
                  </button>
                </React.Fragment>
              ))}
            </div>

            <div className="demo__stats">
              {STAT_DEFS.map(({ key, label, icon: Icon }) => (
                <div className="demo__stat" key={key}>
                  <Icon size={16} />
                  <strong>{formatNumber(stats[key])}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {children.length === 0 && (
              <p className="demo__leaf-note">
                This is the most local level — no smaller territories inside {currentName}.
              </p>
            )}
          </>
        )
      )}
       </section>
  );
};

export default DemographicsSection;