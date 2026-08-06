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
//    • userId comes from useAuth() instead of hand-rolled JWT atob
//    • alert() → inline toast (same pattern as findpage)
//    • Play tracking is effect-based off PlayerContext.currentMedia, so a
//      cancelled PlayChoiceModal never credits a play, and a QUEUED song is
//      credited when it actually starts playing (same fix as findpage/songPage)
//    • Theme contract: jurisdictionPage.scss resolves every colour from the
//      token layer (theme.scss + unis-design-tokens.scss)
//
//  Known, deliberate debt (tracked): play tracking still sends the
//  client-supplied ?userId= — backend must derive it from the JWT before this
//  can change. Same as the other 13 call sites.
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
import { useAuth } from './context/AuthContext';
import { apiCall } from './components/axiosInstance';
import './jurisdictionPage.scss';
import Layout from './layout';
import prominentArtistBg from './assets/songartworkfour.jpeg';
import albumArt from './assets/songartworktwo.jpeg';
import heroHarlem from './assets/apollopic.jpg';
import heroDefault from './assets/biglpic.jpg';
import { buildUrl } from './utils/buildUrl';
import WinnersTimeline from './winnersTimeline';

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
  const { requestPlay, currentMedia } = useContext(PlayerContext);
  const { user } = useAuth();
  const userId = user?.userId || null;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const toastTimer = useRef(null);
  // songId the user asked this page to play, awaiting confirmation that it
  // actually became the current track (see the tracking effect below).
  const pendingTrackRef = useRef(null);

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

        const topsResponse = await apiCall({
          method: 'get',
          url: `/v1/jurisdictions/${jurId}/tops`,
        });

        const rawData = { ...topsResponse.data, jurisdiction: jurDetails };

        const topArtist = rawData.topArtist || (rawData.topArtists || [])[0];
        const topSong = rawData.topSong || (rawData.topSongs || [])[0];

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

          topArtistName: topArtist?.username || null,

          songOfWeek: topSong
            ? {
                id: topSong.songId,
                title: topSong.title,
                artist: topSong.artist?.username || 'Unknown',
                artistId: topSong.artist?.userId,
                image: buildUrl(topSong.artworkUrl) || albumArt,
                fileUrl: buildUrl(topSong.fileUrl),
              }
            : null,

          topArtists: (rawData.topArtists || []).map((artist, i) => ({
            id: artist.userId,
            rank: i + 1,
            name: artist.username,
            genre: artist.genre?.name || '',
            score: artist.score || 0,
            thumbnail: buildUrl(artist.photoUrl) || prominentArtistBg,
          })),

          // Songs are ranked by the same weighted-vote scoring as artists,
          // so both boards display the score as "pts" — no fake "plays".
          topSongs: (rawData.topSongs || []).map((song, i) => ({
            id: song.songId,
            rank: i + 1,
            title: song.title,
            artist: song.artist?.username || 'Unknown',
            artistId: song.artist?.userId,
            score: song.score ?? song.plays ?? 0,
            thumbnail: buildUrl(song.artworkUrl) || prominentArtistBg,
            fileUrl: buildUrl(song.fileUrl),
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

  // ── Play tracking — effect-based off currentMedia ─────────────────────────
  // handlePlay only REQUESTS playback (requestPlay may open PlayChoiceModal).
  // A play is credited only once the requested song actually becomes the
  // current track: cancel → never credited; queue → credited when it starts.
  useEffect(() => {
    const playingId = currentMedia?.id || currentMedia?.songId;
    if (!playingId || !userId) return;
    if (pendingTrackRef.current !== playingId) return;

    pendingTrackRef.current = null;

    apiCall({
      method: 'post',
      url: `/v1/media/song/${playingId}/play?userId=${userId}`,
    }).catch((err) =>
      console.error('[jurisdiction] play tracking failed:', err?.message || err)
    );
  }, [currentMedia?.id, currentMedia?.songId, userId]);

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
      });

      pendingTrackRef.current = song.id;
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
        });

        pendingTrackRef.current = defaultSong.songId;
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

  const artistsCharting = data.topArtists.length;
  const pointsThisWeek = data.topArtists.reduce((sum, a) => sum + (a.score || 0), 0);

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
                <dt>Points this week</dt>
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
                <span className="jp-featured-kicker">Song of the week</span>
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
            <span className="jp-eyebrow">This week&rsquo;s chart</span>
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
                    No artists charting yet in {jurName}. The first vote starts the chart.
                  </p>
                )}
              </div>
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