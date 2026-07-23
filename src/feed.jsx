import React, { useState, useContext, useEffect, useCallback } from 'react';
import { PlayerContext } from './context/playercontext'; 
import { useNavigate } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';
import { buildUrl } from './utils/buildUrl';
import Layout from './layout';
import ArtistCard from './artistCard';
import AuthGateSheet, { useAuthGate, incrementGateSongCount } from './AuthGateSheet';
import PlaylistViewer from './playlistViewer'; // ★ feed #7
import randomRapper from './assets/randomrapper.jpeg';
import song1 from './assets/tonyfadd_paranoidbuy1get1free.mp3';
import song2 from './assets/sdboomin_waitedallnight.mp3';
import video1 from './assets/badVideo.mp4';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';
import songArtFive from './assets/songartfive.jpg';
import songArtSix from './assets/songarteight.png';
import songArtNine from './assets/albumartnine.jpg';
import songArtTen from './assets/albumartten.jpeg';
import songArtEleven from './assets/rapperphotoOne.jpg';
import { JURISDICTION_NAMES, INTERVAL_IDS } from './utils/idMappings';
import LastWonNotification from './LastWonNotification';
import './feed.scss';

// ═══════════════════════════════════════════════════════════════════
//  MODULE-SCOPE HELPERS & COMPONENTS
//
//  IMPORTANT: everything below MUST stay at module scope. Components
//  defined inside the Feed function get a new identity on every
//  render, which forces React to unmount and remount their entire
//  subtree on every state change — replaying entrance animations,
//  reloading images, and dropping focus. That was the cause of the
//  "page refreshes on every action" bug.
// ═══════════════════════════════════════════════════════════════════

