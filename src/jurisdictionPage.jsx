// ═══════════════════════════════════════════════════════════════════════════
//  UNIS — Jurisdiction Page (v6, Nov 2026)
//
//  Designed with Scout → Sketch → Ship (canvas: "Unis — Jurisdiction page
//  redesign"). The identity page for one place:
//    1. Hero        — this week's #1 artist is the cover of the place (the
//                     place photo only when nobody is charting), the name in
//                     the serif italic, a breadcrumb up, one stats line
//    2. Right now   — Play the top 10 / Vote / Charts / Share, then The race
//                     (#1 vs #2 and the gap) and the Number one song
//    3. Neighborhoods inside this place, or the places next door
//    4. Chart       — this week's rankings (top artists + top tracks)
//    5. Hall of fame (WinnersTimeline, embedded, ONE instance)
//  Plus the bar that follows you (shared FollowBar frame, place content).
//
//  Rules the design follows (from the research):
//    • A real person, not a stock photo: users ignore decorative images and
//      look at real people (NN/g eyetracking).
//    • Show the race, not just the leader: the gap to #1 is what people
//      chase (Strava Local Legends).
//    • The chart plays like a playlist (Apple Music / Spotify city charts).
//    • Lead with what is local: breadcrumb up, neighborhoods across.
//    • Be honest when it's quiet: empty and one-sided states say so.
//
//  Rankings: the boards, hero and race all come from /v1/awards/standings
//  (utils/standings.js) — this week, all genres, ranked by the same formula
//  that decides awards. Before anyone scores in a new week they show last
//  week's final, and the words say so.
//
//  Place context (breadcrumb, neighborhoods, District/Neighborhood) comes
//  from /v1/jurisdictions/{id}/breadcrumb and /children/detailed. It loads
//  after the page and never blocks it: if it fails, those pieces hide.
//  (v5 read a `hasChildren` field the byName lookup never sends, so every
//  place said "District".)
//
//  Play tracking is deliberately absent: the Player counts plays after real
//  listening. Every play goes through requestPlay / requestPlayCollection.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import { useFeedback } from './context/FeedbackContext';
import { useAuth } from './context/AuthContext';
import './jurisdictionPage.scss';
import Layout from './layout';
import UnisLoader from './components/UnisLoader';
import AdSlot from './components/AdSlot';
import FollowBar from './components/FollowBar';
import { useFollowBar } from './hooks/useFollowBar';
import prominentArtistBg from './assets/songartworkfour.jpeg';
import albumArt from './assets/songartworktwo.jpeg';
import heroHarlem from './assets/apollopic.jpg';
import heroDefault from './assets/biglpic.jpg';
import { buildUrl } from './utils/buildUrl';
import WinnersTimeline from './winnersTimeline';
import RankMove from './components/RankMove';
import { fetchStandings, describeBoard } from './utils/standings';


// ── Place photo (the fallback cover) ─────────────────────────────────────────
// Used only when nobody is charting yet, or the #1 has no photo. The
// jurisdiction's own symbolUrl wins; otherwise a stock photo by name.
const HERO_IMAGES = {
  'harlem': heroHarlem,
  'uptown harlem': heroHarlem,
  'downtown harlem': heroHarlem,
};

const heroImageFor = (name) =>
  HERO_IMAGES[String(name || '').trim().toLowerCase()] || heroDefault;

// "Sun 11:59 PM" in the viewer's own time.
const shortClose = (iso) => {
  if (!iso) return '';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(when);
};

const fmt = (n) => (Number(n) || 0).toLocaleString('en-US');
const plural = (n, one, many) => (n === 1 ? one : many);

const MAX_PLACES = 8;

// ── Icons (inline, same guaranteed-visibility approach as Player/Feed) ───────
const PlayIcon = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
);

const PauseIcon = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
  </svg>
);

