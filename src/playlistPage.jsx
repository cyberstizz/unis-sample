// src/playlistPage.jsx
//
// The playlist page — /playlist/:playlistId
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
  Lock, Globe, EyeOff, MapPin, Check, X, ListMusic,
} from 'lucide-react';
import Layout from './layout';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import axiosInstance from './components/axiosInstance';
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

// ============================================================================
// TRACK ROW
// ============================================================================

const TrackRow = ({
  track, index, canEdit, isCurrentRow, isPlaying, menuOpen, confirmingRemove,
  onPlay, onToggleMenu, onAddToQueue, onGoSong, onGoArtist,
  onAskRemove, onConfirmRemove, onCancelRemove,
}) => {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: track.playlistItemId || track.id, disabled: !canEdit });

  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`plp-row-wrap ${isDragging ? 'plp-row-ghost' : ''}`}
    >
      <div
        className={`plp-row ${isCurrentRow ? 'plp-row-current' : ''} ${canEdit ? 'plp-row-editable' : ''} ${confirmingRemove ? 'plp-row-confirming' : ''}`}
        onClick={() => { if (!confirmingRemove) onPlay(index); }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter') && e.target === e.currentTarget) { e.preventDefault(); onPlay(index); }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Play ${track.title} by ${track.artist}`}
      >
        {canEdit && (
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
              <span className="plp-index-num">{index + 1}</span>
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
  const [toast, setToast] = useState('');
  const [activeKey, setActiveKey] = useState(null);

  const coverInputRef = useRef(null);
  const toastTimer = useRef(null);

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

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

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
    if (startIndex < 0) { showToast('This song is unavailable right now'); return; }
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
    showToast('Added to queue');
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
    } catch {
      setTracks(before);
      showToast("Couldn't save the new order");
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
      showToast(`Removed \u201C${track.title}\u201D`);
    } catch {
      setTracks(before);
      showToast("Couldn't remove that song");
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
      showToast(was ? 'Removed from your library' : 'Added to your library');
    } catch {
      setPlaylist(prev => ({
        ...prev,
        isFollowing: was,
        following: was,
        followerCount: Math.max(0, (prev.followerCount || 0) + (was ? 1 : -1)),
      }));
      showToast("Couldn't update follow");
    }
  };

  // ── Header menu actions ──
  const copyLink = async () => {
    setMenu(null);
    const url = `${window.location.origin}/playlist/${pid}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied');
    } catch {
      showToast(url);
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

    if (Object.keys(updates).length === 0) { setEditOpen(false); return; }

    setSaving(true);
    try {
      await updatePlaylist(pid, updates);
      setPlaylist(prev => ({ ...prev, ...updates }));
      setEditOpen(false);
      showToast('Saved');
    } catch {
      showToast("Couldn't save changes");
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
      showToast('Cover image must be under 5MB');
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
    } catch {
      showToast("Couldn't upload that image");
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePlaylist(pid);
      navigate('/', { replace: true });
    } catch {
      setDeleting(false);
      setDeleteOpen(false);
      showToast("Couldn't delete the playlist");
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
    if (!user) { showToast('Sign in to vote'); return; }
    // Already voted this way — the backend would refuse it, so don't send it.
    if (track.myVote === voteType) return;
    try {
      const result = await voteOnSuggestion(pid, track.playlistItemId, voteType);
      if (result.status === 'active') {
        setPending(prev => prev.filter(t => t.playlistItemId !== track.playlistItemId));
        setTracks(prev => [...prev, normalizeTrack({ ...track, ...result, status: 'active' })]);
        showToast(`\u201C${track.title}\u201D was voted in`);
      } else if (result.status === 'removed') {
        setPending(prev => prev.filter(t => t.playlistItemId !== track.playlistItemId));
      } else {
        setPending(prev => prev.map(t => t.playlistItemId === track.playlistItemId
          ? { ...t, upvotes: result.upvotes, downvotes: result.downvotes, myVote: voteType }
          : t));
      }
    } catch {
      showToast("Couldn't record your vote");
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (status === 'loading') {
    return (
      <Layout>
        <div className="plp-page plp-loading" aria-busy="true">
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
        <div className="plp-page plp-unavailable">
          <div className="plp-unavailable-icon"><ListMusic size={34} /></div>
          <h1>This playlist isn&rsquo;t available</h1>
          <p>It may be private, or it may have been deleted.</p>
          <button type="button" className="plp-btn-pill" onClick={() => navigate('/')}>Go home</button>
        </div>
      </Layout>
    );
  }

  const typeLabel = isCommunity ? 'Community playlist' : isOfficial ? 'Official playlist' : 'Playlist';
  const showHeroPause = playingFromHere && isPlaying;

  return (
    <Layout>
      <div className="plp-page">
        {/* Ambient wash drawn from the cover — colours the page with the playlist's own art */}
        {heroImage && (
          <div className="plp-ambient" style={{ backgroundImage: `url("${heroImage}")` }} aria-hidden="true" />
        )}
        <div className="plp-ambient-fade" aria-hidden="true" />

        {/* ── HERO ── */}
        <header className="plp-hero">
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
            <span className="plp-kicker">{typeLabel}</span>
            <h1 className="plp-title" title={playlist.name}>{playlist.name}</h1>
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
              <span className="plp-meta-item">
                {tracks.length} song{tracks.length !== 1 ? 's' : ''}{totalLabel && `, ${totalLabel}`}
              </span>
              {playlist.followerCount > 0 && (
                <span className="plp-meta-item">
                  {playlist.followerCount.toLocaleString()} follower{playlist.followerCount !== 1 ? 's' : ''}
                </span>
              )}
              {isCommunity && playlist.jurisdictionName && (
                <span className="plp-meta-item plp-meta-pill"><MapPin size={12} /> {playlist.jurisdictionName}</span>
              )}
              {isOwner && !isCommunity && (
                <span className="plp-meta-item plp-meta-pill">
                  {playlist.visibility === 'public' ? <Globe size={12} />
                    : playlist.visibility === 'unlisted' ? <EyeOff size={12} />
                    : <Lock size={12} />}
                  {playlist.visibility}
                </span>
              )}
            </div>
          </div>
        </header>

        {/* ── ACTION BAR ── */}
        <div className="plp-actions">
          <button
            type="button"
            className="plp-play"
            onClick={handleHeroPlay}
            disabled={!playingFromHere && playable.length === 0}
            aria-label={showHeroPause ? 'Pause' : 'Play'}
            title={showHeroPause ? 'Pause' : 'Play'}
          >
            {showHeroPause ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
          </button>

          <button
            type="button"
            className="plp-icon-btn"
            onClick={handleShufflePlay}
            disabled={playable.length === 0}
            aria-label="Shuffle play"
            title="Shuffle play"
          >
            <Shuffle size={22} />
          </button>

          {canFollow && (
            <button
              type="button"
              className={`plp-follow ${isFollowing ? 'plp-following' : ''}`}
              onClick={handleFollow}
              aria-pressed={isFollowing}
            >
              {isFollowing ? <Check size={16} /> : <Heart size={16} />}
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}

          <div className="plp-menu-wrap">
            <button
              type="button"
              className="plp-icon-btn"
              onClick={(e) => { e.stopPropagation(); setMenu(m => (m?.kind === 'header' ? null : { kind: 'header' })); }}
              aria-label="More options"
              aria-expanded={menu?.kind === 'header'}
            >
              <MoreHorizontal size={24} />
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

          {playingFromHere && (
            <span className="plp-live">
              <span className={`plp-eq plp-eq-small ${isPlaying ? '' : 'plp-eq-paused'}`}><span /><span /><span /></span>
              Playing from this playlist
            </span>
          )}
        </div>

        {/* ── COMMUNITY TABS ── */}
        {isCommunity && (
          <div className="plp-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={section === 'tracks'}
              className={section === 'tracks' ? 'plp-tab-on' : ''}
              onClick={() => openSection('tracks')}
            >
              Songs <span className="plp-tab-count">{tracks.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === 'suggestions'}
              className={section === 'suggestions' ? 'plp-tab-on' : ''}
              onClick={() => openSection('suggestions')}
            >
              Suggestions <span className="plp-tab-count">{pending.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === 'activity'}
              className={section === 'activity' ? 'plp-tab-on' : ''}
              onClick={() => openSection('activity')}
            >
              Activity
            </button>
          </div>
        )}

        {/* ── SONGS ── */}
        {section === 'tracks' && (
          tracks.length === 0 ? (
            <div className="plp-empty">
              <Music size={30} />
              <p className="plp-empty-title">{isOwner ? 'Your playlist is empty' : 'No songs yet'}</p>
              {isOwner && (
                <p className="plp-empty-hint">
                  While a song is playing, tap the playlist button in the player to add it here.
                </p>
              )}
            </div>
          ) : (
            <div className="plp-list">
              <div className={`plp-list-head ${isOwner ? 'plp-head-editable' : ''}`} aria-hidden="true">
                {isOwner && <span className="plp-grip-spacer" />}
                <span className="plp-col-index">#</span>
                <span className="plp-col-title">Title</span>
                <span className="plp-col-added">Date added</span>
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
                <SortableContext items={tracks.map(rowKey)} strategy={verticalListSortingStrategy}>
                  {tracks.map((track, index) => {
                    const key = rowKey(track);
                    const isCurrentRow = !!currentItemId && currentItemId === track.playlistItemId;
                    return (
                      <TrackRow
                        key={key}
                        track={track}
                        index={index}
                        canEdit={isOwner}
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
                return (
                <div key={track.playlistItemId} className="plp-suggestion">
                  <img src={track.artworkUrl || '/assets/placeholder.jpg'} alt="" className="plp-art" />
                  <div className="plp-title-text">
                    <div className="plp-track-title">{track.title}</div>
                    <div className="plp-suggestion-sub">
                      {track.artist}
                      {track.addedByUsername && <span> · suggested by {track.addedByUsername}</span>}
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
                        <ThumbsUp size={15} /> <span>{track.upvotes}</span>
                      </button>
                      <button
                        type="button"
                        className={`plp-vote plp-vote-down ${track.myVote === 'down' ? 'plp-vote-on' : ''}`}
                        onClick={() => handleVote(track, 'down')}
                        aria-pressed={track.myVote === 'down'}
                        aria-label={track.myVote === 'down' ? 'You voted against' : 'Vote against'}
                      >
                        <ThumbsDown size={15} /> <span>{track.downvotes}</span>
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

        {/* ── EDIT DETAILS ── */}
        {editOpen && (
          <div className="plp-dialog-backdrop" onClick={() => !saving && setEditOpen(false)}>
            <div className="plp-dialog" role="dialog" aria-modal="true" aria-labelledby="plp-edit-title" onClick={(e) => e.stopPropagation()}>
              <div className="plp-dialog-head">
                <h2 id="plp-edit-title">Edit details</h2>
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
                    {editVisibility === 'unlisted' && 'Anyone with the link can open it. It won\u2019t appear in search or on Discover.'}
                    {editVisibility === 'public' && 'Anyone can open it, and it shows up in search and on Discover.'}
                  </p>
                  <div className="plp-seg">
                    {[
                      // Same names as the Playlist Manager and the help center.
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

        {toast && <div className="plp-toast" role="status"><Check size={14} /> {toast}</div>}
      </div>
    </Layout>
  );
};

export default PlaylistPage;