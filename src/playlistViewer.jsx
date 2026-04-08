// src/components/PlaylistViewer.jsx
import React, { useState, useEffect, useContext, useRef } from "react";
import {
  X, Trash2, GripVertical, Edit2, Check, ThumbsUp, ThumbsDown,
  Users, Clock, Heart, Play, SkipForward, ListPlus, Settings,
  Lock, Globe, EyeOff, Image as ImageIcon, Music
} from "lucide-react";
import { PlayerContext } from "./context/playercontext";
import axiosInstance from "./components/axiosInstance";
import "./playlistViewer.scss";

const PlaylistViewer = ({ playlistId, onClose }) => {
  const {
    removeFromPlaylist, reorderPlaylist, updatePlaylist, deletePlaylist,
    playMedia, playNext, playLater, loadPlaylistDetails,
    followPlaylist, unfollowPlaylist, voteOnSuggestion,
  } = useContext(PlayerContext);

  const [playlistData, setPlaylistData] = useState(null);
  const [localTracks, setLocalTracks] = useState([]);
  const [pendingTracks, setPendingTracks] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [activeSection, setActiveSection] = useState('tracks');
  const [activities, setActivities] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedVisibility, setEditedVisibility] = useState('private');
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  // Load full playlist
  useEffect(() => {
    if (!playlistId) return;
    const load = async () => {
      setLoadingDetails(true);
      const data = await loadPlaylistDetails(playlistId);
      if (data) {
        setPlaylistData(data);
        setEditedName(data.name);
        setEditedDescription(data.description || '');
        setEditedVisibility(data.visibility || 'private');

        const active = (data.tracks || []).filter(t => t.status === 'active' || !t.status);
        const pending = (data.tracks || []).filter(t => t.status === 'pending');
        setLocalTracks(active.map(normalizeTrack));
        setPendingTracks(pending.map(normalizeTrack));
      }
      setLoadingDetails(false);
    };
    load();
  }, [playlistId]);

  useEffect(() => {
    if (activeSection === 'activity' && playlistData?.type === 'community') {
      loadActivity();
    }
  }, [activeSection]);

  const loadActivity = async () => {
    try {
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
  const playlistIdSafe = playlistData.id || playlistData.playlistId;

  // ─── Drag-and-drop ───
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
      await reorderPlaylist(playlistIdSafe, localTracks);
    } catch (error) {
      setLocalTracks(originalTracks);
    }
  };

  // ─── Track actions ───
  const handleRemove = async (e, track) => {
    e.stopPropagation();
    if (!track.playlistItemId || !isOwner) return;
    if (!confirm(`Remove "${track.title}" from this playlist?`)) return;

    try {
      await removeFromPlaylist(playlistIdSafe, track.playlistItemId);
      setLocalTracks(prev => prev.filter(t => t.playlistItemId !== track.playlistItemId));
    } catch (error) {
      console.error('Failed to remove track:', error);
      alert('Failed to remove track');
    }
  };

  const handleSelect = (track) => {
    playMedia(track, localTracks, playlistData.name);
  };

  // ─── Queue actions (the new ones) ───
  const handlePlayAll = () => {
    if (localTracks.length === 0) return;
    playMedia(localTracks[0], localTracks, playlistData.name);
  };

  const handlePlayNext = () => {
    if (localTracks.length === 0) return;
    // Insert all tracks from this playlist after the current track, in order
    // We loop in reverse so each playNext call inserts at currentIndex+1,
    // pushing previous insertions down — final order matches playlist order.
    [...localTracks].reverse().forEach(track => playNext(track));
  };

  const handleAddToQueue = () => {
    if (localTracks.length === 0) return;
    localTracks.forEach(track => playLater(track));
  };

  // ─── Follow ───
  const handleFollow = async () => {
    try {
      if (isFollowing) {
        await unfollowPlaylist(playlistIdSafe);
        setPlaylistData(prev => ({ ...prev, isFollowing: false, followerCount: prev.followerCount - 1 }));
      } else {
        await followPlaylist(playlistIdSafe);
        setPlaylistData(prev => ({ ...prev, isFollowing: true, followerCount: prev.followerCount + 1 }));
      }
    } catch (error) {
      console.error('Follow/unfollow failed:', error);
    }
  };

  // ─── Voting (community) ───
  const handleVote = async (e, track, voteType) => {
    e.stopPropagation();
    try {
      const result = await voteOnSuggestion(playlistIdSafe, track.playlistItemId, voteType);
      setPendingTracks(prev => prev.map(t => {
        if (t.playlistItemId === track.playlistItemId) {
          const updated = { ...t, upvotes: result.upvotes, downvotes: result.downvotes, status: result.status };
          if (result.status === 'active') {
            setLocalTracks(active => [...active, normalizeTrack(updated)]);
            return null;
          }
          if (result.status === 'removed') return null;
          return updated;
        }
        return t;
      }).filter(Boolean));
    } catch (error) {
      console.error('Vote failed:', error);
    }
  };

  // ─── Settings panel ───
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updates = {};
      if (editedName.trim() && editedName !== playlistData.name) updates.name = editedName.trim();
      if (editedDescription !== (playlistData.description || '')) updates.description = editedDescription;
      if (editedVisibility !== playlistData.visibility && !isCommunity) {
        updates.visibility = editedVisibility;
      }

      if (Object.keys(updates).length > 0) {
        await updatePlaylist(playlistIdSafe, updates);
        setPlaylistData(prev => ({ ...prev, ...updates }));
      }
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Cover image must be under 5MB');
      return;
    }

    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('cover', file);

      const res = await axiosInstance.post(
        `/v1/playlists/${playlistIdSafe}/cover`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      setPlaylistData(prev => ({ ...prev, coverImageUrl: res.data.coverImageUrl }));
    } catch (error) {
      console.error('Failed to upload cover:', error);
      alert('Failed to upload cover image');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleDeletePlaylist = async () => {
    if (!confirm(`Delete playlist "${playlistData.name}"? This cannot be undone.`)) return;
    try {
      await deletePlaylist(playlistIdSafe);
      onClose();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      alert('Failed to delete playlist');
    }
  };

  // ─── Helpers ───
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

  const getVisibilityIcon = (vis) => {
    if (vis === 'public') return <Globe size={14} />;
    if (vis === 'unlisted') return <EyeOff size={14} />;
    return <Lock size={14} />;
  };

  // ─── Render ───
  return (
    <div className="pv-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="pv-container" onClick={(e) => e.stopPropagation()}>

        {/* HERO HEADER */}
        <div className="pv-hero">
          <div className="pv-cover-wrap">
            {playlistData.coverImageUrl ? (
              <img src={buildUrl(playlistData.coverImageUrl)} alt="" className="pv-cover" />
            ) : localTracks.length > 0 && localTracks[0].artworkUrl ? (
              <img src={localTracks[0].artworkUrl} alt="" className="pv-cover" />
            ) : (
              <div className="pv-cover pv-cover-placeholder">
                <Music size={48} />
              </div>
            )}
            {isOwner && (
              <button
                className="pv-cover-edit"
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                title="Change cover image"
              >
                <ImageIcon size={16} />
                {uploadingCover ? 'Uploading...' : 'Change'}
              </button>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              style={{ display: 'none' }}
            />
          </div>

          <div className="pv-hero-info">
            <div className="pv-type-label">
              {isCommunity ? 'Community Playlist' : playlistData.type === 'official' ? 'Official Playlist' : 'Playlist'}
            </div>
            <h1 className="pv-title">{playlistData.name}</h1>
            {playlistData.description && (
              <p className="pv-description">{playlistData.description}</p>
            )}
            <div className="pv-meta-line">
              {playlistData.creatorName && (
                <span className="pv-meta-item">
                  <strong>{playlistData.creatorName}</strong>
                </span>
              )}
              <span className="pv-meta-dot">•</span>
              <span className="pv-meta-item">{localTracks.length} song{localTracks.length !== 1 ? 's' : ''}</span>
              {playlistData.followerCount > 0 && (
                <>
                  <span className="pv-meta-dot">•</span>
                  <span className="pv-meta-item">{playlistData.followerCount} follower{playlistData.followerCount !== 1 ? 's' : ''}</span>
                </>
              )}
              {!isCommunity && (
                <>
                  <span className="pv-meta-dot">•</span>
                  <span className="pv-meta-item pv-vis-pill">
                    {getVisibilityIcon(playlistData.visibility)}
                    {playlistData.visibility}
                  </span>
                </>
              )}
            </div>
          </div>

          <button className="pv-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* ACTION BAR */}
        <div className="pv-actions">
          <button
            className="pv-btn pv-btn-primary"
            onClick={handlePlayAll}
            disabled={localTracks.length === 0}
            title="Play All — replaces current queue"
          >
            <Play size={16} fill="currentColor" />
            Play All
          </button>

          <button
            className="pv-btn pv-btn-secondary"
            onClick={handlePlayNext}
            disabled={localTracks.length === 0}
            title="Play Next — adds after current song"
          >
            <SkipForward size={16} />
            Play Next
          </button>

          <button
            className="pv-btn pv-btn-secondary"
            onClick={handleAddToQueue}
            disabled={localTracks.length === 0}
            title="Add to Queue — appends to end"
          >
            <ListPlus size={16} />
            Add to Queue
          </button>

          <div className="pv-actions-spacer" />

          {!isOwner && playlistData.visibility !== 'private' && (
            <button
              className={`pv-btn pv-btn-ghost ${isFollowing ? 'pv-following' : ''}`}
              onClick={handleFollow}
            >
              <Heart size={16} fill={isFollowing ? 'currentColor' : 'none'} />
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}

          {isOwner && (
            <button
              className="pv-btn pv-btn-ghost"
              onClick={() => setShowSettings(true)}
              title="Playlist settings"
            >
              <Settings size={16} />
              Settings
            </button>
          )}
        </div>

        {/* SECTION TABS (community only) */}
        {isCommunity && (
          <div className="pv-section-tabs">
            <button
              className={`pv-section-tab ${activeSection === 'tracks' ? 'active' : ''}`}
              onClick={() => setActiveSection('tracks')}
            >
              Tracks <span className="pv-tab-count">{localTracks.length}</span>
            </button>
            <button
              className={`pv-section-tab ${activeSection === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveSection('pending')}
            >
              Pending <span className="pv-tab-count">{pendingTracks.length}</span>
            </button>
            <button
              className={`pv-section-tab ${activeSection === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveSection('activity')}
            >
              Activity
            </button>
          </div>
        )}

        {/* BODY */}
        <div className="pv-body">

          {/* TRACKS */}
          {activeSection === 'tracks' && (
            <>
              {localTracks.length === 0 ? (
                <div className="pv-empty">
                  <Music size={32} />
                  <p>No tracks yet</p>
                  <span>Add songs from the player or anywhere in Unis</span>
                </div>
              ) : (
                <div className="pv-list">
                  {localTracks.map((track, idx) => (
                    <div
                      key={track.playlistItemId || track.id || idx}
                      className={`pv-item ${draggingId === track.id ? "pv-dragging" : ""}`}
                      draggable={isOwner}
                      onDragStart={(e) => onDragStart(e, track.id)}
                      onDragOver={(e) => onDragOver(e, track.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => handleSelect(track)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="pv-item-index">{idx + 1}</div>
                      {isOwner && <GripVertical className="pv-grip" size={16} />}
                      <img
                        src={track.artworkUrl || "/assets/placeholder.jpg"}
                        alt=""
                        className="pv-art"
                      />
                      <div className="pv-meta">
                        <div className="pv-title-line">{track.title}</div>
                        <div className="pv-artist-line">{track.artist}</div>
                      </div>
                      <div className="pv-duration">{formatDuration(track.duration)}</div>
                      {isOwner && (
                        <button
                          className="pv-remove"
                          onClick={(e) => handleRemove(e, track)}
                          title="Remove from playlist"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* PENDING */}
          {activeSection === 'pending' && isCommunity && (
            <>
              {pendingTracks.length === 0 ? (
                <div className="pv-empty">
                  <p>No pending suggestions</p>
                  <span>Suggest songs from the player to add them here for community vote</span>
                </div>
              ) : (
                <div className="pv-list">
                  {pendingTracks.map((track) => (
                    <div key={track.playlistItemId} className="pv-item pv-pending-item">
                      <img src={track.artworkUrl || "/assets/placeholder.jpg"} alt="" className="pv-art" />
                      <div className="pv-meta">
                        <div className="pv-title-line">{track.title}</div>
                        <div className="pv-artist-line">
                          {track.artist}
                          {track.addedByUsername && (
                            <span className="pv-suggested-by"> · suggested by {track.addedByUsername}</span>
                          )}
                        </div>
                      </div>
                      <div className="pv-vote-controls">
                        <button className="pv-vote-btn pv-vote-up" onClick={(e) => handleVote(e, track, 'up')}>
                          <ThumbsUp size={14} />
                          <span>{track.upvotes}</span>
                        </button>
                        <button className="pv-vote-btn pv-vote-down" onClick={(e) => handleVote(e, track, 'down')}>
                          <ThumbsDown size={14} />
                          <span>{track.downvotes}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ACTIVITY */}
          {activeSection === 'activity' && isCommunity && (
            <>
              {activities.length === 0 ? (
                <div className="pv-empty"><p>No activity yet</p></div>
              ) : (
                <div className="pv-activity-list">
                  {activities.map((act) => (
                    <div key={act.activityId} className="pv-activity-item">
                      <div className="pv-activity-icon">
                        {act.actionType.includes('voted_up') && <ThumbsUp size={12} />}
                        {act.actionType.includes('voted_down') && <ThumbsDown size={12} />}
                        {act.actionType.includes('added') && <span>+</span>}
                        {act.actionType.includes('removed') && <Trash2 size={12} />}
                        {act.actionType.includes('approved') && <Check size={12} />}
                        {act.actionType.includes('created') && <Users size={12} />}
                        {act.actionType.includes('renamed') && <Edit2 size={12} />}
                      </div>
                      <div className="pv-activity-content">
                        <span className="pv-activity-user">{act.username}</span>{' '}
                        <span className="pv-activity-action">{act.actionType.replace(/_/g, ' ')}</span>
                        {act.songTitle && <span className="pv-activity-song"> — "{act.songTitle}"</span>}
                      </div>
                      <div className="pv-activity-time">
                        <Clock size={11} />
                        {formatTimeAgo(act.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* SETTINGS MODAL (owner only) */}
        {showSettings && isOwner && (
          <div className="pv-settings-modal" onClick={() => setShowSettings(false)}>
            <div className="pv-settings-panel" onClick={(e) => e.stopPropagation()}>
              <div className="pv-settings-header">
                <h3>Playlist Settings</h3>
                <button onClick={() => setShowSettings(false)}><X size={18} /></button>
              </div>

              <div className="pv-settings-body">
                <div className="pv-field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="pv-field">
                  <label>Description</label>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="What's this playlist about?"
                  />
                </div>

                {!isCommunity && (
                  <div className="pv-field">
                    <label>Visibility</label>
                    <div className="pv-vis-options">
                      <button
                        className={`pv-vis-option ${editedVisibility === 'private' ? 'active' : ''}`}
                        onClick={() => setEditedVisibility('private')}
                      >
                        <Lock size={16} />
                        <div>
                          <div className="pv-vis-name">Private</div>
                          <div className="pv-vis-desc">Only you can see it</div>
                        </div>
                      </button>
                      <button
                        className={`pv-vis-option ${editedVisibility === 'unlisted' ? 'active' : ''}`}
                        onClick={() => setEditedVisibility('unlisted')}
                      >
                        <EyeOff size={16} />
                        <div>
                          <div className="pv-vis-name">Unlisted</div>
                          <div className="pv-vis-desc">Anyone with the link</div>
                        </div>
                      </button>
                      <button
                        className={`pv-vis-option ${editedVisibility === 'public' ? 'active' : ''}`}
                        onClick={() => setEditedVisibility('public')}
                      >
                        <Globe size={16} />
                        <div>
                          <div className="pv-vis-name">Public</div>
                          <div className="pv-vis-desc">Discoverable by everyone</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                <div className="pv-settings-divider" />

                <button className="pv-danger-btn" onClick={handleDeletePlaylist}>
                  <Trash2 size={16} />
                  Delete this playlist
                </button>
              </div>

              <div className="pv-settings-footer">
                <button className="pv-btn pv-btn-ghost" onClick={() => setShowSettings(false)}>
                  Cancel
                </button>
                <button
                  className="pv-btn pv-btn-primary"
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                >
                  {savingSettings ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistViewer;