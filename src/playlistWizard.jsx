import React, { useContext, useState, useRef } from 'react';
import { PlayerContext } from './context/playercontext';
import {
  X, Plus, Check, SkipForward, ListEnd, Users, Lock, Globe, EyeOff,
  Image as ImageIcon
} from 'lucide-react';
import axiosInstance from './components/axiosInstance';
import './playlistWizard.scss';

const PlaylistWizard = ({ open, onClose, selectedTrack }) => {
  const {
    playlists, createPlaylist, addToPlaylist,
    playNext, playLater, suggestSong,
    loading
  } = useContext(PlayerContext);

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newVisibility, setNewVisibility] = useState('private');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [creating, setCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [queuedMessage, setQueuedMessage] = useState('');
  const coverInputRef = useRef(null);

  if (!open || !selectedTrack) return null;

  const resetCreateForm = () => {
    setNewPlaylistName('');
    setNewVisibility('private');
    setCoverFile(null);
    setCoverPreview(null);
    setShowCreateForm(false);
  };

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Cover image must be under 5MB');
      return;
    }
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    setCreating(true);

    try {
      let coverUrl = null;
      if (coverFile) {
        const formData = new FormData();
        formData.append('cover', coverFile);
        // No manual Content-Type — axios handles the multipart boundary
        const res = await axiosInstance.post('/v1/playlists/cover', formData);
        coverUrl = res.data.coverImageUrl;
      }

      await createPlaylist(newPlaylistName.trim(), 'personal', {
        visibility: newVisibility,
        coverImageUrl: coverUrl,
      });

      resetCreateForm();
      setSuccessMessage('Playlist created!');
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (error) {
      console.error('Failed to create playlist:', error);
      alert('Failed to create playlist');
    } finally {
      setCreating(false);
    }
  };

  const handleAddToPlaylist = async (playlist) => {
    const songId = selectedTrack?.songId || selectedTrack?.id;
    if (!songId) return alert('No track selected');

    const playlistId = playlist.id || playlist.playlistId;
    setAddingTo(playlistId);

    try {
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
    setTimeout(() => { setQueuedMessage(''); onClose(); }, 1200);
  };

  const handlePlayLater = (e) => {
    e.stopPropagation();
    playLater(selectedTrack);
    setQueuedMessage('Added to end of queue');
    setTimeout(() => { setQueuedMessage(''); onClose(); }, 1200);
  };

  const getPlaylistIcon = (pl) => {
    if (pl.type === 'community') return <Users size={14} className="pw-type-icon pw-type-community" />;
    if (pl.visibility === 'public') return <Globe size={14} className="pw-type-icon pw-type-public" />;
    if (pl.visibility === 'unlisted') return <EyeOff size={14} className="pw-type-icon pw-type-unlisted" />;
    return <Lock size={14} className="pw-type-icon pw-type-private" />;
  };

  const getActionLabel = (pl) => pl.type === 'community' ? 'Suggest' : 'Add';

  return (
    <div className="pw-overlay" onClick={onClose}>
      <div className="pw-container" onClick={(e) => e.stopPropagation()}>

        <div className="pw-header">
          <h3>Add to...</h3>
          <button className="pw-close" onClick={onClose}>
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

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

          {/* Queue actions */}
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

          {/* Save to playlist */}
          <div className="pw-section">
            <div className="pw-section-label">Save to Playlist</div>

            {loading ? (
              <div className="pw-loading">Loading playlists...</div>
            ) : (
              <>
                {showCreateForm && (
                  <div className="pw-create-form">
                    <input
                      type="text"
                      placeholder="Playlist name"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !creating && handleCreatePlaylist()}
                      autoFocus
                      maxLength={100}
                    />

                    <div className="pw-cover-upload">
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleCoverSelect}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        className="pw-cover-btn"
                        onClick={() => coverInputRef.current?.click()}
                      >
                        {coverPreview ? (
                          <img src={coverPreview} alt="" className="pw-cover-preview" />
                        ) : (
                          <>
                            <ImageIcon size={20} />
                            <span>Add cover image</span>
                          </>
                        )}
                      </button>
                      {coverFile && (
                        <button
                          type="button"
                          className="pw-cover-clear"
                          onClick={() => { setCoverFile(null); setCoverPreview(null); }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div className="pw-vis-toggle">
                      <button
                        type="button"
                        className={`pw-vis-pill ${newVisibility === 'private' ? 'active' : ''}`}
                        onClick={() => setNewVisibility('private')}
                      >
                        <Lock size={12} /> Private
                      </button>
                      <button
                        type="button"
                        className={`pw-vis-pill ${newVisibility === 'unlisted' ? 'active' : ''}`}
                        onClick={() => setNewVisibility('unlisted')}
                      >
                        <EyeOff size={12} /> Unlisted
                      </button>
                      <button
                        type="button"
                        className={`pw-vis-pill ${newVisibility === 'public' ? 'active' : ''}`}
                        onClick={() => setNewVisibility('public')}
                      >
                        <Globe size={12} /> Public
                      </button>
                    </div>

                    <div className="pw-create-actions">
                      <button onClick={resetCreateForm}>Cancel</button>
                      <button
                        onClick={handleCreatePlaylist}
                        disabled={!newPlaylistName.trim() || creating}
                        className="pw-create-confirm"
                      >
                        {creating ? 'Creating...' : 'Create'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="pw-playlists">
                  {playlists.length === 0 && !showCreateForm ? (
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
                          {addingTo === (pl.id || pl.playlistId) ? '...' : getActionLabel(pl)}
                        </span>
                      </button>
                    ))
                  )}

                  {!showCreateForm && (
                    <button
                      className="pw-create-btn"
                      onClick={() => setShowCreateForm(true)}
                    >
                      <Plus size={18} /> Create New Playlist
                    </button>
                  )}
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