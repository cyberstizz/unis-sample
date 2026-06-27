import React, { useContext, useState, useEffect, useRef } from 'react';
import { PlayerContext } from './context/playercontext';
import {
  ChevronDown, GripVertical, Trash2, Bookmark, ListX, Shuffle,
  SkipBack, SkipForward, Play, Pause, Repeat, Repeat1, MoreHorizontal, User,
} from 'lucide-react'; // ★ expanded icon set for the transport + header
import './queuePanel.scss';

const QueuePanel = ({ open, onClose, user = null }) => { // ★ optional `user` for the header avatar
  const {
    queue, currentIndex, queueSource, currentMedia,
    removeFromQueue, reorderQueue, clearQueue, saveQueueAsPlaylist,
    playMedia,
    isShuffled, toggleShuffle,
    isPlaying, togglePlayPause, next, prev, // ★ real transport wiring
    repeatMode, cycleRepeat,                // ★ new repeat support from context
    audioRef,                              // ★ for the live scrubber
  } = useContext(PlayerContext);

  const [draggingIndex, setDraggingIndex] = useState(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);   // ★ overflow menu (Save / Clear)
  const [closing, setClosing] = useState(false);     // ★ slide-out on dismiss
  const [progress, setProgress] = useState(0);        // ★ scrubber 0..1
  const [elapsed, setElapsed] = useState(0);          // ★ seconds
  const [duration, setDuration] = useState(0);        // ★ seconds

  const currentRowRef = useRef(null);
  const seekRef = useRef(null);

  // ★ Live scrubber — mirror the real <audio> element so the queue can't drift
  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio || !open) return;
    const sync = () => {
      const d = audio.duration;
      if (d && isFinite(d)) {
        setDuration(d);
        setElapsed(audio.currentTime);
        setProgress(Math.min(1, audio.currentTime / d));
      }
    };
    sync();
    audio.addEventListener('timeupdate', sync);
    audio.addEventListener('loadedmetadata', sync);
    return () => {
      audio.removeEventListener('timeupdate', sync);
      audio.removeEventListener('loadedmetadata', sync);
    };
  }, [open, audioRef, currentMedia]);

  // ★ When the panel opens, bring the now-playing row into view
  useEffect(() => {
    if (open && currentRowRef.current) {
      currentRowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  // ★ Close the overflow menu on any outside interaction
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  if (!open && !closing) return null; // ★ stay mounted through the exit animation

  // ★ animated dismiss — gives the "slide back out" feel on mobile + desktop
  const handleClose = () => {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose?.(); }, 280);
  };

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

  const handleDragEnd = () => setDraggingIndex(null);

  // ★ jump within the existing queue WITHOUT resetting shuffle / original order
  const handlePlay = (index) => {
    if (queue[index]) playMedia(queue[index]);
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
    if (confirm('Clear the entire queue? Playback will stop.')) clearQueue();
  };

  // ★ live scrubber seek — click or drag anywhere on the bar
  const seekTo = (clientX) => {
    const audio = audioRef?.current;
    const bar = seekRef.current;
    if (!audio || !bar || !audio.duration || !isFinite(audio.duration)) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
    setElapsed(audio.currentTime);
  };

  const onSeekDown = (e) => {
    seekTo(e.clientX);
    const move = (ev) => seekTo(ev.clientX);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // list durations are stored in ms (matches your existing convention)
  const formatDuration = (d) => {
    if (!d && d !== 0) return '';
    const ms = Number(d);
    if (isNaN(ms)) return '';
    const sec = ms / 1000;
    return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
  };

  // ★ seconds → m:ss for the live scrubber (audio.currentTime is in seconds)
  const fmtClock = (sec) => {
    if (!sec || !isFinite(sec)) return '0:00';
    return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
  };

  const upcomingCount = Math.max(0, queue.length - currentIndex - 1);
  const nowPlaying = currentMedia || queue[currentIndex] || null; // ★
  const remaining = duration ? duration - elapsed : 0;

  // ★ avatar fallback chain: photo → initial → icon
  const avatarUrl = user?.avatarUrl || user?.photoUrl || null;
  const initial = (user?.name || user?.displayName || '').trim().charAt(0).toUpperCase();

  const repeatTitle =
    repeatMode === 'one' ? 'Repeat one' : repeatMode === 'all' ? 'Repeat all' : 'Repeat off';

  return (
    <div className={`qp-overlay ${closing ? 'qp-closing' : ''}`} onClick={handleClose}>
      <div className="qp-container" onClick={(e) => e.stopPropagation()}>

        {/* ★ grab handle — tap to dismiss (swipe-to-dismiss is an easy follow-up) */}
        <button className="qp-grab" onClick={handleClose} aria-label="Close queue" />

        {/* Header: dismiss · title · avatar */}
        <div className="qp-header">
          <button className="qp-icon-btn" onClick={handleClose} aria-label="Close queue">
            <ChevronDown size={22} />
          </button>

          <div className="qp-head-title">
            <h3>Queue</h3>
            <p className="qp-sub">
              {queue.length} song{queue.length !== 1 ? 's' : ''}
              {upcomingCount > 0 && ` · ${upcomingCount} upcoming`}
            </p>
          </div>

          <div className="qp-avatar" title={user?.name || 'You'}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" />
              : initial
                ? <span>{initial}</span>
                : <User size={18} />}
          </div>
        </div>

        {/* ★ Now Playing cockpit — hero + scrubber + transport */}
        {nowPlaying && (
          <div className="qp-now">
            <div className="qp-now-top">
              <img
                className="qp-now-art"
                src={nowPlaying.artworkUrl || nowPlaying.artwork || '/assets/placeholder.jpg'}
                alt=""
              />
              <div className="qp-now-meta">
                <span className="qp-now-kicker">Now playing</span>
                <div className="qp-now-title">{nowPlaying.title || nowPlaying.name || 'Untitled'}</div>
                <div className="qp-now-artist">
                  {nowPlaying.artist || nowPlaying.artistName || 'Unknown'}
                  {queueSource && <span className="qp-source"> · {queueSource}</span>}
                </div>
              </div>
            </div>

            <div className="qp-seek">
              <div
                className="qp-seek-bar"
                ref={seekRef}
                onPointerDown={onSeekDown}
                role="slider"
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <div className="qp-seek-fill" style={{ width: `${Math.round(progress * 100)}%` }}>
                  <span className="qp-seek-knob" />
                </div>
              </div>
              <div className="qp-seek-times">
                <span>{fmtClock(elapsed)}</span>
                <span>-{fmtClock(remaining)}</span>
              </div>
            </div>

            <div className="qp-transport">
              <button
                className={`qp-tbtn ${isShuffled ? 'qp-on' : ''}`}
                onClick={toggleShuffle}
                disabled={queue.length < 2}
                title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
                aria-pressed={isShuffled}
              >
                <Shuffle size={19} />
              </button>

              <button className="qp-tbtn qp-skip" onClick={prev} title="Previous" aria-label="Previous">
                <SkipBack size={24} />
              </button>

              <button
                className="qp-play"
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>

              <button className="qp-tbtn qp-skip" onClick={next} title="Next" aria-label="Next">
                <SkipForward size={24} />
              </button>

              <button
                className={`qp-tbtn ${repeatMode !== 'off' ? 'qp-on' : ''}`}
                onClick={cycleRepeat}
                title={repeatTitle}
                aria-label={repeatTitle}
              >
                {repeatMode === 'one' ? <Repeat1 size={19} /> : <Repeat size={19} />}
              </button>
            </div>
          </div>
        )}

        {/* Section header + overflow (Save / Clear) */}
        <div className="qp-section">
          <div className="qp-section-l">
            <span className="qp-section-label">Up next</span>
            {upcomingCount > 0 && <span className="qp-count">{upcomingCount}</span>}
          </div>
          <div className="qp-menu-wrap">
            <button
              className="qp-overflow"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              disabled={queue.length === 0}
              aria-label="Queue options"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div className="qp-menu" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => { setMenuOpen(false); setSaveModalOpen(true); }}
                  disabled={queue.length === 0}
                >
                  <Bookmark size={16} /> Save as playlist
                </button>
                <button
                  className="qp-menu-danger"
                  onClick={() => { setMenuOpen(false); handleClear(); }}
                  disabled={queue.length === 0}
                >
                  <ListX size={16} /> Clear queue
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Queue list — single list over `queue` keeps drag/remove indices exact */}
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
                    ref={isCurrent ? currentRowRef : null}
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
                      {isCurrent ? (
                        <div className={`qp-now-playing ${isPlaying ? '' : 'qp-paused'}`}>
                          <span className="qp-bar" /><span className="qp-bar" /><span className="qp-bar" />
                        </div>
                      ) : (
                        <GripVertical className="qp-grip" size={16} />
                      )}
                      <img
                        src={track.artworkUrl || track.artwork || '/assets/placeholder.jpg'}
                        alt=""
                        className="qp-art"
                      />
                    </div>

                    <div className="qp-meta">
                      <div className="qp-title">{track.title || track.name || 'Untitled'}</div>
                      <div className="qp-artist">{track.artist || track.artistName || 'Unknown'}</div>
                    </div>

                    <div className="qp-right">
                      <span className="qp-duration">{formatDuration(track.duration)}</span>
                      {!isCurrent && (
                        <button
                          className="qp-remove"
                          onClick={(e) => handleRemove(e, index)}
                          title="Remove from queue"
                          aria-label="Remove from queue"
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
          <div className="qp-save-modal" onClick={(e) => e.stopPropagation()}>
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