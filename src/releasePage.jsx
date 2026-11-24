// src/releasePage.jsx — an album, EP, mixtape or single (/release/:releaseId).
//
// Same art-led poster front, follow bar and track rows as the playlist page
// (it reuses playlistPage.scss), so a release feels like the rest of Unis.
// Play adds the release to the queue through requestPlayCollection, with the
// usual Play now / Add to queue prompt: it never wipes the queue.
// Each song still races on its own; the page says so under the list.
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Clock, Disc3, ListPlus, MoreHorizontal, Music, Pause, Play, Share2, Shuffle, UserRound,
} from 'lucide-react';
import FollowBar from './components/FollowBar';
import { useFollowBar } from './hooks/useFollowBar';
import useArtworkPalette from './hooks/useArtworkPalette';
import useArtHero from './hooks/useArtHero';
import Layout from './layout';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import { useFeedback } from './context/FeedbackContext';
import { buildUrl } from './utils/buildUrl';
import { RELEASE_TYPE_LABEL, formatReleaseLength, toSeconds } from './utils/releases';
import './playlistPage.scss';
import './releasePage.scss';

const formatTrackTime = (d) => {
  const sec = toSeconds(d);
  if (!sec) return '';
  return `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
};

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const ReleasePage = () => {
  const { releaseId } = useParams();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const { requestPlayCollection, playLater, queue, currentMedia, isPlaying, togglePlayPause, playQueueIndex } =
    useContext(PlayerContext);

  const [release, setRelease] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [more, setMore] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | missing
  const [menuKey, setMenuKey] = useState(null);

  const bar = useFollowBar({ ready: status === 'ready' });

  // ── Load ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      setMenuKey(null);
      try {
        const res = await apiCall({ url: `/v1/releases/${releaseId}`, method: 'get', useCache: false });
        if (cancelled) return;
        const rel = res.data?.release;
        if (!rel) { setStatus('missing'); return; }
        setRelease(rel);
        setTracks((res.data.tracks || []).map((s) => {
          const id = s.songId || s.id;
          return {
            ...s,
            id,
            songId: id,
            playlistItemId: id,
            title: s.title || 'Untitled',
            artist: s.artist?.username || rel.artistName,
            artistName: s.artist?.username || rel.artistName,
            artistId: s.artist?.userId || rel.artistId,
            artworkUrl: buildUrl(s.artworkUrl) || buildUrl(rel.coverUrl),
            artwork: buildUrl(s.artworkUrl) || buildUrl(rel.coverUrl),
            url: buildUrl(s.fileUrl),
            fileUrl: buildUrl(s.fileUrl),
            duration: s.duration || 0,
            explicit: !!s.explicit,
          };
        }));
        setStatus('ready');
        // "More by" — the artist's other releases.
        apiCall({ url: `/v1/releases/artist/${rel.artistId}`, method: 'get', useCache: false })
          .then((r) => { if (!cancelled) setMore((r.data || []).filter((x) => x.releaseId !== rel.releaseId)); })
          .catch((err) => console.error('More releases failed to load:', err));
      } catch (err) {
        if (cancelled) return;
        console.error('Release failed to load:', err);
        setStatus('missing');
      }
    })();
    return () => { cancelled = true; };
  }, [releaseId]);

  // Close the row menu on outside click / Escape
  useEffect(() => {
    if (!menuKey) return undefined;
    const close = () => setMenuKey(null);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuKey]);

  const cover = buildUrl(release?.coverUrl) || tracks[0]?.artworkUrl || null;
  const palette = useArtworkPalette(cover);
  const deepColor = cover ? palette.deep : 'color-mix(in srgb, var(--unis-primary), #07090f 72%)';
  const heroRef = useRef(null);
  useArtHero(heroRef, { deep: deepColor, ready: status === 'ready' && !!release });

  const playable = useMemo(() => tracks.filter((t) => t.url), [tracks]);
  const origin = useMemo(() => ({
    playlistId: release?.releaseId || releaseId,
    name: release?.title || 'Release',
    coverUrl: cover,
  }), [release?.releaseId, release?.title, releaseId, cover]);

  const playingFromHere = !!(currentMedia?.origin?.type === 'playlist' && currentMedia.origin.playlistId === origin.playlistId);
  const currentSongId = playingFromHere ? (currentMedia.playlistItemId || currentMedia.id) : null;
  const showPause = playingFromHere && isPlaying;

  const handlePlay = () => {
    if (playingFromHere) { togglePlayPause(); return; }
    if (!playable.length) return;
    requestPlayCollection({ tracks: playable, playlist: origin });
  };

  const handleShuffle = () => {
    if (!playable.length) return;
    requestPlayCollection({ tracks: playable, playlist: origin, shuffle: true });
  };

  const handleRow = (track) => {
    if (playingFromHere && currentSongId === track.songId) { togglePlayPause(); return; }
    if (playingFromHere) {
      const batch = currentMedia.origin.batchId;
      const qi = queue.findIndex((q) => q.origin?.batchId === batch && (q.playlistItemId || q.id) === track.songId);
      if (qi >= 0) { playQueueIndex(qi); return; }
    }
    const start = playable.indexOf(track);
    if (start < 0) { feedback.info('This song is unavailable right now'); return; }
    requestPlayCollection({ tracks: playable, playlist: origin, startIndex: start });
  };

  const addOne = (track) => {
    setMenuKey(null);
    playLater(track, { type: 'playlist', playlistId: origin.playlistId, name: origin.name, coverUrl: origin.coverUrl, batchId: `single-${track.songId}-${Date.now()}` });
  };

  const share = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: release?.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      feedback.success('Link copied');
    } catch (err) {
      if (err?.name !== 'AbortError') feedback.error('Could not share this release');
    }
  }, [release?.title, feedback]);

  if (status === 'loading') {
    return (
      <Layout>
        <div className="plp-shell plp-v2 rl-loading" aria-busy="true">
          <div className="rl-skel rl-skel--art" />
          <div className="rl-skel rl-skel--line" />
          <div className="rl-skel rl-skel--line rl-skel--short" />
        </div>
      </Layout>
    );
  }

  if (status === 'missing' || !release) {
    return (
      <Layout>
        <div className="plp-shell plp-v2">
          <div className="plp-unavailable">
            <div className="plp-unavailable-icon"><Disc3 size={34} /></div>
            <h2>This release isn&apos;t available</h2>
            <p>It may have been taken down by the artist.</p>
            <button type="button" className="plp-btn-pill" onClick={() => navigate(-1)}>Go back</button>
          </div>
        </div>
      </Layout>
    );
  }

  const typeLabel = RELEASE_TYPE_LABEL[release.type] || 'Release';
  const year = release.releasedAt ? new Date(release.releasedAt).getFullYear() : null;
  const songsWord = `${tracks.length} song${tracks.length === 1 ? '' : 's'}`;
  const lengthLabel = formatReleaseLength(release.durationMs);
  const glyph = (size) => (showPause
    ? <Pause size={size} fill="currentColor" />
    : <Play size={size} fill="currentColor" className="plp-play-glyph" />);

  return (
    <Layout>
      <FollowBar bar={bar} backdrop={cover} label={release.title} className="plp-bar">
        <div className="fb-who">
          {cover
            ? <img src={cover} alt="" className="plp-bar__cover" />
            : <span className="plp-bar__cover plp-bar__cover--empty"><Music size={16} /></span>}
          <span className="fb-text">
            <button type="button" className="plp-bar__title" onClick={bar.scrollToTop} aria-label={`Back to the top of ${release.title}`}>
              {release.title}
            </button>
            <span className="fb-line"><span>{typeLabel} · {release.artistName}</span></span>
          </span>
        </div>
        <button type="button" className="fb-icon plp-bar__shuffle" onClick={handleShuffle} disabled={!playable.length} aria-label={`Shuffle ${release.title}`}>
          <Shuffle size={18} />
        </button>
        <button type="button" className="fb-dock" onClick={handlePlay} disabled={!playingFromHere && !playable.length}
          aria-label={showPause ? 'Pause' : `Play ${release.title}`} tabIndex={bar.docked ? 0 : -1}>
          {glyph(16)}
        </button>
      </FollowBar>

      <div className="plp-shell plp-v2 rl-page" style={{ '--plp-deep': deepColor }}>
        <header className={`plp-poster ${cover ? '' : 'is-empty'}`} ref={heroRef}>
          {cover && <div className="plp-poster__glow" style={{ backgroundImage: `url("${cover}")` }} aria-hidden="true" />}
          <div className="plp-poster__art">
            {cover ? <img src={cover} alt="" /> : <div className="plp-cover-empty"><Disc3 size={88} strokeWidth={1.4} /></div>}
          </div>
          <div className="plp-poster__melt" aria-hidden="true" />
          <div className="plp-poster__shade" aria-hidden="true" />

          <button type="button" className="plp-back" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft size={19} />
          </button>

          <div className="plp-poster__text">
            <div className="plp-kicker">
              <span className="plp-kicker-type">{typeLabel}{year ? ` · ${year}` : ''}</span>
            </div>
            <h1 className={`plp-title ${release.title.length > 24 ? 'plp-title--long' : ''}`} ref={bar.titleRef} title={release.title}>
              {release.title}
            </h1>
            {release.description && <p className="plp-description">{release.description}</p>}
            <div className="plp-meta">
              <Link className="plp-creator" to={`/artist/${release.artistId}`}>
                {release.artistPhotoUrl
                  ? <img src={buildUrl(release.artistPhotoUrl)} alt="" />
                  : <span className="plp-creator-initial">{(release.artistName || '?').charAt(0).toUpperCase()}</span>}
                <strong>{release.artistName}</strong>
              </Link>
              <span className="plp-meta-item">{songsWord}{lengthLabel && `, ${lengthLabel}`}</span>
            </div>
          </div>
        </header>

        <div className="plp-page">
          <div className="plp-actions">
            <button type="button" className="plp-ring" onClick={share} aria-label="Share" title="Share">
              <Share2 size={19} />
            </button>
            <span className="plp-actions-spacer" />
            <button type="button" className="plp-ring plp-ring-bare plp-shuffle" onClick={handleShuffle} disabled={!playable.length}
              aria-label="Shuffle play" title="Shuffle play">
              <Shuffle size={21} />
            </button>
            <button ref={bar.playRef} type="button" className="plp-play" onClick={handlePlay}
              disabled={!playingFromHere && !playable.length} aria-label={showPause ? 'Pause' : 'Play'} title={showPause ? 'Pause' : 'Play'}>
              {glyph(24)}
            </button>
          </div>

          <div className="plp-list rl-list">
            <div className="plp-list-head" aria-hidden="true">
              <span className="plp-col-index">#</span>
              <span className="plp-col-title">Title</span>
              <span className="plp-col-added" />
              <span className="plp-col-time"><Clock size={15} /></span>
              <span className="plp-col-menu" />
            </div>
            {tracks.map((track, i) => {
              const isCurrent = currentSongId === track.songId;
              const open = menuKey === track.songId;
              return (
                <div key={track.songId} className={`plp-row-wrap ${open ? 'plp-row-wrap--menu' : ''}`} data-row-key={track.songId}>
                  <div
                    className={`plp-row ${isCurrent ? 'plp-row-current' : ''}`}
                    onClick={() => handleRow(track)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); handleRow(track); } }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Play ${track.title}`}
                  >
                    <div className="plp-col-index">
                      {isCurrent && isPlaying ? (
                        <span className="plp-eq" aria-label="Now playing"><span /><span /><span /></span>
                      ) : (
                        <>
                          <span className="plp-index-num">{i + 1}</span>
                          <span className="plp-index-play" aria-hidden="true">
                            {isCurrent ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="plp-col-title">
                      <span className="rl-num" aria-hidden="true">{i + 1}</span>
                      <div className="plp-title-text">
                        <div className="plp-track-title">{track.title}</div>
                        <span className="rl-sub">
                          {track.explicit && <span className="rl-ex" aria-label="Explicit">E</span>}
                          {track.artist}
                        </span>
                      </div>
                      {isCurrent && isPlaying && <span className="plp-eq plp-row-eq" aria-hidden="true"><span /><span /><span /></span>}
                    </div>
                    <div className="plp-col-added" />
                    <div className="plp-col-time">{formatTrackTime(track.duration)}</div>
                    <div className="plp-col-menu">
                      <button type="button" className={`plp-row-menu-btn ${open ? 'plp-open' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setMenuKey(open ? null : track.songId); }}
                        aria-label={`More options for ${track.title}`} aria-expanded={open}>
                        <MoreHorizontal size={18} />
                      </button>
                      {open && (
                        <div className="plp-menu plp-row-menu" onClick={(e) => e.stopPropagation()} role="menu">
                          <button type="button" role="menuitem" onClick={() => addOne(track)}><ListPlus size={16} /> Add to queue</button>
                          <button type="button" role="menuitem" onClick={() => navigate(`/song/${track.songId}`)}><Disc3 size={16} /> Go to song</button>
                          <button type="button" role="menuitem" onClick={() => navigate(`/artist/${track.artistId}`)}><UserRound size={16} /> Go to artist</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="rl-foot">
            Released {formatDate(release.releasedAt)}
            <br />
            Each song races on its own in the daily, weekly and monthly charts.
          </p>

          {more.length > 0 && (
            <section className="rl-more" aria-labelledby="rl-more-title">
              <h2 id="rl-more-title" className="rl-h2">More by {release.artistName}</h2>
              <div className="rl-shelf">
                {more.map((r) => (
                  <Link key={r.releaseId} to={`/release/${r.releaseId}`} className="rl-card">
                    {r.coverUrl
                      ? <img src={buildUrl(r.coverUrl)} alt="" className="rl-card__art" loading="lazy" />
                      : <span className="rl-card__art rl-card__art--empty"><Disc3 size={30} /></span>}
                    <span className="rl-card__title">{r.title}</span>
                    <span className="rl-card__sub">
                      {RELEASE_TYPE_LABEL[r.type] || 'Release'}{r.releasedAt ? ` · ${new Date(r.releasedAt).getFullYear()}` : ''}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ReleasePage;
