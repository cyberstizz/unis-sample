import React, { useContext, useState } from "react";
import { PlayerContext } from "./context/playercontext";
import PlaylistViewer from "./playlistViewer";
import "./playlistpanel.scss";

const PlaylistPanel = () => {
  const { playlists } = useContext(PlayerContext);

  const [openViewer, setOpenViewer] = useState(false);
  const [viewerTracks, setViewerTracks] = useState([]);
  const [viewerTitle, setViewerTitle] = useState("");

  const handleOpen = (playlist) => {
    setViewerTracks(playlist.tracks || []);
    setViewerTitle(playlist.name);
    setOpenViewer(true);
  };

  return (
    <div className="ppanel-container">
      <h3 className="ppanel-title">Your Playlists</h3>

      <div className="ppanel-list">
        {playlists.map((pl) =>
          pl.isDefault ? null : (
            <div key={pl.id} className="ppanel-item">
              <div className="ppanel-info">
                <p className="ppanel-name">{pl.name}</p>
                <p className="ppanel-count">{pl.tracks.length} tracks</p>
              </div>

              <button
                className="ppanel-open-btn"
                onClick={() => handleOpen(pl)}
              >
                Open
              </button>
            </div>
          )
        )}
      </div>

      {openViewer && (
        <PlaylistViewer
          title={viewerTitle}
          tracks={viewerTracks}
          onClose={() => setOpenViewer(false)}
          onSelect={() => setOpenViewer(false)}     
          onRemove={(trackId) => {
            setViewerTracks((prev) => prev.filter((t) => t.id !== trackId));
          }}
          onReorder={(newOrder) => {
            setViewerTracks(newOrder);
          }}
        />
      )}
    </div>
  );
};

export default PlaylistPanel;
