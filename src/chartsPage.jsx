import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from './layout';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import { JURISDICTION_IDS, JURISDICTION_NAMES } from './utils/idMappings';
import RankMove from './components/RankMove';
import {
  PERIODS,
  periodByKey,
  fetchStandings,
  describeBoard,
  formatCount,
  playEntry,
} from './utils/standings';
import './chartsPage.scss';

// ─────────────────────────────────────────────────────────────────────────────
// CHARTS — the long list.
//
// Inspired by SoundClick's charts: one dense, ranked list that keeps loading.
// What this version changes:
//   • The list starts on the first screen. The only hero is the chart's own
//     #1, shown as a feature row with its lead over #2.
//   • Each row reads left to right once: rank and movement, the entry, why
//     it's there (votes, plays, likes), points, play.
//   • Filters are always visible, so the board you're looking at is never a
//     mystery.
//   • The song that's playing lights up in the list.
//   • Entries with no points this period sit below a divider — still
//     browsable, but not dressed up as ranked.
//
// Ranking comes from /v1/awards/standings (utils/standings.js): the same
// formula that decides awards, with the midnight rule. This page never counts
// plays — requestPlay hands the song to the Player, which does.
//
// Deep links: /charts?type=artist&period=weekly&genre=rap&place=uptown-harlem
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

const TYPES = [
  { key: 'song', label: 'Songs' },
  { key: 'artist', label: 'Artists' },
];

const GENRES = [
  { key: 'all', label: 'All genres' },
  { key: 'rap', label: 'Rap' },
  { key: 'rock', label: 'Rock' },
  { key: 'pop', label: 'Pop' },
];

// The jurisdictions open today. Harlem includes Uptown and Downtown.
const PLACES = [
  { key: 'harlem', label: 'Harlem' },
  { key: 'uptown-harlem', label: 'Uptown Harlem' },
  { key: 'downtown-harlem', label: 'Downtown Harlem' },
];

const pick = (list, value, fallback) =>
  (list.some((o) => o.key === value) ? value : fallback);

// ── Small pieces ────────────────────────────────────────────────────────────

