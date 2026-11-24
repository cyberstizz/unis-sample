// src/songPage.jsx — /song/:songId
//
// v3 "poster front" (Nov 2026, Scout → Sketch → Ship; canvas "Unis playlist &
// song pages"):
//   • The artwork runs edge to edge (phones) or fades in from the right
//     (desktop) and melts into a colour taken from it; the page takes that
//     colour, darkened so it never glows (hooks/useArtworkPalette).
//   • Small actions on the left (Like, Copy link, ⋯), Play on the right in
//     your theme. Don't Play and Report live in ⋯.
//   • Vote is a full-width card on phones, like the artist page's, and a pill
//     beside Play on desktop.
//   • Reads like a Now Playing you can scroll: lyrics in a card the art's
//     colour, About the song, the artist as a photo card, details, photos,
//     videos, Recommended, comments.

import React, { useState, useContext, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import songArtwork from './assets/theQuiet.jpg';
import LyricsWizard from './lyricsWizard';
import LyricsLines from './components/LyricsLines';
import { parseLrc } from './utils/lrc';
import {
  FileText, Heart, Link2, MoreHorizontal, ArrowLeft, Ban, Flag, ChevronRight, Check, Mic, TrendingUp, Play,
} from 'lucide-react';
import { PhotoLightbox } from './artistpage';
import { VoteIcon } from './icons/UnisIcons';
import useArtworkPalette from './hooks/useArtworkPalette';
import useArtHero from './hooks/useArtHero';
import './songPage.scss';
import Layout from './layout';
import UnisLoader from './components/UnisLoader';
import AdSlot from './components/AdSlot';
import { PlayerContext } from './context/playercontext';
import VotingWizard from './votingWizard';
import CommentSection from './commentSection';
import { useAuth } from './context/AuthContext';
import { useFeedback, errorMessage } from './context/FeedbackContext';
import { useReward } from './context/RewardContext';
import { buildUrl } from './utils/buildUrl';
import RecommendedSongs from './RecommendedSongs';
import { useTaxonomy } from './utils/taxonomy';
import { fetchStandings } from './utils/standings';
import FollowBar from './components/FollowBar';
import { useFollowBar } from './hooks/useFollowBar';

const SongPage = () => {
  const { songId } = useParams();
  // ── Player sync: we now also read isPlaying + togglePlayPause so the hero
  //    button can mirror the player's true state for THIS exact song.
  const { requestPlay, currentMedia, isPlaying, togglePlayPause, audioRef } = useContext(PlayerContext);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { taxonomy } = useTaxonomy(); // language names for the details panel
  const userId = user?.userId;
  const feedback = useFeedback();
  const { showReward } = useReward();
  // Guests get a toast with a way to sign in, instead of a browser pop-up.
  const askToLogIn = (what) =>
    feedback.info(`Log in to ${what}`, { action: { label: 'Log in', onClick: () => navigate('/login') } });

  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showLyricsWizard, setShowLyricsWizard] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  // The artist's photo gallery and videos (songs have none of their own).
  const [artistPhotos, setArtistPhotos] = useState([]);
  const [artistVideos, setArtistVideos] = useState([]);
  const [photoIndex, setPhotoIndex] = useState(null);
  // ★ Weekly standing for the bar's line: { rank, when } or null (not ranked).
  const [standing, setStanding] = useState(null);
  // Timed lyrics (LRC) parsed once per song; they move on the page while it plays.
  const timedLyrics = useMemo(() => parseLrc(song?.syncedLyrics), [song?.syncedLyrics]);

  // ★ The bar that follows you (shared frame: components/FollowBar.jsx).
  //   titleRef goes on the song title, playRef on the page's own Play.
  const bar = useFollowBar({ ready: !loading && !!song });

  // ★ Poster front: the page takes the art's colour (deep for the page,
  //   rest1 for the lyrics card). The header turns to glass over the art.
  const palette = useArtworkPalette(song?.artwork);
  const heroRef = useRef(null);
  useArtHero(heroRef, { deep: palette.deep, ready: !loading && !!song });

  // ⋯ menu: close on outside click or Escape.
  useEffect(() => {
    if (!moreOpen) return undefined;
    const close = () => setMoreOpen(false);
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // ── Data fetching ──
  useEffect(() => {
    if (!songId) return;
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const likedUrl = userId
          ? `/v1/media/song/${songId}/is-liked?userId=${userId}`
          : `/v1/media/song/${songId}/is-liked`;

        const [songRes, likedRes, likeCountRes] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/media/song/${songId}`, useCache: false }),
          apiCall({ method: 'get', url: likedUrl }).catch(() => ({ data: { isLiked: false } })),
          apiCall({ method: 'get', url: `/v1/media/song/${songId}/likes/count` }).catch(() => ({ data: { count: 0 } })),
        ]);

        const songData = songRes.data;

        // A removed song keeps its place in award history, so links to it
        // still arrive here. It can't be played, liked or commented on.
        if (songData.removed) {
          setSong(null);
          setError(`"${songData.title}" was removed from Unis. It stays in the winners history, but it can't be played anymore.`);
          return;
        }

        const normalized = {
          id: songData.songId,
          title: songData.title,
          artist: songData.artist.username,
          artistId: songData.artist.userId,
          artistPhoto: buildUrl(songData.artist.photoUrl) || null,
          jurisdiction: songData.jurisdiction?.name || 'Unknown',
          jurisdictionId: songData.jurisdiction?.jurisdictionId || null,
          artwork: buildUrl(songData.artworkUrl) || songArtwork,
          url: buildUrl(songData.fileUrl) || null,
          description: songData.description || 'No description available',
          score: songData.score,
          playCount: songData.playCount || 0,
          playsToday: songData.playsToday || 0,
          explicit: songData.explicit || false,
          lyrics: songData.lyrics || '',
          syncedLyrics: songData.syncedLyrics || '',
          voteCount: 0,
          duration: songData.duration ? Math.round(songData.duration / 1000) : null,
          createdAt: songData.createdAt,
          genre: songData.genre?.name || 'Unknown',
          genreId: songData.genre?.genreId || null, // ★ carry the real UUID so votes never depend on name lookup
          // Discovery tags — each chip opens a browse shelf. Write-ins aren't browsable.
          subgenres: [songData.primarySubgenre, songData.secondarySubgenre].filter(Boolean),
          moods: [songData.primaryMood, songData.secondaryMood].filter(Boolean),
          language: songData.language || null,
        };

        setSong(normalized);
        setIsLiked(likedRes.data.isLiked || false);
        setLikeCount(likeCountRes.data.count || 0);
        setLyricsOpen(false);
      } catch (err) {
        console.error('Failed to load song:', err);
        setError(err?.response?.status === 404 ? 'Song not found' : 'Failed to load song details');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [songId, userId]);

  // Play counting lives in the Player only (15s / 25% gate, source, playId).
  // This page used to POST /play itself the moment a song started, which
  // beat the Player's gated call to the 30-minute cooldown and credited skips.

  // ── Load whether the viewer already follows this artist ──
  // The sidebar's Follow button used to start at "Follow" every time, even
  // for people who already followed the artist.
  useEffect(() => {
    if (!song?.artistId || !userId || song.artistId === userId) { setIsFollowing(false); return; }
    let active = true;
    apiCall({ method: 'get', url: `/v1/users/${song.artistId}/is-following` })
      .then((res) => { if (active) setIsFollowing(!!res.data?.isFollowing); })
      .catch((err) => console.error('Failed to load follow status:', err));
    return () => { active = false; };
  }, [song?.artistId, userId]);

  // ── Weekly standing for the bar ("#3 in Downtown Harlem this week") ──
  // Same board the Charts and jurisdiction pages read, so the numbers agree.
  // A song outside the top 50, or a failed read, just shows its area.
  useEffect(() => {
    if (!song?.id || !song.jurisdictionId) { setStanding(null); return; }
    let active = true;
    fetchStandings({ type: 'song', jurisdictionId: song.jurisdictionId, genre: 'all', period: 'weekly', limit: 50 })
      .then((board) => {
        if (!active) return;
        const entry = board.entries.find((e) => e.id === song.id);
        const when = board.state === 'LIVE' ? 'this week' : 'last week';
        setStanding(entry ? { rank: entry.rank, when } : null);
      })
      .catch((err) => {
        console.error('Failed to load song standing:', err);
        if (active) setStanding(null);
      });
    return () => { active = false; };
  }, [song?.id, song?.jurisdictionId]);

  // ── The artist's photos and videos ──
  // Songs carry no photos or videos of their own, so these sections used to
  // stay hidden on every song. They show the artist's gallery (same endpoint
  // and privacy rules as the artist page) and their newest videos.
  useEffect(() => {
    setPhotoIndex(null);
    if (!song?.artistId) { setArtistPhotos([]); setArtistVideos([]); return undefined; }
    let active = true;
    Promise.all([
      apiCall({ method: 'get', url: `/v1/users/${song.artistId}/photos` }).catch((err) => {
        console.error('Failed to load artist photos:', err);
        return { data: { photos: [] } };
      }),
      apiCall({ method: 'get', url: `/v1/media/videos/artist/${song.artistId}` }).catch((err) => {
        console.error('Failed to load artist videos:', err);
        return { data: [] };
      }),
    ]).then(([photosRes, videosRes]) => {
      if (!active) return;
      setArtistPhotos(Array.isArray(photosRes.data?.photos) ? photosRes.data.photos : []);
      const videos = Array.isArray(videosRes.data) ? videosRes.data : [];
      setArtistVideos(
        [...videos]
          .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))
          .slice(0, 4),
      );
    });
    return () => { active = false; };
  }, [song?.artistId]);

  const showPrevPhoto = useCallback(() => {
    setPhotoIndex((i) => (i == null ? i : (i - 1 + artistPhotos.length) % artistPhotos.length));
  }, [artistPhotos.length]);
  const showNextPhoto = useCallback(() => {
    setPhotoIndex((i) => (i == null ? i : (i + 1) % artistPhotos.length));
  }, [artistPhotos.length]);

  // ── Load whether this song is on the user's do-not-play list ──
  useEffect(() => {
    if (!song?.id || !userId) { setIsBlocked(false); return; }
    let active = true;
    apiCall({ method: 'get', url: '/v1/playlists/blocked-songs' })
      .then(res => {
        if (active) setIsBlocked((res.data || []).some(b => b.songId === song.id));
      })
      .catch(err => console.error('Failed to load do-not-play status:', err));
    return () => { active = false; };
  }, [song?.id, userId]);

  const HeroPlayIcon = () => (
    <svg viewBox="0 0 24 24" width="22" height="22"
      style={{ width: 24, height: 24, display: 'block', fill: 'currentColor', marginLeft: 2 }}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );

  // Pause glyph drawn to match HeroPlayIcon's optical weight (no marginLeft —
  // the play triangle needs the 2px nudge for optical centering, bars don't).
  const HeroPauseIcon = () => (
    <svg viewBox="0 0 24 24" width="22" height="22"
      style={{ width: 24, height: 24, display: 'block', fill: 'currentColor' }}>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );

  const fetchSongData = async () => {
    try {
      const response = await apiCall({ method: 'get', url: `/v1/media/song/${songId}`, useCache: false });
      const songData = response.data;
      setSong(prev => ({ ...prev, lyrics: songData.lyrics || '', syncedLyrics: songData.syncedLyrics || '', description: songData.description || prev.description }));
    } catch (err) { console.error('Failed to refresh song:', err); }
  };

  // ── Handlers — all identical to original ──
  const handleVoteSuccess = () => setShowVotingWizard(false);

  const handleVote = () => {
    setSelectedNominee({
      id: song.id,
      name: song.title,
      type: 'song',
      jurisdiction: song.jurisdiction,
      genreId: song.genreId, // ★ real UUID beats name-derived lookup in the wizard
      artwork: song.artwork,
      artworkUrl: song.artwork,
   });
    setShowVotingWizard(true);
  };

  const handlePlay = async () => {
    const track = { id: song.id, songId: song.id, type: 'song', url: song.url, title: song.title, artist: song.artist, artistId: song.artistId, artwork: song.artwork, jurisdiction: song.jurisdiction };
    requestPlay(track);
  };

  // ── Player sync for THIS song ─────────────────────────────────────────
  // isThisSongLoaded: the player's current track IS this page's song
  //   (playing or paused). Clicking then toggles play/pause directly —
  //   no re-request, no restart, no queue-choice modal.
  // isThisSongPlaying: loaded AND audibly playing → show Pause.
  // Any other case (different song playing, or nothing loaded) → show Play,
  // and clicking routes through requestPlay like before. This mirrors the
  // player tray's own state logic, so the two can never disagree.
  const isThisSongLoaded =
    !!currentMedia && !!song &&
    (currentMedia.id === song.id || currentMedia.songId === song.id);
  const isThisSongPlaying = isThisSongLoaded && isPlaying;

  const handleHeroPlayClick = () => {
    if (isThisSongLoaded) {
      togglePlayPause();
    } else {
      handlePlay();
    }
  };

  const handleLike = async () => {
    if (!userId) { askToLogIn('like songs'); return; }
    if (!song?.id) return;
    const name = `\u201C${song.title}\u201D`;
    try {
      if (isLiked) {
        const res = await apiCall({ method: 'delete', url: `/v1/media/song/${song.id}/like?userId=${userId}` });
        if (res.data.success) {
          setIsLiked(false); setLikeCount(prev => Math.max(0, prev - 1));
          feedback.info(`Removed ${name} from your likes`, { id: 'song-like' });
        } else {
          feedback.error("Couldn't remove your like. Try again.");
        }
      } else {
        const res = await apiCall({ method: 'post', url: `/v1/media/song/${song.id}/like?userId=${userId}` });
        if (res.data.success) {
          setIsLiked(true); setLikeCount(prev => prev + 1);
          // First like on a track pays a point — the points pill confirms it.
          // A re-like pays nothing, so it gets a toast instead.
          const earned = res.data.pointsAwarded;
          if (earned === undefined || earned > 0) {
            showReward({ points: earned || 1, label: 'Like counted', type: 'like', anchor: 'player' });
          } else {
            feedback.success(`Liked ${name}`, { id: 'song-like' });
          }
        } else {
          feedback.error("Couldn't like this song. Try again.");
        }
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
      feedback.error(errorMessage(error, isLiked ? "Couldn't remove your like. Try again." : "Couldn't like this song. Try again."));
    }
  };

  const handleFollow = async () => {
    if (!userId) { askToLogIn('follow artists'); return; }
    const newStatus = !isFollowing;
    const who = song?.artist || 'this artist';
    setIsFollowing(newStatus);
    try {
      if (newStatus) await apiCall({ method: 'post', url: `/v1/users/${song.artistId}/follow` });
      else await apiCall({ method: 'delete', url: `/v1/users/${song.artistId}/follow` });
      feedback.success(newStatus ? `Following ${who}` : `Unfollowed ${who}`, { id: 'song-follow' });
    } catch (err) {
      console.error('Failed to toggle follow:', err);
      setIsFollowing(!newStatus);
      feedback.error(errorMessage(err, newStatus ? `Couldn't follow ${who}. Try again.` : `Couldn't unfollow ${who}. Try again.`));
    }
  };

  // ── "Don't Play" — persists to the existing blocked_songs backend.
  //    PlayerContext listens for 'unis:blocked-songs-changed' and skips
  //    blocked tracks during playlist playback.
  const handleDontPlay = async () => {
    if (!userId) { askToLogIn('manage your Don\u2019t Play list'); return; }
    if (!song?.id) return;
    try {
      if (isBlocked) {
        await apiCall({ method: 'delete', url: `/v1/playlists/blocked-songs/${song.id}` });
        setIsBlocked(false);
        feedback.success(`\u201C${song.title}\u201D can play again in your queue`);
      } else {
        await apiCall({ method: 'post', url: '/v1/playlists/blocked-songs', data: { songId: song.id } });
        setIsBlocked(true);
        feedback.success(`Added \u201C${song.title}\u201D to Don\u2019t Play \u2014 your queue will skip it`);
      }
      window.dispatchEvent(new Event('unis:blocked-songs-changed'));
    } catch (err) {
      console.error('Failed to toggle do-not-play:', err);
      feedback.error(errorMessage(err, "Couldn't update your Don\u2019t Play list. Try again."));
    }
  };

  // ── Report — opens the infringement form with this page's URL pre-filled.
  const handleReport = () =>
    navigate(`/report?url=${encodeURIComponent(window.location.href)}`);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000);
      feedback.success('Link copied', { id: 'copy-link' });
    } catch (err) {
      console.error('Failed to copy link:', err);
      feedback.info(`Copy this link: ${window.location.href}`);
    }
  };

  const handleArtistClick = () => { if (song?.artistId) navigate(`/artist/${song.artistId}`); };

  // ── Keyboard activation for div-based controls ──────────────────────────
  // The jurisdiction chip, hero artist row, and sidebar artist card are all
  // <div onClick>. A mouse reaches them; a keyboard or screen reader never
  // does — they aren't in the tab order and don't respond to Enter/Space.
  // Rather than convert them to <button> (which would inherit UA button
  // styling and risk visual regressions across three separate layouts), we
  // give them the full button contract: role, tab stop, and key handling.
  const onKeyActivate = (fn) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  const isOwner = userId && song?.artistId === userId;

  const barLine = song
    ? (standing
      ? `${song.artist} · #${standing.rank} in ${song.jurisdiction} ${standing.when}`
      : `${song.artist} · ${song.jurisdiction}`)
    : '';

  // ── Loading ──
  if (loading) {
    return (
      <Layout backgroundImage={songArtwork}>
        <div className="song-page-container">
          <UnisLoader label="Loading song..." />
        </div>
      </Layout>
    );
  }

  if (error || !song) {
    return (
      <Layout backgroundImage={songArtwork}>
        <div className="song-page-container">
          <div className="sp-error">{error || 'Song not found'}</div>
        </div>
      </Layout>
    );
  }

  const goJurisdiction = () => navigate(`/jurisdiction/${song.jurisdiction}`);
  const liveLyrics = !!song.lyrics && timedLyrics.length > 0 && isThisSongLoaded;
  const lyricsLong = !!song.lyrics && (song.lyrics.split('\n').length > 7 || song.lyrics.length > 360);
  const hasAbout = !!song.description && song.description !== 'No description available';

  return (
    <Layout backgroundImage={song.artwork}>
      {/* ── THE BAR THAT FOLLOWS YOU ──
          The song's artwork, blurred and tinted with the theme. Shows once the
          title has gone under the header; Play docks once the page's own Play
          has scrolled away. Square artwork: songs are square, people round. */}
      <FollowBar bar={bar} backdrop={song.artwork} label={`${song.title} by ${song.artist}`} className="sp-bar">
        <button type="button" className="fb-who" onClick={bar.scrollToTop} aria-label={`Back to the top of ${song.title}`}>
          <img src={song.artwork} alt="" className="sp-bar__art" />
          <span className="fb-text">
            <span className="sp-bar__title">{song.title}</span>
            <span className="fb-line">
              {isThisSongPlaying && <span className="fb-eq" aria-hidden="true"><i /><i /><i /></span>}
              <span>{isThisSongPlaying ? `Playing · ${song.artist}` : barLine}</span>
            </span>
          </span>
        </button>
        <button
          type="button"
          className={`fb-icon sp-bar__like${isLiked ? ' is-on' : ''}`}
          onClick={handleLike}
          aria-pressed={isLiked}
          aria-label={isLiked ? `Unlike ${song.title}` : `Like ${song.title}`}
        >
          <Heart size={17} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
        <button type="button" className="fb-pill" onClick={handleVote}>Vote</button>
        <button
          type="button"
          className="fb-dock"
          onClick={handleHeroPlayClick}
          aria-label={isThisSongPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
          tabIndex={bar.docked ? 0 : -1}
        >
          {isThisSongPlaying ? (
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" style={{ marginLeft: 2 }}><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
          )}
        </button>
      </FollowBar>

      <div className="sp-shell" style={{ '--sp-deep': palette.deep, '--sp-mid': palette.rest1 }}>
        {/* ── POSTER FRONT ──
            Phones: the artwork runs edge to edge under the glass header and
            melts into the page colour. Desktop: it fades in from the right
            behind a big title. */}
        <header className="sp-poster" ref={heroRef}>
          <div className="sp-poster__glow" style={{ backgroundImage: `url("${song.artwork}")` }} aria-hidden="true" />
          <div className="sp-poster__art">
            <img src={song.artwork} alt={`${song.title} artwork`} />
          </div>
          <div className="sp-poster__melt" aria-hidden="true" />
          <div className="sp-poster__shade" aria-hidden="true" />

          <button type="button" className="sp-back" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft size={19} />
          </button>

          <div className="sp-poster__text">
            {/* "#3 in Harlem this week" when ranked, otherwise just the area. */}
            <div className="sp-kicker">
              {standing && <span>#{standing.rank} in </span>}
              <button
                type="button"
                className="sp-kicker-place"
                onClick={goJurisdiction}
                aria-label={`View the ${song.jurisdiction} jurisdiction`}
              >
                {song.jurisdiction}
              </button>
              {standing && <span> {standing.when}</span>}
            </div>
            <h1 className={`sp-title ${song.title.length > 24 ? 'sp-title--long' : ''}`} ref={bar.titleRef}>
              {song.title}
              {song.explicit && <span className="sp-explicit" title="Explicit" aria-label="Explicit">E</span>}
            </h1>
            <button
              type="button"
              className="sp-artist-row"
              aria-label={`View ${song.artist}'s artist page`}
              onClick={handleArtistClick}
            >
              <span className={`sp-artist-avatar ${song.artistPhoto ? '' : 'placeholder'}`}>
                {song.artistPhoto
                  ? <img src={song.artistPhoto} alt="" />
                  : song.artist?.charAt(0).toUpperCase() || '?'}
              </span>
              <span className="sp-artist-name">{song.artist}</span>
            </button>
            <div className="sp-meta">
              <span>{formatDuration(song.duration)}</span>
              <span className="sp-dot" />
              <span>{formatNumber(song.playCount)} plays</span>
              <span className="sp-dot" />
              <span>{formatDate(song.createdAt)}</span>
              <span className="sp-genre-pill">{song.genre}</span>
            </div>
            {(song.subgenres.length > 0 || song.moods.length > 0) && (
              <div className="sp-tags" aria-label="Subgenres and moods">
                {song.subgenres.map((sg) => (
                  <button
                    key={sg.subgenreId}
                    type="button"
                    className="sp-tag sp-tag--subgenre"
                    onClick={() => navigate(`/browse/subgenre/${sg.slug}`)}
                    aria-label={`More ${sg.name} songs`}
                  >
                    {sg.name}
                  </button>
                ))}
                {song.moods.map((m) => (
                  <button
                    key={m.moodId}
                    type="button"
                    className="sp-tag sp-tag--mood"
                    onClick={() => navigate(`/browse/mood/${m.slug}`)}
                    aria-label={`More ${m.name} songs`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* When a track is loaded the player covers the bottom of the page —
            on phones that's the comment input. The padding keeps it usable. */}
        <div
          className="song-page-container"
          style={{ paddingBottom: currentMedia ? 100 : undefined }}
        >
          {/* ── ACTIONS: Like, Copy link, ⋯ · (Vote) Play ── */}
          <div className="sp-actions">
            <button
              type="button"
              onClick={handleLike}
              className={`sp-icon-btn ${isLiked ? 'is-on' : ''}`}
              aria-pressed={isLiked}
              aria-label={isLiked ? `Unlike ${song.title}` : `Like ${song.title}`}
              title={isLiked ? 'Liked' : 'Like'}
            >
              <Heart size={24} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <button type="button" onClick={handleCopyLink} className="sp-icon-btn" aria-label="Copy link" title="Copy link">
              <Link2 size={22} aria-hidden="true" />
              {/* aria-live so screen readers hear the confirmation. */}
              <span className="sp-sr" aria-live="polite">{copySuccess ? 'Link copied' : ''}</span>
            </button>
            <div className="sp-menu-wrap">
              <button
                type="button"
                className="sp-icon-btn"
                onClick={(e) => { e.stopPropagation(); setMoreOpen((o) => !o); }}
                aria-label="More options"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                <MoreHorizontal size={22} aria-hidden="true" />
              </button>
              {moreOpen && (
                <div className="sp-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={isBlocked}
                    onClick={() => { setMoreOpen(false); handleDontPlay(); }}
                    aria-label={isBlocked ? `Allow ${song.title} to play again` : `Never play ${song.title}`}
                  >
                    <Ban size={18} aria-hidden="true" />
                    <span className="sp-menu__text">
                      <span>{isBlocked ? 'Won’t play' : 'Don’t play'}</span>
                      <small>Your queue skips it</small>
                    </span>
                    <span className={`sp-switch ${isBlocked ? 'is-on' : ''}`} aria-hidden="true"><i /></span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMoreOpen(false); handleReport(); }}>
                    <Flag size={18} aria-hidden="true" />
                    <span className="sp-menu__text"><span>Report</span></span>
                  </button>
                </div>
              )}
            </div>
            <span className="sp-actions-spacer" />
            <button type="button" onClick={handleVote} className="sp-vote-pill sp-hide-phone">
              <VoteIcon size={18} tone="on" aria-hidden="true" />
              Vote
            </button>
            <button
              ref={bar.playRef}
              type="button"
              onClick={handleHeroPlayClick}
              className="sp-play"
              aria-label={isThisSongPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
            >
              {isThisSongPlaying ? <HeroPauseIcon /> : <HeroPlayIcon />}
            </button>
          </div>

          {/* Phones: Vote spans the screen, like the artist page's vote card. */}
          <button type="button" className="sp-votecard sp-hide-desktop" onClick={handleVote}>
            <VoteIcon size={22} aria-hidden="true" />
            <span className="sp-votecard__text">
              <span className="sp-votecard__title">Vote for {song.title}</span>
              <span className="sp-votecard__sub">Moves it up the {song.jurisdiction} rankings</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>

          {song.playsToday > 100 && (
            <div className="sp-stats-row">
              <span className="sp-stat sp-stat-hot">
                <TrendingUp size={15} aria-hidden="true" />
                {formatNumber(song.playsToday)} plays today
              </span>
            </div>
          )}

          <div className="sp-grid">
            {/* ━━━ MAIN COLUMN ━━━ */}
            <div className="sp-song-main">
              {/* ── LYRICS ── */}
              {song.lyrics ? (
                <section className="sp-lyrics" aria-label="Lyrics">
                  <div className="sp-lyrics-header">
                    <h2 className="sp-lyrics-label">Lyrics</h2>
                    {isOwner && (
                      <button type="button" className="sp-chip-btn" onClick={() => setShowLyricsWizard(true)}>
                        <FileText size={14} aria-hidden="true" /> Edit
                      </button>
                    )}
                    {!liveLyrics && lyricsLong && (
                      <button
                        type="button"
                        className="sp-chip-btn"
                        onClick={() => setLyricsOpen((o) => !o)}
                        aria-expanded={lyricsOpen}
                      >
                        {lyricsOpen ? 'Show less' : 'Show all'}
                      </button>
                    )}
                  </div>
                  {liveLyrics ? (
                    <div className="sp-lyrics-live lyrics-stage">
                      <LyricsLines
                        lines={timedLyrics}
                        mediaRef={audioRef}
                        size="md"
                        playing={isPlaying}
                        onSeek={(t) => {
                          if (audioRef?.current) audioRef.current.currentTime = t;
                          if (!isPlaying) togglePlayPause?.();
                        }}
                        label={`Lyrics for ${song.title}`}
                      />
                    </div>
                  ) : (
                    <div className={`sp-lyrics-body ${lyricsLong && !lyricsOpen ? 'is-clamped' : ''}`}>{song.lyrics}</div>
                  )}
                  {timedLyrics.length > 0 && !isThisSongLoaded && (
                    <p className="sp-lyrics-hint">Press play and these lyrics move with the song.</p>
                  )}
                </section>
              ) : isOwner && (
                // Only the artist sees the empty box.
                <section className="sp-lyrics sp-lyrics--empty" aria-label="Lyrics">
                  <span className="sp-lyrics-empty-icon" aria-hidden="true"><Mic size={19} /></span>
                  <span className="sp-lyrics-empty-text">
                    <strong>Lyrics</strong>
                    <span>Only you see this until you add them.</span>
                  </span>
                  <button type="button" className="sp-lyrics-add" onClick={() => setShowLyricsWizard(true)}>Add lyrics</button>
                </section>
              )}

              {/* ── ABOUT THE SONG ── */}
              {hasAbout && (
                <section className="sp-card sp-about">
                  <h2 className="sp-card-title">About the song</h2>
                  <p className="sp-about-text">{song.description}</p>
                </section>
              )}

              {/* ── RECOMMENDED ── */}
              <div className="sp-recs">
                <RecommendedSongs songId={song.id} />
              </div>

              {/* ── AD SPACE (none for Unis Plus) ── */}
              <div className="sp-ad">
                <AdSlot placement="song" />
              </div>

              {/* ── COMMENTS ── */}
              <div className="sp-comments">
                <CommentSection songId={song.id} userId={userId} songArtistId={song.artistId} />
              </div>
            </div>

            {/* ━━━ RIGHT COLUMN (phones: woven into the page above) ━━━ */}
            <aside className="sp-sidebar">
              <section className="sp-card sp-details">
                <h2 className="sp-card-title">Song details</h2>
                <div className="sp-details-grid">
                  <div className="sp-detail"><div className="sp-detail-label">Duration</div><div className="sp-detail-value">{formatDuration(song.duration)}</div></div>
                  <div className="sp-detail"><div className="sp-detail-label">Uploaded</div><div className="sp-detail-value">{formatDate(song.createdAt)}</div></div>
                  <div className="sp-detail"><div className="sp-detail-label">Plays</div><div className="sp-detail-value">{formatNumber(song.playCount)}</div></div>
                  <div className="sp-detail"><div className="sp-detail-label">Likes</div><div className="sp-detail-value">{formatNumber(likeCount)}</div></div>
                  {song.language && (
                    <div className="sp-detail">
                      <div className="sp-detail-label">Language</div>
                      <div className="sp-detail-value">
                        {taxonomy?.languages.find((l) => l.code === song.language)?.name || song.language}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Credits: removed (Nov 2026). The backend stores no producer,
                  writer or mix credits yet, so every song showed "N/A" three
                  times. Bring the section back when credits are stored. */}

              {/* ── ARTIST: a photo card with Follow ── */}
              <section className="sp-artist" aria-label="Artist">
                <div
                  className="sp-artist-card"
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${song.artist}'s artist page`}
                  onClick={handleArtistClick}
                  onKeyDown={onKeyActivate(handleArtistClick)}
                >
                  <div className="sp-artist-card__photo" aria-hidden="true">
                    {song.artistPhoto
                      ? <img src={song.artistPhoto} alt="" />
                      : <span className="sp-artist-card__initial">{song.artist?.charAt(0).toUpperCase() || '?'}</span>}
                  </div>
                  <span className="sp-artist-card__kicker">Artist</span>
                  <div className="sp-artist-card__foot">
                    <div className="sp-artist-card-info">
                      <div className="sp-artist-card-name">{song.artist}</div>
                      <div className="sp-artist-card-jur">{song.jurisdiction}</div>
                    </div>
                    <button
                      type="button"
                      className={`sp-sidebar-follow ${isFollowing ? 'following' : ''}`}
                      onClick={(e) => { e.stopPropagation(); handleFollow(); }}
                    >
                      {isFollowing ? <><Check size={14} aria-hidden="true" /> Following</> : 'Follow'}
                    </button>
                  </div>
                </div>
              </section>

              {/* ── PHOTOS: the artist's gallery, opened in the artist page's viewer ── */}
              {artistPhotos.length > 0 && (
                <section className="sp-card sp-photos">
                  <div className="sp-card-head">
                    <h2 className="sp-card-title">Photos</h2>
                    {artistPhotos.length > 6 && (
                      <button type="button" className="sp-card-link" onClick={handleArtistClick}>
                        See all {artistPhotos.length}
                      </button>
                    )}
                  </div>
                  <div className="sp-media-grid">
                    {artistPhotos.slice(0, 6).map((photo, idx) => (
                      <button
                        key={photo.photoId || idx}
                        type="button"
                        className="sp-media-photo"
                        onClick={() => setPhotoIndex(idx)}
                        aria-label={`Open photo ${idx + 1} of ${artistPhotos.length}`}
                      >
                        <img src={buildUrl(photo.photoUrl)} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* ── VIDEOS: the artist's newest, each opening its video page ── */}
              {artistVideos.length > 0 && (
                <section className="sp-card sp-videos">
                  <h2 className="sp-card-title">Videos</h2>
                  <div className="sp-video-list">
                    {artistVideos.map((video) => {
                      const thumb = buildUrl(video.artworkUrl);
                      return (
                        <button
                          key={video.videoId}
                          type="button"
                          className="sp-video-item"
                          onClick={() => navigate(`/video/${video.videoId}`)}
                          aria-label={`Watch ${video.title}`}
                        >
                          <span className={`sp-video-thumb ${thumb ? '' : 'is-empty'}`}>
                            {thumb && <img src={thumb} alt="" loading="lazy" />}
                            <span className="sp-video-play" aria-hidden="true"><Play size={20} fill="currentColor" /></span>
                          </span>
                          <span className="sp-video-title">{video.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </aside>
          </div>
        </div>
      </div>

      <PhotoLightbox
        photos={artistPhotos}
        index={photoIndex}
        artistName={song.artist}
        onClose={() => setPhotoIndex(null)}
        onPrev={showPrevPhoto}
        onNext={showNextPhoto}
      />

      {showLyricsWizard && <LyricsWizard show={showLyricsWizard} onClose={() => setShowLyricsWizard(false)} song={song} onSuccess={fetchSongData} />}

      <VotingWizard
        show={showVotingWizard} onClose={() => setShowVotingWizard(false)} onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee} userId={userId}
        filters={{ selectedGenre: song.genre.toLowerCase().replace('/', '-'), selectedType: 'song', selectedInterval: 'daily', selectedJurisdiction: song.jurisdiction.toLowerCase().replace(' ', '-') }}
      />
    </Layout>
  );
};

export default SongPage;
