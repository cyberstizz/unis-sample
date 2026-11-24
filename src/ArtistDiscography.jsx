// src/ArtistDiscography.jsx — "Latest release" + "Discography" on the artist page.
//
// Latest release: the newest album/EP/mixtape/single, tagged NEW for a week,
// with a Play button that queues the whole release (Play now / Add to queue).
// Discography: filter chips (only for types the artist actually has) over a
// row of covers. Songs that aren't on any release count as singles.
// "Show all songs" opens the full Popular list, so nobody has to open
// release after release to find a song.
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Disc3, Play } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import { useFeedback } from './context/FeedbackContext';
import { buildUrl } from './utils/buildUrl';
import { RELEASE_CHIPS, RELEASE_TYPE_LABEL, formatReleaseLength, isNewRelease } from './utils/releases';
import './artistDiscography.scss';

const shortDate = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
};
const yearOf = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null;
};

const ArtistDiscography = ({ artistId, artistName, songs = [], onShowAllSongs }) => {
  const { requestPlayCollection } = useContext(PlayerContext);
  const feedback = useFeedback();
  const [releases, setReleases] = useState([]);
  const [chip, setChip] = useState('all');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!artistId) return undefined;
    let cancelled = false;
    setChip('all');
    apiCall({ method: 'get', url: `/v1/releases/artist/${artistId}`, useCache: false })
      .then((res) => { if (!cancelled) setReleases(Array.isArray(res.data) ? res.data : []); })
      .catch((err) => {
        console.error('Releases failed to load:', artistId, err);
        if (!cancelled) setReleases([]);
      });
    return () => { cancelled = true; };
  }, [artistId]);

  // Everything in one list, newest first: releases, then songs on no release (as singles).
  const items = useMemo(() => {
    const rel = releases.map((r) => ({
      key: `r-${r.releaseId}`,
      type: r.type,
      title: r.title,
      cover: buildUrl(r.coverUrl),
      date: r.releasedAt,
      to: `/release/${r.releaseId}`,
    }));
    const loose = songs
      .filter((s) => !s.releaseId)
      .map((s) => ({
        key: `s-${s.songId}`,
        type: 'SINGLE',
        title: s.title,
        cover: buildUrl(s.artworkUrl),
        date: s.createdAt,
        to: `/song/${s.songId}`,
      }));
    return [...rel, ...loose].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  }, [releases, songs]);

  const present = useMemo(() => new Set(items.map((i) => i.type)), [items]);
  const chips = RELEASE_CHIPS.filter((c) => c.key === 'all' || present.has(c.key));
  const shown = chip === 'all' ? items : items.filter((i) => i.type === chip);

  if (items.length === 0) return null;

  const latest = releases[0] || null;

  const playLatest = async () => {
    if (!latest || starting) return;
    setStarting(true);
    try {
      const res = await apiCall({ method: 'get', url: `/v1/releases/${latest.releaseId}`, useCache: false });
      const cover = buildUrl(latest.coverUrl);
      const tracks = (res.data?.tracks || [])
        .map((s) => {
          const id = s.songId || s.id;
          return {
            ...s,
            id,
            songId: id,
            playlistItemId: id,
            title: s.title,
            artist: s.artist?.username || artistName,
            artistName: s.artist?.username || artistName,
            artistId: s.artist?.userId || artistId,
            artworkUrl: buildUrl(s.artworkUrl) || cover,
            artwork: buildUrl(s.artworkUrl) || cover,
            url: buildUrl(s.fileUrl),
            fileUrl: buildUrl(s.fileUrl),
          };
        })
        .filter((t) => t.url);
      if (!tracks.length) { feedback.info('This release has nothing to play right now'); return; }
      requestPlayCollection({ tracks, playlist: { playlistId: latest.releaseId, name: latest.title, coverUrl: cover } });
    } catch (err) {
      console.error('Could not start release:', err);
      feedback.error('Could not play this release');
    } finally {
      setStarting(false);
    }
  };

  return (
    <section className="ap-disco" aria-label="Releases">
      {latest && (
        <>
          <h3 className="ap-disco__h">Latest release</h3>
          <div className="ap-disco__latest">
            <Link to={`/release/${latest.releaseId}`} className="ap-disco__latest-open">
              {latest.coverUrl
                ? <img src={buildUrl(latest.coverUrl)} alt="" className="ap-disco__latest-art" />
                : <span className="ap-disco__latest-art ap-disco__art--empty"><Disc3 size={30} /></span>}
              <span className="ap-disco__latest-text">
                <span className="ap-disco__kicker">
                  {RELEASE_TYPE_LABEL[latest.type] || 'Release'}{latest.releasedAt ? ` · ${shortDate(latest.releasedAt)}` : ''}
                  {isNewRelease(latest.releasedAt) && <span className="ap-disco__new">NEW</span>}
                </span>
                <span className="ap-disco__latest-title">{latest.title}</span>
                <span className="ap-disco__latest-meta">
                  {latest.trackCount} song{latest.trackCount === 1 ? '' : 's'}
                  {formatReleaseLength(latest.durationMs) && ` · ${formatReleaseLength(latest.durationMs)}`}
                </span>
              </span>
            </Link>
            <button type="button" className="ap-disco__play" onClick={playLatest} disabled={starting}
              aria-label={`Play ${latest.title}`}>
              <Play size={20} fill="currentColor" />
            </button>
          </div>
        </>
      )}

      <h3 className="ap-disco__h">Discography</h3>
      <div className="ap-disco__chips" role="tablist" aria-label="Filter releases">
        {chips.map((c) => (
          <button key={c.key} type="button" role="tab" aria-selected={chip === c.key}
            className={`ap-disco__chip ${chip === c.key ? 'is-on' : ''}`} onClick={() => setChip(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="ap-disco__shelf">
        {shown.map((it) => (
          <Link key={it.key} to={it.to} className="ap-disco__card">
            {it.cover
              ? <img src={it.cover} alt="" className="ap-disco__art" loading="lazy" />
              : <span className="ap-disco__art ap-disco__art--empty"><Disc3 size={30} /></span>}
            <span className="ap-disco__title">{it.title}</span>
            <span className="ap-disco__sub">
              {RELEASE_TYPE_LABEL[it.type] || 'Release'}{yearOf(it.date) ? ` · ${yearOf(it.date)}` : ''}
            </span>
          </Link>
        ))}
      </div>

      {onShowAllSongs && (
        <button type="button" className="ap-disco__all" onClick={onShowAllSongs}>
          Show all songs <ChevronRight size={15} />
        </button>
      )}
    </section>
  );
};

export default ArtistDiscography;