const Segmented = ({ label, options, value, onChange }) => (
  <div className="ch-seg" role="group" aria-label={label}>
    {options.map((o) => (
      <button
        key={o.key}
        type="button"
        className={`ch-seg-btn${o.key === value ? ' is-active' : ''}`}
        aria-pressed={o.key === value}
        onClick={() => onChange(o.key)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const PlayGlyph = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
);

const PauseGlyph = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
  </svg>
);

const Equalizer = () => (
  <span className="ch-eq" aria-hidden="true">
    <i /><i /><i />
  </span>
);

const Art = ({ src, label, className }) => {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className={`${className} ch-art--none`} aria-hidden="true">
        {(label || '?').trim().charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img src={src} alt="" className={className} loading="lazy" onError={() => setBroken(true)} />
  );
};

/** "12 votes · 340 plays · 4 likes", leaving out what's zero. */
const reasonLine = (e) => {
  const parts = [];
  if (e.votes) parts.push(`${formatCount(e.votes)} vote${e.votes === 1 ? '' : 's'}`);
  if (e.plays) parts.push(`${formatCount(e.plays)} play${e.plays === 1 ? '' : 's'}`);
  if (e.likes) parts.push(`${formatCount(e.likes)} like${e.likes === 1 ? '' : 's'}`);
  return parts.join(' · ');
};

// ── Page ────────────────────────────────────────────────────────────────────

const ChartsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { requestPlay, currentMedia, isPlaying, togglePlayPause } = useContext(PlayerContext);
  const [params, setParams] = useSearchParams();

  const homeKey = JURISDICTION_NAMES[user?.jurisdiction?.jurisdictionId];
  const type = pick(TYPES, params.get('type'), 'song');
  const period = PERIODS.some((p) => p.key === params.get('period')) ? params.get('period') : 'weekly';
  const genre = pick(GENRES, params.get('genre'), 'all');
  const place = pick(PLACES, params.get('place'), pick(PLACES, homeKey, 'harlem'));
  const jurisdictionId = JURISDICTION_IDS[place];
  const placeLabel = PLACES.find((p) => p.key === place)?.label || 'Harlem';

  const setFilter = useCallback((key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next, { replace: true, state: { preserveScroll: true } });
  }, [params, setParams]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [board, setBoard] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [moreFailed, setMoreFailed] = useState(false);
  const requestRef = useRef(0);

  const loadFirst = useCallback(async () => {
    const id = ++requestRef.current;
    setLoading(true);
    setError(null);
    setMoreFailed(false);
    setEntries([]);
    setBoard(null);
    try {
      const b = await fetchStandings({ type, jurisdictionId, genre, period, limit: PAGE_SIZE, offset: 0 });
      if (id !== requestRef.current) return;
      setBoard(b);
      setEntries(b.entries);
    } catch (err) {
      if (id !== requestRef.current) return;
      console.error('[Charts] load failed:', err?.message || err);
      setError("The chart didn't load. Check your connection and try again.");
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }, [type, jurisdictionId, genre, period]);

  useEffect(() => { loadFirst(); }, [loadFirst]);

  const hasMore = !!board && entries.length < board.total;

  const loadMore = useCallback(async (force = false) => {
    if (loading || loadingMore || (moreFailed && !force) || !board || entries.length >= board.total) return;
    setMoreFailed(false);
    const id = requestRef.current;
    setLoadingMore(true);
    try {
      const b = await fetchStandings({
        type, jurisdictionId, genre, period, limit: PAGE_SIZE, offset: entries.length,
      });
      if (id !== requestRef.current) return;
      // A period closed between pages (midnight) — start again from the top.
      if (b.state !== board.state || b.periodStart !== board.periodStart) {
        loadFirst();
        return;
      }
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...b.entries.filter((e) => !seen.has(e.id))];
      });
      setBoard((prev) => ({ ...prev, total: b.total }));
    } catch (err) {
      if (id !== requestRef.current) return;
      console.error('[Charts] next page failed:', err?.message || err);
      setMoreFailed(true);
    } finally {
      if (id === requestRef.current) setLoadingMore(false);
    }
  }, [loading, loadingMore, moreFailed, board, entries.length, type, jurisdictionId, genre, period, loadFirst]);

  // Keep loading as the end of the list comes into view.
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (items) => { if (items[0]?.isIntersecting) loadMore(); },
      { rootMargin: '800px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // ── Back to top ───────────────────────────────────────────────────────────
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 1200);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Playing ───────────────────────────────────────────────────────────────
  const playingSongId = currentMedia?.songId || currentMedia?.id || null;
  const isCurrent = (e) => (e.type === 'song'
    ? !!playingSongId && e.id === playingSongId
    : !!currentMedia?.artistId && e.id === currentMedia.artistId);

  const handlePlay = async (e) => {
    if (isCurrent(e)) {
      togglePlayPause();
      return;
    }
    await playEntry(e, requestPlay, 'charts');
  };

  const openEntry = (e) => navigate(e.type === 'artist' ? `/artist/${e.id}` : `/song/${e.id}`);
  const openArtist = (e) => { if (e.artistId) navigate(`/artist/${e.artistId}`); };

  // ── Derived ───────────────────────────────────────────────────────────────
  const status = board ? describeBoard(board) : null;
  const shownPeriod = periodByKey(board?.periodKey || period);
  const periodPhrase = board?.state === 'LIVE' ? shownPeriod.current : shownPeriod.previous.toLowerCase();

  const lead = entries[0] && entries[0].points > 0 ? entries[0] : null;
  const runnerUp = entries[1] || null;
  const rows = lead ? entries.slice(1) : entries;
  const firstUnscored = rows.findIndex((e) => e.points === 0);

  let leadLine = null;
  if (lead) {
    if (!runnerUp || runnerUp.points === 0) leadLine = 'Nobody else has scored yet';
    else if (runnerUp.points === lead.points) leadLine = `Tied with ${runnerUp.name}, ahead on the tiebreak`;
    else {
      const gap = lead.points - runnerUp.points;
      leadLine = `Ahead by ${formatCount(gap)} point${gap === 1 ? '' : 's'}`;
    }
  }
  const leadKicker = board?.state === 'PREVIOUS_FINAL'
    ? (lead?.winner ? 'Won' : 'Finished first')
    : board?.state === 'PREVIOUS_CLOSING' ? 'Leading, still counting' : 'Number one right now';

  const noun = type === 'artist' ? 'artist' : 'song';

  const renderPlayButton = (e, big = false) => {
    const current = isCurrent(e);
    return (
      <button
        type="button"
        className={`ch-play${big ? ' ch-play--big' : ''}${current ? ' is-current' : ''}`}
        onClick={() => handlePlay(e)}
        aria-label={current && isPlaying ? `Pause ${e.name}` : `Play ${e.name}`}
      >
        {current && isPlaying ? (big ? <PauseGlyph /> : <Equalizer />) : <PlayGlyph />}
        {big && <span>{current && isPlaying ? 'Pause' : 'Play'}</span>}
      </button>
    );
  };

  return (
    <Layout>
      <div className="ch-page">
        {/* ── Title and status ───────────────────────────────────────────── */}
        <header className="ch-head">
          <h1 className="ch-title">{placeLabel} charts</h1>
          {status && (
            <p className={`ch-status ch-status--${status.tone}`} role="status">
              <span className="ch-status-dot" aria-hidden="true" />
              <strong>{status.title}.</strong>
              {status.detail && <span> {status.detail}</span>}
            </p>
          )}
        </header>

        {/* ── Filters, always visible ────────────────────────────────────── */}
        <div className="ch-controls">
          <Segmented label="Show" options={TYPES} value={type} onChange={(v) => setFilter('type', v)} />
          <Segmented
            label="Period"
            options={PERIODS.map((p) => ({ key: p.key, label: p.label }))}
            value={period}
            onChange={(v) => setFilter('period', v)}
          />
          <Segmented label="Genre" options={GENRES} value={genre} onChange={(v) => setFilter('genre', v)} />
          <label className="ch-place">
            <span className="ch-sr">Place</span>
            <select value={place} onChange={(ev) => setFilter('place', ev.target.value)}>
              {PLACES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        {loading ? (
          <ol className="ch-list" aria-busy="true" aria-label="Loading the chart">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="ch-row is-skeleton" aria-hidden="true">
                <span className="ch-rank" /><span className="ch-art" /><span className="ch-main" />
              </li>
            ))}
          </ol>
        ) : error ? (
          <div className="ch-empty" role="alert">
            <p>{error}</p>
            <button type="button" className="ch-btn" onClick={loadFirst}>Try again</button>
          </div>
        ) : entries.length === 0 ? (
          <div className="ch-empty">
            <p>No {genre === 'all' ? '' : `${GENRES.find((g) => g.key === genre)?.label} `}{noun}s in {placeLabel} yet.</p>
            <button type="button" className="ch-btn" onClick={() => navigate('/discover')}>Explore Discover</button>
          </div>
        ) : (
          <>
            {/* The chart's own #1 is the only hero. */}
            {lead && (
              <section className="ch-lead" aria-label={`Number one: ${lead.name}`}>
                {lead.artwork && (
                  <div className="ch-lead-glow" aria-hidden="true" style={{ backgroundImage: `url(${lead.artwork})` }} />
                )}
                <div className="ch-lead-rank">
                  <span className="ch-lead-num">{lead.rank}</span>
                  <RankMove movement={lead.movement} isNew={lead.isNew} />
                </div>
                <button type="button" className="ch-lead-art-btn" onClick={() => openEntry(lead)} aria-label={`Open ${lead.name}`}>
                  <Art src={lead.artwork} label={lead.name} className="ch-lead-art" />
                </button>
                <div className="ch-lead-body">
                  <p className="ch-lead-kicker">{leadKicker}</p>
                  <button type="button" className="ch-lead-name" onClick={() => openEntry(lead)}>{lead.name}</button>
                  {lead.type === 'song' && lead.artistName && (
                    <button type="button" className="ch-lead-artist" onClick={() => openArtist(lead)}>{lead.artistName}</button>
                  )}
                  <p className="ch-lead-meta">{reasonLine(lead)}</p>
                </div>
                <div className="ch-lead-side">
                  <p className="ch-lead-points">
                    <strong>{formatCount(lead.points)}</strong>
                    <span>points</span>
                  </p>
                  <p className="ch-lead-gap">{leadLine}</p>
                  {renderPlayButton(lead, true)}
                </div>
              </section>
            )}

            {!lead && (
              <p className="ch-note">
                Nothing has scored {periodPhrase} yet. Everyone below is listed by all-time points.
              </p>
            )}

            <ol className="ch-list">
              {rows.map((e, i) => {
                const unscored = e.points === 0;
                const current = isCurrent(e);
                return (
                  <React.Fragment key={e.id}>
                    {lead && i === firstUnscored && (
                      <li className="ch-divider" role="presentation">
                        No points {periodPhrase} yet, listed by all-time points
                      </li>
                    )}
                    <li className={`ch-row${e.rank <= 3 ? ' is-top' : ''}${unscored ? ' is-unscored' : ''}${current ? ' is-current' : ''}`}>
                      <div className="ch-rank">
                        <span className="ch-rank-num">{e.rank}</span>
                        {!unscored && <RankMove movement={e.movement} isNew={e.isNew} />}
                      </div>

                      <button type="button" className="ch-art-btn" onClick={() => openEntry(e)} tabIndex={-1} aria-hidden="true">
                        <Art src={e.artwork} label={e.name} className="ch-art" />
                      </button>

                      <div className="ch-main">
                        <button type="button" className="ch-name" onClick={() => openEntry(e)}>
                          {e.name}
                          {e.winner && <span className="ch-won">Won</span>}
                        </button>
                        {e.type === 'song' && e.artistName && (
                          <button type="button" className="ch-artist" onClick={() => openArtist(e)}>{e.artistName}</button>
                        )}
                        {!unscored && <span className="ch-reason">{reasonLine(e)}</span>}
                      </div>

                      <p className="ch-points">
                        {unscored ? <span className="ch-points-none">—</span> : (
                          <>
                            <strong>{formatCount(e.points)}</strong>
                            <span>pts</span>
                          </>
                        )}
                      </p>

                      {renderPlayButton(e)}
                    </li>
                  </React.Fragment>
                );
              })}
            </ol>

            <div ref={sentinelRef} className="ch-sentinel" aria-hidden="true" />

            <footer className="ch-foot">
              <p>
                Showing {formatCount(entries.length)} of {formatCount(board?.total || entries.length)} {noun}{(board?.total || entries.length) === 1 ? '' : 's'}
              </p>
              {hasMore && (
                <button
                  type="button"
                  className="ch-btn"
                  onClick={() => loadMore(true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : moreFailed ? 'Try loading more again' : 'Load more'}
                </button>
              )}
            </footer>
          </>
        )}

        <button
          type="button"
          className={`ch-top${showTop ? ' is-visible' : ''}`}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-hidden={!showTop}
          tabIndex={showTop ? 0 : -1}
        >
          Back to top
        </button>
      </div>
    </Layout>
  );
};

export default ChartsPage;
