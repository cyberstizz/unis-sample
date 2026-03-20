import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import { useAuth } from './context/AuthContext';
import { INTERVAL_IDS } from './utils/idMappings';
import unisLogo from './assets/unisLogoThree.svg';
import './lastWonNotification.scss';

const DISPLAY_DURATION = 5000;

// ─── Award category definitions ───
const CATEGORIES = [
  {
    key: 'song-daily',
    type: 'song',
    intervalId: INTERVAL_IDS['daily'],
    badge: 'Song of the day',
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
    badge: 'Song of the week',
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
    badge: 'Artist of the day',
    badgeClass: 'lwn-tag-artist',
    bgClass: 'lwn-bg-artist',
    fillClass: 'lwn-pfill-artist',
    icon: '👑',
    secondaryLabel: 'View profile',
  },
];

// Format date as YYYY-MM-DD for backend LocalDate param
const toApiDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Format date for display: "March 19, 2026"
const toDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

// Format weekly range: "March 14 – 20, 2026"
const toWeeklyRange = (dateStr) => {
  if (!dateStr) return '';
  const end = new Date(dateStr + 'T00:00:00');
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (sameMonth) {
    return `${startStr} – ${endDay}, ${year}`;
  }
  const endStr = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${startStr} – ${endStr}, ${year}`;
};

const StarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" style={{ fill: 'currentColor', display: 'block' }}>
    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, display: 'block' }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'rgba(255,255,255,0.6)', strokeWidth: 2, fill: 'none' }}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);


const LastWonNotification = () => {
  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState(null);
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

              // Most recent award first
              const award = awards[0];
              let displayData = null;

              if (cat.type === 'song' && award.song) {
                const isWeekly = cat.key === 'song-weekly';
                displayData = {
                  category: cat,
                  title: award.song.title || 'Unknown Song',
                  jurisdiction: award.jurisdiction?.name || 'Unknown',
                  date: isWeekly
                    ? toWeeklyRange(award.awardDate)
                    : toDisplayDate(award.awardDate),
                  image: buildUrl(award.song.artworkUrl) || buildUrl(award.song.artist?.photoUrl),
                  songData: award.song,
                  navigateTo: `/song/${award.song.songId || award.targetId}`,
                };
              } else if (cat.type === 'artist' && award.user) {
                displayData = {
                  category: cat,
                  title: award.user.username || 'Unknown Artist',
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

        // Delay so feed renders first
        setTimeout(() => setVisible(true), 1200);
      } catch (err) {
        console.error('LastWonNotification: Failed to fetch awards', err);
      }
    };

    fetchWinners();
  }, [jurisdictionId]);

  // Auto-dismiss timer + progress bar
  useEffect(() => {
    if (!visible) return;

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
    <div
      className={`lwn-overlay ${visible ? 'lwn-visible' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className="lwn-card">
        {/* Controlled gradient background */}
        <div className={`lwn-bg ${cat.bgClass}`} />

        {/* Close button */}
        <button className="lwn-close" onClick={dismiss} aria-label="Dismiss">
          <CloseIcon />
        </button>

        {/* Two-column layout */}
        <div className="lwn-layout">

          {/* LEFT — text content */}
          <div className="lwn-left">
            <div className="lwn-left-top">
              <div className="lwn-top-row">
                <img
                src={unisLogo}
                alt="UNIS"
                className="lwn-logo"
                />
              </div>

              <div className={`lwn-tag ${cat.badgeClass}`}>
                <StarIcon />
                {cat.badge}
              </div>

              <div className="lwn-date">{notification.date}</div>
              <h2 className="lwn-name">{notification.title}</h2>
              <p className="lwn-jurisdiction">{notification.jurisdiction}</p>
            </div>

            <div className="lwn-actions">
              <button className="lwn-btn-primary" onClick={handleVote}>
                <CheckIcon />
                Vote now
              </button>
              <button className="lwn-btn-secondary" onClick={handleSecondary}>
                {cat.secondaryLabel}
              </button>
            </div>
          </div>

          {/* RIGHT — artwork */}
          <div className="lwn-right">
            {notification.image ? (
              <>
                <img src={notification.image} alt={notification.title} />
                <div className="lwn-right-fade" />
              </>
            ) : (
              <div className="lwn-right-placeholder" />
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="lwn-progress">
          <div className={`lwn-pfill ${cat.fillClass}`} ref={progressRef} style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  );
};

export default LastWonNotification;