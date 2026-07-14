import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { PlayerContext } from './context/playercontext';
import Layout from './layout';
import './artistpage.scss';
import theQuiet from './assets/theQuiet.jpg';
import VotingWizard from './votingWizard';
import { useAuth } from './context/AuthContext';
import { incrementGateSongCount } from './AuthGateSheet';
import { buildUrl } from './utils/buildUrl';
import MessageButton from './MessageButton';
import SupportButton from './SupportButton'

// ─── Award rail definitions ────────────────────────────────────
// 12 fixed slots (Song + Artist across 6 intervals). A medal only
// renders when the artist has won that award at least once. Backend
// is expected to return either an array of { key, count } / { entity,
// interval, count } objects, or a plain { "artist-month": 3 } map.
const AWARD_DEFS = [
  { key: 'song-day',      entity: 'song',   label: 'Song of the Day',      short: 'DAY' },
  { key: 'artist-day',    entity: 'artist', label: 'Artist of the Day',    short: 'DAY' },
  { key: 'song-week',     entity: 'song',   label: 'Song of the Week',     short: 'WK'  },
  { key: 'artist-week',   entity: 'artist', label: 'Artist of the Week',   short: 'WK'  },
  { key: 'song-month',    entity: 'song',   label: 'Song of the Month',    short: 'MO'  },
  { key: 'artist-month',  entity: 'artist', label: 'Artist of the Month',  short: 'MO'  },
  { key: 'song-quarter',  entity: 'song',   label: 'Song of the Quarter',  short: 'QTR' },
  { key: 'artist-quarter',entity: 'artist', label: 'Artist of the Quarter',short: 'QTR' },
  { key: 'song-year',     entity: 'song',   label: 'Song of the Year',     short: 'YR'  },
  { key: 'artist-year',   entity: 'artist', label: 'Artist of the Year',   short: 'YR'  },
  { key: 'song-alltime',  entity: 'song',   label: 'Song of All Time',     short: 'ALL' },
  { key: 'artist-alltime',entity: 'artist', label: 'Artist of All Time',   short: 'ALL' },
];

const normalizeAwards = (data) => {
  const map = {};
  if (!data) return map;
  if (Array.isArray(data)) {
    data.forEach((a) => {
      const key =
        a.key ||
        `${(a.entity || a.category || '').toLowerCase()}-${(a.interval || a.period || '').toLowerCase()}`;
      const count = a.count ?? a.wins ?? a.times ?? 0;
      if (key) map[key] = (map[key] || 0) + Number(count || 0);
    });
  } else if (typeof data === 'object') {
    Object.entries(data).forEach(([k, v]) => { map[k.toLowerCase()] = Number(v || 0); });
  }
  return map;
};

// Inline glyphs (project convention: inline SVG, never lucide inside buttons)
const AwardGlyph = ({ entity }) =>
  entity === 'artist' ? (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
      <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l11-2v11" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );

// Average-color sampler for the "Popular" ambient row backgrounds.
// Draws the artwork into a 1x1 canvas and reads the resulting pixel.
// Requires CORS-enabled artwork (R2 already configured for this).
const extractAverageColor = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        resolve({ r: d[0], g: d[1], b: d[2] });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = url;
  });

