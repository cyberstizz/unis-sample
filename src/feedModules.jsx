// src/feedModules.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Feed cards in the FOMO-inspired look (Oct 2026 mockup):
//
//   FeedSpotlight   gradient carousel that replaced the "Vote for This Week's
//                   Top Track" banner: today's race leader → Song of the Week
//                   → Artist of the Week. Falls back to a plain vote slide.
//   TodayRace       "Where Harlem's votes are going" — today's race drawn as
//                   bubbles (Songs / Artists), countdown to local midnight.
//   DayTiles        Votes today · Your points · Races close in.
//   MoversCard      Biggest rank moves today / this week.
//   FollowingDrops  New songs from artists you follow (story-style rings).
//
// Everything reads data feed.jsx already owns or fetches; nothing here
// records plays (the Player is the only play-tracking source).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import useDominantColor from './hooks/useDominantColor';
import { formatCount } from './utils/standings';
import { formatScore } from './context/RewardContext';
import './feedModules.scss';

// ── Small shared pieces ──────────────────────────────────────────────────────

const CheckIcon = ({ size = 14, width = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" />
  </svg>
);

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
  </svg>
);

const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const Arrow = ({ up }) => (
  <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
    <path d={up ? 'M5 1l4 7H1z' : 'M5 9L1 2h8z'} fill="currentColor" />
  </svg>
);

const votesLabel = (n) => `${formatCount(n)} vote${n === 1 ? '' : 's'}`;

/** Ticks every `ms` so countdowns stay live without re-rendering the feed. */
function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Time left in today's race. A LIVE board carries the jurisdiction's own
 * closing time (local midnight there); otherwise fall back to the viewer's
 * midnight so the tile never shows nonsense.
 */
export function raceClock(closesAt, now = Date.now()) {
  let end = closesAt ? new Date(closesAt).getTime() : NaN;
  if (!Number.isFinite(end) || end <= now - 60000) {
    const d = new Date(now);
    d.setHours(24, 0, 0, 0);
    end = d.getTime();
  }
  const ms = Math.max(0, end - now);
  return {
    hours: Math.floor(ms / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    dayFraction: Math.min(1, Math.max(0, 1 - ms / 86400000)),
  };
}

/** Votes-only view of a standings board: who has votes, and each one's share. */
export function voteShares(board, max = 5) {
  const entries = (board?.entries || []).filter((e) => e.votes > 0);
  const total = entries.reduce((sum, e) => sum + e.votes, 0);
  const ranked = entries
    .slice()
    .sort((a, b) => b.votes - a.votes || a.rank - b.rank)
    .slice(0, max)
    .map((e) => ({ ...e, share: total ? Math.round((e.votes / total) * 100) : 0 }));
  return { total, ranked };
}

// ═════════════════════════════════════════════════════════════════════════════
//  SPOTLIGHT (replaces the old hero banner)
// ═════════════════════════════════════════════════════════════════════════════

const WARM = [255, 92, 57];

/** Artwork colour → the card's gradient stops. Dark or missing art keeps the mockup's warm tones. */
function spotlightVars(rgb) {
  const usable = rgb && Math.max(rgb[0], rgb[1], rgb[2]) >= 70;
  const [r, g, b] = usable ? rgb : WARM;
  return {
    '--spot-b': `rgb(${r}, ${g}, ${b})`,
    '--spot-c': usable ? `color-mix(in srgb, rgb(${r}, ${g}, ${b}) 55%, #b538ff)` : '#b538ff',
  };
}

const SpotlightSlide = ({ slide, index, count, onVote, onOpen }) => {
  const rgb = useDominantColor(slide.image || null);
  const style = useMemo(() => spotlightVars(rgb), [rgb]);

  return (
    <div
      className="fm-spot__slide"
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}: ${slide.title}`}
      style={style}
    >
      <div className="fm-spot__grain" aria-hidden="true" />
      <div className="fm-spot__shade" aria-hidden="true" />

      {slide.chip && <span className="fm-spot__chip">{slide.chip}</span>}

      {slide.image && (
        <img
          className={`fm-spot__art${slide.round ? ' fm-spot__art--round' : ''}`}
          src={slide.image}
          alt=""
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

      {/* The whole card opens the song/artist; the Vote pill sits above it. */}
      {slide.onOpen && (
        <button
          type="button"
          className="fm-spot__hit"
          aria-label={`Open ${slide.title}`}
          onClick={() => onOpen(slide)}
        />
      )}

      <div className="fm-spot__body">
        <span className="fm-spot__label">
          <span className="fm-spot__live" aria-hidden="true" />
          {slide.label}
        </span>
        <span className="fm-spot__title">{slide.title}</span>
        {slide.byline && (
          <span className="fm-spot__byline">
            {slide.bylinePhoto && (
              <img src={slide.bylinePhoto} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            )}
            {slide.byline}
          </span>
        )}
        <span className="fm-spot__foot">
          <button type="button" className="fm-spot__vote" onClick={onVote}>
            <CheckIcon />
            {slide.cta || 'Vote'}
          </button>
          {slide.meta && <span className="fm-spot__meta">{slide.meta}</span>}
        </span>
      </div>
    </div>
  );
};

export const FeedSpotlight = ({
  jurisdictionName,
  dailyBoard,
  weeklyWinner,
  artistOfWeek,
  onVote,
  onSongNav,
  onArtistNav,
}) => {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  const slides = useMemo(() => {
    const list = [];

    // 1 — leader of today's song race (or yesterday's #1 before today starts)
    const scored = (dailyBoard?.entries || []).filter((e) => e.points > 0);
    if (scored.length) {
      const leader = scored[0];
      const { total } = voteShares(dailyBoard, 50);
      const live = (dailyBoard.state || 'LIVE') === 'LIVE';
      list.push({
        key: `leader-${leader.id}`,
        label: live ? "Leading today's race" : "Yesterday's #1",
        title: leader.name,
        byline: leader.artistName,
        image: leader.artwork,
        chip: leader.votes > 0 ? votesLabel(leader.votes) : `#1 in ${jurisdictionName}`,
        meta: total > 0 && leader.votes > 0
          ? `${Math.round((leader.votes / total) * 100)}% share`
          : `${formatCount(leader.points)} pts`,
        onOpen: () => onSongNav(leader.id, 'song'),
      });
    }

    // 2 — Song of the Week
    if (weeklyWinner) {
      list.push({
        key: `sotw-${weeklyWinner.songId}`,
        label: 'Song of the Week',
        title: weeklyWinner.title,
        byline: weeklyWinner.artistName,
        image: weeklyWinner.artworkUrl,
        chip: 'Winner',
        cta: 'Vote this week',
        onOpen: () => onSongNav(weeklyWinner.songId, 'song'),
      });
    }

    // 3 — Artist of the Week
    if (artistOfWeek) {
      list.push({
        key: `aotw-${artistOfWeek.userId}`,
        label: 'Artist of the Week',
        title: artistOfWeek.username,
        image: artistOfWeek.photoUrl,
        round: true,
        chip: artistOfWeek.votesCount > 0 ? votesLabel(artistOfWeek.votesCount) : 'Winner',
        cta: 'Vote this week',
        onOpen: () => onArtistNav(artistOfWeek.userId),
      });
    }

    // Nothing to feature yet — the card still sells the vote.
    if (!list.length) {
      list.push({
        key: 'vote',
        label: `Today's race in ${jurisdictionName}`,
        title: `Who runs ${jurisdictionName} today?`,
        byline: null,
        image: null,
        meta: 'Your vote decides the #1',
      });
    }
    return list;
  }, [dailyBoard, weeklyWinner, artistOfWeek, jurisdictionName, onSongNav, onArtistNav]);

  // Keep the dots in step with swipes.
  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setActive((prev) => (prev === i ? prev : i));
  }, []);

  // scrollTo is missing in some environments (jsdom, older WebViews).
  const scrollTrack = (left, smooth) => {
    const el = trackRef.current;
    if (!el) return;
    if (typeof el.scrollTo === 'function') el.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
    else el.scrollLeft = left;
  };

  const goTo = (i) => {
    scrollTrack(i * (trackRef.current?.clientWidth || 0), true);
    setActive(i);
  };

  useEffect(() => { setActive(0); scrollTrack(0, false); }, [slides.length]);

  const hour = new Date().getHours();
  const when = hour < 12 ? 'This morning' : hour < 17 ? 'This afternoon' : 'Tonight';

  return (
    <section className="fm-spot" aria-roledescription="carousel" aria-label="Spotlight">
      <h1 className="fm-spot__headline">
        {when} in <em>{jurisdictionName}</em>
      </h1>

      <div className="fm-spot__track" ref={trackRef} onScroll={onScroll}>
        {slides.map((slide, i) => (
          <SpotlightSlide
            key={slide.key}
            slide={slide}
            index={i}
            count={slides.length}
            onVote={onVote}
            onOpen={(s) => s.onOpen?.()}
          />
        ))}
      </div>

      {slides.length > 1 && (
        <div className="fm-spot__dots">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              className={`fm-spot__dot${i === active ? ' is-active' : ''}`}
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  TODAY'S RACE (bubbles)
// ═════════════════════════════════════════════════════════════════════════════

// Fixed bubble slots (stage is 340 × 322 units) so bubbles never collide,
// largest share in the largest slot. The last slot bleeds off the card edge.
const SLOTS = [
  { x: 0, y: 8, d: 190, tone: 'warm' },
  { x: 196, y: 0, d: 150, tone: 'blue' },
  { x: 150, y: 158, d: 126, tone: 'gold' },
  { x: 28, y: 210, d: 106, tone: 'red' },
  { x: 282, y: 200, d: 92, tone: 'green' },
];

export const TodayRace = ({
  jurisdictionName,
  songBoard,
  artistBoard,
  category,
  onCategoryChange,
  votedTargetIds,
  onVote,
  onOpenEntry,
  onOpenStandings,
}) => {
  const now = useNow();
  const board = category === 'artist' ? artistBoard : songBoard;
  const { total, ranked } = useMemo(() => voteShares(board), [board]);
  const live = (board?.state || 'LIVE') === 'LIVE';
  const clock = raceClock(live ? board?.closesAt : null, now);
  const noun = category === 'artist' ? 'Artist' : 'Song';
  const votedHere = ranked.some((e) => votedTargetIds?.has(e.id))
    || (board?.entries || []).some((e) => votedTargetIds?.has(e.id));

  return (
    <section className="fm-card fm-race" aria-label={`Today's ${noun.toLowerCase()} race`}>
      <div className="fm-race__head">
        <div>
          <h2 className="fm-card__title">Where {jurisdictionName}&rsquo;s votes are going</h2>
          <span className="fm-card__sub">
            {live ? `${noun} of the Day` : "Yesterday's final"} · {votesLabel(total)}
          </span>
        </div>
        <button type="button" className="fm-icon-btn" aria-label="Open full standings" onClick={onOpenStandings}>
          <ExpandIcon />
        </button>
      </div>

      <div className="fm-race__controls">
        <button
          type="button"
          className={`fm-pill${category === 'song' ? ' is-on' : ''}`}
          aria-pressed={category === 'song'}
          onClick={() => onCategoryChange('song')}
        >
          Songs
        </button>
        <button
          type="button"
          className={`fm-pill${category === 'artist' ? ' is-on' : ''}`}
          aria-pressed={category === 'artist'}
          onClick={() => onCategoryChange('artist')}
        >
          Artists
        </button>
        <span className="fm-race__clock" aria-label={`Race closes in ${clock.hours} hours ${clock.minutes} minutes`}>
          <ClockIcon />
          {clock.hours}h {clock.minutes}m
        </span>
      </div>

      {board == null ? (
        <div className="fm-race__empty"><span className="fm-spinner" aria-hidden="true" />Loading the race…</div>
      ) : ranked.length === 0 ? (
        <div className="fm-race__empty">
          No votes yet today in {jurisdictionName}. The first one sets the pace.
        </div>
      ) : (
        <div className="fm-race__stage">
          {ranked.map((entry, i) => {
            const slot = SLOTS[i];
            const mine = votedTargetIds?.has(entry.id);
            return (
              <button
                key={entry.id}
                type="button"
                className={`fm-bubble fm-bubble--${slot.tone} fm-bubble--s${i}${mine ? ' is-mine' : ''}`}
                style={{
                  left: `${(slot.x / 340) * 100}%`,
                  top: `${(slot.y / 322) * 100}%`,
                  width: `${(slot.d / 340) * 100}%`,
                }}
                aria-label={`${entry.name}, ${entry.share} percent of votes${mine ? ', your vote' : ''}`}
                onClick={() => onOpenEntry(entry)}
              >
                {mine && i < 3 && (
                  <span className="fm-bubble__mine"><CheckIcon size={11} width={3.4} />Your vote</span>
                )}
                <span className="fm-bubble__pct">{entry.share}%</span>
                {i < 4 && <span className="fm-bubble__name">{entry.name}</span>}
                {i < 3 && <span className="fm-bubble__votes">{votesLabel(entry.votes)}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="fm-race__foot">
        {votedHere ? (
          <>
            <span className="fm-race__ok" aria-hidden="true"><CheckIcon size={16} /></span>
            <span className="fm-race__foot-text">
              <strong>Your vote is in</strong>
              <span>Next {noun.toLowerCase()} vote opens at midnight</span>
            </span>
          </>
        ) : (
          <>
            <span className="fm-race__foot-text">
              <strong>Today&rsquo;s vote is open</strong>
              <span>One {noun.toLowerCase()} vote per day in {jurisdictionName}</span>
            </span>
            <button type="button" className="fm-cta" onClick={onVote}>Vote</button>
          </>
        )}
        <button type="button" className="fm-link" onClick={onOpenStandings}>
          Standings <ChevronRight />
        </button>
      </div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  DAY TILES
// ═════════════════════════════════════════════════════════════════════════════

export const DayTiles = ({
  isGuest,
  jurisdictionName,
  votedSongToday,
  votedArtistToday,
  score,
  level,
  closesAt,
}) => {
  const now = useNow();
  const clock = raceClock(closesAt, now);
  const used = (votedSongToday ? 1 : 0) + (votedArtistToday ? 1 : 0);
  const voteStatus = used === 2
    ? 'Both races done'
    : votedSongToday ? 'Artist race still open'
      : votedArtistToday ? 'Song race still open'
        : 'Two races open';

  const R = 31;
  const C = 2 * Math.PI * R;
  const pct = Math.round(clock.dayFraction * 100);

  return (
    <section className="fm-day" aria-label={isGuest ? 'Today on Unis' : 'Your day on Unis'}>
      <h2 className="fm-day__title">
        {isGuest ? 'Today' : 'Your day'} <em>on Unis</em>
      </h2>

      {!isGuest && (
        <div className="fm-day__pair">
          <div className="fm-card fm-tile">
            <span className="fm-tile__label">
              <span className="fm-tile__icon fm-tile__icon--accent" aria-hidden="true"><CheckIcon size={14} width={2.6} /></span>
              Votes today
            </span>
            <span className="fm-tile__big">{used}<small>/2</small></span>
            <span className="fm-tile__pips" aria-hidden="true">
              <span className={votedSongToday || used > 0 ? 'is-on' : ''} />
              <span className={used === 2 ? 'is-on' : ''} />
            </span>
            <span className="fm-tile__note fm-tile__note--accent">{voteStatus}</span>
          </div>

          <div className="fm-card fm-tile">
            <span className="fm-tile__label">
              <span className="fm-tile__icon fm-tile__icon--money" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.8H21l-5.5 4 2.1 6.7L12 15.6l-5.6 3.9 2.1-6.7-5.5-4h6.8z" /></svg>
              </span>
              Your points
            </span>
            <span className="fm-tile__big fm-tile__big--sm">{formatScore(score ?? 0)}</span>
            {level && <span className="fm-tile__note fm-tile__note--accent">{String(level).replace(/^\w/, (c) => c.toUpperCase())} level</span>}
          </div>
        </div>
      )}

      <div className="fm-card fm-clock">
        <div className="fm-clock__text">
          <span className="fm-tile__label">{jurisdictionName}&rsquo;s races close in</span>
          <span className="fm-clock__big">
            {clock.hours}<small>h</small> {clock.minutes}<small>m</small>
          </span>
          <span className="fm-card__sub">Song &amp; Artist of the Day · midnight local</span>
        </div>
        <div className="fm-clock__ring">
          <svg width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`${pct} percent of the day has passed`}>
            <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            <circle
              cx="38" cy="38" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
              className="fm-clock__arc"
              strokeDasharray={`${(C * clock.dayFraction).toFixed(1)} ${C.toFixed(1)}`}
              transform="rotate(-90 38 38)"
            />
          </svg>
          <span aria-hidden="true">{pct}%</span>
        </div>
      </div>
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  MOVERS
// ═════════════════════════════════════════════════════════════════════════════

/** Climbers first (biggest jump first), then new entries, then the drops. */
export function pickMovers(board, max = 4) {
  const scored = (board?.entries || []).filter((e) => e.points > 0);
  const ups = scored.filter((e) => e.movement > 0).sort((a, b) => b.movement - a.movement);
  const fresh = scored.filter((e) => e.movement == null && e.isNew);
  const downs = scored.filter((e) => e.movement < 0).sort((a, b) => a.movement - b.movement);
  return [...ups, ...fresh, ...downs].slice(0, max);
}

export const MoversCard = ({ jurisdictionName, board, period, onPeriodChange, onOpenEntry, fallbackArt }) => {
  const movers = useMemo(() => pickMovers(board), [board]);
  const when = period === 'weekly' ? 'this week' : 'today';

  return (
    <section className="fm-card fm-movers" aria-label={`Movers in ${jurisdictionName}`}>
      <div className="fm-movers__head">
        <h2 className="fm-card__title">Movers in {jurisdictionName}</h2>
        <div className="fm-movers__pills">
          <button type="button" className={`fm-pill fm-pill--sm${period === 'daily' ? ' is-on' : ''}`}
            aria-pressed={period === 'daily'} onClick={() => onPeriodChange('daily')}>Today</button>
          <button type="button" className={`fm-pill fm-pill--sm${period === 'weekly' ? ' is-on' : ''}`}
            aria-pressed={period === 'weekly'} onClick={() => onPeriodChange('weekly')}>Week</button>
        </div>
      </div>

      {board == null ? (
        <div className="fm-movers__empty"><span className="fm-spinner" aria-hidden="true" />Loading…</div>
      ) : movers.length === 0 ? (
        <div className="fm-movers__empty">Nobody has moved yet {when}.</div>
      ) : (
        <ul className="fm-movers__list">
          {movers.map((e) => {
            const up = e.movement > 0;
            return (
              <li key={e.id}>
                <button type="button" className="fm-mover" onClick={() => onOpenEntry(e)}>
                  <img
                    src={e.artwork || fallbackArt}
                    alt=""
                    onError={(ev) => { ev.currentTarget.src = fallbackArt; }}
                  />
                  <span className="fm-mover__meta">
                    <span className="fm-mover__title">{e.name}</span>
                    <span className="fm-mover__sub">
                      {e.artistName ? `${e.artistName} · ` : ''}{formatCount(e.plays)} play{e.plays === 1 ? '' : 's'} {when}
                    </span>
                  </span>
                  <span className="fm-mover__rank">
                    <span className="fm-mover__pos">#{e.rank}</span>
                    {e.movement == null ? (
                      <span className="fm-mover__new">NEW</span>
                    ) : (
                      <span className={`fm-mover__move ${up ? 'is-up' : 'is-down'}`}>
                        <Arrow up={up} />{Math.abs(e.movement)}
                        <span className="fm-sr">{up ? ' places up' : ' places down'}</span>
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  NEW FROM ARTISTS YOU FOLLOW
// ═════════════════════════════════════════════════════════════════════════════

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

export const FollowingDrops = ({ drops, onOpen }) => {
  if (!drops?.length) return null;
  return (
    <section className="fm-drops" aria-label="New from artists you follow">
      <div className="fm-drops__head">
        <h2 className="fm-drops__title">New from artists you follow</h2>
      </div>
      <ul className="fm-drops__row">
        {drops.map((d) => {
          const fresh = d.createdAt && Date.now() - new Date(d.createdAt).getTime() < TWO_DAYS;
          const name = d.artistData?.username || d.artist || 'Artist';
          const photo = d.artistPhoto || d.artworkUrl;
          return (
            <li key={d.id}>
              <button
                type="button"
                className="fm-drop"
                aria-label={`${d.title} by ${name}${fresh ? ', new' : ''}`}
                onClick={() => onOpen(d)}
              >
                <span className={`fm-drop__ring${fresh ? ' is-fresh' : ''}`}>
                  <img src={photo} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  {fresh && <span className="fm-drop__new">NEW</span>}
                </span>
                <span className="fm-drop__name">{name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
