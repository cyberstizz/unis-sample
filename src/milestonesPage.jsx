// ============================================================================
// MilestonesPage.jsx — the Unis award archive.
//
// One job: pull up a closed award period and show who took it, with receipts.
//
// PERIOD SAFETY (see utils/periodBounds.js for the full rationale)
//   The backend auto-populates a missing Award on read. Requesting an open
//   period therefore PERSISTS a winner computed from partial data and locks
//   the real cron out of ever recomputing it. Three layers stop that here:
//     1. maxDate is the end of the last CLOSED period, per interval.
//     2. Changing interval re-clamps the selected date (the old cross-interval
//        leak: pick yesterday on Daily, switch to Annual, get the current year).
//     3. handleView refuses to fire for an open period even if 1 and 2 are
//        bypassed. The backend has its own guard as the real authority.
//
// COMPONENT SCOPE
//   Every sub-component lives at module scope. Declaring them inside the page
//   body gives them a fresh identity each render, so React unmounts and
//   remounts whole subtrees on every keystroke — it looks like a page refresh.
// ============================================================================

import React, { useState, useMemo, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import './milestonesPage.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import rapperOne from './assets/rapperphotoOne.jpg';
import songArtFour from './assets/songartworkfour.jpeg';
import { buildUrl } from './utils/buildUrl';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';
import IntervalDatePicker from './intervalDatePicker';
import './intervalDatePicker.scss';
import {
  getPeriodRange,
  isPeriodComplete,
  getLastCompletedPeriodEnd,
  clampToCompletedPeriod,
  formatPeriodLabel,
  formatPeriodRange,
  getPeriodCloseLabel,
} from './utils/periodBounds';

const LOG = '[Milestones]';
const MIN_DATE = '2025-10-26';

const JURISDICTIONS = [
  { value: 'downtown-harlem', label: 'Downtown' },
  { value: 'uptown-harlem', label: 'Uptown' },
  { value: 'harlem', label: 'All Harlem' },
];

const GENRES = [
  { value: 'rap', label: 'Rap' },
  { value: 'rock', label: 'Rock' },
  { value: 'pop', label: 'Pop' },
];

const CATEGORIES = [
  { value: 'song', label: 'Songs' },
  { value: 'artist', label: 'Artists' },
];

const INTERVAL_OPTIONS = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'quarterly', label: 'Quarter' },
  { value: 'midterm', label: 'Half' },
  { value: 'annual', label: 'Year' },
];

const INTERVAL_TITLE = {
  daily: 'of the Day',
  weekly: 'of the Week',
  monthly: 'of the Month',
  quarterly: 'of the Quarter',
  midterm: 'of the Half',
  annual: 'of the Year',
};

const JURISDICTION_LABEL = {
  'downtown-harlem': 'Downtown Harlem',
  'uptown-harlem': 'Uptown Harlem',
  harlem: 'Harlem',
};

const TIEBREAKERS = {
  PLAYS: (n) => `Tie broken on plays${n ? ` between ${n}` : ''}`,
  LIKES: (n) => `Tie broken on likes${n ? ` between ${n}` : ''}`,
  SCORE: (n) => `Tie broken on lifetime score${n ? ` between ${n}` : ''}`,
  SENIORITY: (n) => `Tie broken on seniority${n ? ` between ${n}` : ''}`,
  FALLBACK: () => 'Decided on engagement — no votes cast',
};

const formatNumber = (n) => (Number(n) || 0).toLocaleString('en-US');

// ─── Segmented control ───────────────────────────────────────────────────────
// Replaces the four native <select> elements. Small option counts read better
// as visible choices than as collapsed dropdowns, and it kills the form feel.
const Segmented = ({ label, options, value, onChange, name }) => (
  <div className="ms-segmented" role="group" aria-label={label}>
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          className={`ms-seg${active ? ' is-active' : ''}`}
          aria-pressed={active}
          onClick={() => onChange(opt.value)}
          data-testid={`${name}-${opt.value}`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

// ─── One row of the tally ────────────────────────────────────────────────────
// Bar width encodes share of the period's points, so margin of victory is
// legible without reading a single number. An entry with no points shows an
// empty points cell rather than a "0" — a blank reads as "nothing scored here",
// where a zero reads as a figure worth comparing. The cell keeps its width so
// rows stay aligned. When nothing in the period scored at all the rail is
// dropped entirely; a row of empty grooves is just noise.
const TallyRow = ({ entry, share, index, onOpen, onPlay, canPlay, showBar }) => {
  const hasPoints = entry.weightedPoints > 0;

  return (
    <li
      className={`ms-tally-row${entry.rank === 1 ? ' is-winner' : ''}`}
      style={{ '--row-delay': `${index * 60}ms` }}
    >
      <span className="ms-tally-rank" aria-hidden="true">{entry.rank}</span>

      <button
        type="button"
        className="ms-tally-main"
        onClick={() => onOpen(entry)}
        aria-label={`Open ${entry.title}${entry.targetType === 'song' ? ` by ${entry.artist}` : ''}, ranked ${entry.rank}`}
      >
        <img className="ms-tally-art" src={entry.artwork} alt="" loading="lazy" />
        <span className="ms-tally-text">
          <span className="ms-tally-title">{entry.title}</span>
          {entry.targetType === 'song' && (
            <span className="ms-tally-artist">{entry.artist}</span>
          )}
        </span>

        {showBar && (
          <span className="ms-tally-bar" aria-hidden="true">
            {hasPoints && <span className="ms-tally-fill" style={{ width: `${share}%` }} />}
          </span>
        )}

        <span className="ms-tally-points">
          {hasPoints && (
            <>
              {formatNumber(entry.weightedPoints)}
              <span className="ms-tally-unit">pts</span>
            </>
          )}
        </span>
      </button>

      {canPlay && (
        <button
          type="button"
          className="ms-tally-play"
          onClick={() => onPlay(entry)}
          aria-label={`Play ${entry.title}`}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </button>
      )}
    </li>
  );
};

// ─── The page ────────────────────────────────────────────────────────────────
const MilestonesPage = () => {
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext) || {};

  // Selection state — changes as the user browses.
  const [jurisdiction, setJurisdiction] = useState('downtown-harlem');
  const [genre, setGenre] = useState('rap');
  const [category, setCategory] = useState('song');
  const [interval, setIntervalState] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(() => getLastCompletedPeriodEnd('daily'));

  // Result state — frozen at the moment of a successful fetch so the headline
  // can never describe a period other than the one on screen.
  const [shown, setShown] = useState(null);
  const [entries, setEntries] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const maxDate = useMemo(() => getLastCompletedPeriodEnd(interval), [interval]);
  const periodOpen = selectedDate ? !isPeriodComplete(selectedDate, interval) : false;

  // Switching interval re-anchors the date. Without this the old selection
  // carries across and silently resolves to an unfinished period.
  const handleIntervalChange = useCallback((next) => {
    setIntervalState(next);
    setSelectedDate((prev) => {
      const clamped = clampToCompletedPeriod(prev, next);
      if (clamped !== prev) {
        console.info(`${LOG} interval → ${next}: re-anchored date ${prev} → ${clamped} (previous selection fell in an open period)`);
      }
      return clamped;
    });
  }, []);

  const handleDateChange = useCallback((next) => {
    setSelectedDate(next);
    if (next) setError(null);
  }, []);

  const jumpToLastClosed = useCallback(() => {
    const end = getLastCompletedPeriodEnd(interval);
    setSelectedDate(end);
    setError(null);
    console.info(`${LOG} jumped to last closed ${interval} period: ${end}`);
  }, [interval]);

  const handleView = useCallback(async () => {
    if (!selectedDate) {
      setError('Pick a period first.');
      return;
    }

    // Layer 3. The picker should never surface an open period, but a stale
    // state or a future code path must not be allowed to trigger a write.
    if (!isPeriodComplete(selectedDate, interval)) {
      console.warn(`${LOG} blocked request for open period: ${interval} ${selectedDate}`);
      setError(null);
      return;
    }

    const jurId = JURISDICTION_IDS[jurisdiction];
    const genreId = GENRE_IDS[genre];
    const intervalId = INTERVAL_IDS[interval];

    if (!jurId || !genreId || !intervalId) {
      console.error(`${LOG} id mapping miss`, { jurisdiction, genre, interval, jurId, genreId, intervalId });
      setError('That combination is not available yet.');
      return;
    }

    const { startDate, endDate } = getPeriodRange(selectedDate, interval);
    setIsLoading(true);
    setError(null);

    try {
      console.info(`${LOG} fetching ${category} ${interval} ${startDate}..${endDate} · ${jurisdiction}/${genre}`);

      const response = await apiCall({
        method: 'get',
        url: `/v1/awards/period-leaderboard?type=${category}&startDate=${startDate}&endDate=${endDate}&jurisdictionId=${jurId}&genreId=${genreId}&intervalId=${intervalId}&limit=5`,
      });

      // Two shapes supported: the current { winner, leaderboard, totalVotes }
      // and a bare Award array from the older /past contract.
      const payload = response.data || {};
      const rows = Array.isArray(payload)
        ? payload
        : payload.leaderboard?.length
          ? payload.leaderboard
          : [payload.winner].filter(Boolean);

      if (!rows.length) {
        console.info(`${LOG} no awards for ${interval} ${startDate}..${endDate}`);
        setEntries([]);
        setTotalVotes(0);
        setShown({ jurisdiction, genre, category, interval, selectedDate, empty: true });
        return;
      }

      const normalized = rows.map((row, i) => {
        const isArtist = (row.targetType || category) === 'artist';
        const fallbackArt = isArtist ? rapperOne : songArtFour;
        const rawArt = isArtist
          ? (row.user?.photoUrl || row.artwork)
          : (row.song?.artworkUrl || row.artwork);

        return {
          rank: row.rank || i + 1,
          id: row.targetId,
          targetType: isArtist ? 'artist' : 'song',
          title: isArtist
            ? (row.user?.username || row.title || 'Unknown artist')
            : (row.song?.title || row.title || 'Unknown song'),
          artist: isArtist
            ? (row.user?.username || row.artist || '')
            : (row.song?.artist?.username || row.artist || 'Unknown artist'),
          artistId: row.artistId || row.song?.artist?.userId || null,
          fileUrl: buildUrl(row.fileUrl || row.song?.fileUrl) || null,
          artwork: buildUrl(rawArt) || fallbackArt,
          votes: Number(row.votes ?? row.votesCount ?? 0),
          weightedPoints: Number(row.weightedPoints || 0),
          playsCount: Number(row.playsCount || 0),
          likesCount: Number(row.likesCount || 0),
          determinationMethod: row.determinationMethod || null,
          tiedCandidatesCount: row.tiedCandidatesCount || 0,
        };
      });

      setEntries(normalized);
      setTotalVotes(
        Array.isArray(payload)
          ? normalized.reduce((sum, e) => sum + e.votes, 0)
          : (payload.totalVotes ?? normalized.reduce((sum, e) => sum + e.votes, 0))
      );
      setShown({ jurisdiction, genre, category, interval, selectedDate, empty: false });
      console.info(`${LOG} loaded ${normalized.length} ${category} entries · winner "${normalized[0].title}"`);
    } catch (err) {
      const status = err?.response?.status;
      console.error(`${LOG} fetch failed (${status || 'network'})`, err);
      setEntries([]);
      setShown(null);
      setError(
        status === 404
          ? 'Nothing was awarded for that period.'
          : 'The archive did not respond. Try again in a moment.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, interval, jurisdiction, genre, category]);

  const openEntry = useCallback((entry) => {
    if (!entry?.id) return;
    navigate(entry.targetType === 'artist' ? `/artist/${entry.id}` : `/song/${entry.id}`);
  }, [navigate]);

  const playEntry = useCallback((entry) => {
    if (!entry?.fileUrl || typeof requestPlay !== 'function') {
      console.warn(`${LOG} play unavailable for "${entry?.title}" — no file url`);
      return;
    }
    console.info(`${LOG} play requested: "${entry.title}"`);
    requestPlay({
      id: entry.id,
      songId: entry.id,
      type: 'song',
      url: entry.fileUrl,
      fileUrl: entry.fileUrl,
      title: entry.title,
      artist: entry.artist,
      artistId: entry.artistId,
      artwork: entry.artwork,
    });
  }, [requestPlay]);

  const winner = entries[0] || null;
  const maxPoints = entries.reduce((m, e) => Math.max(m, e.weightedPoints), 0);
  const tiebreak = winner?.determinationMethod && TIEBREAKERS[winner.determinationMethod]
    ? TIEBREAKERS[winner.determinationMethod](winner.tiedCandidatesCount)
    : null;

  // Only surface figures that actually happened. A column of zeroes invites the
  // reader to compare nothing against nothing; showing three real numbers and
  // omitting the fourth is more honest and reads cleaner.
  const figures = winner
    ? [
        { key: 'points', label: 'Points', value: winner.weightedPoints, lead: true },
        { key: 'votes', label: 'Votes', value: winner.votes },
        { key: 'plays', label: 'Plays', value: winner.playsCount },
        { key: 'likes', label: 'Likes', value: winner.likesCount },
      ].filter((f) => f.value > 0)
    : [];

  return (
    <Layout backgroundImage={backimage}>
      <div className="ms-page">
        <main className="ms-shell">

          <header className="ms-masthead">
            <p className="ms-eyebrow">The record</p>
            <h1 className="ms-wordmark">Milestones</h1>
            <p className="ms-lede">Every closed period, and who took it.</p>
          </header>

          {/* ── Controls ───────────────────────────────────────────────── */}
          <section className="ms-controls" aria-label="Choose an award period">
            <div className="ms-control-row">
              <Segmented name="jurisdiction" label="Jurisdiction" options={JURISDICTIONS} value={jurisdiction} onChange={setJurisdiction} />
              <Segmented name="genre" label="Genre" options={GENRES} value={genre} onChange={setGenre} />
              <Segmented name="category" label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
            </div>

            <div className="ms-control-row ms-control-row--period">
              <Segmented name="interval" label="Interval" options={INTERVAL_OPTIONS} value={interval} onChange={handleIntervalChange} />

              <div className="ms-period-picker">
                <IntervalDatePicker
                  interval={interval}
                  value={selectedDate}
                  onChange={handleDateChange}
                  maxDate={maxDate}
                  minDate={MIN_DATE}
                />
                {selectedDate && !periodOpen && (
                  <span className="ms-period-range">{formatPeriodRange(selectedDate, interval)}</span>
                )}
              </div>

              <button
                type="button"
                className="ms-submit"
                onClick={handleView}
                disabled={isLoading || periodOpen || !selectedDate}
              >
                {isLoading ? 'Loading' : 'Show winner'}
              </button>
            </div>

            {/* Open period: direction, not an error. */}
            {periodOpen && (
              <div className="ms-notice" role="status">
                <p className="ms-notice-title">
                  This {interval === 'daily' ? 'day' : INTERVAL_OPTIONS.find((o) => o.value === interval)?.label.toLowerCase()} is still running.
                </p>
                <p className="ms-notice-body">
                  Results are final after {getPeriodCloseLabel(selectedDate, interval)}. Votes, plays and likes are still landing until then.
                </p>
                <button type="button" className="ms-notice-action" onClick={jumpToLastClosed}>
                  Go to {formatPeriodLabel(getLastCompletedPeriodEnd(interval), interval)}
                </button>
              </div>
            )}
          </section>

          {/* ── Result ─────────────────────────────────────────────────── */}
          {isLoading && (
            <div className="ms-skeleton" role="status" aria-live="polite">
              <span className="sr-only">Loading the archive</span>
              <div className="ms-skeleton-plate" />
              <div className="ms-skeleton-list">
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="ms-skeleton-row" />)}
              </div>
            </div>
          )}

          {!isLoading && error && (
            <div className="ms-message ms-message--error" role="alert">{error}</div>
          )}

          {!isLoading && !error && shown?.empty && (
            <div className="ms-message" role="status">
              No award was recorded for {formatPeriodLabel(shown.selectedDate, shown.interval)} in {JURISDICTION_LABEL[shown.jurisdiction]}. Try another period or genre.
            </div>
          )}

          {!isLoading && !error && winner && shown && !shown.empty && (
            <section
              className="ms-result"
              key={`${winner.id}-${shown.selectedDate}-${shown.category}`}
              aria-label="Award result"
            >
              <div className="ms-headline">
                <span className="ms-headline-kicker">
                  {JURISDICTION_LABEL[shown.jurisdiction]} · {GENRES.find((g) => g.value === shown.genre)?.label}
                </span>
                <h2 className="ms-headline-title">
                  {shown.category === 'artist' ? 'Artist' : 'Song'} {INTERVAL_TITLE[shown.interval]}
                </h2>
                <span className="ms-headline-period">{formatPeriodLabel(shown.selectedDate, shown.interval)}</span>
              </div>

              {/* Plate — the engraved record */}
              <article className="ms-plate">
                <div className="ms-plate-glow" style={{ backgroundImage: `url(${winner.artwork})` }} aria-hidden="true" />

                <div className="ms-plate-art">
                  <img src={winner.artwork} alt={`${winner.title} artwork`} />
                </div>

                <div className="ms-plate-body">
                  <span className="ms-plate-crown">Winner</span>
                  <h3 className="ms-plate-name">{winner.title}</h3>
                  {shown.category === 'song' && <p className="ms-plate-by">{winner.artist}</p>}

                  {figures.length > 0 ? (
                    <dl className="ms-figures">
                      {figures.map((f) => (
                        <div
                          key={f.key}
                          className={`ms-figure${f.lead ? ' ms-figure--lead' : ''}`}
                        >
                          <dt>{f.label}</dt>
                          <dd>{formatNumber(f.value)}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    // Nothing scored at all. The determination line takes the
                    // figures' place rather than sitting in small print under an
                    // empty row of zeroes.
                    <p className="ms-figures-empty">
                      {tiebreak || 'No engagement recorded for this period'}
                    </p>
                  )}

                  {tiebreak && figures.length > 0 && <p className="ms-plate-note">{tiebreak}</p>}

                  <div className="ms-plate-actions">
                    {shown.category === 'song' && winner.fileUrl && (
                      <button type="button" className="ms-action ms-action--primary" onClick={() => playEntry(winner)}>
                        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                          <path d="M8 5v14l11-7z" fill="currentColor" />
                        </svg>
                        Play
                      </button>
                    )}
                    <button type="button" className="ms-action" onClick={() => openEntry(winner)}>
                      {shown.category === 'artist' ? 'View artist' : 'View song'}
                    </button>
                  </div>
                </div>
              </article>

              {/* Tally — the signature. Bar width = share of the period's points. */}
              <article className="ms-tally">
                <header className="ms-tally-head">
                  <h4 className="ms-tally-heading">The tally</h4>
                  <span className="ms-tally-meta">
                    {totalVotes > 0
                      ? `${formatNumber(totalVotes)} votes cast`
                      : 'Decided on engagement'}
                  </span>
                </header>

                <ol className="ms-tally-list">
                  {entries.map((entry, i) => (
                    <TallyRow
                      key={entry.id || entry.rank}
                      entry={entry}
                      index={i}
                      showBar={maxPoints > 0}
                      share={maxPoints > 0 && entry.weightedPoints > 0
                        ? Math.max(4, (entry.weightedPoints / maxPoints) * 100)
                        : 0}
                      onOpen={openEntry}
                      onPlay={playEntry}
                      canPlay={entry.targetType === 'song' && !!entry.fileUrl}
                    />
                  ))}
                </ol>

                {entries.length === 1 && (
                  <p className="ms-tally-solo">
                    One entry qualified in this category for this period.
                  </p>
                )}
              </article>
            </section>
          )}

          {!isLoading && !error && !shown && !periodOpen && (
            <div className="ms-invite">
              <p>Pick a jurisdiction, genre and period, then show the winner.</p>
            </div>
          )}

        </main>
      </div>
    </Layout>
  );
};

export default MilestonesPage;