import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, closestCenter, KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';   // ★ real signed-in user
import { buildUrl } from './utils/buildUrl';        // ★ R2-aware URL builder
import {
  ChevronDown, GripVertical, Trash2, Bookmark, ListX, Shuffle,
  SkipBack, SkipForward, Play, Pause, Repeat, Repeat1, MoreHorizontal, User,
  ListMusic, ChevronRight, X,
} from 'lucide-react'; // ★ expanded icon set for the transport + header
import './queuePanel.scss';

// ============================================================================
// ROW HELPERS
// ============================================================================

// Queue durations are stored in milliseconds.
const formatMs = (d) => {
  if (!d && d !== 0) return '';
  const ms = Number(d);
  if (isNaN(ms)) return '';
  const sec = ms / 1000;
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
};

const artOf = (t) => buildUrl(t?.artworkUrl || t?.artwork) || '/assets/placeholder.jpg';

/**
 * The visual body of a queue row. Shared by the real row and the floating copy
 * that follows the pointer while dragging, so the two always look identical.
 */
const RowBody = ({ track, isCurrent, isPlaying, handleProps, rightSlot }) => (
  <>
    <div className="qp-left">
      {isCurrent ? (
        <div className={`qp-now-playing ${isPlaying ? '' : 'qp-paused'}`}>
          <span className="qp-bar" /><span className="qp-bar" /><span className="qp-bar" />
        </div>
      ) : (
        <button
          type="button"
          className="qp-grip"
          aria-label={`Reorder ${track.title || 'track'}`}
          onClick={(e) => e.stopPropagation()}
          {...handleProps}
        >
          <GripVertical size={16} />
        </button>
      )}
      <img src={artOf(track)} alt="" className="qp-art" />
    </div>

    <div className="qp-meta">
      <div className="qp-title">{track.title || track.name || 'Untitled'}</div>
      <div className="qp-artist">{track.artist || track.artistName || 'Unknown'}</div>
    </div>

    <div className="qp-right">{rightSlot}</div>
  </>
);

/**
 * One sortable queue entry.
 *
 * The OUTER wrapper is what the drag system moves. The inner `.qp-item` keeps
 * its own hover effect — giving them separate elements stops the CSS hover
 * shift from fighting the drag library's transforms.
 *
 * Songs that arrived together from a playlist share a coloured rail down the
 * left edge. The first song of each such group carries the group's label.
 */
const SortableQueueRow = ({
  track, index, isCurrent, isPast, isPlaying, run, confirming,
  rowRef, onPlay, onAskRemove, onConfirmRemove, onCancelConfirm,
  onAskRemoveGroup, onConfirmRemoveGroup, onOpenPlaylist, currentQid,
}) => {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: track.qid, disabled: isCurrent });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const origin = track.origin;
  const inGroup = !!(origin && origin.type === 'playlist');
  const confirmingThis = confirming?.kind === 'item' && confirming.qid === track.qid;
  const groupQids = run && inGroup ? run.qids : [];
  const removableInGroup = groupQids.filter(q => q !== currentQid);
  const confirmingGroup = confirming?.kind === 'group' && run && confirming.batchId === run.batchId && confirming.start === run.start;

  const rightSlot = confirmingThis ? (
    <div className="qp-confirm" onClick={(e) => e.stopPropagation()}>
      <span className="qp-confirm-q">Remove?</span>
      <button type="button" className="qp-confirm-cancel" onClick={onCancelConfirm}>Cancel</button>
      <button type="button" className="qp-confirm-go" onClick={() => onConfirmRemove(track.qid)} autoFocus>
        Remove
      </button>
    </div>
  ) : (
    <>
      <span className="qp-duration">{formatMs(track.duration)}</span>
      {!isCurrent && (
        <button
          type="button"
          className="qp-remove"
          onClick={(e) => { e.stopPropagation(); onAskRemove(track.qid); }}
          title="Remove from queue"
          aria-label={`Remove ${track.title || 'track'} from queue`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </>
  );

  const railClass = inGroup
    ? `qp-railed ${run?.isFirst ? 'qp-rail-first' : ''} ${run?.isLast ? 'qp-rail-last' : ''}`
    : '';

  return (
    <div
      ref={(node) => { setNodeRef(node); if (rowRef) rowRef.current = node; }}
      style={style}
      className={`qp-sortable ${railClass} ${isDragging ? 'qp-sortable-ghost' : ''}`}
    >
      {inGroup && run?.isFirst && (
        <div className={`qp-group-label ${confirmingGroup ? 'qp-group-confirming' : ''}`}>
          {confirmingGroup ? (
            <div className="qp-confirm qp-confirm-group">
              <span className="qp-confirm-q">
                Remove {removableInGroup.length} song{removableInGroup.length !== 1 ? 's' : ''} from &ldquo;{origin.name}&rdquo;?
              </span>
              <button type="button" className="qp-confirm-cancel" onClick={onCancelConfirm}>Cancel</button>
              <button
                type="button"
                className="qp-confirm-go"
                onClick={() => onConfirmRemoveGroup(removableInGroup)}
                autoFocus
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="qp-group-link"
                onClick={() => onOpenPlaylist(origin.playlistId)}
                title={`Open ${origin.name}`}
              >
                {origin.coverUrl
                  ? <img src={origin.coverUrl} alt="" className="qp-group-cover" />
                  : <span className="qp-group-cover qp-group-cover-empty"><ListMusic size={11} /></span>}
                <span className="qp-group-from">From</span>
                <span className="qp-group-name">{origin.name}</span>
                <ChevronRight size={13} className="qp-group-chev" />
              </button>
              <span className="qp-group-count">{run.count}</span>
              {removableInGroup.length > 1 && (
                <button
                  type="button"
                  className="qp-group-remove"
                  onClick={() => onAskRemoveGroup(run)}
                  title="Remove these songs from the queue"
                  aria-label={`Remove all songs from ${origin.name} in this group`}
                >
                  <X size={13} />
                  <span>Remove all</span>
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div
        className={`qp-item ${isCurrent ? 'qp-current' : ''} ${isPast ? 'qp-past' : ''} ${confirmingThis ? 'qp-item-confirming' : ''}`}
        onClick={() => { if (!confirmingThis) onPlay(index); }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault();
            onPlay(index);
          }
        }}
        role="button"
        tabIndex={0}
        aria-current={isCurrent ? 'true' : undefined}
      >
        <RowBody
          track={track}
          isCurrent={isCurrent}
          isPlaying={isPlaying}
          handleProps={{ ref: setActivatorNodeRef, ...attributes, ...listeners }}
          rightSlot={rightSlot}
        />
      </div>
    </div>
  );
};

// Smooth settle when a dragged row is released into place.
const dropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.35' } },
  }),
};

const QueuePanel = ({ open, onClose }) => { // ★ avatar now comes from useAuth, not a prop
  const { user } = useAuth(); // ★ signed-in user (same source as the header avatar)
  const {
    queue, currentIndex, currentMedia,
    removeQueueItems, moveQueueItem, clearQueue, saveQueueAsPlaylist,
    playQueueIndex,
    isShuffled, toggleShuffle,
    isPlaying, togglePlayPause, next, prev, // ★ real transport wiring
    repeatMode, cycleRepeat,                // ★ new repeat support from context
    audioRef,                              // ★ for the live scrubber
  } = useContext(PlayerContext);

  const navigate = useNavigate();
  const [activeQid, setActiveQid] = useState(null);    // row currently being dragged
  // Inline confirmation in progress:
  //   { kind: 'item',  qid }               → one song
  //   { kind: 'group', batchId, start }    → a playlist group
  //   { kind: 'clear' }                    → the whole queue
  const [confirming, setConfirming] = useState(null);
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

  // Drag sensors. Dragging starts from the grip handle only, so tapping a row
  // still plays it and scrolling the list on a phone still scrolls.
  //   Mouse    — starts after 4px of movement (a click never becomes a drag)
  //   Touch    — starts after a brief 120ms hold on the handle
  //   Keyboard — Space to lift, arrows to move, Space to drop, Esc to cancel
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Contiguous runs of songs that arrived together from one playlist add.
  // Each entry: { batchId, start, end, isFirst, isLast, count, qids }
  const runs = useMemo(() => {
    const info = new Array(queue.length);
    let i = 0;
    while (i < queue.length) {
      const batch = queue[i]?.origin?.batchId || null;
      let j = i;
      while (batch && j + 1 < queue.length && queue[j + 1]?.origin?.batchId === batch) j++;
      const qids = queue.slice(i, j + 1).map(t => t.qid);
      for (let k = i; k <= j; k++) {
        info[k] = { batchId: batch, start: i, end: j, isFirst: k === i, isLast: k === j, count: j - i + 1, qids };
      }
      i = j + 1;
    }
    return info;
  }, [queue]);

  const qids = useMemo(() => queue.map(t => t.qid), [queue]);

  // Escape cancels a pending confirmation before it closes anything else.
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setConfirming(null); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [confirming]);

  // Never reopen the panel with a stale confirmation showing.
  useEffect(() => { if (!open) setConfirming(null); }, [open]);

  if (!open && !closing) return null; // ★ stay mounted through the exit animation

  // ★ animated dismiss — gives the "slide back out" feel on mobile + desktop
  const handleClose = () => {
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose?.(); }, 280);
  };

  // ── Drag and drop ──
  // The queue changes exactly once, on drop — not on every pointer move.
  const handleDragStart = ({ active }) => {
    setConfirming(null);
    setActiveQid(active.id);
  };

  const handleDragEnd = ({ active, over }) => {
    setActiveQid(null);
    if (!over || active.id === over.id) return;
    const from = queue.findIndex(t => t.qid === active.id);
    const to = queue.findIndex(t => t.qid === over.id);
    if (from >= 0 && to >= 0) moveQueueItem(from, to);
  };

  const handleDragCancel = () => setActiveQid(null);

  const activeTrack = activeQid ? queue.find(t => t.qid === activeQid) : null;

  // Jump to an exact queue position — never re-resolved by song id, so a song
  // that appears twice always plays the copy you tapped.
  const handlePlay = (index) => {
    setConfirming(null);
    playQueueIndex(index);
  };

  // ── Removal, always confirmed in place ──
  const askRemove = (qid) => setConfirming({ kind: 'item', qid });
  const confirmRemove = (qid) => { setConfirming(null); removeQueueItems([qid]); };
  const askRemoveGroup = (run) => setConfirming({ kind: 'group', batchId: run.batchId, start: run.start });
  const confirmRemoveGroup = (groupQids) => { setConfirming(null); removeQueueItems(groupQids); };
  const cancelConfirm = () => setConfirming(null);

  const openPlaylist = (playlistId) => {
    if (!playlistId) return;
    handleClose();
    navigate(`/playlist/${playlistId}`);
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
    setConfirming({ kind: 'clear' });
  };

  const confirmClear = () => {
    setConfirming(null);
    clearQueue();
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

  // ★ seconds → m:ss for the live scrubber (audio.currentTime is in seconds)
  const fmtClock = (sec) => {
    if (!sec || !isFinite(sec)) return '0:00';
    return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
  };

  const upcomingCount = Math.max(0, queue.length - currentIndex - 1);
  const nowPlaying = currentMedia || queue[currentIndex] || null; // ★
  const remaining = duration ? duration - elapsed : 0;

  // ★ avatar fallback chain: R2 photo → username initial → icon (mirrors header.jsx)
  const avatarUrl = buildUrl(user?.photoUrl);
  const initial = user?.username ? user.username.charAt(0).toUpperCase() : '';

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

          <div className="qp-avatar" title={user?.username || 'You'}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" />
              : initial
                ? <span>{initial}</span>
                : <User size={18} />}
          </div>
        </div>

        {/* ★ Now Playing cockpit — hero + scrubber + transport */}
        {nowPlaying && (
          <div
            className="qp-now"
            style={{
              '--qp-art-bg': `url("${
                buildUrl(nowPlaying.artworkUrl || nowPlaying.artwork) ||
                '/assets/placeholder.jpg'
              }")`
            }}
          >
            <div className="qp-now-top">
              <img
                className="qp-now-art"
                src={buildUrl(nowPlaying.artworkUrl || nowPlaying.artwork) || '/assets/placeholder.jpg'}
                alt=""
              />
              <div className="qp-now-meta">
                <span className="qp-now-kicker">Now playing</span>
                <div className="qp-now-title">{nowPlaying.title || nowPlaying.name || 'Untitled'}</div>
                <div className="qp-now-artist">
                  {nowPlaying.artist || nowPlaying.artistName || 'Unknown'}
                </div>
                {nowPlaying.origin?.type === 'playlist' && (
                  <button
                    type="button"
                    className="qp-playing-from"
                    onClick={() => openPlaylist(nowPlaying.origin.playlistId)}
                    title={`Open ${nowPlaying.origin.name}`}
                  >
                    <ListMusic size={12} />
                    <span className="qp-playing-from-k">Playing from</span>
                    <span className="qp-playing-from-name">{nowPlaying.origin.name}</span>
                    <ChevronRight size={12} />
                  </button>
                )}
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
        {confirming?.kind === 'clear' ? (
          <div className="qp-section qp-section-confirm">
            <div className="qp-confirm qp-confirm-clear">
              <span className="qp-confirm-q">Clear the entire queue? Playback will stop.</span>
              <button type="button" className="qp-confirm-cancel" onClick={cancelConfirm}>Cancel</button>
              <button type="button" className="qp-confirm-go" onClick={confirmClear} autoFocus>Clear</button>
            </div>
          </div>
        ) : (
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
        )}

        {/* Queue list — single list over `queue` keeps drag/remove indices exact */}
        <div className="qp-body">
          {queue.length === 0 ? (
            <div className="qp-empty">
              <p>Your queue is empty</p>
              <p className="qp-empty-hint">Play a song or add tracks with "Play Next" or "Play Later"</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={qids} strategy={verticalListSortingStrategy}>
                <div className={`qp-list ${activeQid ? 'qp-list-dragging' : ''}`}>
                  {queue.map((track, index) => {
                    const isCurrent = index === currentIndex;
                    return (
                      <SortableQueueRow
                        key={track.qid}
                        track={track}
                        index={index}
                        isCurrent={isCurrent}
                        isPast={index < currentIndex}
                        isPlaying={isPlaying}
                        run={runs[index]}
                        confirming={confirming}
                        currentQid={queue[currentIndex]?.qid}
                        rowRef={isCurrent ? currentRowRef : null}
                        onPlay={handlePlay}
                        onAskRemove={askRemove}
                        onConfirmRemove={confirmRemove}
                        onCancelConfirm={cancelConfirm}
                        onAskRemoveGroup={askRemoveGroup}
                        onConfirmRemoveGroup={confirmRemoveGroup}
                        onOpenPlaylist={openPlaylist}
                      />
                    );
                  })}
                </div>
              </SortableContext>

              {/* The floating copy that follows the pointer. Portaled out of the
                  panel because its backdrop blur and slide animation would
                  otherwise offset a fixed-position overlay. It goes into #root,
                  not <body>, because the colour theme is set on #root and the
                  copy must match the user's chosen theme. */}
              {createPortal(
                <DragOverlay dropAnimation={dropAnimation} zIndex={1300}>
                  {activeTrack ? (
                    <div className="qp-drag-overlay">
                      <div className="qp-item qp-item-lifted">
                        <RowBody
                          track={activeTrack}
                          isCurrent={false}
                          isPlaying={isPlaying}
                          handleProps={{}}
                          rightSlot={<span className="qp-duration">{formatMs(activeTrack.duration)}</span>}
                        />
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>,
                document.getElementById('root') || document.body
              )}
            </DndContext>
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