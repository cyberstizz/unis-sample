// src/PocketLockOverlay.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, Unlock, Music2 } from 'lucide-react';
import './pocketLockOverlay.scss';

const UNLOCK_HOLD_MS = 1100;

const PocketLockOverlay = ({
  currentMedia,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  onUnlock,
  formatTime,
}) => {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  const holdStartRef = useRef(null);
  const rafRef = useRef(null);

  const artwork = useMemo(() => {
    return (
      currentMedia?.artwork ||
      currentMedia?.artworkUrl ||
      currentMedia?.coverImageUrl ||
      '/assets/placeholder.jpg'
    );
  }, [currentMedia]);

  const title = currentMedia?.title || currentMedia?.name || 'Unknown Track';
  const artist = currentMedia?.artist || currentMedia?.artistName || 'Unknown Artist';

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const stopHold = () => {
    setIsHolding(false);
    setHoldProgress(0);
    holdStartRef.current = null;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const tickHold = () => {
    if (!holdStartRef.current) return;

    const elapsed = Date.now() - holdStartRef.current;
    const nextProgress = Math.min(100, (elapsed / UNLOCK_HOLD_MS) * 100);

    setHoldProgress(nextProgress);

    if (nextProgress >= 100) {
      stopHold();
      onUnlock?.();
      return;
    }

    rafRef.current = requestAnimationFrame(tickHold);
  };

  const startHold = (e) => {
    e.preventDefault();
    e.stopPropagation();

    holdStartRef.current = Date.now();
    setIsHolding(true);
    setHoldProgress(0);

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(tickHold);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onUnlock?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onUnlock]);

  return (
    <div
      className="pocket-lock-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Pocket Lock is enabled"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="pocket-lock-bg"
        style={{ backgroundImage: `url(${artwork})` }}
        aria-hidden="true"
      />

      <div className="pocket-lock-vignette" aria-hidden="true" />

      <div className="pocket-lock-topbar">
        <div className="pocket-lock-brand" aria-label="Unis">
          <span className="pocket-lock-brand-mark">
            UN<span>i</span>S
          </span>
        </div>

        <div className="pocket-lock-status-pill">
          <Lock size={13} />
          <span>Pocket Lock</span>
        </div>
      </div>

      <div className="pocket-lock-center">
        <div className="pocket-lock-art-shell">
          <div className="pocket-lock-art-glow" aria-hidden="true" />
          <div className="pocket-lock-art">
            {artwork ? (
              <img src={artwork} alt={`${title} artwork`} />
            ) : (
              <Music2 size={54} />
            )}
          </div>
        </div>

        <div className="pocket-lock-track-copy">
          <div className="pocket-lock-now-playing">
            {isPlaying ? 'Now Playing' : 'Paused'}
          </div>

          <h1>{title}</h1>
          <p>{artist}</p>
        </div>

        <div className="pocket-lock-progress-wrap" aria-label="Playback progress">
          <div className="pocket-lock-time-row">
            <span>{formatTime?.(currentTime) || '0:00'}</span>
            <span>{formatTime?.(duration) || '0:00'}</span>
          </div>

          <div className="pocket-lock-progress">
            <div
              className="pocket-lock-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pocket-lock-bottom">
        <div className="pocket-lock-hint">
          <span className="pocket-lock-hint-dot" />
          Hold to unlock
        </div>

        <button
          type="button"
          className={`pocket-lock-unlock ${isHolding ? 'holding' : ''}`}
          onPointerDown={startHold}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onPointerLeave={stopHold}
          aria-label="Hold to unlock Pocket Lock"
        >
          <span
            className="pocket-lock-unlock-ring"
            style={{
              background: `conic-gradient(var(--unis-primary) ${holdProgress * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
            }}
            aria-hidden="true"
          />

          <span className="pocket-lock-unlock-inner">
            {holdProgress >= 96 ? <Unlock size={24} /> : <Lock size={24} />}
          </span>
        </button>

        <p className="pocket-lock-subhint">
          Music keeps playing. Controls stay protected from accidental taps.
        </p>
      </div>
    </div>
  );
};

export default PocketLockOverlay;