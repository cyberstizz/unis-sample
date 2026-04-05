// src/components/QueuePanel.jsx
import React, { useContext, useState } from 'react';
import { PlayerContext } from './context/playercontext';
import { X, GripVertical, Trash2, Save, ListX, Shuffle } from 'lucide-react';
import './queuePanel.scss';

const QueuePanel = ({ open, onClose }) => {
  const {
    queue, currentIndex, queueSource, currentMedia,
    removeFromQueue, reorderQueue, clearQueue, saveQueueAsPlaylist,
    playMedia, isShuffled, toggleShuffle,
  } = useContext(PlayerContext);

  const [draggingIndex, setDraggingIndex] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleDragStart = (e, index) => {
    if (index === currentIndex) return; // can't drag the currently playing track
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, overIndex) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === overIndex) return;

    const newQueue = [...queue];
    const [removed] = newQueue.splice(draggingIndex, 1);
    newQueue.splice(overIndex, 0, removed);
    reorderQueue(newQueue);
    setDraggingIndex(overIndex);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  const handlePlay = (index) => {
    if (queue[index]) {
      playMedia(queue[index], queue, queueSource);
    }
  };

  const handleRemove = (e, index) => {
    e.stopPropagation();
    if (index === currentIndex) return;
    removeFromQueue(index);
  };

  const handleSaveAsPlaylist = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await saveQueueAsPlaylist(saveName.trim());
      setSaveModalOpen(false);
      setSaveName('');
    } catch (error) {
      console.error('Failed to save queue:', error);
      alert('Failed to save queue as playlist');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (queue.length === 0) return;
    if (confirm('Clear the entire queue? Playback will stop.')) {
      clearQueue();
    }
  };

  const formatDuration = (d) => {
    if (!d && d !== 0) return '';
    const sec = Number(d);
    if (isNaN(sec)) return '';
    return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
  };

  const upcomingCount = queue.length - currentIndex - 1;

  return (
    <div className="qp-overlay" onClick={onClose}>
      <div className="qp-container" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="qp-header">
          <div>
            <h3>Queue</h3>
            <p className="qp-sub">
              {queue.length} song{queue.length !== 1 ? 's' : ''}
              {upcomingCount > 0 && ` · ${upcomingCount} upcoming`}
              {queueSource && <span className="qp-source"> · from {queueSource}</span>}
            </p>
          </div>
          <button className="qp-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Actions */}
        <div className="qp-actions">
          <button
            className={`qp-action-btn ${isShuffled ? 'qp-active' : ''}`}
            onClick={toggleShuffle}
            disabled={queue.length < 2}
            title={isShuffled ? 'Unshuffle' : 'Shuffle'}
          >
            <Shuffle size={16} />
            {isShuffled ? 'Shuffled' : 'Shuffle'}
          </button>

          <button
            className="qp-action-btn"
            onClick={() => setSaveModalOpen(true)}
            disabled={queue.length === 0}
            title="Save queue as playlist"
          >
            <Save size={16} /> Save as Playlist
          </button>

          <button
            className="qp-action-btn qp-action-danger"
            onClick={handleClear}
            disabled={queue.length === 0}
            title="Clear queue"
          >
            <ListX size={16} /> Clear
          </button>
        </div>

        {/* Queue list */}
        <div className="qp-body">
          {queue.length === 0 ? (
            <div className="qp-empty">
              <p>Your queue is empty</p>
              <p className="qp-empty-hint">Play a song or add tracks with "Play Next" or "Play Later"</p>
            </div>
          ) : (
            <div className="qp-list">
              {queue.map((track, index) => {
                const isCurrent = index === currentIndex;
                const isPast = index < currentIndex;

                return (
                  <div
                    key={`${track.songId || track.id}-${index}`}
                    className={`qp-item ${isCurrent ? 'qp-current' : ''} ${isPast ? 'qp-past' : ''} ${draggingIndex === index ? 'qp-dragging' : ''}`}
                    draggable={!isCurrent}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handlePlay(index)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="qp-left">
                      {!isCurrent ? (
                        <GripVertical className="qp-grip" size={16} />
                      ) : (
                        <div className="qp-now-playing">
                          <span className="qp-bar" /><span className="qp-bar" /><span className="qp-bar" />
                        </div>
                      )}
                      <img
                        src={track.artworkUrl || track.artwork || '/assets/placeholder.jpg'}
                        alt=""
                        className="qp-art"
                      />
                    </div>

                    <div className="qp-meta">
                      <div className="qp-title">{track.title || 'Untitled'}</div>
                      <div className="qp-artist">{track.artist || track.artistName || 'Unknown'}</div>
                    </div>

                    <div className="qp-right">
                      <span className="qp-duration">{formatDuration(track.duration)}</span>
                      {!isCurrent && (
                        <button
                          className="qp-remove"
                          onClick={(e) => handleRemove(e, index)}
                          title="Remove from queue"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Save as Playlist modal */}
        {saveModalOpen && (
          <div className="qp-save-modal">
            <div className="qp-save-content">
              <h4>Save Queue as Playlist</h4>
              <input
                type="text"
                placeholder="Playlist name..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSaveAsPlaylist()}
                autoFocus
              />
              <div className="qp-save-actions">
                <button onClick={() => { setSaveModalOpen(false); setSaveName(''); }}>Cancel</button>
                <button onClick={handleSaveAsPlaylist} disabled={!saveName.trim() || saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QueuePanel;