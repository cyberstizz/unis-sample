import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import { useAuth } from './context/AuthContext';
import { INTERVAL_IDS } from './utils/idMappings';
import unisLogo from './assets/unisLogoThree.svg';
import './lastWonNotification.scss';

const DISPLAY_DURATION = 12000; // Longer to appreciate the animations

// ─── Award category definitions ───
const CATEGORIES = [
  {
    key: 'song-daily',
    type: 'song',
    intervalId: INTERVAL_IDS['daily'],
    badge: 'Song of the Day',
    badgeClass: 'lwn-tag-song',
    bgClass: 'lwn-bg-song',
    fillClass: 'lwn-pfill-song',
    icon: '🎵',
    secondaryLabel: 'Listen',
  },
  {
    key: 'song-weekly',
    type: 'song',
    intervalId: INTERVAL_IDS['weekly'],
    badge: 'Song of the Week',
    badgeClass: 'lwn-tag-weekly',
    bgClass: 'lwn-bg-weekly',
    fillClass: 'lwn-pfill-weekly',
    icon: '🏆',
    secondaryLabel: 'Listen',
  },
  {
    key: 'artist-daily',
    type: 'artist',
    intervalId: INTERVAL_IDS['daily'],
    badge: 'Artist of the Day',
    badgeClass: 'lwn-tag-artist',
    bgClass: 'lwn-bg-artist',
    fillClass: 'lwn-pfill-artist',
    icon: '👑',
    secondaryLabel: 'View Profile',
  },
];

const toApiDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const toWeeklyRange = (dateStr) => {
  if (!dateStr) return '';
  const end = new Date(dateStr + 'T00:00:00');
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endDay = end.getDate();
  const year = end.getFullYear();
  if (sameMonth) return `${startStr} – ${endDay}, ${year}`;
  const endStr = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${startStr} – ${endStr}, ${year}`;
};

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: 'rgba(255,255,255,0.7)', strokeWidth: 2, fill: 'none' }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const VoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const LastWonNotification = () => {
  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState(null);
  const [animStage, setAnimStage] = useState(0); // 0=hidden, 1=badge slides in, 2=date appears, 3=title+rest
  const [ambientColor, setAmbientColor] = useState(null); // Extracted from artwork
  const navigate = useNavigate();
  const { playMedia } = useContext(PlayerContext);
  const { user } = useAuth();
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const hasFetchedRef = useRef(false);

  const jurisdictionId = user?.jurisdiction?.jurisdictionId;

  const dismiss = useCallback(() => {
    setVisible(false);
    setAnimStage(0);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  }, []);

  // Fetch latest winners on mount (once per session)
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
              const awards = res.data || [];
              if (awards.length === 0) return null;
              const award = awards[0];
              let displayData = null;

              if (cat.type === 'song' && award.song) {
                const isWeekly = cat.key === 'song-weekly';
                displayData = {
                  category: cat,
                  title: award.song.title || 'Unknown Song',
                  artist: award.song.artist?.username || 'Unknown Artist',
                  jurisdiction: award.jurisdiction?.name || 'Unknown',
                  date: isWeekly ? toWeeklyRange(award.awardDate) : toDisplayDate(award.awardDate),
                  image: buildUrl(award.song.artworkUrl) || buildUrl(award.song.artist?.photoUrl),
                  songData: award.song,
                  navigateTo: `/song/${award.song.songId || award.targetId}`,
                };
              } else if (cat.type === 'artist' && award.user) {
                displayData = {
                  category: cat,
                  title: award.user.username || 'Unknown Artist',
                  artist: null,
                  jurisdiction: award.jurisdiction?.name || 'Unknown',
                  date: toDisplayDate(award.awardDate),
                  image: buildUrl(award.user.photoUrl),
                  navigateTo: `/artist/${award.user.userId || award.targetId}`,
                };
              }
              return displayData;
            } catch {
              return null;
            }
          })
        );

        const valid = results.filter(Boolean);
        if (valid.length === 0) return;
        const picked = valid[Math.floor(Math.random() * valid.length)];
        setNotification(picked);

        // Staggered reveal sequence
        setTimeout(() => {
          setVisible(true);
          // Stage 1: badge slides in (on card appear)
          setTimeout(() => setAnimStage(1), 400);
          // Stage 2: date fades in (1.5s after badge)
          setTimeout(() => setAnimStage(2), 1900);
          // Stage 3: title + artist + actions reveal
          setTimeout(() => setAnimStage(3), 2600);
        }, 1200);

      } catch (err) {
        console.error('LastWonNotification: Failed to fetch awards', err);
      }
    };

    fetchWinners();
  }, [jurisdictionId]);

  // Extract dominant color from artwork for ambient glow
  useEffect(() => {
    if (!notification?.image) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        setAmbientColor(`${r}, ${g}, ${b}`);
      } catch (e) {
        // CORS or canvas error — fall back to category default
        console.warn('Ambient color extraction failed:', e);
      }
    };
    img.src = notification.image;
  }, [notification?.image]);

  // Auto-dismiss timer + progress bar (starts after full reveal)
  useEffect(() => {
    if (animStage < 3) return;

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      if (progressRef.current) {
        const elapsed = Date.now() - startTime;
        const pct = Math.max(0, 100 - (elapsed / DISPLAY_DURATION) * 100);
        progressRef.current.style.width = `${pct}%`;
      }
    }, 30);

    timerRef.current = setTimeout(dismiss, DISPLAY_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [animStage, dismiss]);

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
      const mediaObj = {
        type: 'song',
        id: song.songId,
        url: buildUrl(song.fileUrl),
        title: song.title,
        artist: song.artist?.username || 'Unknown',
        artwork: buildUrl(song.artworkUrl),
      };
      playMedia(mediaObj, [mediaObj]);
    } else if (notification?.navigateTo) {
      navigate(notification.navigateTo);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) dismiss();
  };

  if (!notification) return null;

  const cat = notification.category;

  return (
    <div className={`lwn-overlay ${visible ? 'lwn-visible' : ''}`} onClick={handleOverlayClick}>
      <div
        className="lwn-card"
        style={ambientColor ? {
          background: `linear-gradient(180deg, rgba(${ambientColor}, 0.15) 0%, rgba(${ambientColor}, 0.08) 30%, #0a0a0c 70%, #0a0a0c 100%)`
        } : undefined}
      >

        {/* Ambient glow layers — inline styles so rgb interpolation works */}
        {ambientColor && (
          <>
            <div
              className="lwn-ambient-glow lwn-ambient-glow-top"
              style={{ background: `radial-gradient(circle, rgba(${ambientColor}, 0.4) 0%, transparent 70%)` }}
            />
            <div
              className="lwn-ambient-glow lwn-ambient-glow-bottom"
              style={{ background: `radial-gradient(circle, rgba(${ambientColor}, 0.25) 0%, transparent 70%)` }}
            />
            <div
              className="lwn-ambient-glow lwn-ambient-glow-edge"
              style={{ background: `linear-gradient(180deg, rgba(${ambientColor}, 0.15) 0%, transparent 60%)` }}
            />
          </>
        )}

        {/* Card-wide ambient tint overlay */}
        {ambientColor && (
          <div
            className="lwn-ambient-tint"
            style={{ background: `linear-gradient(180deg, rgba(${ambientColor}, 0.08) 0%, transparent 40%, rgba(${ambientColor}, 0.05) 100%)` }}
          />
        )}

        {/* ── Hero artwork ── */}
        <div className="lwn-hero">
          {notification.image ? (
            <img src={notification.image} alt={notification.title} className="lwn-hero-img" />
          ) : (
            <div className="lwn-hero-placeholder" />
          )}
          {/* Hero fade uses ambient color for seamless blend */}
          <div
            className="lwn-hero-fade"
            style={ambientColor ? {
              background: `linear-gradient(to top, rgba(10, 12, 24, 0.95) 0%, rgba(${ambientColor}, 0.2) 50%, transparent 100%)`
            } : undefined}
          />
          <div className="lwn-hero-vignette" />

          {/* Close button */}
          <button className="lwn-close" onClick={dismiss} aria-label="Dismiss">
            <CloseIcon />
          </button>
        </div>

        {/* ── Content ── */}
        <div className="lwn-content">

          {/* Unis logo — with ambient glow */}
          <img
            src={unisLogo}
            alt="UNIS"
            className="lwn-logo"
            style={ambientColor ? { filter: `drop-shadow(0 0 16px rgba(${ambientColor}, 0.5))` } : undefined}
          />

          {/* Badge — slides in from left */}
          <div
            className={`lwn-tag ${animStage >= 1 ? 'lwn-tag-visible' : ''}`}
            style={ambientColor ? {
              background: `rgba(${ambientColor}, 0.12)`,
              borderColor: `rgba(${ambientColor}, 0.3)`,
              color: `rgba(${ambientColor}, 1)`,
              filter: `brightness(1.6)`
            } : undefined}
          >
            <span className="lwn-tag-icon">{cat.icon}</span>
            {cat.badge}
          </div>

          {/* Date — fades in after badge */}
          <div className={`lwn-date ${animStage >= 2 ? 'lwn-date-visible' : ''}`}>
            {notification.date}
          </div>

          {/* Title + artist — reveals after date */}
          <div className={`lwn-title-block ${animStage >= 3 ? 'lwn-title-visible' : ''}`}>
            <h2 className="lwn-title">{notification.title}</h2>
            {notification.artist && (
              <p
                className="lwn-artist"
                style={ambientColor ? { color: `rgb(${ambientColor})`, filter: 'brightness(1.5)' } : undefined}
              >
                {notification.artist}
              </p>
            )}
          </div>

          {/* Jurisdiction badge */}
          <div className={`lwn-jurisdiction ${animStage >= 3 ? 'lwn-jurisdiction-visible' : ''}`}>
            {notification.jurisdiction.toUpperCase()}
          </div>

          {/* Action buttons */}
          <div className={`lwn-actions ${animStage >= 3 ? 'lwn-actions-visible' : ''}`}>
            <button className="lwn-btn-primary" onClick={handleVote}>
              <VoteIcon />
              Vote Now
            </button>
            <button className="lwn-btn-secondary" onClick={handleSecondary}>
              <PlayIcon />
              {cat.secondaryLabel}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="lwn-progress">
          <div
            className="lwn-pfill"
            ref={progressRef}
            style={{
              width: '100%',
              background: ambientColor
                ? `linear-gradient(90deg, rgba(${ambientColor}, 0.6), rgba(${ambientColor}, 1))`
                : 'linear-gradient(90deg, #163387, #4ea8f5)'
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default LastWonNotification;