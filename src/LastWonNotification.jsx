import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import { useAuth } from './context/AuthContext';
import { INTERVAL_IDS } from './utils/idMappings';
import './lastWonNotification.scss';

const DISPLAY_DURATION = 5000;

// ─── Award category definitions ───
const CATEGORIES = [
  {
    key: 'song-daily',
    type: 'song',
    intervalId: INTERVAL_IDS['daily'],
    badge: 'Song of the day',
    badgeClass: 'daily',
    icon: '🎵',
  },
  {
    key: 'song-weekly',
    type: 'song',
    intervalId: INTERVAL_IDS['weekly'],
    badge: 'Song of the week',
    badgeClass: 'weekly',
    icon: '🏆',
  },
  {
    key: 'artist-daily',
    type: 'artist',
    intervalId: INTERVAL_IDS['daily'],
    badge: 'Artist of the day',
    badgeClass: 'artist',
    icon: '👑',
  },
];

// Format date as YYYY-MM-DD for the backend's LocalDate param
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

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
      // Build date range: last 30 days to today
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const endDate = formatDate(today);
      const startDate = formatDate(thirtyDaysAgo);

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

              // Take the most recent award (first in list, assuming sorted by date desc)
              const award = awards[0];
              let displayData = null;

              if (cat.type === 'song' && award.song) {
                displayData = {
                  category: cat,
                  title: award.song.title || 'Unknown Song',
                  subtitle: `by ${award.song.artist?.username || 'Unknown'} · ${award.jurisdiction?.name || ''}`,
                  image: buildUrl(award.song.artworkUrl) || buildUrl(award.song.artist?.photoUrl),
                  stats: [
                    { value: award.weightedPoints || 0, label: 'Points' },
                    { value: award.playsCount || 0, label: 'Plays' },
                    { value: award.song.level || 'silver', label: 'Level' },
                  ],
                  songData: award.song,
                  navigateTo: `/song/${award.song.songId || award.targetId}`,
                  voteNavigate: '/voteawards',
                };
              } else if (cat.type === 'artist' && award.user) {
                displayData = {
                  category: cat,
                  title: award.user.username || 'Unknown Artist',
                  subtitle: `${award.jurisdiction?.name || ''} · ${award.user.genre?.name || 'Hip-Hop'}`,
                  image: buildUrl(award.user.photoUrl),
                  stats: [
                    { value: award.user.score || 0, label: 'Score' },
                    { value: award.user.totalPlays || 0, label: 'Plays' },
                    { value: award.user.level || 'silver', label: 'Level' },
                  ],
                  navigateTo: `/artist/${award.user.userId || award.targetId}`,
                  voteNavigate: '/voteawards',
                };
              }

              return displayData;
            } catch (err) {
              console.warn(`LastWonNotification: Failed to fetch ${cat.key}`, err);
              return null;
            }
          })
        );

        // Filter out nulls, pick one randomly
        const valid = results.filter(Boolean);
        if (valid.length === 0) {
          console.log('LastWonNotification: No award winners found for any category');
          return;
        }

        const picked = valid[Math.floor(Math.random() * valid.length)];
        setNotification(picked);

        // Small delay so the feed renders first
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
    if (notification?.voteNavigate) navigate(notification.voteNavigate);
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

  const formatStat = (val) => {
    if (typeof val === 'number') {
      return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toLocaleString();
    }
    if (typeof val === 'string') {
      return val.charAt(0).toUpperCase() + val.slice(1);
    }
    return val;
  };

  const secondaryLabel = notification.songData ? 'Listen' : 'View profile';

  return (
    <div
      className={`lwn-overlay ${visible ? 'lwn-visible' : ''}`}
      onClick={handleOverlayClick}
    >
      <div className="lwn-card">
        {notification.image && (
          <div className="lwn-ambient">
            <img src={notification.image} alt="" />
          </div>
        )}

        <div className="lwn-glass" />

        <div className="lwn-content">
          <div className="lwn-image-wrap">
            {notification.image ? (
              <img src={notification.image} alt={notification.title} />
            ) : (
              <div className="lwn-image-placeholder">
                <span>{notification.category.icon}</span>
              </div>
            )}
            <div className="lwn-image-gradient" />
          </div>

          <div className={`lwn-badge ${notification.category.badgeClass}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" style={{ fill: 'currentColor', display: 'block' }}>
              <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
            </svg>
            {notification.category.badge}
          </div>

          <button className="lwn-close" onClick={dismiss} aria-label="Dismiss">
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: 'rgba(255,255,255,0.7)', strokeWidth: 2, fill: 'none' }}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div className="lwn-body">
            <div className="lwn-crown">{notification.category.icon}</div>
            <h2 className="lwn-title">{notification.title}</h2>
            <p className="lwn-subtitle">{notification.subtitle}</p>

            <div className="lwn-stats">
              {notification.stats.map((stat, i) => (
                <div className="lwn-stat" key={i}>
                  <span className="lwn-stat-value">{formatStat(stat.value)}</span>
                  <span className="lwn-stat-label">{stat.label}</span>
                </div>
              ))}
            </div>

            <div className="lwn-actions">
              <button className="lwn-btn-primary" onClick={handleVote}>
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, display: 'block' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Vote now
              </button>
              <button className="lwn-btn-secondary" onClick={handleSecondary}>
                {secondaryLabel}
              </button>
            </div>
          </div>
        </div>

        <div className="lwn-progress">
          <div className="lwn-progress-fill" ref={progressRef} style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  );
};

export default LastWonNotification;