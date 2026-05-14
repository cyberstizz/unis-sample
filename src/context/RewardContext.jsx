import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import '../reward-pulse.scss';
import RewardScoreSync from './RewardScoreSync';

const RewardContext = createContext(null);

const MAX_REWARDS_ON_SCREEN = 4;

const createRewardId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

export const useReward = () => {
  const context = useContext(RewardContext);

  // Test-safe fallback.
  if (!context) {
    return {
      showReward: () => {},
      setScoreTotal: () => {},
      displayedScore: null,
    };
  }

  return context;
};

export const RewardProvider = ({ children }) => {
  const [rewards, setRewards] = useState([]);
  const [displayedScore, setDisplayedScore] = useState(null);

  const timeoutRefs = useRef({});

  const removeReward = useCallback((id) => {
    setRewards((prev) => prev.filter((reward) => reward.id !== id));

    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }
  }, []);

  const setScoreTotal = useCallback((score) => {
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore)) return;

    setDisplayedScore(numericScore);
  }, []);

  const showReward = useCallback(
    ({
      points,
      label = 'Points earned',
      type = 'default',
      anchor = 'player',
      scoreBefore,
      scoreAfter,
    }) => {
      if (!points && points !== 0) return;

      const numericPoints = Number(points);
      const id = createRewardId();

      let resolvedScoreBefore = null;
      let resolvedScoreAfter = null;

      setDisplayedScore((prevScore) => {
        const hasExplicitScore =
          Number.isFinite(Number(scoreBefore)) &&
          Number.isFinite(Number(scoreAfter));

        if (hasExplicitScore) {
          resolvedScoreBefore = Number(scoreBefore);
          resolvedScoreAfter = Number(scoreAfter);
          return resolvedScoreAfter;
        }

        if (
          typeof prevScore === 'number' &&
          Number.isFinite(numericPoints) &&
          numericPoints > 0
        ) {
          resolvedScoreBefore = prevScore;
          resolvedScoreAfter = prevScore + numericPoints;
          return resolvedScoreAfter;
        }

        return prevScore;
      });

      const reward = {
        id,
        points,
        label,
        type,
        anchor,
        scoreBefore: resolvedScoreBefore,
        scoreAfter: resolvedScoreAfter,
      };

      setRewards((prev) => {
        const next = [...prev, reward];
        return next.slice(-MAX_REWARDS_ON_SCREEN);
      });

      timeoutRefs.current[id] = window.setTimeout(() => {
        removeReward(id);
      }, 2600);
    },
    [removeReward]
  );

  return (
    <RewardContext.Provider
      value={{
        showReward,
        setScoreTotal,
        displayedScore,
      }}
    >
      {children}

      <div
        className="reward-pulse-layer"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence>
          {rewards.map((reward, index) => (
            <motion.div
              key={reward.id}
              className={[
                'reward-pulse',
                `reward-pulse--${reward.type}`,
                `reward-pulse--${reward.anchor}`,
              ].join(' ')}
              style={{
                '--reward-stack-index': index,
              }}
              initial={{
                opacity: 0,
                y: 14,
                scale: 0.94,
                filter: 'blur(2px)',
              }}
              animate={{
                opacity: 1,
                y: -18,
                scale: 1,
                filter: 'blur(0px)',
              }}
              exit={{
                opacity: 0,
                y: -48,
                scale: 0.97,
                filter: 'blur(2px)',
              }}
              transition={{
                duration: 0.9,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span className="reward-pulse__dot" aria-hidden="true" />

              <span className="reward-pulse__content">
                <span className="reward-pulse__mainline">
                  <span className="reward-pulse__points">+{reward.points}</span>

                  {reward.label && (
                    <span className="reward-pulse__label">{reward.label}</span>
                  )}
                </span>

                {typeof reward.scoreBefore === 'number' &&
                  typeof reward.scoreAfter === 'number' && (
                    <span className="reward-pulse__score">
                      Score {formatScore(reward.scoreBefore)} →{' '}
                      <strong>{formatScore(reward.scoreAfter)}</strong>
                    </span>
                  )}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        <RewardScoreSync />
      </div>
    </RewardContext.Provider>
  );
};