// ─── Pure formatters ───
const formatDuration = (ms) => {
  if (!ms) return '';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}:${sec}`;
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
};

const formatPlayCount = (count) => {
  const value = Number(count) || 0;

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  }

  return `${value}`;
};

// "JUL 5" style label for timeline nodes
const formatAwardDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(`${dateString}T12:00:00`);
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase();
};

const isWithinDays = (dateString, days) => {
  if (!dateString) return false;
  const diff = Date.now() - new Date(dateString).getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

const pickPhoto = (obj) => {
  if (!obj) return null;
  const candidate = obj.photoUrl
    || obj.imageUrl
    || obj.profilePhotoUrl
    || obj.avatarUrl
    || obj.pictureUrl
    || obj.photo
    || obj.profilePhoto
    || obj.avatar
    || obj.picture;
  return candidate ? buildUrl(candidate) : null;
};

const toApiDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const todayInEst = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

// ─── Inline-styled play icon ───
const CardPlayIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    style={{ width: 18, height: 18, display: 'block', marginLeft: 2 }}
  >
    <polygon points="5,3 19,12 5,21" style={{ fill: '#ffffff' }} />
  </svg>
);

// ─── Lens bar icons (inline, stroke-based) ───
const LensIcon = ({ type }) => {
  const common = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (type) {
    case 'all':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'charts':
      return (
        <svg {...common}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v6a5 5 0 0 1-10 0V4z" />
          <path d="M7 6H4a1 1 0 0 0-1 1c0 2 1.5 3.5 4 4" />
          <path d="M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3.5-4 4" />
        </svg>
      );
    case 'playlists':
      return (
        <svg {...common}>
          <path d="M3 6h13" />
          <path d="M3 12h13" />
          <path d="M3 18h8" />
          <circle cx="18" cy="17" r="3" />
          <path d="M21 17V9" />
        </svg>
      );
    case 'fresh':
      return (
        <svg {...common}>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
          <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
        </svg>
      );
    default:
      return null;
  }
};

// ─── Rank movement badge for chart rows ───
const MovementBadge = ({ movement }) => {
  if (movement === null || movement === undefined) {
    return <span className="chart-movement chart-movement--new">NEW</span>;
  }
  if (movement > 0) {
    return <span className="chart-movement chart-movement--up">&#9650; {movement}</span>;
  }
  if (movement < 0) {
    return <span className="chart-movement chart-movement--down">&#9660; {Math.abs(movement)}</span>;
  }
  return <span className="chart-movement chart-movement--flat">&mdash;</span>;
};

// ─── Playlist cover (image or mosaic fallback) ───
const PlaylistCover = ({ playlist, className }) => {
  const cover = playlist.coverImageUrl ? buildUrl(playlist.coverImageUrl) : null;
  const mosaic = (playlist.firstFourArtworks || []).filter(Boolean).slice(0, 4);

  if (cover) {
    return (
      <div className={className}>
        <img src={cover} alt={playlist.name} onError={(e) => { e.target.src = randomRapper; }} />
      </div>
    );
  }
  if (mosaic.length) {
    return (
      <div className={`${className} playlist-cover--mosaic`}>
        {mosaic.map((art, i) => (
          <img key={i} src={buildUrl(art)} alt="" onError={(e) => { e.target.src = randomRapper; }} />
        ))}
      </div>
    );
  }
  return (
    <div className={className}>
      <img src={randomRapper} alt={playlist.name} />
    </div>
  );
};

// ─── Reusable song card (Trending / New releases rows) ───
const SongCard = React.memo(({ item, index, onNav, onArtistNav, onPlay }) => (
  <div 
    className="song-card"
    style={{ animationDelay: `${0.05 * (index + 1)}s` }}
    onClick={() => onNav(item.id, item.type)}
  >
    <div className="card-artwork">
      <img 
        src={item.artworkUrl || item.artwork || randomRapper} 
        alt={item.title}
        onError={(e) => { e.target.src = randomRapper; }}
      />
      {item.duration && (
        <span className="card-duration">{formatDuration(item.duration)}</span>
      )}
      {item.explicit && (
        <span className="card-explicit">E</span>
      )}
      <button
        type="button"
        className="card-play"
        aria-label={`Play ${item.title}`}
        onClick={(e) => onPlay(e, item)}
      >
        <CardPlayIcon />
      </button>
    </div>
    <div className="card-info">
      <div className="card-title">{item.title}</div>

      <div className="card-subrow">
        <div
          className="card-artist"
          onClick={(e) => {
            e.stopPropagation();
            onArtistNav(item.artistData?.userId || item.artist?.userId || 'unknown');
          }}
        >
          {item.artistData?.username || item.artist || 'Unknown'}
        </div>

        <div className="card-play-count" title={`${item.playCount || 0} total plays`}>
          <svg
            viewBox="0 0 24 24"
            width="11"
            height="11"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>{formatPlayCount(item.playCount)}</span>
        </div>
      </div>

      {item.createdAt && (
        <div className="card-meta">{formatTimeAgo(item.createdAt)}</div>
      )}
    </div>
  </div>
));

// ─── Ghost jurisdiction dropdown ───
const JurisdictionSelect = ({ jurisdictions, value, label, onChange }) => (
  <span className="ghost-select-wrapper">
    <select
      className="ghost-select"
      value={value}
      onChange={onChange}
    >
      {jurisdictions.map((j) => (
        <option key={j.id} value={j.id}>{j.name}</option>
      ))}
    </select>
    <span className="ghost-select-label">{label}</span>
    <span className="ghost-select-arrow">&#9662;</span>
  </span>
);

// ─── Active jurisdictions (matches backend hardcoded list) ───
const ACTIVE_JURISDICTIONS = [
  { id: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3', name: 'Harlem' },
  { id: '52740de0-e4e9-4c9e-b68e-1e170f6788c4', name: 'Uptown Harlem' },
  { id: '4b09eaa2-03bc-4778-b7c2-db8b42c9e732', name: 'Downtown Harlem' },
];

// Default jurisdiction for guests (Harlem — launch market)
const DEFAULT_JURISDICTION_ID = '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3';

// ─── Feed lenses ───
const LENSES = [
  { key: 'all', label: 'All' },
  { key: 'charts', label: 'Charts' },
  { key: 'playlists', label: 'Playlists' },
  { key: 'fresh', label: 'Fresh' },
];

// ─── Dummies (module scope — fallback content) ───
const getDummyTrending = () => [
  { id: 'dummy1', title: 'Tony Fadd - Paranoid', artistData: { userId: '1', username: 'Tony Fadd' }, artworkUrl: songArtOne, mediaUrl: song1, type: 'song', score: 100, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), duration: 180000, explicit: false, playsToday: 45 },
  { id: 'dummy2', title: 'SD Boomin - Waited All Night', artistData: { userId: '2', username: 'SD Boomin' }, artworkUrl: songArtTwo, mediaUrl: song2, type: 'song', score: 80, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), duration: 210000, explicit: true, playsToday: 32 },
  { id: 'dummy3', title: 'Bad Video', artistData: { userId: '3', username: 'some guy' }, artworkUrl: songArtThree, mediaUrl: video1, type: 'video', score: 60, createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), duration: 120000, explicit: false, playsToday: 18 },
  { id: 'dummy4', title: 'Song 4', artistData: { userId: '4', username: 'Artist 4' }, artworkUrl: songArtFour, mediaUrl: song1, type: 'song', score: 50, createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), duration: 195000, explicit: true, playsToday: 12 },
  { id: 'dummy5', title: 'Song 5', artistData: { userId: '5', username: 'Artist 5' }, artworkUrl: songArtFive, mediaUrl: song2, type: 'song', score: 40, createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), duration: 240000, explicit: false, playsToday: 8 }
].slice(0, 10);

const getDummyNew = () => [
  { id: 'dummy6', title: 'The Outside', artistData: { userId: '6', username: 'Artist Six' }, artworkUrl: songArtSix, mediaUrl: song1, type: 'song', score: 30, createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), duration: 155000, explicit: false },
  { id: 'dummy7', title: 'Original Man', artistData: { userId: '7', username: 'Artist Seven' }, artworkUrl: songArtNine, mediaUrl: song2, type: 'song', score: 25, createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), duration: 205000, explicit: true },
  { id: 'dummy8', title: 'flavorfall', artistData: { userId: '8', username: 'Artist Eight' }, artworkUrl: songArtTen, mediaUrl: song1, type: 'song', score: 20, createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), duration: 175000, explicit: false },
  { id: 'dummy9', title: 'Golden Son', artistData: { userId: '9', username: 'Artist Nine' }, artworkUrl: songArtEleven, mediaUrl: song2, type: 'song', score: 15, createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), duration: 188000, explicit: false },
  { id: 'dummy10', title: 'New Track', artistData: { userId: '10', username: 'Artist Ten' }, artworkUrl: songArtOne, mediaUrl: song1, type: 'song', score: 10, createdAt: new Date().toISOString(), duration: 220000, explicit: true }
].slice(0, 5);

const getDummyAwards = () => [
  { id: 'a1', name: 'Best Rap Song', winner: { id: 'w1', username: 'Tony Fadd' } },
  { id: 'a2', name: 'Top Video', winner: { id: 'w2', username: 'SD Boomin' } },
  { id: 'a3', name: 'Rising Artist', winner: { id: 'w3', username: 'Artist Three' } },
  { id: 'a4', name: 'Fan Favorite', winner: { id: 'w4', username: 'Artist Four' } },
  { id: 'a5', name: 'Breakthrough Track', winner: { id: 'w5', username: 'Artist Five' } }
].slice(0, 5);

const getDummyArtists = () => [
  { userId: 'art1', username: 'Tony Fadd', photoUrl: songArtOne, score: 100 },
  { userId: 'art2', username: 'SD Boomin', photoUrl: songArtTwo, score: 80 },
  { userId: 'art3', username: 'Artist Three', photoUrl: songArtThree, score: 60 },
  { userId: 'art4', username: 'Artist Four', photoUrl: songArtFour, score: 50 },
  { userId: 'art5', username: 'Artist Five', photoUrl: songArtFive, score: 40 }
].slice(0, 5);

const getJurisdictionDisplayName = (id, fallbackId) => {
  const key = JURISDICTION_NAMES[id || fallbackId];
  if (!key) return 'Your Area';
  return key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// ═══════════════════════════════════════════════════════════════════
//  FEED
// ═══════════════════════════════════════════════════════════════════

const Feed = () => {
  const { requestPlay } = useContext(PlayerContext);
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const { triggerGate, gateProps } = useAuthGate();

  const [animate, setAnimate] = useState(false);
  const [trendingToday, setTrendingToday] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [newMedia, setNewMedia] = useState([]);
  const [awards, setAwards] = useState([]);
  const [popularArtists, setPopularArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ─── Lens state ───
  const [activeLens, setActiveLens] = useState('all');

  // ─── Awards-derived: timeline + artist of the week ───
  const [weeklyWinners, setWeeklyWinners] = useState([]); // up to 3, newest first
  const [artistOfWeek, setArtistOfWeek] = useState(null);
  const lastWinner = weeklyWinners.length ? weeklyWinners[0] : null;

  // ─── Charts lens ───
  const [chart, setChart] = useState(null); // { totalPlaysThisWeek, entries: [] }
  // ★ feed #7: playlist opened as an overlay (no /playlist/:id route exists)
  const [viewingPlaylistId, setViewingPlaylistId] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);

  // ─── Playlists lens ───
  const [featuredPlaylist, setFeaturedPlaylist] = useState(null);
  const [communityPlaylists, setCommunityPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);

  // ─── Fresh lens: upcoming (hidden until scheduling exists on backend) ───
  const [upcoming, setUpcoming] = useState([]);

  const userId = user?.userId;
  const userJurisdictionId = user?.jurisdiction?.jurisdictionId || DEFAULT_JURISDICTION_ID;

  // ─── Jurisdiction selector state ───
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState(userJurisdictionId);

  // Simulated ad impression — only for logged-in users (guest ad revenue goes to Unis)
  useEffect(() => {
    if (!userId) return;
    const trackAdView = async () => {
      try {
        await apiCall({ url: '/v1/earnings/track-view', method: 'post' });
      } catch (err) {
        // Silent
      }
    };
    trackAdView();
  }, [userId]);

  // Update selected jurisdiction when user data loads
  useEffect(() => {
    if (userJurisdictionId) {
      setSelectedJurisdictionId(userJurisdictionId);
    }
  }, [userJurisdictionId]);

  const selectedJurisdictionName = ACTIVE_JURISDICTIONS.find(
    (j) => j.id === selectedJurisdictionId
  )?.name || 'Your Area';

  const normalizeMedia = useCallback((items) => (items || []).map(item => ({
    id: item.songId || item.videoId,
    title: item.title,
    artist: item.artist?.username || 'Unknown',
    artistData: item.artist || { userId: 'unknown', username: 'Unknown' },
    artworkUrl: buildUrl(item.artworkUrl),
    mediaUrl: buildUrl(item.fileUrl),
    url: buildUrl(item.fileUrl),
    artwork: buildUrl(item.artworkUrl),
    type: item.songId ? 'song' : 'video',
    score: item.score || 0,
    artistId: item.artist?.userId || 'unknown',
    duration: item.duration || null,
    createdAt: item.createdAt || null,
    explicit: item.explicit || false,
    playsToday: item.playsToday || 0,
    playCount: item.playCount || 0
  })), []);

  // ─── Fetch last 3 Song of the Week winners (timeline + hero) ───
  // ─── plus Artist of the Week — fires on jurisdiction change ───
  useEffect(() => {
    if (!selectedJurisdictionId) return;

    const fetchAwardsData = async () => {
      const today = new Date();
      const sixtyDaysAgo = new Date(today);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const baseParams = `startDate=${toApiDate(sixtyDaysAgo)}&endDate=${toApiDate(today)}&jurisdictionId=${selectedJurisdictionId}&intervalId=${INTERVAL_IDS['weekly']}`;

      // Same defensive filter LastWonNotification uses — reject future-dated
      // awards that leak through from the UTC-midnight cron.
      const cutoff = todayInEst();

      try {
        const [songAwardsRes, artistAwardsRes] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/awards/past?type=song&${baseParams}` }),
          apiCall({ method: 'get', url: `/v1/awards/past?type=artist&${baseParams}` }),
        ]);

        // ── Songs of the week timeline (up to 3, newest first) ──
        const songAwards = (songAwardsRes.data || [])
          .filter((a) => !a?.awardDate || a.awardDate <= cutoff)
          .filter((a) => a?.song);

        setWeeklyWinners(
          songAwards.slice(0, 3).map((award) => ({
            awardId: award.awardId,
            awardDate: award.awardDate,
            songId: award.song.songId || award.targetId,
            title: award.song.title || 'Unknown',
            artworkUrl: buildUrl(award.song.artworkUrl),
            artistName: award.song.artist?.username || 'Unknown',
            artistId: award.song.artist?.userId,
          }))
        );

        // ── Artist of the week (most recent artist award) ──
        const artistAwards = (artistAwardsRes.data || [])
          .filter((a) => !a?.awardDate || a.awardDate <= cutoff)
          .filter((a) => a?.user);

        if (artistAwards.length) {
          const award = artistAwards[0];
          setArtistOfWeek({
            userId: award.user.userId || award.targetId,
            username: award.user.username || 'Unknown',
            photoUrl: pickPhoto(award.user),
            votesCount: award.votesCount || 0,
            awardDate: award.awardDate,
          });
        } else {
          setArtistOfWeek(null);
        }
      } catch (err) {
        // Hero falls back to particles, timeline/artist sections hide
        console.error('[Feed] awards fetch failed (timeline + artist of week hidden):', err);
        setWeeklyWinners([]);
        setArtistOfWeek(null);
      }
    };

    fetchAwardsData();
  }, [selectedJurisdictionId]);

  // ─── Fetch main feed data — fires on mount AND when jurisdiction changes ───
  // No longer requires userId — guests get feed with default jurisdiction
  useEffect(() => {
    setAnimate(true);
    if (!selectedJurisdictionId) return;

    const fetchMediaData = async () => {
      setLoading(true);
      setError('');
      try {
        const jId = selectedJurisdictionId;

        const [trendingTodayRes, topRatedRes, newRes, songAwardsRes, artistAwardsRes, popularRes] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/media/trending/today?jurisdictionId=${jId}&limit=10` }),
          apiCall({ method: 'get', url: `/v1/media/trending?jurisdictionId=${jId}&limit=5` }),
          apiCall({ method: 'get', url: `/v1/media/new?jurisdictionId=${jId}&limit=5` }),
          apiCall({ method: 'get', url: `/v1/awards/leaderboards?type=song&jurisdictionId=${jId}` }),
          apiCall({ method: 'get', url: `/v1/awards/leaderboards?type=artist&jurisdictionId=${jId}` }),
          apiCall({ method: 'get', url: `/v1/users/artist/top?jurisdictionId=${jId}&limit=5` })
        ]);

        setTrendingToday(normalizeMedia(trendingTodayRes.data || []));
        setTopRated(normalizeMedia(topRatedRes.data || []));
        setNewMedia(normalizeMedia(newRes.data || []));
        
        const combinedAwards = [...(songAwardsRes.data || []), ...(artistAwardsRes.data || [])].slice(0, 5);
        setAwards(combinedAwards);

        const normalizedArtists = (popularRes.data || []).map(artist => ({
          ...artist,
          photoUrl: pickPhoto(artist)
        }));

        setPopularArtists(normalizedArtists);
      } catch (err) {
        console.error('Media load error:', err);
        setError('Feed unavailable—showing demo content.');
      } finally {
        setLoading(false);
      }
    };

    fetchMediaData();
  }, [selectedJurisdictionId, normalizeMedia]);

  // ─── Fetch weekly most-played chart — lazy, when Charts lens is active ───
  // chartFetchedFor caches per jurisdiction so toggling lenses back and
  // forth never refires the request.
  const chartFetchedFor = React.useRef(null);
  useEffect(() => {
    if (activeLens !== 'charts' || !selectedJurisdictionId) return;
    if (chartFetchedFor.current === selectedJurisdictionId) return;

    const fetchChart = async () => {
      setChartLoading(true);
      try {
        const res = await apiCall({
          method: 'get',
          url: `/v1/charts?jurisdictionId=${selectedJurisdictionId}&limit=10`,
        });
        setChart(res.data || null);
        chartFetchedFor.current = selectedJurisdictionId;
        console.info(`[Feed] chart loaded: ${res.data?.entries?.length ?? 0} entries, ${res.data?.totalPlaysThisWeek ?? 0} plays this week`);
      } catch (err) {
        console.error('[Feed] chart fetch failed (empty state shown):', err);
        setChart(null);
        chartFetchedFor.current = selectedJurisdictionId; // don't hammer a failing endpoint
      } finally {
        setChartLoading(false);
      }
    };

    fetchChart();
  }, [activeLens, selectedJurisdictionId]);

  // ─── Fetch playlists — lazy, when Playlists lens is active ───
  const playlistsFetchedFor = React.useRef(null);
  useEffect(() => {
    if (activeLens !== 'playlists' || !selectedJurisdictionId) return;
    if (playlistsFetchedFor.current === selectedJurisdictionId) return;

    const fetchPlaylists = async () => {
      setPlaylistsLoading(true);
      try {
        const [officialRes, communityRes] = await Promise.all([
          apiCall({ method: 'get', url: `/v1/playlists/official` }),
          apiCall({ method: 'get', url: `/v1/playlists/community/${selectedJurisdictionId}` }),
        ]);

        const official = officialRes.data || [];
        const community = (communityRes.data || [])
          .slice()
          .sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));

        // Featured = latest official (curated) playlist, else top community
        setFeaturedPlaylist(official.length ? official[0] : (community.length ? community[0] : null));
        setCommunityPlaylists(
          official.length ? community : community.slice(1)
        );
        playlistsFetchedFor.current = selectedJurisdictionId;
        console.info(`[Feed] playlists loaded: ${official.length} official, ${community.length} community`);
      } catch (err) {
        console.error('[Feed] playlists fetch failed (empty state shown):', err);
        setFeaturedPlaylist(null);
        setCommunityPlaylists([]);
        playlistsFetchedFor.current = selectedJurisdictionId;
      } finally {
        setPlaylistsLoading(false);
      }
    };

    fetchPlaylists();
  }, [activeLens, selectedJurisdictionId]);

  // ─── Fetch upcoming releases — lazy, when Fresh lens is active ───
  // Backend endpoint doesn't exist yet; section stays hidden until it does.
  const upcomingFetchedFor = React.useRef(null);
  useEffect(() => {
    if (activeLens !== 'fresh' || !selectedJurisdictionId) return;
    if (upcomingFetchedFor.current === selectedJurisdictionId) return;

    const fetchUpcoming = async () => {
      try {
        const res = await apiCall({
          method: 'get',
          url: `/v1/media/upcoming?jurisdictionId=${selectedJurisdictionId}&limit=5`,
        });
        setUpcoming(res.data || []);
      } catch (err) {
        // Expected until song scheduling ships on the backend
        console.warn('[Feed] /v1/media/upcoming unavailable (Dropping Soon hidden)');
        setUpcoming([]);
      } finally {
        upcomingFetchedFor.current = selectedJurisdictionId;
      }
    };

    fetchUpcoming();
  }, [activeLens, selectedJurisdictionId]);

  const handleSongNav = useCallback((mediaId, type = 'song') => navigate(`/${type}/${mediaId}`), [navigate]);
  const handleArtistNav = useCallback((artistId) => navigate(`/artist/${artistId}`), [navigate]);
  // ★ FIX (feed #7 — "the screen just breaks when a playlist is clicked"):
  //   navigate('/playlist/:id') pointed at a route that DOES NOT EXIST in
  //   App.jsx (the only playlist route is /admin/playlists). React Router fell
  //   through to the catch-all and the page went blank. PlaylistViewer is an
  //   overlay component (playlistId + onClose), not a page — so open it in
  //   place, exactly like playlistManager/playlistPanel do.
  //   Restored — this was reverted by 46230a8 (Jul 16).
  const handlePlaylistNav = useCallback((playlistId) => setViewingPlaylistId(playlistId), []);

  const handlePlayMedia = useCallback(async (e, media) => {
    e.stopPropagation();

    // Track guest listening for the AuthGateSheet nudge.
    // Real logged-in play tracking now happens inside Player.jsx after
    // the listener reaches the playback threshold.
    if (isGuest) {
      incrementGateSongCount();
    }

    let playMediaObj = media;

    if (media.type === 'artist') {
      try {
        const defaultRes = await apiCall({
          method: 'get',
          url: `/v1/users/${media.artistData.userId}/default-song`,
        });

        playMediaObj = {
          type: 'song',
          id: defaultRes.data.songId,
          songId: defaultRes.data.songId,
          url: buildUrl(defaultRes.data.fileUrl) || song1,
          fileUrl: buildUrl(defaultRes.data.fileUrl) || song1,
          title: defaultRes.data.title || 'Default Track',
          artist: media.artistData?.username || media.artist,
          artistId: media.artistData?.userId,
          artwork: buildUrl(defaultRes.data.artworkUrl) || media.artworkUrl,
          artworkUrl: buildUrl(defaultRes.data.artworkUrl) || media.artworkUrl,
        };
      } catch (err) {
        console.error('Default song fetch error:', err);

        playMediaObj = {
          type: 'song',
          id: 'default-fallback',
          songId: 'default-fallback',
          url: song1,
          fileUrl: song1,
          title: 'Default Track',
          artist: media.artistData?.username || media.artist,
          artistId: media.artistData?.userId,
          artwork: media.artworkUrl,
          artworkUrl: media.artworkUrl,
        };
      }
    }

    requestPlay(playMediaObj);
  }, [isGuest, requestPlay]);

  // Play a chart entry (ChartsDto shape → player shape)
  const handlePlayChartEntry = useCallback((e, entry) => {
    e.stopPropagation();
    if (isGuest) {
      incrementGateSongCount();
    }
    requestPlay({
      type: 'song',
      id: entry.songId,
      songId: entry.songId,
      url: buildUrl(entry.fileUrl),
      fileUrl: buildUrl(entry.fileUrl),
      title: entry.title,
      artist: entry.artistName,
      artistId: entry.artistId,
      artwork: buildUrl(entry.artworkUrl),
      artworkUrl: buildUrl(entry.artworkUrl),
    });
  }, [isGuest, requestPlay]);

  const handleJurisdictionChange = useCallback((e) => {
    setSelectedJurisdictionId(e.target.value);
  }, []);

  // Vote CTA — gates for guests
  const handleVoteClick = useCallback((e) => {
    e.stopPropagation();
    if (isGuest) {
      triggerGate('vote');
      return;
    }
    navigate('/voteawards');
  }, [isGuest, triggerGate, navigate]);

  // Lens switch — no-op when already active so redundant re-renders
  // (and animation replays) can't happen from repeat activation.
  const handleLensClick = useCallback((lensKey) => {
    setActiveLens((current) => (current === lensKey ? current : lensKey));
  }, []);

  const trendingTodayList = trendingToday.length ? trendingToday.slice(0, 10) : getDummyTrending();
  const topRatedList = topRated.length ? topRated.slice(0, 5) : getDummyTrending();
  const newMediaList = newMedia.length ? newMedia.slice(0, 5) : getDummyNew();
  const awardsList = awards.length ? awards.slice(0, 5) : getDummyAwards();
  const artistsList = popularArtists.length ? popularArtists.slice(0, 5) : getDummyArtists();
  // Charts NEVER falls back to demo content — an honest empty state
  // builds more trust at launch than fake rankings.
  const chartData = (chart && chart.entries && chart.entries.length) ? chart : null;

  if (loading) return (
    <Layout backgroundImage={randomRapper}>
      <div className="feed-loading">
        <div className="feed-loading-spinner" />
        <span>Loading your feed...</span>
      </div>
    </Layout>
  );

  return (
    <Layout backgroundImage={randomRapper}>
      <div className="feed-content-wrapper">
        {error && <div className="feed-error">{error}</div>}
        <main className="feed">

          {/* ═══════ HERO BANNER (static across all lenses) ═══════ */}
          <div className="hero-banner" onClick={handleVoteClick}>
            <div className="hero-gradient" />
        {lastWinner ? (
          <div
            className="hero-winner"
            onClick={(e) => {
              e.stopPropagation();
              handleSongNav(lastWinner.songId, 'song');
            }}
          >
            <div className="hero-winner-label">Song of the Week</div>
            <div className="hero-winner-thumb">
              <img
                src={lastWinner.artworkUrl || randomRapper}
                alt={lastWinner.title}
                onError={(e) => { e.target.src = randomRapper; }}
              />
              <div className="hero-winner-tooltip">
                <div className="hero-winner-title">{lastWinner.title}</div>
                <div className="hero-winner-artist">{lastWinner.artistName}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hero-particles">
            <div className="hero-particle hero-particle--1" />
            <div className="hero-particle hero-particle--2" />
            <div className="hero-particle hero-particle--3" />
          </div>
        )}
            <div className="hero-content">
              <span className="hero-label">Featured in {selectedJurisdictionName}</span>
              <h1 className="hero-title">Vote for This Week's Top Track</h1>
              <p className="hero-subtitle">
                Your vote decides who tops the neighborhood leaderboard. Listen, discover, and support local artists.
              </p>
              <button type="button" className="hero-cta" onClick={handleVoteClick}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Vote Now
              </button>
            </div>
          </div>

          {/* ═══════ LENS BAR ═══════ */}
          <div className="lens-bar" role="tablist" aria-label="Feed views">
            {LENSES.map((lens) => (
              <button
                key={lens.key}
                type="button"
                role="tab"
                aria-selected={activeLens === lens.key}
                className={`lens-button ${activeLens === lens.key ? 'lens-button--active' : ''}`}
                onClick={() => handleLensClick(lens.key)}
              >
                <LensIcon type={lens.key} />
                <span>{lens.label}</span>
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════ */}
          {/* ═══════ LENS: ALL ═══════ */}
          {/* ═══════════════════════════════════════ */}
          {activeLens === 'all' && (
            <>
              {/* ═══════ TRENDING TODAY ═══════ */}
              <section className={`feed-section ${animate ? 'animate' : ''}`}>
                <div className="section-header">
                  <h2 className="section-title">
                    Trending Today in{' '}
                    <JurisdictionSelect
                      jurisdictions={ACTIVE_JURISDICTIONS}
                      value={selectedJurisdictionId}
                      label={selectedJurisdictionName}
                      onChange={handleJurisdictionChange}
                    />
                  </h2>
                </div>
                <div className="card-row">
                  {trendingTodayList.map((item, index) => (
                    <SongCard
                      key={item.id}
                      item={item}
                      index={index}
                      onNav={handleSongNav}
                      onArtistNav={handleArtistNav}
                      onPlay={handlePlayMedia}
                    />
                  ))}
                </div>
              </section>

              {/* ═══════ NEW RELEASES ═══════ */}
              <section className={`feed-section ${animate ? 'animate' : ''}`}>
                <div className="section-header">
                  <h2 className="section-title">
                    New Releases
                  </h2>
                </div>
                <div className="card-row">
                  {newMediaList.map((item, index) => (
                    <SongCard
                      key={item.id}
                      item={item}
                      index={index}
                      onNav={handleSongNav}
                      onArtistNav={handleArtistNav}
                      onPlay={handlePlayMedia}
                    />
                  ))}
                </div>
              </section>

              {/* ═══════ SONGS OF THE WEEK TIMELINE ═══════ */}
              {weeklyWinners.length > 0 && (
                <section className={`feed-section ${animate ? 'animate' : ''}`}>
                  <div className="section-header">
                    <h2 className="section-title">Songs of the Week</h2>
                  </div>
                  <div className="winners-timeline">
                    <div className="winners-timeline-rail" />
                    {weeklyWinners.map((winner, i) => (
                      <div
                        key={winner.awardId || winner.songId}
                        className={`winners-timeline-node ${i === 0 ? 'winners-timeline-node--current' : ''}`}
                        onClick={() => handleSongNav(winner.songId, 'song')}
                      >
                        <div className="winners-timeline-thumb">
                          <img
                            src={winner.artworkUrl || randomRapper}
                            alt={winner.title}
                            onError={(e) => { e.target.src = randomRapper; }}
                          />
                        </div>
                        <div className="winners-timeline-date">{formatAwardDate(winner.awardDate)}</div>
                        <div className="winners-timeline-song">{winner.title}</div>
                        <div
                          className="winners-timeline-artist"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (winner.artistId) handleArtistNav(winner.artistId);
                          }}
                        >
                          {winner.artistName}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* ═══════ ARTIST OF THE WEEK ═══════ */}
              {artistOfWeek && (
                <section className={`feed-section ${animate ? 'animate' : ''}`}>
                  <div
                    className="artist-of-week"
                    onClick={() => handleArtistNav(artistOfWeek.userId)}
                  >
                    <div className="artist-of-week-photo-wrap">
                      <svg className="artist-of-week-crown" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                        <path d="M3 18h18l-1.5-9-4.5 4-3-7-3 7-4.5-4L3 18z" fill="#eab308" />
                      </svg>
                      <div className="artist-of-week-photo">
                        <img
                          src={artistOfWeek.photoUrl || randomRapper}
                          alt={artistOfWeek.username}
                          onError={(e) => { e.target.src = randomRapper; }}
                        />
                      </div>
                    </div>

                    {/* ★ feed #3: portrait-first. The circular image is the hero
                        and fills the card; the caption sits beneath it, centred.
                        Restored — this was reverted by 46230a8 (Jul 16). */}
                    <div className="artist-of-week-caption">
                      <div className="artist-of-week-label">
                        Artist of the Week &middot; {selectedJurisdictionName}
                      </div>
                      <div className="artist-of-week-name">{artistOfWeek.username}</div>
                      {artistOfWeek.votesCount > 0 && (
                        <div className="artist-of-week-meta">
                          {artistOfWeek.votesCount} vote{artistOfWeek.votesCount !== 1 ? 's' : ''} this week
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* ═══════ POPULAR ARTISTS ═══════ */}
              <section className={`feed-section artist-cards ${animate ? "animate" : ""}`}>
                <div className="section-header">
                  <h2 className="section-title">
                    Popular Artists 
                  </h2>
                </div>
                <div className="artist-cards-grid">
                  {(() => {
                    const artistMap = new Map();
                    const allMedia = [...trendingToday, ...topRated, ...newMedia];
                    
                    allMedia.forEach(media => {
                      if (media.artistData && !artistMap.has(media.artistData.userId)) {
                        artistMap.set(media.artistData.userId, {
                          userId: media.artistData.userId,
                          username: media.artistData.username,
                          // Raw path or null — ArtistCard applies buildUrl and
                          // falls back to a placeholder. encodeURI(undefined)
                          // produced the literal string "undefined", which
                          // defeated the fallback and rendered a blank card.
                          photoUrl: media.artistData.photoUrl || null,
                          jurisdictionId: media.artistData.jurisdiction?.jurisdictionId,
                          jurisdictionName: getJurisdictionDisplayName(
                            media.artistData.jurisdiction?.jurisdictionId,
                            selectedJurisdictionId
                          ),
                          score: media.artistData.score || 0
                        });
                      }
                    });
                    
                    const artists = Array.from(artistMap.values())
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 5);
                    
                    return artists.map((artist, i) => (
                      <ArtistCard
                        key={artist.userId}
                        artist={artist}
                        index={i}
                        onPress={() => handleArtistNav(artist.userId)}
                        onViewPress={() => handleArtistNav(artist.userId)}
                      />
                    ));
                  })()}
                </div>
              </section>
            </>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ═══════ LENS: CHARTS ═══════ */}
          {/* ═══════════════════════════════════════ */}
          {activeLens === 'charts' && (
            <section className={`feed-section ${animate ? 'animate' : ''}`}>
              <div className="section-header section-header--stacked">
                <h2 className="section-title">Most Played This Week</h2>
                <div className="chart-caption">
                  Voting closes Sunday 11:59 PM
                  {chartData && (
                    <> &middot; {formatPlayCount(chartData.totalPlaysThisWeek)} play{chartData.totalPlaysThisWeek !== 1 ? 's' : ''} this week</>
                  )}
                </div>
              </div>

              {chartLoading ? (
                <div className="lens-loading">
                  <div className="feed-loading-spinner" />
                </div>
              ) : !chartData ? (
                <div className="lens-empty">
                  No plays counted yet this week in {selectedJurisdictionName}. Be the
                  first &mdash; press play on any track.
                </div>
              ) : (
                <div className="chart-list">
                  {chartData.entries.map((entry) => (
                    <div
                      key={entry.songId}
                      className={`chart-row ${entry.rank === 1 ? 'chart-row--first' : ''}`}
                      onClick={() => handleSongNav(entry.songId, 'song')}
                    >
                      <div className="chart-row-ambient" aria-hidden="true">
                        <img src={buildUrl(entry.artworkUrl) || randomRapper} alt="" />
                      </div>
                      <span className="chart-rank">{entry.rank}</span>
                      <div className="chart-artwork">
                        <img
                          src={buildUrl(entry.artworkUrl) || entry.artworkUrl || randomRapper}
                          alt={entry.title}
                          onError={(e) => { e.target.src = randomRapper; }}
                        />
                      </div>
                      <div className="chart-info">
                        <div className="chart-song-title">{entry.title}</div>
                        <div
                          className="chart-song-artist"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (entry.artistId) handleArtistNav(entry.artistId);
                          }}
                        >
                          {entry.artistName} &middot; {formatPlayCount(entry.plays)} play{entry.plays !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <MovementBadge movement={entry.movement} />
                      <button
                        type="button"
                        className="chart-play"
                        aria-label={`Play ${entry.title}`}
                        onClick={(e) => handlePlayChartEntry(e, entry)}
                      >
                        <CardPlayIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {lastWinner && (
                <div
                  className="chart-last-winner"
                  onClick={() => handleSongNav(lastWinner.songId, 'song')}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4z" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>
                    Last week's winner:&nbsp;
                    <strong>{lastWinner.title} &mdash; {lastWinner.artistName}</strong>
                  </span>
                </div>
              )}
            </section>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ═══════ LENS: PLAYLISTS ═══════ */}
          {/* ═══════════════════════════════════════ */}
          {activeLens === 'playlists' && (
            <section className={`feed-section ${animate ? 'animate' : ''}`}>
              <div className="section-header">
                <h2 className="section-title">Playlists Rising in {selectedJurisdictionName}</h2>
              </div>

              {playlistsLoading ? (
                <div className="lens-loading">
                  <div className="feed-loading-spinner" />
                </div>
              ) : (
                <>
                  {featuredPlaylist && (
                    <div
                      className="featured-playlist"
                      onClick={() => handlePlaylistNav(featuredPlaylist.playlistId)}
                    >
                      <PlaylistCover playlist={featuredPlaylist} className="featured-playlist-cover" />
                      <div className="featured-playlist-body">
                        <span className="featured-playlist-badge">
                          {featuredPlaylist.type === 'official' ? 'Curated by Unis' : 'Community Favorite'}
                        </span>
                        <div className="featured-playlist-name">{featuredPlaylist.name}</div>
                        <div className="featured-playlist-meta">
                          {featuredPlaylist.songCount || 0} track{(featuredPlaylist.songCount || 0) !== 1 ? 's' : ''}
                          {featuredPlaylist.creatorName ? <> &middot; by {featuredPlaylist.creatorName}</> : null}
                        </div>
                      </div>
                    </div>
                  )}

                  {communityPlaylists.length > 0 ? (
                    <div className="playlist-grid">
                      {communityPlaylists.slice(0, 8).map((playlist) => (
                        <div
                          key={playlist.playlistId}
                          className="playlist-tile"
                          onClick={() => handlePlaylistNav(playlist.playlistId)}
                        >
                          <div className="playlist-tile-cover-wrap">
                            <PlaylistCover playlist={playlist} className="playlist-tile-cover" />
                            <span className="playlist-tile-count">
                              {playlist.songCount || 0} track{(playlist.songCount || 0) !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="playlist-tile-name">{playlist.name}</div>
                          <div className="playlist-tile-meta">
                            {playlist.creatorName ? `by ${playlist.creatorName}` : ''}
                            {playlist.followerCount ? ` · ${formatPlayCount(playlist.followerCount)} followers` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !featuredPlaylist && (
                      <div className="lens-empty">
                        No public playlists in {selectedJurisdictionName} yet. Be the first to make one.
                      </div>
                    )
                  )}
                </>
              )}
            </section>
          )}

          {/* ═══════════════════════════════════════ */}
          {/* ═══════ LENS: FRESH ═══════ */}
          {/* ═══════════════════════════════════════ */}
          {activeLens === 'fresh' && (
            <section className={`feed-section ${animate ? 'animate' : ''}`}>
              <div className="section-header">
                <h2 className="section-title">Dropped Recently</h2>
              </div>
              <div className="fresh-list">
                {newMediaList.map((item) => (
                  <div
                    key={item.id}
                    className="fresh-row"
                    onClick={() => handleSongNav(item.id, item.type)}
                  >
                    <div className="fresh-artwork">
                      <img
                        src={item.artworkUrl || item.artwork || randomRapper}
                        alt={item.title}
                        onError={(e) => { e.target.src = randomRapper; }}
                      />
                    </div>
                    <div className="fresh-info">
                      <div className="fresh-title">{item.title}</div>
                      <div
                        className="fresh-artist"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArtistNav(item.artistData?.userId || 'unknown');
                        }}
                      >
                        {item.artistData?.username || item.artist || 'Unknown'}
                        {item.createdAt ? <> &middot; {formatTimeAgo(item.createdAt)}</> : null}
                      </div>
                    </div>
                    {isWithinDays(item.createdAt, 7) && (
                      <span className="fresh-badge">NEW</span>
                    )}
                    <button
                      type="button"
                      className="chart-play"
                      aria-label={`Play ${item.title}`}
                      onClick={(e) => handlePlayMedia(e, item)}
                    >
                      <CardPlayIcon />
                    </button>
                  </div>
                ))}
              </div>

              {/* Dropping soon — renders only once /v1/media/upcoming exists and returns data */}
              {upcoming.length > 0 && (
                <>
                  <div className="section-header fresh-upcoming-header">
                    <h2 className="section-title">Dropping Soon</h2>
                  </div>
                  <div className="fresh-list">
                    {upcoming.map((item) => (
                      <div key={item.songId} className="fresh-row fresh-row--upcoming">
                        <div className="fresh-artwork">
                          <img
                            src={buildUrl(item.artworkUrl) || randomRapper}
                            alt={item.title}
                            onError={(e) => { e.target.src = randomRapper; }}
                          />
                        </div>
                        <div className="fresh-info">
                          <div className="fresh-title">{item.title}</div>
                          <div className="fresh-artist">
                            {item.artist?.username || 'Unknown'}
                          </div>
                        </div>
                        <span className="fresh-date">
                          {item.scheduledReleaseAt
                            ? new Date(item.scheduledReleaseAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : 'Soon'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

        </main>
      </div>

      {/* Only show LastWonNotification for logged-in users */}
      {!isGuest && <LastWonNotification />}

      {/* Auth gate bottom sheet — triggered when guest taps Vote */}
      {/* ★ feed #7: playlist overlay (replaces the dead /playlist/:id route) */}
      {viewingPlaylistId && (
        <PlaylistViewer
          playlistId={viewingPlaylistId}
          onClose={() => setViewingPlaylistId(null)}
        />
      )}

      <AuthGateSheet {...gateProps} />
    </Layout>
  );
};

export default Feed;