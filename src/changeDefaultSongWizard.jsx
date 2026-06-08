import React, { useState } from 'react';
import { X, Music, Check, Star } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import buildUrl from './utils/buildUrl';
import './changeDefaultSongWizard.scss';

const ChangeDefaultSongWizard = ({
  show,
  onClose,
  songs = [],
  currentDefaultSongId,
  onSuccess,
}) => {
  const [selectedSongId, setSelectedSongId] = useState(currentDefaultSongId || null);
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleSave = async () => {
    if (selectedSongId === currentDefaultSongId) {
      onClose();
      return;
    }
    setLoading(true);
    try {
      await apiCall({
        method: 'patch',
        url: '/v1/users/default-song',
        data: { defaultSongId: selectedSongId },
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to update featured song:', err);
      alert('Failed to update featured song. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // NOTE: kept the original /60000 formula (duration appears to be ms). If it's
  // actually seconds this reads low — flag if the displayed minutes look wrong.
  const formatDuration = (d) =>
    Number.isFinite(d) && d > 0 ? `${(d / 60000).toFixed(1)} min` : null;

  const empty = !songs || songs.length === 0;

  return (
    <div
      className="cdsw-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Set featured song"
    >
      <div className="cdsw-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cdsw-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <header className="cdsw-head">
          <span className="cdsw-eyebrow">
            <Star size={12} /> Featured song
          </span>
          <h2>{empty ? 'No songs yet' : 'Set your featured song'}</h2>
          <p>
            {empty
              ? 'Upload your first song to set the track that represents you across Unis.'
              : 'This track plays first whenever someone opens your artist presence across Unis.'}
          </p>
        </header>

        {empty ? (
          <div className="cdsw-empty">
            <div className="cdsw-empty__icon">
              <Music size={30} />
            </div>
            <button type="button" className="cdsw-btn cdsw-btn--primary" onClick={onClose}>
              Got it
            </button>
          </div>
        ) : (
          <>
            <div className="cdsw-list">
              {songs.map((song) => {
                const id = song.songId || song.id;
                const isSelected = id === selectedSongId;
                const art = buildUrl(song.artworkUrl);
                const plays = song.playCount ?? song.plays ?? 0;
                const dur = formatDuration(song.duration);

                return (
                  <button
                    type="button"
                    key={id}
                    className={`cdsw-song ${isSelected ? 'cdsw-song--selected' : ''}`}
                    onClick={() => setSelectedSongId(id)}
                    aria-pressed={isSelected}
                  >
                    {art ? (
                      <img src={art} alt="" className="cdsw-song__art" />
                    ) : (
                      <span className="cdsw-song__art cdsw-song__art--placeholder">
                        <Music size={24} />
                      </span>
                    )}

                    <span className="cdsw-song__meta">
                      <span className="cdsw-song__title">{song.title}</span>
                      <span className="cdsw-song__sub">
                        {plays.toLocaleString()} plays{dur ? ` · ${dur}` : ''}
                      </span>
                    </span>

                    <span className={`cdsw-song__check ${isSelected ? 'is-on' : ''}`} aria-hidden="true">
                      {isSelected ? <Check size={16} strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>

            <footer className="cdsw-actions">
              <button type="button" className="cdsw-btn cdsw-btn--ghost" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="cdsw-btn cdsw-btn--primary"
                onClick={handleSave}
                disabled={loading || !selectedSongId || selectedSongId === currentDefaultSongId}
              >
                {loading ? 'Saving…' : 'Save featured'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
};

export default ChangeDefaultSongWizard;