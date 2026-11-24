// src/NewReleases.jsx — release alerts in Messages.
//
//   NewReleasesRow   pinned above the chats: the newest covers, who dropped,
//                    how many you haven't seen. Hidden when there's nothing
//                    or when In Unis alerts are off (Settings).
//   NewReleasesView  the list: newest first, unseen ones tinted, the artist's
//                    note, one-tap play. Kept 90 days, nothing capped.
//                    Opening it marks everything seen (the badge clears).
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import { useFeedback } from './context/FeedbackContext';
import buildUrl from './utils/buildUrl';
import {
  ALERTS_CHANGED,
  alertGroup,
  alertPath,
  alertRowLine,
  alertVerb,
  alertWhen,
  fetchAlertSummary,
  fetchAlerts,
  markAlertsSeen,
} from './utils/releaseAlerts';
import './releaseAlerts.scss';

export const NewReleasesRow = ({ onOpen }) => {
  const [summary, setSummary] = useState(null);

  const load = useCallback(() => {
    fetchAlertSummary()
      .then(setSummary)
      .catch((err) => {
        console.error('Release alert summary failed:', err);
        setSummary(null);
      });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(ALERTS_CHANGED, load);
    return () => window.removeEventListener(ALERTS_CHANGED, load);
  }, [load]);

  if (!summary?.inApp || !summary.preview?.length) return null;
  const unseen = Number(summary.unseen || 0);

  return (
    <button type="button" className={`ra-row ${unseen > 0 ? 'has-new' : ''}`} onClick={onOpen}>
      <span className="ra-row__covers" aria-hidden="true">
        {summary.preview.map((it) => {
          const art = buildUrl(it.coverUrl);
          return art ? <img key={it.alertId} src={art} alt="" /> : <span key={it.alertId} />;
        })}
      </span>
      <span className="ra-row__text">
        <span className="ra-row__title">New releases</span>
        <span className="ra-row__sub">{alertRowLine(summary.names)}</span>
      </span>
      {unseen > 0 && (
        <span className="ra-row__badge" aria-label={`${unseen} new`}>
          {unseen}
        </span>
      )}
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
};

const toTrack = (s, fallbackArtist, fallbackCover) => {
  const id = s.songId || s.id;
  return {
    ...s,
    id,
    songId: id,
    playlistItemId: id,
    type: 'song',
    title: s.title || 'Untitled',
    artist: s.artist?.username || fallbackArtist,
    artistName: s.artist?.username || fallbackArtist,
    artistId: s.artist?.userId || s.artistId,
    artworkUrl: buildUrl(s.artworkUrl) || buildUrl(fallbackCover),
    artwork: buildUrl(s.artworkUrl) || buildUrl(fallbackCover),
    url: buildUrl(s.fileUrl),
    fileUrl: buildUrl(s.fileUrl),
    duration: s.duration || 0,
    explicit: !!s.explicit,
  };
};

export const NewReleasesView = ({ onBack }) => {
  const feedback = useFeedback();
  const { requestPlay, requestPlayCollection } = useContext(PlayerContext);
  const [items, setItems] = useState(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let active = true;
    fetchAlerts()
      .then((list) => {
        if (!active) return;
        setItems(list);
        if (list.some((i) => i.unseen)) {
          markAlertsSeen().catch((err) => console.error('Marking alerts seen failed:', err));
        }
      })
      .catch((err) => {
        console.error('Release alerts failed:', err);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const anyTinted = (items || []).some((i) => i.unseen);

  const play = async (it) => {
    setBusy(it.alertId);
    try {
      if (it.kind === 'RELEASE') {
        const res = await apiCall({ url: `/v1/releases/${it.releaseId}`, method: 'get', useCache: false });
        const rel = res.data?.release;
        const tracks = (res.data?.tracks || []).map((s) => toTrack(s, it.artistName, rel?.coverUrl)).filter((t) => t.url);
        if (!tracks.length) throw new Error('nothing playable');
        requestPlayCollection({
          tracks,
          playlist: { playlistId: it.releaseId, name: rel?.title || it.title, coverUrl: buildUrl(rel?.coverUrl) || tracks[0].artworkUrl },
        });
      } else {
        const res = await apiCall({ url: `/v1/media/song/${it.songId}`, method: 'get', useCache: false });
        const track = toTrack({ ...res.data, artistId: it.artistId }, it.artistName, it.coverUrl);
        if (!track.url) throw new Error('nothing playable');
        requestPlay(track);
      }
    } catch (err) {
      console.error('Playing from alerts failed:', err);
      feedback.error(`Couldn't play ${it.title}. Try again.`);
    } finally {
      setBusy(null);
    }
  };

  let lastGroup = null;

  return (
    <div className="ra-view">
      <header className="udm-list__head udm-list__head--sub ra-view__head">
        <button type="button" className="udm-round" onClick={onBack} aria-label="Back to messages">
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h1 className="udm-list__title udm-list__title--sub">New releases</h1>
        {anyTinted && (
          <button
            type="button"
            className="ra-view__seen"
            onClick={() => setItems((list) => list.map((i) => ({ ...i, unseen: false })))}
          >
            Mark all seen
          </button>
        )}
      </header>
      <div className="udm-list__scroll">
        <p className="ra-view__lede">From artists you follow. Kept for 90 days.</p>
        {error ? (
          <p className="ra-empty">Couldn’t load your new releases. Try again later.</p>
        ) : items === null ? (
          <p className="ra-empty" role="status">Loading…</p>
        ) : items.length === 0 ? (
          <div className="ra-none">
            <h2>
              Nothing <em>new</em> yet
            </h2>
            <p>When an artist you follow drops a song, EP, mixtape or album, it shows up here.</p>
            <Link to="/findpage" className="ra-none__go">Find artists near you</Link>
          </div>
        ) : (
          <ul className="ra-list">
            {items.map((it) => {
              const group = alertGroup(it.at);
              const head = group !== lastGroup ? group : null;
              lastGroup = group;
              const art = buildUrl(it.coverUrl);
              return (
                <React.Fragment key={it.alertId}>
                  {head && <li className="ra-list__group">{head}</li>}
                  <li className={`ra-item ${it.unseen ? 'is-new' : ''}`}>
                    <Link to={alertPath(it)} className="ra-item__link">
                      {art ? <img src={art} alt="" className="ra-item__art" /> : <span className="ra-item__art" aria-hidden="true" />}
                      <span className="ra-item__text">
                        <span className="ra-item__who">
                          <b>{it.artistName}</b> {alertVerb(it)} · {alertWhen(it.at)}
                        </span>
                        <span className="ra-item__title">{it.title}</span>
                        {it.note && <span className="ra-item__note">“{it.note}”</span>}
                      </span>
                    </Link>
                    <button
                      type="button"
                      className="ra-item__play"
                      aria-label={`Play ${it.title}`}
                      disabled={busy === it.alertId}
                      onClick={() => play(it)}
                    >
                      <Play size={17} fill="currentColor" aria-hidden="true" />
                    </button>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
