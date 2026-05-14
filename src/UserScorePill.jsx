import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useReward } from './context/RewardContext';

const formatScore = (score) => {
  const value = Number(score) || 0;

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }

  return value.toLocaleString();
};

const UserScorePill = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { displayedScore, setScoreTotal, lastScoreBump } = useReward();

  const rawScore =
    user?.score ??
    user?.totalScore ??
    user?.points ??
    user?.userScore ??
    0;

  useEffect(() => {
    if (!user || isGuest) return;
    setScoreTotal(rawScore);
  }, [user?.userId, rawScore, isGuest, setScoreTotal]);

  if (!user || isGuest) return null;

  const safeScore = displayedScore ?? Number(rawScore) ?? 0;

  return (
    <button
      type="button"
      className={`unis-score-pill ${lastScoreBump ? 'unis-score-pill--bump' : ''}`}
      onClick={() => navigate('/profile')}
      title="View your Unis score"
      aria-label={`Your Unis score is ${safeScore}`}
    >
      <span className="unis-score-pill__orb" aria-hidden="true" />

      <span className="unis-score-pill__content">
        <span className="unis-score-pill__label">Score</span>
        <strong className="unis-score-pill__value">
          {formatScore(safeScore)}
        </strong>
      </span>

      {lastScoreBump && (
        <span className="unis-score-pill__bump">+{lastScoreBump}</span>
      )}
    </button>
  );
};

export default UserScorePill;