// Row play icon — white, as on the v5 boards.
const RowPlayIcon = ({ size = 12 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
    style={{ width: size, height: size, display: 'block', fill: '#FFFFFF', flexShrink: 0 }}
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

const VoteIcon = ({ size = 17 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <path d="M8 11V4h8v7M10 7.5l1.5 1.5L14 6.5" />
  </svg>
);

const ShareIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

const ChevronRight = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

const ChevronLeft = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

const CrownIcon = ({ size = 12 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
  </svg>
);

const HomeIcon = ({ size = 13 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
);

const PinIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
  </svg>
);

const NoteIcon = ({ size = 26 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

// Three-bar equalizer — the "live" signal. Frozen under reduced motion.
const LiveBars = () => (
  <span className="jp-eq" aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

// /children/detailed rows → the shape the neighborhood strip renders.
const toPlace = (row) => ({
  id: row.jurisdictionId,
  name: row.name,
  open: row.isActive !== false,
  isDistrict: !!row.hasChildren,
});

const JurisdictionPage = ({ jurisdiction = 'Harlem' }) => {
  const { jurisdiction: jurNameFromParams } = useParams();
  const jurName = jurNameFromParams || jurisdiction;
  const navigate = useNavigate();
  const { requestPlay, requestPlayCollection, currentMedia, isPlaying, togglePlayPause } = useContext(PlayerContext);
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [place, setPlace] = useState(null);
  const [chartStarted, setChartStarted] = useState(false);
  const feedback = useFeedback();

  const showToast = useCallback((message) => feedback.info(message), [feedback]);

  // ★ The bar that follows you (shared frame: components/FollowBar.jsx).
  const bar = useFollowBar({ ready: !loading && !!data });

  // ── Fetch jurisdiction + weekly boards ────────────────────────────────────
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
        setChartStarted(false);

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

        const placePhoto = buildUrl(jurDetails.symbolUrl) || heroImageFor(jurName);

        const normalized = {
          // The place's own one-liner. No stock fallback line any more.
          bio: (jurDetails.bio || '').trim(),

          jurisdictionId: jurId,

          // This week's #1 is the cover; the place photo only when nobody is
          // charting or the #1 has no photo.
          heroImage: topArtist?.artwork || placePhoto,
          heroIsArtist: !!topArtist?.artwork,

          state: artistBoard.state || 'LIVE',
          status: describeBoard(artistBoard),
          finished: artistBoard.state !== 'LIVE',
          closesAt: artistBoard.closesAt,

          race: scoredArtists.slice(0, 3).map((a) => ({
            id: a.id,
            name: a.name,
            points: a.points,
            photo: a.artwork || prominentArtistBg,
          })),

          songOfWeek: topSong
            ? {
                id: topSong.id,
                title: topSong.name,
                artist: topSong.artistName || 'Unknown',
                artistId: topSong.artistId,
                image: topSong.artwork || albumArt,
                fileUrl: topSong.fileUrl,
                points: topSong.points,
                movement: topSong.movement,
                isNew: topSong.isNew,
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

  // ── Place context: breadcrumb up, neighborhoods across ────────────────────
  // Loads after the page and never blocks it. Any failure hides the piece.
  const jurId = data?.jurisdictionId || null;
  useEffect(() => {
    setPlace(null);
    if (!jurId) return undefined;
    let active = true;

    (async () => {
      const [chainRes, kidsRes] = await Promise.allSettled([
        apiCall({ method: 'get', url: `/v1/jurisdictions/${jurId}/breadcrumb` }),
        apiCall({ method: 'get', url: `/v1/jurisdictions/${jurId}/children/detailed` }),
      ]);
      if (!active) return;

      // Root (Unis) → … → this place. Drop the root and this place itself.
      let chain = chainRes.status === 'fulfilled' && Array.isArray(chainRes.value?.data)
        ? chainRes.value.data
        : [];
      if (chain.length > 1 && chain[0]?.jurisdictionId === jurId) chain = [...chain].reverse();
      const ancestors = chain
        .filter((c) => c?.jurisdictionId && c.jurisdictionId !== jurId)
        .filter((c, i) => !(i === 0 && !c.parentJurisdictionId))
        .map((c) => ({ id: c.jurisdictionId, name: c.name }));

      const kidsOk = kidsRes.status === 'fulfilled' && Array.isArray(kidsRes.value?.data);
      const children = kidsOk ? kidsRes.value.data.map(toPlace) : [];
      const parent = ancestors[ancestors.length - 1] || null;

      // A neighborhood (no children) shows its parent and the places next door.
      let siblings = [];
      if (kidsOk && children.length === 0 && parent) {
        try {
          const res = await apiCall({ method: 'get', url: `/v1/jurisdictions/${parent.id}/children/detailed` });
          siblings = (Array.isArray(res.data) ? res.data : []).map(toPlace).filter((p) => p.id !== jurId);
        } catch (err) {
          console.error('[jurisdiction] next-door lookup failed (strip shows the parent only):', err?.message || err);
        }
      }
      if (!active) return;

      setPlace({
        ancestors,
        parent,
        children,
        siblings,
        // Unknown when the children lookup failed: then no tier chip at all.
        tier: kidsOk ? (children.length > 0 ? 'district' : 'neighborhood') : null,
      });
    })();

    return () => {
      active = false;
    };
  }, [jurId]);

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

  // This week's top tracks as one collection — the chart plays like a playlist.
  const chartTracks = useMemo(
    () => (data?.topSongs || [])
      .filter((s) => s.fileUrl)
      .map((s) => ({
        type: 'song',
        id: s.id,
        songId: s.id,
        url: s.fileUrl,
        fileUrl: s.fileUrl,
        title: s.title,
        artist: s.artist,
        artistId: s.artistId,
        artwork: s.thumbnail,
        artworkUrl: s.thumbnail,
        source: 'jurisdiction',
      })),
    [data]
  );

  const currentId = currentMedia?.songId || currentMedia?.id || null;
  const onChart = chartStarted && !!currentId && chartTracks.some((t) => t.id === currentId);
  const playingChart = onChart && isPlaying;

  const playChart = () => {
    if (onChart) {
      togglePlayPause?.();
      return;
    }
    if (!chartTracks.length) {
      showToast(`Nothing to play in ${jurName} yet.`);
      return;
    }
    setChartStarted(true);
    requestPlayCollection({ tracks: chartTracks, title: `${jurName} · top ${chartTracks.length}` });
  };

  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      feedback.success('Link copied', { id: 'copy-link' });
    } catch (err) {
      console.error('[jurisdiction] copy link failed:', err?.message || err);
      feedback.info(`Copy this link: ${window.location.href}`);
    }
  };

  const handleViewArtist = (artistId) => navigate(`/artist/${artistId}`);
  const handleViewSong = (songId) => navigate(`/song/${songId}`);
  const openPlace = (name) => navigate(`/jurisdiction/${encodeURIComponent(name)}`);

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
        <UnisLoader label={`Loading ${jurName}...`} />
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

  const placeKey = jurName.trim().toLowerCase().replace(/\s+/g, '-');
  const chartPlace = ['harlem', 'uptown-harlem', 'downtown-harlem'].includes(placeKey) ? placeKey : 'harlem';
  const openChart = (type) => navigate(`/charts?type=${type}&period=weekly&genre=all&place=${chartPlace}`);

  // ── Words for the state of the week ───────────────────────────────────────
  const { state, finished, race, songOfWeek } = data;
  const [first, second, third] = race;
  const closes = shortClose(data.closesAt);
  const charting = `${data.artistsCharting}${data.artistsChartingMore ? '+' : ''}`;
  const isHome = !!user?.jurisdiction?.jurisdictionId && user.jurisdiction.jurisdictionId === data.jurisdictionId;

  const crownKicker = state === 'PREVIOUS_FINAL'
    ? 'Last week’s #1'
    : state === 'PREVIOUS_CLOSING' ? '#1 right now' : `#1 in ${jurName} this week`;

  const gap = first && second ? first.points - second.points : 0;
  const tied = !!(first && second) && gap === 0;
  const neckAndNeck = !!(first && second) && !tied && !finished && gap <= Math.max(1, first.points * 0.05);

  // The bar's line keeps the race in view while you scroll.
  const barLine = playingChart
    ? `Playing ${jurName}’s top ${chartTracks.length}`
    : !first
      ? 'Nobody on the board yet'
      : state === 'PREVIOUS_FINAL'
        ? `Last week · ${first.name} won`
        : !second
          ? `${first.name} leads · only one on the board`
          : tied
            ? `${first.name} and ${second.name} are tied`
            : `${first.name} leads by ${fmt(gap)}${state === 'LIVE' ? ' · live' : ''}`;

  const playLabel = playingChart
    ? `Pause ${jurName}’s top ${chartTracks.length}`
    : `Play ${jurName}’s top ${chartTracks.length || 10}${finished ? ' from last week' : ' this week'}`;

  const heroAlt = data.heroIsArtist && first
    ? `${first.name}, ${finished ? 'last week’s' : 'this week’s'} number one in ${jurName}`
    : '';

  // ── Neighborhood strip ────────────────────────────────────────────────────
  let hoods = null;
  if (place?.children?.length) {
    const sorted = [...place.children].sort((a, b) => Number(b.open) - Number(a.open));
    hoods = {
      label: `Inside ${jurName}`,
      items: sorted.slice(0, MAX_PLACES),
      more: Math.max(0, sorted.length - MAX_PLACES),
    };
  } else if (place?.parent) {
    const items = [
      { id: place.parent.id, name: place.parent.name, open: true, isDistrict: true },
      ...[...place.siblings].sort((a, b) => Number(b.open) - Number(a.open)),
    ];
    hoods = {
      label: place.siblings.length ? `Part of ${place.parent.name} · next door` : `Part of ${place.parent.name}`,
      items: items.slice(0, MAX_PLACES),
      more: Math.max(0, items.length - MAX_PLACES),
    };
  }

  const tierChip = place?.tier === 'district'
    ? `District · ${place.children.length} ${place.children.every((c) => !c.isDistrict)
      ? plural(place.children.length, 'neighborhood', 'neighborhoods')
      : plural(place.children.length, 'area', 'areas')}`
    : place?.tier === 'neighborhood' ? 'Neighborhood' : null;

  // Breadcrumb: the last three levels above this place; phones show the parent.
  const ancestors = place?.ancestors || [];
  const crumbs = ancestors.slice(-3);
  const crumbsCut = ancestors.length > crumbs.length;

  const crownButton = (variant) => first && (
    <button
      type="button"
      className={`jp-crown jp-crown--${variant}`}
      onClick={() => handleViewArtist(first.id)}
      aria-label={`${crownKicker}: ${first.name}`}
    >
      <img src={first.photo} alt="" />
      <span className="jp-crown__txt">
        <span className="jp-crown__k"><CrownIcon size={12} />{crownKicker}</span>
        <span className="jp-crown__n">{first.name}</span>
      </span>
      <ChevronRight size={16} />
    </button>
  );

  return (
    <Layout>
      {/* ── THE BAR THAT FOLLOWS YOU ──
          The hero's own picture, blurred and tinted with the theme. Songs are
          square, people are round, places are a pin. The line keeps the race
          in view; Play docks once the page's own Play has scrolled away. */}
      <FollowBar bar={bar} backdrop={data.heroImage} label={jurName} className="jp-bar">
        <button type="button" className="fb-who" onClick={bar.scrollToTop} aria-label={`Back to the top of ${jurName}`}>
          <span className="jp-bar__pin" aria-hidden="true"><PinIcon size={18} /></span>
          <span className="fb-text">
            <span className="jp-bar__title">{jurName}</span>
            <span className="fb-line">
              {playingChart && <span className="fb-eq" aria-hidden="true"><i /><i /><i /></span>}
              <span>{barLine}</span>
            </span>
          </span>
        </button>
        <button type="button" className="fb-pill" onClick={() => navigate('/voteawards')}>
          <VoteIcon size={15} />
          Vote
        </button>
        <button type="button" className="fb-icon jp-bar__share" onClick={shareLink} aria-label={`Share ${jurName}`}>
          <ShareIcon size={17} />
        </button>
        {chartTracks.length > 0 && (
          <button
            type="button"
            className="fb-dock"
            onClick={playChart}
            aria-label={playLabel}
            tabIndex={bar.docked ? 0 : -1}
          >
            {playingChart ? <PauseIcon size={16} /> : <span style={{ marginLeft: 2 }}><PlayIcon size={17} /></span>}
          </button>
        )}
      </FollowBar>

      <div className="jp jp-v6">
        {/* ═══════ 1 · HERO — this place, right now ═══════ */}
        <div className="jp-top">
          <section
            className={`jp-hero${data.heroIsArtist ? '' : ' jp-hero--place'}${first ? '' : ' jp-hero--solo'}`}
            aria-label={jurName}
          >
            <img className="jp-hero__img" src={data.heroImage} alt={heroAlt} />
            <div className="jp-hero__scrim" aria-hidden="true" />
            <div className="jp-hero__tint" aria-hidden="true" />

            {crumbs.length > 0 && (
              <nav className="jp-crumbs" aria-label="Breadcrumb">
                <ol>
                  {crumbsCut && (
                    <li aria-hidden="true"><span className="jp-crumbs__sep">…</span></li>
                  )}
                  {crumbs.map((c, i) => (
                    <li key={c.id}>
                      {(i > 0 || crumbsCut) && <span className="jp-crumbs__sep" aria-hidden="true">›</span>}
                      <button type="button" onClick={() => openPlace(c.name)}>{c.name}</button>
                    </li>
                  ))}
                  <li aria-current="page">
                    <span className="jp-crumbs__sep" aria-hidden="true">›</span>
                    {jurName}
                  </li>
                </ol>
              </nav>
            )}

            {/* Phones: the parent and Share sit on the photo */}
            <div className="jp-hero__top">
              {place?.parent ? (
                <button
                  type="button"
                  className="jp-glass"
                  onClick={() => openPlace(place.parent.name)}
                  aria-label={`Up to ${place.parent.name}`}
                >
                  <ChevronLeft size={16} />
                  {place.parent.name}
                </button>
              ) : <span />}
              <button type="button" className="jp-glass-c" onClick={shareLink} aria-label={`Share ${jurName}`}>
                <ShareIcon size={18} />
              </button>
            </div>

            <div className="jp-hero__content">
              <div className="jp-hero__left">
                <div className="jp-chips">
                  <span className={`jp-chip${state === 'LIVE' ? ' jp-chip--live' : ' jp-chip--final'}`}>
                    {state === 'LIVE' && <LiveBars />}
                    {data.status?.title || 'Live this week'}
                  </span>
                  {tierChip && <span className="jp-chip">{tierChip}</span>}
                  {isHome && <span className="jp-chip"><HomeIcon size={13} />Your home</span>}
                </div>

                <h1 className="jp-hero__name" ref={bar.titleRef}>{jurName}</h1>

                <p className="jp-statline">
                  {!first ? (
                    'Nobody on the board yet. The first play, like or vote starts it.'
                  ) : state === 'PREVIOUS_FINAL' ? (
                    <>
                      <b>{charting}</b> {plural(data.artistsCharting, 'artist', 'artists')} charted · <b>{fmt(data.pointsThisWeek)}</b> points last week
                    </>
                  ) : state === 'PREVIOUS_CLOSING' ? (
                    <>
                      <b>{charting}</b> charting{closes && <> · final at <b>{closes}</b></>}
                    </>
                  ) : (
                    <>
                      <b>{charting}</b> <span className="jp-wide">{plural(data.artistsCharting, 'artist', 'artists')} </span>charting · <b>{fmt(data.pointsThisWeek)}</b> <span className="jp-wide">points this week</span><span className="jp-narrow">pts</span>
                      {closes && <> · final <b>{closes}</b></>}
                    </>
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* Desktop: over the hero's corner. Phones: its own row below. */}
          {crownButton('hero')}
        </div>

        <div className="jp-body">
          {crownButton('row')}

          {/* ═══════ 2 · ACTIONS ═══════ */}
          <div className="jp-actions">
            <button
              ref={bar.playRef}
              type="button"
              className="jp-play"
              onClick={playChart}
              disabled={!chartTracks.length}
              aria-label={playLabel}
            >
              {playingChart ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
            </button>
            {chartTracks.length > 0 && (
              <span className="jp-play-cap jp-wide" aria-hidden="true">
                <b>Play the top {chartTracks.length}</b>
                {finished ? 'last week' : 'this week'} in {jurName}
              </span>
            )}
            <button type="button" className="jp-pill jp-pill--vote" onClick={() => navigate('/voteawards')}>
              <VoteIcon size={17} />
              <span className="jp-pill__label">Vote in {jurName}</span>
            </button>
            <button type="button" className="jp-pill" onClick={() => openChart('song')} aria-label={`Charts for ${jurName}`}>
              <span className="jp-wide">Full charts</span>
              <span className="jp-narrow">Charts</span>
            </button>
            <span className="jp-actions__spacer" />
            <button type="button" className="jp-circ jp-wide" onClick={shareLink} aria-label={`Share ${jurName}`}>
              <ShareIcon size={18} />
            </button>
          </div>
          {chartTracks.length > 0 && (
            <p className="jp-cap jp-narrow">
              Play button: {finished ? 'last' : 'this'} week’s top {chartTracks.length} in {jurName}, in chart order.
            </p>
          )}

          {data.bio && <p className="jp-bio">{data.bio}</p>}

          {/* ═══════ 3 · RIGHT NOW — the race + number one song ═══════ */}
          <div className="jp-now">
            <section className="jp-card jp-race" aria-labelledby="jp-race-h">
              <div className="jp-sechead">
                <h2 id="jp-race-h" className="jp-h2">
                  {state === 'PREVIOUS_FINAL' ? <>Last week’s <em>race</em></> : <>The <em>race</em></>}
                </h2>
                {neckAndNeck ? (
                  <span className="jp-tight">Neck and neck</span>
                ) : (
                  <span className="jp-status">
                    <span className={`jp-dot${!first || finished ? ' jp-dot--off' : ''}`} aria-hidden="true" />
                    {!first
                      ? 'Not started'
                      : state === 'PREVIOUS_FINAL'
                        ? 'Final'
                        : closes ? `Final ${state === 'PREVIOUS_CLOSING' ? 'at ' : ''}${closes}` : 'Live'}
                  </span>
                )}
              </div>

              {!first ? (
                <div className="jp-race__empty">
                  <p>Nobody has scored in {jurName} {finished ? 'yet' : 'this week'}. The first play, like or vote starts the race.</p>
                  <button type="button" className="jp-pill" onClick={() => navigate('/findpage')}>
                    Find music from {jurName}
                  </button>
                </div>
              ) : (
                <>
                  <div className="jp-duel">
                    <button
                      type="button"
                      className="jp-duelist jp-duelist--lead"
                      onClick={() => handleViewArtist(first.id)}
                      aria-label={`Open ${first.name}, first with ${fmt(first.points)} points`}
                    >
                      <img src={first.photo} alt="" />
                      <span className="jp-duelist__txt">
                        <span className="jp-duelist__rank">01</span>
                        <span className="jp-duelist__name">{first.name}</span>
                        <span className="jp-duelist__pts">{fmt(first.points)} pts</span>
                      </span>
                    </button>
                    <span className="jp-vs" aria-hidden="true">vs</span>
                    {second ? (
                      <button
                        type="button"
                        className="jp-duelist jp-duelist--r"
                        onClick={() => handleViewArtist(second.id)}
                        aria-label={`Open ${second.name}, second with ${fmt(second.points)} points`}
                      >
                        <img src={second.photo} alt="" />
                        <span className="jp-duelist__txt">
                          <span className="jp-duelist__rank">02</span>
                          <span className="jp-duelist__name">{second.name}</span>
                          <span className="jp-duelist__pts">{fmt(second.points)} pts</span>
                        </span>
                      </button>
                    ) : (
                      <span className="jp-duelist jp-duelist--r jp-duelist--open">
                        <span className="jp-open-slot" aria-hidden="true">?</span>
                        <span className="jp-duelist__txt">
                          <span className="jp-duelist__rank">02</span>
                          <span className="jp-duelist__name jp-duelist__name--muted">Open spot</span>
                        </span>
                      </span>
                    )}
                  </div>

                  <div
                    className="jp-meter"
                    role="img"
                    aria-label={second
                      ? `${first.name} has ${Math.round((first.points / (first.points + second.points)) * 100)} percent of the top two's points`
                      : `${first.name} is the only artist with points`}
                  >
                    <span style={{ width: `${second ? (first.points / (first.points + second.points)) * 100 : 100}%` }} />
                  </div>

                  <p className="jp-race__line">
                    {!second ? (
                      <><b>{first.name}</b> is the only artist on the board in {jurName} {finished ? 'last week' : 'this week'}.</>
                    ) : tied ? (
                      <><b>{first.name}</b> and <b>{second.name}</b> are tied on {fmt(first.points)} points. Vote points, then plays, then likes break the tie.</>
                    ) : state === 'PREVIOUS_FINAL' ? (
                      <><b>{first.name}</b> won last week by <b>{fmt(gap)} {plural(gap, 'point', 'points')}</b>.</>
                    ) : (
                      <>
                        <b>{first.name}</b> leads by {neckAndNeck ? 'just ' : ''}<b>{fmt(gap)} {plural(gap, 'point', 'points')}</b>.
                        {third && second.points > third.points && (
                          <> {third.name} is third, {fmt(second.points - third.points)} behind {second.name}.</>
                        )}
                      </>
                    )}
                  </p>
                  <p className="jp-race__foot">
                    Points are weighted votes + plays + 5 × likes.{' '}
                    <button type="button" className="jp-link" onClick={() => navigate('/help#awards-winner')}>
                      How the race works
                    </button>
                  </p>
                </>
              )}
            </section>

            {songOfWeek ? (
              <article className="jp-card jp-song1">
                <div className="jp-song1__glow" style={{ backgroundImage: `url(${songOfWeek.image})` }} aria-hidden="true" />
                <img className="jp-song1__art" src={songOfWeek.image} alt="" />
                <div className="jp-song1__body">
                  <p className="jp-kicker">
                    {finished ? 'Last week’s number one song' : 'Number one song · this week'}
                  </p>
                  <h2 className="jp-song1__title">
                    <button type="button" onClick={() => handleViewSong(songOfWeek.id)}>{songOfWeek.title}</button>
                  </h2>
                  <p className="jp-song1__artist">
                    {songOfWeek.artistId ? (
                      <button type="button" onClick={() => handleViewArtist(songOfWeek.artistId)}>{songOfWeek.artist}</button>
                    ) : songOfWeek.artist}
                  </p>
                  <p className="jp-song1__meta">
                    <RankMove movement={songOfWeek.movement} isNew={songOfWeek.isNew} className="jp-song1__move" />
                    <span>{fmt(songOfWeek.points)} pts</span>
                  </p>
                  <button
                    type="button"
                    className="jp-listen"
                    onClick={() => playSong(songOfWeek)}
                    aria-label={`Listen to the number one song, ${songOfWeek.title}`}
                  >
                    <PlayIcon size={14} />
                    Listen
                  </button>
                </div>
              </article>
            ) : (
              <article className="jp-card jp-song1 jp-song1--empty">
                <span className="jp-song1__ph" aria-hidden="true"><NoteIcon size={26} /></span>
                <div className="jp-song1__body">
                  <p className="jp-kicker">Number one song</p>
                  <p className="jp-muted">No song has scored here {finished ? 'yet' : 'this week yet'}.</p>
                </div>
              </article>
            )}
          </div>

          {/* ═══════ NEIGHBORHOODS ═══════ */}
          {hoods && hoods.items.length > 0 && (
            <section className="jp-hoods" aria-labelledby="jp-hoods-h">
              <h2 id="jp-hoods-h" className="jp-hoods__label">{hoods.label}</h2>
              <div className="jp-hoods__row">
                {hoods.items.map((p) => (p.open ? (
                  <button key={p.id} type="button" className="jp-hood" onClick={() => openPlace(p.name)}>
                    <span className="jp-hood__txt">
                      {p.name}
                      <small>{p.isDistrict ? 'District' : 'Neighborhood'}</small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <span key={p.id} className="jp-hood jp-hood--closed">
                    <span className="jp-hood__txt">
                      {p.name}
                      <small>Opening soon</small>
                    </span>
                  </span>
                )))}
                {hoods.more > 0 && <span className="jp-hoods__more">+{hoods.more} more</span>}
              </div>
            </section>
          )}

          {/* ═══════ 4 · THIS WEEK'S CHART (unchanged from v5) ═══════ */}
          <section className="jp-section jp-chart">
            <header className="jp-section-head">
              <span className="jp-eyebrow">{data.status?.title || 'This week’s chart'}</span>
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
                          <RowPlayIcon size={12} />
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
                          <RowPlayIcon size={12} />
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

          {/* ═══════ AD SPACE (none for Unis Plus) ═══════ */}
          <AdSlot placement="jurisdiction" />

          {/* ═══════ 5 · HALL OF FAME — one timeline, one instance ═══════ */}
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
        </div>
      </div>
    </Layout>
  );
};

export default JurisdictionPage;
