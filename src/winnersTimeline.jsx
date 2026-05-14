import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

// ═══════════════════════════════════════════════════════════
// MOCK DATA — swap this entire block out when the backend
// endpoint /v1/jurisdictions/:id/awards/history is ready.
// Replace generateMockWinners() with an apiCall + cursor.
// ═══════════════════════════════════════════════════════════

const ARTIST_POOL = [
  { name: 'stizz', photo: songArtworkOne },
  { name: 'Lyricalqueen', photo: songArtworkTwo },
  { name: 'rapking', photo: songArtworkOne },
  { name: 'hiphop_artist1', photo: songArtworkTwo },
  { name: 'Maverick', photo: songArtworkOne },
  { name: 'JFlow', photo: songArtworkTwo },
  { name: 'NinaSounds', photo: songArtworkOne },
  { name: 'OctaveZero', photo: songArtworkTwo },
];

const SONG_POOL = [
  { title: 'no more heroes', artist: 'stizz', artwork: songArtworkOne },
  { title: 'Big booty sells', artist: 'Lyricalqueen', artwork: songArtworkTwo },
  { title: 'The next one', artist: 'Lyricalqueen', artwork: songArtworkOne },
  { title: 'borealis', artist: 'rapking', artwork: songArtworkTwo },
  { title: 'Cold Streets', artist: 'rapking', artwork: songArtworkOne },
  { title: 'Streetlight Hymn', artist: 'Maverick', artwork: songArtworkTwo },
  { title: 'Lights Out', artist: 'JFlow', artwork: songArtworkOne },
  { title: 'Sundown', artist: 'NinaSounds', artwork: songArtworkTwo },
  { title: 'Perfect Storm', artist: 'OctaveZero', artwork: songArtworkOne },
  { title: 'Through the Wall', artist: 'stizz', artwork: songArtworkTwo },
];

const INTERVAL_STEP_DAYS = {
  day: 1,
  week: 7,
  month: 30,
  quarter: 91,
  midterm: 182,
  year: 365,
};

// Anchor "today" for the mock so labels are stable across renders
const MOCK_TODAY = new Date('2026-03-15');

const formatPeriodLabel = (interval, periodsBack) => {
  const stepDays = INTERVAL_STEP_DAYS[interval];
  const endDate = new Date(MOCK_TODAY);
  endDate.setDate(endDate.getDate() - periodsBack * stepDays);

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

const generateMockWinners = (interval, category, count = 30) => {
  const winners = [];

  for (let i = 0; i < count; i++) {
    const periodLabel = formatPeriodLabel(interval, i);

    if (category === 'song') {
      const song = SONG_POOL[i % SONG_POOL.length];
      // Deterministic descending-ish vote counts so older periods skew lower
      const voteCount = Math.max(18, 152 - i * 6 + ((i * 13) % 18));

      winners.push({
        id: `song-${interval}-${i}`,
        periodLabel,
        type: 'song',
        winner: {
          id: `song-mock-${i}`,
          title: song.title,
          artist: song.artist,
          artistId: `artist-mock-${song.artist}`,
          artwork: song.artwork,
        },
        voteCount,
      });
    } else {
      const artist = ARTIST_POOL[i % ARTIST_POOL.length];
      const wonPollsCount = Math.max(1, 9 - Math.floor(i / 4) + (i % 3));

      winners.push({
        id: `artist-${interval}-${i}`,
        periodLabel,
        type: 'artist',
        winner: {
          id: `artist-mock-${artist.name}-${i}`,
          name: artist.name,
          photo: artist.photo,
        },
        wonPollsCount,
      });
    }
  }

  return winners;
};

// ═══════════════════════════════════════════════════════════
// WINNER CARD
// ═══════════════════════════════════════════════════════════

const WinnerCard = ({ entry, onClick, onPlay }) => {
  const isSong = entry.type === 'song';

  return (
    <article className="wt-card" onClick={onClick}>
      <div className="wt-card-art-wrap">
        <img
          src={isSong ? entry.winner.artwork : entry.winner.photo}
          alt={isSong ? entry.winner.title : entry.winner.name}
          className="wt-card-art"
        />

        {isSong && (
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
          {isSong
            ? `${entry.voteCount.toLocaleString()} votes`
            : `Won ${entry.wonPollsCount} poll${
                entry.wonPollsCount === 1 ? '' : 's'
              }`}
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
//   initialInterval    – 'day' | 'week' | 'month' | 'quarter' | 'midterm' | 'year'
//   initialCategory    – 'song' | 'artist'
//   variant            – 'embedded' (lives inside another page) | 'full'
//   initialCount       – how many rows to show before "load more"
//   pageSize           – how many rows each "load more" reveals (full page only)
//   showHeader         – render the eyebrow + title block
// ═══════════════════════════════════════════════════════════

const WinnersTimeline = ({
  jurisdiction = 'Downtown Harlem',
  initialInterval = 'week',
  initialCategory = 'song',
  variant = 'embedded',
  initialCount = 5,
  pageSize = 5,
  showHeader = true,
}) => {
  const navigate = useNavigate();

  const [activeInterval, setActiveInterval] = useState(initialInterval);
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [visibleCount, setVisibleCount] = useState(initialCount);

  const allWinners = useMemo(
    () => generateMockWinners(activeInterval, activeCategory, 30),
    [activeInterval, activeCategory]
  );

  const visibleWinners = allWinners.slice(0, visibleCount);
  const hasMore = visibleCount < allWinners.length;

  const handleNavigate = (entry) => {
    if (entry.type === 'song') {
      navigate(`/song/${entry.winner.id}`);
    } else {
      navigate(`/artist/${entry.winner.id}`);
    }
  };

  const handlePlay = (entry) => {
    // Mock placeholder – when real data lands, wire to PlayerContext.playMedia
    // exactly like JurisdictionPage.handlePlaySong does.
    console.log('[WinnersTimeline mock] play requested:', entry.winner.title);
  };

  const handleLoadMore = () => {
    if (variant === 'embedded') {
      navigate(
        `/jurisdiction/${encodeURIComponent(
          jurisdiction
        )}/winners?interval=${activeInterval}&category=${activeCategory}`
      );
    } else {
      setVisibleCount((c) => Math.min(c + pageSize, allWinners.length));
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

      <div className="wt-timeline">
        {visibleWinners.length === 0 ? (
          <p className="wt-empty">No winners on record yet.</p>
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

      {hasMore && (
        <div className="wt-load-more-wrap">
          {/*
            Embedded variant: button NAVIGATES to the full archive page.
            If you prefer the button to say "See full archive" on the
            embedded widget, swap the label below.
          */}
          <button
            type="button"
            className={`wt-load-more wt-load-more--${variant}`}
            onClick={handleLoadMore}
          >
            Load more winners
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