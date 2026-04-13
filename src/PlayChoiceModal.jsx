import React, { useContext, useEffect } from 'react';
import { PlayerContext } from './context/playercontext';
import './PlayChoiceModal.scss';

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
    const onKey = (e) => { if (e.key === 'Escape') cancelPlayChoice(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, cancelPlayChoice]);

  if (!open || !song) return null;

  const artwork = song.artwork || song.artworkUrl;
  const title = song.title || 'Untitled';
  const artist = song.artist || song.artistData?.username || 'Unknown';

  return (
    <div className="pcm-backdrop" onClick={cancelPlayChoice}>
      <div className="pcm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pcm-header">
          {artwork && (
            <div className="pcm-artwork">
              <img src={artwork} alt={title} />
            </div>
          )}
          <div className="pcm-info">
            <div className="pcm-eyebrow">Add to your queue</div>
            <div className="pcm-title">{title}</div>
            <div className="pcm-artist">{artist}</div>
          </div>
        </div>

        <div className="pcm-actions">
          <button className="pcm-btn pcm-btn-primary" onClick={confirmPlayNow}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <polygon points="5,3 19,12 5,21" fill="currentColor" />
            </svg>
            Play Now
          </button>
          <button className="pcm-btn pcm-btn-secondary" onClick={confirmAddToQueue}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add to Queue
          </button>
          <button className="pcm-btn pcm-btn-ghost" onClick={cancelPlayChoice}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayChoiceModal;