import React, { useContext, useState } from 'react';
import { PlayerContext } from './context/playercontext';
import { X, Plus, Check, SkipForward, ListEnd, Users, Lock, Globe } from 'lucide-react';
import './playlistWizard.scss';

const PlaylistWizard = ({ open, onClose, selectedTrack }) => {
  const {
    playlists, createPlaylist, addToPlaylist,
    playNext, playLater, suggestSong,
    loading
  } = useContext(PlayerContext);

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [queuedMessage, setQueuedMessage] = useState('');

  if (!open || !selectedTrack) return null;

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

  const handleAddToPlaylist = async (playlist) => {
    const songId = selectedTrack?.songId || selectedTrack?.id;
    if (!songId) {
      alert('No track selected');
      return;
    }

    const playlistId = playlist.id || playlist.playlistId;
    setAddingTo(playlistId);

    try {
      // Community playlists use the suggest flow
      if (playlist.type === 'community') {
        await suggestSong(playlistId, songId);
        setSuccessMessage('Song suggested! The community will vote on it.');
      } else {
        await addToPlaylist(playlistId, selectedTrack);
        setSuccessMessage('Added to playlist!');
      }

      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1500);
    } catch (error) {
      const msg = error?.response?.data;
      if (typeof msg === 'string' && msg.includes('already in')) {
        alert('This song is already in that playlist');
      } else if (typeof msg === 'string' && msg.includes('already in or suggested')) {
        alert('This song has already been suggested for this playlist');
      } else {
        alert('Failed to add track');
      }
    } finally {
      setAddingTo(null);
    }
  };

  const handlePlayNext = (e) => {
    e.stopPropagation();
    playNext(selectedTrack);
    setQueuedMessage('Playing next');
    setTimeout(() => {
      setQueuedMessage('');
      onClose();
    }, 1200);
  };

  const handlePlayLater = (e) => {
    e.stopPropagation();
    playLater(selectedTrack);
    setQueuedMessage('Added to end of queue');
    setTimeout(() => {
      setQueuedMessage('');
      onClose();
    }, 1200);
  };

  const getPlaylistIcon = (pl) => {
    if (pl.type === 'community') return <Users size={14} className="pw-type-icon pw-type-community" />;
    if (pl.visibility === 'public') return <Globe size={14} className="pw-type-icon pw-type-public" />;
    return <Lock size={14} className="pw-type-icon pw-type-private" />;
  };

  const getActionLabel = (pl) => {
    if (pl.type === 'community') return 'Suggest';
    return 'Add';
  };

  return (
    <div className="pw-overlay" onClick={onClose}>
      <div className="pw-container" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="pw-header">
          <h3>Add to...</h3>
          <button className="pw-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Success / queued message */}
        {successMessage && (
          <div className="pw-success">
            <Check size={16} /> {successMessage}
          </div>
        )}
        {queuedMessage && (
          <div className="pw-success pw-queued">
            <Check size={16} /> {queuedMessage}
          </div>
        )}

        {/* Track preview */}
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

          {/* ── Queue Actions ── */}
          <div className="pw-section">
            <div className="pw-section-label">Queue</div>
            <div className="pw-queue-actions">
              <button className="pw-queue-btn" onClick={handlePlayNext}>
                <SkipForward size={16} />
                <div>
                  <span className="pw-queue-btn-title">Play Next</span>
                  <span className="pw-queue-btn-hint">After the current track</span>
                </div>
              </button>
              <button className="pw-queue-btn" onClick={handlePlayLater}>
                <ListEnd size={16} />
                <div>
                  <span className="pw-queue-btn-title">Play Later</span>
                  <span className="pw-queue-btn-hint">At the end of your queue</span>
                </div>
              </button>
            </div>
          </div>

          {/* ── Playlists ── */}
          <div className="pw-section">
            <div className="pw-section-label">Save to Playlist</div>

            {loading ? (
              <div className="pw-loading">Loading playlists...</div>
            ) : (
              <>
                {/* Create new playlist form */}
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
                    <div className="pw-empty">No playlists yet. Create one below!</div>
                  ) : (
                    playlists.map((pl) => (
                      <button
                        key={pl.id || pl.playlistId}
                        className={`pw-playlist-item ${pl.type === 'community' ? 'pw-community-item' : ''}`}
                        onClick={() => handleAddToPlaylist(pl)}
                        disabled={addingTo === (pl.id || pl.playlistId)}
                      >
                        <div className="pw-pl-info">
                          {getPlaylistIcon(pl)}
                          <div>
                            <div className="pw-pl-name">{pl.name}</div>
                            <div className="pw-pl-count">
                              {pl.songCount || pl.tracks?.length || 0} songs
                              {pl.type === 'community' && ' · Community'}
                            </div>
                          </div>
                        </div>
                        <span className="pw-pl-action">
                          {addingTo === (pl.id || pl.playlistId)
                            ? '...'
                            : getActionLabel(pl)}
                        </span>
                      </button>
                    ))
                  )}

                  <button
                    className="pw-create-btn"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                  >
                    <Plus size={18} /> Create New Playlist
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistWizard;