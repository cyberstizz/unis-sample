// src/LastWonNotification.jsx — "Last won" award card, redesigned Nov 2026.
//
// Shows the most recent winner in the listener's area (Song of the Day,
// Song of the Week or Artist of the Day) once per award, when they land on
// Home or the Feed.
//
// Rules this follows (from the research):
//   • A results moment earns a ceremony (Duolingo's league results), so the
//     staged reveal stays: badge → date → title and actions.
//   • It never blocks the page (nonmodal, no dimmed backdrop) and it waits
//     its turn: not while Now Playing or the welcome tour is open. Music-app
//     users complain most about popups that land mid-task and on every open,
//     so each award is announced once.
//   • The auto-close timer pauses while the pointer or keyboard focus is on
//     the card, and Escape closes it (WCAG 2.2.1 / 2.2.2).
//   • Phones get it docked above the bottom bar and player; desktop gets a
//     centred card.
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import { useAuth } from './context/AuthContext';
import { INTERVAL_IDS } from './utils/idMappings';
import './lastWonNotification.scss';

const DISPLAY_DURATION = 12000;

// ─── Award categories ───
const CATEGORIES = [
  {
    key: 'song-daily',
    type: 'song',
    intervalId: INTERVAL_IDS['daily'],
    badge: 'Song of the Day',
    secondaryLabel: 'Listen',
  },
  {
    key: 'song-weekly',
    type: 'song',
    intervalId: INTERVAL_IDS['weekly'],
    badge: 'Song of the Week',
    secondaryLabel: 'Listen',
  },
  {
    key: 'artist-daily',
    type: 'artist',
    intervalId: INTERVAL_IDS['daily'],
    badge: 'Artist of the Day',
    secondaryLabel: 'View Profile',
  },
];

const toApiDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// "Today" in America/New_York (the platform's timezone), as YYYY-MM-DD.
// Awards dated after it are rejected: the backend cron runs at UTC midnight
// (7pm the day before in New York) and can write tomorrow's date.
const todayInEst = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

const toDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const toWeeklyRange = (dateStr) => {
  if (!dateStr) return '';
  const end = new Date(`${dateStr}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  const startStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const year = end.getFullYear();
  if (start.getMonth() === end.getMonth()) return `${startStr} – ${end.getDate()}, ${year}`;

  const endStr = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${startStr} – ${endStr}, ${year}`;
};

const getAwardDateLabel = (categoryKey) => (categoryKey === 'song-weekly' ? 'LAST WEEK' : 'YESTERDAY');

// The card waits while these are open.
const isBusy = () =>
  typeof document !== 'undefined' &&
  (document.body.classList.contains('unp-np-open') || !!document.querySelector('.ut[role="dialog"]'));

// ─── Icons ───
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
    <path d="M3 7.5l4.6 3.7L12 4l4.4 7.2L21 7.5l-1.8 10.2a1 1 0 0 1-1 .8H5.8a1 1 0 0 1-1-.8L3 7.5z" />
  </svg>
);

const VoteIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const PlayIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
  </svg>
);

const PersonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);

const LetterReveal = ({ text, baseDelay = 0.35 }) => (
  <span className="lwn-tag-text" aria-label={text}>
    {text.split('').map((ch, i) => (
      <span
        key={i}
        className="lwn-tag-letter"
        aria-hidden="true"
        style={{ animationDelay: `${baseDelay + i * 0.04}s` }}
      >
        {ch === ' ' ? ' ' : ch}
      </span>
    ))}
  </span>
);

