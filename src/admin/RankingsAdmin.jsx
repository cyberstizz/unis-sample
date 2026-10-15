// ─────────────────────────────────────────────────────────────────────────────
// Admin → Rankings & Sunday email   (/admin/rankings, admin + super admin)
//
// Top-ranked artists (or songs) in every live jurisdiction side by side —
// Unis, Harlem, Uptown Harlem, Downtown Harlem — from the same standings
// endpoint the app uses, so what an admin sees here is exactly what users see.
// Each panel shows the full breakdown (points, votes, plays, likes) so a
// surprising rank can be explained at a glance.
//
// Below the boards: the Sunday email. Preview builds this week's email from
// live standings (as you, or as any user ID); "Send me a test" delivers it to
// your own inbox.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../layout';
import { apiCall } from '../components/axiosInstance';
import { JURISDICTION_IDS } from '../utils/idMappings';
import { PERIODS, fetchStandings, describeBoard, formatCount } from '../utils/standings';
import RankMove from '../components/RankMove';
import './metrics/metricsPage.scss';
import './rankingsAdmin.scss';

const PAGE = 10;

const TYPES = [
  { key: 'artist', label: 'Artists' },
  { key: 'song', label: 'Songs' },
];

const GENRES = [
  { key: 'all', label: 'All genres' },
  { key: 'rap', label: 'Rap' },
  { key: 'rock', label: 'Rock' },
  { key: 'pop', label: 'Pop' },
];

// The jurisdictions open today, widest first. Unis's ID is looked up at load
// (it isn't in idMappings); the rest are fixed.
const LOCAL_PLACES = [
  { key: 'harlem', name: 'Harlem', id: JURISDICTION_IDS.harlem },
  { key: 'uptown-harlem', name: 'Uptown Harlem', id: JURISDICTION_IDS['uptown-harlem'] },
  { key: 'downtown-harlem', name: 'Downtown Harlem', id: JURISDICTION_IDS['downtown-harlem'] },
];

// ── One jurisdiction's board ────────────────────────────────────────────────

