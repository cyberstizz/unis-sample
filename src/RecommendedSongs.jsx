// src/RecommendedSongs.jsx
//
// "Recommended" row on the song page. The backend picks the songs
// (same subgenre and neighborhood first, one more song by the same artist in
// the second slot, and it widens the match rather than leave gaps).
//
// Playing goes through requestPlay only, so the Play now / Add to queue
// prompt appears when a queue exists. Plays are NOT counted here; the player
// counts them after its normal listening threshold.

import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import { songToTrack } from './utils/songTrack';
import './recommendedSongs.scss';

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3 2v10l9-5-9-5z" /></svg>
);

const RecommendedSongs = ({ songId, limit = 8 }) => {
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext);
  const [songs, setSongs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!songId) return;
    let active = true;
    setLoaded(false);
    apiCall({ method: 'get', url: `/v1/media/song/${songId}/recommended?limit=${limit}`, useCache: false })
      .then((res) => { if (active) setSongs(Array.isArray(res.data) ? res.data : []); })
      .catch((err) => {
        console.error('[Recommended] could not load recommendations:', err);
        if (active) setSongs([]);
      })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [songId, limit]);

  // Nothing to recommend (a brand-new platform, or the request failed): show nothing.
  if (loaded && songs.length === 0) return null;

  return (
    <section className="rec" aria-labelledby="rec-title">
      <h2 className="rec__title" id="rec-title">Recommended</h2>
      {!loaded ? (
        <div className="rec__row" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="rec__card rec__card--ghost" />)}
        </div>
      ) : (
        <div className="rec__row">
          {songs.map((s) => {
            const track = songToTrack(s, 'recommended');
            return (
              <div className="rec__card" key={s.songId}>
                <div className="rec__art">
                  <button
                    type="button"
                    className="rec__open"
                    onClick={() => navigate(`/song/${s.songId}`)}
                    aria-label={`Open ${s.title} by ${track.artist}`}
                  >
                    {track.artwork
                      ? <img src={track.artwork} alt="" loading="lazy" decoding="async" />
                      : <span className="rec__art-fallback" aria-hidden="true">{(s.title || '?').charAt(0)}</span>}
                  </button>
                  {track.url && (
                    <button
                      type="button"
                      className="rec__play"
                      onClick={() => requestPlay(track)}
                      aria-label={`Play ${s.title}`}
                    >
                      <PlayIcon />
                    </button>
                  )}
                </div>
                <button type="button" className="rec__name" onClick={() => navigate(`/song/${s.songId}`)}>
                  {s.title}
                </button>
                <span className="rec__artist">{track.artist}</span>
                {s.primarySubgenre?.name && <span className="rec__tag">{s.primarySubgenre.name}</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default RecommendedSongs;
