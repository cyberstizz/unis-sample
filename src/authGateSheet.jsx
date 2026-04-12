import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './authGateSheet.scss';

// ─── Gate contexts: each defines the messaging when triggered ───
const GATE_CONTEXTS = {
  vote: {
    icon: '🗳️',
    accent: 'your voice matters',
    headline: 'Sign up to vote',
    subtext: 'Voting decides which artists and songs win daily and weekly awards in your community.',
  },
  earnings: {
    icon: '💰',
    accent: 'start earning',
    headline: 'Earn while you listen',
    subtext: 'Unis members earn passive ad revenue just by listening — even when the music isn\'t playing.',
  },
  wallet: {
    icon: '👛',
    accent: 'your money, your music',
    headline: 'Unlock your wallet',
    subtext: 'Track your earnings, withdraw funds, and see how your support flows to artists.',
  },
  profile: {
    icon: '👤',
    accent: 'make it yours',
    headline: 'Create your profile',
    subtext: 'Follow artists, save favorites, and rep your jurisdiction.',
  },
  generic: {
    icon: '🎵',
    accent: 'join the movement',
    headline: 'Sign up to unlock Unis',
    subtext: 'Get the full experience — vote, earn, and support your local artists.',
  },
};

// ─── Value props shown on every gate ───
const PERKS = [
  {
    icon: '🎧',
    title: 'Earn passively',
    detail: 'Ad revenue flows to you just for being a member',
  },
  {
    icon: '🏆',
    title: 'Vote on winners',
    detail: 'Pick the Song & Artist of the Day in your area',
  },
  {
    icon: '🤝',
    title: 'Refer & earn more',
    detail: 'Earn 10% of your referrals\' ad revenue',
  },
];

/**
 * AuthGateSheet — context-aware bottom sheet for gating features.
 *
 * Usage:
 *   import AuthGateSheet, { useAuthGate } from './AuthGateSheet';
 *
 *   // In your component:
 *   const { triggerGate, gateProps } = useAuthGate();
 *
 *   const handleVoteClick = () => {
 *     if (!user) {
 *       triggerGate('vote');
 *       return;
 *     }
 *     // normal vote flow
 *   };
 *
 *   return (
 *     <>
 *       { ... }
 *       <AuthGateSheet {...gateProps} />
 *     </>
 *   );
 */

// ─── Hook for triggering the gate from anywhere ───
export const useAuthGate = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState('generic');

  const triggerGate = useCallback((ctx = 'generic') => {
    setContext(ctx);
    setIsOpen(true);
  }, []);

  const closeGate = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    triggerGate,
    gateProps: { isOpen, context, onClose: closeGate },
  };
};

// ─── Passive listening tracker (session-level) ───
let sessionSongCount = 0;
export const incrementGateSongCount = () => {
  sessionSongCount++;
};
export const getGateSongCount = () => sessionSongCount;

const AuthGateSheet = ({ isOpen, context = 'generic', onClose }) => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const sheetRef = useRef(null);

  const ctx = GATE_CONTEXTS[context] || GATE_CONTEXTS.generic;
  const songCount = getGateSongCount();

  // Animate in/out
  useEffect(() => {
    if (isOpen) {
      // Force reflow before adding visible class
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleSignUp = () => {
    onClose();
    navigate('/createaccount');
  };

  const handleSignIn = () => {
    onClose();
    navigate('/login');
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`ags-backdrop ${visible ? 'ags-backdrop-visible' : ''}`}
        onClick={handleBackdropClick}
      />

      {/* Sheet */}
      <div
        className={`ags-sheet ${visible ? 'ags-sheet-visible' : ''}`}
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ctx.headline}
      >
        <div className="ags-handle" />

        <div className="ags-body">
          {/* Context icon */}
          <div className="ags-context-icon">{ctx.icon}</div>

          {/* Headline with handwritten accent */}
          <p className="ags-headline-accent">{ctx.accent}</p>
          <h2 className="ags-headline">{ctx.headline}</h2>
          <p className="ags-subtext">{ctx.subtext}</p>

          {/* Listening stat — only show if they've played songs */}
          {songCount > 0 && (
            <div className="ags-stat">
              <span className="ags-stat-number">{songCount}</span>
              song{songCount !== 1 ? 's' : ''} listened to — sign up to start earning from every play
            </div>
          )}

          {/* Value props */}
          <div className="ags-perks">
            {PERKS.map((perk, i) => (
              <div className="ags-perk" key={i}>
                <div className="ags-perk-icon">{perk.icon}</div>
                <div className="ags-perk-text">
                  {perk.title}
                  <span>{perk.detail}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="ags-actions">
            <button className="ags-btn-primary" onClick={handleSignUp}>
              Create Free Account
            </button>
            <button className="ags-btn-signin" onClick={handleSignIn}>
              Already have an account? Sign in
            </button>
            <button className="ags-btn-text" onClick={onClose}>
              Continue browsing
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthGateSheet;