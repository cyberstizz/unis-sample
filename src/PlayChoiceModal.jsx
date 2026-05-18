import React, { useContext, useEffect } from 'react';
import { PlayerContext } from './context/playercontext';
import './PlayChoiceModal.scss';

// ─── Inline icons (lucide-react doesn't render reliably inside buttons) ───
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <polygon points="6,4 20,12 6,20" fill="currentColor" />
  </svg>
);

const QueueIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="4" y1="7" x2="20" y2="7" />
    <line x1="4" y1="12" x2="14" y2="12" />
    <line x1="4" y1="17" x2="14" y2="17" />
    <polyline points="17 14 20 17 17 20" />
  </svg>
);

const ChevronIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

const PlayChoiceModal = () => {
  const {
    playChoiceModal,
    confirmPlayNow,
    confirmAddToQueue,
    cancelPlayChoice,
  } = useContext(PlayerContext);

  const open = playChoiceModal?.open;
  const song = playChoiceModal?.pendingSong;

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') cancelPlayChoice();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, cancelPlayChoice]);

  if (!open || !song) return null;

  const artwork = song.artwork || song.artworkUrl;
  const title = song.title || 'Untitled';
  const artist = song.artist || song.artistData?.username || 'Unknown';

  return (
    <div
      className="pcm-backdrop"
      onClick={cancelPlayChoice}
      role="presentation"
    >
      <div
        className="pcm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pcm-title"
      >
        {/* Ambient artwork backdrop — colors the modal with the song's own art */}
        {artwork && (
          <div
            className="pcm-ambient"
            style={{ backgroundImage: `url(${artwork})` }}
            aria-hidden="true"
          />
        )}
        <div className="pcm-ambient-overlay" aria-hidden="true" />

        {/* Mobile drag-handle indicator */}
        <div className="pcm-handle" aria-hidden="true" />

        {/* Header: artwork + metadata */}
        <div className="pcm-content">
          <div className="pcm-header">
            {artwork && (
              <div className="pcm-artwork">
                <img src={artwork} alt="" />
              </div>
            )}
            <div className="pcm-info">
              <div className="pcm-eyebrow">Up next</div>
              <div id="pcm-title" className="pcm-title">{title}</div>
              <div className="pcm-artist">{artist}</div>
            </div>
          </div>
        </div>

        <div className="pcm-divider" aria-hidden="true" />

        {/* Action rows — stacked, iOS-style */}
        <div className="pcm-actions">
          <button
            type="button"
            className="pcm-action"
            onClick={confirmPlayNow}
          >
            <div className="pcm-action-icon pcm-action-icon--play">
              <PlayIcon />
            </div>
            <div className="pcm-action-text">
              <div className="pcm-action-title">Play Now</div>
              <div className="pcm-action-subtitle">Start playing right away</div>
            </div>
            <span className="pcm-action-chevron" aria-hidden="true">
              <ChevronIcon />
            </span>
          </button>

          <button
            type="button"
            className="pcm-action"
            onClick={confirmAddToQueue}
          >
            <div className="pcm-action-icon pcm-action-icon--queue">
              <QueueIcon />
            </div>
            <div className="pcm-action-text">
              <div className="pcm-action-title">Add to Queue</div>
              <div className="pcm-action-subtitle">Plays after your current queue</div>
            </div>
            <span className="pcm-action-chevron" aria-hidden="true">
              <ChevronIcon />
            </span>
          </button>
        </div>

        {/* Cancel — separated, ghost surface */}
        <button
          type="button"
          className="pcm-cancel"
          onClick={cancelPlayChoice}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PlayChoiceModal;