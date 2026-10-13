// src/BrowseTagPage.jsx
//
// A shelf of songs for one subgenre or one mood.
//   /browse/subgenre/:slug    e.g. /browse/subgenre/drill
//   /browse/mood/:slug        e.g. /browse/mood/chill
//   optional ?jid=<jurisdictionId>  — songs from that area (and its
//   neighborhoods) come first; defaults to the signed-in user's area.
//
// Reached from the chips on a song page and on Discover. Playing goes through
// requestPlay only (Play now / Add to queue prompt); the player counts plays.

import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import { JURISDICTION_IDS } from './utils/idMappings';
import { GENRE_LABELS } from './utils/taxonomy';
import { songToTrack } from './utils/songTrack';
import Layout from './layout';
import './recommendedSongs.scss';
import './browseTagPage.scss';

const AREA_NAMES = {
  [JURISDICTION_IDS.harlem]: 'Harlem',
  [JURISDICTION_IDS['uptown-harlem']]: 'Uptown Harlem',
  [JURISDICTION_IDS['downtown-harlem']]: 'Downtown Harlem',
};

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M3 2v10l9-5-9-5z" /></svg>
);

const BrowseTagPage = () => {
  const { kind, slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext);
  const { user, authLoaded } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isMood = kind === 'mood';
  const jid = searchParams.get('jid') || user?.jurisdiction?.jurisdictionId || null;
  const areaName = jid ? (AREA_NAMES[jid] || (jid === user?.jurisdiction?.jurisdictionId ? user.jurisdiction.name : null)) : null;

  useEffect(() => {
    if (!authLoaded) return;
    if (kind !== 'subgenre' && kind !== 'mood') {
      setError('That page does not exist.');
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set(isMood ? 'mood' : 'subgenre', slug);
    if (jid) params.set('jurisdictionId', jid);
    params.set('limit', '60');
    apiCall({ method: 'get', url: `/v1/media/songs/browse?${params.toString()}`, useCache: false })
      .then((res) => { if (active) setData(res.data); })
      .catch((err) => {
        console.error('[Browse] failed:', err);
        if (active) {
          setError(err?.response?.status === 404
            ? `We couldn't find that ${isMood ? 'mood' : 'subgenre'}.`
            : "We couldn't load these songs. Please try again in a moment.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, slug, jid, isMood, authLoaded]);

  const tag = isMood ? data?.mood : data?.subgenre;
  const songs = data?.songs || [];

  return (
    <Layout>
      <div className="btp">
        <p className="btp__eyebrow">
          {isMood ? 'Mood' : `Subgenre${tag?.genreId && GENRE_LABELS[tag.genreId] ? ` · ${GENRE_LABELS[tag.genreId]}` : ''}`}
        </p>
        <h1 className="btp__title">{tag?.name || (loading ? '…' : 'Browse')}</h1>
        {tag && (
          <p className="btp__sub">
            {isMood
              ? tag.description
              : tag.soundsLike ? `Sounds like ${tag.soundsLike}` : null}
          </p>
        )}
        {tag && areaName && (
          <p className="btp__area">Songs from {areaName} come first.</p>
        )}

        {loading && <div className="btp__status" role="status">Loading songs…</div>}
        {!loading && error && <div className="btp__status btp__status--error" role="alert">{error}</div>}
        {!loading && !error && songs.length === 0 && (
          <div className="btp__status">
            No songs here yet. When artists tag their songs {tag?.name || 'this way'}, they'll show up here.
          </div>
        )}

        {!loading && !error && songs.length > 0 && (
          <div className="btp__grid">
            {songs.map((s) => {
              const track = songToTrack(s, `browse-${kind}`);
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
                  <span className="rec__artist">
                    {track.artist}{track.jurisdiction ? ` · ${track.jurisdiction}` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BrowseTagPage;
