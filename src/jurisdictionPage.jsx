// ═══════════════════════════════════════════════════════════════════════════
//  UNIS — Jurisdiction Page (v5)
//
//  The identity page for one place. Three sections, three jobs:
//    1. Hero        — who this place is RIGHT NOW (name, live stats, song of
//                     the week)
//    2. Chart       — this week's rankings (top artists + top tracks)
//    3. Hall of fame — the history (WinnersTimeline, embedded, ONE instance)
//
//  v5 changes from v4:
//    • Removed the duplicate <WinnersTimeline> that rendered outside .jp
//      (the "second timeline running down the whole page" bug)
//    • Removed the Local Anthem + About sections and the trending strip —
//      each repeated content that already lives in the hero or the boards
//    • Hero pills + stats are now 100% data-derived (no hardcoded "Harlem" /
//      "Invite-Only" / "Active Poll: Live" literals)
//    • alert() → inline toast (same pattern as findpage)
//    • Theme contract: jurisdictionPage.scss resolves every colour from the
//      token layer (theme.scss + unis-design-tokens.scss)
//
//  Rankings (Oct 2026): the boards and hero stats come from
//  /v1/awards/standings (utils/standings.js) — this week, all genres, ranked
//  by the same formula that decides awards, with movement since last week.
//  Before anyone scores in a new week they show last week's final, and the
//  labels say so. The old /tops endpoint ranked by all-time numbers.
//
//  Play tracking is deliberately absent: the Player counts plays after real
//  listening. The page-level POST that used to live here raced it.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import './jurisdictionPage.scss';
import Layout from './layout';
import prominentArtistBg from './assets/songartworkfour.jpeg';
import albumArt from './assets/songartworktwo.jpeg';
import heroHarlem from './assets/apollopic.jpg';
import heroDefault from './assets/biglpic.jpg';
import { buildUrl } from './utils/buildUrl';
import WinnersTimeline from './winnersTimeline';
import RankMove from './components/RankMove';
import { fetchStandings, describeBoard } from './utils/standings';

const TOAST_MS = 4500;

// ── Hero backdrop imagery ────────────────────────────────────────────────────
// One stock photo per jurisdiction, blended into the theme gradient so it
// reads as texture rather than a picture. To add a real photo: drop it in
// ./assets and add a lowercase-name entry here — nothing else changes.
//
// When the backend starts serving a per-jurisdiction image, prefer
// `jurDetails.heroImageUrl` and keep this map as the fallback. The
// Jurisdiction entity already carries `symbolUrl`, which is wired below as
// the first choice when present.
const HERO_IMAGES = {
  'harlem': heroHarlem,
  'uptown harlem': heroHarlem,
  'downtown harlem': heroHarlem,
};

const heroImageFor = (name) =>
  HERO_IMAGES[String(name || '').trim().toLowerCase()] || heroDefault;

