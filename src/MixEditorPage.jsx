// src/MixEditorPage.jsx
//
// /playlist/:playlistId/mix/:index — the desktop Mix editor (Round 3 design)
// for the transition from song `index` to song `index + 1` of a playlist.
// Phones edit in a sheet on the playlist page instead.

import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from './layout';
import MixEditor from './MixEditor';
import { PlayerContext } from './context/playercontext';
import axiosInstance from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import './playback.scss';

const normalize = (t) => ({
  ...t,
  id: t.songId || t.id,
  songId: t.songId || t.id,
  title: t.title || 'Untitled',
  artist: t.artistName || t.artist || 'Unknown Artist',
  artworkUrl: buildUrl(t.artworkUrl),
  artwork: buildUrl(t.artworkUrl),
  url: buildUrl(t.fileUrl),
  fileUrl: buildUrl(t.fileUrl),
  duration: t.duration || 0,
});

export default function MixEditorPage() {
  const { playlistId, index } = useParams();
  const navigate = useNavigate();
  const { loadPlaylistDetails } = useContext(PlayerContext);
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [mix, setMix] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let off = false;
    (async () => {
      setStatus('loading');
      const data = await loadPlaylistDetails(playlistId);
      if (off) return;
      if (!data) { setStatus('missing'); return; }
      setPlaylist(data);
      setTracks((data.tracks || []).filter((t) => (t.status || 'active') === 'active').map(normalize));
      try {
        const res = await axiosInstance.get(`/v1/playlists/${playlistId}/mix`);
        if (!off) setMix(res.data);
      } catch {
        if (!off) setMix({ enabled: false, transitions: [], canEdit: false });
      }
      if (!off) setStatus('ready');
    })();
    return () => { off = true; };
  }, [playlistId]); // eslint-disable-line react-hooks/exhaustive-deps

  const i = Math.max(0, Math.min(Number(index) || 0, Math.max(0, tracks.length - 2)));

  return (
    <Layout>
      <div className="mxe-pagewrap">
        {status === 'loading' && <div className="mxe-loading" aria-busy="true">Loading the mix…</div>}
        {status === 'missing' && (
          <div className="mxe-loading">
            This playlist isn’t available.
            <button type="button" className="mxe-ghost" onClick={() => navigate('/playlists')}>Your library</button>
          </div>
        )}
        {status === 'ready' && tracks.length < 2 && (
          <div className="mxe-loading">A mix needs at least two songs.</div>
        )}
        {status === 'ready' && tracks.length >= 2 && mix && (
          <MixEditor
            variant="page"
            playlistId={playlistId}
            playlistName={playlist?.name}
            ownerName={playlist?.creatorName}
            tracks={tracks}
            index={i}
            mix={mix}
            canEdit={!!mix.canEdit}
            onClose={() => navigate(`/playlist/${playlistId}`)}
            onNavigatePair={(n) => navigate(`/playlist/${playlistId}/mix/${n}`, { replace: true })}
            onSaved={(m) => setMix(m)}
          />
        )}
      </div>
    </Layout>
  );
}
