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

  if (!context) {
    throw new Error('useReward must be used within a RewardProvider');
  }

  return context;
};

export const RewardProvider = ({ children }) => {
  const [rewards, setRewards] = useState([]);
  const timeoutRefs = useRef({});

  const removeReward = useCallback((id) => {
    setRewards((prev) => prev.filter((reward) => reward.id !== id));

    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }
  }, []);

  const showReward = useCallback(
    ({
      points,
      label = 'Points earned',
      type = 'default',
      anchor = 'player',
    }) => {
      if (!points && points !== 0) return;

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

      timeoutRefs.current[id] = window.setTimeout(() => {
        removeReward(id);
      }, 1600);
    },
    [removeReward]
  );

  return (
    <RewardContext.Provider value={{ showReward }}>
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
                duration: 0.72,
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