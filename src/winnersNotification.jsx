import React, { useState, useEffect } from 'react';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';
import { buildUrl } from './utils/buildUrl';
import './winnersNotification.scss';

// ─── Thresholds ──────────────────────────────────────────────
// These control when different message tiers trigger.
// Tune these as your user base grows.
const THRESHOLDS = {
  COMPETITIVE: 3,   // Leader needs 3+ votes AND a challenger within 2 votes
  ACTIVE: 1,        // At least 1 vote exists somewhere
};

// ─── Message builders ────────────────────────────────────────
// Each returns { title, message, icon, color } or null to skip.

const buildCompetitiveMessage = (leader, runnerUp, totalVotes) => {
  // Close race: runner-up within 2 votes of leader
  const gap = leader.votes - (runnerUp?.votes || 0);
  const isCloseRace = runnerUp && gap <= 2 && runnerUp.votes >= 1;

  if (isCloseRace) {
    return {
      icon: '⚔️',
      title: 'Close Race',
      message: `${leader.name} and ${runnerUp.name} are neck and neck for Artist of the Day — just ${gap === 0 ? 'tied' : `${gap} vote${gap === 1 ? '' : 's'} apart`}!`,
      color: '#FF6B6B',
      artwork: leader.artwork,
    };
  }

  // Clear leader with meaningful votes
  return {
    icon: '🏆',
    title: 'Current Leader',
    message: `${leader.name} is leading for Artist of the Day with ${leader.votes} vote${leader.votes === 1 ? '' : 's'}. ${totalVotes} total vote${totalVotes === 1 ? '' : 's'} cast today.`,
    color: '#FFD700',
    artwork: leader.artwork,
  };
};

const buildActiveMessage = (leader, totalVotes, jurisdictionName) => {
  // Low but nonzero activity — encourage participation
  return {
    icon: '🗳️',
    title: 'Polls Are Open',
    message: `${totalVotes} vote${totalVotes === 1 ? '' : 's'} cast so far today in ${jurisdictionName}. Every vote counts — make yours heard!`,
    color: '#4ea8f5',
    artwork: leader?.artwork || null,
  };
};

const buildZeroActivityMessage = (jurisdictionName) => {
  // No votes at all — don't mention any artists by name
  return {
    icon: '🎵',
    title: 'Voting Is Open',
    message: `Today's Artist of the Day polls are open in ${jurisdictionName}. Be the first to cast your vote!`,
    color: '#9D4EDD',
    artwork: null,
  };
};

const buildFallbackMessage = () => {
  // Generic welcome — API failed or no artists exist
  return {
    icon: '🎵',
    title: 'Welcome to Unis',
    message: 'Check out the leaderboards and support your favorite local artists.',
    color: '#163387',
    artwork: null,
  };
};

// ─── Evaluate data and pick the right message ────────────────
const selectNotification = (leaderboardData, jurisdictionName) => {
  if (!leaderboardData || leaderboardData.length === 0) {
    return buildFallbackMessage();
  }

  const leader = leaderboardData[0];
  const runnerUp = leaderboardData.length > 1 ? leaderboardData[1] : null;
  const totalVotes = leaderboardData.reduce((sum, entry) => sum + (entry.votes || 0), 0);

  // Tier 1: Competitive — leader has 3+ votes
  if (leader.votes >= THRESHOLDS.COMPETITIVE) {
    return buildCompetitiveMessage(leader, runnerUp, totalVotes);
  }

  // Tier 2: Active — at least some votes exist
  if (totalVotes >= THRESHOLDS.ACTIVE) {
    return buildActiveMessage(leader, totalVotes, jurisdictionName);
  }

  // Tier 3: Zero activity — no votes at all
  return buildZeroActivityMessage(jurisdictionName);
};

// ═════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════
const WinnersNotification = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (!user) return;

    // "Once per day" check — keyed to EST date so it aligns with vote resets
    const getEstDateString = () => {
      return new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    };

    const storageKey = 'winnersNotificationShown';
    const lastShown = localStorage.getItem(storageKey);
    const todayEst = getEstDateString();

    if (lastShown === todayEst) return;

    const fetchAndShow = async () => {
      const jurisdictionId = user.jurisdiction?.jurisdictionId || '00000000-0000-0000-0000-000000000003';
      const jurisdictionName = user.jurisdiction?.name || 'your area';
      const genreId = user.genre?.genreId || '00000000-0000-0000-0000-000000000101';

      try {
        const response = await apiCall({
          method: 'get',
          url: `/v1/vote/leaderboards?jurisdictionId=${jurisdictionId}&genreId=${genreId}&targetType=artist&intervalId=00000000-0000-0000-0000-000000000201&limit=5`,
        });

        const leaderboardData = (response.data || []).map((entry) => ({
          name: entry.name || entry.username || 'Unknown',
          votes: entry.votes || entry.voteCount || 0,
          artwork: buildUrl(entry.artwork || entry.photoUrl || entry.artworkUrl) || null,
        }));

        const picked = selectNotification(leaderboardData, jurisdictionName);
        setNotification(picked);
      } catch (err) {
        console.error('WinnersNotification: API failed', err);
        setNotification(buildFallbackMessage());
      }

      setShow(true);
      localStorage.setItem(storageKey, todayEst);

      // Auto-dismiss after 6 seconds
      setTimeout(() => setShow(false), 6000);
    };

    // Small delay so it doesn't compete with page load
    const timer = setTimeout(fetchAndShow, 2000);
    return () => clearTimeout(timer);
  }, [user]);

  if (!show || !notification) return null;

  return (
    <div className="winners-notification">
      <div className="winners-card" style={{ '--border-color': notification.color }}>
        {notification.artwork && (
          <img
            src={notification.artwork}
            alt=""
            className="notification-artwork"
          />
        )}
        <div className="notification-content">
          <div className="notification-header">
            <span className="notification-icon">{notification.icon}</span>
            <h3>{notification.title}</h3>
          </div>
          <p>{notification.message}</p>
        </div>
        <button className="notification-dismiss" onClick={() => setShow(false)} aria-label="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
};

export default WinnersNotification;