// Inline play icon — same guaranteed-visibility approach as Player/Feed
const PlayIcon = ({ size = 14 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{
      width: size,
      height: size,
      display: 'block',
      fill: '#FFFFFF',
      flexShrink: 0,
    }}
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

// Three-bar mini equalizer — the "live" signal on the charts pill.
// Pure CSS animation (frozen under prefers-reduced-motion in the scss).
const LiveBars = () => (
  <span className="jp-eq" aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

const JurisdictionPage = ({ jurisdiction = 'Harlem' }) => {
  const { jurisdiction: jurNameFromParams } = useParams();
  const jurName = jurNameFromParams || jurisdiction;
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const toastTimer = useRef(null);
  // songId the user asked this page to play, awaiting confirmation that it
  // actually became the current track (see the tracking effect below).

  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  // ── Fetch jurisdiction + weekly tops ──────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      if (!jurName) {
        setError('No jurisdiction specified.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const jurResponse = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/byName/${encodeURIComponent(jurName)}`,
        });

        // Backend returns an array; be tolerant of a bare object.
        const body = jurResponse.data;
        const jurDetails = Array.isArray(body) ? body[0] : body;
        const jurId = jurDetails?.jurisdictionId;

        if (!jurId) throw new Error('Jurisdiction not found');

        // This week's boards, ranked by the same formula as awards. Before
        // anyone scores in a new week they show last week's final.
        const [artistBoard, songBoard] = await Promise.all([
          fetchStandings({ type: 'artist', jurisdictionId: jurId, genre: 'all', period: 'weekly', limit: 25 }),
          fetchStandings({ type: 'song', jurisdictionId: jurId, genre: 'all', period: 'weekly', limit: 10 }),
        ]);
        const scoredArtists = artistBoard.entries.filter((e) => e.points > 0);
        const scoredSongs = songBoard.entries.filter((e) => e.points > 0);
        const topArtist = scoredArtists[0];
        const topSong = scoredSongs[0];

        const normalized = {
          description:
            jurDetails.bio ||
            `The heartbeat of ${jurName}. Where local artists define the sound of the streets.`,

          // hasChildren is the one hierarchy signal byName gives us:
          // leaves are neighborhoods, everything above is a district.
          isLeaf: jurDetails.hasChildren === false,

          jurisdictionId: jurId,

          // Backend-supplied art wins; otherwise the local stock photo.
          heroImage: buildUrl(jurDetails.symbolUrl) || heroImageFor(jurName),

          status: describeBoard(artistBoard),
          finished: artistBoard.state !== 'LIVE',

          topArtistName: topArtist?.name || null,

          songOfWeek: topSong
            ? {
                id: topSong.id,
                title: topSong.name,
                artist: topSong.artistName || 'Unknown',
                artistId: topSong.artistId,
                image: topSong.artwork || albumArt,
                fileUrl: topSong.fileUrl,
              }
            : null,

          artistsCharting: scoredArtists.length,
          artistsChartingMore: scoredArtists.length === 25 && artistBoard.total > 25,
          pointsThisWeek: scoredArtists.reduce((sum, a) => sum + a.points, 0),

          topArtists: scoredArtists.slice(0, 10).map((artist) => ({
            id: artist.id,
            rank: artist.rank,
            name: artist.name,
            genre: artist.homeJurisdictionName || '',
            score: artist.points,
            movement: artist.movement,
            isNew: artist.isNew,
            thumbnail: artist.artwork || prominentArtistBg,
          })),

          topSongs: scoredSongs.map((song) => ({
            id: song.id,
            rank: song.rank,
            title: song.name,
            artist: song.artistName || 'Unknown',
            artistId: song.artistId,
            score: song.points,
            movement: song.movement,
            isNew: song.isNew,
            thumbnail: song.artwork || prominentArtistBg,
            fileUrl: song.fileUrl,
          })),
        };

        setData(normalized);
      } catch (err) {
        console.error('[jurisdiction] fetch error:', err?.message || err);
        setError(`Couldn't load ${jurName}. Check your connection and try again.`);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jurName]);

  // ── Play tracking — deliberately absent. The Player counts a play after
  //    real listening (15s / 25%, with source and playId). A page-level POST
  //    here raced it and credited skips, which now move rankings.

  // ── Play handlers — everything funnels through requestPlay ────────────────

  const playSong = useCallback(
    (song) => {
      if (!song.fileUrl) {
        showToast("This track isn't available right now.");
        return;
      }

      requestPlay({
        type: 'song',
        id: song.id,
        songId: song.id,
        url: song.fileUrl,
        fileUrl: song.fileUrl,
        title: song.title,
        artist: song.artist,
        artistId: song.artistId,
        artwork: song.thumbnail || song.image,
        artworkUrl: song.thumbnail || song.image,
        source: 'jurisdiction',
      });
    },
    [requestPlay, showToast]
  );

  const playArtist = useCallback(
    async (artist) => {
      try {
        const response = await apiCall({
          method: 'get',
          url: `/v1/users/${artist.id}/default-song`,
        });

        const defaultSong = response.data;

        if (!defaultSong?.fileUrl) {
          showToast(`${artist.name} hasn't set a default song yet.`);
          return;
        }

        const fullUrl = buildUrl(defaultSong.fileUrl);
        const fullArtwork = buildUrl(defaultSong.artworkUrl) || artist.thumbnail;

        requestPlay({
          type: 'song',
          id: defaultSong.songId,
          songId: defaultSong.songId,
          url: fullUrl,
          fileUrl: fullUrl,
          title: defaultSong.title,
          artist: artist.name,
          artistId: artist.id,
          artwork: fullArtwork,
          artworkUrl: fullArtwork,
          source: 'jurisdiction',
        });
      } catch (err) {
        console.error('[jurisdiction] default song fetch failed:', err?.message || err);
        showToast(`Couldn't load ${artist.name}'s song. Try again in a moment.`);
      }
    },
    [requestPlay, showToast]
  );

  const handleViewArtist = (artistId) => navigate(`/artist/${artistId}`);
  const handleViewSong = (songId) => navigate(`/song/${songId}`);

  // Keyboard support for the clickable chart rows (role="button").
  const keyActivate = (fn) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  // ── Render — loading & error ──────────────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div className="jp-loading">Loading {jurName}...</div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="jp-error">{error || `No data available for ${jurName}`}</div>
      </Layout>
    );
  }

  const artistsCharting = `${data.artistsCharting}${data.artistsChartingMore ? '+' : ''}`;
  const pointsThisWeek = data.pointsThisWeek;
  const placeKey = jurName.trim().toLowerCase().replace(/\s+/g, '-');
  const chartPlace = ['harlem', 'uptown-harlem', 'downtown-harlem'].includes(placeKey) ? placeKey : 'harlem';
  const openChart = (type) => navigate(`/charts?type=${type}&period=weekly&genre=all&place=${chartPlace}`);

  return (
    <Layout>
      <div className="jp jp-v5">
        {/* ═══════ 1 · HERO — this place, right now ═══════ */}
        <section
          className={`jp-hero ${data.songOfWeek ? '' : 'jp-hero--solo'}`}
          data-name={jurName}
        >
          {/* Backdrop stack, painted under the content:
              1. photo — desaturated and heavily softened
              2. tint  — forces the photo to take the active theme's hue
              3. scrim — protects the copy and the ghosted name
              The gradient itself lives on .jp-hero and is theme-derived, so
              this is the same treatment in every palette, not just blue. */}
          <div
            className="jp-hero-photo"
            style={{ backgroundImage: `url(${data.heroImage})` }}
            aria-hidden="true"
          />
          <div className="jp-hero-tint" aria-hidden="true" />
          <div className="jp-hero-scrim" aria-hidden="true" />

          <div className="jp-hero-content">
            <div className="jp-pills">
              <span className="jp-pill jp-pill--live">
                <LiveBars />
                Live charts
              </span>
              <span className="jp-pill">{data.isLeaf ? 'Neighborhood' : 'District'}</span>
            </div>

            <h1 className="jp-title">{jurName}</h1>

            <p className="jp-subtitle">{data.description}</p>

            <dl className="jp-stats">
              <div className="jp-stat">
                <dt>Top artist</dt>
                <dd>{data.topArtistName || 'No artist yet'}</dd>
              </div>

              <div className="jp-stat">
                <dt>Top track</dt>
                <dd>{data.songOfWeek?.title || 'No track yet'}</dd>
              </div>

              <div className="jp-stat">
                <dt>Artists charting</dt>
                <dd>{artistsCharting}</dd>
              </div>

              <div className="jp-stat">
                <dt>{data.finished ? 'Points last week' : 'Points this week'}</dt>
                <dd>{pointsThisWeek.toLocaleString()}</dd>
              </div>
            </dl>

            <div className="jp-hero-actions">
              <button
                type="button"
                className="jp-primary-action"
                onClick={() => navigate('/voteawards')}
              >
                Vote now
              </button>

              <button
                type="button"
                className="jp-secondary-action"
                onClick={() => navigate('/findpage')}
              >
                Explore tracks
              </button>
            </div>
          </div>

          {data.songOfWeek && (
            <article
              className="jp-featured"
              role="button"
              tabIndex={0}
              aria-label={`Song of the week: ${data.songOfWeek.title}`}
              onClick={() => handleViewSong(data.songOfWeek.id)}
              onKeyDown={keyActivate(() => handleViewSong(data.songOfWeek.id))}
            >
              <img
                src={data.songOfWeek.image}
                alt=""
                className="jp-featured-art"
              />

              <div className="jp-featured-overlay">
                <span className="jp-featured-kicker">{data.finished ? 'Last week\u2019s number one' : 'Number one this week'}</span>
                <h2>{data.songOfWeek.title}</h2>
                <p>{data.songOfWeek.artist}</p>

                <button
                  type="button"
                  className="jp-featured-listen"
                  aria-label={`Play song of the week: ${data.songOfWeek.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    playSong(data.songOfWeek);
                  }}
                >
                  <PlayIcon size={13} />
                  Listen now
                </button>
              </div>
            </article>
          )}
        </section>

        {/* ═══════ 2 · THIS WEEK'S CHART ═══════ */}
        <section className="jp-section jp-chart">
          <header className="jp-section-head">
            <span className="jp-eyebrow">{data.status?.title || 'This week\u2019s chart'}</span>
            <h2 className="jp-chart-title">
              Who {jurName} is <em>backing</em>
            </h2>
          </header>

          <div className="jp-boards">
            <div className="jp-board">
              <h3 className="jp-board-title">
                Top <em>artists</em>
              </h3>

              <div className="jp-rows">
                {data.topArtists.length > 0 ? (
                  data.topArtists.map((artist) => (
                    <div
                      key={artist.id}
                      className="jp-row"
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${artist.name}`}
                      onClick={() => handleViewArtist(artist.id)}
                      onKeyDown={keyActivate(() => handleViewArtist(artist.id))}
                    >
                      <span className="jp-row-rank">
                        {String(artist.rank).padStart(2, '0')}
                        <RankMove movement={artist.movement} isNew={artist.isNew} className="jp-row-move" />
                      </span>

                      <img src={artist.thumbnail} alt="" />

                      <div className="jp-row-main">
                        <strong>{artist.name}</strong>
                        <span>{artist.genre || 'Local artist'}</span>
                      </div>

                      <div className="jp-row-score">
                        <strong>{artist.score.toLocaleString()}</strong>
                        <span>pts</span>
                      </div>

                      <button
                        type="button"
                        className="jp-row-play"
                        aria-label={`Play ${artist.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          playArtist(artist);
                        }}
                      >
                        <PlayIcon size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="jp-empty">
                    No artists charting yet in {jurName}. The first play, like or vote starts the chart.
                  </p>
                )}
              </div>
              <button type="button" className="jp-fullchart" onClick={() => openChart('artist')}>
                See the full artist chart
              </button>
            </div>

            <div className="jp-board">
              <h3 className="jp-board-title">
                Top <em>tracks</em>
              </h3>

              <div className="jp-rows">
                {data.topSongs.length > 0 ? (
                  data.topSongs.map((song) => (
                    <div
                      key={song.id}
                      className="jp-row"
                      role="button"
                      tabIndex={0}
                      aria-label={`View ${song.title}`}
                      onClick={() => handleViewSong(song.id)}
                      onKeyDown={keyActivate(() => handleViewSong(song.id))}
                    >
                      <span className="jp-row-rank">
                        {String(song.rank).padStart(2, '0')}
                        <RankMove movement={song.movement} isNew={song.isNew} className="jp-row-move" />
                      </span>

                      <img src={song.thumbnail} alt="" />

                      <div className="jp-row-main">
                        <strong>{song.title}</strong>
                        <span>{song.artist}</span>
                      </div>

                      <div className="jp-row-score">
                        <strong>{song.score.toLocaleString()}</strong>
                        <span>pts</span>
                      </div>

                      <button
                        type="button"
                        className="jp-row-play"
                        aria-label={`Play ${song.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          playSong(song);
                        }}
                      >
                        <PlayIcon size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="jp-empty">
                    No tracks charting yet in {jurName}. Upload one and claim the top spot.
                  </p>
                )}
              </div>
              <button type="button" className="jp-fullchart" onClick={() => openChart('song')}>
                See the full song chart
              </button>
            </div>
          </div>
        </section>

        {/* ═══════ 3 · HALL OF FAME — one timeline, one instance ═══════ */}
        <section className="jp-section jp-winners">
          <WinnersTimeline
            jurisdiction={jurName}
            jurisdictionId={data.jurisdictionId}
            variant="embedded"
            initialInterval="week"
            initialCategory="song"
            initialCount={5}
          />
        </section>

        {/* Toast — replaces the old alert() calls */}
        <div
          className={`jp-toast ${toast ? 'is-visible' : ''}`}
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      </div>
    </Layout>
  );
};

export default JurisdictionPage;