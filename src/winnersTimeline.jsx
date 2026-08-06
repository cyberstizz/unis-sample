// ═══════════════════════════════════════════════════════════════════════════
//  UNIS — Winners Timeline (v2 · live data)
//
//  Vertical timeline of past poll winners for a jurisdiction. Used by:
//    • the embedded widget on the jurisdiction page (variant="embedded")
//    • the full archive at /jurisdiction/:jur/winners (variant="full")
//
//  DATA — wired to the real backend (mock generator removed):
//    GET /v1/awards/past?type={song|artist}&startDate=&endDate=
//        &jurisdictionId=&intervalId=
//
//  The endpoint returns Award rows ordered award_date DESC, votes_count DESC,
//  with the song (incl. artist) or user attached. genreId is deliberately
//  omitted, so each period can return one winner PER GENRE — we group by
//  award_date and keep the highest-voted row, i.e. the period's overall
//  champion. (A per-genre filter is an easy later extension: add genre pills
//  and pass genreId.)
//
//  Fetching strategy: award rows are tiny (one per period), so one request
//  covers a full archive window per interval (FETCH_PERIODS below) and
//  "load more" pages client-side. When history outgrows this, swap in the
//  cursor-based /v1/jurisdictions/:id/awards/history endpoint.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import { INTERVAL_IDS } from './utils/idMappings';
import './winnersTimeline.scss';
import songArtworkOne from './assets/songartworkfour.jpeg';
import songArtworkTwo from './assets/songartworktwo.jpeg';

