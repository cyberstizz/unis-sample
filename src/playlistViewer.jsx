import React, { useState, useEffect, useContext } from "react";
import { X, Trash2, GripVertical, Edit2, Check } from "lucide-react";
import { PlayerContext } from "./context/playercontext";
import "./playlistViewer.scss";

const PlaylistViewer = ({ playlistId, onClose }) => {
  const { playlists, removeFromPlaylist, reorderPlaylist, updatePlaylistName, deletePlaylist, playMedia } = useContext(PlayerContext);
  
  const [localTracks, setLocalTracks] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [pressedId, setPressedId] = useState(null);
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // Helper to build URLs (like in Feed)
  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `${API_BASE_URL}${url}`;
  };

  // Load the playlist data and normalize tracks
  useEffect(() => {
    if (playlistId && playlists.length > 0) {
      const pl = playlists.find(p => p.id === playlistId || p.playlistId === playlistId);
      if (pl) {
        setCurrentPlaylist(pl);
        
        // Normalize tracks to match player expectations (like Feed does)
        const normalizedTracks = (pl.tracks || []).map(track => ({
          // Keep all original fields
          ...track,
          // Ensure player-compatible fields
          id: track.songId || track.id,
          songId: track.songId || track.id,
          playlistItemId: track.playlistItemId, // Important for deletion
          title: track.title || 'Untitled',
          artist: track.artistName || track.artist || 'Unknown Artist',
          artistName: track.artistName || track.artist || 'Unknown Artist',
          artworkUrl: buildUrl(track.artworkUrl),
          artwork: buildUrl(track.artworkUrl),
          fileUrl: buildUrl(track.fileUrl),
          url: buildUrl(track.fileUrl), // Player needs 'url' field
          duration: track.duration || 0
        }));
        
        console.log('Normalized playlist tracks:', normalizedTracks);
        setLocalTracks(normalizedTracks);
        setEditedName(pl.name);
      }
    }
  }, [playlistId, playlists]);

  if (!currentPlaylist) return null;

  const onDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const onDragOver = (e, overId) => {
    e.preventDefault();
    if (draggingId === overId) return;
    
    const draggedIndex = localTracks.findIndex(t => t.id === draggingId);
    const overIndex = localTracks.findIndex(t => t.id === overId);
    if (draggedIndex === -1 || overIndex === -1) return;

    const next = Array.from(localTracks);
    const [removed] = next.splice(draggedIndex, 1);
    next.splice(overIndex, 0, removed);
    setLocalTracks(next);
  };

  const onDragEnd = async () => {
    if (!draggingId) return;
    
    const originalTracks = [...localTracks];
    setDraggingId(null);
    
    try {
      console.log('Reordering playlist:', currentPlaylist.id);
      console.log('New order:', localTracks.map(t => t.playlistItemId));
      
      await reorderPlaylist(currentPlaylist.id, localTracks);
      console.log('Reorder successful');
    } catch (error) {
      console.error('Failed to reorder:', error);
      // Revert to original order on error
      setLocalTracks(originalTracks);
      alert('Failed to reorder tracks');
    }
  };

  const handleRemove = async (e, track) => {
    e.stopPropagation();
    if (!track.playlistItemId) {
      alert('Cannot remove track - missing ID');
      return;
    }
    
    if (confirm(`Remove "${track.title}" from this playlist?`)) {
      try {
        await removeFromPlaylist(currentPlaylist.id, track.playlistItemId);
      } catch (error) {
        console.error('Failed to remove track:', error);
        alert('Failed to remove track');
      }
    }
  };

  const handleSelect = (track) => {
    console.log('Playing track:', track);
    setPressedId(track.id);
    setTimeout(() => setPressedId(null), 180);
    
    // Play this track with the full playlist as queue
    playMedia(track, localTracks);
  };

  const handlePlayAll = () => {
    if (localTracks.length > 0) {
      console.log('Playing all tracks:', localTracks);
      playMedia(localTracks[0], localTracks);
    }
  };

  const handleUpdateName = async () => {
    if (!editedName.trim() || editedName === currentPlaylist.name) {
      setIsEditingName(false);
      return;
    }

    try {
      await updatePlaylistName(currentPlaylist.id, editedName.trim());
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to update playlist name:', error);
      alert('Failed to update playlist name');
      setEditedName(currentPlaylist.name);
    }
  };

  const handleDeletePlaylist = async () => {
    if (confirm(`Delete playlist "${currentPlaylist.name}"? This cannot be undone.`)) {
      try {
        await deletePlaylist(currentPlaylist.id);
        onClose();
      } catch (error) {
        console.error('Failed to delete playlist:', error);
        alert('Failed to delete playlist');
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

  return (
    <div className="pv-overlay" role="dialog" aria-modal="true">
      <div className="pv-container">
        <div className="pv-header">
          <div className="pv-header-left">
            {isEditingName ? (
              <div className="pv-edit-name">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateName()}
                  autoFocus
                />
                <button onClick={handleUpdateName} className="pv-edit-save">
                  <Check size={16} />
                </button>
                <button onClick={() => {
                  setIsEditingName(false);
                  setEditedName(currentPlaylist.name);
                }} className="pv-edit-cancel">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="pv-title">{currentPlaylist.name}</h3>
                  <p className="pv-sub">{localTracks.length} tracks</p>
                </div>
                <button 
                  className="pv-edit-btn"
                  onClick={() => setIsEditingName(true)}
                  title="Edit playlist name"
                >
                  <Edit2 size={16} />
                </button>
              </>
            )}
          </div>
          <button className="pv-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="pv-actions">
          <button className="pv-play-all" onClick={handlePlayAll} disabled={localTracks.length === 0}>
            ▶ Play All
          </button>
          <button className="pv-delete-playlist" onClick={handleDeletePlaylist}>
            <Trash2 size={16} /> Delete Playlist
          </button>
        </div>

        <div className="pv-body">
          {localTracks.length === 0 && (
            <div className="pv-empty">No tracks in this playlist. Add some from the player!</div>
          )}

          <div className="pv-list">
            {localTracks.map((track, idx) => (
              <div
                key={track.playlistItemId || track.id || idx}
                className={`pv-item ${pressedId === track.id ? "pv-pressed" : ""} ${draggingId === track.id ? "pv-dragging" : ""}`}
                draggable
                onDragStart={(e) => onDragStart(e, track.id)}
                onDragOver={(e) => onDragOver(e, track.id)}
                onDragEnd={onDragEnd}
                onClick={() => handleSelect(track)}
                role="button"
                tabIndex={0}
              >
                <div className="pv-left">
                  <GripVertical className="pv-grip" />
                  <img 
                    src={track.artworkUrl || track.artwork || "/assets/placeholder.jpg"} 
                    alt="" 
                    className="pv-art" 
                  />
                </div>

                <div className="pv-meta">
                  <div className="pv-title-line">{track.title}</div>
                  <div className="pv-artist-line">
                    {track.artist || track.artistName || "Unknown Artist"}
                  </div>
                </div>

                <div className="pv-right">
                  <div className="pv-duration">{formatDuration(track.duration)}</div>
                  <button 
                    className="pv-remove" 
                    onClick={(e) => handleRemove(e, track)} 
                    title="Remove track"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistViewer;