import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, DollarSign, ShoppingBag, TrendingUp } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import useDominantColor from './hooks/useDominantColor';
import './songSalesModal.scss';

const money = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

const parseDay = (s) => {
  if (!s) return null;
  const [y, m, d] = String(s).split('-');
  return new Date(Number(y), Number(m) - 1, Number(d));
};

const shortDate = (s) => {
  const d = parseDay(s);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ---------------------------------------------------------------------------
// Cumulative net-revenue area chart. Hand-rolled SVG (no chart dependency),
// uniform scaling so the HTML hover tooltip maps exactly to point positions.
// ---------------------------------------------------------------------------
const SalesChart = ({ series }) => {
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);

  const points = useMemo(() => {
    let cum = 0;
    return (series || []).map((d) => {
      const net = Number(d.net_cents || 0) / 100;
      cum += net;
      return {
        dayLabel: shortDate(d.day),
        net,
        cumulative: cum,
        copies: Number(d.copies || 0),
      };
    });
  }, [series]);

  if (points.length === 0) {
    return (
      <div className="songsales-chart-empty">
        <TrendingUp size={22} />
        <p>No sales yet. When this track sells, your revenue trend appears here.</p>
      </div>
    );
  }

  const W = 640;
  const H = 260;
  const padL = 14;
  const padR = 14;
  const padT = 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const n = points.length;
  const maxVal = Math.max(...points.map((p) => p.cumulative), 1);

  const xAt = (i) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const yAt = (v) => padT + plotH - (v / maxVal) * plotH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.cumulative).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${xAt(n - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xAt(0).toFixed(
    1
  )} ${(padT + plotH).toFixed(1)} Z`;

  const handleMove = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(ratio * (n - 1));
    setHover(idx);
  };

  return (
    <div
      className="songsales-chart"
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Net revenue over time">
        <defs>
          <linearGradient id="songsales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--unis-primary)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--unis-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline */}
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="var(--unis-border)" strokeWidth="1" />

        <path d={areaPath} fill="url(#songsales-fill)" />
        <path d={linePath} fill="none" stroke="var(--unis-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && points[hover] && (
          <>
            <line
              x1={xAt(hover)}
              y1={padT}
              x2={xAt(hover)}
              y2={padT + plotH}
              stroke="var(--unis-border-hi)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle cx={xAt(hover)} cy={yAt(points[hover].cumulative)} r="5" fill="var(--unis-primary)" stroke="#fff" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* y-axis max / min */}
      <span className="songsales-chart__ymax">{money(maxVal * 100)}</span>
      <span className="songsales-chart__ymin">$0</span>

      {/* x-axis first / last */}
      <span className="songsales-chart__xstart">{points[0].dayLabel}</span>
      <span className="songsales-chart__xend">{points[n - 1].dayLabel}</span>

      {/* hover tooltip (HTML, positioned by point fraction) */}
      {hover !== null && points[hover] && (
        <div
          className="songsales-chart__tip"
          style={{
            left: `${(xAt(hover) / W) * 100}%`,
            top: `${(yAt(points[hover].cumulative) / H) * 100}%`,
          }}
        >
          <strong>{money(points[hover].cumulative * 100)}</strong>
          <span>{points[hover].dayLabel}</span>
          <small>
            {points[hover].copies} {points[hover].copies === 1 ? 'sale' : 'sales'} that day
          </small>
        </div>
      )}
    </div>
  );
};

const SongSalesModal = ({ show, onClose, artistId, song }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const songId = song?.songId || song?.id;
  const artworkUrl = buildUrl(song?.artworkUrl) || null;
  const rgb = useDominantColor(artworkUrl);

  const ambientStyle = rgb
    ? {
        backgroundImage: `linear-gradient(160deg, rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.42), rgba(8,8,12,0.92) 62%), var(--unis-panel)`,
      }
    : undefined;

  const fetchSales = useCallback(async () => {
    if (!artistId || !songId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiCall({
        url: `/v1/artist-analytics/artist/${artistId}/song/${songId}/sales`,
        method: 'get',
        useCache: false,
      });
      setData(res.data || null);
    } catch (err) {
      console.error('Song sales fetch failed:', err);
      setError('Could not load this song\u2019s sales.');
    } finally {
      setLoading(false);
    }
  }, [artistId, songId]);

  useEffect(() => {
    if (show) fetchSales();
  }, [show, fetchSales]);

  if (!show) return null;

  const copies = Number(data?.copies || 0);
  const grossCents = Number(data?.grossCents || 0);
  const netCents = Number(data?.netCents || 0);
  const series = data?.series || [];

  return (
    <div className="songsales-overlay" onClick={onClose}>
      <div
        className="songsales-modal"
        style={ambientStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Sales for ${song?.title || 'song'}`}
      >
        <button type="button" className="songsales-close" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>

        <div className="songsales-head">
          {artworkUrl && (
            <img className="songsales-artwork" src={artworkUrl} alt={`${song?.title || 'Song'} artwork`} />
          )}
          <div>
            <span className="artist-section__eyebrow">Sales</span>
            <h2>
              {song?.title || 'Song'} <em>revenue</em>
            </h2>
          </div>
        </div>

        {loading ? (
          <div className="songsales-state">
            <div className="songsales-spinner" aria-hidden="true" />
            <p>Loading sales…</p>
          </div>
        ) : error ? (
          <div className="songsales-state songsales-state--error">
            <p>{error}</p>
            <button type="button" onClick={fetchSales}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="songsales-summary">
              <div className="songsales-stat">
                <div className="songsales-stat__icon"><ShoppingBag size={18} /></div>
                <span>Copies sold</span>
                <strong>{copies.toLocaleString()}</strong>
              </div>
              <div className="songsales-stat">
                <div className="songsales-stat__icon"><DollarSign size={18} /></div>
                <span>Gross sales</span>
                <strong>{money(grossCents)}</strong>
              </div>
              <div className="songsales-stat songsales-stat--primary">
                <div className="songsales-stat__icon"><TrendingUp size={18} /></div>
                <span>Your cut</span>
                <strong>{money(netCents)}</strong>
              </div>
            </div>

            <div className="songsales-chart-card">
              <div className="songsales-chart-card__head">
                <span className="artist-section__eyebrow">Over time</span>
                <h3>Cumulative net revenue</h3>
              </div>
              <SalesChart series={series} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SongSalesModal;