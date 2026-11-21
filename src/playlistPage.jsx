// src/playlistPage.jsx
//
// The playlist page — /playlist/:playlistId
//
// v2 design (Nov 2026, Scout → Sketch → Ship; canvas "Unis playlist +
// library pages"):
//   • The cover sets the mood: it washes the top of the page, blended with
//     the theme (Apple Music / YouTube Music moved to artwork-driven pages).
//   • Never lose the playing song: a Now playing chip and the bar's line jump
//     to its row (Spotify's longest-running complaint).
//   • Find in playlist + Sort sit right above the songs. Drag-to-reorder only
//     works in Custom order with no filter, so what you drag is what's saved.
//   • The bar that follows you (shared FollowBar): cover, name, Shuffle, and
//     Play once the page's own Play has scrolled away.
//   • Same action row grammar as the artist page.
//
// How it relates to the queue:
//   • Play (and clicking any row) POURS the playlist into the queue. It never
//     replaces the queue. If the queue already has songs, the same prompt used
//     for single songs asks "Play now" (insert after the current song) or
//     "Add to queue" (append at the end).
//   • Once a playlist is playing, Play becomes pause/resume, and clicking a row
//     jumps to that song inside the copy already in the queue — no re-prompt,
//     no duplicates.
//   • Editing this page (reorder, remove) changes the saved playlist. Editing
//     the queue never touches the playlist. They are separate on purpose.

import React, { useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  DndContext, DragOverlay, closestCenter, KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import {
  Play, Pause, Shuffle, MoreHorizontal, Heart, Clock, Music, GripVertical,
  ListPlus, Disc3, UserRound, Link2, Pencil, ImagePlus, Trash2, ThumbsUp, ThumbsDown,
  Lock, Globe, EyeOff, MapPin, X, ListMusic, Share2, ArrowLeft, ArrowDown,
  ChevronDown, Search, ArrowUpDown,
} from 'lucide-react';
import FollowBar from './components/FollowBar';
import { useFollowBar } from './hooks/useFollowBar';
import Layout from './layout';
import AdSlot from './components/AdSlot';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import axiosInstance from './components/axiosInstance';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import { buildUrl } from './utils/buildUrl';
import './playlistPage.scss';

// ============================================================================
// FORMATTERS
// ============================================================================

// Song durations arrive in milliseconds; older rows may be in seconds.
// Anything over an hour is treated as milliseconds (same rule the old viewer used).
const toSeconds = (d) => {
  let sec = Number(d);
  if (!d || isNaN(sec)) return 0;
  if (sec > 3600) sec = sec / 1000;
  return sec;
};

const formatTrackTime = (d) => {
  const sec = toSeconds(d);
  if (!sec) return '';
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
};

const formatTotal = (tracks) => {
  const total = Math.round(tracks.reduce((sum, t) => sum + toSeconds(t.duration), 0));
  if (!total) return '';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} hr ${m} min`;
  if (m > 0) return s ? `${m} min ${s} sec` : `${m} min`;
  return `${s} sec`;
};

const formatAdded = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 28) {
    const w = Math.floor(days / 7);
    return `${w} week${w > 1 ? 's' : ''} ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const normalizeTrack = (track) => ({
  ...track,
  id: track.songId || track.id,
  songId: track.songId || track.id,
  playlistItemId: track.playlistItemId,
  title: track.title || 'Untitled',
  artist: track.artistName || track.artist || 'Unknown Artist',
  artistName: track.artistName || track.artist || 'Unknown Artist',
  artworkUrl: buildUrl(track.artworkUrl),
  artwork: buildUrl(track.artworkUrl),
  fileUrl: buildUrl(track.fileUrl),
  url: buildUrl(track.fileUrl),
  duration: track.duration || 0,
  upvotes: track.upvotes || 0,
  downvotes: track.downvotes || 0,
  status: track.status || 'active',
});

const SORTS = [
  { id: 'custom', label: 'Custom order' },
  { id: 'title', label: 'Title' },
  { id: 'artist', label: 'Artist' },
  { id: 'added', label: 'Recently added' },
];

// ============================================================================
// TRACK ROW
// ============================================================================

const TrackRow = ({
  track, index, num, canEdit, canDrag, isCurrentRow, isPlaying, menuOpen, confirmingRemove,
  onPlay, onToggleMenu, onAddToQueue, onGoSong, onGoArtist,
  onAskRemove, onConfirmRemove, onCancelRemove,
}) => {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: track.playlistItemId || track.id, disabled: !canDrag });

  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`plp-row-wrap ${isDragging ? 'plp-row-ghost' : ''}`}
      data-row-key={track.playlistItemId || track.id}
    >
      <div
        className={`plp-row ${isCurrentRow ? 'plp-row-current' : ''} ${canDrag ? 'plp-row-editable' : ''} ${confirmingRemove ? 'plp-row-confirming' : ''}`}
        onClick={() => { if (!confirmingRemove) onPlay(index); }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter') && e.target === e.currentTarget) { e.preventDefault(); onPlay(index); }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Play ${track.title} by ${track.artist}`}
      >
        {canDrag && (
          <button
            type="button"
            className="plp-grip"
            ref={setActivatorNodeRef}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Reorder ${track.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </button>
        )}

        <div className="plp-col-index">
          {isCurrentRow && isPlaying ? (
            <span className="plp-eq" aria-label="Now playing">
              <span /><span /><span />
            </span>
          ) : (
            <>
              <span className="plp-index-num">{num}</span>
              <span className="plp-index-play" aria-hidden="true">
                {isCurrentRow ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              </span>
            </>
          )}
        </div>

        <div className="plp-col-title">
          <img
            src={track.artworkUrl || '/assets/placeholder.jpg'}
            alt=""
            className="plp-art"
            loading="lazy"
          />
          <div className="plp-title-text">
            <div className="plp-track-title">{track.title}</div>
            <button
              type="button"
              className="plp-track-artist"
              onClick={(e) => { e.stopPropagation(); onGoArtist(track); }}
              disabled={!track.artistId}
            >
              {track.artist}
            </button>
          </div>
        </div>

        <div className="plp-col-added">{formatAdded(track.addedAt)}</div>

        {confirmingRemove ? (
          <div className="plp-confirm" onClick={(e) => e.stopPropagation()}>
            <span className="plp-confirm-q">Remove from playlist?</span>
            <button type="button" className="plp-confirm-cancel" onClick={onCancelRemove}>Cancel</button>
            <button type="button" className="plp-confirm-go" onClick={() => onConfirmRemove(track)} autoFocus>
              Remove
            </button>
          </div>
        ) : (
          <>
            <div className="plp-col-time">{formatTrackTime(track.duration)}</div>
            <div className="plp-col-menu">
              <button
                type="button"
                className={`plp-row-menu-btn ${menuOpen ? 'plp-open' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleMenu(track); }}
                aria-label={`More options for ${track.title}`}
                aria-expanded={menuOpen}
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && (
                <div className="plp-menu plp-row-menu" onClick={(e) => e.stopPropagation()} role="menu">
                  <button type="button" role="menuitem" onClick={() => onAddToQueue(track)}>
                    <ListPlus size={16} /> Add to queue
                  </button>
                  <button type="button" role="menuitem" onClick={() => onGoSong(track)}>
                    <Disc3 size={16} /> Go to song
                  </button>
                  {track.artistId && (
                    <button type="button" role="menuitem" onClick={() => onGoArtist(track)}>
                      <UserRound size={16} /> Go to artist
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <div className="plp-menu-sep" />
                      <button
                        type="button"
                        role="menuitem"
                        className="plp-menu-danger"
                        onClick={() => onAskRemove(track)}
                      >
                        <Trash2 size={16} /> Remove from playlist
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const dropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }),
};

// ============================================================================
// PAGE
// ============================================================================

const PlaylistPage = () => {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    loadPlaylistDetails, requestPlayCollection, playQueueIndex, playLater,
    queue, currentMedia, isPlaying, togglePlayPause,
    removeFromPlaylist, reorderPlaylist, updatePlaylist, deletePlaylist,
    followPlaylist, unfollowPlaylist, voteOnSuggestion,
  } = useContext(PlayerContext);

  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [pending, setPending] = useState([]);
  const [status, setStatus] = useState('loading');          // loading | ready | unavailable
  const [section, setSection] = useState('tracks');          // tracks | suggestions | activity
  const [activities, setActivities] = useState([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [coverError, setCoverError] = useState(false);

  const [menu, setMenu] = useState(null);                    // { kind: 'header' } | { kind: 'row', key }
  const [confirmRemoveKey, setConfirmRemoveKey] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState('private');
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeKey, setActiveKey] = useState(null);

  const coverInputRef = useRef(null);

  // Find in playlist + Sort (v2)
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('custom');

  // ★ The bar that follows you (shared frame: components/FollowBar.jsx).
  const bar = useFollowBar({ ready: status === 'ready' });

  // ── Load ──
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus('loading');
      setSection('tracks');
      setActivities([]);
      setActivityLoaded(false);
      setCoverError(false);
      setMenu(null);
      setConfirmRemoveKey(null);

      const data = await loadPlaylistDetails(playlistId);
      if (cancelled) return;
      if (!data) {
        setStatus('unavailable');
        return;
      }
      const all = (data.tracks || []).map(normalizeTrack);
      setPlaylist(data);
      setTracks(all.filter(t => t.status === 'active'));
      setPending([]);
      setStatus('ready');

      // The playlist response only carries songs already IN the playlist.
      // Pending suggestions come from their own endpoint — without this call
      // the Suggestions tab was always empty and nobody could vote.
      if (data.type === 'community') {
        try {
          const res = await axiosInstance.get(`/v1/playlists/${data.playlistId || playlistId}/pending`);
          if (!cancelled) setPending((res.data || []).map(normalizeTrack));
        } catch (err) {
          console.error('Failed to load suggestions:', err);
        }
      }
    };
    load();
    return () => { cancelled = true; };
    // loadPlaylistDetails is recreated each render in the context; keying on the id is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId]);

  // ── Close menus on outside click / Escape ──
  useEffect(() => {
    if (!menu && !confirmRemoveKey) return;
    const onClick = () => setMenu(null);
    const onKey = (e) => {
      if (e.key === 'Escape') { setMenu(null); setConfirmRemoveKey(null); }
    };
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, confirmRemoveKey]);

  // Every action on this page answers through the app-wide feedback toasts.
  const feedback = useFeedback();
  const showToast = useCallback((msg, kind = 'success') => feedback[kind](msg), [feedback]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Derived ──
  const pid = playlist?.playlistId || playlist?.id || playlistId;
  const isOwner = !!(playlist?.isOwner ?? playlist?.owner);          // Jackson may drop the "is" prefix
  const isFollowing = !!(playlist?.isFollowing ?? playlist?.following);
  const isCommunity = playlist?.type === 'community';
  const isOfficial = playlist?.type === 'official';
  const canFollow = !!user && !isOwner && playlist?.visibility !== 'private';

  const coverUrl = playlist?.coverImageUrl && !coverError ? buildUrl(playlist.coverImageUrl) : null;

  // Up to four distinct artworks for a mosaic when there's no uploaded cover
  const mosaic = useMemo(() => {
    const seen = [];
    for (const t of tracks) {
      if (t.artworkUrl && !seen.includes(t.artworkUrl)) seen.push(t.artworkUrl);
      if (seen.length === 4) break;
    }
    return seen;
  }, [tracks]);

  const heroImage = coverUrl || mosaic[0] || null;

  const playable = useMemo(() => tracks.filter(t => t.url || t.fileUrl), [tracks]);

  const playlistRef = useMemo(() => ({
    playlistId: pid,
    name: playlist?.name || 'Playlist',
    coverUrl: coverUrl || mosaic[0] || null,
  }), [pid, playlist?.name, coverUrl, mosaic]);

  // Is the song playing right now one that came from THIS playlist?
  const playingFromHere = !!(currentMedia?.origin?.type === 'playlist' && currentMedia.origin.playlistId === pid);
  const currentItemId = playingFromHere ? currentMedia.playlistItemId : null;

  const rowKey = (t) => t.playlistItemId || t.id;
  const totalLabel = formatTotal(tracks);

  // What the list shows: filtered and sorted, each with its saved position.
  const visibleTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tracks.map((t, i) => ({ t, i }));
    if (q) list = list.filter(({ t }) => `${t.title} ${t.artist}`.toLowerCase().includes(q));
    if (sort === 'title') list = [...list].sort((a, b) => a.t.title.localeCompare(b.t.title));
    else if (sort === 'artist') list = [...list].sort((a, b) => a.t.artist.localeCompare(b.t.artist) || a.t.title.localeCompare(b.t.title));
    else if (sort === 'added') list = [...list].sort((a, b) => (Date.parse(b.t.addedAt) || 0) - (Date.parse(a.t.addedAt) || 0));
    return list;
  }, [tracks, query, sort]);

  // Reordering saves the order you see, so it only works in the saved order.
  const canDrag = isOwner && sort === 'custom' && !query.trim();
  const currentTrack = currentItemId ? tracks.find((t) => t.playlistItemId === currentItemId) : null;
  const sortLabel = (SORTS.find((o) => o.id === sort) || SORTS[0]).label;

  // ── Never lose the playing song: scroll its row into view ──
  const jumpToNowPlaying = () => {
    if (!currentItemId) return;
    const go = () => {
      const key = window.CSS?.escape ? window.CSS.escape(String(currentItemId)) : String(currentItemId);
      const el = document.querySelector(`[data-row-key="${key}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.querySelector('.plp-row')?.focus({ preventScroll: true });
    };
    const needsRender = section !== 'tracks' || !!query.trim();
    if (section !== 'tracks') setSection('tracks');
    if (query.trim()) setQuery('');
    if (needsRender) setTimeout(go, 80); else go();
  };

  // ── Playback ──
  const handleHeroPlay = () => {
    if (playingFromHere) { togglePlayPause(); return; }
    if (playable.length === 0) return;
    requestPlayCollection({ tracks: playable, playlist: playlistRef });
  };

  const handleShufflePlay = () => {
    if (playable.length === 0) return;
    requestPlayCollection({ tracks: playable, playlist: playlistRef, shuffle: true });
  };

  const handleRowPlay = (index) => {
    const track = tracks[index];
    if (!track) return;

    // The clicked song is the one playing → pause/resume it.
    if (playingFromHere && currentItemId && currentItemId === track.playlistItemId) {
      togglePlayPause();
      return;
    }

    // This playlist is already in the queue and playing → jump inside that copy
    // rather than prompting again and adding duplicates.
    if (playingFromHere) {
      const batch = currentMedia.origin.batchId;
      const qi = queue.findIndex(q => q.origin?.batchId === batch && q.playlistItemId === track.playlistItemId);
      if (qi >= 0) { playQueueIndex(qi); return; }
    }

    const startIndex = playable.indexOf(track);
    if (startIndex < 0) { showToast('This song is unavailable right now', 'info'); return; }
    requestPlayCollection({ tracks: playable, playlist: playlistRef, startIndex });
  };

  const handleAddOneToQueue = (track) => {
    setMenu(null);
    playLater(track, {
      type: 'playlist',
      playlistId: pid,
      name: playlistRef.name,
      coverUrl: playlistRef.coverUrl,
      batchId: `single-${track.playlistItemId || track.id}-${Date.now()}`,
    });
    // The player confirms "Added … to your queue".
  };

  // ── Owner: reorder ──
  const handleDragStart = ({ active }) => {
    setMenu(null);
    setConfirmRemoveKey(null);
    setActiveKey(active.id);
  };

  const handleDragEnd = async ({ active, over }) => {
    setActiveKey(null);
    if (!over || active.id === over.id) return;
    const from = tracks.findIndex(t => rowKey(t) === active.id);
    const to = tracks.findIndex(t => rowKey(t) === over.id);
    if (from < 0 || to < 0) return;

    const before = tracks;
    const after = arrayMove(tracks, from, to);
    setTracks(after);
    try {
      await reorderPlaylist(pid, after);
      showToast('Order saved');
    } catch {
      setTracks(before);
      showToast("Couldn't save the new order. Try again.", 'error');
    }
  };

  const activeTrack = activeKey ? tracks.find(t => rowKey(t) === activeKey) : null;

  // ── Owner: remove ──
  const askRemove = (track) => {
    setMenu(null);
    setConfirmRemoveKey(rowKey(track));
  };

  const confirmRemove = async (track) => {
    setConfirmRemoveKey(null);
    const before = tracks;
    setTracks(prev => prev.filter(t => rowKey(t) !== rowKey(track)));
    try {
      await removeFromPlaylist(pid, track.playlistItemId);
      setPlaylist(prev => prev ? { ...prev, songCount: Math.max(0, (prev.songCount || 1) - 1) } : prev);
      showToast(`Removed \u201C${track.title}\u201D from this playlist`);
    } catch {
      setTracks(before);
      showToast("Couldn't remove that song. Try again.", 'error');
    }
  };

  // ── Follow ──
  const handleFollow = async () => {
    const was = isFollowing;
    setPlaylist(prev => ({
      ...prev,
      isFollowing: !was,
      following: !was,
      followerCount: Math.max(0, (prev.followerCount || 0) + (was ? -1 : 1)),
    }));
    try {
      if (was) await unfollowPlaylist(pid); else await followPlaylist(pid);
      showToast(was ? `Removed \u201C${playlist?.name || 'playlist'}\u201D from your library` : `Added \u201C${playlist?.name || 'playlist'}\u201D to your library`);
    } catch {
      setPlaylist(prev => ({
        ...prev,
        isFollowing: was,
        following: was,
        followerCount: Math.max(0, (prev.followerCount || 0) + (was ? 1 : -1)),
      }));
      showToast(was ? "Couldn't remove it from your library. Try again." : "Couldn't add it to your library. Try again.", 'error');
    }
  };

  // ── Header menu actions ──
  const sharePlaylist = async () => {
    setMenu(null);
    const url = `${window.location.origin}/playlist/${pid}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: playlist?.name || 'Playlist', url });
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return; // they closed the share sheet
      }
    }
    copyLink();
  };

  const copyLink = async () => {
    setMenu(null);
    const url = `${window.location.origin}/playlist/${pid}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    } catch {
      showToast(`Copy this link: ${url}`, 'info');
    }
  };

  const openEdit = () => {
    setMenu(null);
    setEditName(playlist.name || '');
    setEditDescription(playlist.description || '');
    setEditVisibility(playlist.visibility || 'private');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const updates = {};
    if (editName.trim() && editName.trim() !== playlist.name) updates.name = editName.trim();
    if (editDescription !== (playlist.description || '')) updates.description = editDescription;
    if (!isCommunity && editVisibility !== playlist.visibility) updates.visibility = editVisibility;

    if (Object.keys(updates).length === 0) { setEditOpen(false); showToast('No changes to save', 'info'); return; }

    setSaving(true);
    try {
      await updatePlaylist(pid, updates);
      setPlaylist(prev => ({ ...prev, ...updates }));
      setEditOpen(false);
      showToast('Playlist details saved');
    } catch (error) {
      showToast(errorMessage(error, "Couldn't save your changes. Try again."), 'error');
    } finally {
      setSaving(false);
    }
  };

  const pickCover = () => {
    setMenu(null);
    coverInputRef.current?.click();
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Cover images must be under 5 MB. Pick a smaller one.', 'error');
      if (coverInputRef.current) coverInputRef.current.value = '';
      return;
    }
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('cover', file);
      // Don't set Content-Type — axios adds the multipart boundary itself.
      const res = await axiosInstance.post(`/v1/playlists/${pid}/cover`, formData);
      setCoverError(false);
      setPlaylist(prev => ({ ...prev, coverImageUrl: res.data.coverImageUrl }));
      showToast('Cover updated');
    } catch (error) {
      showToast(errorMessage(error, "Couldn't upload that image. Try again."), 'error');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePlaylist(pid);
      showToast(`Deleted \u201C${playlist?.name || 'playlist'}\u201D`);
      navigate('/playlists', { replace: true });
    } catch {
      setDeleting(false);
      setDeleteOpen(false);
      showToast("Couldn't delete the playlist. Try again.", 'error');
    }
  };

  // ── Community ──
  const openSection = async (next) => {
    setSection(next);
    if (next === 'activity' && !activityLoaded) {
      try {
        const res = await axiosInstance.get(`/v1/playlists/${pid}/activity?page=0&size=30`);
        setActivities(res.data || []);
      } catch {
        setActivities([]);
      } finally {
        setActivityLoaded(true);
      }
    }
  };

  const handleVote = async (track, voteType) => {
    if (!user) { showToast('Sign in to vote on suggestions', 'info'); return; }
    // Already voted this way — the backend would refuse it, so don't send it.
    if (track.myVote === voteType) {
      showToast(`You already voted ${voteType === 'up' ? 'for' : 'against'} \u201C${track.title}\u201D`, 'info');
      return;
    }
    try {
      const result = await voteOnSuggestion(pid, track.playlistItemId, voteType);
      if (result.status === 'active') {
        setPending(prev => prev.filter(t => t.playlistItemId !== track.playlistItemId));
        setTracks(prev => [...prev, normalizeTrack({ ...track, ...result, status: 'active' })]);
        showToast(`Your vote put \u201C${track.title}\u201D in the playlist`);
      } else if (result.status === 'removed') {
        setPending(prev => prev.filter(t => t.playlistItemId !== track.playlistItemId));
        showToast(`Your vote took \u201C${track.title}\u201D off the suggestions`);
      } else {
        showToast(voteType === 'up' ? `Voted for \u201C${track.title}\u201D` : `Voted against \u201C${track.title}\u201D`);
        setPending(prev => prev.map(t => t.playlistItemId === track.playlistItemId
          ? { ...t, upvotes: result.upvotes, downvotes: result.downvotes, myVote: voteType }
          : t));
      }
    } catch (error) {
      showToast(errorMessage(error, "Couldn't record your vote. Try again."), 'error');
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (status === 'loading') {
    return (
      <Layout>
        <div className="plp-page plp-v2 plp-loading" aria-busy="true">
          <div className="plp-hero">
            <div className="plp-cover plp-skel" />
            <div className="plp-hero-info">
              <div className="plp-skel plp-skel-kicker" />
              <div className="plp-skel plp-skel-title" />
              <div className="plp-skel plp-skel-meta" />
            </div>
          </div>
          <div className="plp-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="plp-skel plp-skel-row" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (status === 'unavailable' || !playlist) {
    return (
      <Layout>
        <div className="plp-page plp-v2 plp-unavailable">
          <div className="plp-unavailable-icon"><ListMusic size={34} /></div>
          <h1>This playlist isn&rsquo;t available</h1>
          <p>It may be private, or it may have been deleted.</p>
          <button type="button" className="plp-btn-pill" onClick={() => navigate('/playlists')}>Back to your library</button>
        </div>
      </Layout>
    );
  }

  const typeLabel = isCommunity ? 'Community playlist' : isOfficial ? 'Official playlist' : 'Playlist';
  const showHeroPause = playingFromHere && isPlaying;
  const songsWord = `${tracks.length} song${tracks.length !== 1 ? 's' : ''}`;
  const barLine = [songsWord, playlist.creatorName].filter(Boolean).join(' · ');
  const playGlyph = (size) => (showHeroPause
    ? <Pause size={size} fill="currentColor" />
    : <Play size={size} fill="currentColor" className="plp-play-glyph" />);

  return (
    <Layout>
      {/* ── THE BAR THAT FOLLOWS YOU ──
          The cover, blurred and tinted with the theme. While this playlist is
          playing, its line names the song and jumps to its row. */}
      <FollowBar bar={bar} backdrop={heroImage} label={playlist.name} className="plp-bar">
        <div className="fb-who">
          {heroImage
            ? <img src={heroImage} alt="" className="plp-bar__cover" />
            : <span className="plp-bar__cover plp-bar__cover--empty"><Music size={16} /></span>}
          <span className="fb-text">
            <button type="button" className="plp-bar__title" onClick={bar.scrollToTop} aria-label={`Back to the top of ${playlist.name}`}>
              {playlist.name}
            </button>
            {playingFromHere && currentTrack ? (
              <button type="button" className="fb-line plp-bar__jump" onClick={jumpToNowPlaying}>
                {isPlaying && <span className="fb-eq" aria-hidden="true"><i /><i /><i /></span>}
                <span>{currentTrack.title} · Jump to it</span>
              </button>
            ) : (
              <span className="fb-line"><span>{barLine}</span></span>
            )}
          </span>
        </div>
        <button
          type="button"
          className="fb-icon plp-bar__shuffle"
          onClick={handleShufflePlay}
          disabled={playable.length === 0}
          aria-label={`Shuffle ${playlist.name}`}
        >
          <Shuffle size={18} />
        </button>
        <button
          type="button"
          className="fb-dock"
          onClick={handleHeroPlay}
          disabled={!playingFromHere && playable.length === 0}
          aria-label={showHeroPause ? 'Pause' : `Play ${playlist.name}`}
          tabIndex={bar.docked ? 0 : -1}
        >
          {playGlyph(16)}
        </button>
      </FollowBar>

      <div className="plp-page plp-v2">
        {/* The cover washes the top of the page, blended with the theme */}
        {heroImage && (
          <div className="plp-ambient" style={{ backgroundImage: `url("${heroImage}")` }} aria-hidden="true" />
        )}
        <div className="plp-ambient-fade" aria-hidden="true" />

        {/* ── HERO ── */}
        <header className="plp-hero">
          <button type="button" className="plp-back" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft size={18} />
          </button>

          <div className={`plp-cover ${isOwner ? 'plp-cover-editable' : ''}`}>
            {coverUrl ? (
              <img src={coverUrl} alt="" onError={() => setCoverError(true)} />
            ) : mosaic.length >= 4 ? (
              <div className="plp-mosaic">
                {mosaic.map((src) => <img key={src} src={src} alt="" />)}
              </div>
            ) : mosaic.length > 0 ? (
              <img src={mosaic[0]} alt="" />
            ) : (
              <div className="plp-cover-empty"><Music size={56} /></div>
            )}

            {isOwner && (
              <button
                type="button"
                className="plp-cover-change"
                onClick={pickCover}
                disabled={uploadingCover}
              >
                <ImagePlus size={20} />
                <span>{uploadingCover ? 'Uploading…' : 'Choose photo'}</span>
              </button>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              hidden
            />
          </div>

          <div className="plp-hero-info">
            <div className="plp-chips">
              <span className="plp-chip plp-chip-type">{typeLabel}</span>
              {isCommunity && playlist.jurisdictionName && (
                <span className="plp-chip"><MapPin size={12} /> {playlist.jurisdictionName}</span>
              )}
              {isOwner && !isCommunity && (
                <span className="plp-chip">
                  {playlist.visibility === 'public' ? <Globe size={12} />
                    : playlist.visibility === 'unlisted' ? <EyeOff size={12} />
                    : <Lock size={12} />}
                  {playlist.visibility === 'public' ? 'Public' : playlist.visibility === 'unlisted' ? 'Unlisted' : 'Private'}
                </span>
              )}
            </div>
            <h1 className="plp-title" ref={bar.titleRef} title={playlist.name}>{playlist.name}</h1>
            {playlist.description && <p className="plp-description">{playlist.description}</p>}

            <div className="plp-meta">
              {playlist.creatorName && (
                <Link
                  className="plp-creator"
                  to={playlist.creatorId ? `/user/${playlist.creatorId}` : '#'}
                  onClick={(e) => { if (!playlist.creatorId) e.preventDefault(); }}
                >
                  {playlist.creatorPhotoUrl
                    ? <img src={buildUrl(playlist.creatorPhotoUrl)} alt="" />
                    : <span className="plp-creator-initial">{playlist.creatorName.charAt(0).toUpperCase()}</span>}
                  <strong>{playlist.creatorName}</strong>
                </Link>
              )}
              {playlist.followerCount > 0 && (
                <span className="plp-meta-item">
                  {playlist.followerCount.toLocaleString()} save{playlist.followerCount !== 1 ? 's' : ''}
                </span>
              )}
              <span className="plp-meta-item">
                {songsWord}{totalLabel && `, ${totalLabel}`}
              </span>
            </div>
          </div>
        </header>

        {/* ── ACTION ROW: Save, Share, More · Shuffle, Play ── */}
        <div className="plp-actions">
          {canFollow && (
            <button
              type="button"
              className={`plp-ring ${isFollowing ? 'plp-ring-on' : ''}`}
              onClick={handleFollow}
              aria-pressed={isFollowing}
              aria-label={isFollowing ? 'Remove from your library' : 'Save to your library'}
              title={isFollowing ? 'Saved to your library' : 'Save to your library'}
            >
              <Heart size={19} fill={isFollowing ? 'currentColor' : 'none'} />
            </button>
          )}
          {isOwner && (
            <button type="button" className="plp-ring" onClick={openEdit} aria-label="Edit details" title="Edit details">
              <Pencil size={17} />
            </button>
          )}
          <button type="button" className="plp-ring" onClick={sharePlaylist} aria-label="Share" title="Share">
            <Share2 size={17} />
          </button>

          <div className="plp-menu-wrap">
            <button
              type="button"
              className="plp-ring plp-ring-bare"
              onClick={(e) => { e.stopPropagation(); setMenu(m => (m?.kind === 'header' ? null : { kind: 'header' })); }}
              aria-label="More options"
              aria-expanded={menu?.kind === 'header'}
            >
              <MoreHorizontal size={22} />
            </button>
            {menu?.kind === 'header' && (
              <div className="plp-menu" onClick={(e) => e.stopPropagation()} role="menu">
                <button type="button" role="menuitem" onClick={copyLink}>
                  <Link2 size={16} /> Copy link
                </button>
                {isOwner && (
                  <>
                    <button type="button" role="menuitem" onClick={openEdit}>
                      <Pencil size={16} /> Edit details
                    </button>
                    <button type="button" role="menuitem" onClick={pickCover}>
                      <ImagePlus size={16} /> Change cover
                    </button>
                    <div className="plp-menu-sep" />
                    <button
                      type="button"
                      role="menuitem"
                      className="plp-menu-danger"
                      onClick={() => { setMenu(null); setDeleteOpen(true); }}
                    >
                      <Trash2 size={16} /> Delete playlist
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <span className="plp-actions-spacer" />

          <button
            type="button"
            className="plp-ring plp-ring-bare"
            onClick={handleShufflePlay}
            disabled={playable.length === 0}
            aria-label="Shuffle play"
            title="Shuffle play"
          >
            <Shuffle size={21} />
          </button>
          <button
            ref={bar.playRef}
            type="button"
            className="plp-play"
            onClick={handleHeroPlay}
            disabled={!playingFromHere && playable.length === 0}
            aria-label={showHeroPause ? 'Pause' : 'Play'}
            title={showHeroPause ? 'Pause' : 'Play'}
          >
            {playGlyph(24)}
          </button>
        </div>

        {/* ── TABS (community) · FIND · SORT ── */}
        <div className="plp-tools">
          {isCommunity && (
            <div className="plp-tabs" role="tablist" aria-label="Playlist sections">
              {[
                ['tracks', 'Songs', tracks.length],
                ['suggestions', 'Suggestions', pending.length],
                ['activity', 'Activity', null],
              ].map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={section === id}
                  className={`plp-pill ${section === id ? 'plp-pill-on' : ''}`}
                  onClick={() => openSection(id)}
                >
                  {label}{count != null && <span className="plp-pill-count">{count}</span>}
                </button>
              ))}
            </div>
          )}

          {section === 'tracks' && tracks.length > 0 && (
            <div className="plp-find-row">
              <label className="plp-find" htmlFor="plp-find">
                <Search size={15} aria-hidden="true" />
                <span className="plp-sr">Find in playlist</span>
                <input
                  id="plp-find"
                  type="search"
                  value={query}
                  placeholder="Find in playlist"
                  autoComplete="off"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
                />
                {query && (
                  <button type="button" className="plp-find-clear" onClick={() => setQuery('')} aria-label="Clear search">
                    <X size={14} />
                  </button>
                )}
              </label>
              <div className="plp-menu-wrap">
                <button
                  type="button"
                  className="plp-pill"
                  onClick={(e) => { e.stopPropagation(); setMenu(m => (m?.kind === 'sort' ? null : { kind: 'sort' })); }}
                  aria-expanded={menu?.kind === 'sort'}
                  aria-label={`Sort: ${sortLabel}`}
                >
                  <ArrowUpDown size={14} aria-hidden="true" />
                  <span className="plp-sort-label">{sortLabel}</span>
                  <ChevronDown size={14} aria-hidden="true" />
                </button>
                {menu?.kind === 'sort' && (
                  <div className="plp-menu plp-sort-menu" onClick={(e) => e.stopPropagation()} role="menu">
                    {SORTS.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={sort === o.id}
                        className={sort === o.id ? 'plp-menu-on' : ''}
                        onClick={() => { setSort(o.id); setMenu(null); }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {playingFromHere && currentTrack && (
            <button type="button" className="plp-now" onClick={jumpToNowPlaying}>
              <span className={`plp-eq plp-eq-small ${isPlaying ? '' : 'plp-eq-paused'}`} aria-hidden="true"><span /><span /><span /></span>
              <span className="plp-now-text">Now playing · {currentTrack.title}</span>
              <ArrowDown size={14} aria-hidden="true" />
            </button>
          )}

          {isOwner && section === 'tracks' && !canDrag && tracks.length > 1 && (
            <p className="plp-drag-note">Switch to Custom order and clear the search to drag songs into a new order.</p>
          )}
        </div>

        {/* ── SONGS ── */}
        {section === 'tracks' && (
          tracks.length === 0 ? (
            <div className="plp-empty">
              <Music size={30} />
              <p className="plp-empty-title">{isOwner ? 'Your playlist is empty' : 'No songs yet'}</p>
              {isOwner && (
                <p className="plp-empty-hint">
                  On any song, open its ⋮ menu and choose Save to playlist. While a song is playing, the playlist button in the player works too.
                </p>
              )}
            </div>
          ) : visibleTracks.length === 0 ? (
            <div className="plp-empty">
              <p className="plp-empty-title">No songs match &ldquo;{query.trim()}&rdquo;</p>
              <button type="button" className="plp-btn-ghost" onClick={() => setQuery('')}>Clear search</button>
            </div>
          ) : (
            <div className="plp-list">
              <div className={`plp-list-head ${canDrag ? 'plp-head-editable' : ''}`} aria-hidden="true">
                {canDrag && <span className="plp-grip-spacer" />}
                <span className="plp-col-index">#</span>
                <span className="plp-col-title">Title</span>
                <span className="plp-col-added">Added</span>
                <span className="plp-col-time"><Clock size={15} /></span>
                <span className="plp-col-menu" />
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveKey(null)}
              >
                <SortableContext items={visibleTracks.map(({ t }) => rowKey(t))} strategy={verticalListSortingStrategy}>
                  {visibleTracks.map(({ t: track, i: index }) => {
                    const key = rowKey(track);
                    const isCurrentRow = !!currentItemId && currentItemId === track.playlistItemId;
                    return (
                      <TrackRow
                        key={key}
                        track={track}
                        index={index}
                        num={index + 1}
                        canEdit={isOwner}
                        canDrag={canDrag}
                        isCurrentRow={isCurrentRow}
                        isPlaying={isPlaying}
                        menuOpen={menu?.kind === 'row' && menu.key === key}
                        confirmingRemove={confirmRemoveKey === key}
                        onPlay={handleRowPlay}
                        onToggleMenu={(t) => setMenu(m => (m?.kind === 'row' && m.key === rowKey(t) ? null : { kind: 'row', key: rowKey(t) }))}
                        onAddToQueue={handleAddOneToQueue}
                        onGoSong={(t) => navigate(`/song/${t.songId || t.id}`)}
                        onGoArtist={(t) => t.artistId && navigate(`/artist/${t.artistId}`)}
                        onAskRemove={askRemove}
                        onConfirmRemove={confirmRemove}
                        onCancelRemove={() => setConfirmRemoveKey(null)}
                      />
                    );
                  })}
                </SortableContext>

                <DragOverlay dropAnimation={dropAnimation} zIndex={1300}>
                  {activeTrack ? (
                    <div className="plp-row plp-row-lifted">
                      <span className="plp-grip"><GripVertical size={16} /></span>
                      <div className="plp-col-index"><span className="plp-index-num">{tracks.indexOf(activeTrack) + 1}</span></div>
                      <div className="plp-col-title">
                        <img src={activeTrack.artworkUrl || '/assets/placeholder.jpg'} alt="" className="plp-art" />
                        <div className="plp-title-text">
                          <div className="plp-track-title">{activeTrack.title}</div>
                          <div className="plp-track-artist">{activeTrack.artist}</div>
                        </div>
                      </div>
                      <div className="plp-col-time">{formatTrackTime(activeTrack.duration)}</div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          )
        )}

        {/* ── SUGGESTIONS (community) ── */}
        {section === 'suggestions' && isCommunity && (
          pending.length === 0 ? (
            <div className="plp-empty">
              <ThumbsUp size={28} />
              <p className="plp-empty-title">No suggestions waiting</p>
              <p className="plp-empty-hint">Songs suggested for this playlist get voted in here.</p>
            </div>
          ) : (
            <div className="plp-suggestions">
              {pending.map((track) => {
                // A suggestion is never voted on by the person who made it.
                const isMine = !!user && (
                  track.addedById ? track.addedById === user.userId : track.addedByUsername === user.username
                );
                const votes = (track.upvotes || 0) + (track.downvotes || 0);
                const share = votes ? Math.round(((track.upvotes || 0) / votes) * 100) : 0;
                return (
                <div key={track.playlistItemId} className="plp-suggestion">
                  <img src={track.artworkUrl || '/assets/placeholder.jpg'} alt="" className="plp-art" />
                  <div className="plp-title-text">
                    <div className="plp-track-title">{track.title}</div>
                    <div className="plp-suggestion-sub">
                      {track.artist}
                      {track.addedByUsername && <span> · from {track.addedByUsername}</span>}
                    </div>
                    <div
                      className="plp-suggestion-meter"
                      role="img"
                      aria-label={`${track.upvotes} for, ${track.downvotes} against`}
                    >
                      <span style={{ width: `${share}%` }} />
                    </div>
                  </div>
                  {isMine ? (
                    <div className="plp-votes">
                      <span className="plp-own-suggestion">Your suggestion</span>
                      <span className="plp-vote-tally" aria-label={`${track.upvotes} up, ${track.downvotes} down`}>
                        <ThumbsUp size={13} /> {track.upvotes}
                        <ThumbsDown size={13} /> {track.downvotes}
                      </span>
                    </div>
                  ) : (
                    <div className="plp-votes">
                      <button
                        type="button"
                        className={`plp-vote plp-vote-up ${track.myVote === 'up' ? 'plp-vote-on' : ''}`}
                        onClick={() => handleVote(track, 'up')}
                        aria-pressed={track.myVote === 'up'}
                        aria-label={track.myVote === 'up' ? 'You voted to add' : 'Vote to add'}
                      >
                        <ThumbsUp size={14} /> <span>Add · {track.upvotes}</span>
                      </button>
                      <button
                        type="button"
                        className={`plp-vote plp-vote-down ${track.myVote === 'down' ? 'plp-vote-on' : ''}`}
                        onClick={() => handleVote(track, 'down')}
                        aria-pressed={track.myVote === 'down'}
                        aria-label={track.myVote === 'down' ? 'You voted against' : 'Vote against'}
                      >
                        <ThumbsDown size={14} /> <span>Skip · {track.downvotes}</span>
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )
        )}

        {/* ── ACTIVITY (community) ── */}
        {section === 'activity' && isCommunity && (
          !activityLoaded ? (
            <div className="plp-empty"><p className="plp-empty-hint">Loading activity…</p></div>
          ) : activities.length === 0 ? (
            <div className="plp-empty"><p className="plp-empty-title">No activity yet</p></div>
          ) : (
            <div className="plp-activity">
              {activities.map((act) => (
                <div key={act.activityId} className="plp-activity-item">
                  <span className="plp-activity-avatar">
                    {act.userPhotoUrl
                      ? <img src={buildUrl(act.userPhotoUrl)} alt="" />
                      : (act.username || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="plp-activity-text">
                    <strong>{act.username}</strong> {String(act.actionType || '').replace(/_/g, ' ')}
                    {act.songTitle && <em> &ldquo;{act.songTitle}&rdquo;</em>}
                  </span>
                  <span className="plp-activity-time">{formatTimeAgo(act.createdAt)}</span>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── AD SPACE (none for Unis Plus) ── */}
        <AdSlot placement="playlist" />

        {/* ── EDIT DETAILS ── */}
        {editOpen && (
          <div className="plp-dialog-backdrop" onClick={() => !saving && setEditOpen(false)}>
            <div className="plp-dialog" role="dialog" aria-modal="true" aria-labelledby="plp-edit-title" onClick={(e) => e.stopPropagation()}>
              <div className="plp-dialog-head">
                <h2 id="plp-edit-title">Edit <em>details</em></h2>
                <button type="button" className="plp-dialog-x" onClick={() => setEditOpen(false)} aria-label="Close" disabled={saving}>
                  <X size={18} />
                </button>
              </div>
              <label className="plp-field">
                <span>Name</span>
                <input
                  type="text"
                  value={editName}
                  maxLength={100}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  autoFocus
                />
              </label>
              <label className="plp-field">
                <span>Description</span>
                <textarea
                  value={editDescription}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add an optional description"
                />
              </label>
              {!isCommunity && (
                <div className="plp-field">
                  <span>Who can see it</span>
                  <p className="plp-field-hint">
                    {editVisibility === 'private' && 'Only you can open it.'}
                    {editVisibility === 'unlisted' && 'Anyone with the link can open it. It won’t appear in search or on Discover.'}
                    {editVisibility === 'public' && 'Anyone can open it, and it shows up in search and on Discover.'}
                  </p>
                  <div className="plp-seg">
                    {[
                      // Same names as the library page and the help center.
                      { v: 'private', label: 'Private', icon: <Lock size={14} /> },
                      { v: 'unlisted', label: 'Unlisted', icon: <EyeOff size={14} /> },
                      { v: 'public', label: 'Public', icon: <Globe size={14} /> },
                    ].map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        className={editVisibility === opt.v ? 'plp-seg-on' : ''}
                        onClick={() => setEditVisibility(opt.v)}
                        aria-pressed={editVisibility === opt.v}
                      >
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="plp-dialog-actions">
                <button type="button" className="plp-btn-ghost" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</button>
                <button type="button" className="plp-btn-pill" onClick={saveEdit} disabled={saving || !editName.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DELETE ── */}
        {deleteOpen && (
          <div className="plp-dialog-backdrop" onClick={() => !deleting && setDeleteOpen(false)}>
            <div className="plp-dialog plp-dialog-small" role="alertdialog" aria-modal="true" aria-labelledby="plp-del-title" onClick={(e) => e.stopPropagation()}>
              <h2 id="plp-del-title">Delete this playlist?</h2>
              <p className="plp-dialog-text">
                &ldquo;{playlist.name}&rdquo; will be removed from your library. This can&rsquo;t be undone.
                Songs already in your queue will keep playing.
              </p>
              {playlist.ownerPointsEarned > 0 && (
                <p className="plp-dialog-points">
                  You&rsquo;ll also lose the {playlist.ownerPointsEarned} points this playlist earned you.
                </p>
              )}
              <div className="plp-dialog-actions">
                <button type="button" className="plp-btn-ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</button>
                <button type="button" className="plp-btn-danger" onClick={handleDelete} disabled={deleting} autoFocus>
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default PlaylistPage;