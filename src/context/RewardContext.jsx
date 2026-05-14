import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import '../reward-pulse.scss';

const RewardContext = createContext(null);

const MAX_REWARDS_ON_SCREEN = 4;

const createRewardId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useReward = () => {
  const context = useContext(RewardContext);

  // Test-safe fallback.
  // This prevents standalone component tests from crashing if they render
  // Player, Feed, VotingWizard, or UserScorePill without RewardProvider.
  if (!context) {
    return {
      showReward: () => {},
      displayedScore: null,
      setScoreTotal: () => {},
      lastScoreBump: null,
    };
  }

  return context;
};

export const RewardProvider = ({ children }) => {
  const [rewards, setRewards] = useState([]);
  const [displayedScore, setDisplayedScore] = useState(null);
  const [lastScoreBump, setLastScoreBump] = useState(null);

  const timeoutRefs = useRef({});
  const scoreBumpTimeoutRef = useRef(null);

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
    }) => {
      if (!points && points !== 0) return;

      const numericPoints = Number(points);
      const id = createRewardId();

      const reward = {
        id,
        points,
        label,
        type,
        anchor,
      };

      setRewards((prev) => {
        const next = [...prev, reward];
        return next.slice(-MAX_REWARDS_ON_SCREEN);
      });

      if (Number.isFinite(numericPoints) && numericPoints > 0) {
        setDisplayedScore((prev) => {
          if (typeof prev !== 'number') return prev;
          return prev + numericPoints;
        });

        setLastScoreBump(numericPoints);

        if (scoreBumpTimeoutRef.current) {
          clearTimeout(scoreBumpTimeoutRef.current);
        }

        scoreBumpTimeoutRef.current = window.setTimeout(() => {
          setLastScoreBump(null);
        }, 1500);
      }

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
        displayedScore,
        setScoreTotal,
        lastScoreBump,
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
              <span className="reward-pulse__points">+{reward.points}</span>

              {reward.label && (
                <span className="reward-pulse__label">{reward.label}</span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </RewardContext.Provider>
  );
};