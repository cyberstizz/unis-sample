import React, { useContext, useState } from 'react';
import { PlayerContext } from './context/playercontext';
import { X, Music } from 'lucide-react';
import PlaylistViewer from './playlistViewer';
import './playlistManager.scss';

const PlaylistManager = ({ open, onClose }) => {
  const { playlists, loading } = useContext(PlayerContext);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);

  if (!open) return null;

  const handleSelectPlaylist = (playlistId) => {
    setSelectedPlaylistId(playlistId);
  };

  const handleCloseViewer = () => {
    setSelectedPlaylistId(null);
  };

  return (
    <>
      <div className="pm-overlay" onClick={onClose}>
        <div className="pm-container" onClick={(e) => e.stopPropagation()}>
          <div className="pm-header">
            <h3>My Playlists</h3>
            <button className="pm-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="pm-body">
            {loading ? (
              <div className="pm-loading">Loading playlists...</div>
            ) : playlists.length === 0 ? (
              <div className="pm-empty">
                <Music size={48} />
                <p>No playlists yet</p>
                <p className="pm-empty-hint">Click the + button on the player to create one!</p>
              </div>
            ) : (
              <div className="pm-grid">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    className="pm-playlist-card"
                    onClick={() => handleSelectPlaylist(pl.id)}
                  >
                    <div className="pm-card-artwork">
                      {pl.tracks && pl.tracks.length > 0 ? (
                        <img 
                          src={pl.tracks[0].artworkUrl || '/assets/placeholder.jpg'} 
                          alt="" 
                        />
                      ) : (
                        <div className="pm-card-empty">
                          <Music size={32} />
                        </div>
                      )}
                    </div>
                    <div className="pm-card-info">
                      <div className="pm-card-name">{pl.name}</div>
                      <div className="pm-card-count">
                        {pl.tracks?.length || 0} track{pl.tracks?.length === 1 ? '' : 's'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPlaylistId && (
        <PlaylistViewer
          playlistId={selectedPlaylistId}
          onClose={handleCloseViewer}
        />
      )}
    </>
  );
};

export default PlaylistManager;