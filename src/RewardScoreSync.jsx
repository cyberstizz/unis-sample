import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useReward } from './context/RewardContext';

const RewardScoreSync = () => {
  const { user, isGuest } = useAuth();
  const { setScoreTotal } = useReward();

  const score =
    user?.score ??
    user?.totalScore ??
    user?.points ??
    user?.userScore;

  useEffect(() => {
    if (!user || isGuest || score == null) return;
    setScoreTotal(score);
  }, [user?.userId, score, isGuest, setScoreTotal]);

  return null;
};

export default RewardScoreSync;