import React, { useContext, useState } from 'react';
import { PlayerContext } from './context/playercontext';
import { X, Plus, Check } from 'lucide-react';
import './playlistWizard.scss';

const PlaylistWizard = ({ open, onClose, selectedTrack }) => {
  const { playlists, createPlaylist, addToPlaylist, loading } = useContext(PlayerContext);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  if (!open) return null;

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    try {
      await createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowCreateForm(false);
      setSuccessMessage('Playlist created!');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (error) {
      alert('Failed to create playlist');
    }
  };

  const handleAddToPlaylist = async (playlistId) => {
    if (!selectedTrack?.songId && !selectedTrack?.id) {
      alert('No track selected');
      return;
    }

    setAddingTo(playlistId);
    try {
      await addToPlaylist(playlistId, selectedTrack);
      setSuccessMessage('Added to playlist!');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1500);
    } catch (error) {
      if (error.response?.data?.includes('already in playlist')) {
        alert('This song is already in that playlist');
      } else {
        alert('Failed to add track to playlist');
      }
    } finally {
      setAddingTo(null);
    }
  };

  return (
    <div className="pw-overlay" onClick={onClose}>
      <div className="pw-container" onClick={(e) => e.stopPropagation()}>
        <div className="pw-header">
          <h3>Add to Playlist</h3>
          <button className="pw-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {successMessage && (
          <div className="pw-success">
            <Check size={16} /> {successMessage}
          </div>
        )}

        <div className="pw-track-info">
          <img 
            src={selectedTrack?.artworkUrl || selectedTrack?.artwork || '/assets/placeholder.jpg'} 
            alt="" 
            className="pw-artwork"
          />
          <div>
            <div className="pw-track-title">{selectedTrack?.title || 'Unknown'}</div>
            <div className="pw-track-artist">{selectedTrack?.artist || selectedTrack?.artistName || 'Unknown Artist'}</div>
          </div>
        </div>

        <div className="pw-body">
          {loading ? (
            <div className="pw-loading">Loading playlists...</div>
          ) : (
            <>
              <button 
                className="pw-create-btn"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                <Plus size={18} /> Create New Playlist
              </button>

              {showCreateForm && (
                <div className="pw-create-form">
                  <input
                    type="text"
                    placeholder="Playlist name"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                    autoFocus
                  />
                  <button onClick={handleCreatePlaylist}>Create</button>
                  <button onClick={() => setShowCreateForm(false)}>Cancel</button>
                </div>
              )}

              <div className="pw-playlists">
                {playlists.length === 0 ? (
                  <div className="pw-empty">No playlists yet. Create one above!</div>
                ) : (
                  playlists.map((pl) => (
                    <button
                      key={pl.id}
                      className="pw-playlist-item"
                      onClick={() => handleAddToPlaylist(pl.id)}
                      disabled={addingTo === pl.id}
                    >
                      <div>
                        <div className="pw-pl-name">{pl.name}</div>
                        <div className="pw-pl-count">{pl.tracks?.length || 0} tracks</div>
                      </div>
                      {addingTo === pl.id && <span className="pw-spinner">...</span>}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaylistWizard;