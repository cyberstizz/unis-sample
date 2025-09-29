import React, { useContext } from 'react';
import { PlayerContext } from './context/playercontext';
import './playlists.scss';

const Playlists = () => {
  const { playlists, createPlaylist, loadPlaylist, addToPlaylist, removeFromPlaylist, reorderPlaylist } = useContext(PlayerContext);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (newName) {
      createPlaylist(newName);
      setNewName('');
    }
  };

  // Example add (pass track from feed/search)
  const handleAdd = (playlistId, track) => addToPlaylist(playlistId, track);

  return (
    <div className="playlists-container">
      <h2>Playlists</h2>
      <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New Playlist Name" />
      <button onClick={handleCreate}>Create</button>
      <ul>
        {playlists.map(pl => (
          <li key={pl.id}>
            {pl.name} ({pl.tracks.length} tracks)
            <button onClick={() => loadPlaylist(pl)}>Load</button>
            {/* Add edit UI: list tracks, buttons to add/remove/reorder */}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Playlists;