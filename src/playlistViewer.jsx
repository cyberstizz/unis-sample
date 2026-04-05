// src/components/PlaylistViewer.jsx
import React, { useState, useEffect, useContext } from "react";
import { X, Trash2, GripVertical, Edit2, Check, ThumbsUp, ThumbsDown, Users, Clock, Heart, ListMusic } from "lucide-react";
import { PlayerContext } from "./context/playercontext";
import "./playlistViewer.scss";

const PlaylistViewer = ({ playlistId, onClose }) => {
  const {
    playlists, followedPlaylists,
    removeFromPlaylist, reorderPlaylist, updatePlaylistName, deletePlaylist,
    playMedia, loadPlaylistDetails,
    followPlaylist, unfollowPlaylist,
    suggestSong, voteOnSuggestion,
  } = useContext(PlayerContext);

  const [playlistData, setPlaylistData] = useState(null);
  const [localTracks, setLocalTracks] = useState([]);
  const [pendingTracks, setPendingTracks] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [pressedId, setPressedId] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [activeSection, setActiveSection] = useState('tracks'); // 'tracks' | 'pending' | 'activity'
  const [activities, setActivities] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  // Load full playlist details from API
  useEffect(() => {
    if (!playlistId) return;

    const load = async () => {
      setLoadingDetails(true);
      const data = await loadPlaylistDetails(playlistId);
      if (data) {
        setPlaylistData(data);
        setEditedName(data.name);

        const active = (data.tracks || []).filter(t => t.status === 'active' || !t.status);
        const pending = (data.tracks || []).filter(t => t.status === 'pending');

        setLocalTracks(active.map(t => normalizeTrack(t)));
        setPendingTracks(pending.map(t => normalizeTrack(t)));
      }
      setLoadingDetails(false);
    };

    load();
  }, [playlistId]);

  // Load activity feed when that tab is selected
  useEffect(() => {
    if (activeSection === 'activity' && playlistData?.isCommunity) {
      loadActivity();
    }
  }, [activeSection]);

  const loadActivity = async () => {
    try {
      const axiosInstance = (await import('./components/axiosInstance')).default;
      const res = await axiosInstance.get(`/v1/playlists/${playlistId}/activity?page=0&size=30`);
      setActivities(res.data || []);
    } catch (err) {
      console.error('Failed to load activity:', err);
    }
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
    addedByUsername: track.addedByUsername,
  });

  if (loadingDetails) {
    return (
      <div className="pv-overlay">
        <div className="pv-container">
          <div className="pv-loading">Loading playlist...</div>
        </div>
      </div>
    );
  }

  if (!playlistData) return null;

  const isCommunity = playlistData.type === 'community';
  const isOwner = playlistData.isOwner;
  const isFollowing = playlistData.isFollowing;

  // --- Drag and drop ---
  const onDragStart = (e, id) => {
    if (!isOwner) return;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e, overId) => {
    e.preventDefault();
    if (!isOwner || draggingId === overId) return;
    const draggedIndex = localTracks.findIndex(t => t.id === draggingId);
    const overIndex = localTracks.findIndex(t => t.id === overId);
    if (draggedIndex === -1 || overIndex === -1) return;
    const next = Array.from(localTracks);
    const [removed] = next.splice(draggedIndex, 1);
    next.splice(overIndex, 0, removed);
    setLocalTracks(next);
  };

  const onDragEnd = async () => {
    if (!draggingId || !isOwner) return;
    const originalTracks = [...localTracks];
    setDraggingId(null);
    try {
      await reorderPlaylist(playlistData.id || playlistData.playlistId, localTracks);
    } catch (error) {
      setLocalTracks(originalTracks);
    }
  };

  // --- Actions ---
  const handleRemove = async (e, track) => {
    e.stopPropagation();
    if (!track.playlistItemId || !isOwner) return;
    if (confirm(`Remove "${track.title}" from this playlist?`)) {
      try {
        await removeFromPlaylist(playlistData.id || playlistData.playlistId, track.playlistItemId);
        setLocalTracks(prev => prev.filter(t => t.playlistItemId !== track.playlistItemId));
      } catch (error) {
        console.error('Failed to remove track:', error);
      }
    }
  };

  const handleSelect = (track) => {
    setPressedId(track.id);
    setTimeout(() => setPressedId(null), 180);
    playMedia(track, localTracks, playlistData.name);
  };

  const handlePlayAll = () => {
    if (localTracks.length > 0) {
      playMedia(localTracks[0], localTracks, playlistData.name);
    }
  };

  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await unfollowPlaylist(playlistData.playlistId);
        setPlaylistData(prev => ({ ...prev, isFollowing: false, followerCount: prev.followerCount - 1 }));
      } else {
        await followPlaylist(playlistData.playlistId);
        setPlaylistData(prev => ({ ...prev, isFollowing: true, followerCount: prev.followerCount + 1 }));
      }
    } catch (error) {
      console.error('Follow/unfollow failed:', error);
    }
  };

  const handleVote = async (e, track, voteType) => {
    e.stopPropagation();
    try {
      const result = await voteOnSuggestion(playlistData.playlistId, track.playlistItemId, voteType);
      // Update the track in pending list with new vote counts
      setPendingTracks(prev => prev.map(t => {
        if (t.playlistItemId === track.playlistItemId) {
          const updated = { ...t, upvotes: result.upvotes, downvotes: result.downvotes, status: result.status };
          // If approved, move to active tracks
          if (result.status === 'active') {
            setLocalTracks(active => [...active, normalizeTrack(updated)]);
            return null; // will be filtered out
          }
          // If rejected, remove from pending
          if (result.status === 'removed') return null;
          return updated;
        }
        return t;
      }).filter(Boolean));
    } catch (error) {
      console.error('Vote failed:', error);
    }
  };

  const handleUpdateName = async () => {
    if (!editedName.trim() || editedName === playlistData.name) {
      setIsEditingName(false);
      return;
    }
    try {
      await updatePlaylistName(playlistData.id || playlistData.playlistId, editedName.trim());
      setPlaylistData(prev => ({ ...prev, name: editedName.trim() }));
      setIsEditingName(false);
    } catch (error) {
      setEditedName(playlistData.name);
    }
  };

  const handleDeletePlaylist = async () => {
    if (confirm(`Delete playlist "${playlistData.name}"? This cannot be undone.`)) {
      try {
        await deletePlaylist(playlistData.id || playlistData.playlistId);
        onClose();
      } catch (error) {
        console.error('Failed to delete playlist:', error);
      }
    }
  };

  const formatDuration = (d) => {
    if (!d && d !== 0) return "";
    const sec = Number(d);
    if (isNaN(sec)) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="pv-overlay" role="dialog" aria-modal="true">
      <div className="pv-container">

        {/* Header */}
        <div className="pv-header">
          <div className="pv-header-left">
            {isEditingName && isOwner ? (
              <div className="pv-edit-name">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateName()}
                  autoFocus
                />
                <button onClick={handleUpdateName} className="pv-edit-save"><Check size={16} /></button>
                <button onClick={() => { setIsEditingName(false); setEditedName(playlistData.name); }} className="pv-edit-cancel"><X size={16} /></button>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="pv-title">{playlistData.name}</h3>
                  <p className="pv-sub">
                    {localTracks.length} track{localTracks.length !== 1 ? 's' : ''}
                    {playlistData.followerCount > 0 && ` · ${playlistData.followerCount} follower${playlistData.followerCount !== 1 ? 's' : ''}`}
                    {playlistData.creatorName && !isOwner && ` · by ${playlistData.creatorName}`}
                  </p>
                  {playlistData.description && (
                    <p className="pv-description">{playlistData.description}</p>
                  )}
                </div>
                {isOwner && (
                  <button className="pv-edit-btn" onClick={() => setIsEditingName(true)} title="Edit playlist name">
                    <Edit2 size={16} />
                  </button>
                )}
              </>
            )}
          </div>
          <button className="pv-close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Actions bar */}
        <div className="pv-actions">
          <button className="pv-play-all" onClick={handlePlayAll} disabled={localTracks.length === 0}>
            ▶ Play All
          </button>

          {/* Follow/Unfollow (for non-owners of public playlists) */}
          {!isOwner && playlistData.visibility !== 'private' && (
            <button className={`pv-follow-btn ${isFollowing ? 'pv-following' : ''}`} onClick={handleFollow}>
              <Heart size={16} fill={isFollowing ? 'currentColor' : 'none'} />
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}

          {isOwner && (
            <button className="pv-delete-playlist" onClick={handleDeletePlaylist}>
              <Trash2 size={16} /> Delete
            </button>
          )}
        </div>

        {/* Section tabs (for community playlists) */}
        {isCommunity && (
          <div className="pv-section-tabs">
            <button
              className={`pv-section-tab ${activeSection === 'tracks' ? 'active' : ''}`}
              onClick={() => setActiveSection('tracks')}
            >
              Tracks ({localTracks.length})
            </button>
            <button
              className={`pv-section-tab ${activeSection === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveSection('pending')}
            >
              Pending ({pendingTracks.length})
            </button>
            <button
              className={`pv-section-tab ${activeSection === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveSection('activity')}
            >
              Activity
            </button>
          </div>
        )}

        {/* Body */}
        <div className="pv-body">

          {/* === TRACKS TAB === */}
          {activeSection === 'tracks' && (
            <>
              {localTracks.length === 0 && (
                <div className="pv-empty">No tracks in this playlist yet.</div>
              )}
              <div className="pv-list">
                {localTracks.map((track, idx) => (
                  <div
                    key={track.playlistItemId || track.id || idx}
                    className={`pv-item ${pressedId === track.id ? "pv-pressed" : ""} ${draggingId === track.id ? "pv-dragging" : ""}`}
                    draggable={isOwner}
                    onDragStart={(e) => onDragStart(e, track.id)}
                    onDragOver={(e) => onDragOver(e, track.id)}
                    onDragEnd={onDragEnd}
                    onClick={() => handleSelect(track)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="pv-left">
                      {isOwner && <GripVertical className="pv-grip" />}
                      <img src={track.artworkUrl || "/assets/placeholder.jpg"} alt="" className="pv-art" />
                    </div>
                    <div className="pv-meta">
                      <div className="pv-title-line">{track.title}</div>
                      <div className="pv-artist-line">{track.artist}</div>
                    </div>
                    <div className="pv-right">
                      <div className="pv-duration">{formatDuration(track.duration)}</div>
                      {isOwner && (
                        <button className="pv-remove" onClick={(e) => handleRemove(e, track)} title="Remove track">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* === PENDING TAB (Community only) === */}
          {activeSection === 'pending' && isCommunity && (
            <>
              {pendingTracks.length === 0 && (
                <div className="pv-empty">No pending suggestions.</div>
              )}
              <div className="pv-list">
                {pendingTracks.map((track, idx) => (
                  <div key={track.playlistItemId || idx} className="pv-item pv-pending-item">
                    <div className="pv-left">
                      <img src={track.artworkUrl || "/assets/placeholder.jpg"} alt="" className="pv-art" />
                    </div>
                    <div className="pv-meta">
                      <div className="pv-title-line">{track.title}</div>
                      <div className="pv-artist-line">
                        {track.artist}
                        {track.addedByUsername && (
                          <span className="pv-suggested-by"> · suggested by {track.addedByUsername}</span>
                        )}
                      </div>
                    </div>
                    <div className="pv-right pv-vote-controls">
                      <button className="pv-vote-btn pv-vote-up" onClick={(e) => handleVote(e, track, 'up')} title="Vote up">
                        <ThumbsUp size={16} />
                        <span>{track.upvotes}</span>
                      </button>
                      <button className="pv-vote-btn pv-vote-down" onClick={(e) => handleVote(e, track, 'down')} title="Vote down">
                        <ThumbsDown size={16} />
                        <span>{track.downvotes}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* === ACTIVITY TAB (Community only) === */}
          {activeSection === 'activity' && isCommunity && (
            <>
              {activities.length === 0 && (
                <div className="pv-empty">No activity yet.</div>
              )}
              <div className="pv-activity-list">
                {activities.map((act) => (
                  <div key={act.activityId} className="pv-activity-item">
                    <div className="pv-activity-icon">
                      {act.actionType.includes('voted_up') && <ThumbsUp size={14} />}
                      {act.actionType.includes('voted_down') && <ThumbsDown size={14} />}
                      {act.actionType.includes('added') && <span>+</span>}
                      {act.actionType.includes('removed') && <Trash2 size={14} />}
                      {act.actionType.includes('approved') && <Check size={14} />}
                      {act.actionType.includes('created') && <Users size={14} />}
                      {act.actionType.includes('renamed') && <Edit2 size={14} />}
                    </div>
                    <div className="pv-activity-content">
                      <span className="pv-activity-user">{act.username}</span>
                      {' '}
                      <span className="pv-activity-action">
                        {act.actionType.replace(/_/g, ' ')}
                      </span>
                      {act.songTitle && (
                        <span className="pv-activity-song"> — "{act.songTitle}"</span>
                      )}
                      {act.details && (
                        <span className="pv-activity-details"> ({act.details})</span>
                      )}
                    </div>
                    <div className="pv-activity-time">
                      <Clock size={12} />
                      {formatTimeAgo(act.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistViewer;