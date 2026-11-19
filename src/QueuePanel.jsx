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
import { useFeedback, errorMessage } from './context/FeedbackContext';
import { buildUrl } from './utils/buildUrl';        // ★ R2-aware URL builder
import {
  ChevronDown, ChevronUp, GripVertical, Trash2, Bookmark, Shuffle,
  SkipBack, SkipForward, Play, Pause, Repeat, Repeat1, User,
  ListMusic, ChevronRight, X, Heart, CheckSquare, Check, History, ListStart,
} from 'lucide-react';
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

// Seconds → "24 min" / "1 hr 12 min" / "under a minute" for the header.
const formatLeft = (sec) => {
  if (!sec || !isFinite(sec) || sec <= 0) return '';
  if (sec < 60) return 'under a minute';
  const mins = Math.round(sec / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
};

const artOf = (t) => buildUrl(t?.artworkUrl || t?.artwork) || '/assets/placeholder.jpg';

// How far a row slides open to show its Remove button (px).
const SWIPE_REVEAL = 96;

/**
 * The visual body of a queue row. Shared by the real row and the floating copy
 * that follows the pointer while dragging, so the two always look identical.
 * In select mode the grip becomes a checkbox.
 */
const RowBody = ({ track, isCurrent, isPlaying, handleProps, rightSlot, selecting, selected }) => (
  <>
    <div className="qp-left">
      {isCurrent ? (
        <div className={`qp-now-playing ${isPlaying ? '' : 'qp-paused'}`}>
          <span className="qp-bar" /><span className="qp-bar" /><span className="qp-bar" />
        </div>
      ) : selecting ? (
        <span className={`qp-check ${selected ? 'qp-check-on' : ''}`} aria-hidden="true">
          {selected && <Check size={14} strokeWidth={3} />}
        </span>
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
 * left edge. The first visible song of each such group carries its label.
 *
 * On touch screens a row can be swiped left to show a Remove button; tapping
 * that button is the confirmation, and the toast that follows offers Undo.
 */
const SortableQueueRow = ({
  track, index, isCurrent, isPast, isPlaying, run, showLabel, confirming,
  rowRef, onPlay, onAskRemove, onConfirmRemove, onCancelConfirm,
  onAskRemoveGroup, onConfirmRemoveGroup, onOpenPlaylist, currentQid,
  selecting, selected, onToggleSelect, swiped, onSwipe, onRemoveNow,
}) => {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: track.qid, disabled: isCurrent || selecting });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  // ── Swipe to remove (touch only) ──
  const [dragX, setDragX] = useState(null);   // live offset while a finger is down
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const canSwipe = !isCurrent && !selecting;
  const offset = dragX ?? (swiped ? -SWIPE_REVEAL : 0);

  const onPointerDown = (e) => {
    if (!canSwipe || e.pointerType !== 'touch') return;
    if (e.target.closest('.qp-grip, .qp-confirm, .qp-remove')) return;
    gesture.current = { x: e.clientX, y: e.clientY, base: swiped ? -SWIPE_REVEAL : 0, axis: null };
  };
  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) g.axis = 'x';
      else if (Math.abs(dy) > 8) { gesture.current = null; return; } // a scroll
      else return;
    }
    setDragX(Math.max(-SWIPE_REVEAL - 40, Math.min(0, g.base + dx)));
  };
  const endGesture = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.axis !== 'x') return;
    suppressClick.current = true;
    const opened = (dragX ?? g.base) < -SWIPE_REVEAL / 2;
    setDragX(null);
    onSwipe(opened ? track.qid : null);
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
      {!isCurrent && !selecting && (
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
    ? `qp-railed ${showLabel ? 'qp-rail-first' : ''} ${run?.isLast ? 'qp-rail-last' : ''}`
    : '';

  const handleRowClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (swiped) { onSwipe(null); return; }
    if (confirmingThis) return;
    if (selecting) { if (!isCurrent) onToggleSelect(track.qid); return; }
    onPlay(index);
  };

  const showSwipeAction = canSwipe && offset < 0;

  return (
    <div
      ref={(node) => { setNodeRef(node); if (rowRef) rowRef.current = node; }}
      style={style}
      className={`qp-sortable ${railClass} ${isDragging ? 'qp-sortable-ghost' : ''}`}
    >
      {inGroup && showLabel && (
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
              {removableInGroup.length > 1 && !selecting && (
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

      <div className={`qp-swipe ${showSwipeAction ? 'qp-swipe-open' : ''}`}>
        {showSwipeAction && (
          <button
            type="button"
            className="qp-swipe-remove"
            onClick={(e) => { e.stopPropagation(); onSwipe(null); onRemoveNow(track.qid); }}
            aria-label={`Remove ${track.title || 'track'} from queue`}
          >
            <Trash2 size={18} />
            <span>Remove</span>
          </button>
        )}
        <div
          className={[
            'qp-item',
            isCurrent ? 'qp-current' : '',
            isPast ? 'qp-past' : '',
            confirmingThis ? 'qp-item-confirming' : '',
            selecting && selected ? 'qp-item-selected' : '',
            dragX !== null ? 'qp-item-swiping' : '',
          ].join(' ')}
          style={offset ? { transform: `translateX(${offset}px)` } : undefined}
          onClick={handleRowClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
              e.preventDefault();
              handleRowClick();
            }
          }}
          role="button"
          tabIndex={0}
          aria-current={isCurrent ? 'true' : undefined}
          aria-pressed={selecting && !isCurrent ? !!selected : undefined}
        >
          <RowBody
            track={track}
            isCurrent={isCurrent}
            isPlaying={isPlaying}
            handleProps={{ ref: setActivatorNodeRef, ...attributes, ...listeners }}
            rightSlot={rightSlot}
            selecting={selecting}
            selected={selected}
          />
        </div>
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

/**
 * @param isLiked       whether the signed-in user likes the song playing now
 * @param onToggleLike  the player's like handler — shared so the heart here and
 *                      the one in the player bar can never disagree
 */
const QueuePanel = ({ open, onClose, isLiked = false, onToggleLike }) => {
  const { user } = useAuth(); // ★ signed-in user (same source as the header avatar)
  const {
    queue, currentIndex, currentMedia,
    removeQueueItems, moveQueueItem, moveQueueItemsNext, clearQueue, saveQueueAsPlaylist,
    playQueueIndex,
    isShuffled, toggleShuffle,
    isPlaying, togglePlayPause, next, prev, // ★ real transport wiring
    repeatMode, cycleRepeat,                // ★ new repeat support from context
    audioRef,                              // ★ for the live scrubber
  } = useContext(PlayerContext);

  const navigate = useNavigate();
  const feedback = useFeedback();
  const [activeQid, setActiveQid] = useState(null);    // row currently being dragged

  // Inline confirmation in progress:
  //   { kind: 'item',  qid }               → one song
  //   { kind: 'group', batchId, start }    → a playlist group
  //   { kind: 'clear' }                    → the whole queue
  const [confirming, setConfirming] = useState(null);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);     // ★ slide-out on dismiss
  const [progress, setProgress] = useState(0);        // ★ scrubber 0..1
  const [elapsed, setElapsed] = useState(0);          // ★ seconds
  const [duration, setDuration] = useState(0);        // ★ seconds

  const [selecting, setSelecting] = useState(false);  // select mode on/off
  const [selected, setSelected] = useState(() => new Set());
  const [showPlayed, setShowPlayed] = useState(false); // played songs unfolded
  const [swipedQid, setSwipedQid] = useState(null);    // row slid open to Remove

  const currentRowRef = useRef(null);
  const seekRef = useRef(null);

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

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
      currentRowRef.current.scrollIntoView?.({ block: 'nearest' });
    }
  }, [open]);

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

  // Songs already played fold into one "Played" row until it's opened.
  const playedCount = Math.min(currentIndex, queue.length);
  const firstVisible = showPlayed ? 0 : playedCount;
  const visibleQids = useMemo(
    () => queue.slice(firstVisible).map(t => t.qid),
    [queue, firstVisible],
  );

  // Selection never outlives the songs in it.
  useEffect(() => {
    if (selected.size === 0) return;
    const present = new Set(queue.map(t => t.qid));
    const current = queue[currentIndex]?.qid;
    let changed = false;
    const next = new Set();
    selected.forEach((q) => { if (present.has(q) && q !== current) next.add(q); else changed = true; });
    if (changed) setSelected(next);
  }, [queue, currentIndex, selected]);

  // Escape cancels a pending confirmation, then leaves select mode, before it
  // closes anything else.
  useEffect(() => {
    if (!confirming && !selecting) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (confirming) setConfirming(null);
      else exitSelect();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [confirming, selecting]);

  // Never reopen the panel mid-confirmation, mid-selection or slid open.
  useEffect(() => {
    if (!open) {
      setConfirming(null);
      setSelecting(false);
      setSelected(new Set());
      setSwipedQid(null);
      setShowPlayed(false);
    }
  }, [open]);

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
    setSwipedQid(null);
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

  // ── Removal: confirmed in place on desktop, by the swipe on phones ──
  // Either way the toast that follows can undo it.
  const askRemove = (qid) => setConfirming({ kind: 'item', qid });
  const confirmRemove = (qid) => { setConfirming(null); removeQueueItems([qid]); };
  const removeNow = (qid) => removeQueueItems([qid]);
  const askRemoveGroup = (run) => setConfirming({ kind: 'group', batchId: run.batchId, start: run.start });
  const confirmRemoveGroup = (groupQids) => { setConfirming(null); removeQueueItems(groupQids); };
  const cancelConfirm = () => setConfirming(null);

  // ── Select mode ──
  const currentQid = queue[currentIndex]?.qid;
  const selectableQids = queue.slice(firstVisible).map(t => t.qid).filter(q => q !== currentQid);

  const enterSelect = () => {
    setConfirming(null);
    setSwipedQid(null);
    setSelected(new Set());
    setSelecting(true);
  };
  const toggleSelect = (qid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid); else next.add(qid);
      return next;
    });
  };
  const allSelected = selectableQids.length > 0 && selectableQids.every(q => selected.has(q));
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(selectableQids));
  const removeSelected = () => {
    if (selected.size === 0) return;
    removeQueueItems([...selected]);
    exitSelect();
  };
  const playSelectedNext = () => {
    if (selected.size === 0) return;
    moveQueueItemsNext([...selected]);
    exitSelect();
  };

  const openPlaylist = (playlistId) => {
    if (!playlistId) return;
    handleClose();
    navigate(`/playlist/${playlistId}`);
  };

  const handleSaveAsPlaylist = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    const name = saveName.trim();
    try {
      const playlistId = await saveQueueAsPlaylist(name);
      setSaveModalOpen(false);
      setSaveName('');
      feedback.success(`Saved your queue as “${name}”`, playlistId ? {
        action: { label: 'View', onClick: () => openPlaylist(playlistId) },
      } : undefined);
    } catch (error) {
      console.error('Failed to save queue:', error);
      feedback.error(errorMessage(error, "Couldn't save your queue as a playlist. Try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    if (queue.length === 0) return;
    setSwipedQid(null);
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

  // Listening time left: the rest of this song plus everything after it.
  // Repeat-one never ends, so it gets no figure.
  const upcomingSec = queue
    .slice(currentIndex + 1)
    .reduce((sum, t) => sum + (Number(t.duration) || 0) / 1000, 0);
  const currentLeftSec = duration
    ? Math.max(0, remaining)
    : (Number(queue[currentIndex]?.duration) || 0) / 1000;
  const timeLeft = repeatMode === 'one' ? '' : formatLeft(upcomingSec + currentLeftSec);

  // ★ avatar fallback chain: R2 photo → username initial → icon (mirrors header.jsx)
  const avatarUrl = buildUrl(user?.photoUrl);
  const initial = user?.username ? user.username.charAt(0).toUpperCase() : '';

  const repeatTitle =
    repeatMode === 'one' ? 'Repeat one' : repeatMode === 'all' ? 'Repeat all' : 'Repeat off';

  const endNote =
    repeatMode === 'one' ? 'Repeat one is on · this song keeps playing'
      : repeatMode === 'all' ? 'End of queue · repeat all starts it over'
        : 'End of queue · playback stops here';

  return (
    <div className={`qp-overlay ${closing ? 'qp-closing' : ''}`} onClick={handleClose}>
      <div
        className={`qp-container ${selecting ? 'qp-selecting' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ★ grab handle — tap to dismiss */}
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
              {timeLeft && <> · <span className="qp-time-left">{timeLeft} left</span></>}
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

        {/* ★ Now Playing cockpit — hero + scrubber + transport.
            The artwork's blur runs past the bottom theme line (.qp-now-bleed)
            and fades into the panel, so the stage is framed top and bottom. */}
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
            <div className="qp-now-bleed" aria-hidden="true" />
            <div className="qp-now-shade" aria-hidden="true" />

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
              {onToggleLike && (
                <button
                  type="button"
                  className={`qp-like ${isLiked ? 'qp-like-on' : ''}`}
                  onClick={onToggleLike}
                  aria-pressed={isLiked}
                  aria-label={isLiked ? 'Unlike this song' : 'Like this song'}
                  title={isLiked ? 'Liked' : 'Like'}
                >
                  <Heart size={21} fill={isLiked ? 'currentColor' : 'none'} />
                </button>
              )}
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
                aria-label={isShuffled ? 'Shuffle on' : 'Shuffle off'}
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

            <div className="qp-now-edge" aria-hidden="true" />
          </div>
        )}

        {/* Section header — the queue's own actions, always in view */}
        {confirming?.kind === 'clear' ? (
          <div className="qp-section qp-section-confirm">
            <div className="qp-confirm qp-confirm-clear">
              <span className="qp-confirm-q">Clear the entire queue? Playback will stop.</span>
              <button type="button" className="qp-confirm-cancel" onClick={cancelConfirm}>Cancel</button>
              <button type="button" className="qp-confirm-go" onClick={confirmClear} autoFocus>Clear</button>
            </div>
          </div>
        ) : selecting ? (
          <div className="qp-section">
            <div className="qp-section-l">
              <span className="qp-section-label" aria-live="polite">
                {selected.size > 0 ? `${selected.size} selected` : 'Select songs'}
              </span>
            </div>
            <div className="qp-chips">
              <button
                type="button"
                className="qp-chip"
                onClick={toggleSelectAll}
                disabled={selectableQids.length === 0}
              >
                {allSelected ? 'None' : 'All'}
              </button>
              <button type="button" className="qp-chip qp-chip-strong" onClick={exitSelect}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="qp-section">
            <div className="qp-section-l">
              <span className="qp-section-label">Up next</span>
              {upcomingCount > 0 && <span className="qp-count">{upcomingCount}</span>}
            </div>
            <div className="qp-chips">
              <button
                type="button"
                className="qp-chip"
                onClick={enterSelect}
                disabled={queue.length < 2}
              >
                <CheckSquare size={14} /> Select
              </button>
              <button
                type="button"
                className="qp-chip"
                onClick={() => setSaveModalOpen(true)}
                disabled={queue.length === 0}
                aria-label="Save queue as playlist"
              >
                <Bookmark size={14} /> Save
              </button>
              <button
                type="button"
                className="qp-chip qp-chip-danger"
                onClick={handleClear}
                disabled={queue.length === 0}
                aria-label="Clear queue"
              >
                Clear
              </button>
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
            <>
              {playedCount > 0 && (
                <button
                  type="button"
                  className={`qp-played-toggle ${showPlayed ? 'qp-played-open' : ''}`}
                  onClick={() => setShowPlayed((s) => !s)}
                  aria-expanded={showPlayed}
                >
                  <History size={16} />
                  <span>Played · {playedCount} song{playedCount !== 1 ? 's' : ''}</span>
                  {showPlayed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <SortableContext items={visibleQids} strategy={verticalListSortingStrategy}>
                  <div className={`qp-list ${activeQid ? 'qp-list-dragging' : ''}`}>
                    {queue.map((track, index) => {
                      if (index < firstVisible) return null;
                      const isCurrent = index === currentIndex;
                      const run = runs[index];
                      // A group whose first songs are folded away shows its
                      // label on its first visible song instead.
                      const showLabel = !!run && (run.isFirst || (index === firstVisible && run.start < firstVisible));
                      return (
                        <React.Fragment key={track.qid}>
                          {isCurrent && showPlayed && playedCount > 0 && (
                            <div className="qp-now-divider" aria-hidden="true"><span>Now playing</span></div>
                          )}
                          <SortableQueueRow
                            track={track}
                            index={index}
                            isCurrent={isCurrent}
                            isPast={index < currentIndex}
                            isPlaying={isPlaying}
                            run={run}
                            showLabel={showLabel}
                            confirming={confirming}
                            currentQid={currentQid}
                            rowRef={isCurrent ? currentRowRef : null}
                            onPlay={handlePlay}
                            onAskRemove={askRemove}
                            onConfirmRemove={confirmRemove}
                            onCancelConfirm={cancelConfirm}
                            onAskRemoveGroup={askRemoveGroup}
                            onConfirmRemoveGroup={confirmRemoveGroup}
                            onOpenPlaylist={openPlaylist}
                            selecting={selecting}
                            selected={selected.has(track.qid)}
                            onToggleSelect={toggleSelect}
                            swiped={swipedQid === track.qid}
                            onSwipe={setSwipedQid}
                            onRemoveNow={removeNow}
                          />
                        </React.Fragment>
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

              <div className="qp-end">
                <span className="qp-end-line" aria-hidden="true" />
                <span>{endNote}</span>
                <span className="qp-end-line" aria-hidden="true" />
              </div>
            </>
          )}
        </div>

        {/* Select mode action bar */}
        {selecting && (
          <div className="qp-select-bar" role="toolbar" aria-label="Selected songs">
            <button
              type="button"
              className="qp-select-next"
              onClick={playSelectedNext}
              disabled={selected.size === 0}
            >
              <ListStart size={17} /> Play next
            </button>
            <button
              type="button"
              className="qp-select-remove"
              onClick={removeSelected}
              disabled={selected.size === 0}
            >
              <Trash2 size={16} /> Remove{selected.size > 0 ? ` ${selected.size}` : ''}
            </button>
          </div>
        )}

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
                onKeyDown={(e) => e.key === 'Enter' && handleSaveAsPlaylist()}
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