// ─── Inline icons (matching existing Unis pattern) ─────────
const PlayIcon = ({ size = 12 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="#FFFFFF"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

const TrophyIcon = ({ size = 11 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M5 4h14v3a5 5 0 0 1-5 5h-.05a4 4 0 0 1-3.9 0H10a5 5 0 0 1-5-5V4zm-2 0v3a7 7 0 0 0 6 6.93V16H7v2h10v-2h-2v-2.07A7 7 0 0 0 21 7V4h-2V2H5v2H3z" />
  </svg>
);

const ChevronDownIcon = ({ size = 14 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M7 10l5 5 5-5z" />
  </svg>
);

const ArrowRightIcon = ({ size = 12 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M8.5 5l-1.4 1.4L12.7 12 7.1 17.6 8.5 19l7-7z" />
  </svg>
);

// ─── Filter options ────────────────────────────────────────
const INTERVALS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'midterm', label: 'Midterm' },
  { value: 'year', label: 'Year' },
];

const CATEGORIES = [
  { value: 'song', label: 'Song' },
  { value: 'artist', label: 'Artist' },
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

// Award entity → the entry shape the cards render. Returns null for rows
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
    determinationMethod: award.determinationMethod,
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

// ═══════════════════════════════════════════════════════════
// WINNER CARD
// ═══════════════════════════════════════════════════════════

const WinnerCard = ({ entry, onClick, onPlay }) => {
  const isSong = entry.type === 'song';
  const art = isSong ? entry.winner.artwork : entry.winner.photo;

  return (
    <article
      className="wt-card"
      role="button"
      tabIndex={0}
      aria-label={`View ${isSong ? entry.winner.title : entry.winner.name}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Ambient glow — the winner's own artwork, blurred behind the card
          (same treatment as the Milestones winner plate). */}
      <div
        className="wt-card-glow"
        style={{ backgroundImage: `url(${art})` }}
        aria-hidden="true"
      />

      <div className="wt-card-art-wrap">
        <img src={art} alt="" className="wt-card-art" />

        {isSong && entry.winner.fileUrl && (
          <button
            type="button"
            className="wt-card-play"
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.(entry);
            }}
            aria-label={`Play ${entry.winner.title}`}
          >
            <PlayIcon size={12} />
          </button>
        )}
      </div>

      <div className="wt-card-body">
        <h3 className="wt-card-title">
          {isSong ? entry.winner.title : entry.winner.name}
        </h3>

        {isSong && <p className="wt-card-meta">{entry.winner.artist}</p>}

        <div className="wt-card-stat">
          <TrophyIcon size={11} />
          {entry.votesCount > 0
            ? `${entry.votesCount.toLocaleString()} vote${entry.votesCount === 1 ? '' : 's'}`
            : 'Won on engagement'}
        </div>
      </div>
    </article>
  );
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
//
// Props:
//   jurisdiction       – display + URL slug for the place
//   jurisdictionId     – UUID; when omitted, resolved via byName
//   initialInterval    – 'day' | 'week' | 'month' | 'quarter' | 'midterm' | 'year'
//   initialCategory    – 'song' | 'artist'
//   variant            – 'embedded' (lives inside another page) | 'full'
//   initialCount       – how many rows to show before "load more"
//   pageSize           – how many rows each "load more" reveals (full page only)
//   showHeader         – render the eyebrow + title block
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
  const { requestPlay, currentMedia } = useContext(PlayerContext);
  const { user } = useAuth();
  const userId = user?.userId || null;

  const [activeInterval, setActiveInterval] = useState(initialInterval);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [visibleCount, setVisibleCount] = useState(initialCount);

  const [jurId, setJurId] = useState(jurisdictionId);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // songId requested from this timeline, awaiting confirmation that it
  // actually became the current track (same pattern as jurisdictionPage).
  const pendingTrackRef = useRef(null);

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
        setError('Couldn\u2019t load past winners. Check your connection and try again.');
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
        // first row seen for a date is that period's overall champion.
        const byDate = new Map();
        (res.data || []).forEach((award) => {
          if (!byDate.has(award.awardDate)) byDate.set(award.awardDate, award);
        });

        const normalized = [...byDate.values()]
          .map((award) => normalizeAward(award, activeInterval))
          .filter(Boolean);

        setEntries(normalized);
      } catch (err) {
        if (!active) return;
        console.error('[winnersTimeline] awards fetch failed:', err?.message || err);
        setError('Couldn\u2019t load past winners. Check your connection and try again.');
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

  // ── Effect-based play tracking (credited only once it actually plays) ──
  useEffect(() => {
    const playingId = currentMedia?.id || currentMedia?.songId;
    if (!playingId || !userId) return;
    if (pendingTrackRef.current !== playingId) return;

    pendingTrackRef.current = null;

    apiCall({
      method: 'post',
      url: `/v1/media/song/${playingId}/play?userId=${userId}`,
    }).catch((err) =>
      console.error('[winnersTimeline] play tracking failed:', err?.message || err)
    );
  }, [currentMedia?.id, currentMedia?.songId, userId]);

  const visibleWinners = entries.slice(0, visibleCount);
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

      pendingTrackRef.current = entry.winner.id;
    },
    [requestPlay]
  );

  const handleLoadMore = () => {
    if (variant === 'embedded') {
      navigate(
        `/jurisdiction/${encodeURIComponent(
          jurisdiction
        )}/winners?interval=${activeInterval}&category=${activeCategory}`
      );
    } else {
      // Ad-refresh hookup lives here (wt-page-ad-slot refreshes every
      // pageSize winners revealed) — wire when the ad partner lands.
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

  return (
    <section className={`wt wt--${variant}`}>
      {showHeader && (
        <header className="wt-header">
          <span className="wt-eyebrow">Hall of fame</span>
          <h2 className="wt-title">
            Past <em>winners</em>
          </h2>
          <p className="wt-subtitle">
            {variant === 'embedded'
              ? `Every track and artist ${jurisdiction} has crowned.`
              : `The complete record of who ${jurisdiction} has voted for, across every interval since Unis began.`}
          </p>
        </header>
      )}

      <div className="wt-filters">
        <div className="wt-filter-group">
          <span className="wt-filter-label">Interval</span>
          <div className="wt-filter-pills">
            {INTERVALS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`wt-pill ${
                  activeInterval === opt.value ? 'is-active' : ''
                }`}
                onClick={() => handleIntervalChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="wt-filter-group">
          <span className="wt-filter-label">Category</span>
          <div className="wt-filter-pills">
            {CATEGORIES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`wt-pill ${
                  activeCategory === opt.value ? 'is-active' : ''
                }`}
                onClick={() => handleCategoryChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="wt-skeleton" aria-hidden="true">
          <div className="wt-skeleton-row" />
          <div className="wt-skeleton-row" />
          <div className="wt-skeleton-row" />
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
      ) : (
        <div className="wt-timeline">
          {visibleWinners.length === 0 ? (
            <p className="wt-empty">
              No winners on record for this interval yet. The next poll crowns
              the first.
            </p>
          ) : (
            visibleWinners.map((entry, idx) => {
              const isLast = idx === visibleWinners.length - 1 && !hasMore;
              return (
                <div
                  key={entry.id}
                  className={`wt-entry ${isLast ? 'wt-entry--last' : ''}`}
                >
                  <div className="wt-gutter">
                    <span className="wt-dot" />
                  </div>

                  <div className="wt-entry-content">
                    <p className="wt-period">{entry.periodLabel}</p>
                    <WinnerCard
                      entry={entry}
                      onClick={() => handleNavigate(entry)}
                      onPlay={() => handlePlay(entry)}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Embedded: the button is the door to the full archive, so it shows
          whenever there is ANY history. Full: standard client-side reveal. */}
      {!loading && !error && (variant === 'embedded' ? entries.length > 0 : hasMore) && (
        <div className="wt-load-more-wrap">
          <button
            type="button"
            className={`wt-load-more wt-load-more--${variant}`}
            onClick={handleLoadMore}
          >
            {variant === 'embedded' ? 'See full archive' : 'Load more winners'}
            {variant === 'embedded' ? (
              <ArrowRightIcon size={12} />
            ) : (
              <ChevronDownIcon size={14} />
            )}
          </button>
        </div>
      )}
    </section>
  );
};

export default WinnersTimeline;