const ArtistPage = ({ isOwnProfile = false }) => {
  const { artistId } = useParams();
  const { requestPlay } = useContext(PlayerContext);
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();

  const userId = user?.userId;

  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [bio, setBio] = useState('');
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [defaultSong, setDefaultSong] = useState(null);
  const [awards, setAwards] = useState({});       // normalized award counts
  const [standing, setStanding] = useState(null);  // jurisdiction ranking
  const [songColors, setSongColors] = useState({}); // songId -> ambient rgb

  // Sticky header scroll detection
  const heroRef = useRef(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  const handleScroll = useCallback(() => {
    if (!heroRef.current) return;
    const heroBottom = heroRef.current.getBoundingClientRect().bottom;
    setShowStickyHeader(heroBottom < 60);
  }, []);

  useEffect(() => {
    const scrollTarget = heroRef.current?.closest('.layout-content') || window;
    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!artistId) return;

    const fetchAll = async () => {
      setLoading(true);
      setError('');

      try {
        const isViewingOther = userId && userId !== artistId;

        const [
          artistRes,
          followerCountRes,
          songsRes,
          defaultSongRes,
          followStatusRes,
          awardsRes,
          standingRes,
        ] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/users/profile/${artistId}` }),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/followers/count` }).catch(() => ({ data: { count: 0 } })),
          apiCall({ method: 'get', url: `/v1/media/songs/artist/${artistId}` }).catch(() => ({ data: [] })),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/default-song` }).catch(() => ({ data: null })),
          isViewingOther
            ? apiCall({ method: 'get', url: `/v1/users/${artistId}/is-following` }).catch(() => ({ data: { isFollowing: false } }))
            : Promise.resolve({ data: { isFollowing: false } }),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/awards` }).catch(() => ({ data: [] })),
          apiCall({ method: 'get', url: `/v1/users/${artistId}/standing` }).catch(() => ({ data: null })),
        ]);

        const artistData = artistRes.data;
        setArtist(artistData);
        setBio(artistData.bio || 'No bio available');
        setFollowerCount(followerCountRes.data.count || 0);
        setSongs(songsRes.data || []);
        setDefaultSong(defaultSongRes.data || null);
        setIsFollowing(followStatusRes.data.isFollowing || false);
        setAwards(normalizeAwards(awardsRes.data));
        setStanding(standingRes.data || null);

      } catch (err) {
        console.error('Failed to load artist:', err);
        setError('Failed to load artist details');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [artistId, userId]);

  // Sample ambient colors for the top songs shown in "Popular".
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const top = songs.slice(0, 5);
      const entries = await Promise.all(
        top.map(async (song) => {
          const url = buildUrl(song.artworkUrl);
          if (!url) return null;
          try {
            const rgb = await extractAverageColor(url);
            return [song.songId, rgb];
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const map = {};
      entries.forEach((e) => {
        if (e) {
          const { r, g, b } = e[1];
          map[e[0]] = `linear-gradient(90deg, rgba(${r}, ${g}, ${b}, 0.34) 0%, rgba(${r}, ${g}, ${b}, 0.10) 55%, transparent 100%)`;
        }
      });
      setSongColors(map);
    };
    if (songs.length) run();
    return () => { cancelled = true; };
  }, [songs]);

  const handleFollow = async () => {
    const previousState = isFollowing;
    const previousCount = followerCount;
    setIsFollowing(!previousState);
    setFollowerCount(prev => (!previousState ? prev + 1 : prev - 1));
    try {
      if (!previousState) {
        await apiCall({ method: 'post', url: `/v1/users/${artistId}/follow` });
      } else {
        await apiCall({ method: 'delete', url: `/v1/users/${artistId}/follow` });
      }
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      setIsFollowing(previousState);
      setFollowerCount(previousCount);
      alert('Something went wrong. Please try again.');
    }
  };

  // Design-only stubs — wired to real flows in a later pass.
  const handleSupport = () => {
    // TODO: open support / tip flow
  };
  const handleShop = () => {
    // TODO: open artist storefront / buy-music flow
  };

  const handleBioChange = (e) => setBio(e.target.value);

  const handleSaveBio = async () => {
    try {
      await apiCall({ method: 'put', url: `/v1/users/profile/${artistId}/bio`, data: { bio } });
      alert('Bio updated successfully');
    } catch (err) { alert('Failed to update bio'); }
  };

  const handleVoteSuccess = () => setShowVotingWizard(false);

  const handleVote = () => {
    setSelectedNominee({
      id: artistId,
      name: artist.username,
      type: 'artist',
      jurisdiction: artist.jurisdiction,
    });
    setShowVotingWizard(true);
  };

  const handlePlayDefault = async () => {
    if (defaultSong?.fileUrl) {
      const fullUrl = buildUrl(defaultSong.fileUrl);
      if (isGuest) incrementGateSongCount();
      requestPlay({
        type: 'song',
        id: defaultSong.songId,
        songId: defaultSong.songId,
        url: fullUrl,
        fileUrl: fullUrl,
        title: defaultSong.title,
        artist: artist.username,
        artistId: artist.userId,
        artwork: buildUrl(defaultSong.artworkUrl) || buildUrl(artist.photoUrl),
        artworkUrl: buildUrl(defaultSong.artworkUrl) || buildUrl(artist.photoUrl),
      });
      if (defaultSong.songId && userId) {
        try {
          await apiCall({ method: 'post', url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}` });
        } catch (err) { console.error('Failed to track default song play:', err); }
      }
    } else {
      alert('No default song available for this artist');
    }
  };

  const handleSongClick = (songId) => navigate(`/song/${songId}`);

  const playSong = (song) => {
    if (!song) return;
    if (isGuest) incrementGateSongCount();
    requestPlay({
      type: 'song',
      id: song.songId,
      songId: song.songId,
      url: buildUrl(song.fileUrl),
      fileUrl: buildUrl(song.fileUrl),
      title: song.title,
      artist: artist.username,
      artistId: artist.userId,
      artwork: buildUrl(song.artworkUrl) || (artist.photoUrl ? buildUrl(artist.photoUrl) : theQuiet),
      artworkUrl: buildUrl(song.artworkUrl) || (artist.photoUrl ? buildUrl(artist.photoUrl) : theQuiet),
    });
  };

  if (loading) return (
    <Layout backgroundImage={theQuiet}>
      <div className="ap2-loading">Loading...</div>
    </Layout>
  );

  if (error || !artist) return (
    <Layout backgroundImage={theQuiet}>
      <div className="ap2-error">Artist not found</div>
    </Layout>
  );

  const artistPhoto = artist.photoUrl ? buildUrl(artist.photoUrl) : theQuiet;
  const topSong = songs.length > 0
    ? songs.reduce((prev, current) => (current.score || 0) > (prev.score || 0) ? current : prev, songs[0])
    : null;
  const topSongArtwork = topSong ? (buildUrl(topSong.artworkUrl) || artistPhoto) : artistPhoto;

  const isCurrentUser = userId === artistId;
  const showActionButtons = !isOwnProfile && !isCurrentUser;

  const fmt = (n) => (n || 0).toLocaleString();

  const earnedAwards = AWARD_DEFS
    .map((def) => ({ ...def, count: awards[def.key] || 0 }))
    .filter((a) => a.count > 0);

  const videoUrl = artist.featuredVideoUrl || artist.videoUrl || null;

  const standingPlace = standing?.genreName || artist.genre?.name || '';
  const standingArea = standing?.jurisdictionName || artist.jurisdiction?.name || 'your area';

  return (
    <Layout backgroundImage={artistPhoto}>
      {/* ===== STICKY HEADER ===== */}
      <div className={`ap2-sticky ${showStickyHeader ? 'ap2-sticky--visible' : ''}`}>
        <div className="ap2-sticky__inner">
          <div className="ap2-sticky__left">
            <img src={artistPhoto} alt={artist.username} className="ap2-sticky__avatar" />
            <span className="ap2-sticky__name">{artist.username}</span>
          </div>
          {showActionButtons && (
            <div className="ap2-sticky__actions">
              <button
                onClick={handleFollow}
                className={`ap2-sticky__btn ${isFollowing ? 'ap2-sticky__btn--following' : ''}`}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button onClick={handlePlayDefault} className="ap2-sticky__btn ap2-sticky__btn--play" disabled={!defaultSong}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                Play
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="ap2-page">
        {/* ===== HERO — Full-bleed artist portrait ===== */}
        <section className="ap2-hero" ref={heroRef}>
          <div className="ap2-hero__backdrop">
            <img src={artistPhoto} alt="" className="ap2-hero__img" />
            <div className="ap2-hero__scrim" />
            <div className="ap2-hero__vignette" />
          </div>

          {/* Award rail — only earned awards appear (max 12 slots) */}
          {earnedAwards.length > 0 && (
            <div className="ap2-awards" aria-label={`${artist.username} awards`}>
              {earnedAwards.map((a) => (
                <div
                  key={a.key}
                  className={`ap2-award ap2-award--${a.entity}`}
                  title={`${a.label} — won ${a.count}×`}
                >
                  <span className="ap2-award__medal"><AwardGlyph entity={a.entity} /></span>
                  <span className="ap2-award__caption">
                    <span className="ap2-award__int">{a.short}</span>
                    <span className="ap2-award__count">{a.count}×</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className={`ap2-hero__content ${earnedAwards.length > 0 ? 'ap2-hero__content--inset' : ''}`}>
            <div className="ap2-hero__tags">
              <span
                className="ap2-hero__jurisdiction"
                onClick={() => navigate(`/jurisdiction/${artist.jurisdiction?.name}`)}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 21s-7-6.4-7-11a7 7 0 0 1 14 0c0 4.6-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
                </svg>
                {artist.jurisdiction?.name || 'Unknown'}
              </span>

              {standing && (standing.rank != null) && (
                <span className="ap2-hero__rank">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M5 4h14v3a5 5 0 0 1-4 4.9V14h2v2H7v-2h2v-2.1A5 5 0 0 1 5 7V4z" /><rect x="8" y="18" width="8" height="2" rx="1" />
                  </svg>
                  #{standing.rank}{standingPlace ? ` ${standingPlace}` : ''}
                  {standing.deltaSpots > 0 && (
                    <span className="ap2-hero__rank-up">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
                      {standing.deltaSpots}
                    </span>
                  )}
                </span>
              )}
            </div>

            <h1 className="ap2-hero__name">{artist.username}</h1>

            <div className="ap2-hero__meta">
              <div className="ap2-hero__stat">
                <span className="ap2-hero__stat-value">{fmt(artist.totalPlays)}</span>
                <span className="ap2-hero__stat-label">Plays</span>
              </div>
              <div className="ap2-hero__stat">
                <span className="ap2-hero__stat-value">{fmt(followerCount)}</span>
                <span className="ap2-hero__stat-label">Followers</span>
              </div>
              <div className="ap2-hero__stat">
                <span className="ap2-hero__stat-value">{fmt(artist.score)}</span>
                <span className="ap2-hero__stat-label">Score</span>
              </div>
            </div>

            {showActionButtons && (
              <>
                <div className="ap2-hero__actions">
                  <button onClick={handlePlayDefault} className="ap2-hero__btn-play" disabled={!defaultSong}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                    Play Discography
                  </button>
                  <MessageButton recipientId={artistId} />
                  <SupportButton artistId={artistId} artistName={artist.username} />
                  <button onClick={handleFollow} className={`ap2-hero__btn-follow ${isFollowing ? 'ap2-hero__btn-follow--active' : ''}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button onClick={handleVote} className="ap2-hero__btn-vote">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.8.6-5.1 4.6 1.5 6.7L12 17.3 5.9 20.8l1.5-6.7L2.3 9.5l6.8-.6L12 2z" /></svg>
                    Vote
                  </button>
                </div>
                <p className="ap2-hero__votehint">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" /></svg>
                  Your vote moves them up the {standingArea} rankings
                </p>
              </>
            )}
          </div>
        </section>

        {/* ===== CARD BODY — Ambient background from artwork ===== */}
        <div className="ap2-body">
          <div className="ap2-body__ambient">
            <img src={topSongArtwork} alt="" className="ap2-body__ambient-img" />
            <div className="ap2-body__ambient-overlay" />
          </div>

          <div className="ap2-body__content">
            {/* Standing strip — democratic ranking (renders when backend supplies it) */}
            {standing && (standing.rank != null) && (
              <div className="ap2-card ap2-standing">
                <div className="ap2-standing__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" />
                  </svg>
                </div>
                <div className="ap2-standing__text">
                  <span className="ap2-standing__label">This week in {standingArea}</span>
                  <span className="ap2-standing__value">
                    #{standing.rank}{standing.total ? ` of ${standing.total}` : ''}{standingPlace ? ` in ${standingPlace}` : ''}
                    {standing.deltaSpots > 0 && ` · up ${standing.deltaSpots} spot${standing.deltaSpots > 1 ? 's' : ''}`}
                  </span>
                </div>
                {showActionButtons && (
                  <button className="ap2-standing__btn" onClick={handleVote}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.8.6-5.1 4.6 1.5 6.7L12 17.3 5.9 20.8l1.5-6.7L2.3 9.5l6.8-.6L12 2z" /></svg>
                    Boost
                  </button>
                )}
              </div>
            )}

            {/* Featured video — only when the artist has uploaded one */}
            {videoUrl && (
              <div className="ap2-card ap2-video">
                <span className="ap2-video__label">Featured Video</span>
                <div className="ap2-video__frame">
                  <video
                    className="ap2-video__el"
                    src={buildUrl(videoUrl)}
                    poster={artistPhoto}
                    controls
                    playsInline
                    preload="metadata"
                  />
                </div>
              </div>
            )}

            {/* Row 1: Featured Song + Support */}
            <div className="ap2-grid ap2-grid--featured">
              {topSong && (
                <div className="ap2-card ap2-featured">
                  <div className="ap2-featured__layout">
                    <div className="ap2-featured__artwork-wrap" onClick={() => handleSongClick(topSong.songId)}>
                      <img src={topSongArtwork} alt={topSong.title} className="ap2-featured__artwork" />
                      <button
                        className="ap2-featured__play-overlay"
                        onClick={(e) => {
                          e.stopPropagation();
                          playSong(songs.find(s => s.songId === topSong.songId));
                        }}
                        aria-label="Play fans pick"
                      >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                      </button>
                    </div>
                    <div className="ap2-featured__info">
                      <span className="ap2-featured__badge">Fans Pick</span>
                      <h3 className="ap2-featured__title" onClick={() => handleSongClick(topSong.songId)}>
                        {topSong.title}
                      </h3>
                      <p className="ap2-featured__desc">
                        {fmt(topSong.plays)} plays · {fmt(topSong.score)} score
                      </p>
                      <div className="ap2-featured__genre">{artist.genre?.name || 'Unknown Genre'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Support card — image avatar + Support / Follow / Shop (design only) */}
              <div className="ap2-card ap2-support">
                <div className="ap2-support__head">
                  <img src={artistPhoto} alt={artist.username} className="ap2-support__avatar" />
                  <div className="ap2-support__copy">
                    <h3 className="ap2-support__title">Support {artist.username}</h3>
                    <p className="ap2-support__sub">Back the artist directly</p>
                  </div>
                </div>
                <div className="ap2-support__actions">
                  <button className="ap2-support__btn ap2-support__btn--support" onClick={handleSupport}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7-4.5-9.3-8.4C1 9.6 2.4 6 5.8 6c2 0 3.3 1.2 4.2 2.5C10.9 7.2 12.2 6 14.2 6c3.4 0 4.8 3.6 3.1 6.6C19 16.5 12 21 12 21z" /></svg>
                    Support
                  </button>
                  <button
                    className={`ap2-support__btn ap2-support__btn--follow ${isFollowing ? 'ap2-support__btn--following' : ''}`}
                    onClick={handleFollow}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button className="ap2-support__btn ap2-support__btn--shop" onClick={handleShop}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 2L3 6v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    Shop
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Popular (theme-tinted, ambient rows) + Connect / About aside */}
            <div className="ap2-grid ap2-grid--lower">
              <div className="ap2-card ap2-popular">
                <div className="ap2-popular__header">
                  <h3>Popular</h3>
                  {songs.length > 5 && <span className="ap2-popular__seeall">See all</span>}
                </div>
                <div className="ap2-popular__list">
                  {songs.slice(0, 5).map((song, idx) => (
                    <div
                      key={song.songId}
                      className="ap2-track"
                      style={songColors[song.songId] ? { backgroundImage: songColors[song.songId] } : undefined}
                    >
                      <span className="ap2-track__num">{idx + 1}</span>
                      <img src={buildUrl(song.artworkUrl) || artistPhoto} alt={song.title} className="ap2-track__art" />
                      <div className="ap2-track__info">
                        <span className="ap2-track__title" onClick={() => handleSongClick(song.songId)}>
                          {song.title}
                        </span>
                        <span className="ap2-track__plays">{fmt(song.plays)} plays</span>
                      </div>
                      <button
                        className="ap2-track__play"
                        onClick={(e) => { e.stopPropagation(); playSong(song); }}
                        aria-label={`Play ${song.title}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
                      </button>
                    </div>
                  ))}
                  {songs.length === 0 && <p className="ap2-empty">No songs yet</p>}
                </div>
              </div>

              <div className="ap2-aside">
                <div className="ap2-card ap2-connect">
                  <h3 className="ap2-connect__title">Connect</h3>
                  <div className="ap2-connect__links">
                    {artist.instagramUrl && (
                      <a href={artist.instagramUrl} target="_blank" rel="noreferrer" className="ap2-connect__link">
                        <span className="ap2-connect__icon">📷</span>
                        <span className="ap2-connect__label">Instagram</span>
                        <svg className="ap2-connect__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                      </a>
                    )}
                    {artist.twitterUrl && (
                      <a href={artist.twitterUrl} target="_blank" rel="noreferrer" className="ap2-connect__link">
                        <span className="ap2-connect__icon">𝕏</span>
                        <span className="ap2-connect__label">Twitter</span>
                        <svg className="ap2-connect__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                      </a>
                    )}
                    {artist.tiktokUrl && (
                      <a href={artist.tiktokUrl} target="_blank" rel="noreferrer" className="ap2-connect__link">
                        <span className="ap2-connect__icon">🎵</span>
                        <span className="ap2-connect__label">TikTok</span>
                        <svg className="ap2-connect__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                      </a>
                    )}
                    {!artist.instagramUrl && !artist.twitterUrl && !artist.tiktokUrl && (
                      <p className="ap2-empty">No social links yet</p>
                    )}
                  </div>
                </div>

                <div className="ap2-card ap2-about">
                  <h3 className="ap2-about__heading">About</h3>
                  <div className="ap2-about__photo-wrap">
                    <img src={artistPhoto} alt="" className="ap2-about__photo" />
                    <div className="ap2-about__photo-fade" />
                    {!isOwnProfile && (
                      <p className="ap2-about__bio-overlay">{bio}</p>
                    )}
                  </div>
                  {isOwnProfile && (
                    <div className="ap2-about__edit">
                      <textarea value={bio} onChange={handleBioChange} className="ap2-about__textarea" placeholder="Tell fans about yourself..." />
                      <button onClick={handleSaveBio} className="ap2-about__save">Save Bio</button>
                    </div>
                  )}
                  <div className="ap2-about__badges">
                    <div className="ap2-about__badge">
                      <span className="ap2-about__badge-value">{fmt(artist.score)}</span>
                      <span className="ap2-about__badge-label">Score</span>
                    </div>
                    <div className="ap2-about__badge">
                      <span className="ap2-about__badge-value">{fmt(followerCount)}</span>
                      <span className="ap2-about__badge-label">Followers</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <VotingWizard
        show={showVotingWizard}
        onClose={() => setShowVotingWizard(false)}
        onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee}
        userId={userId}
        filters={{
          selectedGenre: artist.genre?.name?.toLowerCase().replace('/', '-') || 'unknown',
          selectedType: 'artist',
          selectedInterval: 'daily',
          selectedJurisdiction: artist.jurisdiction?.name?.toLowerCase().replace(' ', '-') || 'unknown',
        }}
      />
    </Layout>
  );
};

export default ArtistPage;