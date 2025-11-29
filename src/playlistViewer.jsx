import React, { useState, useEffect, useContext } from "react";
import { X, Trash2, GripVertical, Edit2, Check } from "lucide-react";
import { PlayerContext } from "./context/playercontext";
import "./playlistViewer.scss";

const PlaylistViewer = ({ playlistId, onClose }) => {
  const { playlists, removeFromPlaylist, reorderPlaylist, updatePlaylistName, deletePlaylist, loadPlaylist, playMedia } = useContext(PlayerContext);
  
  const [localTracks, setLocalTracks] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [pressedId, setPressedId] = useState(null);
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  // Load the playlist data
  useEffect(() => {
    if (playlistId && playlists.length > 0) {
      const pl = playlists.find(p => p.id === playlistId || p.playlistId === playlistId);
      if (pl) {
        setCurrentPlaylist(pl);
        setLocalTracks(pl.tracks || []);
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
    setDraggingId(null);
    try {
      await reorderPlaylist(currentPlaylist.id, localTracks);
    } catch (error) {
      console.error('Failed to reorder:', error);
      // Reload to reset state
      setLocalTracks(currentPlaylist.tracks);
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
        alert('Failed to remove track');
      }
    }
  };

  const handleSelect = (track) => {
    setPressedId(track.id);
    setTimeout(() => setPressedId(null), 180);
    playMedia(track, localTracks); // Play this track and set playlist as queue
  };

  const handlePlayAll = () => {
    if (localTracks.length > 0) {
      loadPlaylist(currentPlaylist);
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