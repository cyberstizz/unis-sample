// ═══════════════════════════════════════════════════════════════════════════
//  UNIS — Hall of fame (WinnersTimeline v3, Nov 2026)
//
//  Past poll winners for a jurisdiction. Used by:
//    • the embedded section on the jurisdiction page (variant="embedded")
//    • the full archive at /jurisdiction/:jur/winners (variant="full")
//
//  v3 (Scout → Sketch → Ship, canvas "Unis — Jurisdiction page redesign"):
//    • The boxed two-group filter panel is gone. Songs/Artists and the six
//      periods use the same pill switcher as the Charts page (Apple HIG and
//      Primer: about five visible segments on a phone; the rest scroll).
//    • The latest winner gets a featured plate; earlier winners sit in a
//      compact ledger instead of wide, mostly empty cards.
//    • Winners carry the artist page's medals (song = gold, artist = theme).
//    • Back-to-back wins get a streak tag ("2 weeks running").
//    • Quiet periods (NO_ACTIVITY — nothing happened, decided on score) say
//      so, with a muted medal and no trophy.
//
//  DATA — GET /v1/awards/past?type={song|artist}&startDate=&endDate=
//        &jurisdictionId=&intervalId=
//
//  The endpoint returns Award rows ordered award_date DESC, votes_count DESC,
//  with the song (incl. artist) or user attached. genreId is deliberately
//  omitted, so each period can return one winner PER GENRE — we group by
//  award_date and keep the first row, i.e. the most-voted genre winner.
//
//  Fetching strategy: award rows are tiny (one per period), so one request
//  covers a full archive window per interval (FETCH_PERIODS below) and
//  "load more" pages client-side.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import { INTERVAL_IDS } from './utils/idMappings';
import './winnersTimeline.scss';
import songArtworkOne from './assets/songartworkfour.jpeg';
import songArtworkTwo from './assets/songartworktwo.jpeg';

// ─── Inline icons (matching existing Unis pattern) ─────────
const PlayIcon = ({ size = 12 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
);

const TrophyIcon = ({ size = 12 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 6h3a3 3 0 0 1-3 3M7 6H4a3 3 0 0 0 3 3" />
  </svg>
);

const CardIcon = ({ size = 15 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);

const ChevronDownIcon = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M7 10l5 5 5-5z" />
  </svg>
);

// ─── Filter options ────────────────────────────────────────
// short / name match the artist page's awards shelf (artistpage.jsx).
const INTERVALS = [
  { value: 'day',     label: 'Day',     short: 'DAY', name: 'Day',     adj: 'daily',     noun: 'day',       nouns: 'days' },
  { value: 'week',    label: 'Week',    short: 'WK',  name: 'Week',    adj: 'weekly',    noun: 'week',      nouns: 'weeks' },
  { value: 'month',   label: 'Month',   short: 'MO',  name: 'Month',   adj: 'monthly',   noun: 'month',     nouns: 'months' },
  { value: 'quarter', label: 'Quarter', short: 'QTR', name: 'Quarter', adj: 'quarterly', noun: 'quarter',   nouns: 'quarters' },
  { value: 'midterm', label: 'Half',    short: 'MID', name: 'Midterm', adj: 'half-year', noun: 'half-year', nouns: 'half-years' },
  { value: 'year',    label: 'Year',    short: 'YR',  name: 'Year',    adj: 'yearly',    noun: 'year',      nouns: 'years' },
];

const CATEGORIES = [
  { value: 'song', label: 'Songs' },
  { value: 'artist', label: 'Artists' },
];

// UI interval value → INTERVAL_IDS key (idMappings.js)
const INTERVAL_KEY = {
  day: 'daily',
  week: 'weekly',
  month: 'monthly',
  quarter: 'quarterly',
  midterm: 'midterm',
  year: 'annual',
};

const INTERVAL_STEP_DAYS = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 91,
  midterm: 182,
  year: 365,
};

// How many periods back a single fetch covers, per interval.
// Deep enough for years of history at launch scale.
const FETCH_PERIODS = {
  day: 45,
  week: 52,
  month: 24,
  quarter: 12,
  midterm: 8,
  year: 6,
};

const isoDate = (d) => d.toISOString().slice(0, 10);

// The ledger drops this year's ", 2026" so a week fits on one line.
const THIS_YEAR = `, ${new Date().getFullYear()}`;
const shortPeriod = (label) => (label.endsWith(THIS_YEAR) ? label.slice(0, -THIS_YEAR.length) : label);
const fmt = (n) => (Number(n) || 0).toLocaleString('en-US');

// award_date marks the END of the awarded period.
const formatPeriodLabel = (interval, endDate) => {
  switch (interval) {
    case 'day':
      return endDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    case 'week': {
      const start = new Date(endDate);
      start.setDate(start.getDate() - 6);
      const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' });
      const year = endDate.getFullYear();
      if (startMonth === endMonth) {
        return `${startMonth} ${start.getDate()} – ${endDate.getDate()}, ${year}`;
      }
      return `${startMonth} ${start.getDate()} – ${endMonth} ${endDate.getDate()}, ${year}`;
    }
    case 'month':
      return endDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    case 'quarter': {
      const q = Math.floor(endDate.getMonth() / 3) + 1;
      return `Q${q} ${endDate.getFullYear()}`;
    }
    case 'midterm': {
      const isFirstHalf = endDate.getMonth() < 6;
      return `${isFirstHalf ? 'H1' : 'H2'} ${endDate.getFullYear()}`;
    }
    case 'year':
      return String(endDate.getFullYear());
    default:
      return '';
  }
};

// Award entity → the entry shape the rows render. Returns null for rows
// whose target has been deleted (no song/user attached).
const normalizeAward = (award, interval) => {
  const base = {
    id: award.awardId,
    periodLabel: formatPeriodLabel(
      interval,
      new Date(`${award.awardDate}T00:00:00`)
    ),
    type: award.targetType,
    votesCount: award.votesCount || 0,
    totalPoints: award.totalPoints || 0,
    genre: award.genre?.name || '',
    determinationMethod: award.determinationMethod,
    quiet: award.determinationMethod === 'NO_ACTIVITY',
  };

  if (award.targetType === 'song') {
    if (!award.song) return null;
    return {
      ...base,
      winner: {
        id: award.song.songId,
        title: award.song.title,
        artist: award.song.artist?.username || 'Unknown',
        artistId: award.song.artist?.userId,
        artwork: buildUrl(award.song.artworkUrl) || songArtworkOne,
        fileUrl: buildUrl(award.song.fileUrl),
      },
    };
  }

  if (!award.user) return null;
  return {
    ...base,
    winner: {
      id: award.user.userId,
      name: award.user.username,
      photo: buildUrl(award.user.photoUrl) || songArtworkTwo,
    },
  };
};

// Back-to-back wins. Entries are newest first; the tag goes on the newest
// entry of each run, counting how many periods in a row it covers.
const withStreaks = (entries) => {
  const runs = new Array(entries.length).fill(1);
  for (let i = entries.length - 2; i >= 0; i -= 1) {
    if (entries[i].winner.id === entries[i + 1].winner.id) runs[i] = runs[i + 1] + 1;
  }
  return entries.map((e, i) => ({
    ...e,
    streak: runs[i] > 1 && (i === 0 || entries[i - 1].winner.id !== e.winner.id) ? runs[i] : 0,
  }));
};

// "52 votes" / "Plays & likes" / "No activity"
const statLine = (entry) => {
  if (entry.votesCount > 0) return `${fmt(entry.votesCount)} vote${entry.votesCount === 1 ? '' : 's'}`;
  if (entry.quiet) return 'No votes, plays or likes';
  return 'Won on plays & likes';
};

// Short form for the desktop ledger's stat column.
const shortStat = (entry) => {
  if (entry.votesCount > 0) return `${fmt(entry.votesCount)} vote${entry.votesCount === 1 ? '' : 's'}`;
  return entry.quiet ? 'No activity' : 'Plays & likes';
};

// ─── The switcher (same look and behavior as the Charts page's) ─────────────
const Segmented = ({ label, options, value, onChange, scroll = false }) => (
  <div className={`wt-seg${scroll ? ' wt-seg--scroll' : ''}`} role="group" aria-label={label}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className={`wt-seg__btn${o.value === value ? ' is-on' : ''}`}
        aria-pressed={o.value === value}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const Medal = ({ entry, interval, small = false }) => (
  <span
    className={`wt-medal wt-medal--${entry.quiet ? 'quiet' : entry.type}${small ? ' wt-medal--sm' : ''}`}
    aria-hidden="true"
  >
    {interval.short}
  </span>
);

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
//
// Props:
//   jurisdiction       – display + URL slug for the place
//   jurisdictionId     – UUID; when omitted, resolved via byName
//   initialInterval    – 'day' | 'week' | 'month' | 'quarter' | 'midterm' | 'year'
//   initialCategory    – 'song' | 'artist'
//   variant            – 'embedded' (lives inside another page) | 'full'
//   initialCount       – how many winners to show before "load more"
//   pageSize           – how many each "load more" reveals (full page only)
//   showHeader         – render the title block
// ═══════════════════════════════════════════════════════════

const WinnersTimeline = ({
  jurisdiction = 'Downtown Harlem',
  jurisdictionId = null,
  initialInterval = 'week',
  initialCategory = 'song',
  variant = 'embedded',
  initialCount = 5,
  pageSize = 5,
  showHeader = true,
}) => {
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext);

  const [activeInterval, setActiveInterval] = useState(initialInterval);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [visibleCount, setVisibleCount] = useState(initialCount);

  const [jurId, setJurId] = useState(jurisdictionId);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const interval = INTERVALS.find((i) => i.value === activeInterval) || INTERVALS[1];
  const isSongs = activeCategory === 'song';

  // ── Resolve jurisdiction UUID (skipped when the parent supplies it) ──
  useEffect(() => {
    if (jurisdictionId) {
      setJurId(jurisdictionId);
      return undefined;
    }

    let active = true;

    apiCall({
      method: 'get',
      url: `/v1/jurisdictions/byName/${encodeURIComponent(jurisdiction)}`,
    })
      .then((res) => {
        if (!active) return;
        const body = res.data;
        const first = Array.isArray(body) ? body[0] : body;
        if (first?.jurisdictionId) {
          setJurId(first.jurisdictionId);
        } else {
          setError(`Couldn't find ${jurisdiction}.`);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('[winnersTimeline] byName lookup failed:', err?.message || err);
        setError('Couldn’t load past winners. Check your connection and try again.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [jurisdiction, jurisdictionId]);

  // ── Fetch the archive window for the active interval/category ──
  useEffect(() => {
    if (!jurId) return undefined;

    let active = true;

    const fetchWinners = async () => {
      setLoading(true);
      setError(null);

      const end = new Date();
      const start = new Date(end);
      start.setDate(
        start.getDate() -
          FETCH_PERIODS[activeInterval] * INTERVAL_STEP_DAYS[activeInterval]
      );

      const intervalId = INTERVAL_IDS[INTERVAL_KEY[activeInterval]];

      try {
        const res = await apiCall({
          method: 'get',
          url:
            `/v1/awards/past?type=${activeCategory}` +
            `&startDate=${isoDate(start)}&endDate=${isoDate(end)}` +
            `&jurisdictionId=${jurId}&intervalId=${intervalId}`,
        });

        if (!active) return;

        // One winner per genre per period comes back; keep the top row per
        // award_date. Rows arrive ordered date DESC, votes DESC, so the
        // first row seen for a date is the most-voted genre winner.
        const byDate = new Map();
        (res.data || []).forEach((award) => {
          if (!byDate.has(award.awardDate)) byDate.set(award.awardDate, award);
        });

        const normalized = [...byDate.values()]
          .map((award) => normalizeAward(award, activeInterval))
          .filter(Boolean);

        setEntries(withStreaks(normalized));
      } catch (err) {
        if (!active) return;
        console.error('[winnersTimeline] awards fetch failed:', err?.message || err);
        setError('Couldn’t load past winners. Check your connection and try again.');
        setEntries([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchWinners();

    return () => {
      active = false;
    };
  }, [jurId, activeInterval, activeCategory, retryNonce]);

  const visible = entries.slice(0, visibleCount);
  const [latest, ...earlier] = visible;
  const hasMore = visibleCount < entries.length;

  const handleNavigate = (entry) => {
    if (entry.type === 'song') {
      navigate(`/song/${entry.winner.id}`);
    } else {
      navigate(`/artist/${entry.winner.id}`);
    }
  };

  const handlePlay = useCallback(
    (entry) => {
      if (entry.type !== 'song' || !entry.winner.fileUrl) return;

      requestPlay({
        type: 'song',
        id: entry.winner.id,
        songId: entry.winner.id,
        url: entry.winner.fileUrl,
        fileUrl: entry.winner.fileUrl,
        title: entry.winner.title,
        artist: entry.winner.artist,
        artistId: entry.winner.artistId,
        artwork: entry.winner.artwork,
        artworkUrl: entry.winner.artwork,
      });
      // No /play POST here: the Player counts the play (15s / 25% gate).
    },
    [requestPlay]
  );

  const archiveUrl = `/jurisdiction/${encodeURIComponent(jurisdiction)}/winners?interval=${activeInterval}&category=${activeCategory}`;

  const handleLoadMore = () => {
    if (variant === 'embedded') {
      navigate(archiveUrl);
    } else {
      // The ad beside this list (AdSlot) deliberately does NOT refresh here:
      // AdSense doesn't allow refreshing an ad on the same page view. It
      // gets a new ad when the person moves to another page.
      setVisibleCount((c) => Math.min(c + pageSize, entries.length));
    }
  };

  const handleIntervalChange = (value) => {
    setActiveInterval(value);
    setVisibleCount(initialCount);
  };

  const handleCategoryChange = (value) => {
    setActiveCategory(value);
    setVisibleCount(initialCount);
  };

  const nameOf = (entry) => (entry.type === 'song' ? entry.winner.title : entry.winner.name);
  const artOf = (entry) => (entry.type === 'song' ? entry.winner.artwork : entry.winner.photo);
  const awardName = `${isSongs ? 'Song' : 'Artist'} of the ${interval.name}`;
  const streakText = (n) => `${n} ${n === 1 ? interval.noun : interval.nouns} running`;

  const playButton = (entry, className, iconSize) => (
    entry.type === 'song' && entry.winner.fileUrl ? (
      <button
        type="button"
        className={className}
        onClick={() => handlePlay(entry)}
        aria-label={`Play ${entry.winner.title}`}
      >
        <PlayIcon size={iconSize} />
      </button>
    ) : null
  );

  return (
    <section className={`wt wt--${variant}`} aria-labelledby={showHeader ? `wt-h-${variant}` : undefined}>
      {showHeader && (
        <header className="wt-header">
          <div>
            <h2 id={`wt-h-${variant}`} className="wt-title">
              Hall of <em>fame</em>
            </h2>
            <p className="wt-subtitle">
              {variant === 'embedded'
                ? `Every song and artist ${jurisdiction} has crowned.`
                : `The complete record of who ${jurisdiction} has voted for, across every period since Unis began.`}
            </p>
          </div>
          {variant === 'embedded' && entries.length > 0 && (
            <button type="button" className="wt-link" onClick={() => navigate(archiveUrl)}>
              Full archive ›
            </button>
          )}
        </header>
      )}

      <div className="wt-controls">
        <Segmented label="Show" options={CATEGORIES} value={activeCategory} onChange={handleCategoryChange} />
        <Segmented
          label="Period"
          options={INTERVALS}
          value={activeInterval}
          onChange={handleIntervalChange}
          scroll
        />
      </div>

      {loading ? (
        <div className="wt-skeleton" aria-busy="true" aria-label="Loading past winners">
          <div className="wt-skeleton__plate" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="wt-skeleton__row">
              <span className="wt-skeleton__dot" />
              <span className="wt-skeleton__art" />
              <span className="wt-skeleton__line" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="wt-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="wt-retry"
            onClick={() => setRetryNonce((n) => n + 1)}
          >
            Retry
          </button>
        </div>
      ) : !latest ? (
        <div className="wt-empty">
          <b>No {interval.adj} winners yet</b>
          When this {interval.noun} closes in {jurisdiction}, its #1 lands here.
        </div>
      ) : (
        <>
          {/* ── The latest winner ── */}
          <article className="wt-latest">
            <div className="wt-latest__glow" style={{ backgroundImage: `url(${artOf(latest)})` }} aria-hidden="true" />
            <img
              className={`wt-latest__art${latest.type === 'artist' ? ' wt-latest__art--round' : ''}`}
              src={artOf(latest)}
              alt=""
            />
            <div className="wt-latest__body">
              <p className="wt-latest__kicker">
                <Medal entry={latest} interval={interval} small />
                <b>{awardName}</b>
                <span aria-hidden="true">·</span>
                <span>{latest.periodLabel}</span>
              </p>
              <h3 className="wt-latest__title">
                <button type="button" onClick={() => handleNavigate(latest)}>{nameOf(latest)}</button>
              </h3>
              {latest.type === 'song' && <p className="wt-latest__artist">{latest.winner.artist}</p>}
              <div className="wt-tags">
                {latest.quiet ? (
                  <span className="wt-tag wt-tag--quiet">Quiet {interval.noun} · decided on score</span>
                ) : (
                  <span className={`wt-tag${latest.votesCount > 0 ? ' wt-tag--votes' : ''}`}>
                    {latest.votesCount > 0 && <TrophyIcon size={12} />}
                    {statLine(latest)}
                  </span>
                )}
                {latest.totalPoints > 0 && <span className="wt-tag">{fmt(latest.totalPoints)} pts</span>}
                {latest.genre && <span className="wt-tag">{latest.genre}</span>}
                {latest.streak > 1 && <span className="wt-tag wt-tag--streak">{streakText(latest.streak)}</span>}
              </div>
            </div>
            <div className="wt-latest__actions">
              {playButton(latest, 'wt-play', 18)}
              {latest.id && (
                <button
                  type="button"
                  className="wt-pill"
                  onClick={() => navigate(`/award/${latest.id}`)}
                  aria-label={`View award card for ${nameOf(latest)}, ${latest.periodLabel}`}
                >
                  <CardIcon size={15} />
                  Award card
                </button>
              )}
            </div>
          </article>

          {/* ── Earlier winners ── */}
          {earlier.length > 0 && (
            <div className="wt-ledger">
              <span className="wt-ledger__rail" aria-hidden="true" />
              <ol className="wt-ledger__list" aria-label={`Earlier ${interval.adj} winners`}>
                {earlier.map((entry) => (
                  <li key={entry.id} className="wt-row">
                    <span className="wt-row__date">{shortPeriod(entry.periodLabel)}</span>
                    <Medal entry={entry} interval={interval} />
                    <img
                      className={`wt-row__art${entry.type === 'artist' ? ' wt-row__art--round' : ''}`}
                      src={artOf(entry)}
                      alt=""
                    />
                    <span className="wt-row__main">
                      <span className="wt-row__date wt-row__date--inline">
                        {shortPeriod(entry.periodLabel)}
                        {entry.streak > 1 && <span className="wt-mini wt-mini--streak">{streakText(entry.streak)}</span>}
                        {entry.quiet && <span className="wt-mini">Quiet {interval.noun}</span>}
                      </span>
                      <button type="button" className="wt-row__title" onClick={() => handleNavigate(entry)}>
                        {nameOf(entry)}
                      </button>
                      {entry.type === 'song' && (
                        <span className="wt-row__sub wt-row__sub--wide">{entry.winner.artist}</span>
                      )}
                      <span className="wt-row__sub wt-row__sub--narrow">
                        {[entry.type === 'song' ? entry.winner.artist : null, entry.genre, statLine(entry)]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    <span className="wt-row__tags">
                      {entry.streak > 1 && <span className="wt-mini wt-mini--streak">{streakText(entry.streak)}</span>}
                      {entry.quiet && <span className="wt-mini">Quiet {interval.noun}</span>}
                      {entry.genre && <span className="wt-tag">{entry.genre}</span>}
                    </span>
                    <span className="wt-row__stat">{shortStat(entry)}</span>
                    {playButton(entry, 'wt-ibtn wt-ibtn--play', 12) || <span className="wt-ibtn--none" />}
                    {entry.id ? (
                      <button
                        type="button"
                        className="wt-ibtn"
                        onClick={() => navigate(`/award/${entry.id}`)}
                        aria-label={`View award card for ${nameOf(entry)}, ${entry.periodLabel}`}
                      >
                        <CardIcon size={15} />
                      </button>
                    ) : <span className="wt-ibtn--none" />}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {/* Embedded: the button is the door to the full archive, so it shows
          whenever there is ANY history. Full: standard client-side reveal. */}
      {!loading && !error && (variant === 'embedded' ? entries.length > 0 : hasMore) && (
        <div className="wt-more">
          <button
            type="button"
            className={`wt-more__btn wt-more__btn--${variant}`}
            onClick={handleLoadMore}
          >
            {variant === 'embedded' ? 'See the full archive' : 'Load more winners'}
            {variant === 'full' && <ChevronDownIcon size={14} />}
          </button>
        </div>
      )}
    </section>
  );
};

export default WinnersTimeline;