const Board = ({ place, type, period, genre, refreshKey }) => {
  const [board, setBoard] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchStandings({ type, jurisdictionId: place.id, genre, period, limit: PAGE, offset: 0 })
      .then((b) => {
        if (cancelled) return;
        setBoard(b);
        setEntries(b.entries);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(`[RankingsAdmin] ${place.name} board failed:`, err?.message || err);
        setError('Could not load this board.');
        setBoard(null);
        setEntries([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [place.id, place.name, type, period, genre, refreshKey]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const b = await fetchStandings({ type, jurisdictionId: place.id, genre, period, limit: PAGE, offset: entries.length });
      setEntries((prev) => [...prev, ...b.entries]);
    } catch (err) {
      console.error(`[RankingsAdmin] ${place.name} more failed:`, err?.message || err);
    } finally {
      setLoadingMore(false);
    }
  };

  const status = board ? describeBoard(board) : null;
  const scored = entries.filter((e) => e.points > 0);
  // Boards are ordered by points, so once a page holds a zero-point entry
  // (or the whole race is loaded) every scorer is already on screen.
  const allScoredLoaded = !!board && (entries.length > scored.length || entries.length >= board.total);
  const chartHref = place.key
    ? `/charts?type=${type}&period=${period}&genre=${genre}&place=${place.key}`
    : null;

  return (
    <section className="rka-board" aria-busy={loading}>
      <header className="rka-board__head">
        <div>
          <h2>{place.name}</h2>
          {status && (
            <p className={`rka-pill rka-pill--${status.tone}`}>{status.title}</p>
          )}
        </div>
        {chartHref && <Link className="rka-link" to={chartHref}>Open chart</Link>}
      </header>
      {status?.detail && <p className="rka-board__detail">{status.detail}</p>}

      {loading && <p className="mx-empty">Loading…</p>}
      {!loading && error && <p className="mx-error">{error}</p>}
      {!loading && !error && scored.length === 0 && (
        <p className="mx-empty">Nobody has scored yet.</p>
      )}

      {!loading && !error && scored.length > 0 && (
        <table className="rka-table">
          <thead>
            <tr>
              <th scope="col" className="num">#</th>
              <th scope="col">{type === 'artist' ? 'Artist' : 'Song'}</th>
              <th scope="col" className="num">Points</th>
              <th scope="col" className="num">Votes</th>
              <th scope="col" className="num">Plays</th>
              <th scope="col" className="num">Likes</th>
            </tr>
          </thead>
          <tbody>
            {scored.map((e) => (
              <tr key={e.id} className={e.rank === 1 ? 'is-first' : ''}>
                <td className="num rka-rank">{e.rank}</td>
                <td>
                  <div className="rka-who">
                    <span className="rka-thumb" data-shape={type}>
                      {e.artwork ? <img src={e.artwork} alt="" loading="lazy" /> : (e.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="rka-names">
                      <Link to={type === 'artist' ? `/artist/${e.id}` : `/song/${e.id}`}>{e.name}</Link>
                      {type === 'song' && e.artistName && <span className="rka-sub">{e.artistName}</span>}
                      {e.homeJurisdictionName && e.homeJurisdictionId !== place.id && (
                        <span className="rka-sub">{e.homeJurisdictionName}</span>
                      )}
                    </span>
                    <RankMove movement={e.movement} isNew={e.isNew} />
                    {e.winner && <span className="rka-win">Winner</span>}
                  </div>
                </td>
                <td className="num rka-points">{formatCount(e.points)}</td>
                <td className="num">{formatCount(e.votes)}</td>
                <td className="num">{formatCount(e.plays)}</td>
                <td className="num">{formatCount(e.likes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && board && (
        <footer className="rka-board__foot">
          <span>
            {allScoredLoaded
              ? `${formatCount(scored.length)} scored · ${formatCount(board.total - scored.length)} with no points yet`
              : `Top ${formatCount(scored.length)} of ${formatCount(board.total)} in the race`}
          </span>
          {!allScoredLoaded && (
            <button type="button" className="mx-btn mx-btn--ghost" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : `Show ${PAGE} more`}
            </button>
          )}
        </footer>
      )}
    </section>
  );
};

// ── The Sunday email ────────────────────────────────────────────────────────

const SundayEmail = () => {
  const [asUserId, setAsUserId] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);

  const loadPreview = async () => {
    setBusy('preview');
    setMessage(null);
    try {
      const id = asUserId.trim();
      const res = await apiCall({
        method: 'get',
        url: `/v1/admin/digest/preview${id ? `?asUserId=${encodeURIComponent(id)}` : ''}`,
        useCache: false,
      });
      setPreview(res.data);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Could not build the preview.';
      setMessage({ tone: 'bad', text: msg });
      setPreview(null);
    } finally {
      setBusy('');
    }
  };

  const sendTest = async () => {
    setBusy('send');
    setMessage(null);
    try {
      const res = await apiCall({ method: 'post', url: '/v1/admin/digest/send-test' });
      setMessage({ tone: 'good', text: `Sent to ${res.data?.sentTo}. It can take a minute to arrive.` });
    } catch (err) {
      const msg = err?.response?.data?.error || 'The test email could not be sent.';
      setMessage({ tone: 'bad', text: msg });
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="rka-email">
      <header className="rka-email__head">
        <div>
          <h2>Sunday email</h2>
          <p>
            Goes out Sundays at 13:00 UTC (9 AM New York in summer, 8 AM in winter) to everyone
            with email notifications on and a confirmed email. Built from the live weekly standings.
          </p>
        </div>
      </header>

      <div className="mx-controls">
        <label className="mx-select">
          <span>Preview as user ID (optional)</span>
          <input
            type="text"
            value={asUserId}
            onChange={(e) => setAsUserId(e.target.value)}
            placeholder="Leave empty to preview as you"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <button type="button" className="mx-btn" onClick={loadPreview} disabled={busy !== ''}>
          {busy === 'preview' ? 'Building…' : 'Preview'}
        </button>
        <button type="button" className="mx-btn mx-btn--ghost" onClick={sendTest} disabled={busy !== ''}>
          {busy === 'send' ? 'Sending…' : 'Send me a test'}
        </button>
      </div>

      {message && <p className={`rka-msg rka-msg--${message.tone}`} role="status">{message.text}</p>}

      {preview && (
        <div className="rka-inbox">
          <div className="rka-inbox__meta">
            <span className="rka-inbox__from">Unis</span>
            <span className="rka-inbox__subject">{preview.subject}</span>
            <span className="rka-inbox__pre">{preview.preheader}</span>
            <span className="rka-inbox__to">For {preview.recipient}</span>
          </div>
          <iframe
            className="rka-inbox__frame"
            title={`Sunday email preview for ${preview.recipient}`}
            srcDoc={preview.html}
            sandbox=""
          />
        </div>
      )}
    </section>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

const RankingsAdmin = () => {
  const navigate = useNavigate();
  const [type, setType] = useState('artist');
  const [period, setPeriod] = useState('weekly');
  const [genre, setGenre] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [unis, setUnis] = useState(null);

  // Unis (the root) isn't in idMappings; Harlem's breadcrumb starts with it.
  useEffect(() => {
    apiCall({ method: 'get', url: `/v1/jurisdictions/${JURISDICTION_IDS.harlem}/breadcrumb` })
      .then((res) => {
        const chain = Array.isArray(res.data) ? res.data : [];
        const root = chain.find((j) => j?.name === 'Unis') || chain[0];
        if (root?.jurisdictionId) setUnis({ key: null, name: root.name || 'Unis', id: root.jurisdictionId });
      })
      .catch((err) => console.error('[RankingsAdmin] Unis lookup failed:', err?.message || err));
  }, []);

  const places = useMemo(() => (unis ? [unis, ...LOCAL_PLACES] : LOCAL_PLACES), [unis]);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <Layout>
      <div className="admin-page mx rka">
        <button className="mx-back" onClick={() => navigate('/admin')}>← Admin dashboard</button>
        <header className="mx-head">
          <div>
            <h1>Rankings</h1>
            <p className="mx-head__sub">
              Live standings in every open jurisdiction: the same numbers users see and the same
              formula that decides awards (vote points + plays + 5 × likes).
            </p>
          </div>
          <button className="mx-btn mx-btn--ghost" onClick={refresh}>Refresh</button>
        </header>

        <div className="mx-controls">
          <div className="mx-seg" role="group" aria-label="Type">
            {TYPES.map((t) => (
              <button key={t.key} type="button" aria-pressed={type === t.key}
                className={type === t.key ? 'is-on' : ''} onClick={() => setType(t.key)}>{t.label}</button>
            ))}
          </div>
          <div className="mx-seg" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p.key} type="button" aria-pressed={period === p.key}
                className={period === p.key ? 'is-on' : ''} onClick={() => setPeriod(p.key)}>{p.label}</button>
            ))}
          </div>
          <label className="mx-select">
            <span>Genre</span>
            <select value={genre} onChange={(e) => setGenre(e.target.value)}>
              {GENRES.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </label>
        </div>

        <div className="rka-grid">
          {places.map((p) => (
            <Board key={p.id} place={p} type={type} period={period} genre={genre} refreshKey={refreshKey} />
          ))}
        </div>

        <SundayEmail />
      </div>
    </Layout>
  );
};

export default RankingsAdmin;