const LastWonNotification = () => {
  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState(null);
  const [animStage, setAnimStage] = useState(0); // 0 hidden, 1 badge, 2 date, 3 title + actions

  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext);
  const { user } = useAuth();

  const hasFetchedRef = useRef(false);
  const timersRef = useRef([]);          // reveal timers
  const waitRef = useRef(null);          // "wait its turn" poll
  const dismissTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const progressRef = useRef(null);
  const remainingRef = useRef(DISPLAY_DURATION);
  const runStartRef = useRef(0);
  const pausedRef = useRef(false);
  const cardRef = useRef(null);
  const returnFocusRef = useRef(null);

  const jurisdictionId = user?.jurisdiction?.jurisdictionId;

  const stopClock = useCallback(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    dismissTimerRef.current = null;
    progressIntervalRef.current = null;
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    setAnimStage(0);
    stopClock();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (waitRef.current) clearInterval(waitRef.current);
    // Hand focus back to where it was, if the card had taken it.
    const back = returnFocusRef.current;
    returnFocusRef.current = null;
    if (back && cardRef.current?.contains(document.activeElement)) {
      try { back.focus(); } catch { /* element gone */ }
    }
  }, [stopClock]);

  // Fetch the latest winners once per session.
  useEffect(() => {
    if (!jurisdictionId || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchWinners = async () => {
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const endDate = toApiDate(today);
      const startDate = toApiDate(thirtyDaysAgo);

      try {
        const results = await Promise.all(
          CATEGORIES.map(async (cat) => {
            try {
              const res = await apiCall({
                method: 'get',
                url: `/v1/awards/past?type=${cat.type}&startDate=${startDate}&endDate=${endDate}&jurisdictionId=${jurisdictionId}&intervalId=${cat.intervalId}`,
              });

              const cutoff = todayInEst();
              const awards = (res.data || []).filter((a) => !a?.awardDate || a.awardDate <= cutoff);
              if (awards.length === 0) return null;

              const award = awards[0];

              // Removed songs and deleted artists stay in the winners history,
              // but this card asks people to play and vote, so it skips them.
              const songGone = award.song && (award.song.removed || award.song.deletedAt);
              const artistGone = award.user && (award.user.deleted || award.user.deletedAt);
              if (songGone || artistGone) return null;

              if (cat.type === 'song' && award.song) {
                const isWeekly = cat.key === 'song-weekly';
                return {
                  category: cat,
                  title: award.song.title || 'Unknown Song',
                  artist: award.song.artist?.username || 'Unknown Artist',
                  jurisdiction: award.jurisdiction?.name || 'Unknown',
                  dateLabel: getAwardDateLabel(cat.key),
                  date: isWeekly ? toWeeklyRange(award.awardDate) : toDisplayDate(award.awardDate),
                  image: buildUrl(award.song.artworkUrl) || buildUrl(award.song.artist?.photoUrl),
                  songData: award.song,
                  navigateTo: `/song/${award.song.songId || award.targetId}`,
                };
              }
              if (cat.type === 'artist' && award.user) {
                return {
                  category: cat,
                  title: award.user.username || 'Unknown Artist',
                  artist: null,
                  jurisdiction: award.jurisdiction?.name || 'Unknown',
                  dateLabel: getAwardDateLabel(cat.key),
                  date: toDisplayDate(award.awardDate),
                  image: buildUrl(award.user.photoUrl),
                  navigateTo: `/artist/${award.user.userId || award.targetId}`,
                };
              }
              return null;
            } catch {
              return null;
            }
          })
        );

        const valid = results.filter(Boolean);
        if (valid.length === 0) return;

        const picked = valid[Math.floor(Math.random() * valid.length)];

        // Each award is announced once. The key is per award, so a new win
        // still gets its moment.
        const seenKey = `unis-lwn-seen:${picked.dateLabel || 'award'}:${picked.date || ''}:${picked.title || ''}`;
        try {
          if (localStorage.getItem(seenKey)) return;
          localStorage.setItem(seenKey, '1');
        } catch {
          // Storage disabled: show it anyway.
        }

        setNotification(picked);

        const reveal = () => {
          returnFocusRef.current = document.activeElement;
          setVisible(true);
          timersRef.current.push(
            setTimeout(() => setAnimStage(1), 400),
            setTimeout(() => setAnimStage(2), 1900),
            setTimeout(() => setAnimStage(3), 2600),
          );
        };

        // Let the page settle, then wait for Now Playing or the tour to close.
        timersRef.current.push(
          setTimeout(() => {
            if (!isBusy()) return reveal();
            waitRef.current = setInterval(() => {
              if (isBusy()) return;
              clearInterval(waitRef.current);
              waitRef.current = null;
              reveal();
            }, 500);
          }, 1200),
        );
      } catch (err) {
        console.error('LastWonNotification: Failed to fetch awards', err);
      }
    };

    fetchWinners();
  }, [jurisdictionId]);

  // Clean up everything on unmount.
  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    if (waitRef.current) clearInterval(waitRef.current);
    stopClock();
  }, [stopClock]);

  // The auto-close clock, which can pause and resume.
  const runClock = useCallback(() => {
    stopClock();
    runStartRef.current = Date.now();
    const remainingAtStart = remainingRef.current;

    progressIntervalRef.current = setInterval(() => {
      if (!progressRef.current) return;
      const left = remainingAtStart - (Date.now() - runStartRef.current);
      const pct = Math.max(0, (left / DISPLAY_DURATION) * 100);
      progressRef.current.style.width = `${pct}%`;
    }, 30);

    dismissTimerRef.current = setTimeout(dismiss, remainingAtStart);
  }, [dismiss, stopClock]);

  const pause = useCallback(() => {
    if (pausedRef.current || animStage < 3) return;
    pausedRef.current = true;
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - runStartRef.current));
    stopClock();
  }, [animStage, stopClock]);

  const resume = useCallback(() => {
    if (!pausedRef.current || animStage < 3) return;
    // Still hovered or focused? Stay paused.
    const card = cardRef.current;
    if (card && (card.matches(':hover') || card.contains(document.activeElement))) return;
    pausedRef.current = false;
    runClock();
  }, [animStage, runClock]);

  // Start the clock once the reveal finishes.
  useEffect(() => {
    if (animStage < 3) return undefined;
    remainingRef.current = DISPLAY_DURATION;
    pausedRef.current = false;
    runClock();
    return stopClock;
  }, [animStage, runClock, stopClock]);

  // Escape closes it.
  useEffect(() => {
    if (!visible) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismiss]);

  const handleVote = (e) => {
    e.stopPropagation();
    dismiss();
    navigate('/voteawards');
  };

  const handleSecondary = (e) => {
    e.stopPropagation();
    dismiss();

    if (notification?.songData) {
      const song = notification.songData;
      // Same rule as every other play surface: never replace the queue.
      requestPlay({
        type: 'song',
        id: song.songId,
        url: buildUrl(song.fileUrl),
        title: song.title,
        artist: song.artist?.username || 'Unknown',
        artwork: buildUrl(song.artworkUrl),
      });
    } else if (notification?.navigateTo) {
      navigate(notification.navigateTo);
    }
  };

  const openDetail = () => {
    if (!notification?.navigateTo) return;
    dismiss();
    navigate(notification.navigateTo);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) dismiss();
  };

  if (!notification) return null;

  const cat = notification.category;
  const isArtist = cat.type === 'artist';

  return (
    <div className={`lwn-overlay ${visible ? 'lwn-visible' : ''}`} onClick={handleOverlayClick}>
      <div
        ref={cardRef}
        className={`lwn-card ${isArtist ? 'lwn-card--artist' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-label={`${cat.badge}: ${notification.title}`}
        inert={!visible}
        onPointerEnter={pause}
        onPointerLeave={resume}
        onFocus={pause}
        onBlur={resume}
      >
        {/* The artwork, blurred, colours the whole card. */}
        {notification.image && (
          <div className="lwn-art-bg" style={{ backgroundImage: `url("${notification.image}")` }} aria-hidden="true" />
        )}
        <div className="lwn-art-scrim" aria-hidden="true" />

        {/* Time left, along the top edge. */}
        <div className="lwn-progress" aria-hidden="true">
          <div className="lwn-pfill" ref={progressRef} style={{ width: '100%' }} />
        </div>

        <button type="button" className="lwn-close" onClick={dismiss} aria-label="Dismiss">
          <CloseIcon />
        </button>

        <div className="lwn-body">
          {/* ── Artwork ── */}
          <button
            type="button"
            className="lwn-hero"
            onClick={openDetail}
            tabIndex={-1}
            aria-hidden="true"
          >
            {notification.image ? (
              <img src={notification.image} alt={notification.title} className="lwn-hero-img" />
            ) : (
              <div className="lwn-hero-placeholder">
                <CrownIcon />
              </div>
            )}
          </button>

          {/* ── Words ── */}
          <div className="lwn-content">
            <div className={`lwn-tag ${animStage >= 1 ? 'lwn-tag-visible' : ''}`}>
              <span className="lwn-tag-icon"><CrownIcon /></span>
              <LetterReveal text={cat.badge} />
            </div>

            <div className={`lwn-date-callout ${animStage >= 2 ? 'lwn-date-visible' : ''}`}>
              <div className="lwn-date-label">{notification.dateLabel}</div>
              <div className="lwn-date">{notification.date}</div>
            </div>

            <div className={`lwn-title-block ${animStage >= 3 ? 'lwn-title-visible' : ''}`}>
              <h2 className="lwn-title">{notification.title}</h2>
              {notification.artist && <p className="lwn-artist">{notification.artist}</p>}
            </div>

            <div className={`lwn-jurisdiction ${animStage >= 3 ? 'lwn-jurisdiction-visible' : ''}`}>
              <span className="lwn-jurisdiction-dot" aria-hidden="true" />
              {notification.jurisdiction.toUpperCase()}
            </div>
          </div>
        </div>

        <div className={`lwn-actions ${animStage >= 3 ? 'lwn-actions-visible' : ''}`}>
          <button type="button" className="lwn-btn-primary" onClick={handleVote}>
            <VoteIcon />
            Vote Now
          </button>
          <button type="button" className="lwn-btn-secondary" onClick={handleSecondary}>
            {isArtist ? <PersonIcon /> : <PlayIcon />}
            {cat.secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LastWonNotification;
